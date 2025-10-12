// tests/Unit/UniversManagerTest.php
<?php

use PHPUnit\Framework\TestCase;

// Incluez la classe à tester
require_once __DIR__ . '/../../models/UniversManager.php';

class UniversManagerTest extends TestCase
{
    private $dbMock;
    private $stmtMock;
    private $universManager;

    protected function setUp(): void
    {
        // Créez les mocks une seule fois pour tous les tests de cette classe
        $this->stmtMock = $this->createMock(PDOStatement::class);
        $this->dbMock = $this->createMock(PDO::class);
        
        // Le mock de la base de données retournera toujours notre mock de statement
        $this->dbMock->method('prepare')->willReturn($this->stmtMock);

        // Instanciez le manager avec le mock
        $this->universManager = new UniversManager($this->dbMock);
    }

    public function testGetUniversById()
    {
        // Arrange: Configurez ce que les mocks doivent retourner
        $expectedUnivers = ['id' => 1, 'nom' => 'High-Tech', 'zone_assignee' => 'vente'];
        $this->stmtMock->method('execute')->with([1])->willReturn(true);
        $this->stmtMock->method('fetch')->willReturn($expectedUnivers);

        // Act: Appelez la méthode à tester
        $result = $this->universManager->getUniversById(1);

        // Assert: Vérifiez que le résultat est correct
        $this->assertEquals($expectedUnivers, $result);
    }
    
    public function testAddUnivers()
    {
        // Arrange: Configurez les attentes
        // On s'attend à ce que la méthode execute soit appelée avec les bonnes données
        $this->stmtMock
            ->expects($this->once()) // Assure que la méthode est appelée exactement une fois
            ->method('execute')
            ->with(['Nouvel Univers', 'reserve'])
            ->willReturn(true);

        // Act: Appelez la méthode à tester
        $result = $this->universManager->addUnivers('Nouvel Univers', 'reserve');

        // Assert: Vérifiez que la méthode a retourné true (succès)
        $this->assertTrue($result);
    }

    public function testDeleteUniversFailsIfUsed()
    {
        // Arrange: Simule qu'un code géo utilise cet univers (COUNT(*) > 0)
        $this->stmtMock->method('execute')->with([5])->willReturn(true);
        $this->stmtMock->method('fetchColumn')->willReturn(1); // 1 code géo utilise cet univers

        // Act: Appelez la méthode de suppression
        $result = $this->universManager->deleteUnivers(5);

        // Assert: La suppression doit échouer
        $this->assertFalse($result);
    }
}
