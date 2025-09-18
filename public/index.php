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
    case 'savePosition': // Nouvelle route pour la sauvegarde
        $controller->savePositionAction();
        break;
    case 'list':
    default:
        $controller->listAction();
        break;
}

