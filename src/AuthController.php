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
     * Vérifie si un administrateur est connecté. Si non, renvoie une erreur 401.
     * C'est une méthode statique pour être facilement appelable depuis n'importe où.
     */
    public static function checkAuth() {
        if (empty($_SESSION['is_admin'])) {
            // On ne redirige plus. On envoie une réponse d'erreur que le JS va intercepter.
            header('Content-Type: application/json');
            http_response_code(401); // 401 Unauthorized
            echo json_encode([
                'success' => false, 
                'message' => 'Accès non autorisé. Session invalide ou expirée.'
            ]);
            exit;
        }
    }

    /**
     * Gère l'affichage et le traitement du formulaire de connexion.
     */
    public function login() {
        if (!empty($_SESSION['is_admin'])) {
            // Si déjà connecté, on le signale au client
            echo json_encode(['success' => true, 'message' => 'Déjà authentifié.']);
            exit;
        }

        $error = null;
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $username = $_POST['username'] ?? '';
            $password = $_POST['password'] ?? '';
            
            $user_verified = false;

            try {
                if ($this->pdo) {
                    $stmt = $this->pdo->prepare("SELECT * FROM admins WHERE username = ?");
                    $stmt->execute([$username]);
                    $user_from_db = $stmt->fetch();

                    if ($user_from_db && password_verify($password, $user_from_db['password_hash'])) {
                        $_SESSION['is_admin'] = true;
                        $_SESSION['admin_username'] = $user_from_db['username'];
                        $this->userService->syncFallbackAdmin($username, $user_from_db['password_hash']);
                        $user_verified = true;
                    }
                }
            } catch (\PDOException $e) { /* BDD inaccessible, on passe au secours */ }

            if (!$user_verified) {
                $fallback_file = __DIR__ . '/../config/admins.php';
                if (file_exists($fallback_file)) {
                    $fallback_admins = require $fallback_file;
                    if (isset($fallback_admins[$username]) && password_verify($password, $fallback_admins[$username])) {
                        $_SESSION['is_admin'] = true;
                        $_SESSION['admin_username'] = $username . ' (Secours)';
                        $user_verified = true;
                    }
                }
            }
            
            if ($user_verified) {
                echo json_encode(['success' => true, 'message' => 'Connexion réussie.']);
            } else {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Identifiants incorrects.']);
            }
            exit;
        }
    }

    /**
     * Renvoie le statut d'authentification actuel de l'utilisateur.
     */
    public function status() {
        header('Content-Type: application/json');
        if (!empty($_SESSION['is_admin'])) {
            echo json_encode([
                'isLoggedIn' => true,
                'username' => $_SESSION['admin_username'] ?? 'Admin'
            ]);
        } else {
            echo json_encode(['isLoggedIn' => false]);
        }
        exit;
    }

    /**
     * Gère la déconnexion.
     */
    public function logout() {
        session_destroy();
        echo json_encode(['success' => true, 'message' => 'Déconnexion réussie.']);
        exit;
    }
}
