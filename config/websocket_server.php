<?php
// Fichier : config/websocket_server.php (Version Finale Complète et Corrigée)

// Port d'écoute du serveur WebSocket
$port = '8081'; // Assurez-vous que ce port est correct et ouvert sur votre pare-feu

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
    private $chequesState = []; 
    private $tpeState = [];

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

        $this->loadInitialStateFromDb();

        echo "Serveur WebSocket démarré sur le port {$GLOBALS['port']}.\n";
    }

    private function loadInitialStateFromDb() {
        echo "Chargement de l'état initial des caisses depuis la base de données...\n";
        try {
            $this->executeDbAction(function() {
                $this->updateAndCacheClotureState();
                echo "État initial chargé avec succès.\n";
            });
        } catch (Exception $e) {
            echo "Erreur lors du chargement de l'état initial : " . $e->getMessage() . "\n";
            $this->clotureState = [
                'type' => 'cloture_locked_caisses',
                'caisses' => [],
                'closed_caisses' => []
            ];
        }
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
        $conn->send(json_encode(['type' => 'welcome', 'resourceId' => $conn->resourceId]));
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        echo "MESSAGE RECU de CLIENT-{$from->resourceId}: {$msg}\n";
        $this->executeDbAction(function() use ($from, $msg) {
            $data = json_decode($msg, true);
            if (!isset($data['type'])) return;
            
            $actionProcessed = false;
            switch ($data['type']) {
                case 'get_full_state':
                    $from->send(json_encode($this->clotureState));
                    $from->send(json_encode(['type' => 'full_form_state', 'state' => $this->formState, 'cheques' => $this->chequesState, 'tpe' => $this->tpeState]));
                    break;
                
                case 'update':
                    $this->formState[$data['id']] = $data['value'];
                    $this->broadcast($msg, $from);
                    break;
                
                case 'cheque_update':
                    $this->chequesState[$data['caisseId']] = $data['cheques'];
                    $this->broadcast($msg, $from);
                    break;

                case 'tpe_update':
                    if (!isset($this->tpeState[$data['caisseId']])) {
                        $this->tpeState[$data['caisseId']] = [];
                    }
                    $this->tpeState[$data['caisseId']][$data['terminalId']] = $data['releves'];
                    $this->broadcast($msg, $from);
                    break;

                case 'cloture_lock':
                    $this->clotureStateService->lockCaisse($data['caisse_id'], (string)$from->resourceId);
                    $actionProcessed = true;
                    break;
                case 'cloture_unlock':
                    $this->clotureStateService->unlockCaisse($data['caisse_id']);
                    $actionProcessed = true;
                    break;
                
                case 'cloture_state_changed':
                    $actionProcessed = true;
                    break;

		        case 'force_reload_all':
                    $this->formState = [];
                    $this->chequesState = [];
                    $this->tpeState = [];
                    $this->broadcast(json_encode(['type' => 'force_reload_all']), null);
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
                 echo "Dernier client déconnecté. Réinitialisation de l'état en mémoire.\n";
                 $this->formState = [];
                 $this->chequesState = [];
                 $this->tpeState = [];
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
        } catch (PDOException $e) {
            echo "ERREUR lors du ping BDD : " . $e->getMessage() . "\n";
        }
    }
}

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
