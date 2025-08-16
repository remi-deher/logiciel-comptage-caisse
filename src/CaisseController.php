<?php
// Fichier : src/CaisseController.php
// Ce fichier est le contrôleur principal pour les actions liées aux caisses et aux statistiques.

require_once 'Bdd.php';
require_once 'services/VersionService.php';
require_once 'Utils.php';

class CaisseController {
    private $pdo;
    private $noms_caisses;
    private $denominations;
    private $tpe_par_caisse;
    private $versionService;

    // Constructeur avec toutes les dépendances nécessaires
    public function __construct($pdo, $noms_caisses, $denominations, $tpe_par_caisse) {
        $this->pdo = $pdo;
        $this->noms_caisses = $noms_caisses;
        $this->denominations = $denominations;
        $this->tpe_par_caisse = $tpe_par_caisse;
        $this->versionService = new VersionService();
    }

    /**
     * Méthode d'aide pour construire la clause WHERE des requêtes SQL.
     */
    private function _getWhereClauseAndBindings($date_debut, $date_fin, $recherche = null, $caisse_filtre = null, $vue = 'tout') {
        $where_clauses = [];
        $bind_values = [];

        if ($vue === 'jour' && empty($date_debut) && empty($date_fin)) {
            $where_clauses[] = "DATE(date_comptage) = CURDATE()";
        }

        if (!empty($date_debut)) {
            $where_clauses[] = "date_comptage >= ?";
            $bind_values[] = $date_debut . " 00:00:00";
        }
        if (!empty($date_fin)) {
            $where_clauses[] = "date_comptage <= ?";
            $bind_values[] = $date_fin . " 23:59:59";
        }
        if (!empty($recherche)) {
            $where_clauses[] = "nom_comptage LIKE ?";
            $bind_values[] = "%" . $recherche . "%";
        }
        if (!empty($caisse_filtre)) {
            $where_clauses[] = "{$caisse_filtre} IS NOT NULL";
        }

        $sql_where = "";
        if (!empty($where_clauses)) {
            $sql_where = " WHERE " . implode(" AND ", $where_clauses);
        }

        return ['sql_where' => $sql_where, 'bind_values' => $bind_values];
    }
    
    /**
     * Affiche la page du calculateur.
     */
    public function calculateur() {
        $loaded_data = [];
        $isLoadedFromHistory = false;
        $isAutosaveLoaded = false;

        if (isset($_GET['load'])) {
            $isLoadedFromHistory = true;
            $stmt = $this->pdo->prepare("SELECT * FROM comptages WHERE id = ?");
            $stmt->execute([intval($_GET['load'])]);
            $loaded_data = $stmt->fetch() ?: [];
        } else {
            $stmt = $this->pdo->prepare("SELECT * FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%' ORDER BY id DESC LIMIT 1");
            $stmt->execute();
            $loaded_data = $stmt->fetch() ?: [];
            if ($loaded_data) {
                $isAutosaveLoaded = true;
            }
        }

        $message = $_SESSION['message'] ?? null;
        unset($_SESSION['message']);

        $noms_caisses = $this->noms_caisses;
        $denominations = $this->denominations;
        
        $page_css = 'calculateur.css';
        require __DIR__ . '/../templates/calculateur.php';
    }

    /**
     * Affiche la page d'historique des comptages.
     */
    public function historique() {
        // Définir la pagination
        $page_courante = isset($_GET['p']) ? (int)$_GET['p'] : 1;
        $comptages_par_page = 10;
        $offset = ($page_courante - 1) * $comptages_par_page;

        // Définir la vue (aujourd'hui par défaut)
        $vue = $_GET['vue'] ?? 'jour';

        // Prise en compte des filtres de date
        $date_debut = $_GET['date_debut'] ?? '';
        $date_fin = $_GET['date_fin'] ?? '';
        $recherche = $_GET['recherche'] ?? '';
        $caisse_filtre = $_GET['caisse'] ?? '';
        
        $sql_base = "FROM comptages";
        
        $filter_params = $this->_getWhereClauseAndBindings($date_debut, $date_fin, $recherche, $caisse_filtre, $vue);
        $sql_where = $filter_params['sql_where'];
        $bind_values = $filter_params['bind_values'];

        // Compter le total des enregistrements pour la pagination
        $stmt_count = $this->pdo->prepare("SELECT COUNT(id) " . $sql_base . $sql_where);
        $stmt_count->execute($bind_values);
        $total_comptages = $stmt_count->fetchColumn();
        $pages_totales = ceil($total_comptages / $comptages_par_page);

        // Récupérer les données pour la page actuelle
        $sql_data = "SELECT * " . $sql_base . $sql_where . " ORDER BY date_comptage DESC LIMIT {$comptages_par_page} OFFSET {$offset}";
        $stmt_data = $this->pdo->prepare($sql_data);
        $stmt_data->execute($bind_values);
        $historique = $stmt_data->fetchAll();

        $message = $_SESSION['message'] ?? null;
        unset($_SESSION['message']);
        
        $noms_caisses = $this->noms_caisses;
        $denominations = $this->denominations;
        $nombre_caisses = count($this->noms_caisses);

        $page_css = 'historique.css';
        require __DIR__ . '/../templates/historique.php';
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
        
        $filter_params = $this->_getWhereClauseAndBindings($date_debut, $date_fin, null, null, 'tout');
        $sql_where = $filter_params['sql_where'];
        $bind_values = $filter_params['bind_values'];
        
        $sum_cols_ventes = [];
        $sum_cols_retrocession = [];
        $repartition_labels = [];
        $repartition_data = [];
        $caisses_data = [];

        foreach ($this->noms_caisses as $i => $nom_caisse) {
            $sum_cols_ventes[] = "SUM(c{$i}_ventes)";
            $sum_cols_retrocession[] = "SUM(c{$i}_retrocession)";
            $repartition_labels[] = $nom_caisse;

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
            ]
        ]);
    }
    
    /**
     * Affiche la page d'aide.
     */
    public function aide() {
        require __DIR__ . '/../templates/aide.php';
    }

    /**
     * Affiche le journal des modifications.
     */
    public function changelog() {
        $releases = $this->versionService->getAllReleases();
        $page_css = 'changelog.css';
        require __DIR__ . '/../templates/changelog.php';
    }
    
    /**
     * Gère la sauvegarde manuelle.
     */
    public function save() {
        $this->handleSave(false);
    }

    /**
     * Gère la sauvegarde automatique.
     */
    public function autosave() {
        $this->handleSave(true);
    }

    /**
     * Méthode privée pour gérer la logique de sauvegarde.
     */
    private function handleSave($is_autosave) {
        if ($is_autosave) {
            header('Content-Type: application/json');
            ob_start();
        }

        $nom_comptage = trim($_POST['nom_comptage'] ?? '');
        $has_data = false;
        foreach ($_POST['caisse'] ?? [] as $caisse_data) {
            foreach ($caisse_data as $value) {
                if (!empty($value)) {
                    $has_data = true;
                    break 2;
                }
            }
        }

        if (empty($nom_comptage) || !$has_data) {
            if ($is_autosave) {
                ob_end_clean();
                echo json_encode(['success' => false, 'message' => 'Aucune donnée à sauvegarder.']);
            } else {
                $_SESSION['message'] = "Aucune donnée n'a été saisie.";
                header('Location: index.php?page=calculateur');
            }
            exit;
        }

        $sql_columns = ['nom_comptage', 'explication', 'date_comptage'];
        $sql_values = [$nom_comptage, trim($_POST['explication'] ?? ''), date('Y-m-d H:i:s')];

        foreach ($this->noms_caisses as $i => $nom) {
            $caisse_data = $_POST['caisse'][$i] ?? [];
            $sql_columns[] = "c{$i}_fond_de_caisse"; $sql_values[] = get_numeric_value($caisse_data, 'fond_de_caisse');
            $sql_columns[] = "c{$i}_ventes"; $sql_values[] = get_numeric_value($caisse_data, 'ventes');
            $sql_columns[] = "c{$i}_retrocession"; $sql_values[] = get_numeric_value($caisse_data, 'retrocession');
            
            foreach ($this->denominations as $list) {
                foreach (array_keys($list) as $name) {
                    $sql_columns[] = "c{$i}_{$name}";
                    $sql_values[] = get_numeric_value($caisse_data, $name);
                }
            }
        }
        
        $placeholders = implode(', ', array_fill(0, count($sql_values), '?'));
        $sql = "INSERT INTO comptages (" . implode(', ', $sql_columns) . ") VALUES ($placeholders)";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($sql_values);
        
        if ($is_autosave) {
            ob_end_clean();
            echo json_encode(['success' => true, 'message' => 'Sauvegarde auto à ' . date('H:i:s')]);
        } else {
            $last_id = $this->pdo->lastInsertId();
            $_SESSION['message'] = "Comptage '" . htmlspecialchars($nom_comptage) . "' créé avec succès !";
            header('Location: index.php?page=calculateur');
        }
        exit;
    }

    /**
     * Gère la suppression d'un comptage.
     */
    public function delete() {
        $id_a_supprimer = intval($_POST['id_a_supprimer'] ?? 0);
        if ($id_a_supprimer > 0) {
            $stmt = $this->pdo->prepare("DELETE FROM comptages WHERE id = ?");
            $stmt->execute([$id_a_supprimer]);
            $_SESSION['message'] = "Le comptage a été supprimé avec succès.";
        }
        header('Location: index.php?page=historique');
        exit;
    }
}
