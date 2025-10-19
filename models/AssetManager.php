<?php
// Fichier: models/AssetManager.php

class AssetManager {

    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Crée un nouvel asset.
     * @param string $name Nom de l'asset.
     * @param string $jsonData Données JSON de l'objet Fabric.
     * @param int|null $userId ID de l'utilisateur (optionnel).
     * @return int|false L'ID du nouvel asset ou false si erreur.
     */
    public function createAsset(string $name, string $jsonData, ?int $userId = null) {
        try {
            $sql = "INSERT INTO assets (user_id, name, data) VALUES (?, ?, ?)";
            $stmt = $this->db->prepare($sql);
            if ($stmt->execute([$userId, $name, $jsonData])) {
                return (int)$this->db->lastInsertId();
            }
            return false;
        } catch (PDOException $e) {
            error_log("Erreur AssetManager::createAsset: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Récupère un asset par son ID.
     * @param int $id ID de l'asset.
     * @return array|false Les données de l'asset (incluant le JSON 'data') ou false.
     */
    public function getAssetById(int $id) {
        try {
            // Renvoie la colonne 'data' directement, elle sera décodée par le JS
            $sql = "SELECT id, name, data FROM assets WHERE id = ?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$id]);
            $asset = $stmt->fetch(PDO::FETCH_ASSOC);

            // Important: Ne pas décoder le JSON ici, le JS s'en chargera
            return $asset; // Renvoie ['id' => ..., 'name' => ..., 'data' => '{...}']

        } catch (PDOException $e) {
            error_log("Erreur AssetManager::getAssetById: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Récupère tous les assets (ou ceux d'un utilisateur).
     * @param int|null $userId ID de l'utilisateur (optionnel).
     * @return array Liste des assets (sans les données JSON complètes).
     */
    public function getAllAssets(?int $userId = null): array {
        try {
            $sql = "SELECT id, name FROM assets"; // Ne sélectionne que id et nom pour la liste
            $params = [];
            if ($userId !== null) {
                $sql .= " WHERE user_id = ?";
                $params[] = $userId;
            }
            $sql .= " ORDER BY name ASC";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Erreur AssetManager::getAllAssets: " . $e->getMessage());
            return [];
        }
    }

    // Optionnel: Ajouter une méthode deleteAsset(int $id) si nécessaire
}
