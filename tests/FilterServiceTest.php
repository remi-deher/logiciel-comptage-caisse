<?php
use PHPUnit\Framework\TestCase;

/**
 * Cette classe teste la logique de construction des requêtes SQL pour les filtres.
 */
class FilterServiceTest extends TestCase
{
    private $filterService;

    protected function setUp(): void
    {
        $this->filterService = new FilterService();
    }

    public function testAucunFiltre()
    {
        $result = $this->filterService->getWhereClauseAndBindings(null, null, null);
        $this->assertEquals("", $result['sql_where']);
        $this->assertEmpty($result['bind_values']);
    }

    public function testFiltreParDateDebut()
    {
        $result = $this->filterService->getWhereClauseAndBindings('2025-01-01', null, null);
        $this->assertEquals(" WHERE date_comptage >= ?", $result['sql_where']);
        $this->assertEquals(['2025-01-01 00:00:00'], $result['bind_values']);
    }
    
    public function testFiltreParDateFin()
    {
        $result = $this->filterService->getWhereClauseAndBindings(null, '2025-01-31', null);
        $this->assertEquals(" WHERE date_comptage <= ?", $result['sql_where']);
        $this->assertEquals(['2025-01-31 23:59:59'], $result['bind_values']);
    }
    
    public function testFiltreParRecherche()
    {
        $result = $this->filterService->getWhereClauseAndBindings(null, null, 'marché');
        $this->assertEquals(" WHERE nom_comptage LIKE ?", $result['sql_where']);
        $this->assertEquals(['%marché%'], $result['bind_values']);
    }

    public function testFiltreCombine()
    {
        $result = $this->filterService->getWhereClauseAndBindings('2025-01-01', '2025-01-31', 'test');
        
        $expectedSql = " WHERE date_comptage >= ? AND date_comptage <= ? AND nom_comptage LIKE ?";
        $this->assertEquals($expectedSql, $result['sql_where']);
        
        $expectedValues = ['2025-01-01 00:00:00', '2025-01-31 23:59:59', '%test%'];
        $this->assertEquals($expectedValues, $result['bind_values']);
    }
}
