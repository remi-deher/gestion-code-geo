<?php
// Fichier : public/index.php

ini_set('display_errors', 1);
error_reporting(E_ALL);
session_start();

// Inclut l'autoloader de Composer (si vous l'utilisez)
// Assurez-vous que le chemin est correct
if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';
} else {
    // Fallback si Composer n'est pas utilisé ou si le chemin est différent
    // Inclure manuellement les fichiers nécessaires (moins idéal)
}


// Connexion à la base de données
$dbConfigPath = __DIR__ . '/../config/database.php';
if (!file_exists($dbConfigPath)) {
    die("Erreur: Le fichier de configuration de la base de données 'config/database.php' est manquant.");
}
$dbConfig = require $dbConfigPath;
$dsn = "mysql:host={$dbConfig['host']};dbname={$dbConfig['dbname']};charset={$dbConfig['charset']}";
try {
    $db = new PDO($dsn, $dbConfig['user'], $dbConfig['password']);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log('Erreur de connexion BDD: ' . $e->getMessage());
    // En production, afficher un message plus générique
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
    case 'handleExport': $geoCodeController->handleExportAction(); break; // Renvoie JSON maintenant
    case 'showImport': $geoCodeController->showImportAction(); break;
    case 'handleImport': $geoCodeController->handleImportAction(); break;
    case 'printLabels': $geoCodeController->showPrintOptionsAction(); break; // Page options PDF (JS)
    // case 'printSingle': $geoCodeController->printSingleLabelAction(); break; // Ancienne méthode HTML (commentée/supprimée)
    case 'getCodesForPrint': $geoCodeController->getCodesForPrintAction(); break; // AJAX pour Générateur PDF Lot
    case 'getSingleGeoCodeJson': $geoCodeController->getSingleGeoCodeJsonAction(); break; // NOUVELLE ROUTE AJAX pour impression unique

    // Univers
    case 'listUnivers': $universController->listAction(); break;
    case 'addUnivers': $universController->addAction(); break;
    case 'updateUnivers': $universController->updateAction(); break;
    case 'deleteUnivers': $universController->deleteAction(); break;

    // --- PLANS ---
    case 'listPlans': $planController->listAction(); break; // Affiche la liste des plans
    case 'addPlanForm': $planController->addPlanFormAction(); break; // Affiche le formulaire d'ajout
    case 'handleAddPlan': $planController->handleAddPlanAction(); break; // Traite l'ajout d'un plan uploadé
    case 'editPlan': $planController->editPlanAction(); break; // Affiche le formulaire de modification (métadonnées)
    case 'handleUpdatePlan': $planController->handleUpdatePlanAction(); break; // Traite la modification (métadonnées)
    case 'deletePlan': $planController->deletePlanAction(); break; // Supprime (soft delete) un plan
    case 'viewPlan': $planController->viewPlanAction(); break; // Affiche l'éditeur/visualiseur unifié
    case 'printPlan': $planController->printPlanAction(); break; // Action pour l'impression (vue simple pour l'instant)

    // --- API pour l'éditeur de plan (appelées par JS) ---
    case 'apiSaveDrawing': $planController->saveDrawingAction(); break; // Sauvegarde le dessin Fabric.js
    case 'apiPlaceGeoCode': $planController->placeGeoCodeAction(); break; // Ajoute/Met à jour une position
    case 'apiRemoveGeoCode': $planController->removeGeoCodeAction(); break; // Supprime une position
    case 'apiSavePageFormat': $planController->savePageFormatAction(); break; // Sauvegarde format de la page

    // --- ASSETS ---
    case 'manageAssets': $assetsController->manageAction(); break; // Page de gestion (HTML)
    // API Actions (JSON)
    case 'apiListAssets': $assetsController->listAction(); break;   // Récupère la liste
    case 'apiGetAsset': $assetsController->getAction(); break;     // Récupère un asset spécifique
    case 'apiCreateAsset': $assetsController->createAction(); break; // Crée un asset depuis l'éditeur
    case 'apiDeleteAsset': $assetsController->deleteAction(); break; // Supprime un asset

    // Action non trouvée ou par défaut
    default:
        // Rediriger vers le tableau de bord
        $dashboardController->indexAction();
        break;
}

?>
