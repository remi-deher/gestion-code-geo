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
        $plans = $this->planManager->getAllPlans();
        $universList = $this->universManager->getAllUnivers();
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();

        $colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
        $universColors = [];
        $colorIndex = 0;
        foreach ($universList as $univers) {
            $universColors[$univers['nom']] = $colors[$colorIndex % count($colors)];
            $colorIndex++;
        }

        $this->render('plan_view', [
            'placedGeoCodes' => $geoCodes,
            'plans' => $plans,
            'universList' => $universList,
            'universColors' => $universColors
        ]);
    }

    public function getAvailableCodesForPlanAction() {
        header('Content-Type: application/json');
        $planId = (int)($_GET['id'] ?? 0);
        
        error_log("--- PlanController : Action getAvailableCodesForPlanAction appelée pour planId = $planId ---");

        if ($planId <= 0) {
            error_log("--- PlanController : ERREUR, ID de plan invalide. ---");
            echo json_encode(['error' => 'ID de plan invalide']);
            exit();
        }

        $availableCodes = $this->geoCodeManager->getAvailableCodesForPlan($planId);
        
        error_log("--- PlanController : Données reçues du Manager. Nombre de codes : " . count($availableCodes) . ". Envoi en JSON. ---");

        echo json_encode($availableCodes);
        exit();
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
    
    public function editPlanAction() {
        $planId = (int)($_GET['id'] ?? 0);
        if ($planId <= 0) {
            header('Location: index.php?action=listPlans');
            exit();
        }
        $plan = $this->planManager->getPlanWithUnivers($planId);
        $allUnivers = $this->universManager->getAllUnivers();
        if (empty($plan)) {
            header('Location: index.php?action=listPlans');
            exit();
        }
        $this->render('plan_edit_view', ['plan' => $plan, 'allUnivers' => $allUnivers]);
    }

    public function updatePlanAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $planId = (int)($_POST['plan_id'] ?? 0);
            $nom = trim($_POST['nom'] ?? '');
            $zone = $_POST['zone'] ?? null;
            if ($zone === '') { $zone = null; }
            $universIds = $_POST['univers_ids'] ?? [];
            if ($planId > 0 && !empty($nom)) {
                $this->planManager->updatePlanAssociations($planId, $nom, $zone, $universIds);
            }
        }
        header('Location: index.php?action=listPlans');
        exit();
    }

    public function addPlanAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['planFile'])) {
            $nom = trim($_POST['nom'] ?? 'Nouveau plan');
            $file = $_FILES['planFile'];
    
            if ($file['error'] === UPLOAD_ERR_OK && !empty($nom)) {
                $uploadDir = __DIR__ . '/../public/uploads/plans/';
                if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
    
                $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
                $safeFilename = preg_replace('/[^a-zA-Z0-9-_\.]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
                $newFilenameBase = time() . '_' . $safeFilename;
    
                $finalFilename = '';
                $destination = '';
    
                if ($extension === 'pdf' && class_exists('Imagick')) {
                    $finalFilename = $newFilenameBase . '.png';
                    $destination = $uploadDir . $finalFilename;
                    try {
                        $imagick = new Imagick();
                        $imagick->readImage($file['tmp_name'] . '[0]');
                        $imagick->setImageFormat('png');
                        $imagick->writeImage($destination);
                        $imagick->clear();
                        $imagick->destroy();
                    } catch (Exception $e) {
                        $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la conversion du PDF.'];
                        header('Location: index.php?action=listPlans');
                        exit();
                    }
                } else if (in_array($extension, ['svg', 'png', 'jpg', 'jpeg'])) {
                    $finalFilename = $newFilenameBase . '.' . $extension;
                    $destination = $uploadDir . $finalFilename;
                    move_uploaded_file($file['tmp_name'], $destination);
                } else {
                    $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Format de fichier non supporté.'];
                    header('Location: index.php?action=listPlans');
                    exit();
                }
    
                if ($finalFilename) {
                    $this->planManager->addPlan($nom, $finalFilename);
                }
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

    public function getHistoryAction() {
        header('Content-Type: application/json');
        $planId = (int)($_GET['id'] ?? 0);
        if ($planId > 0) {
            $history = $this->planManager->getHistoryForPlan($planId);
            echo json_encode($history);
        } else {
            echo json_encode([]);
        }
        exit();
    }

    public function restorePositionAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        $historyId = (int)($input['id'] ?? 0);

        if ($historyId > 0) {
            $historyEntry = $this->planManager->getHistoryEntry($historyId);
            if ($historyEntry) {
                if ($historyEntry['action_type'] === 'removed') {
                    $success = $this->planManager->removePosition($historyEntry['geo_code_id']);
                } else {
                    $success = $this->planManager->savePosition(
                        $historyEntry['geo_code_id'],
                        $historyEntry['plan_id'],
                        $historyEntry['pos_x'],
                        $historyEntry['pos_y']
                    );
                }
                echo json_encode(['status' => $success ? 'success' : 'error']);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'History entry not found']);
            }
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid history ID']);
        }
        exit();
    }
}
