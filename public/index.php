<?php

// --- 1. Charger la configuration de la base de données ---
// On inclut le fichier qui retourne notre tableau de configuration.
$dbConfig = require_once '../config/database.php';


// --- 2. Connexion à la base de données ---
// On construit la chaîne de connexion DSN à partir de la configuration.
$dsn = "mysql:host={$dbConfig['host']};dbname={$dbConfig['dbname']};charset={$dbConfig['charset']}";

try {
    // On utilise les identifiants du fichier de configuration.
    $db = new PDO($dsn, $dbConfig['user'], $dbConfig['password']);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

} catch (PDOException $e) {
    // Pour la production, il faudrait une page d'erreur plus sobre.
    die('Erreur de connexion à la base de données : ' . $e->getMessage());
}


// --- 3. Routage (le reste du fichier ne change pas) ---
require_once '../controllers/GeoCodeController.php';

$controller = new GeoCodeController($db);

$action = $_GET['action'] ?? 'list';

switch ($action) {
    case 'add':
        $controller->addAction();
        break;
    case 'list':
    default:
        $controller->listAction();
        break;
}
