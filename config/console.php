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
    echo "  caisse:list           : Liste les caisses existantes.\n";
    echo "  backup:create         : Crée une nouvelle sauvegarde de la BDD.\n";
    echo "  config-db             : Modifie les informations de connexion à la base de données.\n";
    echo "\n";
}

function readInput($prompt) {
    echo $prompt . " ";
    return trim(fgets(STDIN));
}

function readPassword($prompt) {
    echo $prompt . " ";
    system('stty -echo');
    $password = trim(fgets(STDIN));
    system('stty echo');
    echo "\n";
    return $password;
}

// --- Logique principale ---

// On récupère la commande depuis les arguments
$command = $argv[1] ?? null;

if (!$command) {
    displayHelp();
    exit(0);
}

// Chargement de la configuration
@include_once __DIR__ . '/config.php';
@include_once __DIR__ . '/../src/Bdd.php';

$pdo = null;
if (defined('DB_HOST')) {
    try {
        $pdo = Bdd::getPdo();
    } catch (\Exception $e) {
        echo "Avertissement: Connexion BDD échouée. Certaines commandes peuvent ne pas fonctionner.\n";
    }
}

// Chargement des variables globales depuis config.php
global $noms_caisses;

switch ($command) {
    case 'admin:list':
        $db_admins = [];
        if ($pdo) {
            $stmt = $pdo->query("SELECT username, password_hash FROM admins");
            $db_admins = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        }
        $fallback_file = __DIR__ . '/admins.php';
        $fallback_admins = file_exists($fallback_file) ? (require $fallback_file) : [];
        $all_usernames = array_unique(array_merge(array_keys($db_admins), array_keys($fallback_admins)));
        sort($all_usernames);

        echo "--- Liste des Administrateurs ---\n";
        foreach ($all_usernames as $username) {
            $in_db = isset($db_admins[$username]);
            $in_fallback = isset($fallback_admins[$username]);
            $status = '';
            if ($in_db && $in_fallback && $db_admins[$username] !== $fallback_admins[$username]) {
                $status = '[\033[33mDésynchronisé\033[0m]';
            } elseif ($in_db && !$in_fallback) {
                $status = '[\033[36mBDD seulement\033[0m]';
            } elseif (!$in_db && $in_fallback) {
                $status = '[\033[31mSecours seulement\033[0m]';
            } else {
                $status = '[\033[32mSynchronisé\033[0m]';
            }
            echo "- " . str_pad($username, 20) . " " . $status . "\n";
        }
        break;

    case 'admin:create':
    case 'admin:update-password':
        $is_update = ($command === 'admin:update-password');
        echo "--- " . ($is_update ? "Mise à jour du mot de passe" : "Création d'un administrateur") . " ---\n";
        if (!$pdo) { echo "Erreur: Connexion à la BDD requise.\n"; exit(1); }

        $username = readInput("Nom d'utilisateur :");
        $password = readPassword("Nouveau mot de passe :");
        if (empty($username) || empty($password)) { echo "Erreur: Champs vides.\n"; exit(1); }
        $hash = password_hash($password, PASSWORD_DEFAULT);

        // BDD
        if ($is_update) {
            $stmt = $pdo->prepare("UPDATE admins SET password_hash = ? WHERE username = ?");
            $stmt->execute([$hash, $username]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)");
            $stmt->execute([$username, $hash]);
        }

        // Fichier de secours
        $fallback_file = __DIR__ . '/admins.php';
        $fallback_admins = file_exists($fallback_file) ? (require $fallback_file) : [];
        $fallback_admins[$username] = $hash;
        $content = "<?php\n\n// Fichier de secours pour les administrateurs\nreturn " . var_export($fallback_admins, true) . ";\n";
        file_put_contents($fallback_file, $content, LOCK_EX);

        echo "Succès : L'administrateur '{$username}' a été " . ($is_update ? "mis à jour" : "créé") . ".\n";
        break;

    case 'admin:delete':
        echo "--- Suppression d'un administrateur ---\n";
        $username = readInput("Nom d'utilisateur à supprimer :");
        if (empty($username)) { echo "Opération annulée.\n"; exit(1); }

        // BDD
        if ($pdo) {
            $stmt = $pdo->prepare("DELETE FROM admins WHERE username = ?");
            $stmt->execute([$username]);
        }

        // Fichier de secours
        $fallback_file = __DIR__ . '/admins.php';
        if (file_exists($fallback_file)) {
            $fallback_admins = require $fallback_file;
            unset($fallback_admins[$username]);
            $content = "<?php\n\n// Fichier de secours pour les administrateurs\nreturn " . var_export($fallback_admins, true) . ";\n";
            file_put_contents($fallback_file, $content, LOCK_EX);
        }
        echo "Succès : L'administrateur '{$username}' a été supprimé.\n";
        break;

    case 'admin:sync':
        echo "--- Synchronisation des administrateurs de secours ---\n";
        if (!$pdo) { echo "Erreur: Connexion à la BDD requise.\n"; exit(1); }
        $stmt = $pdo->query("SELECT username, password_hash FROM admins");
        $db_admins = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        $fallback_file = __DIR__ . '/admins.php';
        $content = "<?php\n\n// Fichier de secours pour les administrateurs\nreturn " . var_export($db_admins, true) . ";\n";
        file_put_contents($fallback_file, $content, LOCK_EX);
        echo "Succès : Le fichier de secours a été synchronisé depuis la BDD.\n";
        break;
    
    case 'caisse:list':
        echo "--- Liste des Caisses ---\n";
        if (empty($noms_caisses)) {
            echo "Aucune caisse configurée.\n";
        } else {
            foreach ($noms_caisses as $id => $nom) {
                echo "- ID: {$id}, Nom: {$nom}\n";
            }
        }
        break;

    case 'caisse:add':
    case 'caisse:rename':
    case 'caisse:delete':
        echo "Cette fonctionnalité est complexe et potentiellement dangereuse en console.\n";
        echo "Veuillez utiliser le panneau d'administration web pour gérer les caisses en toute sécurité.\n";
        break;

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

    case 'config-db':
        echo "--- Configuration de la base de données ---\n";
        $config_path = __DIR__ . '/config.php';

        $current_host = defined('DB_HOST') ? DB_HOST : '127.0.0.1';
        $current_name = defined('DB_NAME') ? DB_NAME : 'comptabilite';
        $current_user = defined('DB_USER') ? DB_USER : 'root';
        $current_pass = defined('DB_PASS') ? DB_PASS : '';
        $current_repo = defined('GIT_REPO_URL') ? GIT_REPO_URL : 'https://github.com/remi-deher/logiciel-comptage-caisse-php';

        $new_host = readInput("Hôte de la BDD [{$current_host}]:") ?: $current_host;
        $new_name = readInput("Nom de la BDD [{$current_name}]:") ?: $current_name;
        $new_user = readInput("Utilisateur de la BDD [{$current_user}]:") ?: $current_user;
        $new_pass = readInput("Mot de passe de la BDD [actuel: ****]:") ?: $current_pass;

        $new_content = '<?php' . PHP_EOL . PHP_EOL;
        $new_content .= "// Paramètres de connexion à la base de données" . PHP_EOL;
        $new_content .= "define('DB_HOST', '" . addslashes($new_host) . "');" . PHP_EOL;
        $new_content .= "define('DB_NAME', '" . addslashes($new_name) . "');" . PHP_EOL;
        $new_content .= "define('DB_USER', '" . addslashes($new_user) . "');" . PHP_EOL;
        $new_content .= "define('DB_PASS', '" . addslashes($new_pass) . "');" . PHP_EOL . PHP_EOL;
        $new_content .= "// URL du dépôt Git pour le pied de page" . PHP_EOL;
        $new_content .= "define('GIT_REPO_URL', '" . addslashes($current_repo) . "');" . PHP_EOL . PHP_EOL;
        $new_content .= "// Configuration de l'application" . PHP_EOL;
        $new_content .= '$noms_caisses = [' . PHP_EOL;
        $new_content .= '    1 => "Caisse centre ville",' . PHP_EOL;
        $new_content .= '    2 => "Caisse officine"' . PHP_EOL;
        $new_content .= '];' . PHP_EOL;
        $new_content .= '$denominations = [' . PHP_EOL;
        $new_content .= '    \'billets\' => [\'b500\' => 500, \'b200\' => 200, \'b100\' => 100, \'b50\' => 50, \'b20\' => 20, \'b10\' => 10, \'b5\' => 5],' . PHP_EOL;
        $new_content .= '    \'pieces\'  => [\'p200\' => 2, \'p100\' => 1, \'p050\' => 0.50, \'p020\' => 0.20, \'p010\' => 0.10, \'p005\' => 0.05, \'p002\' => 0.02, \'p001\' => 0.01]' . PHP_EOL;
        $new_content .= '];' . PHP_EOL;

        if (is_writable($config_path)) {
            file_put_contents($config_path, $new_content);
            echo "Succès : Le fichier de configuration a été mis à jour.\n";
        } else {
            echo "Erreur : Le fichier 'config.php' n'est pas accessible en écriture.\n";
            exit(1);
        }
        break;

    default:
        echo "Commande '{$command}' non reconnue.\n\n";
        displayHelp();
        exit(1);
}

exit(0);
