<?php
// src/AdminController.php

require_once __DIR__ . '/Utils.php';

class AdminController {
    private $pdo;
    private $backupService;
    private $versionService;
    private $configService;
    private $userService;
    private $caisseManagementService;

    public function __construct($pdo) {
        $this->pdo = $pdo;
        $this->backupService = new BackupService();
        $this->versionService = new VersionService();
        $this->configService = new ConfigService();
        $this->userService = new UserService($pdo);
        $this->caisseManagementService = new CaisseManagementService($pdo, $this->configService);
    }

    public function index() {
        AuthController::checkAuth();
        $action = $_REQUEST['action'] ?? null;

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action) {
            switch ($action) {
                // Actions de configuration
                case 'update_db_config': $this->updateDbConfig(); break;
                case 'update_app_config': $this->updateAppConfig(); break;
                case 'update_withdrawal_config': $this->updateWithdrawalConfig(); break;
                
                // Actions de sauvegarde
                case 'create_backup': $this->createBackup(); break;
                
                // Actions utilisateur
                case 'sync_single_admin': $this->userService->syncSingleAdmin($_POST['username'] ?? ''); break;
                case 'delete_admin': $this->userService->deleteAdmin($_POST['username'] ?? ''); break;
                case 'update_password': $this->userService->updateAdminPassword($_POST['username'] ?? '', $_POST['password'] ?? ''); break;
                
                // Actions de gestion des caisses
                case 'add_caisse': $this->caisseManagementService->addCaisse($_POST['caisse_name'] ?? ''); break;
                case 'rename_caisse': $this->caisseManagementService->renameCaisse(intval($_POST['caisse_id'] ?? 0), $_POST['caisse_name'] ?? ''); break;
                case 'delete_caisse': $this->caisseManagementService->deleteCaisse(intval($_POST['caisse_id'] ?? 0)); break;
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
        global $min_to_keep; // Assure que la variable est accessible ici
        global $denominations;
        
        // S'assure que la variable existe et est un tableau, sinon l'initialise
        if (!isset($min_to_keep) || !is_array($min_to_keep)) {
            $min_to_keep = [];
        }

        $backups = $this->backupService->getBackups();
        $admins = $this->userService->getAdminsList();
        $caisses = $noms_caisses;
        $timezones = DateTimeZone::listIdentifiers(DateTimeZone::EUROPE);
        
        $page_css = 'admin.css';
        require __DIR__ . '/../templates/admin.php';
    }

    private function updateWithdrawalConfig() {
        $updates = ['min_to_keep' => $_POST['min_to_keep'] ?? []];
        $result = $this->configService->updateConfigFile($updates);
        $_SESSION['admin_message'] = $result['success'] ? "Configuration des suggestions de retrait mise à jour." : $result['message'];
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
}
