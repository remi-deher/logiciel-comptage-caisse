<?php
// src/StatistiquesController.php - Version mise à jour pour le schéma normalisé.
require_once __DIR__ . '/Bdd.php';
require_once __DIR__ . '/Utils.php';
require_once __DIR__ . '/services/FilterService.php';

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

    public function statistiques() {
        $page_css = 'stats.css';
        $page_js = 'stats.js';
        $noms_caisses = $this->noms_caisses;
        require __DIR__ . '/../templates/statistiques.php';
    }

    public function getStatsData() {
        header('Content-Type: application/json');
        
        $date_debut = $_GET['date_debut'] ?? null;
        $date_fin = $_GET['date_fin'] ?? null;
        $filter_params = $this->filterService->getWhereClauseAndBindings($date_debut, $date_fin, null, null, 'tout');
        $sql_where = $filter_params['sql_where'];
        $bind_values = $filter_params['bind_values'];

        $sql_total_comptages = "SELECT COUNT(id) FROM comptages" . $sql_where;
        $stmt_total_comptages = $this->pdo->prepare($sql_total_comptages);
        $stmt_total_comptages->execute($bind_values);
        $total_comptages = $stmt_total_comptages->fetchColumn();

        $caisses_data = [];
        $repartition_data = [];
        $total_ventes_global = 0;
        $total_retrocession_global = 0;

        foreach ($this->noms_caisses as $caisse_id => $nom_caisse) {
            // --- DÉBUT DE LA CORRECTION 1 ---
            $sql_caisse_stats = "SELECT 
                SUM(cd.ventes_especes + cd.ventes_cb + cd.ventes_cheques) AS total_ventes, 
                AVG(cd.ventes_especes + cd.ventes_cb + cd.ventes_cheques) AS moyenne_ventes,
                SUM(cd.retrocession) AS total_retrocession
            FROM comptages c
            JOIN comptage_details cd ON c.id = cd.comptage_id
            WHERE cd.caisse_id = ? " . str_replace("WHERE", "AND", $sql_where);
            // --- FIN DE LA CORRECTION 1 ---
            
            $stmt = $this->pdo->prepare($sql_caisse_stats);
            $caisse_bind_values = array_merge([$caisse_id], $bind_values);
            $stmt->execute($caisse_bind_values);
            $caisse_stats = $stmt->fetch(PDO::FETCH_ASSOC);

            $total_ventes = round(floatval($caisse_stats['total_ventes'] ?? 0), 2);
            $moyenne_ventes = round(floatval($caisse_stats['moyenne_ventes'] ?? 0), 2);
            $total_retrocession = round(floatval($caisse_stats['total_retrocession'] ?? 0), 2);

            $caisses_data[] = [
                'id' => $caisse_id,
                'nom' => $nom_caisse,
                'total_ventes' => $total_ventes,
                'moyenne_ventes' => $moyenne_ventes,
                'total_retrocession' => $total_retrocession
            ];
            $repartition_data[] = $total_ventes;
            $total_ventes_global += $total_ventes;
            $total_retrocession_global += $total_retrocession;
        }

        $ventes_moyennes_global = $total_comptages > 0 ? $total_ventes_global / $total_comptages : 0;
        
        // --- DÉBUT DE LA CORRECTION 2 ---
        $evolution_sql = "SELECT DATE(c.date_comptage) as date, SUM(cd.ventes_especes + cd.ventes_cb + cd.ventes_cheques) as total_ventes, SUM(cd.retrocession) as total_retrocession FROM comptages c JOIN comptage_details cd ON c.id = cd.comptage_id " . $sql_where . " GROUP BY DATE(c.date_comptage) ORDER BY date ASC";
        // --- FIN DE LA CORRECTION 2 ---
        
        $evolution_stmt = $this->pdo->prepare($evolution_sql);
        $evolution_stmt->execute($bind_values);
        $evolution_results = $evolution_stmt->fetchAll(PDO::FETCH_ASSOC); // Correction ici, utilisait $stmt au lieu de $evolution_stmt
        
        $evolution_dates = [];
        $evolution_ventes = [];
        $evolution_retrocession = [];
        foreach ($evolution_results as $row) {
            $evolution_dates[] = (new DateTime($row['date']))->format('d/m/Y');
            $evolution_ventes[] = floatval($row['total_ventes']);
            $evolution_retrocession[] = floatval($row['total_retrocession']);
        }
        
        $funnel_data = [
            'labels' => ['Ventes', 'Rétrocessions', 'Total réel'],
            'data' => [
                round($total_ventes_global, 2),
                round($total_retrocession_global, 2),
                round($total_ventes_global - $total_retrocession_global, 2)
            ]
        ];
        
        $radar_labels = array_keys($this->noms_caisses);
        $radar_data_ventes = array_column($caisses_data, 'total_ventes');
        $radar_data_ventes_moyennes = array_column($caisses_data, 'moyenne_ventes');
        $radar_data_retrocession = array_column($caisses_data, 'total_retrocession');

        $radar_series = [];
        $radar_series[] = ['name' => 'Ventes totales', 'data' => $radar_data_ventes];
        $radar_series[] = ['name' => 'Ventes moyennes', 'data' => $radar_data_ventes_moyennes];
        $radar_series[] = ['name' => 'Rétrocessions', 'data' => $radar_data_retrocession];


        echo json_encode([
            'repartition' => [
                'labels' => array_values($this->noms_caisses),
                'data' => $repartition_data
            ],
            'kpis' => [
                'total_comptages' => $total_comptages,
                'total_ventes' => round($total_ventes_global, 2),
                'ventes_moyennes' => round($ventes_moyennes_global, 2),
                'total_retrocession' => round($total_retrocession_global, 2)
            ],
            'caisses' => $caisses_data,
            'evolution' => [
                'labels' => $evolution_dates,
                'data' => $evolution_ventes
            ],
            'funnel' => $funnel_data,
            'radar' => [
                'labels' => $radar_labels,
                'series' => $radar_series
            ]
        ]);
    }
}
