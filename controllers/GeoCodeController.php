<?php
// Fichier : controllers/GeoCodeController.php

require_once '../models/GeoCodeManager.php';

class GeoCodeController {
    
    private $manager;

    public function __construct(PDO $db) {
        $this->manager = new GeoCodeManager($db);
    }

    // --- Actions pour les Codes Géo ---
    public function listAction() {
        $geoCodes = $this->manager->getAllGeoCodesWithPositions();
        $univers = $this->manager->getAllUnivers();
        require '../views/geo_codes_list_view.php';
    }

    public function createAction() {
        $universList = $this->manager->getAllUnivers();
        require '../views/geo_codes_create_view.php';
    }

    public function addAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $code_geo = trim($_POST['code_geo'] ?? '');
            $libelle = trim($_POST['libelle'] ?? '');
            $univers_id = (int)($_POST['univers_id'] ?? 0);
            $zone = $_POST['zone'] ?? '';
            $commentaire = trim($_POST['commentaire'] ?? null);

            if (!empty($code_geo) && !empty($libelle) && !empty($univers_id) && !empty($zone)) {
                $this->manager->createGeoCode($code_geo, $libelle, $univers_id, $zone, $commentaire);
            }
        }
        header('Location: index.php?action=list');
        exit();
    }

    public function editAction() {
        $id = (int)($_GET['id'] ?? 0);
        $geoCode = $this->manager->getGeoCodeById($id);
        if (!$geoCode) {
            header('Location: index.php?action=list');
            exit();
        }
        $universList = $this->manager->getAllUnivers();
        require '../views/geo_codes_edit_view.php';
    }

    public function updateAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $id = (int)$_POST['id'];
            $code_geo = trim($_POST['code_geo'] ?? '');
            $libelle = trim($_POST['libelle'] ?? '');
            $univers_id = (int)$_POST['univers_id'];
            $zone = $_POST['zone'] ?? '';
            $commentaire = trim($_POST['commentaire'] ?? null);

            if (!empty($id) && !empty($code_geo) && !empty($libelle) && !empty($univers_id) && !empty($zone)) {
                $this->manager->updateGeoCode($id, $code_geo, $libelle, $univers_id, $zone, $commentaire);
            }
        }
        header('Location: index.php?action=list');
        exit();
    }

    public function deleteAction() {
        $id = (int)($_GET['id'] ?? 0);
        if ($id > 0) {
            $this->manager->deleteGeoCode($id);
        }
        header('Location: index.php?action=list');
        exit();
    }

    // --- Actions pour le Plan ---
    public function planAction() {
        $geoCodes = $this->manager->getAllGeoCodesWithPositions();
        require '../views/plan_view.php';
    }

    public function savePositionAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['id'], $input['x'], $input['y'])) {
            $success = $this->manager->savePosition((int)$input['id'], (int)$input['x'], (int)$input['y']);
            echo json_encode(['status' => $success ? 'success' : 'error']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid data']);
        }
        exit();
    }

    // --- Actions pour l'Import/Export (CORRIGÉES) ---
    public function exportAction() {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="export_geocodes_'.date('Y-m-d').'.csv"');
        
        $geoCodes = $this->manager->getAllGeoCodesWithPositions();
        $output = fopen('php://output', 'w');
        fputcsv($output, ['code_geo', 'libelle', 'univers', 'zone', 'commentaire']);
        foreach ($geoCodes as $code) {
            fputcsv($output, [
                $code['code_geo'], $code['libelle'], $code['univers'], $code['zone'], $code['commentaire']
            ]);
        }
        fclose($output);
        exit();
    }

    public function showImportAction() {
        require '../views/import_view.php';
    }

    public function handleImportAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['csvFile']) && $_FILES['csvFile']['error'] == UPLOAD_ERR_OK) {
            $file = $_FILES['csvFile']['tmp_name'];
            $handle = fopen($file, "r");
            fgetcsv($handle, 1000, ","); // Ignore header row
            $codesToInsert = [];
            while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                if (isset($data[0], $data[1], $data[2], $data[3])) { // Basic validation
                    $codesToInsert[] = [
                        'code_geo'    => $data[0],
                        'libelle'     => $data[1],
                        'univers'     => $data[2],
                        'zone'        => $data[3],
                        'commentaire' => $data[4] ?? null
                    ];
                }
            }
            fclose($handle);
            if (!empty($codesToInsert)) {
                $this->manager->createMultipleGeoCodes($codesToInsert);
            }
        }
        header('Location: index.php?action=list');
        exit();
    }
    
    // --- Actions pour l'Impression ---
    public function showPrintOptionsAction() {
        $universList = $this->manager->getAllUnivers();
        require '../views/print_options_view.php';
    }
    
    public function generatePrintPageAction() {
        $universIds = $_POST['univers_ids'] ?? [];
        $groupedCodes = [];
        if (!empty($universIds)) {
            $universIds = array_map('intval', $universIds);
            $geoCodes = $this->manager->getGeoCodesByUniversIds($universIds);
            foreach ($geoCodes as $code) {
                $groupedCodes[$code['univers']][] = $code;
            }
        }
        require '../views/print_page_view.php';
    }

    // --- Actions pour les Univers ---
    public function listUniversAction() {
        $universList = $this->manager->getAllUnivers();
        require '../views/univers_list_view.php';
    }

    public function addUniversAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $nom = trim($_POST['nom'] ?? '');
            $zone = $_POST['zone_assignee'] ?? 'vente';
            if (!empty($nom)) {
                $this->manager->addUnivers($nom, $zone);
            }
        }
        header('Location: index.php?action=listUnivers');
        exit();
    }

    public function deleteUniversAction() {
        $id = (int)($_GET['id'] ?? 0);
        $this->manager->deleteUnivers($id);
        header('Location: index.php?action=listUnivers');
        exit();
    }
    
    public function updateUniversZoneAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (isset($input['id'], $input['zone'])) {
            $success = $this->manager->updateUniversZone((int)$input['id'], $input['zone']);
            echo json_encode(['status' => $success ? 'success' : 'error']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Données invalides']);
        }
        exit();
    }
}
