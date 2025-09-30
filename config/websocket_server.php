<?php
// Fichier : config/websocket_server.php (Corrigé pour la nouvelle structure)

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

    // --- NOUVEAU : Gestion des verrous en mémoire ---
    private $lockedCaisses = []; // Format: ['caisse_id' => 'resource_id']

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
        $conn->send(json_encode(['type' => 'welcome', 'resourceId' => $conn->resourceId]));
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        echo "MESSAGE RECU de CLIENT-{$from->resourceId}: {$msg}\n";
        $data = json_decode($msg, true);
        if (!isset($data['type'])) return;
        
        $broadcastClotureState = false;

        switch ($data['type']) {
            case 'get_full_state':
                $this->executeDbAction(function() use ($from) {
                    $from->send(json_encode($this->getClotureStatePayload()));
                    $from->send(json_encode(['type' => 'full_form_state', 'state' => $this->formState, 'cheques' => $this->chequesState, 'tpe' => $this->tpeState]));
                });
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
                if (!isset($this->tpeState[$data['caisseId']])) { $this->tpeState[$data['caisseId']] = []; }
                $this->tpeState[$data['caisseId']][$data['terminalId']] = $data['releves'];
                $this->broadcast($msg, $from);
                break;

            // --- NOUVELLE GESTION DES VERROUS ---
            case 'cloture_lock':
                // On ne verrouille que si la caisse n'est pas déjà verrouillée par quelqu'un d'autre
                if (!isset($this->lockedCaisses[$data['caisse_id']])) {
                    $this->lockedCaisses[$data['caisse_id']] = (string)$from->resourceId;
                    $broadcastClotureState = true;
                }
                break;
            case 'cloture_unlock':
                // On ne déverrouille que si c'est le bon utilisateur qui le demande
                if (isset($this->lockedCaisses[$data['caisse_id']]) && $this->lockedCaisses[$data['caisse_id']] === (string)$from->resourceId) {
                    unset($this->lockedCaisses[$data['caisse_id']]);
                    $broadcastClotureState = true;
                }
                break;
            
            case 'cloture_reopen':
                $this->executeDbAction(function() use ($data) {
                    $this->clotureStateService->reopenCaisse($data['caisse_id']);
                });
                $broadcastClotureState = true;
                break;

            case 'cloture_state_changed': // Reçu après une validation de clôture réussie
                unset($this->lockedCaisses[$data['caisse_id'] ?? null]); // On libère le verrou
                $broadcastClotureState = true;
                break;

            case 'force_reload_all':
                $this->formState = []; $this->chequesState = []; $this->tpeState = []; $this->lockedCaisses = [];
                $this->broadcast(json_encode(['type' => 'force_reload_all']), null);
                break;
        }

        if ($broadcastClotureState) {
            $this->broadcastClotureStateToAll();
        }
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);
        $resourceId = (string)$conn->resourceId;
        
        // On libère les verrous détenus par la connexion qui s'est fermée
        foreach ($this->lockedCaisses as $caisseId => $lockOwnerId) {
            if ($lockOwnerId === $resourceId) {
                unset($this->lockedCaisses[$caisseId]);
            }
        }
        
        if (count($this->clients) === 0) {
             echo "Dernier client déconnecté. Réinitialisation de l'état en mémoire.\n";
             $this->formState = []; $this->chequesState = []; $this->tpeState = []; $this->lockedCaisses = [];
         } else {
             $this->broadcastClotureStateToAll(); // Notifier les autres du changement de verrou
         }
        echo "CONNEXION FERMEE pour CLIENT-{$conn->resourceId}.\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Une erreur de connexion est survenue: {$e->getMessage()}\n";
        $conn->close();
    }
    
    // --- NOUVELLE MÉTHODE POUR CONSTRUIRE L'ÉTAT ACTUEL ---
    private function getClotureStatePayload() {
        $caisses = [];
        foreach ($this->lockedCaisses as $caisseId => $resourceId) {
            $caisses[] = ['caisse_id' => $caisseId, 'locked_by' => $resourceId];
        }

        return $this->executeDbAction(function() use ($caisses) {
            return [
                'type' => 'cloture_state',
                'locked_caisses' => $caisses,
                'closed_caisses' => $this->clotureStateService->getClosedCaisses()
            ];
        });
    }
    
    private function broadcast($message, $exclude) {
        foreach ($this->clients as $client) {
            if ($exclude !== $client) {
                $client->send($message);
            }
        }
    }

    public function broadcastClotureStateToAll() {
        $message = json_encode($this->getClotureStatePayload());
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
