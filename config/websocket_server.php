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
    private $pdo;

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

    // NOUVELLE MÉTHODE : Vérifie et rétablit la connexion à la base de données si elle est perdue.
    private function reconnect() {
        try {
            // Tente de faire une requête simple pour vérifier l'état de la connexion
            $this->pdo->query('SELECT 1');
        } catch (PDOException $e) {
            // Si la connexion a échoué (par exemple, "server has gone away"), on se reconnecte.
            if (strpos($e->getMessage(), 'server has gone away') !== false) {
                echo "Connexion BDD perdue. Tentative de reconnexion...\n";
                try {
                    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
                    $this->pdo = new PDO($dsn, DB_USER, DB_PASS);
                    $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                    $this->clotureStateService = new ClotureStateService($this->pdo); // Met à jour le service avec la nouvelle connexion
                    echo "Reconnexion BDD réussie.\n";
                } catch (PDOException $reconnect_e) {
                    echo "Échec de la reconnexion BDD : " . $reconnect_e->getMessage() . "\n";
                    // En cas d'échec, on peut choisir d'arrêter le serveur ou de laisser l'erreur se propager.
                    throw $reconnect_e;
                }
            } else {
                // Si c'est une autre erreur, on la propage.
                throw $e;
            }
        }
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
            // NOUVEAU: Vérifie la connexion BDD avant toute opération.
            $this->reconnect();

            $data = json_decode($msg, true);
            if (!is_array($data)) {
                return;
            }

            // Gère les messages de saisie
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

            // Gère les messages de contrôle qui ont un 'type'.
            if (!isset($data['type'])) {
                 return;
            }

            switch ($data['type']) {
                // NOUVEAU: Un client demande l'état du formulaire
                case 'request_state':
                    // On diffuse à tous les autres clients la demande de leur état
                    $this->broadcast(['type' => 'send_full_state'], $from);
                    break;

                // NOUVEAU: Un client envoie l'état complet de son formulaire
                case 'broadcast_state':
                    $this->broadcast(['type' => 'broadcast_state', 'form_state' => $data['form_state']], $from);
                    break;

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
                    break;
                // NOUVEAU: Gère la réouverture d'une caisse
                case 'cloture_reopen':
                    $caisseId = intval($data['caisse_id']);
                    $this->clotureStateService->reopenCaisse($caisseId);
                    $this->broadcastClotureState();
                    break;
                // MISE À JOUR : Gère la clôture générale
                case 'cloture_generale':
                    // On notifie tous les clients de la réinitialisation
                    $this->broadcast(['type' => 'all_caisses_closed_and_reset']);
                    // Le reset de la BDD est déjà géré par le contrôleur PHP
                    break;
            }
        } catch (\Exception $e) {
            error_log("Erreur dans onMessage: {$e->getMessage()}");
        }
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);
        echo "Connexion {$conn->resourceId} terminée\n";
        
        // NOUVEAU: Tente de se reconnecter avant de vérifier l'état
        try {
            $this->reconnect();
            $lockedState = $this->clotureStateService->getLockedCaisses();
            foreach($lockedState as $lockedCaisse) {
                if ($lockedCaisse['locked_by'] === (string)$conn->resourceId) {
                    $this->clotureStateService->unlockCaisse(intval($lockedCaisse['caisse_id']));
                    $this->broadcastClotureState();
                    break;
                }
            }
        } catch (\Exception $e) {
            error_log("Erreur lors de la gestion de la déconnexion : {$e->getMessage()}");
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
