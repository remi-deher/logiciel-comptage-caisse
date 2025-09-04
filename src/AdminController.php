<?php
// src/AdminController.php

require_once __DIR__ . '/Utils.php';
require_once 'services/CurrencyService.php';
require_once 'services/TerminalManagementService.php';
require_once 'services/ReserveService.php';

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

    public function __construct($pdo) {
        global $denominations;
        $this->pdo = $pdo;
        $this->backupService = new BackupService();
        $this->versionService = new VersionService();
        $this->configService = new ConfigService();
        $this->userService = new UserService($pdo);
        $this->caisseManagementService = new CaisseManagementService($pdo, $this->configService);
        $this->currencyService = new CurrencyService();
        $this->terminalManagementService = new TerminalManagementService($pdo, $this->configService);
        $this->reserveService = new ReserveService($pdo, $denominations);
    }

    public function getLocalVersion() {
        // La VersionService est déjà une propriété de ce contrôleur
        $version = $this->versionService->getLocalVersion();
        echo json_encode(['success' => true, 'version' => $version]);
        exit;
    }

    /**
     * Récupère toutes les données nécessaires pour le tableau de bord de l'administration.
     */
    public function getDashboardData() {
        global $noms_caisses, $min_to_keep, $denominations;

        AuthController::checkAuth(); // Sécurité : vérifie que l'utilisateur est connecté

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

    /**
     * Gère les actions POST envoyées au panneau d'administration (ajout, modification, suppression).
     */
    public function index() {
        AuthController::checkAuth();
        $action = $_REQUEST['action'] ?? null;

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action) {
            switch ($action) {
                // Actions de gestion des caisses
                case 'add_caisse': $this->caisseManagementService->addCaisse($_POST['caisse_name'] ?? ''); break;
                case 'rename_caisse': $this->caisseManagementService->renameCaisse(intval($_POST['caisse_id'] ?? 0), $_POST['caisse_name'] ?? ''); break;
                case 'delete_caisse': $this->caisseManagementService->deleteCaisse(intval($_POST['caisse_id'] ?? 0)); break;
                
                // ... (ajoutez ici d'autres cas pour les autres formulaires de l'admin)
            }
            // Redirige vers la page admin dans la SPA après une action
            header('Location: /admin');
            exit;
        }

        // Si ce n'est pas une action POST, on ne fait rien (la SPA gère l'affichage)
        http_response_code(405); // Method Not Allowed
        echo json_encode(['success' => false, 'message' => 'Cette route ne supporte que les requêtes POST.']);
        exit;
    }

    // Les autres méthodes (gitReleaseCheck, etc.) restent ici pour être appelées par le routeur
    public function gitReleaseCheck($force = false) {
        // ... (code de la méthode)
    }

    // ... (autres méthodes)
}
