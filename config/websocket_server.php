<?php

// Port used for WebSocket
$port = '8081';

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;

require dirname(__FILE__, 2) . '/vendor/autoload.php';
require dirname(__FILE__, 2) . '/src/services/ClotureStateService.php';
@include_once dirname(__FILE__, 2) . '/config/config.php';

class Caisse implements MessageComponentInterface {
    protected $clients;
    private $clotureStateService;
    private $nomsCaisses;
    private $pdo; // Ajout de la propriété PDO

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        
        global $noms_caisses;
        if (!isset($noms_caisses)) {
             $noms_caisses = [];
        }
        $this->nomsCaisses = $noms_caisses;

        // Connexion à la BDD dans le constructeur du serveur WebSocket
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $this->pdo = new PDO($dsn, DB_USER, DB_PASS);
            $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch (PDOException $e) {
            die("Erreur de connexion à la base de données : " . $e->getMessage());
        }

        // Initialisation du service de clôture avec l'objet PDO
        $this->clotureStateService = new ClotureStateService($this->pdo);
        echo "Serveur de caisse démarré.\n";
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        echo "Nouvelle connexion! ({$conn->resourceId})\n";

        // Send a welcome message with the connection ID
        $conn->send(json_encode(['type' => 'welcome', 'resourceId' => $conn->resourceId]));

        // Send the initial state of locked and closed cash registers
        $this->broadcastClotureState();
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        try {
            $data = json_decode($msg, true);
            if (!is_array($data)) {
                return;
            }

            // Correction: La logique de traitement est inversée.
            // On gère d'abord les messages de saisie, qui n'ont pas de 'type'.
            if (isset($data['id']) && isset($data['value'])) {
                $caisseId = explode('_', $data['id'])[1] ?? null;

                $isLockedByAnother = false;
                $lockedState = $this->clotureStateService->getLockedCaisses();
                foreach ($lockedState as $lockedCaisse) {
                    if (intval($lockedCaisse['caisse_id']) === intval($caisseId) && $lockedCaisse['locked_by'] !== (string)$from->resourceId) {
                        $isLockedByAnother = true;
                        break;
                    }
                }
                $isConfirmed = $this->clotureStateService->isCaisseConfirmed(intval($caisseId));

                if (!$isLockedByAnother && !$isConfirmed) {
                    $this->broadcast($data, $from);
                }
                return;
            }

            // Ensuite, on gère les messages de contrôle qui ont un 'type'.
            if (!isset($data['type'])) {
                 return;
            }

            switch ($data['type']) {
                case 'cloture_lock':
                    $caisseId = intval($data['caisse_id']);
                    if ($this->clotureStateService->lockCaisse($caisseId, (string)$from->resourceId)) {
                        $this->broadcastClotureState();
                    }
                    break;
                case 'cloture_unlock':
                    $caisseId = intval($data['caisse_id']);
                    $lockedState = $this->clotureStateService->getLockedCaisses();
                    $isLockedByMe = false;
                    foreach ($lockedState as $lockedCaisse) {
                        if (intval($lockedCaisse['caisse_id']) === $caisseId && $lockedCaisse['locked_by'] === (string)$from->resourceId) {
                            $isLockedByMe = true;
                            break;
                        }
                    }

                    if ($isLockedByMe) {
                        $this->clotureStateService->unlockCaisse($caisseId);
                        $this->broadcastClotureState();
                    } else {
                        $from->send(json_encode(['type' => 'unlock_refused', 'message' => "You cannot unlock a cash register that is not locked by you."]));
                    }
                    break;
                case 'force_unlock':
                    $caisseId = intval($data['caisse_id']);
                    $lockedState = $this->clotureStateService->getLockedCaisses();
                    foreach ($lockedState as $lockedCaisse) {
                        if (intval($lockedCaisse['caisse_id']) === $caisseId) {
                            foreach ($this->clients as $client) {
                                if ($client->resourceId === $lockedCaisse['locked_by']) {
                                    $client->send(json_encode(['type' => 'force_unlocked', 'message' => "Your session has been unlocked by another user."]));
                                }
                            }
                            $this->clotureStateService->forceUnlockCaisse($caisseId);
                            $this->broadcastClotureState();
                            break;
                        }
                    }
                    break;
                case 'cloture_caisse_confirmed':
                    $caisseId = intval($data['caisse_id']);
                    $this->clotureStateService->confirmCaisse($caisseId);
                    $this->clotureStateService->unlockCaisse($caisseId);
                    
                    $this->broadcastClotureState();
                    
                    if (count($this->clotureStateService->getClosedCaisses()) === count($this->nomsCaisses)) {
                        $this->broadcast(['type' => 'all_caisses_closed']);
                        $this->clotureStateService->resetState(); // Reset after broadcasting
                    }
                    break;
            }
        } catch (\Exception $e) {
            // Laissez un log d'erreur général pour les problèmes inattendus
            error_log("Erreur dans onMessage: {$e->getMessage()}");
        }
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);
        echo "Connexion {$conn->resourceId} terminée\n";
        
        $lockedState = $this->clotureStateService->getLockedCaisses();
        foreach($lockedState as $lockedCaisse) {
            if ($lockedCaisse['locked_by'] === (string)$conn->resourceId) {
                $this->clotureStateService->unlockCaisse(intval($lockedCaisse['caisse_id']));
                $this->broadcastClotureState();
                break;
            }
        }
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Une erreur est survenue: {$e->getMessage()}\n";
        $conn->close();
    }
    
    // Broadcast the full state of cash registers
    private function broadcastClotureState() {
        $lockedCaisses = $this->clotureStateService->getLockedCaisses();
        $closedCaisses = $this->clotureStateService->getClosedCaisses();
        $message = ['type' => 'cloture_locked_caisses', 'caisses' => $lockedCaisses, 'closed_caisses' => $closedCaisses];
        $this->broadcast($message);
    }

    // Utility function to broadcast a message
    private function broadcast($message, $exclude = null) {
        $jsonMessage = json_encode($message);
        foreach ($this->clients as $client) {
            if ($client !== $exclude) {
                $client->send($jsonMessage);
            }
        }
    }
}

$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new Caisse()
        )
    ),
    $port // Port d'écoute du WebSocket
);

echo "Serveur WebSocket démarré sur le port $port\n";
$server->run();
