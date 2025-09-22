<?php
// Fichier: helpers/PdfGenerator.php

// DÉFINITION DU CHEMIN DES POLICES
define('FPDF_FONTPATH', __DIR__ . '/fpdf/font/');

// Ce code suppose que FPDF a été téléchargé et placé dans un sous-dossier.
if (!file_exists(__DIR__ . '/fpdf/fpdf.php')) {
    die("Le fichier fpdf.php de la bibliothèque FPDF est introuvable. Veuillez le télécharger et le placer dans le dossier helpers/fpdf/.");
}
require_once __DIR__ . '/fpdf/fpdf.php';

class PdfGenerator extends FPDF
{
    private $options;
    private $groupedCodes;
    private $cellMargin = 2; // Marge intérieure des étiquettes en mm
    private $qrCodeTempDir;

    public function __construct($orientation = 'P', $unit = 'mm', $size = 'A4')
    {
        parent::__construct($orientation, $unit, $size);
        // Crée un dossier temporaire pour stocker les images des QR codes
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

        // Nettoyage des images temporaires
        $this->cleanupTempDir();
        
        $this->Output('I', 'Etiquettes_GeoCodes.pdf');
    }
    
    private function drawLabels() {
        $this->AddPage();

        $template = $this->options['template'];
        
        // Dimensions des étiquettes en mm [largeur, hauteur]
        $dimensions = [
            'qr-left' => [85, 40],
            'qr-top' => [60, 55],
            'compact' => [85, 25],
        ];
        
        $labelW = $dimensions[$template][0];
        $labelH = $dimensions[$template][1];

        // Position de départ
        $x = $this->GetX();
        $y = $this->GetY();

        foreach($this->groupedCodes as $univers => $codes) {
            // Titre de l'univers
            $this->SetFont('Arial', 'B', 14);
            // CORRECTION: Remplacement de utf8_decode()
            $this->Cell(0, 10, mb_convert_encoding($univers, 'ISO-8859-1', 'UTF-8'), 0, 1, 'L');
            $y = $this->GetY(); // Sauvegarde de la position après le titre

            foreach ($codes as $code) {
                for ($i = 0; $i < $this->options['copies']; $i++) {
                    // Vérifier si l'étiquette dépasse en largeur
                    if ($x + $labelW > $this->GetPageWidth() - $this->rMargin) {
                        $x = $this->lMargin;
                        $y += $labelH + 4; // Passer à la ligne suivante
                    }
                    
                    // Vérifier si l'étiquette dépasse en hauteur
                    if ($y + $labelH > $this->GetPageHeight() - $this->bMargin) {
                        $this->AddPage();
                        $x = $this->GetX();
                        $y = $this->GetY();
                    }

                    $this->drawSingleLabel($x, $y, $labelW, $labelH, $code);
                    $x += $labelW + 4; // Décalage pour la prochaine étiquette
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
                $this->drawTextCell($currentX + $qrSize + 2, $currentY, $contentWidth - $qrSize - 2, $contentHeight, $data);
                break;
            case 'qr-top':
                $qrSize = 35;
                if ($qrPath) $this->Image($qrPath, $x + ($w - $qrSize) / 2, $currentY, $qrSize, $qrSize);
                $this->drawTextCell($currentX, $currentY + $qrSize, $contentWidth, $contentHeight - $qrSize, $data, 'C');
                break;
            case 'compact':
                $qrSize = $contentHeight;
                if ($qrPath) $this->Image($qrPath, $currentX, $currentY, $qrSize, $qrSize);
                $this->drawTextCell($currentX + $qrSize + 2, $currentY, $contentWidth - $qrSize - 2, $contentHeight, $data);
                break;
        }
    }

    private function drawTextCell($x, $y, $w, $h, $data, $align = 'L') {
        $this->SetXY($x, $y);
        
        if (in_array('code_geo', $this->options['fields'])) {
            $this->SetFont('Arial', 'B', 14);
            $this->Cell($w, 8, $data['code_geo'], 0, 1, $align);
        }
        if (in_array('libelle', $this->options['fields'])) {
            $this->SetFont('Arial', '', 10);
            // CORRECTION: Remplacement de utf8_decode()
            $this->MultiCell($w, 5, mb_convert_encoding($data['libelle'], 'ISO-8859-1', 'UTF-8'), 0, $align);
        }
    }

    private function generateQrCodeImage($text)
    {
        $url = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' . urlencode($text);
        @$content = file_get_contents($url);
        if ($content === false) {
            return null;
        }
        $path = $this->qrCodeTempDir . '/' . md5($text) . '.png';
        file_put_contents($path, $content);
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
