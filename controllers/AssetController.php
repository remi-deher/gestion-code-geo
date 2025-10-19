<?php
// Fichier: controllers/AssetController.php

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/AssetManager.php';

class AssetController extends BaseController {

    private $assetManager;

    public function __construct(PDO $db) {
        $this->assetManager = new AssetManager($db);
    }

    /**
     * Renvoie la liste des assets disponibles en JSON.
     * TODO: Filtrer par user_id si nécessaire.
     */
    public function listAssetsAction() {
        header('Content-Type: application/json');
        // Pour l'instant, récupère tous les assets. Adapter avec user_id si besoin.
        $assets = $this->assetManager->getAllAssets();
        echo json_encode($assets);
        exit();
    }

    /**
     * Renvoie les données JSON d'un asset spécifique.
     */
    public function getAssetAction() {
        header('Content-Type: application/json');
        $assetId = (int)($_GET['id'] ?? 0);

        if ($assetId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'ID d\'asset invalide']);
            exit();
        }

        $assetData = $this->assetManager->getAssetById($assetId);

        if ($assetData) {
            // Renvoie directement le contenu (qui inclut le champ 'data')
            echo json_encode($assetData);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Asset non trouvé']);
        }
        exit();
    }

    /**
     * Sauvegarde un nouvel asset envoyé en JSON.
     */
    public function saveAssetAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);

        $name = trim($input['name'] ?? '');
        $data = $input['data'] ?? null;
        // $userId = $_SESSION['user_id'] ?? null; // Récupérer l'ID utilisateur si connecté

        if (empty($name) || empty($data)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Nom ou données de l\'asset manquants.']);
            exit();
        }

        // Convertir les données de l'objet Fabric en JSON valide pour la BDD
        $jsonData = json_encode($data);
        if ($jsonData === false) {
             http_response_code(400);
             echo json_encode(['status' => 'error', 'message' => 'Données de l\'asset invalides (JSON).']);
             exit();
        }

        $newId = $this->assetManager->createAsset($name, $jsonData /*, $userId*/);

        if ($newId) {
            echo json_encode(['status' => 'success', 'asset_id' => $newId]);
        } else {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Erreur lors de la sauvegarde de l\'asset.']);
        }
        exit();
    }

    // Optionnel: Ajouter une action deleteAssetAction() si nécessaire
}
