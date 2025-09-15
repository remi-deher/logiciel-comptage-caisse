<?php
// src/Repository/ComptageRepository.php

class ComptageRepository {
    private $pdo;

    public function __construct(PDO $pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Charge les données détaillées d'un comptage spécifique.
     * Utilisé par le CalculateurController pour charger un état précédent.
     *
     * @param int $comptage_id
     * @return array
     */
    public function findDetailsById($comptage_id) {
        $data = [];
        $stmt = $this->pdo->prepare("SELECT * FROM comptage_details WHERE comptage_id = ?");
        $stmt->execute([$comptage_id]);
        $details_data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($details_data as $row) {
            $caisse_id = $row['caisse_id'];
            $comptage_detail_id = $row['id'];
            
            $data[$caisse_id] = [
                'fond_de_caisse' => $row['fond_de_caisse'] ?? '0',
                'ventes_especes' => $row['ventes_especes'] ?? '0',
                'ventes_cb'      => $row['ventes_cb'] ?? '0',
                'ventes_cheques' => $row['ventes_cheques'] ?? '0',
                'retrocession'   => $row['retrocession'] ?? '0',
                'denominations'  => [],
                'tpe'            => [],
                'cheques'        => []
            ];

            $stmt_denoms = $this->pdo->prepare("SELECT denomination_nom, quantite FROM comptage_denominations WHERE comptage_detail_id = ?");
            $stmt_denoms->execute([$comptage_detail_id]);
            $data[$caisse_id]['denominations'] = $stmt_denoms->fetchAll(PDO::FETCH_KEY_PAIR);

            $stmt_cb = $this->pdo->prepare("SELECT terminal_id, montant, heure_releve FROM comptage_cb WHERE comptage_detail_id = ? ORDER BY heure_releve ASC");
            $stmt_cb->execute([$comptage_detail_id]);
            $data[$caisse_id]['tpe'] = $stmt_cb->fetchAll(PDO::FETCH_ASSOC | PDO::FETCH_GROUP) ?: [];
            
            $stmt_cheques = $this->pdo->prepare("SELECT montant, commentaire FROM comptage_cheques WHERE comptage_detail_id = ?");
            $stmt_cheques->execute([$comptage_detail_id]);
            $data[$caisse_id]['cheques'] = $stmt_cheques->fetchAll(PDO::FETCH_ASSOC);
        }
        return $data;
    }

    /**
     * Récupère une liste de comptages avec tous leurs détails.
     * Utilisé par l'HistoriqueController.
     *
     * @param array $comptage_ids
     * @return array
     */
    public function findMultipleDetailsByIds(array $comptage_ids) {
        if (empty($comptage_ids)) return [];

        $historique = [];
        $placeholders = implode(',', array_fill(0, count($comptage_ids), '?'));

        $stmt = $this->pdo->prepare("
            SELECT 
                c.id, c.nom_comptage, c.date_comptage, c.explication,
                cd.caisse_id, cd.fond_de_caisse, 
                cd.ventes_especes, cd.ventes_cb, cd.ventes_cheques, 
                cd.retrocession,
                cd.id as comptage_detail_id
            FROM comptages c
            LEFT JOIN comptage_details cd ON c.id = cd.comptage_id
            WHERE c.id IN ({$placeholders})
            ORDER BY c.date_comptage DESC, cd.caisse_id ASC
        ");
        
        $stmt->execute($comptage_ids);
        $raw_data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($raw_data as $row) {
            $comptage_id = $row['id'];
            if (!isset($historique[$comptage_id])) {
                $historique[$comptage_id] = [
                    'id' => $comptage_id,
                    'nom_comptage' => $row['nom_comptage'],
                    'date_comptage' => $row['date_comptage'],
                    'explication' => $row['explication'],
                    'caisses_data' => []
                ];
            }
            
            $details = $this->findDetailsByComptageDetailId($row['comptage_detail_id']);
            $historique[$comptage_id]['caisses_data'][$row['caisse_id']] = array_merge($row, $details);
        }

        foreach ($historique as &$comptage) {
            $comptage['results'] = calculate_results_from_data($comptage['caisses_data']);
        }

        return array_values($historique);
    }
    
    /**
     * Récupère les détails (dénominations, cb, chèques, etc.) pour un comptage_detail_id donné.
     * Méthode d'aide pour les autres fonctions de ce repository.
     *
     * @param int $comptage_detail_id
     * @return array
     */
    private function findDetailsByComptageDetailId($comptage_detail_id) {
        $stmt_denoms = $this->pdo->prepare("SELECT denomination_nom, quantite FROM comptage_denominations WHERE comptage_detail_id = ?");
        $stmt_denoms->execute([$comptage_detail_id]);
        $denominations_array = $stmt_denoms->fetchAll(PDO::FETCH_ASSOC);

        $stmt_retraits = $this->pdo->prepare("SELECT denomination_nom, quantite_retiree FROM comptage_retraits WHERE comptage_detail_id = ?");
        $stmt_retraits->execute([$comptage_detail_id]);
        $retraits_array = $stmt_retraits->fetchAll(PDO::FETCH_KEY_PAIR);
        
        $stmt_cheques = $this->pdo->prepare("SELECT montant, commentaire FROM comptage_cheques WHERE comptage_detail_id = ?");
        $stmt_cheques->execute([$comptage_detail_id]);
        $cheques_array = $stmt_cheques->fetchAll(PDO::FETCH_ASSOC);

        $stmt_cb = $this->pdo->prepare("SELECT terminal_id, montant, heure_releve FROM comptage_cb WHERE comptage_detail_id = ? ORDER BY heure_releve ASC");
        $stmt_cb->execute([$comptage_detail_id]);
        $cb_releves_array = $stmt_cb->fetchAll(PDO::FETCH_ASSOC | PDO::FETCH_GROUP);

        return [
            'denominations' => $denominations_array,
            'retraits' => $retraits_array,
            'cb' => $cb_releves_array,
            'cheques' => $cheques_array
        ];
    }
}
