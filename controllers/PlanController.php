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

    /**
     * Récupère un tableau associatif des couleurs par nom d'univers.
     * @return array ['Nom Univers' => '#couleur', ...]
     */
    private function getUniversColors() {
        $allUnivers = $this->universManager->getAllUnivers();
        $universColors = [];
        foreach ($allUnivers as $u) {
            $universColors[$u['nom']] = $u['color'];
        }
        return $universColors;
    }

    /**
     * Affiche la page d'édition d'un plan (mode édition).
     * Gère le chargement différent pour SVG vs Image + Annotations.
     */
    public function manageCodesAction() {
        $planId = (int)($_GET['id'] ?? 0);
        $plan = $this->planManager->getPlanById($planId); // Récupère maintenant drawing_data
        if (!$plan) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Plan non trouvé.'];
            header('Location: index.php?action=listPlans');
            exit();
        }

        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();
        $planWithUniversIds = $this->planManager->getPlanWithUnivers($planId); // Récupère aussi drawing_data via getPlanById
        $universForPlan = [];
        if(!empty($planWithUniversIds['univers_ids'])) {
             $universForPlan = $this->universManager->getUniversByIds($planWithUniversIds['univers_ids']);
        }

        // Détermine le type de plan pour le JS
        $planType = 'image'; // Par défaut
        if (str_ends_with(strtolower($plan['nom_fichier']), '.svg')) {
            $planType = 'svg';
        }

        $this->render('plan_view', [
            'placedGeoCodes' => $geoCodes, // Sera filtré par le JS si besoin
            'plan' => $plan, // Contient id, nom, nom_fichier, zone, drawing_data
            'planType' => $planType, // Indique au JS comment charger le plan ('image' ou 'svg')
            'universList' => $universForPlan, // Uniquement les univers liés au plan
            'universColors' => $this->getUniversColors()
        ]);
    }

    /**
     * Affiche la page de consultation d'un plan (mode lecture seule).
     */
    public function viewPlanAction() {
        $planId = (int)($_GET['id'] ?? 0);
        $plan = $this->planManager->getPlanById($planId);
        if (!$plan) {
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Plan non trouvé.'];
            header('Location: index.php?action=listPlans');
            exit();
        }
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions(); // Récupère toutes les positions

        $this->render('plan_viewer_view', [
            'plan' => $plan,
            'placedGeoCodes' => $geoCodes, // Passé à la vue, sera filtré par JS si besoin
            'universColors' => $this->getUniversColors()
        ]);
    }

    /**
     * Génère la page HTML pour l'impression du plan avec les codes positionnés.
     */
    public function printPlanAction() {
        $planId = (int)($_GET['id'] ?? 0);
        $plan = $this->planManager->getPlanById($planId);
        if (!$plan) {
            die("Plan non trouvé.");
        }
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();
        $universColors = $this->getUniversColors();

        require __DIR__ . '/../views/plan_print_view.php';
    }

    /**
     * Retourne en JSON la liste des codes géo disponibles (associés via les univers) pour un plan donné.
     */
    public function getAvailableCodesForPlanAction() {
        header('Content-Type: application/json');
        $planId = (int)($_GET['id'] ?? 0);

        if ($planId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de plan invalide']);
            exit();
        }

        $availableCodes = $this->geoCodeManager->getAvailableCodesForPlan($planId);
        echo json_encode($availableCodes);
        exit();
    }

    /**
     * Enregistre (crée ou met à jour) la position d'un code géo sur un plan via une requête AJAX.
     * Retourne les données complètes de la position sauvegardée.
     */
    public function savePositionAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
	error_log('savePosition received: ' . print_r($input, true));
        // Utilise les clés envoyées par le JS ('pos_x', 'pos_y')
        if (isset($input['id'], $input['plan_id'], $input['pos_x'], $input['pos_y'])) {
            $savedData = $this->planManager->savePosition(
                (int)$input['id'],
                (int)$input['plan_id'],
                (float)$input['pos_x'], // Clé correcte
                (float)$input['pos_y'], // Clé correcte
                isset($input['width']) ? (int)$input['width'] : null,
                isset($input['height']) ? (int)$input['height'] : null,
                isset($input['anchor_x']) ? (float)$input['anchor_x'] : null,
                isset($input['anchor_y']) ? (float)$input['anchor_y'] : null,
                isset($input['position_id']) ? (int)$input['position_id'] : null
            );

            if ($savedData) {
                // Renvoyer les données complètes avec l'ID de position
                error_log('savePosition validation failed. Missing fields? id='.(isset($input['id'])?'yes':'NO').', plan_id='.(isset($input['plan_id'])?'yes':'NO').', pos_x='.(isset($input['pos_x'])?'yes':'NO').', pos_y='.(isset($input['pos_y'])?'yes':'NO'));
                echo json_encode(['status' => 'success', 'position_data' => $savedData]);
            } else {
                 http_response_code(500); // Erreur serveur
                echo json_encode(['status' => 'error', 'message' => 'Erreur lors de la sauvegarde de la position.']);
            }
        } else {
            http_response_code(400); // Mauvaise requête
            echo json_encode(['status' => 'error', 'message' => 'Données invalides pour savePosition']);
        }
        exit();
    }


    /**
     * Supprime une position spécifique d'un code géo sur un plan via une requête AJAX.
     */
    public function removePositionAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['id'])) {
            $success = $this->planManager->removePosition((int)$input['id']);
            echo json_encode(['status' => $success ? 'success' : 'error']);
        } else {
             http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'ID de position manquant']);
        }
        exit();
    }

    /**
     * Supprime TOUTES les positions d'un code géo donné sur un plan spécifique via AJAX.
     */
    public function removeMultiplePositionsAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['geo_code_id'], $input['plan_id'])) {
            $success = $this->planManager->removeMultiplePositionsByCodeId((int)$input['geo_code_id'], (int)$input['plan_id']);
            echo json_encode(['status' => $success ? 'success' : 'error']);
        } else {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Données invalides pour la suppression multiple.']);
        }
        exit();
    }

    /**
     * Sauvegarde plusieurs positions en une seule fois (non utilisé actuellement mais peut servir).
     * Retourne les données des positions créées.
     */
    public function saveMultiplePositionsAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['positions']) && is_array($input['positions']) && isset($input['plan_id'])) {
            $resultData = $this->planManager->saveMultiplePositions($input['positions'], (int)$input['plan_id']);
            if ($resultData !== false) {
                 echo json_encode(['status' => 'success', 'created_positions' => $resultData]);
            } else {
                 http_response_code(500);
                 echo json_encode(['status' => 'error', 'message' => 'Erreur lors de la sauvegarde multiple.']);
            }
        } else {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Données invalides pour la sauvegarde multiple']);
        }
        exit();
    }

     // --- Actions pour les plans eux-mêmes ---

    /**
     * Affiche la liste de tous les plans.
     */
    public function listPlansAction() {
        $plans = $this->planManager->getAllPlans();
        $this->render('plans_list_view', ['plans' => $plans]);
    }

    /**
     * Affiche le formulaire de modification d'un plan existant (métadonnées + fichier image).
     */
    public function editPlanAction() {
        $planId = (int)($_GET['id'] ?? 0);
        if ($planId <= 0) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'ID de plan invalide.'];
            header('Location: index.php?action=listPlans');
            exit();
        }
        // Utilise getPlanWithUnivers pour avoir les IDs univers associés
        $plan = $this->planManager->getPlanWithUnivers($planId);
        $allUnivers = $this->universManager->getAllUnivers();
        if (empty($plan)) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Plan non trouvé pour modification.'];
            header('Location: index.php?action=listPlans');
            exit();
        }
        // Cette vue est pour modifier nom, zone, univers et REMPLACER l'image/pdf/svg
        $this->render('plan_edit_view', ['plan' => $plan, 'allUnivers' => $allUnivers]);
    }

    /**
     * Traite la soumission du formulaire de modification d'un plan (métadonnées + fichier image).
     */
    public function updatePlanAction() {
        // Important: Cette action NE MODIFIE PAS le contenu d'un SVG ni les annotations JSON.
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            header('Location: index.php?action=listPlans');
            exit();
        }

        $planId = (int)($_POST['plan_id'] ?? 0);
        $nom = trim($_POST['nom'] ?? '');
        $zone = $_POST['zone'] ?? null;
        if ($zone === '') { $zone = null; }
        $universIds = $_POST['univers_ids'] ?? [];

        if ($planId <= 0 || empty($nom)) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Données de formulaire invalides.'];
            header('Location: index.php?action=listPlans');
            exit();
        }

        $currentPlan = $this->planManager->getPlanById($planId);
        if (!$currentPlan) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Plan original non trouvé.'];
            header('Location: index.php?action=listPlans');
            exit();
        }

        $newFilename = null;
        // Gestion du téléversement (y compris conversion PDF->PNG)
        if (isset($_FILES['planFile']) && $_FILES['planFile']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['planFile'];
            $uploadDir = __DIR__ . '/../public/uploads/plans/';
            $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $allowedExtensions = ['png', 'jpg', 'jpeg', 'svg', 'pdf'];

            if (!in_array($extension, $allowedExtensions)) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Format de fichier non supporté. Seuls PNG, JPG, SVG, PDF sont acceptés.'];
                 header('Location: index.php?action=editPlan&id=' . $planId);
                 exit();
            }

            $safeFilename = preg_replace('/[^a-zA-Z0-9-_\.]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
            $newFilenameBase = time() . '_' . $safeFilename;
            $destinationPath = '';

            if ($extension === 'pdf' && class_exists('Imagick')) {
                $newFilename = $newFilenameBase . '.png';
                $destinationPath = $uploadDir . $newFilename;
                try {
                    $imagick = new Imagick();
                    $imagick->readImage($file['tmp_name'] . '[0]'); // Prend la première page
                    $imagick->setImageFormat('png');
                    $imagick->writeImage($destinationPath);
                    $imagick->clear();
                    $imagick->destroy();
                } catch (Exception $e) {
                    $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur conversion PDF: ' . $e->getMessage()];
                    header('Location: index.php?action=editPlan&id=' . $planId);
                    exit();
                }
            } else if ($extension !== 'pdf') {
                $newFilename = $newFilenameBase . '.' . $extension;
                $destinationPath = $uploadDir . $newFilename;
                if (!move_uploaded_file($file['tmp_name'], $destinationPath)) {
                    $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors du déplacement du fichier téléversé.'];
                    header('Location: index.php?action=editPlan&id=' . $planId);
                    exit();
                }
            } else {
                 $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'La conversion PDF nécessite l\'extension Imagick sur le serveur.'];
                 header('Location: index.php?action=editPlan&id=' . $planId);
                 exit();
            }

            // Supprimer l'ancien fichier si le nouveau a été créé avec succès
            if ($newFilename && file_exists($uploadDir . $currentPlan['nom_fichier'])) {
                @unlink($uploadDir . $currentPlan['nom_fichier']);
            }

        } elseif (isset($_FILES['planFile']) && $_FILES['planFile']['error'] !== UPLOAD_ERR_NO_FILE) {
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors du téléversement du fichier (code: ' . $_FILES['planFile']['error'] . ').'];
             header('Location: index.php?action=editPlan&id=' . $planId);
             exit();
        }

        // Mise à jour BDD (uniquement nom, zone, univers, et nom_fichier si changé)
        if ($this->planManager->updatePlan($planId, $nom, $zone, $universIds, $newFilename)) {
            $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Le plan a été mis à jour avec succès.'];
        } else {
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur de base de données lors de la mise à jour du plan.'];
        }

        header('Location: index.php?action=listPlans');
        exit();
    }

    /**
     * Affiche le formulaire pour ajouter un nouveau plan (image/PDF/SVG).
     */
    public function addPlanFormAction() {
        $this->render('plan_add_view');
    }

    /**
     * Traite la soumission du formulaire d'ajout d'un nouveau plan (image/PDF/SVG).
     */
    public function addPlanAction() {
        // Cette fonction crée juste l'entrée de plan avec le fichier, sans dessin initial.
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['planFile']) && $_FILES['planFile']['error'] === UPLOAD_ERR_OK) {
            $nom = trim($_POST['nom'] ?? 'Nouveau Plan');
            if (empty($nom)) $nom = 'Nouveau Plan ' . date('Y-m-d');
            $file = $_FILES['planFile'];

            $uploadDir = __DIR__ . '/../public/uploads/plans/';
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);

            $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $allowedExtensions = ['png', 'jpg', 'jpeg', 'svg', 'pdf'];

            if (!in_array($extension, $allowedExtensions)) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Format de fichier non supporté.'];
                 header('Location: index.php?action=addPlanForm');
                 exit();
            }

            $safeFilename = preg_replace('/[^a-zA-Z0-9-_\.]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
            $newFilenameBase = time() . '_' . $safeFilename;
            $finalFilename = '';
            $destinationPath = '';

            if ($extension === 'pdf' && class_exists('Imagick')) {
                $finalFilename = $newFilenameBase . '.png';
                $destinationPath = $uploadDir . $finalFilename;
                try {
                    $imagick = new Imagick();
                    $imagick->readImage($file['tmp_name'] . '[0]');
                    $imagick->setImageFormat('png');
                    $imagick->writeImage($destinationPath);
                    $imagick->clear();
                    $imagick->destroy();
                } catch (Exception $e) { /* ... gestion erreur ... */ exit(); }
            } else if ($extension !== 'pdf') { // Pour PNG, JPG, JPEG, SVG
                $finalFilename = $newFilenameBase . '.' . $extension;
                $destinationPath = $uploadDir . $finalFilename;
                if (!move_uploaded_file($file['tmp_name'], $destinationPath)) { /* ... gestion erreur ... */ exit(); }
            } else { /* ... gestion erreur Imagick manquant ... */ exit(); }

            if ($finalFilename) {
                if ($this->planManager->addPlan($nom, $finalFilename)) {
                    $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Plan ajouté avec succès.'];
                } else {
                     $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur base de données lors de l\'ajout du plan.'];
                     if(file_exists($destinationPath)) @unlink($destinationPath);
                }
            }
        } else {
             $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Aucun fichier envoyé ou erreur de téléversement.'];
        }
        header('Location: index.php?action=listPlans');
        exit();
    }

    /**
     * Supprime un plan et son fichier associé.
     */
    public function deletePlanAction() {
        $id = (int)($_GET['id'] ?? 0);
        $plan = $this->planManager->getPlanById($id);
        if ($plan) {
            $filePath = __DIR__ . '/../public/uploads/plans/' . $plan['nom_fichier'];
            if ($this->planManager->deletePlan($id)) {
                 if (file_exists($filePath)) @unlink($filePath);
                 $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Plan supprimé avec succès.'];
            } else { $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur base de données lors de la suppression.']; }
        } else { $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Plan non trouvé.']; }
        header('Location: index.php?action=listPlans');
        exit();
    }

    // --- NOUVELLES ACTIONS POUR LE DESSIN ---

    /**
     * Action pour afficher la page de création d'un plan SVG vierge.
     */
    public function createBlankPlanAction() {
        // Pas besoin de données spécifiques pour cette vue initialement
        $this->render('plan_create_svg_view'); // Assurez-vous que cette vue existe
    }

    /**
     * Sauvegarde les données de dessin (annotations JSON) via AJAX.
     */
    public function saveDrawingAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);

        if (isset($input['plan_id'])) {
            $planId = (int)$input['plan_id'];
            // Le JSON peut être null si tous les dessins sont effacés
            $jsonData = isset($input['drawing_data']) ? json_encode($input['drawing_data']) : null;

            $success = $this->planManager->saveDrawingData($planId, $jsonData);
            echo json_encode(['status' => $success ? 'success' : 'error']);
        } else {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Données invalides pour saveDrawing']);
        }
        exit();
    }

    /**
     * Crée un nouveau plan à partir de données SVG via AJAX.
     */
    public function createSvgPlanAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);

        $nom = trim($input['nom'] ?? '');
        $svgContent = $input['svgContent'] ?? null;

        if (!empty($nom) && $svgContent) {
            $newPlanId = $this->planManager->savePlanAsSvg($nom, $svgContent);
            if ($newPlanId) {
                echo json_encode(['status' => 'success', 'new_plan_id' => $newPlanId]);
            } else {
                http_response_code(500);
                echo json_encode(['status' => 'error', 'message' => 'Erreur serveur lors de la création du plan SVG']);
            }
        } else {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Nom ou contenu SVG manquant']);
        }
        exit();
    }

    /**
     * Met à jour un plan SVG existant via AJAX.
     */
    public function updateSvgPlanAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);

        if (isset($input['plan_id']) && isset($input['svgContent'])) {
            $planId = (int)$input['plan_id'];
            $svgContent = $input['svgContent'];

            $success = $this->planManager->updateSvgPlan($planId, $svgContent);
            if ($success) {
                echo json_encode(['status' => 'success']);
            } else {
                http_response_code(500);
                echo json_encode(['status' => 'error', 'message' => 'Erreur serveur lors de la mise à jour du plan SVG']);
            }
        } else {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'ID de plan ou contenu SVG manquant pour la mise à jour']);
        }
        exit();
    }


    // --- Actions Historique ---
    public function getHistoryAction() {
        header('Content-Type: application/json');
        $planId = (int)($_GET['plan_id'] ?? 0);
        if ($planId > 0) {
            $history = $this->planManager->getHistoryForPlan($planId, 50); // Limite augmentée
            echo json_encode($history);
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'ID de plan invalide']);
        }
        exit();
    }

    public function restorePositionAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        $historyId = (int)($input['history_id'] ?? 0);
        if ($historyId <= 0) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'ID d\'historique invalide']);
            exit();
        }

        $historyEntry = $this->planManager->getHistoryEntry($historyId);
        if (!$historyEntry) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Entrée d\'historique non trouvée']);
            exit();
        }

        // Pour une restauration, on crée/met à jour une position avec les anciennes coordonnées
        // C'est conceptuellement une nouvelle action "placée" ou "déplacée"
        $savedData = $this->planManager->savePosition(
            $historyEntry['geo_code_id'],
            $historyEntry['plan_id'],
            $historyEntry['pos_x'],
            $historyEntry['pos_y']
            // Note: les autres attributs (width, height, anchor) ne sont pas dans l'historique simple
        );

        if ($savedData) {
            echo json_encode(['status' => 'success', 'position_data' => $savedData]);
        } else {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Erreur lors de la restauration de la position.']);
        }
        exit();
    }
}
