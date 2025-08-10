<?php
// src/AdminController.php

// On s'assure que les fonctions utilitaires sont disponibles
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

        if ($action) {
            switch ($action) {
                case 'update_db_config': $this->updateDbConfig(); break;
                case 'update_app_config': $this->updateAppConfig(); break;
                case 'create_backup': $this->createBackup(); break;
                case 'sync_single_admin': $this->syncSingleAdmin(); break;
                case 'delete_admin': $this->deleteAdmin(); break;
                case 'update_password': $this->updateAdminPassword(); break;
                case 'download_backup': $this->downloadBackup(); break;
                case 'add_caisse': $this->addCaisse(); break;
                case 'rename_caisse': $this->renameCaisse(); break;
                case 'delete_caisse': $this->deleteCaisse(); break;
            }
            header('Location: index.php?page=admin');
            exit;
        }
        
        $this->dashboard();
    }

    /**
     * Affiche le tableau de bord principal.
     */
    private function dashboard() {
        global $noms_caisses;
        $backups = $this->getBackups();
        $admins = $this->getAdminsList();
        $caisses = $noms_caisses;
        // On récupère la liste des fuseaux horaires pour la vue
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

    /**
     * Met à jour le fichier de configuration de l'application (fuseau horaire).
     */
    private function updateAppConfig() {
        $new_timezone = $_POST['app_timezone'] ?? 'Europe/Paris';
        
        if (!in_array($new_timezone, DateTimeZone::listIdentifiers())) {
            $_SESSION['admin_error'] = "Fuseau horaire invalide.";
            return;
        }

        $defines = [
            'DB_HOST' => DB_HOST,
            'DB_NAME' => DB_NAME,
            'DB_USER' => DB_USER,
            'DB_PASS' => DB_PASS,
            'GIT_REPO_URL' => GIT_REPO_URL,
            'APP_TIMEZONE' => $new_timezone
        ];

        $this->updateConfigFile($defines);
        $_SESSION['admin_message'] = "Configuration de l'application mise à jour.";
    }

    /**
     * Met à jour le fichier de configuration de la BDD.
     */
    private function updateDbConfig() {
        $defines = [
            'DB_HOST' => $_POST['db_host'],
            'DB_NAME' => $_POST['db_name'],
            'DB_USER' => $_POST['db_user'],
            'DB_PASS' => $_POST['db_pass'],
            'GIT_REPO_URL' => GIT_REPO_URL,
            'APP_TIMEZONE' => defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Europe/Paris'
        ];
        
        $this->updateConfigFile($defines);
        $_SESSION['admin_message'] = "Configuration de la base de données mise à jour.";
    }
    
    private function createBackup() {
        $backupDir = __DIR__ . '/../backups';
        if (!is_dir($backupDir)) {
            mkdir($backupDir, 0755, true);
        }
        
        $backupFile = $backupDir . '/backup-' . date('Y-m-d-H-i-s') . '.sql.gz';
        $command = sprintf(
            'mysqldump -h %s -u %s -p%s %s | gzip > %s',
            escapeshellarg(DB_HOST),
            escapeshellarg(DB_USER),
            escapeshellarg(DB_PASS),
            escapeshellarg(DB_NAME),
            escapeshellarg($backupFile)
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
        $backups = [];
        foreach($files as $file) {
            if (pathinfo($file, PATHINFO_EXTENSION) === 'gz') {
                $backups[] = $file;
            }
        }
        return $backups;
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
        $this->gitReleaseCheck(true);
    }

    public function gitReleaseCheck($force = false) {
        header('Content-Type: application/json');
        
        $cacheDir = __DIR__ . '/../cache';
        if (!is_dir($cacheDir) && !@mkdir($cacheDir, 0755, true)) {
             echo json_encode(['error' => "Le dossier de cache est manquant et ne peut pas être créé."]);
             return;
        }
        $cacheFile = $cacheDir . '/github_release.json';
        $cacheLifetime = 3600;

        $projectRoot = dirname(__DIR__);
        $version_file = $projectRoot . '/VERSION';
        $local_version = file_exists($version_file) ? trim(file_get_contents($version_file)) : '0.0.0';

        if ($force === false && file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheLifetime)) {
            $cachedData = json_decode(file_get_contents($cacheFile), true);
            $remote_version = $cachedData['remote_version'] ?? $local_version;
            $update_available = version_compare($local_version, $remote_version, '<');
            $responseData = [
                'local_version' => $local_version,
                'remote_version' => $remote_version,
                'update_available' => $update_available,
                'release_notes' => $cachedData['release_notes'] ?? 'Notes de version non disponibles.',
                'release_url' => $cachedData['release_url'] ?? '#',
                'formatted_release_date' => $cachedData['formatted_release_date'] ?? 'N/A'
            ];
            echo json_encode($responseData);
            return;
        }

        $fallbackResponse = [
            'local_version' => $local_version,
            'remote_version' => $local_version,
            'update_available' => false,
            'release_notes' => 'Impossible de vérifier les mises à jour pour le moment.',
            'release_url' => '#',
            'formatted_release_date' => 'N/A',
            'error' => 'API indisponible'
        ];

        if (!function_exists('curl_init')) {
            file_put_contents($cacheFile, json_encode($fallbackResponse), LOCK_EX);
            echo json_encode($fallbackResponse);
            return;
        }

        $repo_api_url = 'https://api.github.com/repos/remi-deher/logiciel-comptage-caisse/releases/latest';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $repo_api_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Comptage-Caisse-App-Updater'); 
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http_code != 200) {
            file_put_contents($cacheFile, json_encode($fallbackResponse), LOCK_EX);
            echo json_encode($fallbackResponse);
            return;
        }
        
        $data = json_decode($response, true);
        $remote_version = $data['tag_name'] ?? null;
        $release_notes = $data['body'] ?? 'Notes de version non disponibles.';
        $published_at = $data['published_at'] ?? null;
        $release_url = $data['html_url'] ?? '#';
        $formatted_date = $published_at ? format_date_fr($published_at) : 'N/A';

        if (!$remote_version) {
            file_put_contents($cacheFile, json_encode($fallbackResponse), LOCK_EX);
            echo json_encode($fallbackResponse);
            return;
        }

        $update_available = version_compare($local_version, $remote_version, '<');

        $responseData = [
            'local_version' => $local_version,
            'remote_version' => $remote_version,
            'update_available' => $update_available,
            'release_notes' => $release_notes,
            'release_url' => $release_url,
            'formatted_release_date' => $formatted_date
        ];

        file_put_contents($cacheFile, json_encode($responseData), LOCK_EX);
        echo json_encode($responseData);
    }

    public function gitPull() {
        header('Content-Type: application/json');
        $projectRoot = dirname(__DIR__);
        
        $output = shell_exec("cd {$projectRoot} && git pull 2>&1");

        echo json_encode([
            'success' => true,
            'message' => "Mise à jour terminée.",
            'output' => $output
        ]);
    }

    private function addCaisse() {
        global $noms_caisses, $denominations;
        $new_name = trim($_POST['caisse_name'] ?? '');
        if (empty($new_name)) {
            $_SESSION['admin_error'] = "Le nom de la nouvelle caisse ne peut pas être vide.";
            return;
        }

        try {
            $stmt = $this->pdo->query("SHOW COLUMNS FROM comptages");
            $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            $existing_ids = [0];
            foreach ($columns as $column) {
                if (preg_match('/^c(\d+)_/', $column, $matches)) {
                    $existing_ids[] = (int)$matches[1];
                }
            }
            $new_id = max($existing_ids) + 1;

        } catch (\Exception $e) {
            $_SESSION['admin_error'] = "Erreur BDD lors de la vérification de la structure : " . $e->getMessage();
            return;
        }

        try {
            $cols_to_add = [];
            $cols_to_add[] = "c{$new_id}_fond_de_caisse DECIMAL(10, 2) DEFAULT 0";
            $cols_to_add[] = "c{$new_id}_ventes DECIMAL(10, 2) DEFAULT 0";
            $cols_to_add[] = "c{$new_id}_retrocession DECIMAL(10, 2) DEFAULT 0";
            foreach ($denominations as $list) {
                foreach (array_keys($list) as $name) {
                    $cols_to_add[] = "c{$new_id}_{$name} INT DEFAULT 0";
                }
            }
            foreach($cols_to_add as $col) {
                $this->pdo->exec("ALTER TABLE comptages ADD COLUMN {$col}");
            }
        } catch (\Exception $e) {
            $_SESSION['admin_error'] = "Erreur BDD lors de l'ajout de la caisse : " . $e->getMessage();
            return;
        }

        $noms_caisses[$new_id] = $new_name;
        $this->updateConfigFile(['noms_caisses' => $noms_caisses]);
        $_SESSION['admin_message'] = "Caisse '{$new_name}' (ID: {$new_id}) ajoutée avec succès.";
    }

    private function renameCaisse() {
        global $noms_caisses;
        $id = intval($_POST['caisse_id'] ?? 0);
        $new_name = trim($_POST['caisse_name'] ?? '');

        if ($id > 0 && !empty($new_name) && isset($noms_caisses[$id])) {
            $noms_caisses[$id] = $new_name;
            $this->updateConfigFile(['noms_caisses' => $noms_caisses]);
            $_SESSION['admin_message'] = "Caisse renommée avec succès.";
        } else {
            $_SESSION['admin_error'] = "Données invalides pour le renommage.";
        }
    }

    private function deleteCaisse() {
        global $noms_caisses, $denominations;
        $id = intval($_POST['caisse_id'] ?? 0);

        if ($id > 0 && isset($noms_caisses[$id])) {
            try {
                $cols_to_drop = [];
                $cols_to_drop[] = "c{$id}_fond_de_caisse";
                $cols_to_drop[] = "c{$id}_ventes";
                $cols_to_drop[] = "c{$id}_retrocession";
                foreach ($denominations as $list) {
                    foreach (array_keys($list) as $name) {
                        $cols_to_drop[] = "c{$id}_{$name}";
                    }
                }
                $sql = "ALTER TABLE comptages DROP COLUMN " . implode(', DROP COLUMN ', $cols_to_drop);
                $this->pdo->exec($sql);
            } catch (\Exception $e) {
                $_SESSION['admin_error'] = "Erreur BDD lors de la suppression de la caisse : " . $e->getMessage();
                return;
            }

            $deleted_name = $noms_caisses[$id];
            unset($noms_caisses[$id]);
            $this->updateConfigFile(['noms_caisses' => $noms_caisses]);
            $_SESSION['admin_message'] = "Caisse '{$deleted_name}' et toutes ses données ont été supprimées.";
        } else {
            $_SESSION['admin_error'] = "ID de caisse invalide pour la suppression.";
        }
    }

    private function updateConfigFile($defines) {
        global $noms_caisses, $denominations;
        $config_path = __DIR__ . '/../config/config.php';

        if (isset($updates['noms_caisses'])) $noms_caisses = $updates['noms_caisses'];

        $new_content = "<?php\n\n";
        $new_content .= "// Paramètres de connexion à la base de données\n";
        $new_content .= "define('DB_HOST', '" . addslashes($defines['DB_HOST']) . "');\n";
        $new_content .= "define('DB_NAME', '" . addslashes($defines['DB_NAME']) . "');\n";
        $new_content .= "define('DB_USER', '" . addslashes($defines['DB_USER']) . "');\n";
        $new_content .= "define('DB_PASS', '" . addslashes($defines['DB_PASS']) . "');\n\n";
        $new_content .= "// URL du dépôt Git pour le pied de page\n";
        $new_content .= "define('GIT_REPO_URL', '" . addslashes($defines['GIT_REPO_URL']) . "');\n\n";
        $new_content .= "// Fuseau horaire de l'application\n";
        $new_content .= "define('APP_TIMEZONE', '" . addslashes($defines['APP_TIMEZONE']) . "');\n\n";
        $new_content .= "// Configuration de l'application\n";
        $new_content .= '$noms_caisses = ' . var_export($noms_caisses, true) . ";\n";
        $new_content .= '$denominations = ' . var_export($denominations, true) . ";\n";

        if (is_writable($config_path)) {
            file_put_contents($config_path, $new_content, LOCK_EX);
        } else {
            $_SESSION['admin_error'] = "Erreur critique : Le fichier de configuration n'est pas accessible en écriture.";
        }
    }
}
