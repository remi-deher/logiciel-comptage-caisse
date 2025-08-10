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
            // Essayer de charger la dernière sauvegarde auto si elle existe
            $stmt = $this->pdo->prepare("SELECT * FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%' ORDER BY id DESC LIMIT 1");
            $stmt->execute();
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
     * Gère l'affichage de la page du journal des modifications (changelog).
     */
    public function changelog() {
        $cacheDir = __DIR__ . '/../cache';
        if (!is_dir($cacheDir) && !@mkdir($cacheDir, 0755, true)) {
            $releases = [['tag_name' => 'Erreur', 'published_at' => date('c'), 'body_html' => 'Le dossier de cache est manquant et ne peut pas être créé.']];
            require __DIR__ . '/../templates/changelog.php';
            return;
        }
        $cacheFile = $cacheDir . '/github_releases_full.json';
        $cacheLifetime = 3600; // 1 heure en secondes

        if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheLifetime)) {
            $releases = json_decode(file_get_contents($cacheFile), true);
        } else {
            $releases = [];
            
            if (function_exists('curl_init')) {
                $repo_api_url = 'https://api.github.com/repos/remi-deher/logiciel-comptage-caisse/releases';
                
                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, $repo_api_url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
                curl_setopt($ch, CURLOPT_USERAGENT, 'Comptage-Caisse-App-Changelog');
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/vnd.github.html+json']);
                
                $response = curl_exec($ch);
                $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curl_error = curl_error($ch);
                curl_close($ch);

                if ($http_code == 200) {
                    $releases = json_decode($response, true);
                    file_put_contents($cacheFile, json_encode($releases), LOCK_EX);
                } else {
                    $error_message = "<p>Impossible de contacter GitHub pour récupérer le journal des modifications.</p>";
                    if ($http_code == 403) {
                        $error_message .= "<p><strong>Raison :</strong> L'API de GitHub a temporairement limité les requêtes provenant de ce serveur. Veuillez réessayer dans une heure.</p>";
                    } elseif ($curl_error) {
                        $error_message .= "<p><strong>Erreur cURL :</strong> " . htmlspecialchars($curl_error) . "</p>";
                    } else {
                        $error_message .= "<p><strong>Code de statut HTTP :</strong> " . htmlspecialchars($http_code) . "</p>";
                    }
                    $releases = [['tag_name' => 'Erreur de Connexion', 'published_at' => date('c'), 'body_html' => $error_message]];
                    file_put_contents($cacheFile, json_encode($releases), LOCK_EX);
                }
            } else {
                $releases = [['tag_name' => 'Erreur de Configuration', 'published_at' => date('c'), 'body_html' => '<p>L\'extension cURL de PHP n\'est pas activée sur le serveur.</p>']];
                file_put_contents($cacheFile, json_encode($releases), LOCK_EX);
            }
        }
        
        $page_css = 'changelog.css';
        require __DIR__ . '/../templates/changelog.php';
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

        foreach ($this->noms_caisses as $i => $nom) {
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
        ob_start(); // Démarre le buffer pour capturer toute sortie inattendue (warnings, etc.)

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
            ob_end_clean();
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'Aucune donnée à sauvegarder.']);
            exit;
        }

        $sql_columns = ['nom_comptage', 'explication', 'date_comptage'];
        $sql_values = [
            $nom_comptage,
            trim($_POST['explication'] ?? ''),
            date('Y-m-d H:i:s')
        ];

        foreach ($this->noms_caisses as $i => $nom) {
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
        
        ob_end_clean(); // Nettoie le buffer avant d'envoyer la réponse JSON
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'message' => 'Sauvegarde auto à ' . date('H:i:s')]);
        exit;
    }
}
