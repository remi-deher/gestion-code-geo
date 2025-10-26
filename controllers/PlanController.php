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
        // S'assurer que le dossier d'upload existe
        $uploadDir = __DIR__ . '/../public/uploads/plans/';
        if (!is_dir($uploadDir)) {
            // Tente de créer le dossier récursivement
            if (!mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
                // Si la création échoue, enregistrer une erreur ou afficher un message
                error_log("Impossible de créer le dossier d'upload : " . $uploadDir);
                // Optionnel : Afficher un message à l'utilisateur via session flash
                // $_SESSION['flash_message'] = ['type' => 'danger', 'message' 'Erreur de configuration serveur: Dossier uploads inaccessible.'];
            }
        }
        $this->render('plans_list_view', ['plans' => $plans]);
    }

    /**
     * Affiche le formulaire d'ajout d'un nouveau plan.
     */
    public function addPlanFormAction() {
        $universList = $this->universManager->getAllUnivers();
        // Note : Vous devrez créer la vue 'plan_add_view.php' plus tard
        $this->render('plan_add_view', ['universList' => $universList]);
    }

    /**
     * Traite l'ajout d'un nouveau plan (upload et enregistrement BDD).
     */
    public function handleAddPlanAction() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' || empty($_POST['nom']) || !isset($_FILES['planFile']) || $_FILES['planFile']['error'] !== UPLOAD_ERR_OK) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur: Données manquantes ou erreur lors de l\'upload du fichier.'];
            header('Location: index.php?action=addPlanForm');
            exit();
        }

        $nom = trim($_POST['nom']);
        $description = trim($_POST['description'] ?? '');
        $zone = empty($_POST['zone']) ? null : $_POST['zone']; // Mettre null si vide
        $universIds = isset($_POST['univers_ids']) ? array_map('intval', $_POST['univers_ids']) : [];
        $file = $_FILES['planFile'];
        $uploadDir = __DIR__ . '/../public/uploads/plans/';

        // Vérifier à nouveau l'existence et les permissions du dossier d'upload
        if (!is_dir($uploadDir) || !is_writable($uploadDir)) {
             error_log("Dossier d'upload non accessible ou non inscriptible : " . $uploadDir);
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur serveur: Impossible d\'écrire dans le dossier d\'upload.'];
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

        // Déterminer le type pour la BDD
        $planType = 'image'; // Défaut
        if ($fileType === 'image/svg+xml') $planType = 'svg';
        if ($fileType === 'application/pdf') $planType = 'pdf';

        // Générer un nom de fichier unique
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $safeFilename = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
        // Limiter la longueur du nom de base pour éviter les problèmes de système de fichiers
        $safeFilename = substr($safeFilename, 0, 100);
        $uniqueFilename = $safeFilename . '_' . uniqid() . '.' . $extension;
        $destination = $uploadDir . $uniqueFilename;

        if (move_uploaded_file($file['tmp_name'], $destination)) {
            // Définir les permissions après l'upload (si nécessaire, dépend de la config serveur)
            // chmod($destination, 0644);

            $planId = $this->planManager->addPlan($nom, $uniqueFilename, $planType, $description, $zone, $universIds);
            if ($planId) {
                $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Nouveau plan ajouté avec succès.'];
                header('Location: index.php?action=listPlans');
            } else {
                $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de l\'enregistrement du plan en base de données.'];
                unlink($destination); // Supprimer le fichier uploadé si erreur BDD
                header('Location: index.php?action=addPlanForm');
            }
        } else {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors du déplacement du fichier uploadé. Vérifiez les permissions du dossier.'];
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
        $zone = empty($_POST['zone']) ? null : $_POST['zone']; // Mettre null si vide
        $universIds = isset($_POST['univers_ids']) ? array_map('intval', $_POST['univers_ids']) : [];

        $success = $this->planManager->updatePlan($id, $nom, $description, $zone, $universIds);

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
            $plan = $this->planManager->getPlanById($id); // Récupérer infos avant suppression
            $success = $this->planManager->deletePlan($id);
            if ($success) {
                $_SESSION['flash_message'] = ['type' => 'info', 'message' => 'Plan mis à la corbeille.'];
                // Optionnel: Renommer le fichier physique
                // if ($plan && !empty($plan['nom_fichier'])) {
                //    $uploadDir = __DIR__ . '/../public/uploads/plans/';
                //    $oldPath = $uploadDir . $plan['nom_fichier'];
                //    $newPath = $uploadDir . 'deleted_' . uniqid() . '_' . $plan['nom_fichier'];
                //    if (file_exists($oldPath)) { rename($oldPath, $newPath); }
                // }
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

         // Récupérer les codes géo disponibles pour CE plan (ceux des univers associés qui ne sont pas déjà placés)
         $availableGeoCodes = $this->geoCodeManager->getAvailableCodesForPlan($id);

         // Récupérer les couleurs des univers pour l'affichage des codes
         $universList = $this->universManager->getAllUnivers();
         $universColors = array_column($universList, 'color', 'id');

         // Récupérer la liste des assets (à implémenter dans AssetManager si nécessaire)
         $assets = []; // Placeholder

         // Transmettre les données nécessaires à la vue de l'éditeur
         $viewData = [
             'currentPlan' => $plan,
             'placedGeoCodes' => $placedGeoCodes,
             'availableGeoCodes' => $availableGeoCodes,
             'universColors' => $universColors,
             'assets' => $assets,
             'csrfToken' => '', // Ajoutez un token CSRF si nécessaire
             'title' => 'Plan: ' . htmlspecialchars($plan['nom'])
         ];

         // Utiliser le troisième paramètre de render pour désactiver le layout
         $this->render('plan_editor_view', $viewData, false);
    }


     /**
      * Action API pour sauvegarder les données de dessin (JSON Fabric.js).
      * Appelée via fetch() depuis plan.js.
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
         json_decode($drawingData); // Vérifier si c'est du JSON valide
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
        // $width = filter_var($input['width'] ?? null, FILTER_VALIDATE_FLOAT); // Si besoin
        // $height = filter_var($input['height'] ?? null, FILTER_VALIDATE_FLOAT); // Si besoin
        // $properties = isset($input['properties']) && is_array($input['properties']) ? $input['properties'] : null; // Si besoin

        if ($planId <= 0 || $geoCodeId <= 0 || $posX === null || $posY === null) {
            http_response_code(400); echo json_encode(['success' => false, 'error' => 'Données invalides.']); exit();
        }
        // $result = $this->geoCodeManager->setGeoCodePosition($geoCodeId, $planId, $posX, $posY, $width, $height, $properties);
        $result = $this->geoCodeManager->setGeoCodePosition($geoCodeId, $planId, $posX, $posY); // Version simplifiée
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
        // Note: 'print_plan_view.php' à créer
        $this->render('print_plan_view', [
            'plan' => $plan,
            'positions' => $positions,
            'title' => 'Impression Plan: ' . htmlspecialchars($plan['nom'])
        ], false); // Ne pas utiliser le layout standard
    }

}
