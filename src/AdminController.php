<?php
// src/AdminController.php

require_once __DIR__ . '/Utils.php';
require_once __DIR__ . '/services/CurrencyService.php';
require_once __DIR__ . '/services/TerminalManagementService.php';
require_once __DIR__ . '/services/ReserveService.php';
require_once __DIR__ . '/services/DatabaseMigrationService.php';

class AdminController {
    private $pdo;
    protected $backupService;
    protected $versionService;
    private $configService;
    private $userService;
    private $caisseManagementService;
    private $currencyService;
    private $terminalManagementService;
    private $reserveService;
    protected $databaseMigrationService;

    public function __construct($pdo, $denominations) {
        $this->pdo = $pdo;
        $this->backupService = new BackupService();
        $this->versionService = new VersionService();
        $this->configService = new ConfigService();
        $this->userService = new UserService($pdo);
        $this->caisseManagementService = new CaisseManagementService($pdo, $this->configService);
        $this->currencyService = new CurrencyService();
        $this->terminalManagementService = new TerminalManagementService($pdo, $this->configService);
        $this->reserveService = new ReserveService($pdo, $denominations);
        $this->databaseMigrationService = new DatabaseMigrationService($pdo);
    }

    public function getLocalVersion() {
        if (!defined('PHPUNIT_RUNNING')) { header('Content-Type: application/json'); }
        $version = $this->versionService->getLocalVersion();
        echo json_encode(['success' => true, 'version' => $version]);
        exit;
    }

    public function getDashboardData() {
        global $noms_caisses, $denominations, $min_to_keep;
        AuthController::checkAuth();
        if (!defined('PHPUNIT_RUNNING')) { header('Content-Type: application/json'); }

        $stmt = $this->pdo->query("SELECT * FROM terminaux_paiement ORDER BY nom_terminal ASC");
        $terminaux = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'caisses' => $noms_caisses,
            'admins' => $this->userService->getAdminsList(),
            'terminaux' => $terminaux,
            'backups' => $this->backupService->getBackups(),
            'reserve_status' => $this->reserveService->getReserveStatus(),
            'denominations' => $denominations,
            'min_to_keep' => $min_to_keep,
        ]);
        exit;
    }
    
    public function index() {
        AuthController::checkAuth();
        $action = $_REQUEST['action'] ?? null;

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action) {
            switch ($action) {
                case 'add_caisse': $this->caisseManagementService->addCaisse($_POST['caisse_name'] ?? ''); break;
                case 'rename_caisse': $this->caisseManagementService->renameCaisse(intval($_POST['caisse_id'] ?? 0), $_POST['caisse_name'] ?? ''); break;
                case 'delete_caisse': $this->caisseManagementService->deleteCaisse(intval($_POST['caisse_id'] ?? 0)); break;
		        case 'update_reserve':
                    if (isset($_POST['quantities']) && is_array($_POST['quantities'])) {
                        $this->reserveService->updateQuantities($_POST['quantities']);
                        $_SESSION['admin_message'] = "Stock de la réserve mis à jour.";
                    }
                    break;
                case 'update_min_to_keep':
                    if (isset($_POST['min_to_keep']) && is_array($_POST['min_to_keep'])) {
                        $this->configService->updateConfigFile(['min_to_keep' => $_POST['min_to_keep']]);
                        $_SESSION['admin_message'] = "Configuration du fond de caisse minimal enregistrée.";
                    }
                    break;
                case 'add_terminal':
                    $this->terminalManagementService->addTerminal($_POST['terminal_name'] ?? '', intval($_POST['caisse_id'] ?? 0));
                    break;
                case 'rename_terminal':
                    $this->terminalManagementService->renameTerminal(intval($_POST['terminal_id'] ?? 0), $_POST['terminal_name'] ?? '', intval($_POST['caisse_id'] ?? 0));
                    break;
                case 'delete_terminal':
                    $this->terminalManagementService->deleteTerminal(intval($_POST['terminal_id'] ?? 0));
                    break;
            }
            if (!defined('PHPUNIT_RUNNING')) { header('Location: /admin'); }
            exit;
        }

        if (!defined('PHPUNIT_RUNNING')) { http_response_code(405); }
        echo json_encode(['success' => false, 'message' => 'Cette route ne supporte que les requêtes POST.']);
        exit;
    }
    
    public function getUpdateStatus() {
        AuthController::checkAuth();
        if (!defined('PHPUNIT_RUNNING')) { header('Content-Type: application/json'); }
        
        $release_info = $this->versionService->getLatestReleaseInfo();
        $migration_sql = $this->databaseMigrationService->generateMigrationSql();
        $migration_needed = !empty($migration_sql) && !isset($migration_sql['error']);

        echo json_encode([
            'success' => true,
            'release_info' => $release_info,
            'migration_needed' => $migration_needed,
            'migration_sql' => $migration_sql
        ]);
        exit;
    }

    public function performFullUpdate() {
        AuthController::checkAuth();
        if (!defined('PHPUNIT_RUNNING')) { header('Content-Type: application/json'); }
        
        $output = [];
        $output[] = "[ETAPE 1/3] Création d'une sauvegarde de la base de données...";
        $backupResult = $this->backupService->createBackup();
        if (!$backupResult['success']) {
            if (!defined('PHPUNIT_RUNNING')) { http_response_code(500); }
            echo json_encode(['success' => false, 'message' => "Échec de la sauvegarde : " . $backupResult['message']]);
            exit;
        }
        $output[] = "-> Sauvegarde réussie.";

        $output[] = "\n[ETAPE 2/3] Mise à jour des fichiers de l'application via Git...";
        $gitResult = $this->performGitUpdate();
        $output[] = $gitResult['output'];
        if (!$gitResult['success']) {
            if (!defined('PHPUNIT_RUNNING')) { http_response_code(500); }
            echo json_encode(['success' => false, 'message' => "Échec de la mise à jour Git : " . $gitResult['output']]);
            exit;
        }
        $output[] = "-> Mise à jour des fichiers terminée.";

        $output[] = "\n[ETAPE 3/3] Vérification et migration de la base de données...";
        $migrationResult = $this->performMigration();
        $output[] = $migrationResult['message'];
        if (!$migrationResult['success']) {
            if (!defined('PHPUNIT_RUNNING')) { http_response_code(500); }
            echo json_encode(['success' => false, 'message' => "Échec de la migration : " . $migrationResult['message']]);
            exit;
        }

        @unlink(dirname(__DIR__, 2) . '/cache/github_release.json');
        echo json_encode(['success' => true, 'message' => implode("\n", $output)]);
        exit;
    }
    
    public function performMigration() {
        $sqlCommands = $this->databaseMigrationService->generateMigrationSql();
        if (empty($sqlCommands) || isset($sqlCommands['error'])) {
            return ['success' => true, 'message' => '-> Base de données déjà à jour.'];
        }

        $result = $this->databaseMigrationService->applyMigration($sqlCommands);
        if ($result['success']) {
            return ['success' => true, 'message' => '-> Migration de la base de données terminée avec succès.'];
        } else {
            return ['success' => false, 'message' => '-> Erreur lors de la migration : ' . $result['error']];
        }
    }
    
    protected function performGitUpdate() {
        $repo_path = ROOT_PATH;
        if (!is_dir($repo_path . '/.git')) {
            return ['success' => false, 'output' => "Erreur : Le dossier de l'application n'est pas un dépôt Git."];
        }
        $command = 'cd ' . escapeshellarg($repo_path) . ' && git pull 2>&1';
        exec($command, $output, $return_var);
        $outputText = implode("\n", $output);
        return ['success' => $return_var === 0, 'output' => $outputText];
    }

    public function gitReleaseCheck($force = false) { 
        AuthController::checkAuth();
        if (!defined('PHPUNIT_RUNNING')) { header('Content-Type: application/json'); }
        echo json_encode($this->versionService->getLatestReleaseInfo($force));
        exit;
    }
}
