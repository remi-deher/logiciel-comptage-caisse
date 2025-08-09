<?php
// src/AdminController.php

class AdminController {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function index() {
        $this->checkAuth();
        $action = $_REQUEST['action'] ?? null;

        if ($action) {
            // ... (switch case pour les actions)
            header('Location: index.php?page=admin');
            exit;
        }
        
        $this->dashboard();
    }

    private function dashboard() {
        $backups = $this->getBackups();
        $admins = $this->getAdminsList();
        
        $page_css = 'admin.css';
        require __DIR__ . '/../templates/admin.php';
    }

    public function login() {
        if (!empty($_SESSION['is_admin'])) {
            header('Location: index.php?page=admin');
            exit;
        }

        $error = null;
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            // ... (logique de connexion)
        }

        // La vue login.php gère elle-même son CSS
        require __DIR__ . '/../templates/login.php';
    }
    
    // ... (le reste des méthodes)
}
