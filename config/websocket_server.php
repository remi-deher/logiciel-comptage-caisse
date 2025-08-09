<?php

// Port utilisé pour le Websocket
$port = '8080';

// websocket_server.php
use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;

require dirname(__FILE__) . '/vendor/autoload.php';

class Caisse implements MessageComponentInterface {
    protected $clients;
    // NOUVELLE PROPRIÉTÉ : Un tableau pour mémoriser l'état du formulaire.
    private $formState = [];

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        echo "Serveur de caisse démarré.\n";
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        echo "Nouvelle connexion! ({$conn->resourceId})\n";

        // NOUVELLE LOGIQUE : Dès qu'un client se connecte, on lui envoie
        // l'état actuel complet du formulaire.
        if (!empty($this->formState)) {
            $conn->send(json_encode($this->formState));
        }
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        // NOUVELLE LOGIQUE : On met à jour l'état sur le serveur.
        $data = json_decode($msg, true);
        if (isset($data['id']) && isset($data['value'])) {
            $this->formState[$data['id']] = $data['value'];
        }

        // On continue de diffuser le message à tous les autres clients.
        foreach ($this->clients as $client) {
            if ($from !== $client) {
                $client->send($msg);
            }
        }
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);
        echo "Connexion {$conn->resourceId} terminée\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Une erreur est survenue: {$e->getMessage()}\n";
        $conn->close();
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
