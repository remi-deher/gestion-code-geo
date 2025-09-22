<?php
// Fichier: helpers/PdfGenerator.php

use Fpdf\Fpdf;
use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;

class PdfGenerator extends Fpdf
{
    private $options;
    private $groupedCodes;
    private $cellMargin = 2; // Marge intérieure des étiquettes en mm
    private $qrCodeTempDir;

    public function __construct($orientation = 'P', $unit = 'mm', $size = 'A4')
    {
        parent::__construct($orientation, $unit, $size);
        $this->qrCodeTempDir = sys_get_temp_dir() . '/qrcodes_' . uniqid();
        if (!is_dir($this->qrCodeTempDir)) {
            mkdir($this->qrCodeTempDir, 0777, true);
        }
    }

    public function generateLabelsPdf(array $groupedCodes, array $options)
    {
        $this->groupedCodes = $groupedCodes;
        $this->options = $options;

        $this->SetTitle($options['title']);
        $this->SetAuthor("Gestion Code Geo");
        $this->SetMargins(10, 10, 10);
        $this->AliasNbPages();

        $this->drawLabels();

        $this->cleanupTempDir();
        
        $this->Output('I', 'Etiquettes_GeoCodes.pdf');
    }
    
    private function drawLabels() {
        $this->AddPage();
        $template = $this->options['template'];
        $dimensions = ['qr-left' => [85, 40], 'qr-top' => [60, 55], 'compact' => [85, 25]];
        $labelW = $dimensions[$template][0];
        $labelH = $dimensions[$template][1];
        $x = $this->GetX();
        $y = $this->GetY();

        foreach($this->groupedCodes as $univers => $codes) {
            $this->SetFont('Arial', 'B', 14);
            $this->Cell(0, 10, mb_convert_encoding($univers, 'ISO-8859-1', 'UTF-8'), 0, 1, 'L');
            $y = $this->GetY();

            foreach ($codes as $code) {
                for ($i = 0; $i < $this->options['copies']; $i++) {
                    if ($x + $labelW > $this->GetPageWidth() - $this->rMargin) {
                        $x = $this->lMargin;
                        $y += $labelH + 4;
                    }
                    if ($y + $labelH > $this->GetPageHeight() - $this->bMargin) {
                        $this->AddPage();
                        $x = $this->GetX();
                        $y = $this->GetY();
                    }
                    $this->drawSingleLabel($x, $y, $labelW, $labelH, $code);
                    $x += $labelW + 4;
                }
            }
            $x = $this->lMargin;
            $y = $this->GetY() + $labelH + 10;
            $this->SetY($y);
        }
    }

    private function drawSingleLabel($x, $y, $w, $h, $data) {
        $this->Rect($x, $y, $w, $h);
        $qrPath = $this->generateQrCodeImage($data['code_geo']);
        $currentX = $x + $this->cellMargin;
        $currentY = $y + $this->cellMargin;
        $contentWidth = $w - (2 * $this->cellMargin);
        $contentHeight = $h - (2 * $this->cellMargin);

        switch ($this->options['template']) {
            case 'qr-left':
                $qrSize = $contentHeight;
                if ($qrPath) $this->Image($qrPath, $currentX, $currentY, $qrSize, $qrSize);
                $this->drawTextCell($currentX + $qrSize + 2, $y, $contentWidth - $qrSize - 2, $h, $data);
                break;
            case 'qr-top':
                $qrSize = 35;
                if ($qrPath) $this->Image($qrPath, $x + ($w - $qrSize) / 2, $currentY, $qrSize, $qrSize);
                $this->drawTextCell($x, $currentY + $qrSize, $w, $h - $qrSize - $this->cellMargin, $data, 'C');
                break;
            case 'compact':
                $qrSize = $contentHeight;
                if ($qrPath) $this->Image($qrPath, $currentX, $currentY, $qrSize, $qrSize);
                $this->drawTextCell($currentX + $qrSize + 2, $y, $contentWidth - $qrSize - 2, $h, $data);
                break;
        }
    }

    private function drawTextCell($x, $y, $w, $h, $data, $align = 'L') {
        // --- CORRECTION MAJEURE DE LA MISE EN PAGE ---
        // On calcule un point de départ vertical pour centrer le bloc de texte.
        $textBlockHeight = 0;
        if (in_array('code_geo', $this->options['fields'])) $textBlockHeight += 6; // Hauteur approximative du code
        if (in_array('libelle', $this->options['fields'])) $textBlockHeight += 8;  // Hauteur du libellé sur 2 lignes
        
        $startY = $y + ($h - $textBlockHeight) / 2;
        $this->SetXY($x, $startY);

        // Affiche le Code Géo
        if (in_array('code_geo', $this->options['fields'])) {
            $this->SetFont('Arial', 'B', 12);
            $this->Cell($w, 6, $data['code_geo'], 0, 1, $align);
        }

        // Affiche le Libellé
        if (in_array('libelle', $this->options['fields'])) {
            $this->SetX($x); // On réinitialise la position X pour la cellule MultiCell
            $this->SetFont('Arial', '', 9);
            $this->MultiCell($w, 4, mb_convert_encoding($data['libelle'], 'ISO-8859-1', 'UTF-8'), 0, $align);
        }
    }

    private function generateQrCodeImage($text)
    {
        $path = $this->qrCodeTempDir . '/' . md5($text) . '.png';

        $options = new QROptions([
            'outputType'             => QRCode::OUTPUT_IMAGE_PNG,
            'eccLevel'               => QRCode::ECC_L,
            'scale'                  => 20,
            'imageTransparent'       => false,
            'addQuietZone'           => true,
            'quietZoneSize'          => 1,
        ]);

        (new QRCode($options))->render($text, $path);
        
        return $path;
    }

    private function cleanupTempDir()
    {
        if (!is_dir($this->qrCodeTempDir)) return;
        $files = glob($this->qrCodeTempDir . '/*');
        foreach ($files as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }
        rmdir($this->qrCodeTempDir);
    }
}
