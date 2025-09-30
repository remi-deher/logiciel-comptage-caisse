<?php
// Fichier : src/services/ClotureStateService.php (Version finale corrigée)

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

    /**
     * Confirme qu'une caisse est clôturée en insérant/mettant à jour ses données.
     * @param int $caisseId
     * @param string $dataJson
     * @return void
     */
    public function confirmCaisse($caisseId, $dataJson) {
        $stmt = $this->pdo->prepare(
            "INSERT INTO cloture_caisse_data (caisse_id, date_cloture, data_json) 
             VALUES (?, NOW(), ?)
             ON DUPLICATE KEY UPDATE date_cloture = NOW(), data_json = ?"
        );
        $stmt->execute([$caisseId, $dataJson, $dataJson]);
    }

    /**
     * Annule la clôture d'une caisse en supprimant son enregistrement.
     * @param int $caisseId
     * @return void
     */
    public function reopenCaisse($caisseId) {
        $stmt = $this->pdo->prepare("DELETE FROM cloture_caisse_data WHERE caisse_id = ?");
        $stmt->execute([$caisseId]);
    }

    /**
     * Récupère la liste des ID des caisses qui sont actuellement clôturées.
     * @return array
     */
    public function getClosedCaisses() {
        $stmt = $this->pdo->query("SELECT caisse_id FROM cloture_caisse_data");
        return $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
    }
    
    /**
     * Récupère les données JSON d'une caisse clôturée spécifique.
     * @param int $caisseId
     * @return array|null
     */
    public function getClosedCaisseData($caisseId) {
        $stmt = $this->pdo->prepare("SELECT data_json FROM cloture_caisse_data WHERE caisse_id = ?");
        $stmt->execute([$caisseId]);
        $json_data = $stmt->fetchColumn();
        return $json_data ? json_decode($json_data, true) : null;
    }

    /**
     * Vide la table des données de clôture après une clôture générale.
     * @return void
     */
    public function resetState() {
        // --- CORRECTION ---
        // On remplace TRUNCATE par DELETE pour rester dans la transaction active.
        $this->pdo->exec("DELETE FROM cloture_caisse_data");
    }
}
