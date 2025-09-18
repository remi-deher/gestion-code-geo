<?php

require_once '../models/GeoCodeManager.php';

class GeoCodeController {
    
    private $manager;

    public function __construct(PDO $db) {
        $this->manager = new GeoCodeManager($db);
    }

    public function listAction() {
        $geoCodes = $this->manager->getAllGeoCodesWithPositions();
        $univers = $this->manager->getDistinctUnivers(); // Pour les filtres
        require '../views/geo_codes_list_view.php';
    }

    public function createAction() {
        require '../views/geo_codes_create_view.php';
    }

    public function addAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $code_geo = trim($_POST['code_geo'] ?? '');
            $libelle = trim($_POST['libelle'] ?? '');
            $univers = trim($_POST['univers'] ?? '');
            $zone = $_POST['zone'] ?? '';
            $commentaire = trim($_POST['commentaire'] ?? null);

            if (!empty($code_geo) && !empty($libelle) && !empty($univers) && !empty($zone)) {
                $this->manager->createGeoCode($code_geo, $libelle, $univers, $zone, $commentaire);
            }
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
            if ($success) {
                echo json_encode(['status' => 'success']);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Database error']);
            }
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid data']);
        }
        exit();
    }

    /**
     * NOUVELLE ACTION : Gère l'export des données en CSV.
     */
    public function exportAction() {
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="export_geocodes_'.date('Y-m-d').'.csv"');

        $geoCodes = $this->manager->getAllGeoCodesWithPositions();
        $output = fopen('php://output', 'w');

        // En-tête du CSV
        fputcsv($output, ['code_geo', 'libelle', 'univers', 'zone', 'commentaire']);

        // Données
        foreach ($geoCodes as $code) {
            fputcsv($output, [
                $code['code_geo'],
                $code['libelle'],
                $code['univers'],
                $code['zone'],
                $code['commentaire']
            ]);
        }
        fclose($output);
        exit();
    }

    /**
     * NOUVELLE ACTION : Affiche le formulaire d'import.
     */
    public function showImportAction() {
        require '../views/import_view.php';
    }

    /**
     * NOUVELLE ACTION : Traite le fichier CSV importé.
     */
    public function handleImportAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['csvFile'])) {
            $file = $_FILES['csvFile']['tmp_name'];
            $handle = fopen($file, "r");

            // Ignorer la ligne d'en-tête
            fgetcsv($handle, 1000, ","); 

            $codesToInsert = [];
            while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                $codesToInsert[] = [
                    'code_geo' => $data[0] ?? '',
                    'libelle' => $data[1] ?? '',
                    'univers' => $data[2] ?? '',
                    'zone' => $data[3] ?? '',
                    'commentaire' => $data[4] ?? null
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
    
    /**
     * NOUVELLE ACTION : Affiche la page d'impression des étiquettes.
     */
    public function printLabelsAction() {
        $geoCodes = $this->manager->getAllGeoCodesWithPositions();
        require '../views/print_labels_view.php';
    }
}
