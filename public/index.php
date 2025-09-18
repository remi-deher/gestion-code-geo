<?php

// --- 1. Charger la configuration de la base de données ---
$dbConfig = require_once '../config/database.php';


// --- 2. Connexion à la base de données ---
$dsn = "mysql:host={$dbConfig['host']};dbname={$dbConfig['dbname']};charset={$dbConfig['charset']}";

try {
    $db = new PDO($dsn, $dbConfig['user'], $dbConfig['password']);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die('Erreur de connexion à la base de données : ' . $e->getMessage());
}


// --- 3. Routage ---
require_once '../controllers/GeoCodeController.php';

$controller = new GeoCodeController($db);

// On regarde l'action demandée dans l'URL, avec 'list' comme action par défaut
$action = $_GET['action'] ?? 'list';

switch ($action) {
    case 'create': // Nouvelle action pour afficher le formulaire
        $controller->createAction();
        break;
    case 'add': // Action existante pour traiter la soumission du formulaire
        $controller->addAction();
        break;
    case 'plan': // Nouvelle action pour la page du plan
        $controller->planAction();
        break;
    case 'list':
    default:
        $controller->listAction();
        break;
}
