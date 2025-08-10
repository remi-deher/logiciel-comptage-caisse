<?php
// public/index.php

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
require_once __DIR__ . '/../src/CaisseController.php';
require_once __DIR__ . '/../src/AdminController.php';

$pdo = Bdd::getPdo();
$caisseController = new CaisseController($pdo, $noms_caisses, $denominations);
$adminController = new AdminController($pdo);

$page = $_GET['page'] ?? 'calculateur';
$action = $_REQUEST['action'] ?? null;

// --- Routes pour les actions AJAX (qui ne chargent pas de page complète) ---
// On utilise $_GET['action'] pour être spécifique aux actions AJAX passées dans l'URL
$ajax_action = $_GET['action'] ?? null;
if ($ajax_action) {
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
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save') {
            $caisseController->save();
        } else {
            $caisseController->calculateur();
        }
        break;
}

