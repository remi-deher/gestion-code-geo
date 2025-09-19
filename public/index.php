<?php
// Fichier : public/index.php

$dbConfig = require_once '../config/database.php';
$dsn = "mysql:host={$dbConfig['host']};dbname={$dbConfig['dbname']};charset={$dbConfig['charset']}";
try {
    $db = new PDO($dsn, $dbConfig['user'], $dbConfig['password']);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die('Erreur de connexion : ' . $e->getMessage());
}

require_once '../controllers/GeoCodeController.php';
$controller = new GeoCodeController($db);
$action = $_GET['action'] ?? 'list';

switch ($action) {
    // Actions pour les Codes Géo
    case 'create':
        $controller->createAction();
        break;
    case 'add':
        $controller->addAction();
        break;
    case 'edit':
        $controller->editAction();
        break;
    case 'update':
        $controller->updateAction();
        break;
    case 'delete':
        $controller->deleteAction();
        break;
    case 'showBatchCreate':
        $controller->showBatchCreateAction();
        break;
    case 'handleBatchCreate':
        $controller->handleBatchCreateAction();
        break;

    // Actions pour le Plan
    case 'plan':
        $controller->planAction();
        break;
    case 'savePosition':
        $controller->savePositionAction();
        break;

    // Actions pour l'Import/Export
    case 'export':
        $controller->exportAction();
        break;
    case 'showImport':
        $controller->showImportAction();
        break;
    case 'handleImport':
        $controller->handleImportAction();
        break;
    case 'exportTemplate': // NOUVELLE ROUTE
        $controller->exportTemplateAction();
        break;
        
    // Actions pour l'impression
    case 'printLabels':
        $controller->showPrintOptionsAction();
        break;
    case 'generatePrint':
        $controller->generatePrintPageAction();
        break;

    // Actions pour les Univers
    case 'listUnivers':
        $controller->listUniversAction();
        break;
    case 'addUnivers':
        $controller->addUniversAction();
        break;
    case 'deleteUnivers':
        $controller->deleteUniversAction();
        break;

    // Action par défaut
    case 'list':
    default:
        $controller->listAction();
        break;
}
