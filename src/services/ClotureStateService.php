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

    public function lockCaisse($caisseId, $lockedBy) {
        // Première tentative : Mettre à jour la caisse si elle existe et est ouverte.
        // Cette opération est atomique et empêche les conditions de concurrence.
        $stmt_update = $this->pdo->prepare(
            "UPDATE cloture_status SET status='locked', locked_by_ws_id=?
             WHERE caisse_id = ? AND status = 'open'"
        );
        $stmt_update->execute([$lockedBy, $caisseId]);

        // Si la mise à jour a fonctionné (1 ligne affectée), le verrou est posé.
        if ($stmt_update->rowCount() > 0) {
            return true;
        }

        // Si la mise à jour a échoué, soit la caisse n'existe pas dans la table,
        // soit elle n'était pas ouverte. On tente de l'insérer.
        try {
            $stmt_insert = $this->pdo->prepare(
                "INSERT INTO cloture_status (caisse_id, status, locked_by_ws_id)
                 VALUES (?, 'locked', ?)"
            );
            // L'insertion réussira uniquement si la caisse n'existe pas déjà.
            return $stmt_insert->execute([$caisseId, $lockedBy]);
        } catch (PDOException $e) {
            // Si l'insertion échoue (typiquement à cause d'une clé dupliquée
            // si un autre processus l'a insérée entre-temps), la prise de verrou échoue.
            return false;
        }
    }

    public function unlockCaisse($caisseId) {
        $stmt = $this->pdo->prepare("UPDATE cloture_status SET status='open', locked_by_ws_id=NULL WHERE caisse_id = ? AND status = 'locked'");
        $stmt->execute([$caisseId]);
    }

    /**
     * NOUVEAU / VÉRIFIÉ : Force le déverrouillage d'une caisse, quel que soit l'utilisateur qui l'a verrouillée.
     * C'est la méthode utilisée pour la nouvelle fonctionnalité.
     * @param int $caisseId L'identifiant de la caisse.
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

    public function getLockedCaisses() {
        $stmt = $this->pdo->query("SELECT caisse_id, locked_by_ws_id as locked_by FROM cloture_status WHERE status = 'locked'");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function getClosedCaisses() {
        $stmt = $this->pdo->query("SELECT caisse_id FROM cloture_status WHERE status = 'closed'");
        return $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
    }
    
    /**
     * Réinitialise l'état de la clôture.
     * CORRECTION : Utilise DELETE au lieu de TRUNCATE pour ne pas causer de commit implicite.
     */
    public function resetState() {
        $this->pdo->exec("DELETE FROM cloture_status");
    }

    public function forceUnlockByConnectionId($connectionId) {
        $stmt = $this->pdo->prepare("UPDATE cloture_status SET status='open', locked_by_ws_id=NULL WHERE locked_by_ws_id = ? AND status = 'locked'");
        $stmt->execute([$connectionId]);
    }
}
