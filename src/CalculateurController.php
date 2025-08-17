<?php
// src/CalculateurController.php
// Ce contrôleur gère la page du calculateur et les actions de sauvegarde.
require_once 'services/VersionService.php';
require_once 'Utils.php';
class CalculateurController {
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
    public function save() { $this->handleSave(false); }
    public function autosave() { $this->handleSave(true); }
    private function handleSave($is_autosave) {
        if ($is_autosave) { header('Content-Type: application/json'); ob_start(); }
        $nom_comptage = trim($_POST['nom_comptage'] ?? '');
        $has_data = false;
        foreach ($_POST['caisse'] ?? [] as $caisse_data) {
            foreach ($caisse_data as $value) { if (!empty($value)) { $has_data = true; break 2; } }
        }
        if (empty($nom_comptage) || !$has_data) {
            if ($is_autosave) { ob_end_clean(); echo json_encode(['success' => false, 'message' => 'Aucune donnée à sauvegarder.']); }
            else { $_SESSION['message'] = "Aucune donnée n'a été saisie."; header('Location: index.php?page=calculateur'); }
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
        if ($is_autosave) { ob_end_clean(); echo json_encode(['success' => true, 'message' => 'Sauvegarde auto à ' . date('H:i:s')]); }
        else { $last_id = $this->pdo->lastInsertId(); $_SESSION['message'] = "Comptage '" . htmlspecialchars($nom_comptage) . "' créé avec succès !"; header('Location: index.php?page=calculateur'); }
        exit;
    }
}
?>
