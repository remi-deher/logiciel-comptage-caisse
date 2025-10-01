<?php
// Fichier : src/services/ClotureStateService.php (Corrigé pour la compatibilité des tests)

class ClotureStateService {
    private $pdo;

    public function __construct(PDO $pdo) {
        $this->pdo = $pdo;
    }

    public function setPDO(PDO $pdo) {
        $this->pdo = $pdo;
    }

    public function confirmCaisse($caisseId, $dataJson) {
        // --- DÉBUT DE LA CORRECTION ---
        // On détecte le type de base de données utilisé (mysql en production, sqlite pour les tests)
        $driver = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

        if ($driver === 'sqlite') {
            // Syntaxe pour SQLite : Remplacer la ligne existante si la caisse_id est déjà présente.
            $sql = "INSERT OR REPLACE INTO cloture_caisse_data (caisse_id, date_cloture, data_json) 
                    VALUES (?, datetime('now'), ?)";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$caisseId, $dataJson]);
        } else {
            // Syntaxe pour MySQL (celle que nous avions déjà)
            $sql = "INSERT INTO cloture_caisse_data (caisse_id, date_cloture, data_json) 
                    VALUES (?, NOW(), ?)
                    ON DUPLICATE KEY UPDATE date_cloture = NOW(), data_json = ?";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$caisseId, $dataJson, $dataJson]);
        }
        // --- FIN DE LA CORRECTION ---
    }

    public function reopenCaisse($caisseId) {
        $stmt = $this->pdo->prepare("DELETE FROM cloture_caisse_data WHERE caisse_id = ?");
        $stmt->execute([$caisseId]);
    }

    public function getClosedCaisses() {
        $stmt = $this->pdo->query("SELECT caisse_id FROM cloture_caisse_data");
        return $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
    }
    
    public function getClosedCaisseData($caisseId) {
        $stmt = $this->pdo->prepare("SELECT data_json FROM cloture_caisse_data WHERE caisse_id = ?");
        $stmt->execute([$caisseId]);
        $json_data = $stmt->fetchColumn();
        return $json_data ? json_decode($json_data, true) : null;
    }

    public function resetState() {
        // La commande DELETE est compatible avec MySQL et SQLite.
        $this->pdo->exec("DELETE FROM cloture_caisse_data");
    }
}
