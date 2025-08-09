<?php

// Paramètres de connexion à la base de données
define('DB_HOST', 'IP_ou_FQDN');
define('DB_NAME', 'NOM_BDD');
define('DB_USER', 'USER_BDD');
define('DB_PASS', 'MOTS_PASSE_BDD');

// URL du dépôt Git pour le pied de page
define('GIT_REPO_URL', 'https://github.com/remi-deher/logiciel-comptage-caisse');

// Configuration de l'application
$noms_caisses = [
    1 => "Caisse 1",
    2 => "Caisse 2"
];
$denominations = [
    'billets' => ['b500' => 500, 'b200' => 200, 'b100' => 100, 'b50' => 50, 'b20' => 20, 'b10' => 10, 'b5' => 5],
    'pieces'  => ['p200' => 2, 'p100' => 1, 'p050' => 0.50, 'p020' => 0.20, 'p010' => 0.10, 'p005' => 0.05, 'p002' => 0.02, 'p001' => 0.01]
];
