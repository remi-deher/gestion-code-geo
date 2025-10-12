// tests/Unit/GeoCodeManagerTest.php
<?php

use PHPUnit\Framework\TestCase;

// Incluez les classes nécessaires
require_once __DIR__ . '/../../models/GeoCodeManager.php';

class GeoCodeManagerTest extends TestCase
{
    public function testGetGeoCodeById()
    {
        // 1. Créer un "mock" de l'objet PDOStatement
        $stmtMock = $this->createMock(PDOStatement::class);
        $stmtMock->method('execute')->willReturn(true);
        $stmtMock->method('fetch')->willReturn([
            'id' => 1,
            'code_geo' => 'TEST-001',
            'libelle' => 'Test Libelle'
        ]);

        // 2. Créer un "mock" de l'objet PDO
        $dbMock = $this->createMock(PDO::class);
        $dbMock->method('prepare')->willReturn($stmtMock);

        // 3. Instancier le Manager avec le mock de la BDD
        $geoCodeManager = new GeoCodeManager($dbMock);

        // 4. Appeler la méthode à tester
        $result = $geoCodeManager->getGeoCodeById(1);

        // 5. Affirmer que le résultat est correct (assertions)
        $this->assertIsArray($result);
        $this->assertEquals('TEST-001', $result['code_geo']);
    }
}
