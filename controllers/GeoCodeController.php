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
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();
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

    // --- Actions pour l'Import/Export et l'impression ---
    public function exportAction() {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="export_geocodes_'.date('Y-m-d').'.csv"');
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();
        $output = fopen('php://output', 'w');
        fputcsv($output, ['code_geo', 'libelle', 'univers', 'zone', 'commentaire'], ';');
        foreach ($geoCodes as $code) {
            fputcsv($output, [ $code['code_geo'], $code['libelle'], $code['univers'], $code['zone'], $code['commentaire'] ], ';');
        }
        fclose($output);
        exit();
    }

    public function showImportAction() {
        $this->render('import_view');
    }

    public function handleImportAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['csvFile']) && $_FILES['csvFile']['error'] == UPLOAD_ERR_OK) {
            $csvFile = $_FILES['csvFile']['tmp_name'];
            $fileHandle = fopen($csvFile, 'r');
            $header = fgetcsv($fileHandle, 0, ';');
            $codesToInsert = [];

            while (($row = fgetcsv($fileHandle, 0, ';')) !== false) {
                $data = array_combine($header, $row);
                $codesToInsert[] = [
                    'code_geo' => $data['code_geo'] ?? '',
                    'libelle' => $data['libelle'] ?? '',
                    'univers' => $data['univers'] ?? 'Indéfini',
                    'zone' => $data['zone'] ?? 'vente',
                    'commentaire' => $data['commentaire'] ?? null
                ];
            }
            fclose($fileHandle);
            
            if (!empty($codesToInsert)) {
                $this->geoCodeManager->createMultipleGeoCodes($codesToInsert, $this->universManager);
            }
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

    public function generatePdfAction() {
        require_once __DIR__ . '/../helpers/PdfGenerator.php';

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

        if (empty($groupedCodes)) {
            die("Aucun code à imprimer pour la sélection effectuée.");
        }

        $pdfGenerator = new PdfGenerator();
        $pdfGenerator->generateLabelsPdf($groupedCodes, $options);
    }
    
    // NOUVELLE MÉTHODE POUR L'API
    public function getAllCodesJsonAction() {
        header('Content-Type: application/json');
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();
        echo json_encode($geoCodes);
        exit();
    }
}
