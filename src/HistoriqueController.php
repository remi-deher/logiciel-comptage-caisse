<?php
// src/HistoriqueController.php
require_once 'services/VersionService.php';
require_once 'Utils.php';
class HistoriqueController {
    private $pdo;
    private $noms_caisses;
    private $denominations;
    private $tpe_par_caisse;
    private $versionService;
    public function __construct($pdo, $noms_caisses, $denominations, $tpe_par_caisse) {
        $this->pdo = $pdo;
        $this->noms_caisses = $noms_caisses;
        $this->denominations = $denominations;
        $this->tpe_par_caisse = $tpe_par_caisse;
        $this->versionService = new VersionService();
    }
    private function _getWhereClauseAndBindings($date_debut, $date_fin, $recherche = null, $caisse_filtre = null, $vue = 'tout') {
        $where_clauses = [];
        $bind_values = [];
        if ($vue === 'jour' && empty($date_debut) && empty($date_fin)) { $where_clauses[] = "DATE(date_comptage) = CURDATE()"; }
        if (!empty($date_debut)) { $where_clauses[] = "date_comptage >= ?"; $bind_values[] = $date_debut . " 00:00:00"; }
        if (!empty($date_fin)) { $where_clauses[] = "date_comptage <= ?"; $bind_values[] = $date_fin . " 23:59:59"; }
        if (!empty($recherche)) { $where_clauses[] = "nom_comptage LIKE ?"; $bind_values[] = "%" . $recherche . "%"; }
        if (!empty($caisse_filtre)) { $where_clauses[] = "{$caisse_filtre} IS NOT NULL"; }
        $sql_where = !empty($where_clauses) ? " WHERE " . implode(" AND ", $where_clauses) : "";
        return ['sql_where' => $sql_where, 'bind_values' => $bind_values];
    }
    public function historique() {
        $page_courante = isset($_GET['p']) ? (int)$_GET['p'] : 1;
        $comptages_par_page = 10;
        $offset = ($page_courante - 1) * $comptages_par_page;
        $vue = $_GET['vue'] ?? 'jour';
        $date_debut = $_GET['date_debut'] ?? '';
        $date_fin = $_GET['date_fin'] ?? '';
        $recherche = $_GET['recherche'] ?? '';
        $caisse_filtre = $_GET['caisse'] ?? '';
        $sql_base = "FROM comptages";
        $filter_params = $this->_getWhereClauseAndBindings($date_debut, $date_fin, $recherche, $caisse_filtre, $vue);
        $sql_where = $filter_params['sql_where'];
        $bind_values = $filter_params['bind_values'];
        $stmt_count = $this->pdo->prepare("SELECT COUNT(id) " . $sql_base . $sql_where);
        $stmt_count->execute($bind_values);
        $total_comptages = $stmt_count->fetchColumn();
        $pages_totales = ceil($total_comptages / $comptages_par_page);
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
?>
