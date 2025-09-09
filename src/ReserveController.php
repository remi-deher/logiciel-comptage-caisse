<?php
// src/ReserveController.php

require_once __DIR__ . '/services/ReserveService.php';

class ReserveController {
    private $pdo;
    private $reserveService;
    private $noms_caisses;
    private $denominations;

    public function __construct($pdo, $noms_caisses, $denominations) {
        $this->pdo = $pdo;
        $this->noms_caisses = $noms_caisses;
        $this->denominations = $denominations;
        $this->reserveService = new ReserveService($pdo, $denominations);
        $this->reserveService->initDenominations(); // S'assure que la table de réserve est initialisée
    }

    public function index() {
        $page_css = 'reserve.css';
        $page_js = 'reserve.js';
        
        // Données pour la vue
        $noms_caisses = $this->noms_caisses;
        $denominations = $this->denominations;
        $reserve_status = $this->reserveService->getReserveStatus();
        $demandes_en_attente = $this->reserveService->getDemandesEnAttente();
        $historique = $this->reserveService->getHistoriqueOperations();

        require __DIR__ . '/../templates/reserve.php';
    }

    public function getReserveDataJson() {
        header('Content-Type: application/json');
        try {
            echo json_encode([
                'success' => true,
                'reserve_status' => $this->reserveService->getReserveStatus(),
                'demandes_en_attente' => $this->reserveService->getDemandesEnAttente(),
                'historique' => $this->reserveService->getHistoriqueOperations(10)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    public function submitDemande() {
        header('Content-Type: application/json');
        try {
            $data = $_POST;
            $this->reserveService->createDemande($data);
            echo json_encode(['success' => true, 'message' => 'Demande enregistrée.']);
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    public function processDemande() {
        header('Content-Type: application/json');
        try {
            $data = $_POST;
            $result = $this->reserveService->processDemande($data);
            echo json_encode(['success' => true, 'message' => 'Échange validé avec succès !']);
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }
}
