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
    error_log('Erreur de connexion BDD: ' . $e->getMessage());
    die('Erreur de connexion à la base de données. Veuillez réessayer plus tard.');
}

// Chargement des contrôleurs nécessaires
require_once '../controllers/BaseController.php';
require_once '../controllers/DashboardController.php';
require_once '../controllers/GeoCodeController.php';
require_once '../controllers/UniversController.php';
// Retrait des contrôleurs PlanController et AssetController

// Initialisation des contrôleurs
$dashboardController = new DashboardController($db);
$geoCodeController = new GeoCodeController($db);
$universController = new UniversController($db);
// Retrait de l'initialisation de PlanController et AssetController

// Action par défaut
$action = $_GET['action'] ?? 'dashboard';

// Routage simplifié
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
    // Retrait de 'addGeoCodeFromPlan' et 'getAllCodesJson' qui dépendaient des plans
    case 'showBatchCreate': $geoCodeController->showBatchCreateAction(); break;
    case 'handleBatchCreate': $geoCodeController->handleBatchCreateAction(); break;

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
    case 'printLabels': $geoCodeController->showPrintOptionsAction(); break; // Options impression étiquettes PDF
    case 'printSingle': $geoCodeController->printSingleLabelAction(); break; // Imprime une seule étiquette (ancienne méthode HTML)
    case 'getCodesForPrint': $geoCodeController->getCodesForPrintAction(); break; // AJAX pour PDF Generator

    // Univers
    case 'listUnivers': $universController->listAction(); break;
    case 'addUnivers': $universController->addAction(); break;
    case 'updateUnivers': $universController->updateAction(); break;
    case 'deleteUnivers': $universController->deleteAction(); break;
    // Retrait de updateZoneAction (intégrée dans updateUnivers)

    // ** Retrait de toutes les routes Plans et Assets **

    // Action par défaut
    default:
        $dashboardController->indexAction(); // Redirige vers le tableau de bord
        break;
}

?>
