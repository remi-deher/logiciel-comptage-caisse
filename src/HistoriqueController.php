<?php
// src/HistoriqueController.php
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
        $caisse_filtre = $_GET['caisse'] ?? '';
        
        $filter_params = $this->filterService->getWhereClauseAndBindings($date_debut, $date_fin, $recherche, $caisse_filtre);
        $sql_where = $filter_params['sql_where'];
        $bind_values = $filter_params['bind_values'];

        $stmt_count = $this->pdo->prepare("SELECT COUNT(id) FROM comptages" . $sql_where);
        $stmt_count->execute($bind_values);
        $total_comptages = $stmt_count->fetchColumn();
        $pages_totales = ceil($total_comptages / $comptages_par_page);
        
        // Requête pour les données paginées
        $sql_paged_data = "SELECT * FROM comptages" . $sql_where . " ORDER BY date_comptage DESC LIMIT {$comptages_par_page} OFFSET {$offset}";
        $stmt_paged_data = $this->pdo->prepare($sql_paged_data);
        $stmt_paged_data->execute($bind_values);
        $historique = $stmt_paged_data->fetchAll();
        
        // Requête pour TOUTES les données filtrées (pour le graphique global)
        $sql_all_data = "SELECT * FROM comptages" . $sql_where . " ORDER BY date_comptage ASC";
        $stmt_all_data = $this->pdo->prepare($sql_all_data);
        $stmt_all_data->execute($bind_values);
        $historique_complet = $stmt_all_data->fetchAll();
        
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

    public function delete() {
        header('Content-Type: application/json');
        $id_a_supprimer = intval($_POST['id_a_supprimer'] ?? 0);
        if ($id_a_supprimer > 0) {
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

        $sql_data = "SELECT * FROM comptages" . $sql_where . " ORDER BY date_comptage DESC";
        $stmt_data = $this->pdo->prepare($sql_data);
        $stmt_data->execute($bind_values);
        $historique = $stmt_data->fetchAll();

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
        foreach ($historique as $row) {
            $rowData = [$row['id'], $row['nom_comptage'], $row['date_comptage'], $row['explication']];
            foreach ($this->noms_caisses as $id => $nom) {
                $rowData[] = $nom;
                $rowData[] = str_replace('.', ',', $row["c{$id}_fond_de_caisse"]);
                $rowData[] = str_replace('.', ',', $row["c{$id}_ventes"]);
                $rowData[] = str_replace('.', ',', $row["c{$id}_retrocession"]);
                foreach ($this->denominations as $type => $denoms) {
                    foreach ($denoms as $key => $value) {
                        $rowData[] = $row["c{$id}_{$key}"];
                    }
                }
            }
            fputcsv($output, $rowData, ';');
        }
        fclose($output);
        exit;
    }
}
