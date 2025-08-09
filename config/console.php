#!/usr/bin/env php
<?php
// console.php
// Ce script doit être placé dans le dossier /config/

// Sécurité : S'assurer que le script est bien exécuté en ligne de commande (CLI)
if (php_sapi_name() !== 'cli') {
    die("Ce script ne peut être exécuté qu'en ligne de commande.\n");
}

// --- Fonctions d'aide ---
function displayHelp() {
    echo "Console de gestion de l'application de comptage de caisse.\n\n";
    echo "Usage:\n";
    echo "  php config/console.php <commande>\n\n";
    echo "Commandes disponibles:\n";
    echo "  admin:list            : Liste tous les administrateurs (BDD et secours).\n";
    echo "  admin:create          : Crée un nouvel admin dans la BDD et le fichier de secours.\n";
    echo "  admin:update-password : Met à jour le mot de passe d'un admin.\n";
    echo "  admin:delete          : Supprime un administrateur.\n";
    echo "  admin:sync            : Synchronise le fichier de secours depuis la BDD.\n";
    echo "  backup:create         : Crée une nouvelle sauvegarde de la base de données.\n";
    echo "  config-db             : Modifie les informations de connexion à la base de données.\n";
    echo "\n";
}
function readInput($prompt) { echo $prompt . " "; return trim(fgets(STDIN)); }
function readPassword($prompt) {
    echo $prompt . " ";
    system('stty -echo');
    $password = trim(fgets(STDIN));
    system('stty echo');
    echo "\n";
    return $password;
}

// --- Logique principale ---
$command = $argv[1] ?? null;
if (!$command) { displayHelp(); exit(0); }

@include_once __DIR__ . '/config.php';
@include_once __DIR__ . '/../src/Bdd.php';

$pdo = null;
if (defined('DB_HOST')) {
    try { $pdo = Bdd::getPdo(); } catch (\Exception $e) { echo "Avertissement: Connexion BDD échouée. Certaines commandes peuvent ne pas fonctionner.\n"; }
}

switch ($command) {
    // ... (cas admin:*)

    case 'backup:create':
        echo "--- Création d'une sauvegarde de la base de données ---\n";
        if (!defined('DB_HOST')) {
            echo "Erreur : La configuration de la base de données est manquante.\n";
            exit(1);
        }
        $backupDir = __DIR__ . '/../backups';
        if (!is_dir($backupDir)) {
            if (!@mkdir($backupDir, 0755, true)) {
                echo "Erreur critique : Impossible de créer le dossier de sauvegardes.\n";
                exit(1);
            }
        }
        if (!is_writable($backupDir)) {
            echo "Erreur de permission : Le dossier 'backups' n'est pas accessible en écriture.\n";
            exit(1);
        }
        $mysqldump_path = trim(shell_exec('which mysqldump'));
        if (empty($mysqldump_path)) {
            echo "Erreur de configuration : La commande 'mysqldump' est introuvable.\n";
            exit(1);
        }
        $backupFile = $backupDir . '/backup-' . date('Y-m-d-H-i-s') . '.sql.gz';
        $command_exec = sprintf(
            '%s -h %s -u %s -p%s %s | gzip > %s 2>&1',
            escapeshellcmd($mysqldump_path),
            escapeshellarg(DB_HOST),
            escapeshellarg(DB_USER),
            escapeshellarg(DB_PASS),
            escapeshellarg(DB_NAME),
            escapeshellarg($backupFile)
        );
        exec($command_exec, $output, $return_var);
        if ($return_var === 0) {
            echo "Succès : Sauvegarde créée dans " . realpath($backupFile) . "\n";
        } else {
            echo "Échec de la création de la sauvegarde.\n";
            echo "Raison : " . implode("\n", $output) . "\n";
            exit(1);
        }
        break;
    
    // ... (cas config-db)

    default:
        echo "Commande '{$command}' non reconnue.\n\n";
        displayHelp();
        exit(1);
}

exit(0);
