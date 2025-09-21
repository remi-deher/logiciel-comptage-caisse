<?php
// Fichier : src/services/ClotureStateService.php (Version Finale Complète et Corrigée)

class ClotureStateService {
    private $pdo;

    /**
     * Permet de remplacer l'objet PDO interne après une reconnexion.
     * @param PDO $pdo Le nouvel objet PDO.
     */
    public function setPDO(PDO $pdo) {
        $this->pdo = $pdo;
    }

    public function __construct(PDO $pdo) {
        $this->pdo = $pdo;
    }

    public function getCaisseStatus($caisseId) {
        $stmt = $this->pdo->prepare("SELECT status, locked_by_ws_id FROM cloture_status WHERE caisse_id = ?");
        $stmt->execute([$caisseId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ?: ['status' => 'open', 'locked_by_ws_id' => null];
    }

    /**
     * Verrouille une caisse en associant l'ID de la connexion WebSocket.
     * C'est cette fonction qui assure que seul un utilisateur peut verrouiller une caisse à la fois.
     */
    public function lockCaisse($caisseId, $lockedBy) {
        // Tente de mettre à jour si la caisse existe et est ouverte.
        // Cette opération atomique empêche les conflits.
        $stmt_update = $this->pdo->prepare(
            "UPDATE cloture_status SET status='locked', locked_by_ws_id=?
             WHERE caisse_id = ? AND status = 'open'"
        );
        $stmt_update->execute([$lockedBy, $caisseId]);

        // Si la mise à jour a fonctionné (1 ligne affectée), le verrou est posé.
        if ($stmt_update->rowCount() > 0) {
            return true;
        }

        // Sinon, on tente d'insérer la ligne (si elle n'existait pas).
        try {
            $stmt_insert = $this->pdo->prepare(
                "INSERT INTO cloture_status (caisse_id, status, locked_by_ws_id)
                 VALUES (?, 'locked', ?)"
            );
            return $stmt_insert->execute([$caisseId, $lockedBy]);
        } catch (PDOException $e) {
            // L'insertion échoue si un autre processus a déjà verrouillé, c'est la sécurité attendue.
            return false;
        }
    }

    public function unlockCaisse($caisseId) {
        $stmt = $this->pdo->prepare("UPDATE cloture_status SET status='open', locked_by_ws_id=NULL WHERE caisse_id = ? AND status = 'locked'");
        $stmt->execute([$caisseId]);
    }

    /**
     * Force le déverrouillage d'une caisse, utilisé par les autres utilisateurs.
     */
    public function forceUnlockCaisse($caisseId) {
        $stmt = $this->pdo->prepare("UPDATE cloture_status SET status='open', locked_by_ws_id=NULL WHERE caisse_id = ?");
        $stmt->execute([$caisseId]);
    }

    public function confirmCaisse($caisseId) {
        $stmt = $this->pdo->prepare("UPDATE cloture_status SET status='closed', locked_by_ws_id=NULL WHERE caisse_id = ?");
        $stmt->execute([$caisseId]);
    }

    public function reopenCaisse($caisseId) {
        $stmt = $this->pdo->prepare("UPDATE cloture_status SET status='open', locked_by_ws_id=NULL WHERE caisse_id = ? AND status = 'closed'");
        $stmt->execute([$caisseId]);
    }

    public function isCaisseConfirmed($caisseId) {
        $status = $this->getCaisseStatus($caisseId);
        return $status['status'] === 'closed';
    }

    /**
     * Récupère la liste des caisses verrouillées AVEC l'ID de la connexion qui les a verrouillées.
     * C'est cette information qui sera envoyée à tous les clients.
     */
    public function getLockedCaisses() {
        $stmt = $this->pdo->query("SELECT caisse_id, locked_by_ws_id as locked_by FROM cloture_status WHERE status = 'locked'");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function getClosedCaisses() {
        $stmt = $this->pdo->query("SELECT caisse_id FROM cloture_status WHERE status = 'closed'");
        return $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
    }
    
    public function resetState() {
        $this->pdo->exec("DELETE FROM cloture_status");
    }

    public function forceUnlockByConnectionId($connectionId) {
        $stmt = $this->pdo->prepare("UPDATE cloture_status SET status='open', locked_by_ws_id=NULL WHERE locked_by_ws_id = ? AND status = 'locked'");
        $stmt->execute([$connectionId]);
    }
}
