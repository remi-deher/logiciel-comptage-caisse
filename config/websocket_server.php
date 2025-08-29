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

            // Gère les messages de saisie (le temps réel principal)
            if (isset($data['id']) && isset($data['value'])) {
                $caisseId = null;
                // Extrait l'ID de la caisse à partir de l'ID de l'élément du formulaire
                $parts = explode('_', $data['id']);
                if (count($parts) > 1) {
                    $lastPart = end($parts);
                    if (is_numeric($lastPart)) {
                        $caisseId = $lastPart;
                    }
                }
                
                // Vérifie si la caisse est verrouillée par un autre utilisateur ou déjà clôturée
                $isLockedByAnother = false;
                if ($caisseId !== null) {
                    $lockedState = $this->clotureStateService->getLockedCaisses();
                    foreach ($lockedState as $lockedCaisse) {
                        if ($lockedCaisse['caisse_id'] == $caisseId && $lockedCaisse['locked_by'] != (string)$from->resourceId) {
                            $isLockedByAnother = true;
                            break;
                        }
                    }
                }
                $isConfirmed = $caisseId !== null && $this->clotureStateService->isCaisseConfirmed(intval($caisseId));

                // Si la caisse n'est pas bloquée, on diffuse le message
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
                case 'request_state':
                    $this->broadcast(['type' => 'send_full_state'], $from);
                    break;

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
                    $this->clotureStateService->unlockCaisse($caisseId);
                    $this->broadcastClotureState();
                    break;
                case 'force_unlock':
                    $caisseId = intval($data['caisse_id']);
                    $this->clotureStateService->forceUnlockCaisse($caisseId);
                    $this->broadcastClotureState();
                    break;
                case 'cloture_caisse_confirmed':
                    $caisseId = intval($data['caisse_id']);
                    // La confirmation est déjà gérée par le contrôleur, on met juste à jour l'état
                    $this->broadcastClotureState();
                    break;
                case 'cloture_reopen':
                    $caisseId = intval($data['caisse_id']);
                    $this->clotureStateService->reopenCaisse($caisseId);
                    $this->broadcastClotureState();
                    break;
                case 'cloture_generale':
                    // Le contrôleur a déjà fait le travail, on notifie juste les clients
                    $this->broadcast(['type' => 'all_caisses_closed_and_reset']);
                    break;
                
                // AJOUT : Gestion des messages pour la Réserve
                case 'nouvelle_demande_reserve':
                    $this->broadcast(['type' => 'nouvelle_demande_reserve']);
                    break;
                case 'demande_reserve_traitee':
                    $this->broadcast(['type' => 'demande_reserve_traitee']);
                    break;
            }
        } catch (\Exception $e) {
            error_log("Erreur dans onMessage: {$e->getMessage()}");
        }
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);
        echo "Connexion {$conn->resourceId} terminée\n";
        
        try {
            $this->reconnect();
            // Si le client qui se déconnecte avait verrouillé une caisse, on la libère
            $this->clotureStateService->forceUnlockByConnectionId((string)$conn->resourceId);
            $this->broadcastClotureState();
        } catch (\Exception $e) {
            error_log("Erreur lors de la gestion de la déconnexion : {$e->getMessage()}");
        }
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Une erreur est survenue: {$e->getMessage()}\n";
        $conn->close();
    }
    
    // Diffuse l'état complet des caisses
    private function broadcastClotureState() {
        $lockedCaisses = $this->clotureStateService->getLockedCaisses();
        $closedCaisses = $this->clotureStateService->getClosedCaisses();
        $message = ['type' => 'cloture_locked_caisses', 'caisses' => $lockedCaisses, 'closed_caisses' => $closedCaisses];
        $this->broadcast($message);
    }

    // Fonction utilitaire pour diffuser un message à tous les clients (sauf l'expéditeur)
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
