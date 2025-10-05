<?php
use PHPUnit\Framework\TestCase;

class CalculationTest extends TestCase
{
    protected function setUp(): void
    {
        global $denominations;
        $denominations = [
            'billets' => ['b50' => 50, 'b20' => 20],
            'pieces'  => ['p050' => 0.50, 'p020' => 0.20, 'p010' => 0.10]
        ];
    }

    public function testCaisseJuste()
    {
        $data = ['1' => ['fond_de_caisse' => '100.00', 'ventes_especes' => '50.50', 'denominations' => [['denomination_nom' => 'b50', 'quantite' => 3], ['denomination_nom' => 'p050', 'quantite' => 1]]]];
        $results = calculate_results_from_data($data);
        $this->assertEquals(0.00, $results['caisses'][1]['ecart']);
    }

    public function testPrecisionVirguleFlottante()
    {
        $data = ['1' => ['fond_de_caisse' => '0.00', 'ventes_especes' => '0.30', 'denominations' => [['denomination_nom' => 'p010', 'quantite' => 1], ['denomination_nom' => 'p020', 'quantite' => 1]]]];
        $results = calculate_results_from_data($data);
        $this->assertEquals(0.00, $results['caisses'][1]['ecart']);
    }

    public function testEcartNegatif()
    {
        $data = ['1' => ['fond_de_caisse' => '100.00', 'ventes_especes' => '50.00', 'denominations' => [['denomination_nom' => 'b20', 'quantite' => 7]]]];
        $results = calculate_results_from_data($data);
        $this->assertEquals(-10.00, $results['caisses'][1]['ecart']);
    }
}
