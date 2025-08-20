<?php

// Port utilisé pour le Websocket
$port = '8081';

// websocket_server.php
use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;

require dirname(__FILE__, 2) . '/vendor/autoload.php';

class Caisse implements MessageComponentInterface {
    protected $clients;
    // Un tableau pour mémoriser l'état du formulaire et de la caisse verrouillée.
    private $formState = [];
    private $lockedCaisse = ['caisse_id' => null, 'locked_by' => null];

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        echo "Serveur de caisse démarré.\n";
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        echo "Nouvelle connexion! ({$conn->resourceId})\n";

        // Envoie l'état actuel complet du formulaire et le statut de verrouillage
        $fullState = array_merge($this->formState, ['cloture_lock_status' => $this->lockedCaisse]);
        $conn->send(json_encode($fullState));
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        $data = json_decode($msg, true);

        // NOUVEAU: Gère les messages de verrouillage/déverrouillage
        if (isset($data['type'])) {
            if ($data['type'] === 'cloture_lock') {
                $caisseId = $data['caisse_id'];
                // Vérifie si la caisse n'est pas déjà verrouillée
                if ($this->lockedCaisse['caisse_id'] === null) {
                    $this->lockedCaisse = ['caisse_id' => $caisseId, 'locked_by' => $from->resourceId];
                    // Diffuse le statut de verrouillage à tous les clients
                    $this->broadcast(['type' => 'lock_status', 'caisse_id' => $caisseId, 'locked_by' => $from->resourceId]);
                }
            } elseif ($data['type'] === 'cloture_unlock') {
                // Vérifie si l'utilisateur qui déverrouille est bien celui qui a verrouillé
                if ($this->lockedCaisse['locked_by'] === $from->resourceId) {
                    $this->lockedCaisse = ['caisse_id' => null, 'locked_by' => null];
                    // Diffuse le statut de déverrouillage
                    $this->broadcast(['type' => 'lock_status', 'caisse_id' => null, 'locked_by' => null]);
                } else {
                    // Si l'utilisateur n'est pas l'initiateur, on refuse le déverrouillage
                    $from->send(json_encode(['type' => 'unlock_refused', 'message' => "Vous ne pouvez pas déverrouiller une caisse initiée par un autre utilisateur."]));
                }
            } elseif ($data['type'] === 'force_unlock') {
                // NOUVEAU: Gère le déverrouillage forcé
                $caisseId = $data['caisse_id'];
                if ($this->lockedCaisse['caisse_id'] === $caisseId) {
                    // Envoie une notification à l'utilisateur qui a verrouillé la caisse
                    foreach ($this->clients as $client) {
                        if ($client->resourceId === $this->lockedCaisse['locked_by']) {
                            $client->send(json_encode(['type' => 'force_unlocked', 'message' => "Votre session a été déverrouillée par un autre utilisateur."]));
                        }
                    }
                    $this->lockedCaisse = ['caisse_id' => null, 'locked_by' => null];
                    $this->broadcast(['type' => 'lock_status', 'caisse_id' => null, 'locked_by' => null]);
                }
            }
        }
        
        // Gère les messages de saisie normale
        if (isset($data['id']) && isset($data['value'])) {
            $caisseId = explode('_', $data['id'])[1] ?? null;
            // Ne met à jour et ne diffuse que si la caisse n'est pas verrouillée par un autre
            if ($this->lockedCaisse['caisse_id'] === null || $this->lockedCaisse['locked_by'] === $from->resourceId || $caisseId != $this->lockedCaisse['caisse_id']) {
                $this->formState[$data['id']] = $data['value'];
                $this->broadcast($data, $from);
            }
        }
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);
        echo "Connexion {$conn->resourceId} terminée\n";
        
        // Si l'utilisateur qui a verrouillé la caisse se déconnecte, on déverrouille
        if ($this->lockedCaisse['locked_by'] === $conn->resourceId) {
            $this->lockedCaisse = ['caisse_id' => null, 'locked_by' => null];
            $this->broadcast(['type' => 'lock_status', 'caisse_id' => null, 'locked_by' => null]);
        }
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Une erreur est survenue: {$e->getMessage()}\n";
        $conn->close();
    }
    
    // Fonction utilitaire pour diffuser un message
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
