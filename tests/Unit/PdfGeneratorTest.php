// tests/Unit/PdfGeneratorTest.php
<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../helpers/PdfGenerator.php';

use Fpdf\Fpdf;

class PdfGeneratorTest extends TestCase
{
    public function testGenerateLabelsPdfDrawsCorrectContent()
    {
        // Arrange
        $groupedCodes = [
            'Electronique' => [
                ['code_geo' => 'ELEC-01', 'libelle' => 'Rayon TV']
            ]
        ];
        $options = [
            'title' => 'Mon Titre',
            'template' => 'qr-left',
            'copies' => 1,
            'fields' => ['code_geo', 'libelle']
        ];

        $pdfGeneratorMock = $this->getMockBuilder(PdfGenerator::class)
            ->onlyMethods(['AddPage', 'SetFont', 'Cell', 'Rect', 'Image', 'MultiCell', 'Output', 'SetTitle'])
            ->getMock();

        // Définir les attentes pour les appels à la méthode Cell()
        // C'est ici que nous utilisons at()
        $pdfGeneratorMock->method('Cell')
            ->willReturnCallback(function (...$args) {
                static $callCount = 0;
                
                if ($callCount === 0) { // Premier appel (Titre de l'univers)
                    $this->assertEquals(10, $args[1]);
                    $this->assertStringContainsString('Electronique', $args[2]);
                } elseif ($callCount === 1) { // Deuxième appel (Code Géo)
                    $this->assertEquals(6, $args[1]);
                    $this->assertEquals('ELEC-01', $args[2]);
                }
                
                $callCount++;
            });


        // On garde les autres attentes simples
        $pdfGeneratorMock->expects($this->once())->method('SetTitle')->with('Mon Titre');
        $pdfGeneratorMock->expects($this->once())->method('AddPage');
        $pdfGeneratorMock->expects($this->once())->method('MultiCell');

        // Act
        $pdfGeneratorMock->generateLabelsPdf($groupedCodes, $options);
        
        // Assert
        // Les assertions sont maintenant à l'intérieur du willReturnCallback
    }
}
