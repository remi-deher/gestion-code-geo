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
        error_log("DEBUG: Entrée dans listAssetsAction."); // Log 1

        header('Content-Type: application/json');
        try {
            $assets = $this->assetManager->getAllAssets();
            error_log("DEBUG: Assets récupérés: " . print_r($assets, true)); // Log 2

            $jsonOutput = json_encode($assets);
            if (json_last_error() !== JSON_ERROR_NONE) {
                error_log("DEBUG: Erreur json_encode: " . json_last_error_msg()); // Log 3 (si erreur JSON)
                throw new Exception("Erreur d'encodage JSON: " . json_last_error_msg());
            }

            error_log("DEBUG: JSON généré: " . $jsonOutput); // Log 4

            echo $jsonOutput;
            error_log("DEBUG: Sortie de listAssetsAction avant exit()."); // Log 5

            exit(); // Point crucial

        } catch (Exception $e) {
            error_log("DEBUG: Exception dans listAssetsAction: " . $e->getMessage()); // Log 6 (si exception)
            http_response_code(500);
            // Assurez-vous d'encoder aussi le message d'erreur
            echo json_encode(['status' => 'error', 'message' => 'Erreur serveur lors du listage des assets: ' . $e->getMessage()]);
            exit(); // Sortie en cas d'erreur
        }
        // Si le script arrive ici, c'est qu'il n'est pas sorti via exit() !
        error_log("DEBUG: FIN ANORMALE de listAssetsAction (exit() non atteint ?)"); // Log 7
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
        
        // --- DEBUT LOGS ---
        $rawInput = file_get_contents('php://input'); // Lire le corps brut
        error_log("DEBUG saveAsset - Raw Input: " . $rawInput); // Log 1: Voir le JSON brut reçu

        $input = json_decode($rawInput, true); // Décoder en tableau associatif
        error_log("DEBUG saveAsset - Decoded Input: " . print_r($input, true)); // Log 2: Voir le tableau PHP (ou NULL si échec)
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("DEBUG saveAsset - JSON Decode Error: " . json_last_error_msg()); // Log 2.1: Erreur JSON ?
        }
        // --- FIN LOGS ---

        $name = trim($input['nom'] ?? ''); // Utilise bien 'nom'
        $data = $input['data'] ?? null;    // Utilise bien 'data'
        
        // La vérification qui pose problème
        if (empty($name) || empty($data)) { 
            error_log("DEBUG saveAsset - Check failed: empty(name)=" . (empty($name) ? 'true' : 'false') . ", empty(data)=" . (empty($data) ? 'true' : 'false')); // Log 3: Pourquoi le check échoue ?
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Nom ou données de l\'asset manquants.']);
            exit();
        }

        // Convertir les données de l'objet Fabric en JSON valide pour la BDD
        $jsonData = json_encode($data);
        if ($jsonData === false) {
             http_response_code(400);
	     error_log("DEBUG saveAsset - JSON Encode Error before DB: " . json_last_error_msg()); // Log si l'encodage pour la BDD échoue
             echo json_encode(['status' => 'error', 'message' => 'Données de l\'asset invalides (JSON).']);
             exit();
        }

        $newId = $this->assetManager->createAsset($name, $jsonData /*, $userId*/);

        if ($newId) {
            echo json_encode(['status' => 'success', 'asset_id' => $newId]);
        } else {
	    error_log("DEBUG saveAsset - DB Error: AssetManager::createAsset failed."); // Log si l'insertion BDD échoue
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Erreur lors de la sauvegarde de l\'asset.']);
        }
        exit();
    }
}
