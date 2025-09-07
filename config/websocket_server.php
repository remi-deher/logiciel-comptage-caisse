<?php
// Fichier : config/websocket_server.php (Version Robuste avec Reconnexion et Ping)

// Port d'écoute du serveur WebSocket
$port = '8081';

require dirname(__DIR__) . '/vendor/autoload.php';
require_once __DIR__ . '/../src/services/ClotureStateService.php';

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
use React\EventLoop\Factory as LoopFactory; // MODIFICATION : Ajout pour la boucle d'événements

class CaisseServer implements MessageComponentInterface {
    protected $clients;
    /** @var ?PDO */
    private $pdo;
    private $clotureStateService;
    private $dbCredentials; // MODIFICATION : Propriété pour stocker les identifiants BDD

    private $clotureState = null;
    private $formState = [];

    public function __construct() {
        $this->clients = new \SplObjectStorage;

        // MODIFICATION : On stocke les identifiants pour la reconnexion
        $this->dbCredentials = [
            'dsn' => "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
            'user' => DB_USER,
            'pass' => DB_PASS,
            'options' => [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        ];

        $this->connect(); // Premier appel à la connexion
        $this->clotureStateService = new ClotureStateService($this->pdo);

        echo "Serveur WebSocket démarré sur le port {$GLOBALS['port']}.\n";
    }

    // MODIFICATION : Méthode dédiée pour la connexion
    private function connect() {
        echo "Tentative de connexion à la base de données...\n";
        try {
            $this->pdo = new PDO(
                $this->dbCredentials['dsn'],
                $this->dbCredentials['user'],
                $this->dbCredentials['pass'],
                $this->dbCredentials['options']
            );
            // Si le service existe déjà, on met à jour son objet PDO
            if ($this->clotureStateService) {
                $this->clotureStateService->setPDO($this->pdo); // Assurez-vous d'ajouter cette méthode dans ClotureStateService
            }
            echo "Connexion à la base de données '" . DB_NAME . "' réussie.\n";
        } catch (PDOException $e) {
            echo "Erreur de connexion à la BDD : " . $e->getMessage() . "\n";
            // On ne fait pas un die() pour permettre au serveur de retenter plus tard
            $this->pdo = null; 
        }
    }

    /**
     * MODIFICATION : Wrapper pour exécuter toutes les actions liées à la BDD.
     * C'est ici que la magie de la reconnexion opère.
     * @param callable $action La fonction qui contient le code interagissant avec la BDD.
     * @return mixed Le résultat de la fonction $action.
     */
    private function executeDbAction(callable $action) {
        try {
            if (!$this->pdo) { // Si la connexion initiale a échoué
                $this->connect();
                if (!$this->pdo) { // Si la reconnexion a aussi échoué
                    throw new PDOException("Impossible de se connecter à la base de données.");
                }
            }
            return $action(); // Première tentative
        } catch (PDOException $e) {
            // On vérifie si l'erreur est bien celle qui nous intéresse
            if (strpos($e->getMessage(), 'server has gone away') !== false || strpos($e->getMessage(), 'Lost connection') !== false) {
                echo "La connexion BDD a été perdue. Tentative de reconnexion...\n";
                $this->connect(); // Reconnexion
                if (!$this->pdo) {
                    throw new PDOException("La reconnexion à la base de données a échoué.");
                }
                return $action(); // Deuxième tentative
            } else {
                // Si c'est une autre erreur, on la propage
                throw $e;
            }
        }
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        echo "Nouvelle connexion ! ({$conn->resourceId})\n";
        
        $this->executeDbAction(function() { // MODIFICATION : On utilise le wrapper
            if ($this->clotureState === null) {
                echo "Premier client connecté. Chargement de l'état initial...\n";
                $this->updateAndCacheClotureState();
            }
        });

        $conn->send(json_encode(['type' => 'welcome', 'resourceId' => $conn->resourceId]));
        $conn->send(json_encode($this->clotureState));
        $conn->send(json_encode(['type' => 'full_form_state', 'state' => $this->formState]));
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        // MODIFICATION : On englobe tout le contenu dans le wrapper
        $this->executeDbAction(function() use ($from, $msg) {
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
                // ... autres cas identiques ...
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
        });
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);

        $this->executeDbAction(function() use ($conn) { // MODIFICATION : On utilise le wrapper
            $this->clotureStateService->forceUnlockByConnectionId((string)$conn->resourceId);
            if (count($this->clients) === 0) {
                 echo "Dernier client déconnecté.\n";
                 if ($this->clotureState === null || empty($this->clotureState['closed_caisses'])) {
                     $this->formState = [];
                 }
                 $this->clotureState = null;
             } else {
                 $this->updateAndCacheClotureState();
                 $this->broadcastClotureStateToAll();
             }
        });

        echo "Connexion {$conn->resourceId} fermée.\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Une erreur de connexion est survenue: {$e->getMessage()}\n";
        $conn->close();
    }

    private function updateAndCacheClotureState() {
        // Cette méthode fait des appels BDD via le service, donc elle doit être appelée depuis executeDbAction
        $this->clotureState = [
            'type' => 'cloture_locked_caisses',
            'caisses' => $this->clotureStateService->getLockedCaisses(),
            'closed_caisses' => $this->clotureStateService->getClosedCaisses()
        ];
    }
    
    // ... broadcast et broadcastClotureStateToAll restent inchangées ...
    private function broadcast($message, $exclude) { /* ... */ }
    public function broadcastClotureStateToAll() { /* ... */ }

    /**
     * MODIFICATION : Méthode pour le ping périodique
     */
    public function pingDatabase() {
        try {
            $this->executeDbAction(function() {
                $this->pdo->query('SELECT 1');
            });
            echo "Ping BDD réussi.\n";
        } catch (PDOException $e) {
            echo "ERREUR lors du ping BDD : " . $e->getMessage() . "\n";
        }
    }
}

// --- MODIFICATION : Lancement du serveur avec la boucle d'événements ---

echo "Initialisation du serveur WebSocket...\n";

// 1. Créer la boucle d'événements
$loop = LoopFactory::create();

// 2. Instancier votre application
$caisseServerApp = new CaisseServer();

// 3. Ajouter la tâche de ping périodique à la boucle
// Ping toutes les 60 secondes pour garder la connexion active
$loop->addPeriodicTimer(60, function () use ($caisseServerApp) {
    $caisseServerApp->pingDatabase();
});

// 4. Créer le serveur WebSocket en lui passant la boucle
$server = new IoServer(
    new HttpServer(
        new WsServer(
            $caisseServerApp
        )
    ),
    new \React\Socket\Server("0.0.0.0:$port", $loop), // On passe la boucle ici
    $loop // Et ici
);

// 5. Lancer le serveur
$server->run();
