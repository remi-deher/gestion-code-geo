<?php
// Fichier: controllers/PlanController.php

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/PlanManager.php';
require_once __DIR__ . '/../models/GeoCodeManager.php';
require_once __DIR__ . '/../models/UniversManager.php';

class PlanController extends BaseController {

    private $planManager;
    private $geoCodeManager;
    private $universManager;

    public function __construct(PDO $db) {
        $this->planManager = new PlanManager($db);
        $this->geoCodeManager = new GeoCodeManager($db);
        $this->universManager = new UniversManager($db);
    }

    public function planAction() {
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();
        $plans = $this->planManager->getAllPlans();
        $universList = $this->universManager->getAllUnivers();

        $colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
        $universColors = [];
        $colorIndex = 0;
        foreach ($universList as $univers) {
            $universColors[$univers['nom']] = $colors[$colorIndex % count($colors)];
            $colorIndex++;
        }

        $this->render('plan_view', [
            'geoCodes' => $geoCodes,
            'plans' => $plans,
            'universList' => $universList,
            'universColors' => $universColors
        ]);
    }

    public function savePositionAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['id'], $input['plan_id'], $input['x'], $input['y'])) {
            $success = $this->planManager->savePosition((int)$input['id'], (int)$input['plan_id'], (int)$input['x'], (int)$input['y']);
            echo json_encode(['status' => $success ? 'success' : 'error']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid data']);
        }
        exit();
    }

    public function removePositionAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['id'])) {
            $success = $this->planManager->removePosition((int)$input['id']);
            echo json_encode(['status' => $success ? 'success' : 'error']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid data']);
        }
        exit();
    }

    public function listPlansAction() {
        $plans = $this->planManager->getAllPlans();
        $this->render('plans_list_view', ['plans' => $plans]);
    }

    public function addPlanAction() {
        // ... (logique de addPlanAction de l'ancien GeoCodeController)
        header('Location: index.php?action=listPlans');
        exit();
    }

    public function deletePlanAction() {
        // ... (logique de deletePlanAction de l'ancien GeoCodeController)
        header('Location: index.php?action=listPlans');
        exit();
    }
}
