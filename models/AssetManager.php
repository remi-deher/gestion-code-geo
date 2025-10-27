<?php
// Fichier: models/AssetManager.php

class AssetManager {
    private $db;
    private $lastError; // Pour stocker les erreurs PDO

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Récupère tous les assets (sans les données volumineuses).
     * @return array La liste des assets (id, name, type, thumbnail).
     */
    public function getAllAssets(): array {
        // Ne récupère pas 'data' pour la liste pour des raisons de performance
        $sql = "SELECT id, name, type, thumbnail, created_at FROM assets ORDER BY name ASC";
        try {
            $stmt = $this->db->query($sql);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            $this->lastError = $e->errorInfo ?? [$e->getCode(), null, $e->getMessage()];
            error_log("Erreur getAllAssets: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Récupère les données complètes d'un asset par son ID.
     * @param int $id ID de l'asset.
     * @return array|false Les informations complètes de l'asset ou false si non trouvé.
     */
    public function getAssetById(int $id) {
        $sql = "SELECT * FROM assets WHERE id = :id";
        try {
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $asset = $stmt->fetch(PDO::FETCH_ASSOC);

            // Si le type de colonne 'data' est JSON natif en BDD, il faut le décoder ici
            // Si c'est LONGTEXT, il est déjà une chaîne, ce qui est attendu par le JS
            // if ($asset && isset($asset['data'])) {
            //     // Tenter de décoder si ce n'est pas déjà un objet/tableau
            //     if (is_string($asset['data'])) {
            //         $decodedData = json_decode($asset['data'], true);
            //         // Si le décodage réussit, remplacer la chaîne par l'objet/tableau
            //         if (json_last_error() === JSON_ERROR_NONE) {
            //             $asset['data'] = $decodedData;
            //         } else {
            //              error_log("Avertissement: Impossible de décoder JSON pour asset ID $id");
            //              // Laisser $asset['data'] comme chaîne pour Fabric.js loadFromJSON
            //         }
            //     }
            // }
            // Finalement, on laisse 'data' comme string JSON car loadFromJSON l'attend comme ça.

            return $asset;

        } catch (PDOException $e) {
            $this->lastError = $e->errorInfo ?? [$e->getCode(), null, $e->getMessage()];
            error_log("Erreur PDO getAssetById (ID: $id): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Ajoute un nouvel asset (créé depuis l'éditeur Fabric.js).
     * @param string $name Nom de l'asset.
     * @param string $jsonData Données JSON de l'objet/groupe Fabric.js (doit être une chaîne JSON valide).
     * @param string|null $thumbnailDataUrl Miniature en Data URL (optionnel).
     * @return int|false L'ID de l'asset créé ou false en cas d'erreur.
     */
    public function addFabricAsset(string $name, string $jsonData, ?string $thumbnailDataUrl = null): int|false {
        // Vérifier si le JSON est valide avant insertion (sécurité)
        json_decode($jsonData);
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("Erreur addFabricAsset: JSON invalide fourni pour l'asset '$name'. Erreur: " . json_last_error_msg());
            $this->lastError = [null, null, "Format JSON invalide pour l'asset."];
            return false;
        }

        $sql = "INSERT INTO assets (name, type, data, thumbnail, created_at)
                VALUES (:name, 'fabric', :data, :thumbnail, NOW())";
        try {
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':name', $name);
            // S'assurer que $jsonData est bien traité comme une chaîne, même si elle ressemble à un nombre, etc.
            $stmt->bindParam(':data', $jsonData, PDO::PARAM_STR);
            $stmt->bindValue(':thumbnail', $thumbnailDataUrl, $thumbnailDataUrl === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

            if ($stmt->execute()) {
                return (int)$this->db->lastInsertId();
            } else {
                $this->lastError = $stmt->errorInfo();
                error_log("Erreur BDD (non-exception) lors de l'ajout de l'asset '$name': " . ($this->lastError[2] ?? 'Inconnue'));
                return false;
            }
        } catch (PDOException $e) {
            $this->lastError = $e->errorInfo ?? [$e->getCode(), null, $e->getMessage()];
            error_log("Erreur PDO addFabricAsset pour '$name': " . $e->getMessage());
            return false;
        }
    }

    /**
     * Supprime un asset.
     * @param int $id ID de l'asset.
     * @return bool True si succès.
     */
    public function deleteAsset(int $id): bool {
        // Note : On ne vérifie pas si l'asset est utilisé dans un plan pour le moment.
        // Si nécessaire, il faudrait ajouter une logique pour vérifier dans la colonne 'drawing_data' des plans.
        $sql = "DELETE FROM assets WHERE id = :id";
        try {
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->rowCount() > 0; // Vrai si au moins une ligne a été affectée
        } catch (PDOException $e) {
            $this->lastError = $e->errorInfo ?? [$e->getCode(), null, $e->getMessage()];
            error_log("Erreur PDO deleteAsset (ID: $id): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Récupère la dernière erreur PDO enregistrée.
     * @return array|null Tableau [SQLSTATE, driver code, message] ou null.
     */
    public function getLastError(): ?array {
        return $this->lastError;
    }

    // Ajouter ici d'autres méthodes si nécessaire :
    // - updateAsset(...)
    // - searchAssets(...)
    // - addImageAsset(...) etc. pour d'autres types d'import
}
?>
