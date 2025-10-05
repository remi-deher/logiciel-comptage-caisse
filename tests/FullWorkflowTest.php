<?php
// Fichier : tests/FullWorkflowTest.php

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
class FullWorkflowTest extends DatabaseTestCase
{
    /**
     * Étape 1 : Simule la clôture et la finalisation.
     */
    public function testStep1_ClotureGeneraleCreatesCorrectState()
    {
        $pdo = $this->getConnection();
        global $noms_caisses, $denominations;
        $noms_caisses = [1 => 'Caisse Principale', 2 => 'Caisse Annexe'];
        $denominations = ['billets' => ['b50' => 50, 'b20' => 20, 'b10' => 10], 'pieces'  => []];

        $pdo->exec("INSERT INTO caisses (id, nom_caisse) VALUES (1, 'Caisse Principale'), (2, 'Caisse Annexe')");

        $comptageRepository = new ComptageRepository($pdo);
        $clotureStateService = new ClotureStateService($pdo);
        
        // --- ARRANGE ---
        $clotureStateService->confirmCaisse(1, json_encode(['denominations' => [], 'retraits' => []]));
        $clotureStateService->confirmCaisse(2, json_encode(['denominations' => [], 'retraits' => []]));

        // --- DÉBUT DE LA CORRECTION ---
        // 1. On crée notre faux service de sauvegarde qui retourne toujours un succès
        $backupServiceMock = $this->createMock(BackupService::class);
        $backupServiceMock->method('createBackup')->willReturn(['success' => true]);

        // 2. On instancie le contrôleur en lui injectant notre faux service
        $calculateurController = new CalculateurController(
            $pdo, $noms_caisses, $denominations, [], $comptageRepository, $backupServiceMock
        );
        // --- FIN DE LA CORRECTION ---

        // --- ACT ---
        ob_start();
        $calculateurController->cloture_generale();
        $clotureJsonResponse = ob_get_clean();
        $clotureResult = json_decode($clotureJsonResponse, true);

        // --- ASSERT ---
        $this->assertTrue($clotureResult['success'], "La clôture générale aurait dû réussir. Message d'erreur : " . ($clotureResult['message'] ?? 'Aucun'));
    }

    /**
     * Étape 2 : Simule le rechargement de la page.
     * @depends testStep1_ClotureGeneraleCreatesCorrectState
     */
    public function testStep2_AfterClotureGetInitialDataLoadsCorrectData()
    {
        $pdo = $this->getConnection();
        global $noms_caisses, $denominations;
        $noms_caisses = [1 => 'Caisse Principale', 2 => 'Caisse Annexe'];
        $denominations = ['billets' => ['b50' => 50], 'pieces'  => []];
        $comptageRepository = new ComptageRepository($pdo);

        // ACT & ASSERT
        $newController = new CalculateurController($pdo, $noms_caisses, $denominations, [], $comptageRepository);
        ob_start();
        $newController->getInitialData();
        $initialDataJsonResponse = ob_get_clean();
        $initialDataResult = json_decode($initialDataJsonResponse, true);

        $this->assertTrue($initialDataResult['success']);
        $this->assertStringContainsString('Fond de caisse J+1', $initialDataResult['data']['nom_comptage']);
    }
}
