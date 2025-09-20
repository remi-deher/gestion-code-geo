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

    /**
     * NOUVELLE ACTION pour la sauvegarde multiple
     */
    public function saveMultiplePositionsAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['positions']) && is_array($input['positions']) && isset($input['plan_id'])) {
            $success = $this->planManager->saveMultiplePositions($input['positions'], (int)$input['plan_id']);
            echo json_encode(['status' => $success ? 'success' : 'error']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid data for multi-save']);
        }
        exit();
    }

    public function listPlansAction() {
        $plans = $this->planManager->getAllPlans();
        $this->render('plans_list_view', ['plans' => $plans]);
    }

    public function addPlanAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['planFile'])) {
            $nom = trim($_POST['nom'] ?? 'Nouveau plan');
            $file = $_FILES['planFile'];

            if ($file['error'] === UPLOAD_ERR_OK && !empty($nom)) {
                $uploadDir = __DIR__ . '/../public/uploads/plans/';
                if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);

                $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
                $safeFilename = preg_replace('/[^a-zA-Z0-9-_\.]/','_', basename($file['name'], "." . $extension));
                $newFilenameBase = time() . '_' . $safeFilename;
                
                $finalFilename = $newFilenameBase . '.png';
                $destination = $uploadDir . $finalFilename;

                if ($extension === 'pdf' && class_exists('Imagick')) {
                    try {
                        $imagick = new Imagick();
                        $imagick->readImage($file['tmp_name'] . '[0]');
                        $imagick->setImageFormat('png');
                        $imagick->writeImage($destination);
                        $imagick->clear();
                        $imagick->destroy();
                    } catch (Exception $e) { /* Gérer l'erreur */ }
                } else if (in_array($extension, ['png', 'jpg', 'jpeg'])) {
                    move_uploaded_file($file['tmp_name'], $destination);
                }
                $this->planManager->addPlan($nom, $finalFilename);
            }
        }
        header('Location: index.php?action=listPlans');
        exit();
    }

    public function deletePlanAction() {
        $id = (int)($_GET['id'] ?? 0);
        $plan = $this->planManager->getPlanById($id);
        if ($plan) {
            $filePath = __DIR__ . '/../public/uploads/plans/' . $plan['nom_fichier'];
            if (file_exists($filePath)) unlink($filePath);
            $this->planManager->deletePlan($id);
        }
        header('Location: index.php?action=listPlans');
        exit();
    }
}
