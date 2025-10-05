<?php
class ManagementServicesTest extends DatabaseTestCase
{
    public function testAddCaisse()
    {
        parent::setUp();
        $pdo = $this->getConnection();
        $pdo->exec("INSERT INTO caisses (id, nom_caisse) VALUES (1, 'Caisse Principale')");
        
        global $noms_caisses;
        $noms_caisses = [1 => 'Caisse Principale'];
        
        $mockConfigService = $this->createMock(ConfigService::class);
        $mockConfigService->expects($this->once())
            ->method('updateConfigFile')
            ->with($this->equalTo(['noms_caisses' => [1 => 'Caisse Principale', 2 => 'Nouvelle Caisse']]));

        $caisseService = new CaisseManagementService($pdo, $mockConfigService);
        $caisseService->addCaisse('Nouvelle Caisse');
    }
}
