<?php
// src/CaisseController.php

class CaisseController {
    private $pdo;
    private $noms_caisses;
    private $denominations;
    private $nombre_caisses;

    public function __construct(PDO $pdo, array $noms_caisses, array $denominations) {
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
        } else if (!isset($_GET['action']) || $_GET['action'] !== 'new') {
            $stmt = $this->pdo->query("SELECT * FROM comptages ORDER BY id DESC LIMIT 1");
            $loaded_data = $stmt->fetch() ?: [];
        }

        $message = $_SESSION['message'] ?? null;
        unset($_SESSION['message']);

        // On prépare les variables pour qu'elles soient accessibles dans le template.
        $nombre_caisses = $this->nombre_caisses;
        $noms_caisses = $this->noms_caisses;
        $denominations = $this->denominations;

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
        
        // On prépare les variables pour qu'elles soient accessibles dans le template.
        $nombre_caisses = $this->nombre_caisses;
        $noms_caisses = $this->noms_caisses;
        $denominations = $this->denominations;

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

    /**
     * Vérifie l'état du dépôt Git en utilisant l'API GitHub.
     */
    public function gitUpdateCheck() {
        header('Content-Type: application/json');
        $projectRoot = dirname(__DIR__);

        // 1. Récupère le hash du commit local (version actuelle)
        $local_hash = trim(shell_exec("cd {$projectRoot} && git rev-parse HEAD"));

        // 2. Récupère le hash du dernier commit distant via l'API GitHub
        $repo_api_url = 'https://api.github.com/repos/remi-deher/logiciel-comptage-caisse-php/commits/main';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $repo_api_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        // L'API GitHub requiert un User-Agent pour les requêtes non authentifiées.
        curl_setopt($ch, CURLOPT_USERAGENT, 'Comptage-Caisse-App-Updater'); 
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $remote_hash = null;
        if ($http_code == 200) {
            $data = json_decode($response, true);
            $remote_hash = $data['sha'] ?? null;
        }

        if (!$remote_hash) {
            echo json_encode([
                'error' => 'Impossible de récupérer la version distante depuis l\'API GitHub.'
            ]);
            return;
        }

        // 3. Compare les versions et prépare la réponse
        $update_available = ($local_hash !== $remote_hash);

        echo json_encode([
            'local_version' => substr($local_hash, 0, 7),
            'remote_version' => substr($remote_hash, 0, 7),
            'update_available' => $update_available
        ]);
    }

    /**
     * Exécute un git pull pour mettre à jour l'application.
     */
    public function gitPull() {
        header('Content-Type: application/json');
        
        $projectRoot = dirname(__DIR__);
        
        // Exécute la commande git pull
        $output = shell_exec("cd {$projectRoot} && git pull 2>&1");

        echo json_encode([
            'success' => true,
            'message' => "Mise à jour terminée.",
            'output' => $output
        ]);
    }
}
