<?php

// --- Connexion à la base de données (à mettre dans un fichier de conf séparé) ---
$dsn = 'mysql:host=localhost;dbname=votre_db;charset=utf8';
$username = 'votre_user';
$password = 'votre_pass';

try {
    $db = new PDO($dsn, $username, $password);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die('Erreur de connexion : ' . $e->getMessage());
}

// --- Routage simple ---
require_once '../controllers/GeoCodeController.php';

$controller = new GeoCodeController($db);

// On regarde l'action demandée dans l'URL
$action = $_GET['action'] ?? 'list'; // Action par défaut: 'list'

switch ($action) {
    case 'add':
        $controller->addAction();
        break;
    case 'list':
    default:
        $controller->listAction();
        break;
    // Vous ajouterez ici les cas 'delete', 'edit', etc.
}
