<?php

// Port utilisé pour le Websocket
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

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        $this->clotureStateService = new ClotureStateService();
        echo "Serveur de caisse démarré.\n";
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        echo "Nouvelle connexion! ({$conn->resourceId})\n";

        // Send a welcome message with the connection ID
        $conn->send(json_encode(['type' => 'welcome', 'resourceId' => $conn->resourceId]));

        // Send the current form state and lock status
        $lockedCaisses = $this->clotureStateService->getLockedCaisses();
        $closedCaisses = $this->clotureStateService->getClosedCaisses();
        $fullState = array_merge([], ['cloture_locked_caisses' => $lockedCaisses, 'closed_caisses' => $closedCaisses]);
        $conn->send(json_encode($fullState));
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        $data = json_decode($msg, true);

        if (isset($data['type'])) {
            switch ($data['type']) {
                case 'cloture_lock':
                    $caisseId = $data['caisse_id'];
                    if ($this->clotureStateService->lockCaisse($caisseId, $from->resourceId)) {
                        $this->broadcast(['type' => 'cloture_locked_caisses', 'caisses' => $this->clotureStateService->getLockedCaisses(), 'closed_caisses' => $this->clotureStateService->getClosedCaisses()]);
                    }
                    break;
                case 'cloture_unlock':
                    $caisseId = $data['caisse_id'];
                    $lockedState = $this->clotureStateService->getLockedCaisses();
                    $isLockedByMe = false;
                    foreach ($lockedState as $lockedCaisse) {
                        if ($lockedCaisse['caisse_id'] === $caisseId && $lockedCaisse['locked_by'] === $from->resourceId) {
                            $isLockedByMe = true;
                            break;
                        }
                    }

                    if ($isLockedByMe) {
                        $this->clotureStateService->unlockCaisse($caisseId);
                        $this->broadcast(['type' => 'cloture_locked_caisses', 'caisses' => $this->clotureStateService->getLockedCaisses(), 'closed_caisses' => $this->clotureStateService->getClosedCaisses()]);
                    } else {
                        $from->send(json_encode(['type' => 'unlock_refused', 'message' => "Vous ne pouvez pas déverrouiller une caisse qui n'est pas verrouillée par vous."]));
                    }
                    break;
                case 'force_unlock':
                    $caisseId = $data['caisse_id'];
                    $lockedState = $this->clotureStateService->getLockedCaisses();
                    foreach ($lockedState as $lockedCaisse) {
                        if ($lockedCaisse['caisse_id'] === $caisseId) {
                            foreach ($this->clients as $client) {
                                if ($client->resourceId === $lockedCaisse['locked_by']) {
                                    $client->send(json_encode(['type' => 'force_unlocked', 'message' => "Votre session a été déverrouillée par un autre utilisateur."]));
                                }
                            }
                            $this->clotureStateService->unlockCaisse($caisseId);
                            $this->broadcast(['type' => 'cloture_locked_caisses', 'caisses' => $this->clotureStateService->getLockedCaisses(), 'closed_caisses' => $this->clotureStateService->getClosedCaisses()]);
                            break;
                        }
                    }
                    break;
                case 'cloture_caisse_confirmed':
                    $caisseId = $data['caisse_id'];
                    $this->clotureStateService->confirmCaisse($caisseId);
                    $this->clotureStateService->unlockCaisse($caisseId);
                    
                    $this->broadcast(['type' => 'cloture_locked_caisses', 'caisses' => $this->clotureStateService->getLockedCaisses(), 'closed_caisses' => $this->clotureStateService->getClosedCaisses()]);
                    
                    global $noms_caisses;
                    if (count($this->clotureStateService->getClosedCaisses()) === count($noms_caisses)) {
                         $this->broadcast(['type' => 'all_caisses_closed']);
                    }
                    break;
                default:
                    // Handle regular input messages
                    if (isset($data['id']) && isset($data['value'])) {
                        $caisseId = explode('_', $data['id'])[1] ?? null;
                        $lockedState = $this->clotureStateService->getLockedCaisses();
                        $isLockedByAnother = false;
                        foreach ($lockedState as $lockedCaisse) {
                            if ($lockedCaisse['caisse_id'] === $caisseId && $lockedCaisse['locked_by'] !== $from->resourceId) {
                                $isLockedByAnother = true;
                                break;
                            }
                        }
                        if (!$isLockedByAnother && !$this->clotureStateService->isCaisseConfirmed($caisseId)) {
                            $this->broadcast($data, $from);
                        }
                    }
                    break;
            }
        }
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);
        echo "Connexion {$conn->resourceId} terminée\n";
        
        $lockedState = $this->clotureStateService->getLockedCaisses();
        foreach($lockedState as $lockedCaisse) {
            if ($lockedCaisse['locked_by'] === $conn->resourceId) {
                $this->clotureStateService->unlockCaisse($lockedCaisse['caisse_id']);
                $this->broadcast(['type' => 'cloture_locked_caisses', 'caisses' => $this->clotureStateService->getLockedCaisses(), 'closed_caisses' => $this->clotureStateService->getClosedCaisses()]);
            }
        }
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Une erreur est survenue: {$e->getMessage()}\n";
        $conn->close();
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
