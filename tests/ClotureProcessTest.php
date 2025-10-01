<?php
// On indique que ce fichier fait partie de nos tests
use PHPUnit\Framework\TestCase;

// On charge le service que l'on souhaite tester
require_once __DIR__ . '/../src/services/ClotureStateService.php';

/**
 * Cette classe de test se concentre exclusivement sur la mécanique de sauvegarde
 * et de réouverture des caisses lors du processus de clôture.
 */
class ClotureProcessTest extends TestCase
{
    private $pdo;
    private $clotureService;

    /**
     * Cette fonction est exécutée avant chaque test.
     * Elle prépare un environnement propre et isolé : une mini-base de données en mémoire.
     */
    protected function setUp(): void
    {
        // 1. On crée une base de données SQLite en mémoire, rapide et jetable.
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // 2. On crée la table `cloture_caisse_data` dans cette base de données temporaire.
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS `cloture_caisse_data` (
              `id` INTEGER PRIMARY KEY AUTOINCREMENT,
              `caisse_id` INT NOT NULL UNIQUE,
              `date_cloture` DATETIME NOT NULL,
              `data_json` TEXT NOT NULL
            );
        ");

        // 3. On initialise le service avec notre base de données de test.
        $this->clotureService = new ClotureStateService($this->pdo);
    }

    /**
     * Test principal : simule la clôture, la réouverture, puis une nouvelle clôture.
     * C'est le scénario le plus important pour garantir l'intégrité des données.
     */
    public function testSingleCaisseClotureAndReopenCycle()
    {
        // --- ARRANGE : On prépare nos données de test ---
        $caisseId = 1;
        $donneesCloture1 = json_encode(['total' => 150.50, 'retraits' => ['b50' => 2]]);
        $donneesCloture2 = json_encode(['total' => 200.75, 'retraits' => ['b50' => 3]]);

        // --- SCÉNARIO 1 : Première clôture ---
        // Action
        $this->clotureService->confirmCaisse($caisseId, $donneesCloture1);

        // Vérification
        $this->assertEquals([$caisseId], $this->clotureService->getClosedCaisses(), "La caisse 1 devrait être marquée comme clôturée.");
        $savedData = $this->clotureService->getClosedCaisseData($caisseId);
        $this->assertEquals(json_decode($donneesCloture1, true), $savedData, "Les données de la première clôture devraient être sauvegardées.");

        // --- SCÉNARIO 2 : Réouverture de la caisse ---
        // Action
        $this->clotureService->reopenCaisse($caisseId);

        // Vérification
        $this->assertEmpty($this->clotureService->getClosedCaisses(), "Il ne devrait plus y avoir de caisse clôturée.");
        $this->assertNull($this->clotureService->getClosedCaisseData($caisseId), "Les données de clôture de la caisse 1 auraient dû être supprimées.");

        // --- SCÉNARIO 3 : Seconde clôture avec de nouvelles données ---
        // Action
        $this->clotureService->confirmCaisse($caisseId, $donneesCloture2);

        // Vérification
        $this->assertEquals([$caisseId], $this->clotureService->getClosedCaisses(), "La caisse 1 devrait de nouveau être marquée comme clôturée.");
        $savedDataAfterReclose = $this->clotureService->getClosedCaisseData($caisseId);
        $this->assertEquals(json_decode($donneesCloture2, true), $savedDataAfterReclose, "Ce sont les NOUVELLES données qui doivent être sauvegardées après la seconde clôture.");
    }

    /**
     * Teste la fonction de réinitialisation utilisée lors de la clôture générale.
     */
    public function testResetState()
    {
        // Arrange : On clôture deux caisses
        $this->clotureService->confirmCaisse(1, json_encode(['total' => 100]));
        $this->clotureService->confirmCaisse(2, json_encode(['total' => 200]));
        $this->assertCount(2, $this->clotureService->getClosedCaisses(), "Pré-condition : Deux caisses devraient être clôturées.");

        // Action : On réinitialise l'état
        $this->clotureService->resetState();

        // Assert : On vérifie que tout a été effacé
        $this->assertEmpty($this->clotureService->getClosedCaisses(), "La table de clôture aurait dû être vidée par resetState.");
    }

    /**
     * Cette fonction est exécutée après chaque test pour nettoyer l'environnement.
     */
    protected function tearDown(): void
    {
        // On ferme la connexion à notre base de données en mémoire.
        $this->pdo = null;
    }
}
