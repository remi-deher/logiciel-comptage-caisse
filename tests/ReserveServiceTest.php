<?php
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../src/services/ReserveService.php';

class ReserveServiceTest extends TestCase
{
    private $pdo;
    private $reserveService;

    protected function setUp(): void
    {
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Schéma de test simplifié pour la table des demandes
        $this->pdo->exec("CREATE TABLE reserve_denominations (denomination_nom TEXT PRIMARY KEY, quantite INTEGER)");
        $this->pdo->exec("
            CREATE TABLE reserve_demandes (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                date_demande DATETIME,
                caisse_id INTEGER,
                demandeur_nom TEXT,
                denomination_demandee_old TEXT,
                quantite_demandee_old INTEGER,
                valeur_demandee REAL,
                details_json TEXT,
                statut TEXT,
                notes_demandeur TEXT,
                date_traitement DATETIME, 
                approbateur_nom TEXT
            )
        ");
        $this->pdo->exec("
            CREATE TABLE reserve_operations_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                demande_id INTEGER,
                date_operation DATETIME,
                caisse_id INTEGER,
                denomination_vers_caisse TEXT,
                quantite_vers_caisse INTEGER,
                denomination_depuis_caisse TEXT,
                quantite_depuis_caisse INTEGER,
                valeur_echange REAL,
                notes TEXT,
                approbateur_nom TEXT
            )
        ");

        $this->pdo->exec("INSERT INTO reserve_denominations (denomination_nom, quantite) VALUES ('b50', 10), ('b20', 20), ('b10', 30)");

        // Simulation des configurations globales
        global $denominations, $rouleaux_pieces;
        $denominations = ['billets' => ['b50' => 50, 'b20' => 20, 'b10' => 10], 'pieces' => ['p200' => 2]];
        $rouleaux_pieces = ['p200' => 25];
        
        $this->reserveService = new ReserveService($this->pdo, $denominations);
    }

    public function testCreateDemande()
    {
        // On utilise l'ancienne structure de données, que le service doit maintenant comprendre
        $demandeData = [
            'caisse_id' => 1,
            'denomination_demandee' => 'b10',
            'quantite_demandee' => 5,
            'notes_demandeur' => 'Test'
        ];

        $demandeId = $this->reserveService->createDemande($demandeData);

        $stmt = $this->pdo->prepare("SELECT * FROM reserve_demandes WHERE id = ?");
        $stmt->execute([$demandeId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        $this->assertNotFalse($result, "La demande devrait exister dans la base de données.");
        $this->assertEquals('EN_ATTENTE', $result['statut']);
        $this->assertEquals(50, $result['valeur_demandee']); // 5 * 10 = 50

        // On vérifie que le JSON a été correctement généré
        $details = json_decode($result['details_json'], true);
        $this->assertEquals('billet', $details[0]['type']);
        $this->assertEquals('b10', $details[0]['denomination']);
        $this->assertEquals(5, $details[0]['quantite']);
    }

    public function testProcessDemandeSuccess()
    {
        // On crée une demande avec l'ancien format
        $demandeId = $this->reserveService->createDemande(['caisse_id' => 1, 'denomination_demandee' => 'b20', 'quantite_demandee' => 1, 'notes_demandeur' => '']);

        $processData = [
            'demande_id' => $demandeId,
            'caisse_id' => 1,
            'denomination_vers_caisse' => 'b20',
            'quantite_vers_caisse' => 1,
            'denomination_depuis_caisse' => 'b10',
            'quantite_depuis_caisse' => 2,
            'notes' => 'Echange standard'
        ];

        $this->reserveService->processDemande($processData);

        $stmt = $this->pdo->prepare("SELECT statut FROM reserve_demandes WHERE id = ?");
        $stmt->execute([$demandeId]);
        $this->assertEquals('TRAITEE', $stmt->fetchColumn());

        $stmt = $this->pdo->query("SELECT denomination_nom, quantite FROM reserve_denominations");
        $stock = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        $this->assertEquals(19, $stock['b20']);
        $this->assertEquals(32, $stock['b10']);

        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM reserve_operations_log WHERE demande_id = ?");
        $stmt->execute([$demandeId]);
        $this->assertEquals(1, $stmt->fetchColumn());
    }

    public function testProcessDemandeStockInsuffisant()
    {
        $this->expectException(Exception::class);
        $this->expectExceptionMessage("Quantité insuffisante dans la réserve");

        $processData = [
            'demande_id' => 1, 'caisse_id' => 1,
            'denomination_vers_caisse' => 'b50',
            'quantite_vers_caisse' => 11,
            'denomination_depuis_caisse' => 'b10',
            'quantite_depuis_caisse' => 55,
            'notes' => ''
        ];
        
        $this->reserveService->processDemande($processData);
    }
    
    public function testProcessDemandeBalanceNonEquilibree()
    {
        $this->expectException(Exception::class);
        $this->expectExceptionMessage("La balance de l'échange n'est pas équilibrée.");

        $processData = [
            'demande_id' => 1, 'caisse_id' => 1,
            'denomination_vers_caisse' => 'b20', 'quantite_vers_caisse' => 1,
            'denomination_depuis_caisse' => 'b10', 'quantite_depuis_caisse' => 1,
            'notes' => ''
        ];
        
        $this->reserveService->processDemande($processData);
    }
    
    protected function tearDown(): void
    {
        $this->pdo = null;
    }
}
