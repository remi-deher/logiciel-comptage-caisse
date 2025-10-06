<?php
// tests/ComptageRepositoryTest.php

class ComptageRepositoryTest extends DatabaseTestCase
{
    public function testFindDetailsById()
    {
        $pdo = $this->getConnection();
        $repo = new ComptageRepository($pdo);

        // --- ARRANGE : Insérer des données de test ---
        $pdo->exec("INSERT INTO caisses (id, nom_caisse) VALUES (1, 'Test Caisse')");
        $pdo->exec("INSERT INTO comptages (id, nom_comptage, date_comptage) VALUES (10, 'Comptage Test', NOW())");
        $pdo->exec("INSERT INTO comptage_details (id, comptage_id, caisse_id) VALUES (100, 10, 1)");
        $pdo->exec("INSERT INTO comptage_denominations (comptage_detail_id, denomination_nom, quantite) VALUES (100, 'b50', 2)"); // 100€

        // --- ACT : Appeler la méthode à tester ---
        $details = $repo->findDetailsById(10);

        // --- ASSERT : Vérifier les résultats ---
        $this->assertArrayHasKey(1, $details, "Les données pour la caisse ID 1 devraient exister.");
        $this->assertEquals(2, $details[1]['denominations']['b50']);
    }
}
