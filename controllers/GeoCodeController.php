<?php
// Fichier : controllers/GeoCodeController.php

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/GeoCodeManager.php';
require_once __DIR__ . '/../models/UniversManager.php';

class GeoCodeController extends BaseController {
    
    private $geoCodeManager;
    private $universManager;

    public function __construct(PDO $db) {
        $this->geoCodeManager = new GeoCodeManager($db);
        $this->universManager = new UniversManager($db);
    }

    public function listAction() {
        $geoCodes = $this->geoCodeManager->getGeoCodesWithPlacementDetails();
        $univers = $this->universManager->getAllUnivers();
        $this->render('geo_codes_list_view', [
            'geoCodes' => $geoCodes,
            'univers' => $univers
        ]);
    }

    public function createAction() {
        $universList = $this->universManager->getAllUnivers();
        $this->render('geo_codes_create_view', ['universList' => $universList]);
    }

    public function addAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $this->geoCodeManager->createGeoCode(
                $_POST['code_geo'], $_POST['libelle'], (int)$_POST['univers_id'], 
                $_POST['zone'], $_POST['commentaire']
            );
        }
        header('Location: index.php?action=list');
        exit();
    }
    
    public function addGeoCodeFromPlanAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        
        $univers = $this->universManager->getUniversById((int)$input['univers_id']);
        
        $newId = $this->geoCodeManager->createGeoCode(
            $input['code_geo'],
            $input['libelle'],
            (int)$input['univers_id'],
            $univers['zone_assignee'],
            $input['commentaire']
        );

        if ($newId) {
            $newCode = $this->geoCodeManager->getGeoCodeById($newId);
            $newCode['univers'] = $univers['nom'];
            echo json_encode($newCode);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Could not create new geo code.']);
        }
        exit();
    }

    public function editAction() {
        $id = (int)($_GET['id'] ?? 0);
        $geoCode = $this->geoCodeManager->getGeoCodeById($id);
        if (!$geoCode) {
            header('Location: index.php?action=list');
            exit();
        }
        $universList = $this->universManager->getAllUnivers();
        $this->render('geo_codes_edit_view', [
            'geoCode' => $geoCode,
            'universList' => $universList
        ]);
    }

    public function updateAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $this->geoCodeManager->updateGeoCode(
                (int)$_POST['id'], $_POST['code_geo'], $_POST['libelle'], 
                (int)$_POST['univers_id'], $_POST['zone'], $_POST['commentaire']
            );
        }
        header('Location: index.php?action=list');
        exit();
    }

    public function deleteAction() {
        $id = (int)($_GET['id'] ?? 0);
        if ($id > 0) {
            $this->geoCodeManager->deleteGeoCode($id);
        }
        header('Location: index.php?action=list');
        exit();
    }
    
    public function trashAction() {
        $deletedGeoCodes = $this->geoCodeManager->getDeletedGeoCodes();
        $this->render('trash_view', ['deletedGeoCodes' => $deletedGeoCodes]);
    }

    public function restoreAction() {
        $id = (int)($_GET['id'] ?? 0);
        if ($id > 0) {
            $this->geoCodeManager->restoreGeoCode($id);
        }
        header('Location: index.php?action=trash');
        exit();
    }

    public function forceDeleteAction() {
        $id = (int)($_GET['id'] ?? 0);
        if ($id > 0) {
            $this->geoCodeManager->forceDeleteGeoCode($id);
        }
        header('Location: index.php?action=trash');
        exit();
    }

    public function historyAction() {
        $id = (int)($_GET['id'] ?? 0);
        $geoCode = $this->geoCodeManager->getGeoCodeById($id);
        if (!$geoCode) {
            header('Location: index.php?action=list');
            exit();
        }
        $history = $this->geoCodeManager->getHistoryForGeoCode($id);
        $this->render('history_view', ['geoCode' => $geoCode, 'history' => $history]);
    }

    public function fullHistoryAction() {
        $fullHistory = $this->geoCodeManager->getFullHistory();
        $this->render('full_history_view', ['history' => $fullHistory]);
    }

    public function showBatchCreateAction() {
        $universList = $this->universManager->getAllUnivers();
        $this->render('batch_create_view', ['universList' => $universList]);
    }

    public function handleBatchCreateAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $codes_geo = $_POST['codes_geo'] ?? [];
            $libelles = $_POST['libelles'] ?? [];
            $codesToInsert = [];
            for ($i = 0; $i < count($codes_geo); $i++) {
                if (!empty(trim($codes_geo[$i])) && !empty(trim($libelles[$i]))) {
                    $codesToInsert[] = [
                        'code_geo'   => trim($codes_geo[$i]), 
                        'libelle'    => trim($libelles[$i]), 
                        'univers_id' => (int)$_POST['univers_id'],
                        'zone'       => $_POST['zone'], 
                        'commentaire'=> null
                    ];
                }
            }
            if (!empty($codesToInsert)) {
                $this->geoCodeManager->createBatchGeoCodes($codesToInsert);
            }
        }
        header('Location: index.php?action=list');
        exit();
    }

    public function showExportAction() {
        $universList = $this->universManager->getAllUnivers();
        $this->render('export_view', ['universList' => $universList]);
    }

    public function handleExportAction() {
        $filters = [
            'zones' => $_POST['zones'] ?? [],
            'univers_ids' => $_POST['univers_ids'] ?? []
        ];
        
        $columns = $_POST['columns'] ?? ['code_geo', 'libelle', 'univers', 'zone', 'commentaire'];
        $format = $_POST['format'] ?? 'csv';
        $filename = preg_replace('/[^a-zA-Z0-9-_\.]/', '_', $_POST['filename'] ?? 'export');

        $data = $this->geoCodeManager->getFilteredGeoCodes($filters);

        if ($format === 'pdf') {
            $this->generatePdfExport($data, $columns, $filename);
        } else {
            $this->generateCsvExport($data, $columns, $filename);
        }
        exit();
    }
    
    private function generateCsvExport(array $data, array $columns, string $filename) {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '.csv"');
        
        $output = fopen('php://output', 'w');
        
        fputcsv($output, $columns, ';');
        
        foreach ($data as $row) {
            $line = [];
            foreach ($columns as $col) {
                $line[] = $row[$col] ?? '';
            }
            fputcsv($output, $line, ';');
        }
        
        fclose($output);
    }

    private function generatePdfExport(array $data, array $columns, string $filename) {
        // Cette méthode peut maintenant être considérée comme obsolète ou être adaptée
        // pour utiliser une autre librairie si besoin d'un vrai PDF serveur.
        // Pour l'instant, on peut laisser ce code, même s'il ne sera plus appelé.
        $pdf = new FPDF('L', 'mm', 'A4');
        $pdf->AddPage();
        $pdf->SetFont('Arial', 'B', 12);
        
        $pdf->Cell(0, 10, 'Export des Codes Geo', 0, 1, 'C');
        $pdf->Ln(5);

        $pdf->SetFont('Arial', 'B', 10);
        $pdf->SetFillColor(230, 230, 230);
        foreach ($columns as $header) {
            $pdf->Cell(40, 7, ucfirst($header), 1, 0, 'C', true);
        }
        $pdf->Ln();

        $pdf->SetFont('Arial', '', 10);
        foreach ($data as $row) {
            foreach ($columns as $col) {
                $cellData = mb_convert_encoding($row[$col] ?? '', 'ISO-8859-1', 'UTF-8');
                $pdf->Cell(40, 6, $cellData, 1);
            }
            $pdf->Ln();
        }

        $pdf->Output('D', $filename . '.pdf');
    }

    public function showImportAction() {
        $this->render('import_view');
    }

    public function handleImportAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['csvFile']) && $_FILES['csvFile']['error'] == UPLOAD_ERR_OK) {
            $csvFile = $_FILES['csvFile']['tmp_name'];
            $fileHandle = fopen($csvFile, 'r');
            
            $header = fgetcsv($fileHandle, 0, ';', '"', '\\');
            $allRows = [];
            $codesToCheck = [];

            while (($row = fgetcsv($fileHandle, 0, ';', '"', '\\')) !== false) {
                $data = array_combine($header, $row);
                if (!empty(trim($data['code_geo']))) {
                    $allRows[] = $data;
                    $codesToCheck[] = trim($data['code_geo']);
                }
            }
            fclose($fileHandle);

            $existingCodes = $this->geoCodeManager->getExistingCodes($codesToCheck);
            
            $codesToInsert = [];
            $duplicateCodes = [];

            foreach ($allRows as $rowData) {
                $currentCode = trim($rowData['code_geo']);
                if (in_array($currentCode, $existingCodes)) {
                    $duplicateCodes[] = $currentCode;
                } else {
                    $codesToInsert[] = [
                        'code_geo'    => $currentCode,
                        'libelle'     => $rowData['libelle'] ?? '',
                        'univers'     => $rowData['univers'] ?? 'Indéfini',
                        'zone'        => $rowData['zone'] ?? 'vente',
                        'commentaire' => $rowData['commentaire'] ?? null
                    ];
                    $existingCodes[] = $currentCode;
                }
            }
            
            if (!empty($codesToInsert)) {
                $this->geoCodeManager->createMultipleGeoCodes($codesToInsert, $this->universManager);
            }

            $message = "<strong>Rapport d'importation :</strong><br>"
                     . count($codesToInsert) . " nouveau(x) code(s) importé(s).<br>";
            
            if (!empty($duplicateCodes)) {
                $message .= "<strong>" . count(array_unique($duplicateCodes)) . " code(s) existai(en)t déjà et ont été ignoré(s) :</strong><br><ul>";
                foreach(array_unique($duplicateCodes) as $dup) {
                    $message .= "<li>" . htmlspecialchars($dup) . "</li>";
                }
                $message .= "</ul>";
            }
            
            $_SESSION['flash_message'] = ['type' => 'success', 'message' => $message];
        } else {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => "Erreur lors de l'envoi du fichier."];
        }
        
        header('Location: index.php?action=list');
        exit();
    }


    public function showPrintOptionsAction() {
        $universList = $this->universManager->getAllUnivers();
        $this->render('print_options_view', ['universList' => $universList]);
    }
    
    public function generatePrintPageAction() {
        $universIds = $_POST['univers_ids'] ?? [];
        $geoCodes = [];
        if (!empty($universIds)) {
            $geoCodes = $this->geoCodeManager->getGeoCodesByUniversIds(array_map('intval', $universIds));
        }
        
        $options = [
            'title'    => trim($_POST['print_title'] ?? 'Impression des Étiquettes'),
            'copies'   => (int)($_POST['copies'] ?? 1),
            'fields'   => $_POST['fields'] ?? ['qrcode', 'code_geo', 'libelle'],
            'template' => $_POST['template'] ?? 'qr-left'
        ];

        $groupedCodes = [];
        foreach ($geoCodes as $code) {
            $groupedCodes[$code['univers']][] = $code;
        }

        require __DIR__ . '/../views/print_page_view.php';
    }

    public function printSingleLabelAction() {
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            die("ID du code géo manquant ou invalide.");
        }

        $geoCode = $this->geoCodeManager->getGeoCodeById($id);

        if (!$geoCode) {
            die("Code géo non trouvé.");
        }

        $univers = $this->universManager->getUniversById($geoCode['univers_id']);
        $geoCode['univers'] = $univers['nom'] ?? 'N/A';
        
        require __DIR__ . '/../views/print_single_view.php';
    }
    
    public function getAllCodesJsonAction() {
        header('Content-Type: application/json');
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();
        echo json_encode($geoCodes);
        exit();
    }
}
