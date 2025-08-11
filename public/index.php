<?php
// public/index.php

if (file_exists(__DIR__ . '/../config/config.php')) {
    require_once __DIR__ . '/../config/config.php';
}

date_default_timezone_set(defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Europe/Paris');

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
// On charge les services
require_once __DIR__ . '/../src/services/BackupService.php';
require_once __DIR__ . '/../src/services/VersionService.php';
require_once __DIR__ . '/../src/services/ConfigService.php';
require_once __DIR__ . '/../src/services/UserService.php';
require_once __DIR__ . '/../src/services/CaisseManagementService.php'; // On ajoute le nouveau service
// On charge les contrôleurs
require_once __DIR__ . '/../src/CaisseController.php';
require_once __DIR__ . '/../src/AdminController.php';
require_once __DIR__ . '/../src/AuthController.php';

$noms_caisses = $noms_caisses ?? [];
$denominations = $denominations ?? [];
$tpe_par_caisse = $tpe_par_caisse ?? [];

$pdo = Bdd::getPdo();
$caisseController = new CaisseController($pdo, $noms_caisses, $denominations);
$adminController = new AdminController($pdo);
$authController = new AuthController($pdo);

$page = $_GET['page'] ?? 'calculateur';
$action = $_REQUEST['action'] ?? null;

$ajax_action = $_GET['action'] ?? null;
if ($ajax_action) {
    error_reporting(0);
    
    switch ($ajax_action) {
        case 'git_release_check': $adminController->gitReleaseCheck(); exit;
        case 'force_git_release_check': $adminController->forceGitReleaseCheck(); exit;
        case 'git_pull': $adminController->gitPull(); exit;
        case 'autosave': $caisseController->autosave(); exit;
    }
}

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

    case 'login':
        $authController->login();
        break;
    
    case 'logout':
        $authController->logout();
        break;

    case 'admin':
        $adminController->index();
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
