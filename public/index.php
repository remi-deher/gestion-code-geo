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
require_once '../controllers/BaseController.php'; // Assurez-vous qu'il est bien inclus
require_once '../controllers/DashboardController.php';
require_once '../controllers/GeoCodeController.php';
require_once '../controllers/PlanController.php';
require_once '../controllers/UniversController.php';

// Initialisation des contrôleurs
$dashboardController = new DashboardController($db);
$geoCodeController = new GeoCodeController($db);
$planController = new PlanController($db);
$universController = new UniversController($db);

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
    case 'printLabels': $geoCodeController->showPrintOptionsAction(); break; // Options impression étiquettes
    case 'generatePrint': $geoCodeController->generatePrintPageAction(); break; // Génère page HTML étiquettes
    case 'printSingle': $geoCodeController->printSingleLabelAction(); break; // Imprime une seule étiquette

    // Plans (Gestion CRUD et Métadonnées)
    case 'listPlans': $planController->listPlansAction(); break;
    case 'addPlanForm': $planController->addPlanFormAction(); break; // Afficher formulaire ajout (image/pdf/svg)
    case 'addPlan': $planController->addPlanAction(); break; // Traiter ajout (image/pdf/svg)
    case 'editPlan': $planController->editPlanAction(); break; // Afficher formulaire modif (métadonnées + remplacement fichier)
    case 'updatePlan': $planController->updatePlanAction(); break; // Traiter modif (métadonnées + remplacement fichier)
    case 'deletePlan': $planController->deletePlanAction(); break;

    // Plans (Visualisation et Édition Contenu)
    case 'viewPlan': $planController->viewPlanAction(); break; // Consultation
    case 'manageCodes': $planController->manageCodesAction(); break; // Édition (codes + dessin)
    case 'printPlan': $planController->printPlanAction(); break; // Imprimer le plan avec codes/dessins

    // Plans (Actions AJAX pour l'éditeur)
    case 'getAvailableCodesForPlan': $planController->getAvailableCodesForPlanAction(); break; // AJAX
    case 'savePosition': $planController->savePositionAction(); break; // AJAX (pour tags géo)
    case 'removePosition': $planController->removePositionAction(); break; // AJAX (pour tags géo)
    case 'removeMultiplePositions': $planController->removeMultiplePositionsAction(); break; // AJAX (pour tags géo)
    // case 'saveMultiplePositions': $planController->saveMultiplePositionsAction(); break; // AJAX (si besoin)

    // Plans (NOUVELLES Actions Dessin AJAX / Pages)
    case 'createBlankPlan': $planController->createBlankPlanAction(); break; // Afficher page création SVG
    case 'createSvgPlan': $planController->createSvgPlanAction(); break; // AJAX: Enregistrer nouveau SVG
    case 'saveDrawing': $planController->saveDrawingAction(); break; // AJAX: Sauvegarder annotations JSON sur image
    case 'updateSvgPlan': $planController->updateSvgPlanAction(); break; // AJAX: Mettre à jour contenu SVG existant

    // Plans (Historique - si implémenté)
    case 'getHistory': $planController->getHistoryAction(); break; // AJAX
    // case 'restorePosition': $planController->restorePositionAction(); break; // AJAX

    // Univers
    case 'listUnivers': $universController->listAction(); break;
    case 'addUnivers': $universController->addAction(); break;
    case 'updateUnivers': $universController->updateAction(); break; // Mise à jour complète via formulaire
    case 'deleteUnivers': $universController->deleteAction(); break;
    // case 'updateUniversZone': $universController->updateZoneAction(); break; // Potentiellement obsolète si géré par updateUnivers

    // Action par défaut
    default:
        // Sécurité : évite l'inclusion de fichiers arbitraires
        // Afficher le tableau de bord ou une page d'erreur 404
        // header("HTTP/1.0 404 Not Found");
        // echo "Action non trouvée.";
        // exit;
        $dashboardController->indexAction(); // Redirige vers le tableau de bord par défaut
        break;
}
