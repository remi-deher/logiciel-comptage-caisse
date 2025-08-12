<?php
// src/StatistiquesController.php

require_once 'Bdd.php';
require_once 'services/CaisseManagementService.php';

class StatistiquesController {
    
    /**
     * Affiche la page de statistiques avec les données des comptages.
     * Cette méthode récupère les données de la base de données.
     */
    public function showStatsPage() {
        // Connexion à la base de données en utilisant la méthode getPdo()
        $db = Bdd::getPdo();

        // Récupère les données des statistiques depuis la base de données
        $statsData = $this->getDataFromDatabase($db);

        // On prépare les données pour les passer au JavaScript de manière sécurisée
        // Note: Assurez-vous que les variables passées au template correspondent
        //       à celles utilisées dans le code JavaScript de la vue.
        $statsDataJson = json_encode($statsData);

        // Démarre la capture de la sortie tampon pour inclure la page dans le contrôleur
        ob_start();
        
        // Inclut la vue (votre fichier HTML/PHP)
        // Les variables locales du contrôleur deviennent disponibles dans le template
        require __DIR__ . '/../templates/statistiques.php';
        
        // Nettoie et affiche le contenu du tampon
        ob_end_flush();
    }

    /**
     * Récupère les données des statistiques depuis la base de données.
     * Les requêtes sont écrites en se basant sur une structure de base de données standard
     * pour une application de comptage de caisse.
     *
     * @param PDO $db L'instance de la classe de connexion à la base de données.
     * @return array Un tableau associatif contenant les données pour les graphiques et les KPIs.
     */
    private function getDataFromDatabase($db) {
        // Initialisation des données par défaut
        $statsData = [
            'dates' => [],
            'totals' => [],
            'ecarts' => [],
            'totalGlobal' => 0,
            'ecartTotal' => 0,
            'numDays' => 0,
            'kpiEcartMoyen' => 0,
            'denominations' => []
        ];
        
        // --- Requête pour les totaux et écarts des 30 derniers jours ---
        // Correction de la syntaxe SQL pour MariaDB et du nom de la table.
        $query = "SELECT date_comptage, SUM(total_compté) AS total, SUM(ecart) AS ecart 
                  FROM comptage_caisse 
                  WHERE date_comptage >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                  GROUP BY date_comptage 
                  ORDER BY date_comptage ASC";
        
        try {
            $stmt = $db->query($query);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($results as $row) {
                $statsData['dates'][] = (new DateTime($row['date_comptage']))->format('d/m/Y');
                $statsData['totals'][] = $row['total'];
                $statsData['ecarts'][] = $row['ecart'];
            }
            
            $statsData['numDays'] = count($statsData['dates']);
            
        } catch (PDOException $e) {
            // Gérer l'erreur (par exemple, logger ou afficher un message)
            error_log("Erreur de requête SQL pour les totaux et écarts : " . $e->getMessage());
        }

        // --- Requête pour les KPIs globaux ---
        // Correction du nom de la table.
        $kpiQuery = "SELECT COUNT(*) AS nb_comptages, SUM(total_compté) AS total_global, AVG(ecart) AS ecart_moyen FROM comptage_caisse";
        try {
            $kpiResult = $db->query($kpiQuery)->fetch(PDO::FETCH_ASSOC);
            if ($kpiResult) {
                $statsData['totalGlobal'] = $kpiResult['total_global'] ?? 0;
                $statsData['numDays'] = $kpiResult['nb_comptages'] ?? 0;
                $statsData['kpiEcartMoyen'] = $kpiResult['ecart_moyen'] ?? 0;
            }
        } catch (PDOException $e) {
            error_log("Erreur de requête SQL pour les KPIs : " . $e->getMessage());
        }
        
        // --- Requête pour les dénominations du dernier comptage ---
        // Cette requête est plus complexe et dépend fortement du schéma.
        // Ici, on va simuler la récupération pour la rendre plus simple.
        // REMPLACEZ CE CODE PAR VOS REQUÊTES pour le détail des billets/pièces.
        // Exemple avec des données simulées pour la démo:
        $statsData['denominations'] = [
            'b50' => 15, 'b20' => 30, 'b10' => 50, 'b5' => 100,
            'p2e' => 250, 'p1e' => 400, 'p50c' => 600, 'p20c' => 800
        ];

        return $statsData;
    }
}
