<?php

require_once '../models/GeoCodeManager.php';

class GeoCodeController {
    
    private $manager;

    public function __construct(PDO $db) {
        $this->manager = new GeoCodeManager($db);
    }

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

    /**
     * Gère la suppression d'un code géo.
     */
    public function deleteAction() {
        $id = (int)($_GET['id'] ?? 0);
        if ($id > 0) {
            $this->manager->deleteGeoCode($id);
        }
        header('Location: index.php?action=list');
        exit();
    }

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

    public function exportAction() {
        header('Content-Type: text/csv');
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

    /**
     * NOUVELLE ACTION : Affiche la page des options d'impression.
     */
    public function showPrintOptionsAction() {
        $universList = $this->manager->getAllUnivers();
        require '../views/print_options_view.php';
    }
    
    /**
     * NOUVELLE ACTION : Génère la page d'impression finale à partir des univers sélectionnés.
     */
    public function generatePrintPageAction() {
        $universIds = $_POST['univers_ids'] ?? [];
        $groupedCodes = [];

        if (!empty($universIds)) {
            // S'assure que tous les IDs sont des entiers pour la sécurité
            $universIds = array_map('intval', $universIds);
            $geoCodes = $this->manager->getGeoCodesByUniversIds($universIds);
            
            // On groupe les codes par univers pour l'affichage
            foreach ($geoCodes as $code) {
                $groupedCodes[$code['univers']][] = $code;
            }
        }
        
        require '../views/print_page_view.php';
    }

    public function showImportAction() {
        require '../views/import_view.php';
    }

    public function handleImportAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['csvFile']) && $_FILES['csvFile']['error'] == UPLOAD_ERR_OK) {
            $file = $_FILES['csvFile']['tmp_name'];
            $handle = fopen($file, "r");
            fgetcsv($handle, 1000, ","); // Ignorer l'en-tête
            $codesToInsert = [];
            while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                $codesToInsert[] = [
                    'code_geo' => $data[0] ?? '', 'libelle' => $data[1] ?? '', 'univers' => $data[2] ?? '',
                    'zone' => $data[3] ?? '', 'commentaire' => $data[4] ?? null
                ];
            }
            fclose($handle);
            if (!empty($codesToInsert)) {
                $this->manager->createMultipleGeoCodes($codesToInsert);
            }
        }
        header('Location: index.php?action=list');
        exit();
    }
    
    public function printLabelsAction() {
        $geoCodes = $this->manager->getAllGeoCodesWithPositions();
        require '../views/print_labels_view.php';
    }

    // --- ACTIONS POUR LES UNIVERS ---

    public function listUniversAction() {
        $universList = $this->manager->getAllUnivers();
        require '../views/univers_list_view.php';
    }

    public function addUniversAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $nom = trim($_POST['nom'] ?? '');
            if (!empty($nom)) {
                $this->manager->addUnivers($nom);
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
}
