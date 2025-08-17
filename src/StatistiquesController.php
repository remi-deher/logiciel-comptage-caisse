<?php
// src/StatistiquesController.php
require_once 'Bdd.php';
require_once 'Utils.php';
require_once 'services/FilterService.php';

class StatistiquesController {
    private $pdo;
    private $noms_caisses;
    private $denominations;
    private $filterService;

    public function __construct($pdo, $noms_caisses, $denominations) {
        $this->pdo = $pdo;
        $this->noms_caisses = $noms_caisses;
        $this->denominations = $denominations;
        $this->filterService = new FilterService();
    }

    /**
     * Affiche la page de statistiques.
     */
    public function statistiques() {
        $page_css = 'stats.css';
        $page_js = 'stats.js';
        $noms_caisses = $this->noms_caisses;
        require __DIR__ . '/../templates/statistiques.php';
    }

    /**
     * Récupère les données des statistiques et les renvoie en JSON.
     */
    public function getStatsData() {
        header('Content-Type: application/json');
        
        $date_debut = $_GET['date_debut'] ?? null;
        $date_fin = $_GET['date_fin'] ?? null;
        
        $filter_params = $this->filterService->getWhereClauseAndBindings($date_debut, $date_fin, null, null, 'tout');
        $sql_where = $filter_params['sql_where'];
        $bind_values = $filter_params['bind_values'];
        
        $sum_cols_ventes = [];
        $sum_cols_retrocession = [];
        $repartition_labels = [];
        $repartition_data = [];
        $caisses_data = [];
        $sum_cols_all_caisse_ventes = [];
        
        foreach ($this->noms_caisses as $i => $nom_caisse) {
            $sum_cols_ventes[] = "SUM(c{$i}_ventes)";
            $sum_cols_retrocession[] = "SUM(c{$i}_retrocession)";
            $repartition_labels[] = $nom_caisse;
            $sum_cols_all_caisse_ventes[] = "c{$i}_ventes";

            $stmt = $this->pdo->prepare("SELECT SUM(c{$i}_ventes) AS total_ventes, AVG(c{$i}_ventes) AS moyenne_ventes, SUM(c{$i}_retrocession) AS total_retrocession FROM comptages" . $sql_where);
            $stmt->execute($bind_values);
            $caisse_stats = $stmt->fetch(PDO::FETCH_ASSOC);

            $caisses_data[] = [
                'id' => $i,
                'nom' => $nom_caisse,
                'total_ventes' => round(floatval($caisse_stats['total_ventes'] ?? 0), 2),
                'moyenne_ventes' => round(floatval($caisse_stats['moyenne_ventes'] ?? 0), 2),
                'total_retrocession' => round(floatval($caisse_stats['total_retrocession'] ?? 0), 2)
            ];
        }

        $sum_cols_ventes_str = implode(' + ', $sum_cols_ventes);
        $sum_cols_retrocession_str = implode(' + ', $sum_cols_retrocession);
        $sum_cols_all_caisse_ventes_str = implode(' + ', $sum_cols_all_caisse_ventes);
        
        $stmt_total_comptages = $this->pdo->prepare("SELECT COUNT(*) FROM comptages" . $sql_where);
        $stmt_total_comptages->execute($bind_values);
        $total_comptages = $stmt_total_comptages->fetchColumn();

        $stmt_total_ventes = $this->pdo->prepare("SELECT {$sum_cols_ventes_str} FROM comptages" . $sql_where);
        $stmt_total_ventes->execute($bind_values);
        $total_ventes = $stmt_total_ventes->fetchColumn() ?? 0;
        
        $ventes_moyennes = $total_comptages > 0 ? $total_ventes / $total_comptages : 0;
        
        $stmt_total_retrocession = $this->pdo->prepare("SELECT {$sum_cols_retrocession_str} FROM comptages" . $sql_where);
        $stmt_total_retrocession->execute($bind_values);
        $total_retrocession = $stmt_total_retrocession->fetchColumn() ?? 0;

        $repartition_sql = "SELECT " . implode(', ', array_map(fn($i) => "SUM(c{$i}_ventes) AS ventes_c{$i}", array_keys($this->noms_caisses))) . " FROM comptages" . $sql_where;
        $repartition_stmt = $this->pdo->prepare($repartition_sql);
        $repartition_stmt->execute($bind_values);
        $repartition_result = $repartition_stmt->fetch(PDO::FETCH_ASSOC);

        foreach ($this->noms_caisses as $i => $nom_caisse) {
            $repartition_data[] = floatval($repartition_result["ventes_c{$i}"] ?? 0);
        }
        
        // Récupération des données pour le graphique linéaire
        $evolution_sql = "SELECT DATE(date_comptage) as date, " . implode(' + ', $sum_cols_ventes) . " as total_ventes FROM comptages" . $sql_where . " GROUP BY DATE(date_comptage) ORDER BY date ASC";
        $evolution_stmt = $this->pdo->prepare($evolution_sql);
        $evolution_stmt->execute($bind_values);
        $evolution_results = $evolution_stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $evolution_dates = [];
        $evolution_ventes = [];
        foreach ($evolution_results as $row) {
            $evolution_dates[] = (new DateTime($row['date']))->format('d/m/Y');
            $evolution_ventes[] = floatval($row['total_ventes']);
        }
        
        // NOUVEAU: Données pour le graphique en entonnoir
        $funnel_data = [
            'labels' => ['Ventes', 'Rétrocessions', 'Total réel'],
            'data' => [
                $total_ventes,
                $total_retrocession,
                $total_ventes - $total_retrocession
            ]
        ];
        
        // NOUVEAU: Données pour le graphique radar
        $radar_labels = array_keys($this->noms_caisses);
        $radar_data = [];
        $radar_data_ventes = array_column($caisses_data, 'total_ventes');
        $radar_data_ventes_moyennes = array_column($caisses_data, 'moyenne_ventes');
        $radar_data_retrocession = array_column($caisses_data, 'total_retrocession');

        $radar_data[] = ['name' => 'Ventes totales', 'data' => $radar_data_ventes];
        $radar_data[] = ['name' => 'Ventes moyennes', 'data' => $radar_data_ventes_moyennes];
        $radar_data[] = ['name' => 'Rétrocessions', 'data' => $radar_data_retrocession];


        echo json_encode([
            'repartition' => [
                'labels' => $repartition_labels,
                'data' => $repartition_data
            ],
            'kpis' => [
                'total_comptages' => $total_comptages,
                'total_ventes' => round($total_ventes, 2),
                'ventes_moyennes' => round($ventes_moyennes, 2),
                'total_retrocession' => round($total_retrocession, 2)
            ],
            'caisses' => $caisses_data,
            'evolution' => [
                'labels' => $evolution_dates,
                'data' => $evolution_ventes
            ],
            'funnel' => $funnel_data,
            'radar' => [
                'labels' => $radar_labels,
                'series' => $radar_data
            ]
        ]);
    }
}
