<?php
// Fichier : public/index.php

ini_set('display_errors', 1);
error_reporting(E_ALL);
session_start();

// Inclut l'autoloader de Composer
require_once __DIR__ . '/../vendor/autoload.php';

// Connexion à la base de données
$dbConfig = require_once '../config/database.php';
$dsn = "mysql:host={$dbConfig['host']};dbname={$dbConfig['dbname']};charset={$dbConfig['charset']}";
try {
    $db = new PDO($dsn, $dbConfig['user'], $dbConfig['password']);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC); // Optionnel mais pratique
} catch (PDOException $e) {
    // Afficher un message d'erreur plus convivial en production
    error_log('Erreur de connexion BDD: ' . $e->getMessage()); // Log l'erreur réelle
    die('Erreur de connexion à la base de données. Veuillez réessayer plus tard.');
}

// Chargement des contrôleurs
require_once '../controllers/BaseController.php';
require_once '../controllers/DashboardController.php';
require_once '../controllers/GeoCodeController.php';
require_once '../controllers/PlanController.php';
require_once '../controllers/UniversController.php';
require_once '../controllers/AssetController.php';

// Initialisation des contrôleurs
$dashboardController = new DashboardController($db);
$geoCodeController = new GeoCodeController($db);
$planController = new PlanController($db);
$universController = new UniversController($db);
$assetController = new AssetController($db);

// Action par défaut
$action = $_GET['action'] ?? 'dashboard';

// Routage
switch ($action) {
    // Dashboard
    case 'dashboard': $dashboardController->indexAction(); break;

    // Codes Géo (Gestion CRUD)
    case 'list': $geoCodeController->listAction(); break;
    case 'create': $geoCodeController->createAction(); break;
    case 'add': $geoCodeController->addAction(); break;
    case 'edit': $geoCodeController->editAction(); break;
    case 'update': $geoCodeController->updateAction(); break;
    case 'delete': $geoCodeController->deleteAction(); break; // Soft delete

    // Codes Géo (Fonctionnalités avancées)
    case 'addGeoCodeFromPlan': $geoCodeController->addGeoCodeFromPlanAction(); break; // AJAX depuis plan
    case 'showBatchCreate': $geoCodeController->showBatchCreateAction(); break;
    case 'handleBatchCreate': $geoCodeController->handleBatchCreateAction(); break;
    case 'getAllCodesJson': $geoCodeController->getAllCodesJsonAction(); break; // AJAX pour plan.js

    // Corbeille & Historique Codes Géo
    case 'trash': $geoCodeController->trashAction(); break;
    case 'restore': $geoCodeController->restoreAction(); break;
    case 'forceDelete': $geoCodeController->forceDeleteAction(); break; // Suppression définitive
    case 'history': $geoCodeController->historyAction(); break; // Historique d'un code
    case 'fullHistory': $geoCodeController->fullHistoryAction(); break; // Historique global

    // Import/Export et Impression Codes Géo
    case 'showExport': $geoCodeController->showExportAction(); break;
    case 'handleExport': $geoCodeController->handleExportAction(); break;
    case 'showImport': $geoCodeController->showImportAction(); break;
    case 'handleImport': $geoCodeController->handleImportAction(); break;
    case 'printLabels': $geoCodeController->showPrintOptionsAction(); break; // Options impression étiquettes (maintenant PDF)
    case 'printSingle': $geoCodeController->printSingleLabelAction(); break; // Imprime une seule étiquette

    // NOUVELLE ROUTE POUR AJAX PDF
    case 'getCodesForPrint': $geoCodeController->getCodesForPrintAction(); break;

    // Plans (Gestion CRUD et Métadonnées)
    case 'listPlans': $planController->listPlansAction(); break;
    case 'addPlanForm': $planController->addPlanFormAction(); break;
    case 'addPlan': $planController->addPlanAction(); break;
    case 'editPlan': $planController->editPlanAction(); break;
    case 'updatePlan': $planController->updatePlanAction(); break;
    case 'deletePlan': $planController->deletePlanAction(); break;

    // Plans (Visualisation et Édition Contenu)
    case 'viewPlan': $planController->viewPlanAction(); break;
    case 'manageCodes': $planController->manageCodesAction(); break;
    case 'printPlan': $planController->printPlanAction(); break;

    // Plans (Actions AJAX pour l'éditeur)
    case 'getAvailableCodesForPlan': $planController->apiGetAvailableCodesAction(); break;
    case 'apiSavePosition': $planController->apiSavePositionAction(); break;
    case 'apiRemovePosition': $planController->apiRemovePositionAction(); break;
    case 'apiRemoveAllPositions': $planController->apiRemoveAllPositionsAction(); break;

    // Plans (NOUVELLES Actions Dessin AJAX / Pages)
    case 'createBlankPlan': $planController->createBlankPlanAction(); break;
    case 'createSvgPlan': $planController->createSvgPlanAction(); break;
    case 'saveDrawing': $planController->saveDrawingAction(); break;
    case 'updateSvgPlan': $planController->apiUpdateSvgPlanAction(); break;

    // Plans (Historique - AJAX)
    case 'getHistory': $planController->getHistoryAction(); break;
    // case 'restorePosition': $planController->restorePositionAction(); break; // Décommenter si implémenté

    // Univers
    case 'listUnivers': $universController->listAction(); break;
    case 'addUnivers': $universController->addAction(); break;
    case 'updateUnivers': $universController->updateAction(); break;
    case 'deleteUnivers': $universController->deleteAction(); break;

    // ** NOUVEAU: Assets (AJAX) **
    case 'apiListAssets': $assetController->listAssetsAction(); break;
    case 'apiGetAsset': $assetController->getAssetAction(); break;
    case 'apiSaveAsset': $assetController->saveAssetAction(); break;
    case 'apiDeleteAsset': $assetController->deleteAssetAction(); break;

    // Action par défaut
    default:
        $dashboardController->indexAction(); // Redirige vers le tableau de bord
        break;
}

?>
