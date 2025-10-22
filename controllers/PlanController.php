<?php
// Fichier: controllers/PlanController.php

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/PlanManager.php';
require_once __DIR__ . '/../models/GeoCodeManager.php';
require_once __DIR__ . '/../models/UniversManager.php';

// Note: FPDF n'est plus nécessaire ici, sauf si vous avez des exports PDF depuis ce contrôleur
// require_once __DIR__ . '/../helpers/fpdf/fpdf.php'; 

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

    // =========================================================================
    // ACTIONS RENDANT DES VUES (Pages HTML complètes)
    // =========================================================================

    /**
     * Affiche la liste de tous les plans.
     */
    public function listPlansAction() {
        $plans = $this->planManager->getAllPlans();
        $this->render('plans_list_view', ['plans' => $plans]);
    }

    /**
     * Affiche le formulaire pour ajouter un nouveau plan (image/PDF).
     */
    public function addPlanFormAction() {
        $this->render('plan_add_view');
    }
    
    /**
     * Affiche le formulaire de modification d'un plan existant (métadonnées + fichier image/svg).
     */
    public function editPlanAction() {
        $planId = (int)($_GET['id'] ?? 0);
        if ($planId <= 0) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'ID de plan invalide.'];
            header('Location: index.php?action=listPlans');
            exit();
        }
        
        $plan = $this->planManager->getPlanWithUnivers($planId); // Récupère plan + univers_ids associés
        $allUnivers = $this->universManager->getAllUnivers();   // Récupère TOUS les univers pour le sélecteur
        
        if (empty($plan)) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Plan non trouvé.'];
            header('Location: index.php?action=listPlans');
            exit();
        }
        
        // Cette vue gère la modification des métadonnées (nom, zone, univers)
        // et le remplacement optionnel du fichier de fond (image ou SVG)
        $this->render('plan_edit_view', ['plan' => $plan, 'allUnivers' => $allUnivers]);
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
        
        // Récupère TOUS les codes géo avec TOUTES leurs positions
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions(); 

        $this->render('plan_viewer_view', [
            'plan' => $plan,
            'placedGeoCodes' => $geoCodes, // Le JS filtrera pour ne garder que ceux de ce plan
            'universColors' => $this->getUniversColors()
        ]);
    }

    /**
     * Affiche la page d'édition d'un plan (mode édition principal).
     */
    public function manageCodesAction() {
        $planId = (int)($_GET['id'] ?? 0);
        $plan = $this->planManager->getPlanById($planId); // Récupère id, nom, nom_fichier, zone, drawing_data
        if (!$plan) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Plan non trouvé.'];
            header('Location: index.php?action=listPlans');
            exit();
        }

        // 1. Récupérer TOUS les codes géo avec TOUTES leurs positions
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();
        
        // 2. Récupérer les univers spécifiquement LIÉS à ce plan (pour la sidebar et la légende)
        $planWithUniversIds = $this->planManager->getPlanWithUnivers($planId);
        $universForPlan = [];
        if(!empty($planWithUniversIds['univers_ids'])) {
             $universForPlan = $this->universManager->getUniversByIds($planWithUniversIds['univers_ids']);
        }

        // 3. Déterminer le type de plan pour le JS
        $planType = null; // Par défaut
        if (str_ends_with(strtolower($plan['nom_fichier']), '.svg')) {
            $planType = 'svg';
        }

        // 4. Rendre la vue
        $this->render('plan_view', [
            'placedGeoCodes' => $geoCodes, // Données brutes de TOUS les codes/positions
            'plan' => $plan, // Données du plan (avec drawing_data pour 'image')
            'planType' => $planType, // 'image' ou 'svg'
            'universList' => $universForPlan, // Univers LIÉS à ce plan (pour sidebar/légende)
            'universColors' => $this->getUniversColors() // Toutes les couleurs
        ]);
    }

    /**
     * Action pour afficher la page de création d'un plan SVG vierge.
     */
    public function createBlankPlanAction() {
        // Récupère tous les univers pour le sélecteur d'association
        $allUnivers = $this->universManager->getAllUnivers();
        
        // Assurez-vous que la vue 'plan_create_svg_view' existe et est correcte
        $this->render('plan_create_svg_view', [
            'allUnivers' => $allUnivers,
            'planType' => 'svg_creation' // Type spécial pour le JS
        ]);
    }

    /**
     * Génère la page HTML pour l'impression du plan avec les codes positionnés.
     */
    public function printPlanAction() {
        $planId = (int)($_GET['id'] ?? 0);
        $plan = $this->planManager->getPlanById($planId);
        if (!$plan) { die("Plan non trouvé."); }

        $allGeoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();
        $geoCodesForPlan = []; // Contiendra les éléments géo de CE plan
        $planType = str_ends_with(strtolower($plan['nom_fichier']), '.svg') ? 'svg' : 'image';

        foreach ($allGeoCodes as $code) {
            if (!empty($code['placements'])) {
                foreach ($code['placements'] as $p) {
                    if ($p['plan_id'] == $planId) {
                        // Combiner les infos du code (nom, univers...) avec la position
                        $elementData = array_merge($code, $p);
                        unset($elementData['placements']); // Éviter confusion
                        
                        // Filtrer: n'afficher que le bon type d'élément pour le plan
                        // Si plan SVG, on ne garde que les textes (width IS NULL)
                        if ($planType === 'svg' && $p['width'] === null && $p['height'] === null) {
                            $geoCodesForPlan[] = $elementData;
                        }
                        // Si plan Image, on ne garde que les étiquettes (width IS NOT NULL)
                        else if ($planType === 'image' && $p['width'] !== null && $p['height'] !== null) {
                            $geoCodesForPlan[] = $elementData;
                        }
                    }
                }
            }
        }
        
        $universColors = $this->getUniversColors();
        
        // Cette vue utilise le canvas 2D natif pour redessiner (pas Fabric)
        require __DIR__ . '/../views/plan_print_view.php';
        exit();
    }


    // =========================================================================
    // ACTIONS DE TRAITEMENT (Formulaires POST classiques)
    // =========================================================================

    /**
     * Traite la soumission du formulaire d'ajout d'un nouveau plan (image/PDF).
     */
    public function addPlanAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['planFile']) && $_FILES['planFile']['error'] === UPLOAD_ERR_OK) {
            $nom = trim($_POST['nom'] ?? 'Nouveau Plan');
            if (empty($nom)) $nom = 'Nouveau Plan ' . date('Y-m-d');
            $file = $_FILES['planFile'];

            $uploadDir = __DIR__ . '/../public/uploads/plans/';
            if (!is_dir($uploadDir)) @mkdir($uploadDir, 0777, true);

            $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $allowedExtensions = ['png', 'jpg', 'jpeg', 'svg', 'pdf'];

            if (!in_array($extension, $allowedExtensions)) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Format de fichier non supporté (PNG, JPG, SVG, PDF).'];
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
                    $imagick->setResolution(150, 150); // Résolution correcte
                    $imagick->readImage($file['tmp_name'] . '[0]'); // 1ère page
                    $imagick->setImageFormat('png');
                    $imagick->writeImage($destinationPath);
                    $imagick->clear();
                    $imagick->destroy();
                } catch (Exception $e) { 
                    $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur conversion PDF: ' . $e->getMessage()];
                    header('Location: index.php?action=addPlanForm');
                    exit();
                }
            } else if ($extension !== 'pdf') { // Pour PNG, JPG, JPEG, SVG
                $finalFilename = $newFilenameBase . '.' . $extension;
                $destinationPath = $uploadDir . $finalFilename;
                if (!move_uploaded_file($file['tmp_name'], $destinationPath)) { 
                    $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors du déplacement du fichier.'];
                    header('Location: index.php?action=addPlanForm');
                    exit();
                }
            } else { 
                 $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Conversion PDF impossible: l\'extension Imagick n\'est pas installée.'];
                 header('Location: index.php?action=addPlanForm');
                 exit();
            }

            if ($finalFilename) {
                // addPlan n'associe plus d'univers
                $newPlanId = $this->planManager->addPlan($nom, $finalFilename);
                if ($newPlanId) {
                    $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Plan ajouté. Vous pouvez maintenant l\'éditer pour y associer des univers.'];
                    header('Location: index.php?action=editPlan&id=' . $newPlanId); // Redirige vers l'édition
                    exit();
                } else {
                     $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur base de données lors de l\'ajout du plan.'];
                     if(file_exists($destinationPath)) @unlink($destinationPath);
                }
            }
        } else {
             $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Aucun fichier envoyé ou erreur de téléversement (Code: ' . ($_FILES['planFile']['error'] ?? 'N/A') . ').'];
        }
        header('Location: index.php?action=addPlanForm');
        exit();
    }
    
    /**
     * Traite la soumission du formulaire de modification d'un plan (métadonnées + fichier).
     */
    public function updatePlanAction() {
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
        // Gestion du remplacement de fichier (si un nouveau est uploadé)
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
            
            $safeFilename = preg_replace('/[^a-zA-Z0-9-_\.]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
            $newFilenameBase = time() . '_' . $safeFilename;
            $destinationPath = '';

            // ... (logique de conversion PDF en PNG, identique à addPlanAction) ...
            if ($extension === 'pdf' && class_exists('Imagick')) {
                // ...
            } else if ($extension !== 'pdf') {
                $newFilename = $newFilenameBase . '.' . $extension;
                $destinationPath = $uploadDir . $newFilename;
                if (!move_uploaded_file($file['tmp_name'], $destinationPath)) { /* ... gestion erreur ... */ }
            } else { /* ... gestion erreur Imagick ... */ }

            // Supprimer l'ancien fichier
            if ($newFilename && $currentPlan['nom_fichier'] && file_exists($uploadDir . $currentPlan['nom_fichier'])) {
                @unlink($uploadDir . $currentPlan['nom_fichier']);
            }
            
        } elseif (isset($_FILES['planFile']) && $_FILES['planFile']['error'] !== UPLOAD_ERR_NO_FILE) {
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors du téléversement (Code: ' . $_FILES['planFile']['error'] . ').'];
             header('Location: index.php?action=editPlan&id=' . $planId);
             exit();
        }

        // Mise à jour BDD (nom, zone, univers, et nom_fichier si changé)
        if ($this->planManager->updatePlan($planId, $nom, $zone, $universIds, $newFilename)) {
            $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Le plan a été mis à jour avec succès.'];
        } else {
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur de base de données lors de la mise à jour du plan.'];
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
            if ($this->planManager->deletePlan($id)) { // Suppression BDD (cascade)
                 if (file_exists($filePath)) @unlink($filePath); // Suppression fichier
                 $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Plan supprimé avec succès.'];
            } else { $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur base de données lors de la suppression.']; }
        } else { $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Plan non trouvé.']; }
        header('Location: index.php?action=listPlans');
        exit();
    }


    // =========================================================================
    // ACTIONS API (JSON) - Appelées par le Javascript (api.js)
    // =========================================================================

    /**
     * API: Retourne les codes géo DISPONIBLES pour un plan (non encore placés).
     */
    public function apiGetAvailableCodesAction() {
        header('Content-Type: application/json');
        $planId = (int)($_GET['plan_id'] ?? 0);
        if ($planId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de plan invalide']);
            exit();
        }
        
        try {
            // Renvoie les codes des univers liés au plan, QUI N'ONT PAS DEJA de position sur ce plan
            $availableCodes = $this->geoCodeManager->getAvailableCodesForPlan($planId);
	// --- AJOUT TEMPORAIRE POUR NETTOYER LE BUFFER ---
        if (ob_get_level() > 0) { // Vérifie s'il y a un buffer actif
           ob_clean(); // Supprime tout contenu du buffer
        }
            echo json_encode(['success' => true, 'codes' => $availableCodes]);
        } catch (Exception $e) {
            http_response_code(500);
	error_log('apiGetAvailableCodes ERREUR: ' . $e->getMessage()); // Log l'erreur

        // --- AJOUT DIAGNOSTIC ---
         if (ob_get_level() > 0) {
            ob_clean();
         }
         // --- FIN AJOUT ---
            echo json_encode(['success' => false, 'error' => 'Erreur serveur: ' . $e->getMessage()]);
        }
        exit();
    }

    /**
     * API: Sauvegarde (crée ou met à jour) une position d'élément géo.
     * Accepte width/height null pour les textes.
     */

public function apiSavePositionAction() {
        // 1. Lire les données JSON envoyées
        $inputJSON = file_get_contents('php://input');
        $inputData = json_decode($inputJSON, true); // Tableau associatif

        // 2. Validation simple
        if (empty($inputData) || empty($inputData['id']) || empty($inputData['plan_id']) || !isset($inputData['pos_x']) || !isset($inputData['pos_y'])) {
            header('Content-Type: application/json');
            http_response_code(400); // Mauvaise requête
            echo json_encode(['success' => false, 'error' => 'Données de position invalides ou manquantes.']);
            exit;
        }

        // 3. Préparer les données pour le Manager
        // Note: $inputData['id'] est l'ID du GeoCode, pas l'ID de la position (qui est null ici car c'est une création)
        $positionData = [
            'geo_code_id' => intval($inputData['id']), // Renommer pour clarifier ?
            'plan_id'     => intval($inputData['plan_id']),
            'pos_x'       => floatval($inputData['pos_x']),
            'pos_y'       => floatval($inputData['pos_y']),
            'width'       => $inputData['width'] ?? null, // Peut être null
            'height'      => $inputData['height'] ?? null, // Peut être null
            'anchor_x'    => $inputData['anchor_x'] ?? null, // Peut être null (ID SVG ou %)
            'anchor_y'    => $inputData['anchor_y'] ?? null  // Peut être null (%)
        ];

        // 4. Tenter la sauvegarde via le Manager
        try {
            // Assurez-vous que votre Manager a une méthode pour ça
            // et qu'elle retourne bien les données complètes (avec le nouvel ID)
            $manager = new GeoCodeManager(); // Ou PlanManager
            // Le 'null' indique que c'est une insertion (pas de position_id existant)
            $savedPosition = $manager->savePosition($positionData, null);

            if ($savedPosition && isset($savedPosition['id'])) {
                // 5a. Répondre Succès avec les données
                header('Content-Type: application/json');
                echo json_encode(['success' => true, 'position' => $savedPosition]);
                exit; // <-- TRÈS IMPORTANT
            } else {
                // Si le manager retourne false ou des données invalides
                throw new Exception("La sauvegarde de la position a échoué dans le Manager ou n'a pas retourné d'ID.");
            }

        } catch (Exception $e) {
            // 5b. Répondre Erreur
            header('Content-Type: application/json');
            http_response_code(500); // Erreur serveur
            error_log("Erreur apiSavePosition: " . $e->getMessage()); // Log l'erreur
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit; // <-- TRÈS IMPORTANT
        }
    }

    /**
     * API: Supprime une position spécifique (un tag/texte).
     */
    public function apiRemovePositionAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['position_id'])) {
            $success = $this->planManager->removePosition((int)$input['position_id']);
            echo json_encode(['success' => $success]);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de position manquant']);
        }
        exit();
    }

    /**
     * API: Supprime toutes les positions d'un code géo sur un plan.
     */
    public function apiRemoveAllPositionsAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        // Note: 'id' ici est geo_code_id
        if (isset($input['id'], $input['plan_id'])) { 
            $success = $this->planManager->removeMultiplePositionsByCodeId((int)$input['id'], (int)$input['plan_id']);
            echo json_encode(['success' => $success]);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Données invalides (id, plan_id) pour suppression multiple.']);
        }
        exit();
    }

    /**
     * API: Sauvegarde les annotations (dessins) pour un plan 'image'.
     */
    public function apiSaveDrawingAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['plan_id'])) {
            $planId = (int)$input['plan_id'];
            $jsonData = isset($input['drawing_data']) ? json_encode($input['drawing_data']) : null;
            $success = $this->planManager->saveDrawingData($planId, $jsonData);
            echo json_encode(['success' => $success]);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de plan manquant']);
        }
        exit();
    }

    /**
     * API: Crée un nouveau plan SVG (mode 'svg_creation').
     */
    public function apiCreateSvgPlanAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);

        $nom = trim($input['nom'] ?? '');
        $svgContent = $input['svg_content'] ?? null;
        $universIds = $input['univers_ids'] ?? []; // Accepter les univers

        if (empty($nom) || empty($svgContent) || !is_array($universIds) || empty($universIds)) {
             http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Nom, contenu SVG ou univers manquant']);
            exit();
        }
        
        // Le PlanManager doit gérer l'ajout du plan ET l'association des univers
        $newPlanId = $this->planManager->savePlanAsSvg($nom, $svgContent, $universIds);
        if ($newPlanId) {
            echo json_encode(['success' => true, 'plan_id' => $newPlanId]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erreur serveur lors de la création du plan SVG']);
        }
        exit();
    }

    /**
     * API: Met à jour le contenu d'un plan SVG (mode 'svg').
     * Note: Ne met à jour que le *fichier* SVG, pas les métadonnées (nom, univers, etc.)
     */
    public function apiUpdateSvgPlanAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);

        if (isset($input['plan_id']) && isset($input['svg_content'])) {
            $planId = (int)$input['plan_id'];
            $svgContent = $input['svg_content'];

            $success = $this->planManager->updateSvgPlan($planId, $svgContent);
            echo json_encode(['success' => $success]);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de plan ou contenu SVG manquant']);
        }
        exit();
    }

    // --- Actions Historique (AJAX) ---
    // Non utilisées par main.js v2, mais conservées au cas où
    public function getHistoryAction() {
        header('Content-Type: application/json');
        $planId = (int)($_GET['plan_id'] ?? 0);
        if ($planId > 0) {
            $history = $this->planManager->getHistoryForPlan($planId, 50);
            echo json_encode(['success' => true, 'history' => $history]);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de plan invalide']);
        }
        exit();
    }
}
