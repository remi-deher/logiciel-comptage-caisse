<?php
// Fichier : public/index.php

// On charge la configuration d'abord pour avoir accès au fuseau horaire
if (file_exists(__DIR__ . '/../config/config.php')) {
    require_once __DIR__ . '/../config/config.php';
}

// Définit le fuseau horaire pour toute l'application
date_default_timezone_set(defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Europe/Paris');

// NOUVEAU : Définit la devise pour toute l'application
$currenciesData = [];
if (file_exists(__DIR__ . '/../config/currencies.json')) {
    $currenciesData = json_decode(file_get_contents(__DIR__ . '/../config/currencies.json'), true);
}

// Lit la devise actuelle depuis la configuration ou utilise EUR par défaut
$current_currency_code = defined('APP_CURRENCY') ? APP_CURRENCY : 'EUR';
// Lit le symbole de la devise depuis les données chargées, avec un fallback si non trouvé
$current_currency_symbol = $currenciesData[$current_currency_code]['symbol'] ?? '€';

// CORRECTION : S'assure que les constantes ne sont définies qu'une seule fois
if (!defined('APP_CURRENCY')) {
    define('APP_CURRENCY', $current_currency_code);
}
if (!defined('APP_CURRENCY_SYMBOL')) {
    define('APP_CURRENCY_SYMBOL', $current_currency_symbol);
}

// REDIRECTION VERS L'INSTALLATEUR SI L'APPLICATION N'EST PAS CONFIGURÉE
if (!file_exists(__DIR__ . '/../config/config.php')) {
    if (is_dir(__DIR__ . '/install')) {
        header('Location: install/');
        exit;
    } else {
        die("Erreur Critique : Le fichier de configuration est manquant et le dossier d'installation n'a pas été trouvé.");
    }
}

session_start();
require_once __DIR__ . '/../src/Bdd.php';
require_once __DIR__ . '/../src/Utils.php';
// On charge les services AVANT les contrôleurs
require_once __DIR__ . '/../src/services/BackupService.php';
require_once __DIR__ . '/../src/services/VersionService.php';
require_once __DIR__ . '/../src/services/ConfigService.php';
require_once __DIR__ . '/../src/services/UserService.php';
require_once __DIR__ . '/../src/services/CaisseManagementService.php';
require_once __DIR__ . '/../src/services/DatabaseMigrationService.php';
require_once __DIR__ . '/../src/services/FilterService.php';
require_once __DIR__ . '/../src/services/CurrencyService.php';
// On charge les contrôleurs
require_once __DIR__ . '/../src/AdminController.php';
require_once __DIR__ . '/../src/AuthController.php';
require_once __DIR__ . '/../src/StatistiquesController.php';
require_once __DIR__ . '/../src/AideController.php';
require_once __DIR__ . '/../src/ChangelogController.php';
require_once __DIR__ . '/../src/CalculateurController.php';
require_once __DIR__ . '/../src/HistoriqueController.php';
require_once __DIR__ . '/../src/ReserveController.php';


// Pour la compatibilité ascendante, on s'assure que la variable TPE existe
if (!isset($tpe_par_caisse)) {
    $tpe_par_caisse = [];
}

$pdo = Bdd::getPdo();
$adminController = new AdminController($pdo);
$authController = new AuthController($pdo);
$statistiquesController = new StatistiquesController($pdo, $noms_caisses, $denominations);
$aideController = new AideController();
$changelogController = new ChangelogController();
$calculateurController = new CalculateurController($pdo, $noms_caisses, $denominations, $tpe_par_caisse);
$historiqueController = new HistoriqueController($pdo, $noms_caisses, $denominations, $tpe_par_caisse);
$reserveController = new ReserveController($pdo, $noms_caisses, $denominations);


$page = $_GET['page'] ?? 'calculateur';
$action = $_REQUEST['action'] ?? null;

// --- Routes pour les actions AJAX (qui ne chargent pas de page complète) ---
$ajax_action = $_GET['action'] ?? null;
if ($ajax_action) {
    // Commentez la ligne ci-dessous pendant le développement pour voir les erreurs PHP
    // error_reporting(0); 
    
    switch ($ajax_action) {
        case 'git_release_check':
            $adminController->gitReleaseCheck();
            exit;
        case 'force_git_release_check':
            $adminController->forceGitReleaseCheck();
            exit;
        case 'git_pull':
            $adminController->gitPull();
            exit;
        case 'autosave':
            $calculateurController->autosave();
            exit;
        case 'get_stats_data':
            $statistiquesController->getStatsData();
            exit;
        case 'get_historique_data':
            $historiqueController->getHistoriqueDataJson();
            exit;
        case 'delete_historique_data':
            $historiqueController->delete();
            exit;
        case 'export_csv':
            $historiqueController->exportCsv();
            exit;
        case 'cloture':
            $calculateurController->cloture();
            exit;
        case 'cloture_generale':
            $calculateurController->cloture_generale();
            exit;
        case 'get_initial_data':
            $calculateurController->getInitialData();
            exit;
        case 'get_cloture_state':
            $calculateurController->getClotureState();
            exit;
	case 'add_cb_log_entry':
   	    $calculateurController->addCBLogEntry();
    	    exit;
	case 'get_cb_log':
      	    $calculateurController->getCBLog();
    	    exit;
        
        // CORRECTION : Routes pour la Réserve plus spécifiques pour éviter les conflits
        case 'get_reserve_data':
            $reserveController->getReserveDataJson();
            exit;
        case 'submit_reserve_demande':
            $reserveController->submitDemande();
            exit;
        case 'process_reserve_demande':
            $reserveController->processDemande();
            exit;
    }
}

// --- Routage principal pour l'affichage des pages ---
switch ($page) {
    case 'historique':
        $historiqueController->historique();
        break;
    
    case 'aide':
        $aideController->index();
        break;

    case 'changelog':
        $changelogController->index();
        break;

    case 'statistiques':
        $statistiquesController->statistiques();
        break;

    case 'reserve':
        $reserveController->index();
        break;

    case 'login':
        $authController->login();
        break;
    
    case 'logout':
        $authController->logout();
        break;

    case 'admin':
        AuthController::checkAuth();
        $adminController->index();
        break;

    case 'calculateur':
    default:
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save') {
            $calculateurController->save();
        } else {
            $calculateurController->calculateur();
        }
        break;
}
