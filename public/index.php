<?php
// public/index.php
session_start();
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/Bdd.php';
require_once __DIR__ . '/../src/Utils.php';
require_once __DIR__ . '/../src/CaisseController.php';
require_once __DIR__ . '/../src/AdminController.php';

$pdo = Bdd::getPdo();
$caisseController = new CaisseController($pdo, $noms_caisses, $denominations);
$adminController = new AdminController($pdo);

$page = $_GET['page'] ?? 'calculateur';
$action = $_REQUEST['action'] ?? null;

// Routes pour la mise à jour Git
if ($action === 'git_release_check') {
    $adminController->gitReleaseCheck();
    exit;
}
if ($action === 'git_pull') {
    $adminController->gitPull();
    exit;
}

// Routage principal
switch ($page) {
    case 'historique':
        if ($action === 'delete') {
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
        $adminController->login();
        break;
    
    case 'logout':
        $adminController->logout();
        break;

    case 'admin':
        $adminController->index();
        break;

    case 'calculateur':
    default:
        if ($action === 'save') {
            $caisseController->save();
        } elseif ($action === 'autosave') {
            $caisseController->autosave();
        } else {
            $caisseController->calculateur();
        }
        break;
}
