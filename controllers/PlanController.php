<?php
// Fichier: controllers/PlanController.php

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/PlanManager.php';
require_once __DIR__ . '/../models/UniversManager.php';
require_once __DIR__ . '/../models/GeoCodeManager.php';

class PlanController extends BaseController {

    private $planManager;
    private $universManager;
    private $geoCodeManager;

    public function __construct(PDO $db) {
        $this->planManager = new PlanManager($db);
        $this->universManager = new UniversManager($db);
        $this->geoCodeManager = new GeoCodeManager($db);
    }

    public function listAction() {
        $plans = $this->planManager->getAllPlansWithUnivers();
        $uploadDir = __DIR__ . '/../public/uploads/plans/';
        if (!is_dir($uploadDir)) {
            if (!mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
                error_log("Impossible de créer le dossier d'upload : " . $uploadDir);
            }
        }
        $this->render('plans_list_view', ['plans' => $plans]);
    }

    public function addPlanFormAction() {
        $universList = $this->universManager->getAllUnivers();
        $this->render('plan_add_view', ['universList' => $universList]);
    }

    public function handleAddPlanAction() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' || empty($_POST['nom']) || empty($_POST['page_format'])) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur: Le nom et le format de page sont obligatoires.'];
            header('Location: index.php?action=addPlanForm');
            exit();
        }

        $creationMode = $_POST['creation_mode'] ?? 'import';
        $nom = trim($_POST['nom']);
        $description = trim($_POST['description'] ?? '');
        $zone = empty($_POST['zone']) ? null : $_POST['zone'];
        $pageFormat = $_POST['page_format'];

        $planId = false;

        if ($creationMode === 'import') {
            
            if (!isset($_FILES['planFile']) || $_FILES['planFile']['error'] !== UPLOAD_ERR_OK) {
                $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur: Fichier manquant ou erreur lors de l\'upload.'];
                header('Location: index.php?action=addPlanForm');
                exit();
            }

            $file = $_FILES['planFile'];
            $uploadDir = __DIR__ . '/../public/uploads/plans/';
            if (!is_dir($uploadDir) || !is_writable($uploadDir)) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur serveur: Dossier upload inaccessible.'];
                 header('Location: index.php?action=addPlanForm');
                 exit();
            }

            $allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'application/pdf'];
            $fileType = mime_content_type($file['tmp_name']);

            if (!in_array($fileType, $allowedTypes)) {
                $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Type de fichier non autorisé.'];
                header('Location: index.php?action=addPlanForm');
                exit();
            }

            $planType = 'image';
            if ($fileType === 'image/svg+xml') $planType = 'svg';
            if ($fileType === 'application/pdf') $planType = 'pdf';

            $universIds = isset($_POST['univers_ids']) ? array_map('intval', $_POST['univers_ids']) : [];

            $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $safeFilename = substr(preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($file['name'], PATHINFO_FILENAME)), 0, 100);
            $uniqueFilename = $safeFilename . '_' . uniqid() . '.' . $extension;
            $destination = $uploadDir . $uniqueFilename;

            if (move_uploaded_file($file['tmp_name'], $destination)) {
                 $planId = $this->planManager->addPlan($nom, $uniqueFilename, $planType, $description, $zone, $universIds, null, $pageFormat);
                if (!$planId) {
                    unlink($destination); 
                }
            } else {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors du déplacement du fichier uploadé.'];
                 header('Location: index.php?action=addPlanForm');
                 exit();
            }

        } else if ($creationMode === 'draw') {
            $nomFichier = 'scratch_' . uniqid() . '.svg';
            $planType = 'drawing';
            $universIds = isset($_POST['univers_ids_draw']) ? array_map('intval', $_POST['univers_ids_draw']) : [];
            $drawingData = null;
            $planId = $this->planManager->addPlan($nom, $nomFichier, $planType, $description, $zone, $universIds, $drawingData, $pageFormat);
        } else {
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Mode de création invalide.'];
             header('Location: index.php?action=addPlanForm');
             exit();
        }

        if ($planId) {
            $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Plan créé. Redirection vers l\'éditeur.'];
            header('Location: index.php?action=viewPlan&id=' . $planId);
        } else {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de l\'enregistrement du plan en base de données.'];
            header('Location: index.php?action=addPlanForm');
        }
        exit();
    }

    public function editPlanAction() {
        $id = (int)($_GET['id'] ?? 0);
        $plan = $this->planManager->getPlanById($id);
        if (!$plan) {
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Plan non trouvé.'];
            header('Location: index.php?action=listPlans');
            exit();
        }
        $universList = $this->universManager->getAllUnivers();
        $selectedUniversIds = $this->planManager->getUniversIdsForPlan($id);
        $this->render('plan_edit_view', [
            'plan' => $plan,
            'universList' => $universList,
            'selectedUniversIds' => $selectedUniversIds
        ]);
    }

    public function handleUpdatePlanAction() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' || empty($_POST['id']) || empty($_POST['nom'])) {
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur: Données manquantes pour la mise à jour.'];
             $id = $_POST['id'] ?? 0;
             header('Location: ' . ($id ? 'index.php?action=editPlan&id='.$id : 'index.php?action=listPlans'));
             exit();
        }

        $id = (int)$_POST['id'];
        $nom = trim($_POST['nom']);
        $description = trim($_POST['description'] ?? '');
        $zone = empty($_POST['zone']) ? null : $_POST['zone'];
        $universIds = isset($_POST['univers_ids']) ? array_map('intval', $_POST['univers_ids']) : [];
        $pageFormat = $_POST['page_format'] ?? null;

        $existingPlan = $this->planManager->getPlanById($id);
        $drawingData = $existingPlan['drawing_data'] ?? null;

        if ($pageFormat === null && $existingPlan) {
            $pageFormat = $existingPlan['page_format'];
        }

        $success = $this->planManager->updatePlan($id, $nom, $description, $zone, $universIds, $drawingData, $pageFormat);

        if ($success) {
            $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Plan mis à jour avec succès.'];
        } else {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la mise à jour du plan.'];
        }
        header('Location: index.php?action=listPlans');
        exit();
    }

    public function deletePlanAction() {
        // SÉCURITÉ POST
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Action non autorisée.'];
             header('Location: index.php?action=listPlans');
             exit();
        }

        $id = (int)($_POST['id'] ?? 0);
        if ($id > 0) {
            $success = $this->planManager->deletePlan($id);
            if ($success) {
                $_SESSION['flash_message'] = ['type' => 'info', 'message' => 'Plan mis à la corbeille.'];
            } else {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la suppression du plan.'];
            }
        } else {
             $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'ID de plan invalide pour la suppression.'];
        }
        header('Location: index.php?action=listPlans');
        exit();
    }


    public function viewPlanAction() {
         $id = (int)($_GET['id'] ?? 0);
         $plan = $this->planManager->getPlanById($id);

         if (!$plan) {
             $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Plan non trouvé.'];
             header('Location: index.php?action=listPlans');
             exit();
         }

         $placedGeoCodes = $this->geoCodeManager->getPositionsForPlanWithDetails($id);
         $availableGeoCodes = $this->geoCodeManager->getAvailableCodesForPlan($id);
         $universList = $this->universManager->getAllUnivers();
         $universColors = array_column($universList, 'color', 'id');
         $assets = [];

         $viewData = [
             'currentPlan' => $plan,
             'placedGeoCodes' => $placedGeoCodes,
             'availableGeoCodes' => $availableGeoCodes,
             'universColors' => $universColors,
             'assets' => $assets, 
             'csrfToken' => '', 
             'title' => 'Plan: ' . htmlspecialchars($plan['nom']),
             'saveDrawingUrl' => 'index.php?action=apiSaveDrawing',
             'placeGeoCodeUrl' => 'index.php?action=apiPlaceGeoCode',
             'removeGeoCodeUrl' => 'index.php?action=apiRemoveGeoCode',
             'listAssetsUrl' => 'index.php?action=apiListAssets', 
             'getAssetUrl' => 'index.php?action=apiGetAsset',     
             'assetBaseUrl' => 'uploads/assets/' 
         ];

         $this->render('plan_editor_view', $viewData, false);
    }


     public function saveDrawingAction() {
         header('Content-Type: application/json');
         if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
             http_response_code(405); echo json_encode(['success' => false, 'error' => 'Méthode POST requise.']); exit();
         }
         $input = json_decode(file_get_contents('php://input'), true);
         $planId = filter_var($input['plan_id'] ?? 0, FILTER_VALIDATE_INT);
         $drawingData = $input['drawing_data'] ?? null;
         if ($planId <= 0 || $drawingData === null) {
             http_response_code(400); echo json_encode(['success' => false, 'error' => 'Données invalides.']); exit();
         }
         json_decode($drawingData);
         if (json_last_error() !== JSON_ERROR_NONE) {
             http_response_code(400); echo json_encode(['success' => false, 'error' => 'Données de dessin JSON invalides.']); exit();
         }
         $success = $this->planManager->updatePlanDrawingData($planId, $drawingData);
         if ($success) {
             echo json_encode(['success' => true, 'message' => 'Dessin sauvegardé.']);
         } else {
             http_response_code(500); echo json_encode(['success' => false, 'error' => 'Erreur sauvegarde dessin.']);
         }
         exit();
     }

    public function placeGeoCodeAction() {
        header('Content-Type: application/json');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405); echo json_encode(['success' => false, 'error' => 'Méthode POST requise.']); exit();
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $planId = filter_var($input['plan_id'] ?? 0, FILTER_VALIDATE_INT);
        $geoCodeId = filter_var($input['geo_code_id'] ?? 0, FILTER_VALIDATE_INT);
        $posX = filter_var($input['pos_x'] ?? null, FILTER_VALIDATE_FLOAT);
        $posY = filter_var($input['pos_y'] ?? null, FILTER_VALIDATE_FLOAT);
        
        $positionId = filter_var($input['position_id'] ?? null, FILTER_VALIDATE_INT);

        if ($planId <= 0 || $geoCodeId <= 0 || $posX === null || $posY === null) {
            http_response_code(400); echo json_encode(['success' => false, 'error' => 'Données invalides.']); exit();
        }
        
        $result = $this->geoCodeManager->setGeoCodePosition($geoCodeId, $planId, $posX, $posY, $positionId); 
        
        if ($result !== false) {
            echo json_encode(['success' => true, 'position_id' => $result, 'message' => 'Position enregistrée.']);
        } else {
            http_response_code(500); echo json_encode(['success' => false, 'error' => 'Erreur enregistrement position.']);
        }
        exit();
    }

     public function removeGeoCodeAction() {
         header('Content-Type: application/json');
         if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
             http_response_code(405); echo json_encode(['success' => false, 'error' => 'Méthode POST requise.']); exit();
         }
         $input = json_decode(file_get_contents('php://input'), true);
         
         $planId = filter_var($input['plan_id'] ?? 0, FILTER_VALIDATE_INT);
         $geoCodeId = filter_var($input['geo_code_id'] ?? 0, FILTER_VALIDATE_INT);
         $positionId = filter_var($input['position_id'] ?? 0, FILTER_VALIDATE_INT);

         if ($planId <= 0 || $geoCodeId <= 0 || $positionId <= 0) {
             http_response_code(400); echo json_encode(['success' => false, 'error' => 'Données invalides (plan, code, ou position ID manquant).']); exit();
         }

         $success = $this->geoCodeManager->removeGeoCodePosition($geoCodeId, $planId, $positionId);
         
         if ($success) {
             echo json_encode(['success' => true, 'message' => 'Position supprimée.']);
         } else {
             http_response_code(500); echo json_encode(['success' => false, 'error' => 'Erreur suppression position.']);
         }
         exit();
     }

    public function savePageFormatAction() {
        header('Content-Type: application/json');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405); echo json_encode(['success' => false, 'error' => 'Méthode POST requise.']); exit();
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $planId = filter_var($input['plan_id'] ?? 0, FILTER_VALIDATE_INT);
        $pageFormat = trim($input['page_format'] ?? '');

        if ($planId <= 0 || empty($pageFormat)) {
            http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID du plan ou format de page manquant.']); exit();
        }

        $plan = $this->planManager->getPlanById($planId);
        if (!$plan) {
            http_response_code(404); echo json_encode(['success' => false, 'error' => 'Plan non trouvé.']); exit();
        }

        $success = $this->planManager->updatePlan(
            $planId,
            $plan['nom'], 
            $plan['description'], 
            $plan['zone'], 
            $this->planManager->getUniversIdsForPlan($planId), 
            $plan['drawing_data'], 
            $pageFormat 
        );

        if ($success) {
            echo json_encode(['success' => true, 'message' => 'Format de page sauvegardé.']);
        } else {
            http_response_code(500); echo json_encode(['success' => false, 'error' => 'Erreur lors de la mise à jour du format.']);
        }
        exit();
    }

    public function printPlanAction() {
        $id = (int)($_GET['id'] ?? 0);
        $plan = $this->planManager->getPlanById($id);
        if (!$plan) {
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Plan non trouvé pour l\'impression.'];
            header('Location: index.php?action=listPlans');
            exit();
        }
        $positions = $this->geoCodeManager->getPositionsForPlanWithDetails($id);
        $this->render('print_plan_view', [
            'plan' => $plan,
            'positions' => $positions,
            'title' => 'Impression Plan: ' . htmlspecialchars($plan['nom'])
        ], false); 
    }
}
