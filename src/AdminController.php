<?php
// src/AdminController.php

require_once __DIR__ . '/Utils.php';

class AdminController {
    private $pdo;
    private $backupService;
    private $versionService;
    private $configService;
    private $userService;

    public function __construct($pdo) {
        $this->pdo = $pdo;
        $this->backupService = new BackupService();
        $this->versionService = new VersionService();
        $this->configService = new ConfigService();
        $this->userService = new UserService($pdo);
    }

    public function index() {
        AuthController::checkAuth();
        $action = $_REQUEST['action'] ?? null;

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action) {
            switch ($action) {
                case 'update_db_config': $this->updateDbConfig(); break;
                case 'update_app_config': $this->updateAppConfig(); break;
                case 'create_backup': $this->createBackup(); break;
                case 'sync_single_admin': $this->userService->syncSingleAdmin($_POST['username'] ?? ''); break;
                case 'delete_admin': $this->userService->deleteAdmin($_POST['username'] ?? ''); break;
                case 'update_password': $this->userService->updateAdminPassword($_POST['username'] ?? '', $_POST['password'] ?? ''); break;
                case 'add_caisse': $this->addCaisse(); break;
                case 'rename_caisse': $this->renameCaisse(); break;
                case 'delete_caisse': $this->deleteCaisse(); break;
            }
            header('Location: index.php?page=admin');
            exit;
        }

        if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'download_backup') {
            $this->downloadBackup();
            exit;
        }
        
        $this->dashboard();
    }

    private function dashboard() {
        global $noms_caisses;
        $backups = $this->backupService->getBackups();
        $admins = $this->userService->getAdminsList();
        $caisses = $noms_caisses;
        $timezones = DateTimeZone::listIdentifiers(DateTimeZone::EUROPE);
        
        $page_css = 'admin.css';
        require __DIR__ . '/../templates/admin.php';
    }

    private function updateAppConfig() {
        $new_timezone = $_POST['app_timezone'] ?? 'Europe/Paris';
        if (!in_array($new_timezone, DateTimeZone::listIdentifiers())) {
            $_SESSION['admin_error'] = "Fuseau horaire invalide.";
            return;
        }
        $result = $this->configService->updateConfigFile(['defines' => ['APP_TIMEZONE' => $new_timezone]]);
        $_SESSION['admin_message'] = $result['success'] ? "Configuration de l'application mise à jour." : $result['message'];
    }

    private function updateDbConfig() {
        $defines = [
            'DB_HOST' => $_POST['db_host'], 'DB_NAME' => $_POST['db_name'],
            'DB_USER' => $_POST['db_user'], 'DB_PASS' => $_POST['db_pass']
        ];
        $result = $this->configService->updateConfigFile(['defines' => $defines]);
        $_SESSION['admin_message'] = $result['success'] ? "Configuration de la base de données mise à jour." : $result['message'];
    }
    
    private function createBackup() {
        $result = $this->backupService->createBackup();
        $_SESSION[$result['success'] ? 'admin_message' : 'admin_error'] = $result['message'];
    }
    
    private function downloadBackup() {
        $filename = basename($_GET['file'] ?? '');
        $backupDir = dirname(__DIR__, 2) . '/backups';
        $filePath = $backupDir . '/' . $filename;

        if (empty($filename) || !file_exists($filePath) || strpos(realpath($filePath), realpath($backupDir)) !== 0) {
            $_SESSION['admin_error'] = "Fichier de sauvegarde non valide ou introuvable.";
            header('Location: index.php?page=admin');
            exit;
        }

        header('Content-Description: File Transfer');
        header('Content-Type: application/gzip');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($filePath));
        
        ob_clean();
        flush();

        readfile($filePath);
        exit;
    }

    public function gitReleaseCheck($force = false) {
        header('Content-Type: application/json');
        echo json_encode($this->versionService->getLatestReleaseInfo($force));
    }

    public function forceGitReleaseCheck() {
        $this->versionService->getAllReleases(true);
        $this->gitReleaseCheck(true);
    }

    public function gitPull() {
        header('Content-Type: application/json');
        $projectRoot = dirname(__DIR__, 2);
        $output = shell_exec("cd {$projectRoot} && git pull 2>&1");
        echo json_encode(['success' => true, 'message' => "Mise à jour terminée.", 'output' => $output]);
    }

    private function addCaisse() {
        global $noms_caisses, $denominations;
        $new_name = trim($_POST['caisse_name'] ?? '');
        if (empty($new_name)) {
            $_SESSION['admin_error'] = "Le nom de la nouvelle caisse ne peut pas être vide.";
            return;
        }
        
        try {
            $stmt = $this->pdo->query("SHOW COLUMNS FROM comptages");
            $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            $existing_ids = [];
            foreach ($columns as $column) {
                if (preg_match('/^c(\d+)_/', $column, $matches)) {
                    $existing_ids[] = (int)$matches[1];
                }
            }
            
            $new_id = empty($existing_ids) ? 1 : max($existing_ids) + 1;

            if (!is_int($new_id) || $new_id <= 0) {
                $_SESSION['admin_error'] = "Erreur critique lors de la génération de l'ID de la nouvelle caisse.";
                return;
            }

            $cols_to_add = [];
            $cols_to_add[] = "c{$new_id}_fond_de_caisse DECIMAL(10, 2) DEFAULT 0";
            $cols_to_add[] = "c{$new_id}_ventes DECIMAL(10, 2) DEFAULT 0";
            $cols_to_add[] = "c{$new_id}_retrocession DECIMAL(10, 2) DEFAULT 0";
            foreach ($denominations as $list) {
                foreach (array_keys($list) as $name) {
                    $cols_to_add[] = "c{$new_id}_{$name} INT DEFAULT 0";
                }
            }
            
            foreach($cols_to_add as $col) {
                $this->pdo->exec("ALTER TABLE comptages ADD COLUMN {$col}");
            }

        } catch (\Exception $e) {
            $_SESSION['admin_error'] = "Erreur BDD lors de l'ajout de la caisse : " . $e->getMessage();
            return;
        }

        $noms_caisses[$new_id] = $new_name;
        $result = $this->configService->updateConfigFile(['noms_caisses' => $noms_caisses]);
        $_SESSION['admin_message'] = $result['success'] ? "Caisse '{$new_name}' ajoutée." : $result['message'];
    }

    private function renameCaisse() {
        global $noms_caisses;
        $id = intval($_POST['caisse_id'] ?? 0);
        $new_name = trim($_POST['caisse_name'] ?? '');

        if ($id > 0 && !empty($new_name) && isset($noms_caisses[$id])) {
            $noms_caisses[$id] = $new_name;
            $result = $this->configService->updateConfigFile(['noms_caisses' => $noms_caisses]);
            $_SESSION['admin_message'] = $result['success'] ? "Caisse renommée." : $result['message'];
        } else {
            $_SESSION['admin_error'] = "Données invalides pour le renommage.";
        }
    }

    private function deleteCaisse() {
        global $noms_caisses, $denominations;
        $id = intval($_POST['caisse_id'] ?? 0);

        if ($id > 0 && isset($noms_caisses[$id])) {
            try {
                $cols_to_drop = [];
                $cols_to_drop[] = "c{$id}_fond_de_caisse";
                $cols_to_drop[] = "c{$id}_ventes";
                $cols_to_drop[] = "c{$id}_retrocession";
                
                foreach ($denominations as $list) {
                    foreach (array_keys($list) as $name) {
                        $cols_to_drop[] = "c{$id}_{$name}";
                    }
                }

                $sql = "ALTER TABLE comptages DROP COLUMN " . implode(', DROP COLUMN ', $cols_to_drop);
                $this->pdo->exec($sql);

            } catch (\Exception $e) {
                $_SESSION['admin_error'] = "Erreur BDD lors de la suppression des colonnes de la caisse : " . $e->getMessage();
                return;
            }
            
            $deleted_name = $noms_caisses[$id];
            unset($noms_caisses[$id]);

            $result = $this->configService->updateConfigFile(['noms_caisses' => $noms_caisses]);
            $_SESSION['admin_message'] = $result['success'] ? "Caisse '{$deleted_name}' et toutes ses données ont été supprimées." : $result['message'];
        } else {
            $_SESSION['admin_error'] = "ID de caisse invalide.";
        }
    }
}
