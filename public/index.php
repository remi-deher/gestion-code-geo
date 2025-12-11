<?php
// Fichier : public/index.php

ini_set('display_errors', 1);
error_reporting(E_ALL);
session_start();

// Inclut l'autoloader de Composer (si vous l'utilisez)
if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';
}

// 1. Chargement de la configuration de la base de données
$dbConfigPath = __DIR__ . '/../config/database.php';
if (!file_exists($dbConfigPath)) {
    die("Erreur: Le fichier de configuration de la base de données 'config/database.php' est manquant.");
}
$dbConfig = require $dbConfigPath;

// 2. Chargement des options PDO (Gestion SSL déportée)
// On charge le fichier helper qui génère les options SSL en fonction de la config
$pdoOptionsPath = __DIR__ . '/../config/pdo_options.php';
if (file_exists($pdoOptionsPath)) {
    $getPDOOptions = require $pdoOptionsPath;
    $options = $getPDOOptions($dbConfig);
} else {
    // Fallback : Options par défaut si le fichier helper n'est pas encore créé
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];
}

// 3. Connexion à la base de données
$dsn = "mysql:host={$dbConfig['host']};dbname={$dbConfig['dbname']};charset={$dbConfig['charset']}";
try {
    // On passe les options (qui contiennent la config SSL si activée)
    $db = new PDO($dsn, $dbConfig['user'], $dbConfig['password'], $options);
} catch (PDOException $e) {
    error_log('Erreur de connexion BDD: ' . $e->getMessage());
    die('Erreur de connexion à la base de données. Veuillez vérifier la configuration et réessayer.');
}

// Chargement des contrôleurs nécessaires
require_once __DIR__ . '/../controllers/BaseController.php';
require_once __DIR__ . '/../controllers/DashboardController.php';
require_once __DIR__ . '/../controllers/GeoCodeController.php';
require_once __DIR__ . '/../controllers/UniversController.php';
require_once __DIR__ . '/../controllers/PlanController.php';
require_once __DIR__ . '/../controllers/AssetsController.php';

// Initialisation des contrôleurs
$dashboardController = new DashboardController($db);
$geoCodeController = new GeoCodeController($db);
$universController = new UniversController($db);
$planController = new PlanController($db);
$assetsController = new AssetsController($db);

// Action par défaut
$action = $_GET['action'] ?? 'dashboard';

// Routage
switch ($action) {
    // --- DASHBOARD ---
    case 'dashboard': $dashboardController->indexAction(); break;

    // --- CODES GÉO (Gestion CRUD) ---
    case 'list': $geoCodeController->listAction(); break;
    case 'create': $geoCodeController->createAction(); break;
    case 'add': $geoCodeController->addAction(); break;
    case 'edit': $geoCodeController->editAction(); break;
    case 'update': $geoCodeController->updateAction(); break;
    case 'delete': $geoCodeController->deleteAction(); break; // Soft delete

    // --- CODES GÉO (Fonctionnalités avancées) ---
    case 'showBatchCreate': $geoCodeController->showBatchCreateAction(); break;
    case 'handleBatchCreate': $geoCodeController->handleBatchCreateAction(); break;

    // --- CORBEILLE & HISTORIQUE CODES GÉO ---
    case 'trash': $geoCodeController->trashAction(); break;
    case 'restore': $geoCodeController->restoreAction(); break;
    case 'forceDelete': $geoCodeController->forceDeleteAction(); break; // Suppression définitive
    case 'history': $geoCodeController->historyAction(); break; // Historique d'un code
    case 'fullHistory': $geoCodeController->fullHistoryAction(); break; // Historique global

    // --- IMPORT/EXPORT & IMPRESSION ---
    case 'showExport': $geoCodeController->showExportAction(); break;
    case 'handleExport': $geoCodeController->handleExportAction(); break; // JSON
    case 'showImport': $geoCodeController->showImportAction(); break;
    case 'handleImport': $geoCodeController->handleImportAction(); break;
    case 'printLabels': $geoCodeController->showPrintOptionsAction(); break; // Page options PDF
    case 'getCodesForPrint': $geoCodeController->getCodesForPrintAction(); break; // AJAX PDF
    case 'getSingleGeoCodeJson': $geoCodeController->getSingleGeoCodeJsonAction(); break; // AJAX PDF Unique

    // --- UNIVERS ---
    case 'listUnivers': $universController->listAction(); break;
    case 'addUnivers': $universController->addAction(); break;
    case 'updateUnivers': $universController->updateAction(); break;
    case 'deleteUnivers': $universController->deleteAction(); break;

    // --- PLANS (Gestion) ---
    case 'listPlans': $planController->listAction(); break;
    case 'addPlanForm': $planController->addPlanFormAction(); break;
    case 'handleAddPlan': $planController->handleAddPlanAction(); break;
    case 'editPlan': $planController->editPlanAction(); break;
    case 'handleUpdatePlan': $planController->handleUpdatePlanAction(); break;
    case 'deletePlan': $planController->deletePlanAction(); break;
    case 'viewPlan': $planController->viewPlanAction(); break; // Éditeur
    case 'printPlan': $planController->printPlanAction(); break;

    // --- PLANS (Corbeille) ---
    case 'trashPlans': $planController->trashAction(); break;
    case 'restorePlan': $planController->restoreAction(); break;
    case 'forceDeletePlan': $planController->forceDeleteAction(); break;

    // --- API ÉDITEUR PLANS (AJAX) ---
    case 'apiSaveDrawing': $planController->saveDrawingAction(); break;
    case 'apiPlaceGeoCode': $planController->placeGeoCodeAction(); break;
    case 'apiRemoveGeoCode': $planController->removeGeoCodeAction(); break;
    case 'apiSavePageFormat': $planController->savePageFormatAction(); break;

    // --- ASSETS ---
    case 'manageAssets': $assetsController->manageAction(); break;
    case 'handleAssetUpload': $assetsController->handleUploadAction(); break;
    case 'apiListAssets': $assetsController->listAction(); break;
    case 'apiGetAsset': $assetsController->getAction(); break;
    case 'apiCreateAsset': $assetsController->createAction(); break;
    case 'apiDeleteAsset': $assetsController->deleteAction(); break;

    // Action non trouvée ou par défaut
    default:
        // Rediriger vers le tableau de bord
        $dashboardController->indexAction();
        break;
}
?>
