<?php
// src/AdminController.php

require_once __DIR__ . '/Utils.php';

class AdminController {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Point d'entrée de la section admin, gère les actions.
     */
    public function index() {
        $this->checkAuth();
        $action = $_REQUEST['action'] ?? null;

        // SÉCURITÉ : On ne traite les actions de modification que si elles proviennent d'un formulaire (POST)
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action) {
            switch ($action) {
                case 'update_db_config': $this->updateDbConfig(); break;
                case 'update_app_config': $this->updateAppConfig(); break;
                case 'update_tpe_config': $this->updateTpeConfig(); break;
                case 'create_backup': $this->createBackup(); break;
                case 'sync_single_admin': $this->syncSingleAdmin(); break;
                case 'delete_admin': $this->deleteAdmin(); break;
                case 'update_password': $this->updateAdminPassword(); break;
                case 'add_caisse': $this->addCaisse(); break;
                case 'rename_caisse': $this->renameCaisse(); break;
                case 'delete_caisse': $this->deleteCaisse(); break;
            }
            // On redirige après une action POST pour éviter les resoumissions au rafraîchissement
            header('Location: index.php?page=admin');
            exit;
        }

        // Pour les actions qui ne modifient rien (GET), comme le téléchargement
        if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'download_backup') {
            $this->downloadBackup();
            exit;
        }
        
        // Si aucune action n'est traitée, on affiche le tableau de bord
        $this->dashboard();
    }

    /**
     * Affiche le tableau de bord principal.
     */
    private function dashboard() {
        global $noms_caisses, $tpe_par_caisse;
        $backups = $this->getBackups();
        $admins = $this->getAdminsList();
        $caisses = $noms_caisses;
        $timezones = DateTimeZone::listIdentifiers(DateTimeZone::EUROPE);
        
        $page_css = 'admin.css';
        require __DIR__ . '/../templates/admin.php';
    }

    /**
     * Gère la connexion avec fallback et synchronisation.
     */
    public function login() {
        if (!empty($_SESSION['is_admin'])) {
            header('Location: index.php?page=admin');
            exit;
        }

        $error = null;
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $username = $_POST['username'] ?? '';
            $password = $_POST['password'] ?? '';
            $user_from_db = null;

            try {
                if ($this->pdo) {
                    $stmt = $this->pdo->prepare("SELECT * FROM admins WHERE username = ?");
                    $stmt->execute([$username]);
                    $user_from_db = $stmt->fetch();

                    if ($user_from_db && password_verify($password, $user_from_db['password_hash'])) {
                        $_SESSION['is_admin'] = true;
                        $_SESSION['admin_username'] = $user_from_db['username'];
                        $this->syncFallbackAdmin($username, $user_from_db['password_hash']);
                        header('Location: index.php?page=admin');
                        exit;
                    }
                }
            } catch (\PDOException $e) { /* BDD inaccessible */ }

            $fallback_file = __DIR__ . '/../config/admins.php';
            if (file_exists($fallback_file)) {
                $fallback_admins = require $fallback_file;
                if (isset($fallback_admins[$username]) && password_verify($password, $fallback_admins[$username])) {
                    $_SESSION['is_admin'] = true;
                    $_SESSION['admin_username'] = $username . ' (Secours)';
                    header('Location: index.php?page=admin');
                    exit;
                }
            }
            
            $error = "Identifiants incorrects.";
        }

        $body_class = 'login-page-body';
        $page_css = 'admin.css';
        require __DIR__ . '/../templates/login.php';
    }

    /**
     * Gère la déconnexion.
     */
    public function logout() {
        session_destroy();
        header('Location: index.php?page=login');
        exit;
    }

    private function updateAppConfig() {
        $new_timezone = $_POST['app_timezone'] ?? 'Europe/Paris';
        
        if (!in_array($new_timezone, DateTimeZone::listIdentifiers())) {
            $_SESSION['admin_error'] = "Fuseau horaire invalide.";
            return;
        }

        $defines = [
            'DB_HOST' => DB_HOST, 'DB_NAME' => DB_NAME, 'DB_USER' => DB_USER, 'DB_PASS' => DB_PASS,
            'GIT_REPO_URL' => GIT_REPO_URL, 'APP_TIMEZONE' => $new_timezone
        ];

        $this->updateConfigFile(['defines' => $defines]);
        $_SESSION['admin_message'] = "Configuration de l'application mise à jour.";
    }

    private function updateDbConfig() {
        $defines = [
            'DB_HOST' => $_POST['db_host'], 'DB_NAME' => $_POST['db_name'], 'DB_USER' => $_POST['db_user'],
            'DB_PASS' => $_POST['db_pass'], 'GIT_REPO_URL' => GIT_REPO_URL,
            'APP_TIMEZONE' => defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Europe/Paris'
        ];
        
        $this->updateConfigFile(['defines' => $defines]);
        $_SESSION['admin_message'] = "Configuration de la base de données mise à jour.";
    }

    private function updateTpeConfig() {
        global $noms_caisses;
        $new_tpe_config = [];
        foreach ($noms_caisses as $id => $nom) {
            $count = intval($_POST['tpe_count'][$id] ?? 0);
            $new_tpe_config[$id] = max(0, $count);
        }
        
        $this->updateConfigFile(['tpe_par_caisse' => $new_tpe_config]);
        $_SESSION['admin_message'] = "Configuration des terminaux de paiement mise à jour.";
    }
    
    private function createBackup() {
        $backupDir = __DIR__ . '/../backups';
        if (!is_dir($backupDir)) mkdir($backupDir, 0755, true);
        
        $backupFile = $backupDir . '/backup-' . date('Y-m-d-H-i-s') . '.sql.gz';
        $command = sprintf('mysqldump -h %s -u %s -p%s %s | gzip > %s',
            escapeshellarg(DB_HOST), escapeshellarg(DB_USER),
            escapeshellarg(DB_PASS), escapeshellarg(DB_NAME), escapeshellarg($backupFile)
        );

        @exec($command, $output, $return_var);

        if ($return_var === 0) {
            $_SESSION['admin_message'] = "Sauvegarde créée avec succès.";
        } else {
            $_SESSION['admin_error'] = "Erreur lors de la création de la sauvegarde.";
        }
    }

    private function getBackups() {
        $backupDir = __DIR__ . '/../backups';
        if (!is_dir($backupDir)) return [];
        
        $files = scandir($backupDir, SCANDIR_SORT_DESCENDING);
        return array_filter($files, fn($file) => pathinfo($file, PATHINFO_EXTENSION) === 'gz');
    }

    private function checkAuth() {
        if (empty($_SESSION['is_admin'])) {
            header('Location: index.php?page=login');
            exit;
        }
    }
    
    private function syncFallbackAdmin($username, $db_hash) {
        $this->updateFallbackFile($username, $db_hash);
    }

    private function getAdminsList() {
        $admins = [];
        $db_admins = [];
        $fallback_admins = [];

        try {
            if ($this->pdo) {
                $stmt = $this->pdo->query("SELECT username, password_hash FROM admins ORDER BY username ASC");
                $db_admins = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
            }
        } catch (\Exception $e) { /* BDD inaccessible */ }

        $fallback_file = __DIR__ . '/../config/admins.php';
        if (file_exists($fallback_file)) {
            $fallback_admins = require $fallback_file;
        }

        $all_usernames = array_unique(array_merge(array_keys($db_admins), array_keys($fallback_admins)));
        sort($all_usernames);

        foreach ($all_usernames as $username) {
            $in_db = isset($db_admins[$username]);
            $in_fallback = isset($fallback_admins[$username]);
            $sync_status = 'ok';

            if ($in_db && !$in_fallback) {
                $sync_status = 'db_only';
            } elseif (!$in_db && $in_fallback) {
                $sync_status = 'fallback_only';
            } elseif ($in_db && $in_fallback && $db_admins[$username] !== $fallback_admins[$username]) {
                $sync_status = 'mismatch';
            }

            $admins[$username] = [
                'in_db' => $in_db,
                'in_fallback' => $in_fallback,
                'sync_status' => $sync_status
            ];
        }
        return $admins;
    }

    private function deleteAdmin() {
        $username_to_delete = $_POST['username'] ?? '';
        $current_user = preg_replace('/ \(Secours\)$/', '', $_SESSION['admin_username']);

        if (empty($username_to_delete) || $username_to_delete === $current_user) {
            $_SESSION['admin_error'] = "Vous ne pouvez pas supprimer votre propre compte.";
            return;
        }

        try {
            if ($this->pdo) {
                $stmt = $this->pdo->prepare("DELETE FROM admins WHERE username = ?");
                $stmt->execute([$username_to_delete]);
            }
        } catch (\Exception $e) {
            $_SESSION['admin_error'] = "Erreur BDD lors de la suppression de l'admin.";
            return;
        }

        $this->updateFallbackFile($username_to_delete, null);
        $_SESSION['admin_message'] = "Administrateur '{$username_to_delete}' supprimé.";
    }

    private function updateAdminPassword() {
        $username = $_POST['username'] ?? '';
        $password = $_POST['password'] ?? '';
        if (empty($username) || empty($password)) {
            $_SESSION['admin_error'] = "Nom d'utilisateur ou mot de passe manquant.";
            return;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);

        try {
            if ($this->pdo) {
                $stmt = $this->pdo->prepare("UPDATE admins SET password_hash = ? WHERE username = ?");
                $stmt->execute([$hash, $username]);
            }
        } catch (\Exception $e) {
            $_SESSION['admin_error'] = "Erreur BDD lors de la mise à jour du mot de passe.";
            return;
        }

        $this->updateFallbackFile($username, $hash);
        $_SESSION['admin_message'] = "Mot de passe pour '{$username}' mis à jour.";
    }

    private function syncSingleAdmin() {
        $username = $_POST['username'] ?? '';
        if (empty($username)) return;

        try {
            if ($this->pdo) {
                $stmt = $this->pdo->prepare("SELECT password_hash FROM admins WHERE username = ?");
                $stmt->execute([$username]);
                $user = $stmt->fetch();
                if ($user) {
                    $this->updateFallbackFile($username, $user['password_hash']);
                    $_SESSION['admin_message'] = "Admin '{$username}' synchronisé.";
                }
            }
        } catch (\Exception $e) {
            $_SESSION['admin_error'] = "Erreur BDD lors de la synchronisation.";
        }
    }

    private function updateFallbackFile($username, $hash) {
        $fallback_file = __DIR__ . '/../config/admins.php';
        if (!is_writable(dirname($fallback_file))) return;

        $fallback_admins = file_exists($fallback_file) ? (require $fallback_file) : [];

        if ($hash === null) {
            unset($fallback_admins[$username]);
        } else {
            $fallback_admins[$username] = $hash;
        }
        
        $content = "<?php\n\n// Fichier de secours pour les administrateurs\nreturn " . var_export($fallback_admins, true) . ";\n";
        file_put_contents($fallback_file, $content, LOCK_EX);
    }
    
    private function downloadBackup() {
        $filename = basename($_GET['file'] ?? '');
        $backupDir = __DIR__ . '/../backups';
        $filePath = $backupDir . '/' . $filename;

        if (empty($filename) || !file_exists($filePath) || strpos(realpath($filePath), realpath($backupDir)) !== 0) {
            $_SESSION['admin_error'] = "Fichier de sauvegarde non valide ou introuvable.";
            header('Location: index.php?page=admin');
            exit;
        }

        header('Content-Description: File Transfer');
        header('Content-Type: application/gzip');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($filePath));
        
        ob_clean();
        flush();

        readfile($filePath);
        exit;
    }

    public function forceGitReleaseCheck() {
        $this->updateChangelogCache();
        $this->gitReleaseCheck(true);
    }

    public function gitReleaseCheck($force = false) {
        // ... (code inchangé)
    }

    private function updateChangelogCache() {
        // ... (code inchangé)
    }

    public function gitPull() {
        // ... (code inchangé)
    }

    private function addCaisse() {
        // ... (code inchangé)
    }

    private function renameCaisse() {
        // ... (code inchangé)
    }

    private function deleteCaisse() {
        // ... (code inchangé)
    }

    private function updateConfigFile($updates) {
        global $noms_caisses, $denominations, $tpe_par_caisse;
        $config_path = __DIR__ . '/../config/config.php';

        if (isset($updates['noms_caisses'])) $noms_caisses = $updates['noms_caisses'];
        if (isset($updates['tpe_par_caisse'])) $tpe_par_caisse = $updates['tpe_par_caisse'];
        
        $defines = [
            'DB_HOST' => defined('DB_HOST') ? DB_HOST : '', 'DB_NAME' => defined('DB_NAME') ? DB_NAME : '',
            'DB_USER' => defined('DB_USER') ? DB_USER : '', 'DB_PASS' => defined('DB_PASS') ? DB_PASS : '',
            'GIT_REPO_URL' => defined('GIT_REPO_URL') ? GIT_REPO_URL : '',
            'APP_TIMEZONE' => defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Europe/Paris'
        ];
        if (isset($updates['defines'])) {
            $defines = array_merge($defines, $updates['defines']);
        }

        $new_content = "<?php\n\n";
        $new_content .= "// Paramètres de connexion à la base de données\n";
        foreach (['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS'] as $def) {
            $new_content .= "define('{$def}', '" . addslashes($defines[$def]) . "');\n";
        }
        $new_content .= "\n// URL du dépôt Git pour le pied de page\n";
        $new_content .= "define('GIT_REPO_URL', '" . addslashes($defines['GIT_REPO_URL']) . "');\n\n";
        $new_content .= "// Fuseau horaire de l'application\n";
        $new_content .= "define('APP_TIMEZONE', '" . addslashes($defines['APP_TIMEZONE']) . "');\n\n";
        $new_content .= "// Configuration de l'application\n";
        $new_content .= '$noms_caisses = ' . var_export($noms_caisses, true) . ";\n";
        $new_content .= '$tpe_par_caisse = ' . var_export($tpe_par_caisse, true) . ";\n";
        $new_content .= '$denominations = ' . var_export($denominations, true) . ";\n";

        if (is_writable($config_path)) {
            file_put_contents($config_path, $new_content, LOCK_EX);
        } else {
            $_SESSION['admin_error'] = "Erreur critique : Le fichier de configuration n'est pas accessible en écriture.";
        }
    }
}
