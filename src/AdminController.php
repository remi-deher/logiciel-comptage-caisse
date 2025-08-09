<?php
// src/AdminController.php

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
                case 'create_backup': $this->createBackup(); break;
                case 'sync_single_admin': $this->syncSingleAdmin(); break;
                case 'delete_admin': $this->deleteAdmin(); break;
                case 'update_password': $this->updateAdminPassword(); break;
                case 'download_backup': $this->downloadBackup(); break;
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
        $backups = $this->getBackups();
        $admins = $this->getAdminsList();
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
     * Met à jour le fichier de configuration de la BDD.
     */
    private function updateDbConfig() {
        $config_path = __DIR__ . '/../config/config.php';
        
        $new_content = '<?php' . PHP_EOL . PHP_EOL;
        $new_content .= "// Paramètres de connexion à la base de données" . PHP_EOL;
        $new_content .= "define('DB_HOST', '" . addslashes($_POST['db_host']) . "');" . PHP_EOL;
        $new_content .= "define('DB_NAME', '" . addslashes($_POST['db_name']) . "');" . PHP_EOL;
        $new_content .= "define('DB_USER', '" . addslashes($_POST['db_user']) . "');" . PHP_EOL;
        $new_content .= "define('DB_PASS', '" . addslashes($_POST['db_pass']) . "');" . PHP_EOL . PHP_EOL;
        $new_content .= "// URL du dépôt Git pour le pied de page" . PHP_EOL;
        $new_content .= "define('GIT_REPO_URL', '" . addslashes(GIT_REPO_URL) . "');" . PHP_EOL . PHP_EOL;
        $new_content .= "// Configuration de l'application" . PHP_EOL;
        $new_content .= '$noms_caisses = ' . var_export($GLOBALS['noms_caisses'], true) . ';' . PHP_EOL;
        $new_content .= '$denominations = ' . var_export($GLOBALS['denominations'], true) . ';' . PHP_EOL;

        if (is_writable($config_path)) {
            file_put_contents($config_path, $new_content);
            $_SESSION['admin_message'] = "Configuration de la base de données mise à jour.";
        } else {
            $_SESSION['admin_error'] = "Erreur : Le fichier de configuration n'est pas accessible en écriture.";
        }
    }
    
    /**
     * Crée une sauvegarde de la base de données.
     */
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

    /**
     * Récupère la liste des sauvegardes.
     */
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

    /**
     * Vérifie si l'utilisateur est authentifié.
     */
    private function checkAuth() {
        if (empty($_SESSION['is_admin'])) {
            header('Location: index.php?page=login');
            exit;
        }
    }
    
    /**
     * Synchronise un seul admin vers le fichier de secours (après une connexion réussie).
     */
    private function syncFallbackAdmin($username, $db_hash) {
        $this->updateFallbackFile($username, $db_hash);
    }

    /**
     * Récupère et compare la liste des admins de la BDD et du fichier de secours.
     */
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

    /**
     * Met à jour le fichier de secours avec un nouvel utilisateur/hash.
     * Si $hash est null, l'utilisateur est supprimé.
     */
    private function updateFallbackFile($username, $hash) {
        $fallback_file = __DIR__ . '/../config/admins.php';
        if (!is_writable(dirname($fallback_file))) return;

        $fallback_admins = file_exists($fallback_file) ? (require $fallback_file) : [];

        if ($hash === null) {
            unset($fallback_admins[$username]); // Suppression
        } else {
            $fallback_admins[$username] = $hash; // Ajout/Mise à jour
        }
        
        $content = "<?php\n\n// Fichier de secours pour les administrateurs\nreturn " . var_export($fallback_admins, true) . ";\n";
        file_put_contents($fallback_file, $content, LOCK_EX);
    }
    
    /**
     * Gère le téléchargement d'un fichier de sauvegarde.
     */
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

    /**
     * Vérifie la version de l'application via l'API GitHub Releases.
     */
    public function gitReleaseCheck() {
        header('Content-Type: application/json');
        
        if (!function_exists('curl_init')) {
            echo json_encode(['error' => 'L\'extension PHP cURL n\'est pas installée ou activée.']);
            return;
        }

        $projectRoot = dirname(__DIR__);
        $version_file = $projectRoot . '/VERSION';

        $local_version = file_exists($version_file) ? trim(file_get_contents($version_file)) : '0.0.0';

        // Essai 1: Obtenir la dernière release officielle
        $repo_api_url_latest = 'https://api.github.com/repos/remi-deher/logiciel-comptage-caisse/releases/latest';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $repo_api_url_latest);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Comptage-Caisse-App-Updater'); 
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curl_error = curl_error($ch);
        
        $data = null;
        if ($http_code == 200) {
            $data = json_decode($response, true);
        }

        // Essai 2 (Fallback): Si /latest échoue, on prend la première de la liste
        if (!$data && !$curl_error) {
            curl_setopt($ch, CURLOPT_URL, 'https://api.github.com/repos/remi-deher/logiciel-comptage-caisse/releases');
            $response_fallback = curl_exec($ch);
            $http_code_fallback = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curl_error_fallback = curl_error($ch);

            if ($http_code_fallback == 200) {
                $releases = json_decode($response_fallback, true);
                if (!empty($releases)) {
                    $data = $releases[0]; // On prend la plus récente de la liste
                }
            }
        }
        
        curl_close($ch);

        if ($curl_error) {
            echo json_encode(['error' => 'Erreur de connexion cURL: ' . $curl_error]);
            return;
        }

        if (!$data) {
            echo json_encode(['error' => 'Impossible de récupérer les informations de release. Assurez-vous qu\'au moins une release est publiée sur GitHub. Code HTTP: ' . ($http_code_fallback ?? $http_code)]);
            return;
        }

        $remote_version = $data['tag_name'] ?? null;
        $release_notes = $data['body'] ?? 'Notes de version non disponibles.';

        if (!$remote_version) {
            echo json_encode(['error' => 'Impossible de trouver le nom de la version (tag_name) dans la réponse de l\'API.']);
            return;
        }

        $update_available = version_compare($local_version, $remote_version, '<');

        echo json_encode([
            'local_version' => $local_version,
            'remote_version' => $remote_version,
            'update_available' => $update_available,
            'release_notes' => $release_notes
        ]);
    }

    /**
     * Exécute un git pull pour mettre à jour l'application.
     */
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
}
