<?php
// Fichier: models/AssetManager.php

class AssetManager {

    private $db;
    // *** AJOUT : Propriété pour stocker la dernière erreur PDO ***
    private $lastError = null;

    public function __construct(PDO $db) {
        $this->db = $db;
        // *** AJOUT : Configurer PDO pour lever des exceptions en cas d'erreur ***
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }

    // *** AJOUT : Méthode pour récupérer la dernière erreur ***
    public function getLastError() {
        return $this->lastError;
    }

    /**
     * Crée un nouvel asset.
     * @param string $name Nom de l'asset.
     * @param string $jsonData Données JSON de l'objet Fabric (doit être une chaîne JSON valide).
     * @param int|null $userId ID de l'utilisateur (optionnel).
     * @return int|false L'ID du nouvel asset ou false si erreur.
     */
    public function createAsset(string $name, string $jsonData, ?int $userId = null) {
        $this->lastError = null; // Reset error
        // Vérifier si jsonData est un JSON valide avant l'insertion
        json_decode($jsonData);
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("Erreur AssetManager::createAsset: jsonData n'est pas un JSON valide.");
            $this->lastError = ['JSON Error', json_last_error(), json_last_error_msg()];
            return false;
        }

        try {
            $sql = "INSERT INTO assets (user_id, name, data) VALUES (:user_id, :name, :data)";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':user_id', $userId, $userId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $stmt->bindValue(':name', $name, PDO::PARAM_STR);
            $stmt->bindValue(':data', $jsonData, PDO::PARAM_STR); // Assurer que c'est traité comme une chaîne

            if ($stmt->execute()) {
                return (int)$this->db->lastInsertId();
            }
            $this->lastError = $stmt->errorInfo(); // Stocker l'erreur si execute échoue
            error_log("Erreur SQL AssetManager::createAsset: " . print_r($this->lastError, true));
            return false;
        } catch (PDOException $e) {
            error_log("Erreur PDOException AssetManager::createAsset: " . $e->getMessage());
            $this->lastError = $this->db->errorInfo(); // Stocker l'erreur PDO
            return false;
        }
    }

    /**
     * Récupère un asset par son ID.
     * @param int $id ID de l'asset.
     * @return array|false Les données de l'asset (incluant le JSON 'data' comme chaîne) ou false.
     */
    public function getAssetById(int $id) {
        $this->lastError = null; // Reset error
        try {
            // Renvoie la colonne 'data' directement comme chaîne JSON
            $sql = "SELECT id, name, data FROM assets WHERE id = ?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$id]);
            $asset = $stmt->fetch(PDO::FETCH_ASSOC);

            return $asset ?: false; // Renvoie false si non trouvé

        } catch (PDOException $e) {
            error_log("Erreur AssetManager::getAssetById: " . $e->getMessage());
            $this->lastError = $this->db->errorInfo();
            return false;
        }
    }

    /**
     * Récupère tous les assets (ou ceux d'un utilisateur).
     * @param int|null $userId ID de l'utilisateur (optionnel).
     * @return array Liste des assets (id, name seulement).
     */
    public function getAllAssets(?int $userId = null): array {
        $this->lastError = null; // Reset error
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
             $this->lastError = $this->db->errorInfo();
            return [];
        }
    }

    /**
     * Supprime un asset par son ID.
     * @param int $id ID de l'asset à supprimer.
     * @return bool True si la suppression a réussi, false sinon.
     */
    public function deleteAsset(int $id): bool {
        $this->lastError = null; // Reset error
        try {
            $sql = "DELETE FROM assets WHERE id = ?";
            $stmt = $this->db->prepare($sql);
            $success = $stmt->execute([$id]);
            if (!$success) {
                $this->lastError = $stmt->errorInfo();
                error_log("Erreur SQL AssetManager::deleteAsset: " . print_r($this->lastError, true));
                return false;
            }
            // rowCount() > 0 assure qu'une ligne a bien été supprimée (l'ID existait)
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            error_log("Erreur PDOException AssetManager::deleteAsset (ID: $id): " . $e->getMessage());
            $this->lastError = $this->db->errorInfo();
            return false;
        }
    }
}
