<?php
// On indique à PHPUnit que ce fichier fait partie de la suite de tests
use PHPUnit\Framework\TestCase;

// On charge le fichier contenant la logique de calcul que l'on veut vérifier
require_once __DIR__ . '/../src/Utils.php';

/**
 * Cette classe regroupe tous les tests liés aux calculs financiers de l'application.
 */
class CalculationTest extends TestCase
{
    // Cette fonction est lancée avant chaque test pour préparer un environnement propre.
    protected function setUp(): void
    {
        // On simule la configuration globale des dénominations pour que nos tests fonctionnent.
        global $denominations;
        $denominations = [
            'billets' => ['b500' => 500, 'b200' => 200, 'b100' => 100, 'b50' => 50, 'b20' => 20, 'b10' => 10, 'b5' => 5],
            'pieces'  => ['p200' => 2, 'p100' => 1, 'p050' => 0.50, 'p020' => 0.20, 'p010' => 0.10, 'p005' => 0.05, 'p002' => 0.02, 'p001' => 0.01]
        ];
    }

    /**
     * Test n°1 : Un cas simple et juste.
     * On vérifie que si les chiffres sont corrects, l'écart est bien de 0.
     */
    public function testCaisseJuste()
    {
        // 1. PRÉPARATION : On crée un scénario de comptage simple et correct.
        $donneesComptage = [
            '1' => [ // Caisse ID 1
                'fond_de_caisse' => '100.00',
                'ventes_especes' => '50.50',
                'denominations' => [
                    ['denomination_nom' => 'b50', 'quantite' => 3], // 150.00 €
                    ['denomination_nom' => 'p050', 'quantite' => 1], // 0.50 €
                ],
                'cb' => [], 'cheques' => [], 'retraits' => []
            ]
        ];

        // 2. ACTION : On exécute la fonction que l'on veut tester.
        $resultats = calculate_results_from_data($donneesComptage);
        $resultatsCaisse1 = $resultats['caisses'][1];

        // 3. VÉRIFICATION : On affirme que les résultats sont ceux attendus.
        $this->assertEquals(150.50, $resultatsCaisse1['total_compte_especes']);
        $this->assertEquals(50.50, $resultatsCaisse1['recette_reelle']);
        $this->assertEquals(0.00, $resultatsCaisse1['ecart']); // L'écart doit être zéro !
    }

    /**
     * Test n°2 : Le fameux bug du centime.
     * On s'assure que l'addition de 0.10 et 0.20 donne bien 0.30, et pas 0.3000000004.
     */
    public function testPrecisionVirguleFlottante()
    {
        $donneesComptage = [
            '1' => [
                'fond_de_caisse' => '0.00',
                'ventes_especes' => '0.30',
                'denominations' => [
                    ['denomination_nom' => 'p010', 'quantite' => 1], // 0.10 €
                    ['denomination_nom' => 'p020', 'quantite' => 1], // 0.20 €
                ],
                'cb' => [], 'cheques' => [], 'retraits' => []
            ]
        ];

        $resultats = calculate_results_from_data($donneesComptage);
        
        // Ce test nous protège à vie contre le retour de ce bug !
        $this->assertEquals(0.00, $resultats['caisses'][1]['ecart']);
    }

    /**
     * Test n°3 : Un cas avec un écart négatif.
     */
    public function testEcartNegatif()
    {
        $donneesComptage = [
            '1' => [
                'fond_de_caisse' => '100.00',
                'ventes_especes' => '50.00', // On attend 50€ de ventes
                'denominations' => [
                    ['denomination_nom' => 'b20', 'quantite' => 7], // Mais on n'a compté que 140€ au total
                ],
                'cb' => [], 'cheques' => [], 'retraits' => []
            ]
        ];

        $resultats = calculate_results_from_data($donneesComptage);

        // On vérifie qu'il manque bien 10€
        $this->assertEquals(-10.00, $resultats['caisses'][1]['ecart']);
    }
}
