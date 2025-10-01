<?php
use PHPUnit\Framework\TestCase;

// On charge le service à tester
require_once __DIR__ . '/../src/services/ReserveService.php';

class ReserveServiceTest extends TestCase
{
    private $pdo;
    private $reserveService;

    // Cette fonction prépare une base de données en mémoire avant chaque test
    protected function setUp(): void
    {
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // --- DÉBUT DE LA CORRECTION ---
        // On s'assure que les schémas des tables de test correspondent EXACTEMENT au schéma réel.
        $this->pdo->exec("CREATE TABLE reserve_denominations (denomination_nom TEXT PRIMARY KEY, quantite INTEGER)");
        
        $this->pdo->exec("
            CREATE TABLE reserve_demandes (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                date_demande DATETIME,
                caisse_id INTEGER,
                demandeur_nom TEXT,
                denomination_demandee TEXT,
                quantite_demandee INTEGER,
                valeur_demandee REAL,
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
        // --- FIN DE LA CORRECTION ---

        // On prépare un stock initial pour nos tests
        $this->pdo->exec("INSERT INTO reserve_denominations (denomination_nom, quantite) VALUES ('b50', 10), ('b20', 20), ('b10', 30)");

        // On simule la configuration des dénominations
        $denominations = ['billets' => ['b50' => 50, 'b20' => 20, 'b10' => 10], 'pieces' => []];
        
        // On initialise le service avec notre BDD de test et la configuration
        $this->reserveService = new ReserveService($this->pdo, $denominations);
    }

    // Test n°1 : Vérifie qu'une demande est correctement enregistrée
    public function testCreateDemande()
    {
        $demandeData = [
            'caisse_id' => 1,
            'denomination_demandee' => 'b10',
            'quantite_demandee' => 5,
            'notes_demandeur' => 'Test'
        ];

        // Action : On crée la demande
        $demandeId = $this->reserveService->createDemande($demandeData);

        // Vérification : On va chercher dans la BDD pour voir si la demande a bien été créée
        $stmt = $this->pdo->prepare("SELECT * FROM reserve_demandes WHERE id = ?");
        $stmt->execute([$demandeId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        $this->assertNotFalse($result, "La demande devrait exister dans la base de données.");
        $this->assertEquals('EN_ATTENTE', $result['statut']);
        $this->assertEquals(5, $result['quantite_demandee']);
    }

    // Test n°2 : Simule un traitement de demande réussi et équilibré
    public function testProcessDemandeSuccess()
    {
        // Préparation : on crée une demande à traiter
        $demandeId = $this->reserveService->createDemande(['caisse_id' => 1, 'denomination_demandee' => 'b20', 'quantite_demandee' => 1, 'notes_demandeur' => '']);

        $processData = [
            'demande_id' => $demandeId,
            'caisse_id' => 1,
            'denomination_vers_caisse' => 'b20', // On donne 1 billet de 20€
            'quantite_vers_caisse' => 1,
            'denomination_depuis_caisse' => 'b10', // On récupère 2 billets de 10€
            'quantite_depuis_caisse' => 2,
            'notes' => 'Echange standard'
        ];

        // Action : On traite la demande
        $this->reserveService->processDemande($processData);

        // Vérifications
        // 1. Le statut de la demande a-t-il changé ?
        $stmt = $this->pdo->prepare("SELECT statut FROM reserve_demandes WHERE id = ?");
        $stmt->execute([$demandeId]);
        $this->assertEquals('TRAITEE', $stmt->fetchColumn());

        // 2. Le stock a-t-il été mis à jour correctement ?
        $stmt = $this->pdo->query("SELECT denomination_nom, quantite FROM reserve_denominations");
        $stock = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        $this->assertEquals(19, $stock['b20'], "Le stock de b20 aurait dû diminuer de 1."); // 20 - 1 = 19
        $this->assertEquals(32, $stock['b10'], "Le stock de b10 aurait dû augmenter de 2."); // 30 + 2 = 32

        // 3. L'opération a-t-elle été enregistrée dans l'historique ?
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM reserve_operations_log WHERE demande_id = ?");
        $stmt->execute([$demandeId]);
        $this->assertEquals(1, $stmt->fetchColumn());
    }

    // Test n°3 : Simule un traitement avec un stock insuffisant
    public function testProcessDemandeStockInsuffisant()
    {
        // On s'attend à ce que le code déclenche une erreur (une "Exception")
        $this->expectException(Exception::class);
        $this->expectExceptionMessage("Quantité insuffisante dans la réserve");

        // Scénario : on demande 11 billets de 50€, mais le stock n'en contient que 10
        $processData = [
            'demande_id' => 1, 'caisse_id' => 1,
            'denomination_vers_caisse' => 'b50',
            'quantite_vers_caisse' => 11, // Plus que le stock disponible
            'denomination_depuis_caisse' => 'b10',
            'quantite_depuis_caisse' => 55,
            'notes' => ''
        ];
        
        // Cette action devrait déclencher l'erreur attendue et arrêter le test ici
        $this->reserveService->processDemande($processData);
    }
    
    // Test n°4 : Simule un traitement avec un échange non équilibré
    public function testProcessDemandeBalanceNonEquilibree()
    {
        $this->expectException(Exception::class);
        $this->expectExceptionMessage("La balance de l'échange n'est pas équilibrée.");

        // Scénario : on donne 20€ mais on ne récupère que 10€
        $processData = [
            'demande_id' => 1, 'caisse_id' => 1,
            'denomination_vers_caisse' => 'b20', 'quantite_vers_caisse' => 1, // 20€
            'denomination_depuis_caisse' => 'b10', 'quantite_depuis_caisse' => 1, // 10€
            'notes' => ''
        ];
        
        $this->reserveService->processDemande($processData);
    }
    
    // Cette fonction s'exécute après chaque test pour nettoyer
    protected function tearDown(): void
    {
        $this->pdo = null;
    }
}
