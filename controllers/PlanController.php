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
     * Affiche la page de gestion des codes sur un plan (mode édition).
     */
    public function manageCodesAction() {
        $planId = (int)($_GET['id'] ?? 0);
        $plan = $this->planManager->getPlanById($planId);
        if (!$plan) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Plan non trouvé.'];
            header('Location: index.php?action=listPlans');
            exit();
        }

        // Récupère TOUS les codes géo AVEC leurs positions existantes
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();
        
        // Récupère les IDs des univers associés SPÉCIFIQUEMENT à ce plan
        $planWithUniversIds = $this->planManager->getPlanWithUnivers($planId);
        $universForPlan = [];
        if(!empty($planWithUniversIds['univers_ids'])) {
             $universForPlan = $this->universManager->getUniversByIds($planWithUniversIds['univers_ids']);
        }
        
        $this->render('plan_view', [
            'placedGeoCodes' => $geoCodes, // Tous les codes + positions
            'plan' => $plan,
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
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();

        $this->render('plan_viewer_view', [
            'plan' => $plan,
            'placedGeoCodes' => $geoCodes,
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
            die("Plan non trouvé."); // Ou redirection avec message flash
        }
        // Important: Récupérer TOUS les codes géo avec leurs positions
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions(); 
        $universColors = $this->getUniversColors();

        // La vue se charge de filtrer et d'afficher uniquement les codes pertinents pour CE plan
        require __DIR__ . '/../views/plan_print_view.php'; 
    }

    /**
     * Retourne en JSON la liste des codes géo disponibles (associés via les univers) pour un plan donné.
     * Inclut le nombre de fois où chaque code est déjà placé sur CE plan.
     */
    public function getAvailableCodesForPlanAction() {
        header('Content-Type: application/json');
        $planId = (int)($_GET['id'] ?? 0);
        
        if ($planId <= 0) {
            http_response_code(400); // Bad Request
            echo json_encode(['error' => 'ID de plan invalide']);
            exit();
        }

        $availableCodes = $this->geoCodeManager->getAvailableCodesForPlan($planId);
        echo json_encode($availableCodes);
        exit();
    }

    /**
     * Enregistre (crée ou met à jour) la position d'un code géo sur un plan via une requête AJAX.
     */
    public function savePositionAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['id'], $input['plan_id'], $input['x'], $input['y'])) {
            $success = $this->planManager->savePosition(
                (int)$input['id'], 
                (int)$input['plan_id'], 
                (float)$input['x'], 
                (float)$input['y'],
                isset($input['width']) ? (int)$input['width'] : null,
                isset($input['height']) ? (int)$input['height'] : null,
                isset($input['anchor_x']) ? (float)$input['anchor_x'] : null,
                isset($input['anchor_y']) ? (float)$input['anchor_y'] : null,
                isset($input['position_id']) ? (int)$input['position_id'] : null
            );
            echo json_encode(['status' => $success ? 'success' : 'error']);
        } else {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Données invalides']);
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
     * Enregistre plusieurs positions en une seule fois (non utilisé actuellement mais peut servir).
     */
    public function saveMultiplePositionsAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['positions']) && is_array($input['positions']) && isset($input['plan_id'])) {
            $success = $this->planManager->saveMultiplePositions($input['positions'], (int)$input['plan_id']);
            echo json_encode(['status' => $success ? 'success' : 'error']);
        } else {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Données invalides pour la sauvegarde multiple']);
        }
        exit();
    }

    /**
     * Affiche la liste de tous les plans.
     */
    public function listPlansAction() {
        $plans = $this->planManager->getAllPlans();
        $this->render('plans_list_view', ['plans' => $plans]);
    }
    
    /**
     * Affiche le formulaire de modification d'un plan existant.
     */
    public function editPlanAction() {
        $planId = (int)($_GET['id'] ?? 0);
        if ($planId <= 0) {
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'ID de plan invalide.'];
            header('Location: index.php?action=listPlans');
            exit();
        }
        $plan = $this->planManager->getPlanWithUnivers($planId);
        $allUnivers = $this->universManager->getAllUnivers();
        if (empty($plan)) {
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Plan non trouvé.'];
            header('Location: index.php?action=listPlans');
            exit();
        }
        $this->render('plan_edit_view', ['plan' => $plan, 'allUnivers' => $allUnivers]);
    }

    /**
     * Traite la soumission du formulaire de modification d'un plan.
     * Gère la mise à jour du nom, de la zone, des univers associés et le remplacement optionnel du fichier.
     */
    public function updatePlanAction() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            header('Location: index.php?action=listPlans');
            exit();
        }
    
        $planId = (int)($_POST['plan_id'] ?? 0);
        $nom = trim($_POST['nom'] ?? '');
        $zone = $_POST['zone'] ?? null;
        if ($zone === '') { $zone = null; } // Convertir chaîne vide en NULL pour la BDD
        $universIds = $_POST['univers_ids'] ?? [];
    
        // Validation simple
        if ($planId <= 0 || empty($nom)) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Données invalides pour la mise à jour du plan.'];
            header('Location: index.php?action=editPlan&id=' . $planId); // Retourner au formulaire d'édition
            exit();
        }
    
        $currentPlan = $this->planManager->getPlanById($planId);
        if (!$currentPlan) {
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Plan non trouvé.'];
            header('Location: index.php?action=listPlans');
            exit();
        }
    
        $newFilename = null; // Nom du nouveau fichier s'il y en a un
    
        // Gérer le téléversement d'un nouveau fichier s'il est fourni
        if (isset($_FILES['planFile']) && $_FILES['planFile']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['planFile'];
            $uploadDir = __DIR__ . '/../public/uploads/plans/';
            $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $allowedExtensions = ['png', 'jpg', 'jpeg', 'svg', 'pdf'];
            
            if (!in_array($extension, $allowedExtensions)) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Format de fichier non supporté.'];
                 header('Location: index.php?action=editPlan&id=' . $planId);
                 exit();
            }

            // Générer un nom de fichier unique
            $safeFilename = preg_replace('/[^a-zA-Z0-9-_\.]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
            $newFilenameBase = time() . '_' . $safeFilename;
    
            // Traitement spécifique pour les PDF si Imagick est disponible
            if ($extension === 'pdf' && class_exists('Imagick')) {
                $newFilename = $newFilenameBase . '.png'; // On convertit en PNG
                try {
                    $imagick = new Imagick();
                    $imagick->setResolution(150, 150); // Résolution pour la conversion
                    $imagick->readImage($file['tmp_name'] . '[0]'); // '[0]' pour la première page
                    $imagick->setImageFormat('png');
                    $imagick->writeImage($uploadDir . $newFilename);
                    $imagick->clear();
                    $imagick->destroy();
                } catch (Exception $e) {
                    $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la conversion du PDF: ' . $e->getMessage()];
                    header('Location: index.php?action=editPlan&id=' . $planId);
                    exit();
                }
            } else if ($extension !== 'pdf') { // Pour les autres formats autorisés (non-PDF)
                $newFilename = $newFilenameBase . '.' . $extension;
                if (!move_uploaded_file($file['tmp_name'], $uploadDir . $newFilename)) {
                     $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors du déplacement du fichier téléversé.'];
                     header('Location: index.php?action=editPlan&id=' . $planId);
                     exit();
                }
            } else {
                 $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Impossible de traiter le fichier PDF sans l\'extension Imagick. Le plan n\'a pas été modifié.'];
                 header('Location: index.php?action=editPlan&id=' . $planId);
                 exit();
            }
    
            // Si un nouveau fichier a été traité avec succès, on supprime l'ancien fichier physique
            if ($newFilename && file_exists($uploadDir . $currentPlan['nom_fichier'])) {
                unlink($uploadDir . $currentPlan['nom_fichier']);
            }
        } elseif (isset($_FILES['planFile']) && $_FILES['planFile']['error'] !== UPLOAD_ERR_NO_FILE) {
            // Gérer les autres erreurs de téléversement
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors du téléversement du fichier (code: ' . $_FILES['planFile']['error'] . ').'];
             header('Location: index.php?action=editPlan&id=' . $planId);
             exit();
        }
    
        // Mettre à jour la base de données (le manager gère si $newFilename est null ou non)
        if ($this->planManager->updatePlan($planId, $nom, $zone, $universIds, $newFilename)) {
            $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Le plan a été mis à jour avec succès.'];
        } else {
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la mise à jour du plan en base de données.'];
        }
        
        header('Location: index.php?action=listPlans');
        exit();
    }
    
    /**
     * Affiche le formulaire pour ajouter un nouveau plan.
     */
    public function addPlanFormAction() {
        $this->render('plan_add_view');
    }

    /**
     * Traite la soumission du formulaire d'ajout d'un nouveau plan.
     * Gère le téléversement et la conversion éventuelle de PDF.
     */
    public function addPlanAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['planFile'])) {
            $nom = trim($_POST['nom'] ?? '');
            $file = $_FILES['planFile'];
    
            // Validation de base
            if ($file['error'] !== UPLOAD_ERR_OK || empty($nom)) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Veuillez fournir un nom et un fichier pour le plan. Erreur upload: ' . $file['error']];
                header('Location: index.php?action=addPlanForm');
                exit();
            }
            
            $uploadDir = __DIR__ . '/../public/uploads/plans/';
            if (!is_dir($uploadDir) && !mkdir($uploadDir, 0777, true)) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Impossible de créer le dossier d\'upload.'];
                 header('Location: index.php?action=addPlanForm');
                 exit();
            }

            $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $allowedExtensions = ['png', 'jpg', 'jpeg', 'svg', 'pdf'];

             if (!in_array($extension, $allowedExtensions)) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Format de fichier non supporté. Formats acceptés : ' . implode(', ', $allowedExtensions)];
                 header('Location: index.php?action=addPlanForm');
                 exit();
            }
    
            // Générer un nom de fichier unique
            $safeFilename = preg_replace('/[^a-zA-Z0-9-_\.]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
            $newFilenameBase = time() . '_' . $safeFilename;
    
            $finalFilename = ''; // Nom du fichier qui sera enregistré en BDD
            $destinationPath = ''; // Chemin complet du fichier final
    
            // Traitement spécifique pour les PDF si Imagick est disponible
            if ($extension === 'pdf' && class_exists('Imagick')) {
                $finalFilename = $newFilenameBase . '.png'; // Convertir en PNG
                $destinationPath = $uploadDir . $finalFilename;
                try {
                    $imagick = new Imagick();
                    $imagick->setResolution(150, 150);
                    $imagick->readImage($file['tmp_name'] . '[0]'); // Première page
                    $imagick->setImageFormat('png');
                    $imagick->writeImage($destinationPath);
                    $imagick->clear();
                    $imagick->destroy();
                     $_SESSION['flash_message'] = ['type' => 'info', 'message' => 'Le fichier PDF a été converti en PNG.'];
                } catch (Exception $e) {
                    $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la conversion du PDF : ' . $e->getMessage()];
                    header('Location: index.php?action=addPlanForm');
                    exit();
                }
            } else if ($extension !== 'pdf') { // Pour les autres formats autorisés (non-PDF)
                $finalFilename = $newFilenameBase . '.' . $extension;
                $destinationPath = $uploadDir . $finalFilename;
                if (!move_uploaded_file($file['tmp_name'], $destinationPath)) {
                    $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors du déplacement du fichier téléversé.'];
                    header('Location: index.php?action=addPlanForm');
                    exit();
                }
            } else {
                 $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Impossible de traiter le fichier PDF sans l\'extension Imagick installée sur le serveur.'];
                 header('Location: index.php?action=addPlanForm');
                 exit();
            }
    
            // Enregistrer en base de données si un fichier a été traité
            if ($finalFilename) {
                if ($this->planManager->addPlan($nom, $finalFilename)) {
                    $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Le plan "' . htmlspecialchars($nom) . '" a été ajouté avec succès.'];
                } else {
                    $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de l\'enregistrement du plan en base de données.'];
                    // Optionnel : supprimer le fichier si l'enregistrement BDD échoue
                    if(file_exists($destinationPath)) unlink($destinationPath); 
                }
            }
        } else {
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Aucun fichier n\'a été envoyé ou une erreur est survenue.'];
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
            
            // Suppression du fichier physique
            if (file_exists($filePath)) {
                unlink($filePath);
            }
            
            // Suppression de l'entrée en base de données (CASCADE devrait gérer les liens)
            if($this->planManager->deletePlan($id)) {
                 $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Le plan "' . htmlspecialchars($plan['nom']) . '" a été supprimé.'];
            } else {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la suppression du plan.'];
            }
        } else {
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Plan non trouvé pour la suppression.'];
        }
        header('Location: index.php?action=listPlans');
        exit();
    }

    /**
     * Récupère l'historique des modifications de position pour un plan donné (AJAX).
     */
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

    /**
     * Restaure une position à partir d'une entrée de l'historique (AJAX).
     * Non implémenté complètement car nécessite de gérer l'écrasement ou non des positions actuelles.
     */
    public function restorePositionAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        $historyId = (int)($input['id'] ?? 0);

        // --- Logique de restauration à implémenter ---
        // 1. Récupérer l'entrée d'historique
        // 2. Si l'action était 'removed', vérifier si une position existe déjà pour ce code/plan et décider quoi faire (écraser? ignorer?)
        // 3. Si l'action était 'placed' ou 'moved', utiliser savePosition pour remettre les coordonnées X/Y
        // Pour l'instant, on retourne une erreur car la logique n'est pas complète.

        echo json_encode(['status' => 'error', 'message' => 'Fonctionnalité de restauration non implémentée.']);
        
        /* Exemple de logique potentielle (à adapter) :
        if ($historyId > 0) {
            $historyEntry = $this->planManager->getHistoryEntry($historyId);
            if ($historyEntry) {
                // ... Ajouter la logique pour vérifier les conflits potentiels ...
                $success = $this->planManager->savePosition(
                    $historyEntry['geo_code_id'],
                    $historyEntry['plan_id'],
                    $historyEntry['pos_x'], // Peut être null si 'removed'
                    $historyEntry['pos_y']  // Peut être null si 'removed'
                    // Gérer width/height/anchor si besoin
                );
                echo json_encode(['status' => $success ? 'success' : 'error']);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Entrée d\'historique non trouvée']);
            }
        } else {
            echo json_encode(['status' => 'error', 'message' => 'ID d\'historique invalide']);
        }*/
        exit();
    }
}
