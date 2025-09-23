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
     */
    public function lockCaisse($caisseId, $lockedBy) {
        $stmt_update = $this->pdo->prepare(
            "UPDATE cloture_status SET status='locked', locked_by_ws_id=?
             WHERE caisse_id = ? AND status = 'open'"
        );
        $stmt_update->execute([$lockedBy, $caisseId]);

        if ($stmt_update->rowCount() > 0) {
            return true;
        }

        try {
            $stmt_insert = $this->pdo->prepare(
                "INSERT INTO cloture_status (caisse_id, status, locked_by_ws_id)
                 VALUES (?, 'locked', ?)"
            );
            return $stmt_insert->execute([$caisseId, $lockedBy]);
        } catch (PDOException $e) {
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
