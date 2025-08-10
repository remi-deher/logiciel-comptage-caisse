<?php
session_start();

// On définit le chemin racine du projet pour simplifier les inclusions
define('ROOT_PATH', dirname(__DIR__, 2));

// Sécurité : Si l'application est déjà installée, on arrête tout.
if (file_exists(ROOT_PATH . '/config/config.php')) {
    // Le message de sécurité demande maintenant de supprimer le dossier
    $message = "L'application est déjà installée. Pour des raisons de sécurité, veuillez supprimer le dossier <code>public/install</code> de votre serveur.";
    echo "<div style='font-family: sans-serif; padding: 20px; background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; border-radius: 5px; margin: 20px;'>" . $message . "</div>";
    exit;
}

// On inclut le contrôleur qui contient toute la logique avec le bon chemin
require_once ROOT_PATH . '/src/InstallerController.php';

$installer = new InstallerController();
// On récupère l'étape actuelle, par défaut la première
$step = isset($_GET['step']) ? (int)$_GET['step'] : 1;
$errors = [];
$data = $_SESSION['install_data'] ?? [];

// Si le formulaire est soumis, on traite les données
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $result = $installer->handlePost($step, $_POST);
    $errors = $result['errors'];
    // S'il n'y a pas d'erreurs, on passe à l'étape suivante
    if (empty($errors)) {
        // On redirige vers le fichier index.php dans le dossier courant
        header('Location: index.php?step=' . ($step + 1));
        exit;
    }
}

// On prépare les données nécessaires pour l'affichage
$viewData = $installer->getViewData($step, $data, $errors);

// On charge le template de l'installateur avec le bon chemin
require ROOT_PATH . '/templates/installer.php';
