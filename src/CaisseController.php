<?php
// Fichier : src/CaisseController.php
// CORRIGÉ : La méthode getStatsData inclut maintenant les données pour le graphique de répartition.

class CaisseController {
    private $pdo;
    private $noms_caisses;
    private $denominations;
    private $tpe_par_caisse;
    private $versionService;

    // CORRECTION : Ajout de $tpe_par_caisse au constructeur pour correspondre à index.php
    public function __construct($pdo, $noms_caisses, $denominations, $tpe_par_caisse) {
        $this->pdo = $pdo;
        $this->noms_caisses = $noms_caisses;
        $this->denominations = $denominations;
        $this->tpe_par_caisse = $tpe_par_caisse;
        $this->versionService = new VersionService();
    }

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

    public function historique() {
        // Définir la pagination
        $page_courante = isset($_GET['p']) ? (int)$_GET['p'] : 1;
        $comptages_par_page = 10;
        $offset = ($page_courante - 1) * $comptages_par_page;

        // Définir la vue (aujourd'hui par défaut)
        $vue = $_GET['vue'] ?? 'jour';

        $date_debut = $_GET['date_debut'] ?? '';
        $date_fin = $_GET['date_fin'] ?? '';
        $recherche = $_GET['recherche'] ?? '';

        $sql_base = "FROM comptages";
        $where_clauses = [];
        $bind_values = [];

        if ($vue === 'jour' && empty($date_debut) && empty($date_fin)) {
            $where_clauses[] = "DATE(date_comptage) = CURDATE()";
        }

        if (!empty($date_debut)) { $where_clauses[] = "date_comptage >= ?"; $bind_values[] = $date_debut . " 00:00:00"; }
        if (!empty($date_fin)) { $where_clauses[] = "date_comptage <= ?"; $bind_values[] = $date_fin . " 23:59:59"; }
        if (!empty($recherche)) { $where_clauses[] = "nom_comptage LIKE ?"; $bind_values[] = "%" . $recherche . "%"; }

        $sql_where = "";
        if (!empty($where_clauses)) {
            $sql_where = " WHERE " . implode(" AND ", $where_clauses);
        }

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
    
    public function statistiques() {
        $page_css = 'stats.css';
        $page_js = 'stats.js';
        // Passage du tableau de noms de caisses à la vue
        $noms_caisses = $this->noms_caisses;
        require __DIR__ . '/../templates/statistiques.php';
    }

    public function getStatsData() {
        header('Content-Type: application/json');
        
        // CORRIGÉ : Prise en compte des filtres de date et de caisse
        $date_debut = $_GET['date_debut'] ?? null;
        $date_fin = $_GET['date_fin'] ?? null;
        $caisse_filtre = $_GET['caisse'] ?? null;

        $where_clauses = [];
        $bind_values = [];

        if (!empty($date_debut)) {
            $where_clauses[] = "date_comptage >= ?";
            $bind_values[] = $date_debut . " 00:00:00";
        }
        if (!empty($date_fin)) {
            $where_clauses[] = "date_comptage <= ?";
            $bind_values[] = $date_fin . " 23:59:59";
        }
        $sql_where = "";
        if (!empty($where_clauses)) {
            $sql_where = " WHERE " . implode(" AND ", $where_clauses);
        }
        
        // Dynamiquement construire les colonnes de sélection et les datasets
        $select_cols = [];
        $sum_cols_ventes = [];
        $sum_cols_retrocession = [];
        $repartition_labels = [];
        $repartition_data = [];

        foreach ($this->noms_caisses as $i => $nom_caisse) {
            $select_cols[] = "c{$i}_ventes";
            $sum_cols_ventes[] = "SUM(c{$i}_ventes)";
            $sum_cols_retrocession[] = "SUM(c{$i}_retrocession)";
            $repartition_labels[] = $nom_caisse;
        }

        $sum_cols_ventes_str = implode(' + ', $sum_cols_ventes);
        $sum_cols_retrocession_str = implode(' + ', $sum_cols_retrocession);
        
        // Récupérer les KPI
        $stmt_total_comptages = $this->pdo->prepare("SELECT COUNT(*) FROM comptages" . $sql_where);
        $stmt_total_comptages->execute($bind_values);
        $total_comptages = $stmt_total_comptages->fetchColumn();

        $stmt_total_ventes = $this->pdo->prepare("SELECT {$sum_cols_ventes_str} FROM comptages" . $sql_where);
        $stmt_total_ventes->execute($bind_values);
        $total_ventes = $stmt_total_ventes->fetchColumn();
        
        $ventes_moyennes = $total_comptages > 0 ? $total_ventes / $total_comptages : 0;
        
        $stmt_total_retrocession = $this->pdo->prepare("SELECT {$sum_cols_retrocession_str} FROM comptages" . $sql_where);
        $stmt_total_retrocession->execute($bind_values);
        $total_retrocession = $stmt_total_retrocession->fetchColumn();

        // Récupération des données pour le graphique de répartition
        if ($caisse_filtre) {
            // Si une caisse est filtrée, le graphique en secteurs est inutile
            $repartition_data = [];
            $repartition_labels = [];
        } else {
            $repartition_sql = "SELECT " . implode(', ', array_map(fn($i) => "SUM(c{$i}_ventes) AS ventes_c{$i}", array_keys($this->noms_caisses))) . " FROM comptages" . $sql_where;
            $repartition_stmt = $this->pdo->prepare($repartition_sql);
            $repartition_stmt->execute($bind_values);
            $repartition_result = $repartition_stmt->fetch(PDO::FETCH_ASSOC);

            foreach ($this->noms_caisses as $i => $nom_caisse) {
                $repartition_data[] = floatval($repartition_result["ventes_c{$i}"]);
            }
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
            ]
        ]);
    }
    
    public function aide() {
        require __DIR__ . '/../templates/aide.php';
    }

    public function changelog() {
        $releases = $this->versionService->getAllReleases();
        $page_css = 'changelog.css';
        require __DIR__ . '/../templates/changelog.php';
    }
    
    public function save() {
        $this->handleSave(false);
    }

    public function autosave() {
        $this->handleSave(true);
    }

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
            header('Location: index.php?page=calculateur&load=' . $last_id);
        }
        exit;
    }

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
