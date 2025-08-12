<?php
// Fichier : public/index.php
// CORRIGÉ : L'instanciation de CaisseController est maintenant correcte.

// On charge la configuration d'abord pour avoir accès au fuseau horaire
if (file_exists(__DIR__ . '/../config/config.php')) {
    require_once __DIR__ . '/../config/config.php';
}

// Définit le fuseau horaire pour toute l'application
date_default_timezone_set(defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Europe/Paris');

// REDIRECTION VERS L'INSTALLATEUR SI L'APPLICATION N'EST PAS CONFIGURÉE
if (!file_exists(__DIR__ . '/../config/config.php')) {
    if (is_dir(__DIR__ . '/install')) {
        header('Location: install/'); // Redirige vers le dossier d'installation
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
// On charge les contrôleurs
require_once __DIR__ . '/../src/CaisseController.php';
require_once __DIR__ . '/../src/AdminController.php';
require_once __DIR__ . '/../src/AuthController.php';


// Pour la compatibilité ascendante, on s'assure que la variable TPE existe
if (!isset($tpe_par_caisse)) {
    $tpe_par_caisse = [];
}

$pdo = Bdd::getPdo();
// CORRECTION : Le constructeur de CaisseController prend maintenant 4 arguments.
$caisseController = new CaisseController($pdo, $noms_caisses, $denominations, $tpe_par_caisse);
$adminController = new AdminController($pdo);
$authController = new AuthController($pdo);

$page = $_GET['page'] ?? 'calculateur';
$action = $_REQUEST['action'] ?? null;

// --- Routes pour les actions AJAX (qui ne chargent pas de page complète) ---
$ajax_action = $_GET['action'] ?? null;
if ($ajax_action) {
    // On désactive les erreurs PHP qui pourraient casser le JSON
    error_reporting(0);
    
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
            $caisseController->autosave();
            exit;
        case 'get_stats_data':
            // Nouvelle route pour récupérer les données de statistiques
            $caisseController->getStatsData();
            exit;
    }
}

// --- Routage principal pour l'affichage des pages ---
switch ($page) {
    case 'historique':
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete') {
            $caisseController->delete();
        } else {
            $caisseController->historique();
        }
        break;
    
    case 'aide':
        $caisseController->aide();
        break;

    case 'changelog':
        $caisseController->changelog();
        break;

    case 'statistiques':
        // Nouvelle route pour la page de statistiques
        $caisseController->statistiques();
        break;

    case 'login':
        $authController->login();
        break;
    
    case 'logout':
        $authController->logout();
        break;

    case 'admin':
        $adminController->index();
        break;
    case 'update':
        $adminController->updatePage();
        break;
    case 'calculateur':
    default:
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save') {
            $caisseController->save();
        } else {
            $caisseController->calculateur();
        }
        break;
}
