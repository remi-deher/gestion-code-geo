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
                $codesToInsert[] = [
                    'code_geo'   => trim($codes_geo[$i]), 
                    'libelle'    => trim($libelles[$i]), 
                    'univers_id' => (int)$_POST['univers_id'],
                    'zone'       => $_POST['zone'], 
                    'commentaire'=> null
                ];
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
            // ... (la logique reste la même, mais on injecte le UniversManager)
            $this->geoCodeManager->createMultipleGeoCodes($codesToInsert, $this->universManager);
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
        $geoCodes = $this->geoCodeManager->getGeoCodesByUniversIds(array_map('intval', $universIds));
        
        $groupedCodes = [];
        foreach ($geoCodes as $code) {
            $groupedCodes[$code['univers']][] = $code;
        }

        // Note: Les pages d'impression n'utilisent pas le layout principal
        require __DIR__ . '/../views/print_page_view.php';
    }
}
