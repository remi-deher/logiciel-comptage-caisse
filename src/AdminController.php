<?php
// src/AdminController.php

require_once __DIR__ . '/Utils.php';
require_once __DIR__ . '/services/CurrencyService.php';
require_once __DIR__ . '/services/TerminalManagementService.php';
require_once __DIR__ . '/services/ReserveService.php';

class AdminController {
    private $pdo;
    private $backupService;
    private $versionService;
    private $configService;
    private $userService;
    private $caisseManagementService;
    private $currencyService;
    private $terminalManagementService;
    private $reserveService;

    // Le constructeur reçoit maintenant toutes les dépendances nécessaires
    public function __construct($pdo, $denominations) {
        $this->pdo = $pdo;
        $this->backupService = new BackupService();
        $this->versionService = new VersionService();
        $this->configService = new ConfigService();
        $this->userService = new UserService($pdo);
        $this->caisseManagementService = new CaisseManagementService($pdo, $this->configService);
        $this->currencyService = new CurrencyService();
        $this->terminalManagementService = new TerminalManagementService($pdo, $this->configService);
        // Le service ReserveService a besoin des dénominations pour fonctionner
        $this->reserveService = new ReserveService($pdo, $denominations);
    }

    public function getLocalVersion() {
        $version = $this->versionService->getLocalVersion();
        // S'assure que la sortie est toujours un JSON valide
        echo json_encode(['success' => true, 'version' => $version]);
        exit;
    }

    public function getDashboardData() {
        global $noms_caisses, $denominations; // L'usage de global est acceptable ici car c'est pour l'affichage

        AuthController::checkAuth();

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
            }
            header('Location: /admin');
            exit;
        }

        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Cette route ne supporte que les requêtes POST.']);
        exit;
    }

    // Placeholder pour les autres méthodes
    public function gitReleaseCheck($force = false) { /* ... */ }
    public function getUpdateStatus() { /* ... */ }
    public function performMigration() { /* ... */ }
}
