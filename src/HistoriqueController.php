<?php
// src/HistoriqueController.php - Version mise à jour pour le schéma normalisé.

require_once 'services/VersionService.php';
require_once 'Utils.php';
require_once 'services/FilterService.php';

class HistoriqueController {
    private $pdo;
    private $noms_caisses;
    private $denominations;
    private $tpe_par_caisse;
    private $versionService;
    private $filterService;

    public function __construct($pdo, $noms_caisses, $denominations, $tpe_par_caisse) {
        $this->pdo = $pdo;
        $this->noms_caisses = $noms_caisses;
        $this->denominations = $denominations;
        $this->tpe_par_caisse = $tpe_par_caisse;
        $this->versionService = new VersionService();
        $this->filterService = new FilterService();
    }

    public function historique() {
        $historique = [];
        $pages_totales = 0;
        $page_courante = 1;
        $message = $_SESSION['message'] ?? null;
        unset($_SESSION['message']);
        
        // Les variables pour la vue sont définies dans getHistoriqueDataJson()
        // La vue se chargera d'appeler le JS qui fera la requête AJAX.
        
        $noms_caisses = $this->noms_caisses;
        $denominations = $this->denominations;
        $nombre_caisses = count($this->noms_caisses);
        $page_css = 'historique.css';
        
        require __DIR__ . '/../templates/historique.php';
    }

    public function getHistoriqueDataJson() {
        header('Content-Type: application/json');
        
        $page_courante = isset($_GET['p']) ? (int)$_GET['p'] : 1;
        $comptages_par_page = 10;
        $offset = ($page_courante - 1) * $comptages_par_page;
        
        $date_debut = $_GET['date_debut'] ?? '';
        $date_fin = $_GET['date_fin'] ?? '';
        $recherche = $_GET['recherche'] ?? '';
        
        // Nouvelle requête pour compter le total des comptages
        $filter_params = $this->filterService->getWhereClauseAndBindings($date_debut, $date_fin, $recherche, null, 'tout');
        $sql_where = $filter_params['sql_where'];
        $bind_values = $filter_params['bind_values'];

        $stmt_count = $this->pdo->prepare("SELECT COUNT(id) FROM comptages" . $sql_where);
        $stmt_count->execute($bind_values);
        $total_comptages = $stmt_count->fetchColumn();
        $pages_totales = ceil($total_comptages / $comptages_par_page);
        
        // Requête pour les ID des comptages paginés
        $sql_paged_ids = "SELECT id FROM comptages" . $sql_where . " ORDER BY date_comptage DESC LIMIT {$comptages_par_page} OFFSET {$offset}";
        $stmt_paged_ids = $this->pdo->prepare($sql_paged_ids);
        $stmt_paged_ids->execute($bind_values);
        $comptage_ids = $stmt_paged_ids->fetchAll(PDO::FETCH_COLUMN);

        $historique = [];
        if (!empty($comptage_ids)) {
            $historique = $this->fetchComptagesDetails($comptage_ids);
        }

        // Requête pour TOUTES les données filtrées (pour le graphique global)
        $sql_all_ids = "SELECT id FROM comptages" . $sql_where . " ORDER BY date_comptage ASC";
        $stmt_all_ids = $this->pdo->prepare($sql_all_ids);
        $stmt_all_ids->execute($bind_values);
        $all_comptage_ids = $stmt_all_ids->fetchAll(PDO::FETCH_COLUMN);
        
        $historique_complet = [];
        if (!empty($all_comptage_ids)) {
            $historique_complet = $this->fetchComptagesDetails($all_comptage_ids);
        }

        $response_data = [
            'historique' => $historique,
            'historique_complet' => $historique_complet,
            'page_courante' => $page_courante,
            'pages_totales' => $pages_totales,
            'nombre_caisses' => count($this->noms_caisses),
            'noms_caisses' => $this->noms_caisses,
            'denominations' => $this->denominations,
        ];
        
        echo json_encode($response_data);
        exit;
    }

    // Nouvelle fonction pour charger les données complètes de plusieurs comptages
    private function fetchComptagesDetails(array $comptage_ids) {
        $historique = [];
        $placeholders = implode(',', array_fill(0, count($comptage_ids), '?'));

        $stmt = $this->pdo->prepare("
            SELECT 
                c.id, c.nom_comptage, c.date_comptage, c.explication,
                cd.caisse_id, cd.fond_de_caisse, cd.ventes, cd.retrocession,
                cd.id as comptage_detail_id,
                GROUP_CONCAT(CONCAT(d.denomination_nom, ':', d.quantite) SEPARATOR ';') as denominations
            FROM comptages c
            JOIN comptage_details cd ON c.id = cd.comptage_id
            LEFT JOIN comptage_denominations d ON cd.id = d.comptage_detail_id
            WHERE c.id IN ({$placeholders})
            GROUP BY c.id, cd.caisse_id
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
            
            $denominations_array = [];
            if ($row['denominations']) {
                $parts = explode(';', $row['denominations']);
                foreach ($parts as $part) {
                    list($name, $quantity) = explode(':', $part);
                    $denominations_array[$name] = $quantity;
                }
            }
            
            $historique[$comptage_id]['caisses_data'][$row['caisse_id']] = [
                'fond_de_caisse' => $row['fond_de_caisse'],
                'ventes' => $row['ventes'],
                'retrocession' => $row['retrocession'],
                'denominations' => $denominations_array
            ];
        }

        return array_values($historique);
    }

    public function delete() {
        header('Content-Type: application/json');
        $id_a_supprimer = intval($_POST['id_a_supprimer'] ?? 0);
        if ($id_a_supprimer > 0) {
            // La suppression en cascade gère la suppression des détails et dénominations
            $stmt = $this->pdo->prepare("DELETE FROM comptages WHERE id = ?");
            if ($stmt->execute([$id_a_supprimer])) {
                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Erreur lors de la suppression.']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'ID invalide.']);
        }
        exit;
    }

    // NOUVEAU: Méthode pour exporter au format CSV
    public function exportCsv() {
        $date_debut = $_GET['date_debut'] ?? '';
        $date_fin = $_GET['date_fin'] ?? '';
        $recherche = $_GET['recherche'] ?? '';
        
        $filter_params = $this->filterService->getWhereClauseAndBindings($date_debut, $date_fin, $recherche);
        $sql_where = $filter_params['sql_where'];
        $bind_values = $filter_params['bind_values'];

        $sql_ids = "SELECT id FROM comptages" . $sql_where . " ORDER BY date_comptage DESC";
        $stmt_ids = $this->pdo->prepare($sql_ids);
        $stmt_ids->execute($bind_values);
        $comptage_ids = $stmt_ids->fetchAll(PDO::FETCH_COLUMN);

        $historique = $this->fetchComptagesDetails($comptage_ids);

        $filename = "export-comptages-" . date('Y-m-d') . ".csv";
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $output = fopen('php://output', 'w');
        
        // En-têtes CSV
        $header = ['ID', 'Nom', 'Date', 'Explication'];
        foreach ($this->noms_caisses as $id => $nom) {
            $header[] = "Caisse {$id} - Nom";
            $header[] = "Caisse {$id} - Fond de caisse";
            $header[] = "Caisse {$id} - Ventes";
            $header[] = "Caisse {$id} - Rétrocession";
            foreach ($this->denominations as $type => $denoms) {
                foreach ($denoms as $key => $value) {
                    $label = ($value >= 1) ? "{$value} €" : "{$value} cts";
                    $header[] = "Caisse {$id} - {$label}";
                }
            }
        }
        fputcsv($output, $header, ';');

        // Données
        foreach ($historique as $comptage) {
            $rowData = [$comptage['id'], $comptage['nom_comptage'], $comptage['date_comptage'], $comptage['explication']];
            foreach ($this->noms_caisses as $caisse_id => $nom_caisse) {
                $caisse_data = $comptage['caisses_data'][$caisse_id];
                $rowData[] = $nom_caisse;
                $rowData[] = str_replace('.', ',', $caisse_data['fond_de_caisse']);
                $rowData[] = str_replace('.', ',', $caisse_data['ventes']);
                $rowData[] = str_replace('.', ',', $caisse_data['retrocession']);
                foreach ($this->denominations as $type => $denoms) {
                    foreach (array_keys($denoms) as $key) {
                        $rowData[] = $caisse_data['denominations'][$key] ?? 0;
                    }
                }
            }
            fputcsv($output, $rowData, ';');
        }
        fclose($output);
        exit;
    }
}
