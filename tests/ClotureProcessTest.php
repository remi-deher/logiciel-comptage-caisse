<?php
class ClotureProcessTest extends DatabaseTestCase
{
    private $clotureService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->clotureService = new ClotureStateService($this->getConnection());
    }

    public function testSingleCaisseClotureAndReopenCycle()
    {
        $this->clotureService->confirmCaisse(1, json_encode(['total' => 150.50]));
        $this->assertEquals([1], $this->clotureService->getClosedCaisses());
        $this->clotureService->reopenCaisse(1);
        $this->assertEmpty($this->clotureService->getClosedCaisses());
    }
}
