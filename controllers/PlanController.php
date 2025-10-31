<?php
// Fichier: controllers/PlanController.php

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/PlanManager.php';
require_once __DIR__ . '/../models/UniversManager.php'; // Utile pour les formulaires d'ajout/modif
require_once __DIR__ . '/../models/GeoCodeManager.php'; // Utile pour l'éditeur

class PlanController extends BaseController {

    private $planManager;
    private $universManager;
    private $geoCodeManager;

    public function __construct(PDO $db) {
        $this->planManager = new PlanManager($db);
        $this->universManager = new UniversManager($db);
        $this->geoCodeManager = new GeoCodeManager($db);
    }

    /**
     * Affiche la liste des plans.
     */
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

    /**
     * Affiche le formulaire d'ajout d'un nouveau plan.
     */
    public function addPlanFormAction() {
        $universList = $this->universManager->getAllUnivers();
        $this->render('plan_add_view', ['universList' => $universList]);
    }

    /**
     * Traite l'ajout d'un nouveau plan (upload et enregistrement BDD) ou la création d'un plan vide.
     */
public function handleAddPlanAction() {
        // Validation minimale commune
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' || empty($_POST['nom']) || empty($_POST['page_format'])) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur: Le nom et le format de page sont obligatoires.'];
            header('Location: index.php?action=addPlanForm');
            exit();
        }

        $creationMode = $_POST['creation_mode'] ?? 'import';
        $nom = trim($_POST['nom']);
        $description = trim($_POST['description'] ?? '');
        $zone = empty($_POST['zone']) ? null : $_POST['zone'];
        $pageFormat = $_POST['page_format']; // Format de page sélectionné

        $planId = false;

        if ($creationMode === 'import') {
            // --- MODE IMPORT ---
            
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

            // Univers pour l'import
            $universIds = isset($_POST['univers_ids']) ? array_map('intval', $_POST['univers_ids']) : [];

            // Générer un nom de fichier unique et déplacer
            $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $safeFilename = substr(preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($file['name'], PATHINFO_FILENAME)), 0, 100);
            $uniqueFilename = $safeFilename . '_' . uniqid() . '.' . $extension;
            $destination = $uploadDir . $uniqueFilename;

            if (move_uploaded_file($file['tmp_name'], $destination)) {
                 // Passer le pageFormat sélectionné
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
            // --- MODE DESSIN "FROM SCRATCH" ---
            
            $nomFichier = 'scratch_' . uniqid() . '.svg'; // Fichier SVG vide (non créé physiquement, juste une référence)
            $planType = 'drawing'; // Type pour plans dessinés
            
            // Univers pour le dessin
            $universIds = isset($_POST['univers_ids_draw']) ? array_map('intval', $_POST['univers_ids_draw']) : [];
            
            $drawingData = null; // Sera initialisé dans l'éditeur.

            // Passer le pageFormat sélectionné
            $planId = $this->planManager->addPlan($nom, $nomFichier, $planType, $description, $zone, $universIds, $drawingData, $pageFormat);
        } else {
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Mode de création invalide.'];
             header('Location: index.php?action=addPlanForm');
             exit();
        }

        // Redirection finale
        if ($planId) {
            $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Plan créé. Redirection vers l\'éditeur.'];
            // Rediriger directement vers l'éditeur pour les deux modes
            header('Location: index.php?action=viewPlan&id=' . $planId);
        } else {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de l\'enregistrement du plan en base de données.'];
            header('Location: index.php?action=addPlanForm');
        }
        exit();
    }


    /**
     * Affiche le formulaire de modification d'un plan existant.
     */
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

    /**
     * Traite la mise à jour des métadonnées d'un plan.
     */
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
        // Récupérer le format de page s'il est envoyé (sera ajouté au formulaire d'édition plus tard)
        $pageFormat = $_POST['page_format'] ?? null;

        // Récupérer les données de dessin existantes pour ne pas les écraser
        $existingPlan = $this->planManager->getPlanById($id);
        $drawingData = $existingPlan['drawing_data'] ?? null;

        // Si le format de page n'est pas envoyé, conserver l'ancien
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

    /**
     * Supprime (soft delete) un plan.
     */
    public function deletePlanAction() {
        $id = (int)($_GET['id'] ?? 0);
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


    /**
     * Affiche l'interface unifiée de consultation/édition.
     */
    public function viewPlanAction() {
         $id = (int)($_GET['id'] ?? 0);
         $plan = $this->planManager->getPlanById($id);

         if (!$plan) {
             $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Plan non trouvé.'];
             header('Location: index.php?action=listPlans');
             exit();
         }

         // Récupérer les codes géo déjà placés sur CE plan AVEC leurs détails
         $placedGeoCodes = $this->geoCodeManager->getPositionsForPlanWithDetails($id);

         // Récupérer les codes géo disponibles pour CE plan
         $availableGeoCodes = $this->geoCodeManager->getAvailableCodesForPlan($id);

         // Récupérer les couleurs des univers
         $universList = $this->universManager->getAllUnivers();
         $universColors = array_column($universList, 'color', 'id');

         // Récupérer les assets (placeholder)
         $assets = [];

	 // Transmettre les données nécessaires à la vue de l'éditeur
         $viewData = [
             'currentPlan' => $plan,
             'placedGeoCodes' => $placedGeoCodes,
             'availableGeoCodes' => $availableGeoCodes,
             'universColors' => $universColors,
             'assets' => $assets, // Keep this if used elsewhere
             'csrfToken' => '', // If you use CSRF
             'title' => 'Plan: ' . htmlspecialchars($plan['nom']),
             // URLs for API calls (already present)
             'saveDrawingUrl' => 'index.php?action=apiSaveDrawing',
             'placeGeoCodeUrl' => 'index.php?action=apiPlaceGeoCode',
             'removeGeoCodeUrl' => 'index.php?action=apiRemoveGeoCode',
             'listAssetsUrl' => 'index.php?action=apiListAssets', // Ensure these are correct
             'getAssetUrl' => 'index.php?action=apiGetAsset',     // Ensure these are correct
             // --> NOUVELLE LIGNE <--
             'assetBaseUrl' => 'uploads/assets/' // Path relative to the public directory
         ];

         // Utiliser le troisième paramètre de render pour désactiver le layout
         $this->render('plan_editor_view', $viewData, false);
    }


     /**
      * Action API pour sauvegarder les données de dessin (JSON Fabric.js).
      */
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


    // --- Actions API pour la gestion des codes sur le plan ---

     /**
     * Action API pour ajouter/mettre à jour la position d'un code géo sur un plan.
     */
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
        
        // --- AJOUTER CETTE LIGNE ---
        $positionId = filter_var($input['position_id'] ?? null, FILTER_VALIDATE_INT); // Récupère l'ID de la position

        if ($planId <= 0 || $geoCodeId <= 0 || $posX === null || $posY === null) {
            http_response_code(400); echo json_encode(['success' => false, 'error' => 'Données invalides.']); exit();
        }
        
        // --- MODIFIER CETTE LIGNE ---
        // On passe $positionId (qui sera null si c'est un nouveau)
        $result = $this->geoCodeManager->setGeoCodePosition($geoCodeId, $planId, $posX, $posY, $positionId); 
        
        if ($result !== false) {
            echo json_encode(['success' => true, 'position_id' => $result, 'message' => 'Position enregistrée.']);
        } else {
            http_response_code(500); echo json_encode(['success' => false, 'error' => 'Erreur enregistrement position.']);
        }
        exit();
    }


     /**
      * Action API pour supprimer la position d'un code géo d'un plan.
      */
     public function removeGeoCodeAction() {
         header('Content-Type: application/json');
         if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
             http_response_code(405); echo json_encode(['success' => false, 'error' => 'Méthode POST requise.']); exit();
         }
         $input = json_decode(file_get_contents('php://input'), true);
         $planId = filter_var($input['plan_id'] ?? 0, FILTER_VALIDATE_INT);
         $geoCodeId = filter_var($input['geo_code_id'] ?? 0, FILTER_VALIDATE_INT);
         if ($planId <= 0 || $geoCodeId <= 0) {
             http_response_code(400); echo json_encode(['success' => false, 'error' => 'Données invalides.']); exit();
         }
         $success = $this->geoCodeManager->removeGeoCodePosition($geoCodeId, $planId);
         if ($success) {
             echo json_encode(['success' => true, 'message' => 'Position supprimée.']);
         } else {
             http_response_code(500); echo json_encode(['success' => false, 'error' => 'Erreur suppression position.']);
         }
         exit();
     }

     /**
     * Action API pour sauvegarder le format de page et le format si le plan est de type 'drawing'.
     */
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

        // Utiliser la méthode updatePlan pour mettre à jour les métadonnées spécifiques
        $success = $this->planManager->updatePlan(
            $planId,
            $plan['nom'], // Nom existant
            $plan['description'], // Description existante
            $plan['zone'], // Zone existante
            $this->planManager->getUniversIdsForPlan($planId), // IDs d'univers existants
            $plan['drawing_data'], // Données de dessin existantes
            $pageFormat // Nouveau format de page
        );

        if ($success) {
            echo json_encode(['success' => true, 'message' => 'Format de page sauvegardé.']);
        } else {
            http_response_code(500); echo json_encode(['success' => false, 'error' => 'Erreur lors de la mise à jour du format.']);
        }
        exit();
    }

    // --- Action Impression --- (Simplifiée)
    public function printPlanAction() {
        $id = (int)($_GET['id'] ?? 0);
        $plan = $this->planManager->getPlanById($id);
        if (!$plan) {
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Plan non trouvé pour l\'impression.'];
            header('Location: index.php?action=listPlans');
            exit();
        }
        $positions = $this->geoCodeManager->getPositionsForPlanWithDetails($id);
        // Utiliser 'print_plan_view.php'
        $this->render('print_plan_view', [
            'plan' => $plan,
            'positions' => $positions,
            'title' => 'Impression Plan: ' . htmlspecialchars($plan['nom'])
        ], false); // Ne pas utiliser le layout standard
    }

} // Fin de la classe
