<?php
// src/ChangelogController.php

require_once __DIR__ . '/services/VersionService.php';

class ChangelogController {
    private $versionService;
    
    public function __construct() {
        $this->versionService = new VersionService();
    }
    
    public function index() {
        // On s'assure que la sortie sera bien du JSON, comme attendu par le front-end
        header('Content-Type: application/json');
        
        try {
            // On récupère les données via le service
            $releases = $this->versionService->getAllReleases();
            
            // On encode les données en JSON et on les affiche
            echo json_encode($releases);

        } catch (Exception $e) {
            // En cas d'erreur, on renvoie une réponse JSON d'erreur propre
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erreur lors de la récupération du journal des modifications.',
                'error_details' => $e->getMessage()
            ]);
        }
        
        // On arrête le script ici pour ne pas qu'il continue et affiche autre chose
        exit;
    }
}
