<?php

require_once '../models/GeoCodeManager.php';

class GeoCodeController {
    
    private $manager;

    public function __construct(PDO $db) {
        $this->manager = new GeoCodeManager($db);
    }

    public function listAction() {
        $geoCodes = $this->manager->getAllGeoCodesWithPositions();
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
        // On récupère tous les codes avec leurs positions
        $geoCodes = $this->manager->getAllGeoCodesWithPositions();
        require '../views/plan_view.php';
    }

    /**
     * NOUVELLE ACTION : Gère la sauvegarde de la position d'une étiquette.
     * Reçoit les données en JSON et retourne une réponse en JSON.
     */
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
}

