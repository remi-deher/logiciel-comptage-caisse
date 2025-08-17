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
                // NOUVEAU: Gère l'action de mise à jour des dénominations
                case 'update_denominations_config': $this->updateDenominationsConfig(); break;
                
                // Actions de sauvegarde
                case 'create_backup': $this->createBackup(); break;
                // NOUVEAU: Action de suppression de sauvegarde
                case 'delete_backup': $this->deleteBackup(); break;
                
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
        global $min_to_keep;
        global $denominations;
        
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

    // NOUVELLE MÉTHODE POUR METTRE À JOUR LES DÉNOMINATIONS
    private function updateDenominationsConfig() {
        $updates = ['denominations' => $_POST['denominations'] ?? []];
        $result = $this->configService->updateConfigFile($updates);
        $_SESSION['admin_message'] = $result['success'] ? "Configuration des dénominations mise à jour." : $result['message'];
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

    private function deleteBackup() {
        $filename = basename($_POST['file'] ?? '');
        $backupDir = dirname(__DIR__, 2) . '/backups';
        $filePath = $backupDir . '/' . $filename;
    
        // Vérification de la validité du nom de fichier
        if (empty($filename) || !preg_match('/^[a-zA-Z0-9\-\.]+\.sql\.gz$/', $filename)) {
            $_SESSION['admin_error'] = "Nom de fichier non valide.";
            return;
        }
    
        // Vérification de l'existence du fichier et du chemin
        $realBackupDir = realpath($backupDir);
        $realFilePath = realpath($filePath);
    
        if ($realFilePath === false || strpos($realFilePath, $realBackupDir) !== 0) {
            $_SESSION['admin_error'] = "Fichier de sauvegarde non valide ou introuvable.";
            return;
        }
    
        // NOUVEAU : Vérification plus explicite de la permission d'écriture
        if (!is_writable($realFilePath)) {
            $_SESSION['admin_error'] = "Erreur : Le fichier '{$filename}' n'est pas accessible en écriture. Vérifiez les permissions du dossier '/backups'.";
            return;
        }
    
        // Tentative de suppression
        if (unlink($realFilePath)) {
            $_SESSION['admin_message'] = "La sauvegarde '{$filename}' a été supprimée avec succès.";
        } else {
            $_SESSION['admin_error'] = "Erreur inconnue lors de la suppression du fichier.";
        }
    }
    
    private function downloadBackup() {
        $filename = basename($_GET['file'] ?? '');
        $backupDir = dirname(__DIR__, 2) . '/backups';
        $filePath = $backupDir . '/' . $filename;
    
        // Vérification de la validité du nom de fichier
        if (empty($filename) || !preg_match('/^[a-zA-Z0-9\-\.]+\.sql\.gz$/', $filename)) {
            $_SESSION['admin_error'] = "Nom de fichier non valide.";
            header('Location: index.php?page=admin');
            exit;
        }
    
        // Vérification de l'existence du fichier et du chemin
        $realBackupDir = realpath($backupDir);
        $realFilePath = realpath($filePath);
    
        if ($realFilePath === false || strpos($realFilePath, $realBackupDir) !== 0) {
            $_SESSION['admin_error'] = "Fichier de sauvegarde non valide ou introuvable.";
            header('Location: index.php?page=admin');
            exit;
        }
    
        // NOUVEAU : Vérification plus explicite de la permission de lecture
        if (!is_readable($realFilePath)) {
            $_SESSION['admin_error'] = "Erreur : Le fichier '{$filename}' n'est pas accessible en lecture. Vérifiez les permissions du dossier '/backups'.";
            header('Location: index.php?page=admin');
            exit;
        }
    
        // Envoie les headers pour forcer le téléchargement
        header('Content-Description: File Transfer');
        header('Content-Type: application/gzip');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($realFilePath));
        
        ob_clean();
        flush();
        readfile($realFilePath);
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
