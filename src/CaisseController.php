<?php
// src/CaisseController.php

class CaisseController {
    private $pdo;
    private $noms_caisses;
    private $denominations;
    private $versionService;

    public function __construct($pdo, $noms_caisses, $denominations) {
        $this->pdo = $pdo;
        $this->noms_caisses = $noms_caisses;
        $this->denominations = $denominations;
        $this->versionService = new VersionService();
    }

    /**
     * Gère l'affichage de la page du calculateur.
     */
    public function calculateur() {
        $loaded_data = [];
        $isLoadedFromHistory = false;
        $isAutosaveLoaded = false;

        if (isset($_GET['load'])) {
            $isLoadedFromHistory = true;
            $stmt = $this->pdo->prepare("SELECT * FROM comptages WHERE id = ?");
            $stmt->execute([intval($_GET['load'])]);
            $loaded_data = $stmt->fetch() ?: [];
        } else {
            // Essayer de charger la dernière sauvegarde auto si elle existe
            $stmt = $this->pdo->prepare("SELECT * FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%' ORDER BY id DESC LIMIT 1");
            $stmt->execute();
            $loaded_data = $stmt->fetch() ?: [];
            if ($loaded_data) {
                $isAutosaveLoaded = true;
            }
        }

        $message = $_SESSION['message'] ?? null;
        unset($_SESSION['message']);

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
        
        $noms_caisses = $this->noms_caisses;
        $denominations = $this->denominations;
        $nombre_caisses = count($this->noms_caisses);

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
     * Gère l'affichage de la page du journal des modifications (changelog).
     */
    public function changelog() {
        $releases = $this->versionService->getAllReleases();
        
        $page_css = 'changelog.css';
        require __DIR__ . '/../templates/changelog.php';
    }
    
    /**
     * Gère la sauvegarde manuelle d'un comptage.
     */
    public function save() {
        $this->handleSave(false);
    }

    /**
     * Gère la sauvegarde automatique d'un comptage.
     */
    public function autosave() {
        $this->handleSave(true);
    }

    /**
     * Logique commune pour la sauvegarde manuelle et automatique.
     */
    private function handleSave($is_autosave) {
        if ($is_autosave) {
            header('Content-Type: application/json');
            ob_start();
        }

        $nom_comptage = trim($_POST['nom_comptage'] ?? '');
        $has_data = false;
        foreach ($_POST['caisse'] ?? [] as $caisse_data) {
            foreach ($caisse_data as $value) {
                if (!empty($value)) {
                    $has_data = true;
                    break 2;
                }
            }
        }

        if (empty($nom_comptage) || !$has_data) {
            if ($is_autosave) {
                ob_end_clean();
                echo json_encode(['success' => false, 'message' => 'Aucune donnée à sauvegarder.']);
            } else {
                $_SESSION['message'] = "Aucune donnée n'a été saisie.";
                header('Location: index.php?page=calculateur');
            }
            exit;
        }

        $sql_columns = ['nom_comptage', 'explication', 'date_comptage'];
        $sql_values = [$nom_comptage, trim($_POST['explication'] ?? ''), date('Y-m-d H:i:s')];

        foreach ($this->noms_caisses as $i => $nom) {
            $caisse_data = $_POST['caisse'][$i] ?? [];
            $sql_columns[] = "c{$i}_fond_de_caisse"; $sql_values[] = get_numeric_value($caisse_data, 'fond_de_caisse');
            $sql_columns[] = "c{$i}_ventes"; $sql_values[] = get_numeric_value($caisse_data, 'ventes');
            $sql_columns[] = "c{$i}_retrocession"; $sql_values[] = get_numeric_value($caisse_data, 'retrocession');
            
            foreach ($this->denominations as $list) {
                foreach (array_keys($list) as $name) {
                    $sql_columns[] = "c{$i}_{$name}";
                    $sql_values[] = get_numeric_value($caisse_data, $name);
                }
            }
        }
        
        $placeholders = implode(', ', array_fill(0, count($sql_values), '?'));
        $sql = "INSERT INTO comptages (" . implode(', ', $sql_columns) . ") VALUES ($placeholders)";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($sql_values);
        
        if ($is_autosave) {
            ob_end_clean();
            echo json_encode(['success' => true, 'message' => 'Sauvegarde auto à ' . date('H:i:s')]);
        } else {
            $last_id = $this->pdo->lastInsertId();
            $_SESSION['message'] = "Comptage '" . htmlspecialchars($nom_comptage) . "' créé avec succès !";
            header('Location: index.php?page=calculateur&load=' . $last_id);
        }
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
}
