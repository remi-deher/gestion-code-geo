<?php
// Fichier : public/index.php

ini_set('display_errors', 1);
error_reporting(E_ALL);
session_start();

// --- MODIFICATION IMPORTANTE ---
// On inclut l'autoloader de Composer qui charge toutes les bibliothèques.
require_once __DIR__ . '/../vendor/autoload.php';


// Connexion à la base de données
$dbConfig = require_once '../config/database.php';
$dsn = "mysql:host={$dbConfig['host']};dbname={$dbConfig['dbname']};charset={$dbConfig['charset']}";
try {
    $db = new PDO($dsn, $dbConfig['user'], $dbConfig['password']);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die('Erreur de connexion : ' . $e->getMessage());
}

// Chargement des contrôleurs
require_once '../controllers/DashboardController.php';
require_once '../controllers/GeoCodeController.php';
require_once '../controllers/PlanController.php';
require_once '../controllers/UniversController.php';

// Initialisation des contrôleurs
$dashboardController = new DashboardController($db);
$geoCodeController = new GeoCodeController($db);
$planController = new PlanController($db);
$universController = new UniversController($db);

// La page par défaut est maintenant 'dashboard'
$action = $_GET['action'] ?? 'dashboard';

// Routage
switch ($action) {
    // Dashboard
    case 'dashboard': $dashboardController->indexAction(); break;

    // Codes Géo
    case 'list': $geoCodeController->listAction(); break;
    case 'create': $geoCodeController->createAction(); break;
    case 'add': $geoCodeController->addAction(); break;
    case 'edit': $geoCodeController->editAction(); break;
    case 'update': $geoCodeController->updateAction(); break;
    case 'delete': $geoCodeController->deleteAction(); break;
    case 'showBatchCreate': $geoCodeController->showBatchCreateAction(); break;
    case 'handleBatchCreate': $geoCodeController->handleBatchCreateAction(); break;
    case 'getAllCodesJson': $geoCodeController->getAllCodesJsonAction(); break;
    
    // Import/Export et Impression
    case 'export': $geoCodeController->exportAction(); break;
    case 'showExport': $geoCodeController->showExportAction(); break;
    case 'handleExport': $geoCodeController->handleExportAction(); break;
    case 'showImport': $geoCodeController->showImportAction(); break;
    case 'handleImport': $geoCodeController->handleImportAction(); break;
    case 'printLabels': $geoCodeController->showPrintOptionsAction(); break;
    case 'generatePrint': $geoCodeController->generatePrintPageAction(); break;
    case 'printSingle': $geoCodeController->printSingleLabelAction(); break; 
    case 'generatePdf': $geoCodeController->generatePdfAction(); break; 

    // Plans
    case 'plan': $planController->planAction(); break;
    case 'savePosition': $planController->savePositionAction(); break;
    case 'removePosition': $planController->removePositionAction(); break;
    case 'saveMultiplePositions': $planController->saveMultiplePositionsAction(); break;
    case 'listPlans': $planController->listPlansAction(); break;
    case 'addPlan': $planController->addPlanAction(); break;
    case 'deletePlan': $planController->deletePlanAction(); break;
    case 'editPlan': $planController->editPlanAction(); break; 
    case 'updatePlan': $planController->updatePlanAction(); break; 
    case 'getAvailableCodesForPlan': $planController->getAvailableCodesForPlanAction(); break;
    case 'getHistory': $planController->getHistoryAction(); break;
    case 'restorePosition': $planController->restorePositionAction(); break;

    // Univers
    case 'listUnivers': $universController->listAction(); break;
    case 'addUnivers': $universController->addAction(); break;
    case 'deleteUnivers': $universController->deleteAction(); break;
    case 'updateUniversZone': $universController->updateZoneAction(); break;

    // Action par défaut
    default:
        $dashboardController->indexAction();
        break;
}
