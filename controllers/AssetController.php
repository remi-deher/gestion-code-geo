<?php
// Fichier: controllers/AssetController.php

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/AssetManager.php';

class AssetController extends BaseController {

    private $assetManager;

    public function __construct(PDO $db) {
        $this->assetManager = new AssetManager($db);
        // Configurer PDO pour lever des exceptions est fait dans le manager maintenant
    }

    /**
     * Renvoie la liste des assets disponibles en JSON.
     * Ne renvoie que les ID et les noms.
     */
    public function listAssetsAction() {
        // Log de débogage pour vérifier l'entrée dans la fonction
        error_log("DEBUG AssetController: Entrée dans listAssetsAction.");

        header('Content-Type: application/json'); // S'assurer que le header est défini tôt
        try {
            $assets = $this->assetManager->getAllAssets(); // Appel au manager

            // Log de débogage pour voir les données récupérées
            error_log("DEBUG AssetController: Assets récupérés depuis le manager: " . print_r($assets, true));

            // Encoder les données en JSON
            $jsonOutput = json_encode($assets);

            // Vérifier les erreurs d'encodage JSON
            if (json_last_error() !== JSON_ERROR_NONE) {
                $jsonErrorMsg = json_last_error_msg();
                error_log("DEBUG AssetController: Erreur json_encode dans listAssetsAction: " . $jsonErrorMsg);
                throw new Exception("Erreur d'encodage JSON: " . $jsonErrorMsg);
            }

            // Log de débogage pour voir le JSON final avant l'envoi
            error_log("DEBUG AssetController: JSON généré pour listAssetsAction: " . $jsonOutput);

            // Envoyer la réponse JSON
            echo $jsonOutput;

            // Log de débogage juste avant la sortie
            error_log("DEBUG AssetController: Sortie normale de listAssetsAction après echo.");

            exit(); // Terminer explicitement le script ici

        } catch (Exception $e) {
            // Log de l'exception
            error_log("DEBUG AssetController: Exception dans listAssetsAction: " . $e->getMessage());

            // Vérifier si les headers n'ont pas déjà été envoyés (peu probable ici mais bonne pratique)
            if (!headers_sent()) {
                http_response_code(500); // Erreur serveur
                // Envoyer une réponse d'erreur JSON
                echo json_encode(['success' => false, 'error' => 'Erreur serveur lors de la récupération des assets: ' . $e->getMessage()]);
            }
            exit(); // Terminer en cas d'erreur
        }
        // Ce log ne devrait jamais être atteint si exit() fonctionne
        error_log("DEBUG AssetController: FIN ANORMALE de listAssetsAction (exit() non atteint ?)");
    }


    /**
     * Renvoie les données JSON complètes d'un asset spécifique.
     */
    public function getAssetAction() {
        header('Content-Type: application/json');
        $assetId = (int)($_GET['id'] ?? 0);

        if ($assetId <= 0) {
            http_response_code(400); // Bad Request
            echo json_encode(['success' => false, 'error' => 'ID d\'asset invalide fourni.']);
            exit();
        }

        try {
            $assetData = $this->assetManager->getAssetById($assetId);

            if ($assetData) {
                // Le manager renvoie déjà le bon format {id, name, data: '{...}'}
                echo json_encode($assetData); // Ne pas ré-encoder la clé 'data'
            } else {
                http_response_code(404); // Not Found
                echo json_encode(['success' => false, 'error' => 'Asset non trouvé.']);
            }
        } catch (Exception $e) {
            error_log("Exception dans getAssetAction (ID: $assetId): " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erreur serveur lors de la récupération de l\'asset: ' . $e->getMessage()]);
        }
        exit();
    }

    /**
     * Sauvegarde un nouvel asset envoyé en JSON (nom et data).
     */
    public function saveAssetAction() {
        header('Content-Type: application/json');
        $rawInput = file_get_contents('php://input');
        $input = json_decode($rawInput, true); // Décoder en tableau associatif

        // Log initial pour débogage
        error_log("DEBUG saveAssetAction - Raw Input: " . $rawInput);
        error_log("DEBUG saveAssetAction - Decoded Input: " . print_r($input, true));

        if (json_last_error() !== JSON_ERROR_NONE) {
            http_response_code(400); // Bad Request - JSON invalide
            echo json_encode(['status' => 'error', 'message' => 'Données JSON invalides: ' . json_last_error_msg()]);
            exit();
        }

        $name = trim($input['nom'] ?? ''); // 'nom' attendu par le JS
        $data = $input['data'] ?? null;    // 'data' attendu par le JS (sera un tableau/objet PHP ici)

        // Vérifier que le nom n'est pas vide et que data existe
        if (empty($name) || $data === null) {
            error_log("DEBUG saveAssetAction - Check failed: empty(name)=" . (empty($name) ? 'true' : 'false') . ", data===null=" . ($data === null ? 'true' : 'false'));
            http_response_code(400); // Bad Request
            echo json_encode(['status' => 'error', 'message' => 'Le nom et les données de l\'asset sont requis.']);
            exit();
        }

        // Convertir les données de l'objet Fabric (tableau/objet PHP) en chaîne JSON pour la BDD
        $jsonData = json_encode($data);
        if ($jsonData === false) {
             http_response_code(400); // Bad Request - Erreur d'encodage des données internes
             error_log("DEBUG saveAssetAction - JSON Encode Error before DB: " . json_last_error_msg());
             echo json_encode(['status' => 'error', 'message' => 'Erreur lors de l\'encodage des données de l\'asset pour la base de données.']);
             exit();
        }

        // TODO: Récupérer l'ID utilisateur si l'authentification est implémentée
        $userId = null; // Mettre null pour l'instant

        try {
            $newId = $this->assetManager->createAsset($name, $jsonData, $userId);

            if ($newId !== false) {
                 // Succès: renvoyer le statut et l'ID créé
                echo json_encode(['status' => 'success', 'asset_id' => $newId]);
            } else {
                 // Echec de l'insertion dans le manager
                $lastError = $this->assetManager->getLastError();
                $errorMessage = "Erreur interne lors de la sauvegarde de l'asset.";
                 if ($lastError && isset($lastError[2])) {
                    $errorMessage .= " Détail BDD: " . $lastError[2];
                 }
                error_log("DEBUG saveAssetAction - DB Error: AssetManager::createAsset failed. " . $errorMessage);
                http_response_code(500); // Internal Server Error
                echo json_encode(['status' => 'error', 'message' => $errorMessage]);
            }
        } catch (Exception $e) {
            // Capturer d'autres exceptions potentielles
            error_log("Exception in saveAssetAction: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Erreur serveur inattendue: ' . $e->getMessage()]);
        }
        exit();
    }

    /**
     * Supprime un asset. Attend l'ID via POST (corps JSON) ou GET.
     */
    public function deleteAssetAction() {
        header('Content-Type: application/json');
        $assetId = 0;

        // Essayer de récupérer l'ID depuis POST (corps JSON) ou GET
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $assetId = (int)($input['id'] ?? 0);
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $assetId = (int)($_GET['id'] ?? 0);
        }

        // Log pour déboguer la réception de l'ID
        error_log("DEBUG deleteAssetAction - Tentative de suppression ID: " . $assetId . " (Méthode: " . $_SERVER['REQUEST_METHOD'] . ")");


        if ($assetId <= 0) {
            http_response_code(400); // Bad Request
            echo json_encode(['success' => false, 'error' => 'ID d\'asset invalide ou manquant.']);
            exit();
        }

        try {
            $success = $this->assetManager->deleteAsset($assetId); // Appel au manager

            if ($success) {
                // Succès: renvoyer success: true
                echo json_encode(['success' => true]);
            } else {
                 // Echec de la suppression dans le manager (peut-être l'ID n'existait pas, ou erreur SQL)
                $lastError = $this->assetManager->getLastError();
                $errorMessage = 'Impossible de supprimer l\'asset (ID non trouvé ou erreur BDD).';
                 if ($lastError && isset($lastError[2])) { // Vérifie si on a une info d'erreur PDO
                    $errorMessage .= ' Erreur BDD: ' . $lastError[2];
                 } else {
                    // Si rowCount était 0, l'ID n'existait probablement pas
                    error_log("Échec suppression asset ID $assetId: L'asset n'existait peut-être pas.");
                 }
                 http_response_code(404); // Not Found ou Internal Server Error selon la cause
                echo json_encode(['success' => false, 'error' => $errorMessage]);
            }
        } catch (Exception $e) {
            // Capturer d'autres exceptions potentielles
            error_log("Exception dans deleteAssetAction (ID: $assetId): " . $e->getMessage());
            http_response_code(500); // Internal Server Error
            echo json_encode(['success' => false, 'error' => 'Erreur serveur lors de la suppression de l\'asset: ' . $e->getMessage()]);
        }
        exit();
    }
} // Fin de la classe AssetController
?>
