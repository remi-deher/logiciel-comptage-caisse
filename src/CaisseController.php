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

    /**
     * Gère l'affichage de la page du calculateur.
     */
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

    /**
     * Gère l'affichage de la page de l'historique.
     */
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
    
    /**
     * Gère l'affichage de la page d'aide.
     */
    public function aide() {
        require __DIR__ . '/../templates/aide.php';
    }
    
    /**
     * Gère la sauvegarde manuelle d'un comptage.
     */
    public function save() {
        $sql_columns = ['nom_comptage', 'explication', 'date_comptage'];
        $sql_values = [
            trim($_POST['nom_comptage']), 
            trim($_POST['explication']),
            date('Y-m-d H:i:s')
        ];

        foreach (range(1, $this->nombre_caisses) as $i) {
            $caisse_data = $_POST['caisse'][$i] ?? [];
            $sql_columns[] = "c{$i}_fond_de_caisse"; $sql_values[] = get_numeric_value($caisse_data, 'fond_de_caisse');
            $sql_columns[] = "c{$i}_ventes"; $sql_values[] = get_numeric_value($caisse_data, 'ventes');
            $sql_columns[] = "c{$i}_retrocession"; $sql_values[] = get_numeric_value($caisse_data, 'retrocession');
            foreach ($this->denominations as $list) {
                foreach ($list as $name => $value) {
                    $sql_columns[] = "c{$i}_{$name}";
                    $sql_values[] = get_numeric_value($caisse_data, $name);
                }
            }
        }

        $placeholders = implode(', ', array_fill(0, count($sql_values), '?'));
        $sql = "INSERT INTO comptages (" . implode(', ', $sql_columns) . ") VALUES ($placeholders)";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($sql_values);
        $last_id = $this->pdo->lastInsertId();

        $_SESSION['message'] = "Comptage '" . htmlspecialchars(trim($_POST['nom_comptage'])) . "' créé avec succès !";
        header('Location: index.php?page=calculateur&load=' . $last_id);
        exit;
    }

    /**
     * Gère la suppression d'un comptage.
     */
    public function delete() {
        $id_a_supprimer = intval($_POST['id_a_supprimer'] ?? 0);
        if ($id_a_supprimer > 0) {
            $stmt = $this->pdo->prepare("DELETE FROM comptages WHERE id = ?");
            $stmt->execute([$id_a_supprimer]);
            $_SESSION['message'] = "Le comptage a été supprimé avec succès.";
        }
        header('Location: index.php?page=historique');
        exit;
    }

    /**
     * Gère la sauvegarde automatique des données du formulaire.
     */
    public function autosave() {
        $nom_comptage = trim($_POST['nom_comptage'] ?? '');

        if (empty($nom_comptage)) {
            http_response_code(204);
            exit;
        }

        $sql_columns = ['nom_comptage', 'explication', 'date_comptage'];
        $sql_values = [
            $nom_comptage,
            trim($_POST['explication']),
            date('Y-m-d H:i:s')
        ];

        foreach (range(1, $this->nombre_caisses) as $i) {
            $caisse_data = $_POST['caisse'][$i] ?? [];
            $sql_columns[] = "c{$i}_fond_de_caisse"; $sql_values[] = get_numeric_value($caisse_data, 'fond_de_caisse');
            $sql_columns[] = "c{$i}_ventes"; $sql_values[] = get_numeric_value($caisse_data, 'ventes');
            $sql_columns[] = "c{$i}_retrocession"; $sql_values[] = get_numeric_value($caisse_data, 'retrocession');
            foreach ($this->denominations as $list) {
                foreach ($list as $name => $value) {
                    $sql_columns[] = "c{$i}_{$name}";
                    $sql_values[] = get_numeric_value($caisse_data, $name);
                }
            }
        }
        
        $placeholders = implode(', ', array_fill(0, count($sql_values), '?'));
        $sql = "INSERT INTO comptages (" . implode(', ', $sql_columns) . ") VALUES ($placeholders)";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($sql_values);
        
        http_response_code(204);
        exit;
    }
}
