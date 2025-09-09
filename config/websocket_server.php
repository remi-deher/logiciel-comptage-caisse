<?php
// Fichier : config/websocket_server.php (Version Finale Corrigée et Verbosifiée)

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
use React\EventLoop\Factory as LoopFactory;

class CaisseServer implements MessageComponentInterface {
    protected $clients;
    /** @var ?PDO */
    private $pdo;
    private $clotureStateService;
    private $dbCredentials;

    private $clotureState = null;
    private $formState = [];

    public function __construct() {
        $this->clients = new \SplObjectStorage;

        $this->dbCredentials = [
            'dsn' => "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
            'user' => DB_USER,
            'pass' => DB_PASS,
            'options' => [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        ];

        $this->connect();
        $this->clotureStateService = new ClotureStateService($this->pdo);

        echo "Serveur WebSocket démarré sur le port {$GLOBALS['port']}.\n";
    }

    private function connect() {
        echo "Tentative de connexion à la base de données...\n";
        try {
            $this->pdo = new PDO(
                $this->dbCredentials['dsn'],
                $this->dbCredentials['user'],
                $this->dbCredentials['pass'],
                $this->dbCredentials['options']
            );
            if ($this->clotureStateService) {
                $this->clotureStateService->setPDO($this->pdo);
            }
            echo "Connexion à la base de données '" . DB_NAME . "' réussie.\n";
        } catch (PDOException $e) {
            echo "Erreur de connexion à la BDD : " . $e->getMessage() . "\n";
            $this->pdo = null;
        }
    }

    private function executeDbAction(callable $action) {
        try {
            if (!$this->pdo) {
                $this->connect();
                if (!$this->pdo) {
                    throw new PDOException("Impossible de se connecter à la base de données.");
                }
            }
            return $action();
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'server has gone away') !== false || strpos($e->getMessage(), 'Lost connection') !== false) {
                echo "La connexion BDD a été perdue. Tentative de reconnexion...\n";
                $this->connect();
                if (!$this->pdo) {
                    throw new PDOException("La reconnexion à la base de données a échoué.");
                }
                return $action();
            } else {
                throw $e;
            }
        }
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        echo "NOUVELLE CONNEXION : Client ID {$conn->resourceId}\n";
        
        $this->executeDbAction(function() use ($conn) {
            if ($this->clotureState === null) {
                echo "CLIENT-{$conn->resourceId} : Premier client, chargement de l'état initial des caisses.\n";
                $this->updateAndCacheClotureState();
            }
        });

        $conn->send(json_encode(['type' => 'welcome', 'resourceId' => $conn->resourceId]));
        $conn->send(json_encode($this->clotureState));
        $conn->send(json_encode(['type' => 'full_form_state', 'state' => $this->formState]));
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        echo "MESSAGE RECU de CLIENT-{$from->resourceId}: {$msg}\n";
        $this->executeDbAction(function() use ($from, $msg) {
            $data = json_decode($msg, true);

 if (isset($data['id']) && isset($data['value'])) {
                // --- DEBUT DE LA CORRECTION DE SÉCURITÉ ---
                // On extrait l'ID de la caisse depuis l'ID du champ (ex: "b200_1" -> "1")
                $parts = explode('_', $data['id']);
                $caisseId = end($parts);

                if (is_numeric($caisseId)) {
                    $caisseId = intval($caisseId);
                    $status = $this->clotureStateService->getCaisseStatus($caisseId);

                    // Si la caisse a un statut, qu'elle est verrouillée, ET que l'expéditeur
                    // n'est PAS celui qui a posé le verrou...
                    if ($status && $status['status'] === 'locked' && $status['locked_by_ws_id'] != (string)$from->resourceId) {
                        // ... alors on refuse l'action et on arrête le traitement.
                        echo "  -> ACTION REFUSEE : CLIENT-{$from->resourceId} a tenté de modifier la caisse {$caisseId} qui est verrouillée par CLIENT-{$status['locked_by_ws_id']}.\n";
                        return;
                    }
                }
                // --- FIN DE LA CORRECTION DE SÉCURITÉ ---

                $this->formState[$data['id']] = $data['value'];
                $this->broadcast($msg, $from);
                return;
            }

            if (!isset($data['type'])) return;
            
            $actionProcessed = false;
            switch ($data['type']) {
                case 'cloture_lock':
                    echo "ACTION: CLIENT-{$from->resourceId} demande à verrouiller la caisse {$data['caisse_id']}.\n";
                    $lockSuccess = $this->clotureStateService->lockCaisse($data['caisse_id'], (string)$from->resourceId);
                    if ($lockSuccess) {
                        echo "  -> SUCCES : Verrouillage de la caisse {$data['caisse_id']} par CLIENT-{$from->resourceId} réussi.\n";
                    } else {
                        echo "  -> ECHEC : Impossible de verrouiller la caisse {$data['caisse_id']} (probablement déjà verrouillée).\n";
                    }
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
        });
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);

        $this->executeDbAction(function() use ($conn) {
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

        echo "CONNEXION FERMEE pour CLIENT-{$conn->resourceId}.\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Une erreur de connexion est survenue: {$e->getMessage()}\n";
        $conn->close();
    }

    private function updateAndCacheClotureState() {
        $this->clotureState = [
            'type' => 'cloture_locked_caisses',
            'caisses' => $this->clotureStateService->getLockedCaisses(),
            'closed_caisses' => $this->clotureStateService->getClosedCaisses()
        ];
    }
    
    private function broadcast($message, $exclude) {
        foreach ($this->clients as $client) {
            if ($exclude !== $client) {
                $client->send($message);
            }
        }
    }

    public function broadcastClotureStateToAll() {
        $message = json_encode($this->clotureState);
        echo "BROADCAST à tous les clients : {$message}\n";
        foreach ($this->clients as $client) {
            $client->send($message);
        }
    }

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

echo "Initialisation du serveur WebSocket...\n";

$loop = LoopFactory::create();
$caisseServerApp = new CaisseServer();

$loop->addPeriodicTimer(60, function () use ($caisseServerApp) {
    $caisseServerApp->pingDatabase();
});

$server = new IoServer(
    new HttpServer(
        new WsServer(
            $caisseServerApp
        )
    ),
    new \React\Socket\Server("0.0.0.0:$port", $loop),
    $loop
);

$server->run();
