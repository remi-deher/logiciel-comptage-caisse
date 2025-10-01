<?php
use PHPUnit\Framework\TestCase;

// On charge les services que l'on va tester
require_once __DIR__ . '/../src/services/CaisseManagementService.php';
require_once __DIR__ . '/../src/services/TerminalManagementService.php';
require_once __DIR__ . '/../src/services/ConfigService.php';

/**
 * Cette classe teste les services qui modifient la configuration de l'application,
 * comme l'ajout ou la suppression de caisses et de terminaux.
 */
class ManagementServicesTest extends TestCase
{
    private $pdo;
    private $mockConfigService;
    private $caisseService;
    private $terminalService;

    // Préparation de l'environnement de test
    protected function setUp(): void
    {
        // 1. Base de données en mémoire
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // 2. On crée les tables nécessaires
        $this->pdo->exec("CREATE TABLE caisses (id INTEGER PRIMARY KEY AUTOINCREMENT, nom_caisse TEXT)");
        $this->pdo->exec("CREATE TABLE terminaux_paiement (id INTEGER PRIMARY KEY AUTOINCREMENT, nom_terminal TEXT, caisse_associee INTEGER)");

        // 3. On insère des données de départ
        $this->pdo->exec("INSERT INTO caisses (id, nom_caisse) VALUES (1, 'Caisse Principale'), (2, 'Caisse Annexe')");

        // 4. CRÉATION DU "MOCK"
        // On crée un faux ConfigService qui n'écrira pas de vrai fichier.
        // On lui dit juste de s'attendre à recevoir un appel à sa méthode "updateConfigFile".
        $this->mockConfigService = $this->createMock(ConfigService::class);

        // 5. On initialise nos vrais services avec la fausse dépendance
        $this->caisseService = new CaisseManagementService($this->pdo, $this->mockConfigService);
        $this->terminalService = new TerminalManagementService($this->pdo, $this->mockConfigService);
    }

    // --- Tests pour CaisseManagementService ---

    public function testAddCaisse()
    {
        // Préparation : On simule l'état actuel de la configuration
        global $noms_caisses;
        $noms_caisses = [1 => 'Caisse Principale', 2 => 'Caisse Annexe'];
        
        // On s'attend à ce que la méthode de mise à jour du config soit appelée UNE SEULE FOIS
        // avec la nouvelle liste de caisses. C'est le cœur de notre vérification.
        $this->mockConfigService->expects($this->once())
            ->method('updateConfigFile')
            ->with($this->equalTo(['noms_caisses' => [1 => 'Caisse Principale', 2 => 'Caisse Annexe', 3 => 'Nouvelle Caisse']]));

        // Action : On ajoute la nouvelle caisse
        $this->caisseService->addCaisse('Nouvelle Caisse');

        // Vérification : La caisse a-t-elle bien été ajoutée à la base de données ?
        $stmt = $this->pdo->query("SELECT nom_caisse FROM caisses WHERE id = 3");
        $this->assertEquals('Nouvelle Caisse', $stmt->fetchColumn());
    }

    public function testDeleteCaisse()
    {
        // Préparation
        global $noms_caisses;
        $noms_caisses = [1 => 'Caisse Principale', 2 => 'Caisse Annexe'];
        
        // On s'attend à ce que le config soit mis à jour, mais cette fois SANS la caisse n°2.
        $this->mockConfigService->expects($this->once())
            ->method('updateConfigFile')
            ->with($this->equalTo(['noms_caisses' => [1 => 'Caisse Principale']]));

        // Action : On supprime la caisse avec l'ID 2
        $this->caisseService->deleteCaisse(2);

        // Vérification : La caisse a-t-elle bien disparu de la base de données ?
        $stmt = $this->pdo->query("SELECT COUNT(*) FROM caisses WHERE id = 2");
        $this->assertEquals(0, $stmt->fetchColumn());
    }

    // --- Tests pour TerminalManagementService ---
    
    public function testAddTerminal()
    {
        // On s'attend à ce que le service mette à jour la config des TPE.
        // Comme c'est le premier, la config attendue est simple.
        $this->mockConfigService->expects($this->once())
             ->method('updateConfigFile')
             ->with($this->callback(function ($subject) {
                 // On vérifie que la config contient bien notre nouveau terminal.
                 $this->assertArrayHasKey('tpe_par_caisse', $subject);
                 $this->assertCount(1, $subject['tpe_par_caisse']);
                 $this->assertEquals('TPE Ingenico', $subject['tpe_par_caisse'][1]['nom']);
                 $this->assertEquals(1, $subject['tpe_par_caisse'][1]['caisse_id']);
                 return true;
             }));

        // Action : On ajoute un nouveau terminal associé à la caisse 1
        $this->terminalService->addTerminal('TPE Ingenico', 1);

        // Vérification : Le terminal est-il bien dans la base de données ?
        $stmt = $this->pdo->query("SELECT nom_terminal, caisse_associee FROM terminaux_paiement WHERE id = 1");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $this->assertEquals('TPE Ingenico', $result['nom_terminal']);
        $this->assertEquals(1, $result['caisse_associee']);
    }

    // Nettoyage après chaque test
    protected function tearDown(): void
    {
        $this->pdo = null;
    }
}
