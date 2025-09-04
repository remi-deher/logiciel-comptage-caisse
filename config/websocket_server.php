<?php
// Fichier : config/websocket_server.php (Version Finale Complète et Corrigée)

// Port d'écoute du serveur WebSocket
$port = '8081'; // Assurez-vous que ce port est correct et ouvert

require dirname(__DIR__) . '/vendor/autoload.php';
require_once __DIR__ . '/../src/services/ClotureStateService.php';

// Charge la configuration de la base de données
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
} else {
    die("Erreur critique: Le fichier config/config.php est introuvable.\n");
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

    // Le serveur mémorise l'état de la clôture ET l'état du formulaire pour la session en cours
    private $clotureState = null;
    private $formState = []; // La "mémoire" du formulaire

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
            echo "Connexion à la base de données '" . DB_NAME . "' réussie.\n";
        } catch (PDOException $e) {
            die("Erreur de connexion à la BDD dans le WebSocket : " . $e->getMessage() . "\n");
        }
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        echo "Nouvelle connexion ! ({$conn->resourceId})\n";
        
        if ($this->clotureState === null) {
            echo "Premier client connecté. Chargement de l'état initial depuis la base de données...\n";
            $this->updateAndCacheClotureState();
        }

        $conn->send(json_encode(['type' => 'welcome', 'resourceId' => $conn->resourceId]));
        $conn->send(json_encode($this->clotureState));
        $conn->send(json_encode(['type' => 'full_form_state', 'state' => $this->formState]));
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        try {
            $data = json_decode($msg, true);
            
            if (isset($data['id']) && isset($data['value'])) {
                $this->formState[$data['id']] = $data['value'];
                $this->broadcast($msg, $from);
                return;
            }

            if (!isset($data['type'])) return;

            $actionProcessed = false;
            switch ($data['type']) {
                case 'cloture_lock':
                    $this->clotureStateService->lockCaisse($data['caisse_id'], (string)$from->resourceId);
                    $actionProcessed = true;
                    break;
                case 'cloture_unlock':
                    $this->clotureStateService->unlockCaisse($data['caisse_id']);
                    $actionProcessed = true;
                    break;
                case 'cloture_force_unlock':
                    $this->clotureStateService->forceUnlockCaisse($data['caisse_id']);
                    $actionProcessed = true;
                    break;
                case 'cloture_reopen':
                    $this->clotureStateService->reopenCaisse($data['caisse_id']);
                    $actionProcessed = true;
                    break;
                case 'cloture_caisse_confirmed':
                    $this->clotureStateService->confirmCaisse($data['caisse_id']);
                    $actionProcessed = true;
                    break;
            }

            if ($actionProcessed) {
                $this->updateAndCacheClotureState();
                $this->broadcastClotureStateToAll();
            }
        } catch (\Throwable $e) {
            echo "\n--- ERREUR FATALE DÉTECTÉE ---\n";
            echo "Message: " . $e->getMessage() . "\n";
            echo "Fichier: " . $e->getFile() . " à la ligne " . $e->getLine() . "\n";
            echo "--- FIN DE L'ERREUR ---\n\n";
            $from->close();
        }
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);
        $this->clotureStateService->forceUnlockByConnectionId((string)$conn->resourceId);
        
        if (count($this->clients) === 0) {
            echo "Dernier client déconnecté.\n";
            // CORRECTION : On ne réinitialise l'état du formulaire que si aucune caisse n'a été clôturée.
            // Cela préserve les données pour la clôture générale.
            if ($this->clotureState === null || empty($this->clotureState['closed_caisses'])) {
                echo "Aucune caisse n'était clôturée, l'état du formulaire est réinitialisé.\n";
                $this->formState = [];
            } else {
                echo "Au moins une caisse est clôturée, l'état du formulaire est préservé pour la clôture générale.\n";
            }
            $this->clotureState = null;
        } else {
            $this->updateAndCacheClotureState();
            $this->broadcastClotureStateToAll();
        }
        echo "Connexion {$conn->resourceId} fermée.\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Une erreur de connexion est survenue: {$e->getMessage()}\n";
        $conn->close();
    }

    private function broadcast($message, $exclude) {
        foreach ($this->clients as $client) {
            if ($client !== $exclude) {
                $client->send($message);
            }
        }
    }
    
    private function updateAndCacheClotureState() {
        $this->clotureState = [
            'type' => 'cloture_locked_caisses',
            'caisses' => $this->clotureStateService->getLockedCaisses(),
            'closed_caisses' => $this->clotureStateService->getClosedCaisses()
        ];
    }
    
    public function broadcastClotureStateToAll() {
        if ($this->clotureState === null) return;
        
        $message = json_encode($this->clotureState);
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
