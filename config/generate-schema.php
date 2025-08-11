<?php
// config/generate-schema.php

/**
 * Ce script génère un fichier schema.sql complet et à jour
 * en se basant sur la configuration des caisses définie dans config.php.
 * * Utilisation (depuis la racine du projet) :
 * php config/generate-schema.php > config/schema.sql
 */

// On charge la configuration de l'application pour connaître le nombre de caisses
require_once __DIR__ . '/config.php';

// On s'assure que les variables existent
$noms_caisses = $noms_caisses ?? [1 => 'Caisse 1', 2 => 'Caisse 2'];
$denominations = $denominations ?? [];

// Début du fichier SQL
$sql = "-- Fichier généré automatiquement par generate-schema.php le " . date('Y-m-d H:i:s') . "\n";
$sql .= "-- Ne pas modifier manuellement. Exécutez le script pour mettre à jour.\n\n";

// --- Table des comptages ---
$sql .= "CREATE TABLE IF NOT EXISTS `comptages` (\n";
$sql .= "  `id` int(11) NOT NULL AUTO_INCREMENT,\n";
$sql .= "  `nom_comptage` varchar(255) NOT NULL,\n";
$sql .= "  `date_comptage` datetime NOT NULL,\n";
$sql .= "  `explication` text DEFAULT NULL,\n\n";

// Boucle pour générer les colonnes pour chaque caisse
foreach ($noms_caisses as $id => $nom) {
    $sql .= "  -- Caisse {$id} : " . htmlspecialchars($nom) . "\n";
    $sql .= "  `c{$id}_fond_de_caisse` decimal(10,2) DEFAULT 0.00,\n";
    $sql .= "  `c{$id}_ventes` decimal(10,2) DEFAULT 0.00,\n";
    $sql .= "  `c{$id}_retrocession` decimal(10,2) DEFAULT 0.00,\n";
    
    // Colonnes pour les billets
    foreach (array_keys($denominations['billets'] ?? []) as $billet) {
        $sql .= "  `c{$id}_{$billet}` int(11) DEFAULT 0,\n";
    }
    // Colonnes pour les pièces
    $pieces = array_keys($denominations['pieces'] ?? []);
    foreach ($pieces as $index => $piece) {
        $sql .= "  `c{$id}_{$piece}` int(11) DEFAULT 0" . ($index === count($pieces) - 1 ? '' : ',') . "\n";
    }
    $sql .= ",\n\n";
}

$sql .= "  PRIMARY KEY (`id`)\n";
$sql .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n";

// --- Table des administrateurs ---
$sql .= "CREATE TABLE IF NOT EXISTS `admins` (\n";
$sql .= "  `id` int(11) NOT NULL AUTO_INCREMENT,\n";
$sql .= "  `username` varchar(255) NOT NULL,\n";
$sql .= "  `password_hash` varchar(255) NOT NULL,\n";
$sql .= "  PRIMARY KEY (`id`),\n";
$sql .= "  UNIQUE KEY `username` (`username`)\n";
$sql .= ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n";

// Affiche le SQL généré
echo $sql;
