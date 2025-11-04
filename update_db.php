#!/usr/bin/env php
<?php
// update_db.php

/**
 * Script de migration de base de données en ligne de commande.
 * Compare le schema.sql avec la base de données actuelle et applique les changements.
 * Utilisation : php update_db.php
 */

// --- Initialisation ---
if (php_sapi_name() !== 'cli') {
    die("Ce script doit être exécuté en ligne de commande (CLI).\n");
}

echo "=================================================\n";
echo "=== Script de mise à jour de la base de données ===\n";
echo "=================================================\n\n";

// --- Chargement de l'environnement de l'application ---
define('ROOT_PATH', __DIR__);

if (!file_exists(ROOT_PATH . '/config/config.php')) {
    echo "\033[31m[ERREUR]\033[0m Le fichier de configuration 'config/config.php' est introuvable. Avez-vous terminé l'installation ?\n";
    exit(1);
}

// --- DÉBUT DE LA CORRECTION ---
// On charge la configuration pour définir DB_HOST, DB_NAME, etc.
require_once ROOT_PATH . '/config/config.php';
// --- FIN DE LA CORRECTION ---

// On charge les dépendances et la configuration
require_once ROOT_PATH . '/vendor/autoload.php';
require_once ROOT_PATH . '/src/Bdd.php';
require_once ROOT_PATH . '/src/services/DatabaseMigrationService.php';

// --- Exécution ---
try {
    echo "[INFO] Connexion à la base de données...\n";
    $pdo = Bdd::getPdo();
    $migrationService = new DatabaseMigrationService($pdo);

    echo "[INFO] Analyse du schéma et comparaison avec la base de données...\n";
    $sqlCommands = $migrationService->generateMigrationSql();

    if (empty($sqlCommands)) {
        echo "\033[32m[SUCCÈS]\033[0m Votre base de données est déjà à jour. Aucune action n'est requise.\n";
        exit(0);
    }

    echo "\033[33m[AVERTISSEMENT]\033[0m Des modifications ont été détectées. Les requêtes SQL suivantes vont être exécutées :\n";
    echo "-------------------------------------------------\n";
    foreach ($sqlCommands as $command) {
        echo $command . "\n\n";
    }
    echo "-------------------------------------------------\n";

    echo "Il est FORTEMENT recommandé de faire une sauvegarde de votre base de données avant de continuer.\n";
    $handle = fopen("php://stdin", "r");
    echo "Voulez-vous appliquer ces changements ? (y/n) : ";
    $confirmation = trim(fgets($handle));

    if (strtolower($confirmation) !== 'y') {
        echo "[INFO] Opération annulée par l'utilisateur.\n";
        exit(0);
    }

    echo "[INFO] Application des migrations...\n";
    $result = $migrationService->applyMigration($sqlCommands);

    if ($result['success']) {
        echo "\033[32m[SUCCÈS]\033[0m La base de données a été mise à jour avec succès.\n";
    } else {
        echo "\033[31m[ERREUR]\033[0m Une erreur est survenue lors de la migration : " . $result['error'] . "\n";
        exit(1);
    }

} catch (Exception $e) {
    echo "\033[31m[ERREUR CRITIQUE]\033[0m " . $e->getMessage() . "\n";
    exit(1);
}

exit(0);
