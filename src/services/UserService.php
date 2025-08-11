<?php
// src/services/UserService.php

/**
 * Gère toutes les opérations liées aux utilisateurs administrateurs.
 */
class UserService {
    private $pdo;
    private $fallback_file;

    public function __construct($pdo) {
        $this->pdo = $pdo;
        $this->fallback_file = dirname(__DIR__, 2) . '/config/admins.php';
    }

    /**
     * Récupère et compare la liste des admins de la BDD et du fichier de secours.
     */
    public function getAdminsList() {
        $admins = [];
        $db_admins = [];
        $fallback_admins = [];

        try {
            if ($this->pdo) {
                $stmt = $this->pdo->query("SELECT username, password_hash FROM admins ORDER BY username ASC");
                $db_admins = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
            }
        } catch (\Exception $e) { /* BDD inaccessible */ }

        if (file_exists($this->fallback_file)) {
            $fallback_admins = require $this->fallback_file;
        }

        $all_usernames = array_unique(array_merge(array_keys($db_admins), array_keys($fallback_admins)));
        sort($all_usernames);

        foreach ($all_usernames as $username) {
            $in_db = isset($db_admins[$username]);
            $in_fallback = isset($fallback_admins[$username]);
            $sync_status = 'ok';

            if ($in_db && !$in_fallback) $sync_status = 'db_only';
            elseif (!$in_db && $in_fallback) $sync_status = 'fallback_only';
            elseif ($in_db && $in_fallback && $db_admins[$username] !== $fallback_admins[$username]) $sync_status = 'mismatch';

            $admins[$username] = ['in_db' => $in_db, 'in_fallback' => $in_fallback, 'sync_status' => $sync_status];
        }
        return $admins;
    }

    /**
     * Supprime un administrateur de la BDD et du fichier de secours.
     */
    public function deleteAdmin($username_to_delete) {
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

    /**
     * Met à jour le mot de passe d'un administrateur.
     */
    public function updateAdminPassword($username, $password) {
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

    /**
     * Synchronise un admin de la BDD vers le fichier de secours.
     */
    public function syncSingleAdmin($username) {
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
     * Synchronise un admin de la BDD vers le fichier de secours après une connexion réussie.
     */
    public function syncFallbackAdmin($username, $db_hash) {
        $this->updateFallbackFile($username, $db_hash);
    }

    /**
     * Met à jour le fichier de secours. Si $hash est null, l'utilisateur est supprimé.
     */
    private function updateFallbackFile($username, $hash) {
        if (!is_writable(dirname($this->fallback_file))) return;

        $fallback_admins = file_exists($this->fallback_file) ? (require $this->fallback_file) : [];

        if ($hash === null) {
            unset($fallback_admins[$username]);
        } else {
            $fallback_admins[$username] = $hash;
        }
        
        $content = "<?php\n\n// Fichier de secours pour les administrateurs\nreturn " . var_export($fallback_admins, true) . ";\n";
        file_put_contents($this->fallback_file, $content, LOCK_EX);
    }
}
