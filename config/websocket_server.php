<?php
// Fichier : config/websocket_server.php (Version Finale pour la SPA)

// Port d'écoute du serveur WebSocket
$port = '8081'; // Assurez-vous que ce port est correct et ouvert

require dirname(__DIR__) . '/vendor/autoload.php';
require_once __DIR__ . '/../src/services/ClotureStateService.php';

// Charge la configuration de la base de données
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
} else {
    die("Erreur critique: config.php non trouvé.\n");
}

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;

class CaisseServer implements MessageComponentInterface {
    protected $clients;
    private $pdo;
    private $clotureStateService;

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $this->pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            $this->clotureStateService = new ClotureStateService($this->pdo);
            echo "Serveur WebSocket démarré sur le port {$GLOBALS['port']}.\n";
        } catch (PDOException $e) {
            die("Erreur de connexion BDD dans le WebSocket : " . $e->getMessage() . "\n");
        }
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        echo "Nouvelle connexion ! ({$conn->resourceId})\n";
        
        // Envoie un message de bienvenue avec l'ID de connexion, crucial pour la logique de clôture
        $conn->send(json_encode(['type' => 'welcome', 'resourceId' => $conn->resourceId]));
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        $data = json_decode($msg, true);
        if (!is_array($data)) return;

        // Diffusion simple des mises à jour des champs du formulaire
        // C'est le mécanisme principal du temps réel pour le calculateur.
        if (isset($data['id']) && isset($data['value'])) {
            $this->broadcast($msg, $from);
            return;
        }

        // Gestion des messages structurés avec un "type"
        if (isset($data['type'])) {
            switch ($data['type']) {
                // Logique de synchronisation initiale
                case 'request_state':
                    $this->broadcast(json_encode(['type' => 'send_full_state']), $from);
                    break;
                case 'broadcast_state':
                    $this->broadcast($msg, $from);
                    break;
                
                // Logique de clôture
                case 'cloture_lock':
                    if ($this->clotureStateService->lockCaisse($data['caisse_id'], (string)$from->resourceId)) {
                        $this->broadcastClotureStateToAll();
                    }
                    break;
                case 'cloture_unlock':
                    $this->clotureStateService->unlockCaisse($data['caisse_id']);
                    $this->broadcastClotureStateToAll();
                    break;
                case 'cloture_caisse_confirmed':
                    $this->broadcastClotureStateToAll();
                    break;
            }
        }
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);
        // Nettoie les verrous de l'utilisateur qui s'est déconnecté
        $this->clotureStateService->forceUnlockByConnectionId((string)$conn->resourceId);
        $this->broadcastClotureStateToAll();
        echo "Connexion {$conn->resourceId} fermée.\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Une erreur est survenue: {$e->getMessage()}\n";
        $conn->close();
    }

    // Diffuse un message à tous les clients SAUF à l'expéditeur
    private function broadcast($message, $exclude) {
        foreach ($this->clients as $client) {
            if ($client !== $exclude) {
                $client->send($message);
            }
        }
    }
    
    // Diffuse l'état de la clôture à TOUS les clients
    private function broadcastClotureStateToAll() {
        $state = [
            'type' => 'cloture_locked_caisses',
            'caisses' => $this->clotureStateService->getLockedCaisses(),
            'closed_caisses' => $this->clotureStateService->getClosedCaisses()
        ];
        $message = json_encode($state);
        foreach ($this->clients as $client) {
            $client->send($message);
        }
    }
}

// Lancement du serveur
$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new CaisseServer()
        )
    ),
    $port
);

$server->run();
