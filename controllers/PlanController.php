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
            mkdir($uploadDir, 0755, true);
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
        $zone = $_POST['zone'] ?? null;
        $universIds = isset($_POST['univers_ids']) ? array_map('intval', $_POST['univers_ids']) : [];
        $file = $_FILES['planFile'];
        $uploadDir = __DIR__ . '/../public/uploads/plans/';
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
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $safeFilename = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
        $uniqueFilename = $safeFilename . '_' . uniqid() . '.' . $extension;
        $destination = $uploadDir . $uniqueFilename;

        if (move_uploaded_file($file['tmp_name'], $destination)) {
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
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors du déplacement du fichier uploadé. Vérifiez les permissions.'];
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
        // Note : Vous devrez créer la vue 'plan_edit_view.php' plus tard
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
        $zone = $_POST['zone'] ?? null;
        $universIds = isset($_POST['univers_ids']) ? array_map('intval', $_POST['univers_ids']) : [];
        // Note: On ne met PAS à jour drawing_data ici, c'est fait par une action API dédiée depuis l'éditeur.

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
            if ($success && $plan && !empty($plan['nom_fichier'])) {
                // Optionnel : renommer le fichier dans uploads pour indiquer qu'il est "supprimé"
                // $uploadDir = __DIR__ . '/../public/uploads/plans/';
                // rename($uploadDir . $plan['nom_fichier'], $uploadDir . 'deleted_' . $plan['nom_fichier']);
                $_SESSION['flash_message'] = ['type' => 'info', 'message' => 'Plan mis à la corbeille.'];
            } elseif ($success) {
                 $_SESSION['flash_message'] = ['type' => 'info', 'message' => 'Plan mis à la corbeille (fichier non trouvé/spécifié).'];
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

         // Récupérer les codes géo déjà placés sur CE plan
         $placedGeoCodes = $this->geoCodeManager->getPositionsForPlan($id); // Assurez-vous que cette méthode existe dans GeoCodeManager

         // Récupérer les codes géo disponibles pour CE plan (ceux des univers associés qui ne sont pas déjà placés)
         $availableGeoCodes = $this->geoCodeManager->getAvailableCodesForPlan($id);

         // Récupérer les couleurs des univers pour l'affichage des codes
         $universList = $this->universManager->getAllUnivers();
         $universColors = array_column($universList, 'color', 'id');

         // Récupérer la liste des assets (à implémenter dans AssetManager si nécessaire)
         $assets = []; // Placeholder

         // Transmettre les données nécessaires à la vue de l'éditeur
         $this->render('plan_editor_view', [ // Note : 'plan_editor_view.php' à créer
             'currentPlan' => $plan,
             'placedGeoCodes' => $placedGeoCodes,
             'availableGeoCodes' => $availableGeoCodes,
             'universColors' => $universColors,
             'assets' => $assets,
             'csrfToken' => '', // Ajoutez un token CSRF si nécessaire pour les appels API JS
             'title' => 'Plan: ' . htmlspecialchars($plan['nom']) // Titre de la page spécifique
         ], true); // Le 'true' ici pourrait indiquer de ne pas utiliser le layout standard
    }


     /**
      * Action API pour sauvegarder les données de dessin (JSON Fabric.js).
      * Appelée via fetch() depuis plan.js.
      */
     public function saveDrawingAction() {
         header('Content-Type: application/json');
         if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
             http_response_code(405); // Method Not Allowed
             echo json_encode(['success' => false, 'error' => 'Méthode POST requise.']);
             exit();
         }

         $input = json_decode(file_get_contents('php://input'), true);
         $planId = filter_var($input['plan_id'] ?? 0, FILTER_VALIDATE_INT);
         $drawingData = $input['drawing_data'] ?? null; // Doit être une chaîne JSON valide

         if ($planId <= 0 || $drawingData === null) {
             http_response_code(400); // Bad Request
             echo json_encode(['success' => false, 'error' => 'Données invalides (plan_id ou drawing_data manquant/incorrect).']);
             exit();
         }

         // Vérifier si le JSON est valide (optionnel mais recommandé)
         json_decode($drawingData);
         if (json_last_error() !== JSON_ERROR_NONE) {
             http_response_code(400);
             echo json_encode(['success' => false, 'error' => 'Les données de dessin ne sont pas au format JSON valide.']);
             exit();
         }

         $success = $this->planManager->updatePlanDrawingData($planId, $drawingData);

         if ($success) {
             echo json_encode(['success' => true, 'message' => 'Dessin sauvegardé.']);
         } else {
             http_response_code(500); // Internal Server Error
             echo json_encode(['success' => false, 'error' => 'Erreur lors de la sauvegarde du dessin en base de données.']);
         }
         exit();
     }


    // --- Actions pour la gestion des codes sur le plan (API appelée par JS) ---

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
        // Ajoutez d'autres champs si nécessaire (width, height, properties...)

        if ($planId <= 0 || $geoCodeId <= 0 || $posX === null || $posY === null) {
            http_response_code(400); echo json_encode(['success' => false, 'error' => 'Données invalides.']); exit();
        }

        // Utilise une méthode unique pour ajouter ou mettre à jour la position
        $result = $this->geoCodeManager->setGeoCodePosition(
            $geoCodeId,
            $planId,
            $posX,
            $posY
            // Ajoutez d'autres paramètres ici si besoin (width, height, properties...)
        );

        if ($result !== false) {
            echo json_encode(['success' => true, 'position_id' => $result, 'message' => 'Position enregistrée.']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erreur lors de l\'enregistrement de la position.']);
        }
        exit();
    }


     /**
      * Action API pour supprimer la position d'un code géo d'un plan.
      */
     public function removeGeoCodeAction() {
         header('Content-Type: application/json');
         if ($_SERVER['REQUEST_METHOD'] !== 'POST') { // Ou DELETE si vous préférez RESTful
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
             http_response_code(500);
             echo json_encode(['success' => false, 'error' => 'Erreur lors de la suppression de la position (peut-être déjà supprimée?).']);
         }
         exit();
     }


    // --- Action Impression --- (Simplifiée pour l'instant)
    public function printPlanAction() {
        $id = (int)($_GET['id'] ?? 0);
        $plan = $this->planManager->getPlanById($id);
        if (!$plan) {
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Plan non trouvé pour l\'impression.'];
            header('Location: index.php?action=listPlans');
            exit();
        }

        // Pour l'instant, affiche une vue simple qui charge l'image/svg
        // et ajoute les positions via JS pour l'impression navigateur.
        // Une génération PDF côté serveur serait plus robuste mais plus complexe.
        $positions = $this->geoCodeManager->getPositionsForPlanWithDetails($id); // Méthode à créer qui joint geo_codes
        // Note: 'print_plan_view.php' à créer
        $this->render('print_plan_view', [
            'plan' => $plan,
            'positions' => $positions,
            'title' => 'Impression Plan: ' . htmlspecialchars($plan['nom'])
        ], true); // Ne pas utiliser le layout standard
    }

}
