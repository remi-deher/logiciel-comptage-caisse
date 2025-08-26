<?php
// src/services/ClotureStateService.php - Nouvelle version utilisant la BDD

/**
 * Gère l'état de clôture des caisses en utilisant une table dans la base de données
 * pour éviter les problèmes de concurrence liés à la modification d'un fichier JSON.
 */
class ClotureStateService {
    private $pdo;

    public function __construct(PDO $pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Récupère le statut actuel d'une caisse.
     * @param int $caisseId L'identifiant de la caisse.
     * @return array Le statut de la caisse ('open', 'locked', 'closed') et l'ID de l'utilisateur qui l'a verrouillée.
     */
    private function getCaisseStatus($caisseId) {
        $stmt = $this->pdo->prepare("SELECT status, locked_by_ws_id FROM cloture_status WHERE caisse_id = ?");
        $stmt->execute([$caisseId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ?: ['status' => 'open', 'locked_by_ws_id' => null];
    }

    /**
     * Verrouille une caisse pour un utilisateur donné si elle est libre.
     * @param int $caisseId L'identifiant de la caisse.
     * @param string $lockedBy L'identifiant de la connexion WebSocket.
     * @return bool Vrai si le verrouillage a réussi, faux sinon.
     */
    public function lockCaisse($caisseId, $lockedBy) {
        $status = $this->getCaisseStatus($caisseId);
        if ($status['status'] !== 'open') {
            return false; // La caisse est déjà verrouillée ou fermée
        }

        // Utilise ON DUPLICATE KEY UPDATE pour gérer les cas où l'entrée existe déjà
        $stmt = $this->pdo->prepare("INSERT INTO cloture_status (caisse_id, status, locked_by_ws_id) VALUES (?, 'locked', ?) ON DUPLICATE KEY UPDATE status='locked', locked_by_ws_id=?");
        $stmt->execute([$caisseId, $lockedBy, $lockedBy]);
        return true;
    }

    /**
     * Déverrouille une caisse.
     * @param int $caisseId L'identifiant de la caisse.
     */
    public function unlockCaisse($caisseId) {
        $stmt = $this->pdo->prepare("UPDATE cloture_status SET status='open', locked_by_ws_id=NULL WHERE caisse_id = ? AND status = 'locked'");
        $stmt->execute([$caisseId]);
    }
    
    /**
     * Force le déverrouillage d'une caisse, quel que soit l'utilisateur qui l'a verrouillée.
     * Cette méthode est utilisée pour gérer les déconnexions inattendues.
     * @param int $caisseId L'identifiant de la caisse.
     */
    public function forceUnlockCaisse($caisseId) {
        $stmt = $this->pdo->prepare("UPDATE cloture_status SET status='open', locked_by_ws_id=NULL WHERE caisse_id = ?");
        $stmt->execute([$caisseId]);
    }

    /**
     * Marque une caisse comme clôturée.
     * @param int $caisseId L'identifiant de la caisse.
     */
    public function confirmCaisse($caisseId) {
        // CORRECTION : On met à jour le statut ET on retire l'ID de verrouillage.
        // Une caisse clôturée n'est plus verrouillée par personne.
        $stmt = $this->pdo->prepare("UPDATE cloture_status SET status='closed', locked_by_ws_id=NULL WHERE caisse_id = ? AND status='locked'");
        $stmt->execute([$caisseId]);
    }

    /**
     * Ré-ouvre une caisse qui a été précédemment clôturée.
     * @param int $caisseId L'identifiant de la caisse.
     */
    public function reopenCaisse($caisseId) {
        $stmt = $this->pdo->prepare("UPDATE cloture_status SET status='open', locked_by_ws_id=NULL WHERE caisse_id = ? AND status = 'closed'");
        $stmt->execute([$caisseId]);
    }

    /**
     * Vérifie si une caisse a déjà été clôturée.
     * @param int $caisseId L'identifiant de la caisse.
     * @return bool Vrai si la caisse est clôturée, faux sinon.
     */
    public function isCaisseConfirmed($caisseId) {
        $status = $this->getCaisseStatus($caisseId);
        return $status['status'] === 'closed';
    }

    /**
     * Récupère la liste des caisses actuellement verrouillées.
     * @return array Un tableau d'objets contenant l'ID de la caisse et l'ID du verrouilleur.
     */
    public function getLockedCaisses() {
        $stmt = $this->pdo->query("SELECT caisse_id, locked_by_ws_id as locked_by FROM cloture_status WHERE status = 'locked'");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Récupère la liste des caisses actuellement clôturées.
     * @return array Un tableau d'identifiants de caisse clôturées.
     */
    public function getClosedCaisses() {
        $stmt = $this->pdo->query("SELECT caisse_id FROM cloture_status WHERE status = 'closed'");
        return $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
    }
    
    /**
     * Réinitialise l'état de toutes les caisses (vide la table).
     */
    public function resetState() {
        $this->pdo->exec("TRUNCATE TABLE cloture_status");
    }

    /**
     * Force le déverrouillage de toutes les caisses verrouillées par un ID de connexion spécifique.
     * Cette méthode est cruciale pour nettoyer les verrous lors de la déconnexion d'un client.
     * @param string $connectionId L'identifiant de la connexion WebSocket.
     */
    public function forceUnlockByConnectionId($connectionId) {
        $stmt = $this->pdo->prepare("UPDATE cloture_status SET status='open', locked_by_ws_id=NULL WHERE locked_by_ws_id = ? AND status = 'locked'");
        $stmt->execute([$connectionId]);
    }
}
