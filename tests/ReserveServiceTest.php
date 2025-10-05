<?php
class ReserveServiceTest extends DatabaseTestCase
{
    private $reserveService;

    protected function setUp(): void
    {
        parent::setUp();
        $pdo = $this->getConnection();
        $pdo->exec("INSERT INTO caisses (id, nom_caisse) VALUES (1, 'Caisse Test')");
        
        global $denominations;
        $denominations = ['billets' => ['b10' => 10], 'pieces' => []];
        
        $this->reserveService = new ReserveService($pdo, $denominations);
    }

    public function testCreateDemande()
    {
        $demandeId = $this->reserveService->createDemande([
            'caisse_id' => 1, 'denomination_demandee' => 'b10', 'quantite_demandee' => 5
        ]);
        
        $stmt = $this->getConnection()->prepare("SELECT * FROM reserve_demandes WHERE id = ?");
        $stmt->execute([$demandeId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $this->assertEquals('EN_ATTENTE', $result['statut']);
        $this->assertEquals(50, $result['valeur_demandee']);
    }
}
