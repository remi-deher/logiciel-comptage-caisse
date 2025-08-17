<?php
// src/HistoryController.php
require_once 'Bdd.php';
require_once 'Utils.php';

class HistoryController {
    // Les dépendances sont injectées via le constructeur
    public function __construct($pdo, $noms_caisses, $denominations) { /* ... */ }

    public function showPage() {
        // Logique pour afficher la page de l'historique
        $page_courante = isset($_GET['p']) ? (int)$_GET['p'] : 1;
        // ... (suite de la logique de récupération des données)
        require __DIR__ . '/../templates/historique.php';
    }
    
    public function deleteAction() {
        // Logique pour la suppression d'un comptage
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
