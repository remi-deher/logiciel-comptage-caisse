<?php
// src/AuthController.php

class AuthController {
    private $pdo;
    private $userService;

    public function __construct($pdo) {
        $this->pdo = $pdo;
        $this->userService = new UserService($pdo);
    }

    /**
     * Vérifie si un administrateur est connecté. Si non, redirige vers la page de connexion.
     * C'est une méthode statique pour être facilement appelable depuis n'importe où.
     */
    public static function checkAuth() {
        if (empty($_SESSION['is_admin'])) {
            header('Location: index.php?page=login');
            exit;
        }
    }

    /**
     * Gère l'affichage et le traitement du formulaire de connexion.
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
            
            try {
                if ($this->pdo) {
                    $stmt = $this->pdo->prepare("SELECT * FROM admins WHERE username = ?");
                    $stmt->execute([$username]);
                    $user_from_db = $stmt->fetch();

                    if ($user_from_db && password_verify($password, $user_from_db['password_hash'])) {
                        $_SESSION['is_admin'] = true;
                        $_SESSION['admin_username'] = $user_from_db['username'];
                        $this->userService->syncFallbackAdmin($username, $user_from_db['password_hash']);
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
}
