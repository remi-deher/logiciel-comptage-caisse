<?php
// src/CaisseController.php

class CaisseController {
    private $pdo;
    private $noms_caisses;
    private $denominations;
    private $nombre_caisses;

    public function __construct($pdo, $noms_caisses, $denominations) {
        $this->pdo = $pdo;
        $this->noms_caisses = $noms_caisses;
        $this->denominations = $denominations;
        $this->nombre_caisses = count($noms_caisses);
    }

    public function calculateur() {
        $loaded_data = [];
        if (isset($_GET['load'])) {
            $stmt = $this->pdo->prepare("SELECT * FROM comptages WHERE id = ?");
            $stmt->execute([intval($_GET['load'])]);
            $loaded_data = $stmt->fetch() ?: [];
        } else {
            $stmt = $this->pdo->query("SELECT * FROM comptages ORDER BY id DESC LIMIT 1");
            $loaded_data = $stmt->fetch() ?: [];
        }

        $message = $_SESSION['message'] ?? null;
        unset($_SESSION['message']);

        $nombre_caisses = $this->nombre_caisses;
        $noms_caisses = $this->noms_caisses;
        $denominations = $this->denominations;
        
        $page_css = 'calculateur.css';
        require __DIR__ . '/../templates/calculateur.php';
    }

    public function historique() {
        $date_debut = $_GET['date_debut'] ?? '';
        $date_fin = $_GET['date_fin'] ?? '';
        $recherche = $_GET['recherche'] ?? '';
        $vue_caisse = $_GET['vue_caisse'] ?? 'toutes';

        $sql = "SELECT * FROM comptages";
        $where_clauses = [];
        $bind_values = [];

        if (!empty($date_debut)) { $where_clauses[] = "date_comptage >= ?"; $bind_values[] = $date_debut . " 00:00:00"; }
        if (!empty($date_fin)) { $where_clauses[] = "date_comptage <= ?"; $bind_values[] = $date_fin . " 23:59:59"; }
        if (!empty($recherche)) { $where_clauses[] = "nom_comptage LIKE ?"; $bind_values[] = "%" . $recherche . "%"; }
        if (!empty($where_clauses)) { $sql .= " WHERE " . implode(" AND ", $where_clauses); }
        $sql .= " ORDER BY date_comptage DESC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($bind_values);
        $historique = $stmt->fetchAll();

        $message = $_SESSION['message'] ?? null;
        unset($_SESSION['message']);
        
        $nombre_caisses = $this->nombre_caisses;
        $noms_caisses = $this->noms_caisses;
        $denominations = $this->denominations;

        $page_css = 'historique.css';
        require __DIR__ . '/../templates/historique.php';
    }
    
    public function aide() {
        require __DIR__ . '/../templates/aide.php';
    }
    
    // ... (save, delete, autosave, etc.)
}
