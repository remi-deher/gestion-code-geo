<?php
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
    case 'create':
        $controller->createAction();
        break;
    case 'add':
        $controller->addAction();
        break;
    case 'plan':
        $controller->planAction();
        break;
    case 'savePosition':
        $controller->savePositionAction();
        break;
    case 'export': // Nouvelle route
        $controller->exportAction();
        break;
    case 'showImport': // Nouvelle route
        $controller->showImportAction();
        break;
    case 'handleImport': // Nouvelle route
        $controller->handleImportAction();
        break;
    case 'printLabels': // Nouvelle route
        $controller->printLabelsAction();
        break;
    case 'list':
    default:
        $controller->listAction();
        break;
}
