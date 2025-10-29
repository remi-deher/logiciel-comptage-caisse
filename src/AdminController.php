<?php
// src/AdminController.php

require_once __DIR__ . '/Utils.php';
require_once __DIR__ . '/services/CurrencyService.php';
require_once __DIR__ . '/services/TerminalManagementService.php';
require_once __DIR__ . '/services/ReserveService.php';
require_once __DIR__ . '/services/DatabaseMigrationService.php';
require_once __DIR__ . '/services/UserService.php';
require_once __DIR__ . '/services/CaisseManagementService.php';
require_once __DIR__ . '/services/VersionService.php'; // Ajouté si manquant
require_once __DIR__ . '/services/ConfigService.php'; // Ajouté si manquant
require_once __DIR__ . '/services/BackupService.php'; // Ajouté si manquant
require_once __DIR__ . '/AuthController.php'; // Ajouté si manquant


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
        // SUPPRIMER $target_fonds_de_caisse de la ligne global
        global $noms_caisses, $denominations, $min_to_keep;
        AuthController::checkAuth();
        if (!defined('PHPUNIT_RUNNING')) { header('Content-Type: application/json'); }

        // Récupérer les caisses AVEC leur fond cible
        $stmt_caisses = $this->pdo->query("SELECT id, nom_caisse, fond_cible FROM caisses ORDER BY id ASC");
        $caisses_db = $stmt_caisses->fetchAll(PDO::FETCH_ASSOC);

        // Transformer pour correspondre à l'ancien format attendu par le JS (si nécessaire)
        $noms_caisses_output = [];
        foreach ($caisses_db as $caisse) {
            $noms_caisses_output[$caisse['id']] = $caisse['nom_caisse'];
        }

        $stmt_term = $this->pdo->query("SELECT * FROM terminaux_paiement ORDER BY nom_terminal ASC");
        $terminaux = $stmt_term->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'caisses' => $noms_caisses_output, // Garder pour compatibilité éventuelle
            'caisses_details' => $caisses_db, // NOUVEAU : Envoyer les détails complets
            'admins' => $this->userService->getAdminsList(),
            'terminaux' => $terminaux,
            'backups' => $this->backupService->getBackups(),
            'reserve_status' => $this->reserveService->getReserveStatus(),
            'denominations' => $denominations,
            'min_to_keep' => $min_to_keep ?? [],
            'currencySymbol' => defined('APP_CURRENCY_SYMBOL') ? APP_CURRENCY_SYMBOL : '€'
            // Pas besoin d'envoyer target_fonds_de_caisse ici car inclus dans caisses_details
        ]);
        exit;
    }

    public function index() {
        AuthController::checkAuth();
        $action = $_REQUEST['action'] ?? null;

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action) {
            switch ($action) {
                case 'add_caisse':
                    $this->caisseManagementService->addCaisse($_POST['caisse_name'] ?? '');
                    break;
                // MODIFIER CETTE ACTION
                case 'rename_caisse':
                    $caisse_id = intval($_POST['caisse_id'] ?? 0);
                    $new_name = $_POST['caisse_name'] ?? '';
                    // Récupérer aussi la valeur du fond cible depuis le formulaire
                    $fond_cible_value = $_POST['fond_cible'] ?? null;

                    // Valider et formater le fond cible
                    $fond_cible_to_update = null;
                    if ($fond_cible_value !== null) {
                        $floatVal = floatval(str_replace(',', '.', $fond_cible_value));
                        if (is_numeric($floatVal) && $floatVal >= 0) {
                            $fond_cible_to_update = number_format($floatVal, 2, '.', '');
                        } else {
                             $_SESSION['admin_error'] = "Le montant du fond cible pour la caisse ID {$caisse_id} est invalide.";
                             // On ne bloque pas forcément le renommage pour une erreur de fond cible
                        }
                    }

                    // Appeler une méthode de service mise à jour (ou faire la logique ici)
                    if ($caisse_id > 0 && !empty($new_name)) {
                        try {
                            $sql = "UPDATE caisses SET nom_caisse = ?";
                            $params = [$new_name];
                            if ($fond_cible_to_update !== null) {
                                $sql .= ", fond_cible = ?";
                                $params[] = $fond_cible_to_update;
                            }
                            $sql .= " WHERE id = ?";
                            $params[] = $caisse_id;

                            $stmt = $this->pdo->prepare($sql);
                            $stmt->execute($params);

                            // Mettre à jour la variable globale $noms_caisses pour le fichier config
                            global $noms_caisses;
                            $noms_caisses[$caisse_id] = $new_name;
                            $this->configService->updateConfigFile(['noms_caisses' => $noms_caisses]);

                            $_SESSION['admin_message'] = "Caisse '{$new_name}' mise à jour.";

                        } catch (\Exception $e) {
                             $_SESSION['admin_error'] = "Erreur BDD lors de la mise à jour de la caisse : " . $e->getMessage();
                        }
                    } else {
                         $_SESSION['admin_error'] = "Données invalides pour la mise à jour de la caisse.";
                    }
                    break;
                case 'delete_caisse':
                     $this->caisseManagementService->deleteCaisse(intval($_POST['caisse_id'] ?? 0));
                     break;
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
                // SUPPRIMER CE CASE
                /*
                case 'update_target_fonds':
                    // ...
                    break;
                */
                case 'add_terminal':
                    $this->terminalManagementService->addTerminal($_POST['terminal_name'] ?? '', intval($_POST['caisse_id'] ?? 0));
                    break;
                case 'rename_terminal':
                    $this->terminalManagementService->renameTerminal(intval($_POST['terminal_id'] ?? 0), $_POST['terminal_name'] ?? '', intval($_POST['caisse_id'] ?? 0));
                    break;
                case 'delete_terminal':
                    $this->terminalManagementService->deleteTerminal(intval($_POST['terminal_id'] ?? 0));
                    break;
                // Ajoutez d'autres actions ici si nécessaire
            }
            if (!defined('PHPUNIT_RUNNING')) { header('Location: /admin'); } // Redirection après action POST
            exit;
        }

        // Si ce n'est pas une requête POST valide
        if (!defined('PHPUNIT_RUNNING')) { http_response_code(405); } // Method Not Allowed
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

        // Vider le cache de la release après mise à jour
        $cacheFile = dirname(__DIR__, 2) . '/cache/github_release.json';
        if (file_exists($cacheFile)) {
             @unlink($cacheFile);
        }

        echo json_encode(['success' => true, 'message' => implode("\n", $output)]);
        exit;
    }

    public function performMigration() {
        $sqlCommands = $this->databaseMigrationService->generateMigrationSql();
        if (empty($sqlCommands)) {
             return ['success' => true, 'message' => '-> Base de données déjà à jour.'];
        }
        if (isset($sqlCommands['error'])) {
            return ['success' => false, 'message' => '-> Erreur génération SQL: ' . $sqlCommands['error']];
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
        // Ajout de 'git reset --hard HEAD' pour forcer l'écrasement des fichiers locaux modifiés
        // Ajout de 'git clean -fd' pour supprimer les fichiers non suivis
        $command = 'cd ' . escapeshellarg($repo_path) . ' && git fetch origin && git reset --hard HEAD && git clean -fd && git pull 2>&1';
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
