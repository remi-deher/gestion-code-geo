<?php
// Fichier: controllers/AssetsController.php

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/AssetManager.php';

class AssetsController extends BaseController {

    private $assetManager;

    public function __construct(PDO $db) {
        $this->assetManager = new AssetManager($db);
    }

    /**
     * Action API: Récupère la liste des assets (pour la sidebar et la gestion).
     * Renvoie du JSON.
     */
    public function listAction() {
        header('Content-Type: application/json');
        try {
            $assets = $this->assetManager->getAllAssets();
            echo json_encode(['success' => true, 'assets' => $assets]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erreur serveur lors de la récupération des assets.']);
        }
        exit();
    }

    /**
     * Action API: Récupère les données complètes d'un asset spécifique (pour le placement).
     * Renvoie du JSON.
     */
    public function getAction() {
        header('Content-Type: application/json');
        $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

        if (!$id || $id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID d\'asset invalide.']);
            exit();
        }

        try {
            $asset = $this->assetManager->getAssetById($id);
            if ($asset) {
                // Important: Assurer que les données JSON sont bien décodées si stockées comme JSON natif
                // Si stocké en LONGTEXT, elles sont déjà une string.
                // $asset['data'] = json_decode($asset['data']); // Décommenter si type JSON en BDD

                echo json_encode(['success' => true, 'asset' => $asset]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Asset non trouvé.']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            error_log("Erreur getAction Asset ID $id: " . $e->getMessage());
            echo json_encode(['success' => false, 'error' => 'Erreur serveur lors de la récupération de l\'asset.']);
        }
        exit();
    }


    /**
     * Action API: Crée un nouvel asset à partir des données envoyées par l'éditeur.
     * Attend du JSON en POST: { name: "nom_asset", jsonData: "...", thumbnailDataUrl: "..." }
     * Renvoie du JSON.
     */
    public function createAction() {
        header('Content-Type: application/json');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405); echo json_encode(['success' => false, 'error' => 'Méthode POST requise.']); exit();
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $name = trim($input['name'] ?? '');
        $jsonData = $input['jsonData'] ?? null; // C'est déjà une chaîne JSON
        $thumbnailDataUrl = $input['thumbnailDataUrl'] ?? null;

        if (empty($name) || $jsonData === null) {
            http_response_code(400); echo json_encode(['success' => false, 'error' => 'Nom et données JSON requis pour créer l\'asset.']); exit();
        }

        try {
            $assetId = $this->assetManager->addFabricAsset($name, $jsonData, $thumbnailDataUrl);

            if ($assetId) {
                // Récupérer l'asset nouvellement créé pour le renvoyer (sans les data)
                $newAsset = $this->assetManager->getAssetById($assetId); // Assurez-vous que getAssetById existe et renvoie au moins id, name, type, thumbnail
                if ($newAsset) { unset($newAsset['data']); } // Ne pas renvoyer les grosses data

                echo json_encode(['success' => true, 'message' => 'Asset créé avec succès.', 'asset' => $newAsset ?? ['id' => $assetId, 'name' => $name]]);
            } else {
                http_response_code(500); echo json_encode(['success' => false, 'error' => 'Erreur lors de l\'enregistrement de l\'asset en base de données.']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            error_log("Erreur createAction Asset: " . $e->getMessage());
            echo json_encode(['success' => false, 'error' => 'Erreur serveur lors de la création de l\'asset.']);
        }
        exit();
    }

    /**
     * Action API: Supprime un asset.
     * Attend l'ID en POST: { id: 123 }
     * Renvoie du JSON.
     */
    public function deleteAction() {
        header('Content-Type: application/json');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { // Ou DELETE si configuré
            http_response_code(405); echo json_encode(['success' => false, 'error' => 'Méthode POST requise.']); exit();
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $id = filter_var($input['id'] ?? 0, FILTER_VALIDATE_INT);

        if ($id <= 0) {
            http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID d\'asset invalide.']); exit();
        }

        try {
            $success = $this->assetManager->deleteAsset($id);
            if ($success) {
                echo json_encode(['success' => true, 'message' => 'Asset supprimé avec succès.']);
            } else {
                // Peut-être non trouvé ou erreur BDD
                http_response_code(404); // Ou 500 si erreur BDD
                echo json_encode(['success' => false, 'error' => 'Impossible de supprimer l\'asset (non trouvé ou erreur).']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            error_log("Erreur deleteAction Asset ID $id: " . $e->getMessage());
            echo json_encode(['success' => false, 'error' => 'Erreur serveur lors de la suppression de l\'asset.']);
        }
        exit();
    }

    /**
     * Affiche la page de gestion des assets (accessible depuis la liste des plans).
     * Cette action charge une VUE HTML, pas une API JSON.
     */
    public function manageAction() {
         // Récupérer les assets pour les afficher dans la vue
         $assets = $this->assetManager->getAllAssets();
         // Passer les données à une nouvelle vue 'assets_manage_view.php'
         $this->render('assets_manage_view', ['assets' => $assets]);
    }
}
?>
