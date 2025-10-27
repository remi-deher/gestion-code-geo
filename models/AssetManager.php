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
     * Ajoute un nouvel asset à partir de données JSON Fabric.js.
     * @param string $name Nom de l'asset.
     * @param string $fabricJsonData Données JSON de l'objet Fabric.
     * @param string|null $thumbnailDataUrl Miniatue en Data URL (optionnelle).
     * @return int|false L'ID de l'asset créé ou false en cas d'erreur.
     */
    public function addFabricAsset(string $name, string $fabricJsonData, ?string $thumbnailDataUrl): int|false {
        // Le type 'fabric' indique que la colonne 'data' contient du JSON Fabric.js
        $type = 'fabric';
        
        // Pour les assets JSON, 'nom_fichier' est NULL, on utilise 'data'.
        $sql = "INSERT INTO assets (name, type, data, thumbnail, created_at)
                VALUES (:name, :type, :data, :thumbnail, NOW())";
        try {
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':name', $name);
            $stmt->bindParam(':type', $type);
            $stmt->bindParam(':data', $fabricJsonData);
            $stmt->bindValue(':thumbnail', $thumbnailDataUrl, $thumbnailDataUrl === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

            if ($stmt->execute()) {
                return (int)$this->db->lastInsertId();
            } else {
                $this->lastError = $stmt->errorInfo();
                error_log("Erreur BDD (non-exception) lors de l'ajout de l'asset JSON '$name': " . ($this->lastError[2] ?? 'Inconnue'));
                return false;
            }
        } catch (PDOException $e) {
            $this->lastError = $e->errorInfo ?? [$e->getCode(), null, $e->getMessage()];
            // Gérer les contraintes uniques (ex: si le nom doit être unique)
            if ($e->getCode() == '23000' && str_contains($e->getMessage(), 'Duplicate entry')) {
                 $this->lastError = [null, null, "Un asset avec le nom '$name' existe déjà."];
            }
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

/**
     * Ajoute un nouvel asset à partir d'un fichier uploadé.
     * @param string $name Nom de l'asset.
     * @param string $filename Nom unique du fichier sauvegardé sur le serveur.
     * @param string $originalFilename Nom original du fichier pour déterminer le type.
     * @return int|false L'ID de l'asset créé ou false en cas d'erreur.
     */
    public function addFileAsset(string $name, string $filename, string $originalFilename): int|false {
        $extension = strtolower(pathinfo($originalFilename, PATHINFO_EXTENSION));
        $type = match ($extension) {
            'svg' => 'svg',
            'png' => 'image',
            'jpg', 'jpeg' => 'image',
            default => 'raw', // Ou gérer une erreur si type non supporté
        };

        if ($type === 'raw') {
            $this->lastError = [null, null, "Type de fichier non supporté: .$extension"];
            error_log("Tentative d'ajout d'asset avec un type non supporté: " . $originalFilename);
            return false;
        }

        // Pour les assets fichiers, 'data' peut être NULL, on utilise 'nom_fichier'.
        // Thumbnail pourrait être généré ici pour les images si GD ou Imagick sont dispo.
        $thumbnailDataUrl = null; 

        $sql = "INSERT INTO assets (name, type, nom_fichier, thumbnail, created_at)
                VALUES (:name, :type, :nom_fichier, :thumbnail, NOW())";
        try {
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':name', $name);
            $stmt->bindParam(':type', $type);
            $stmt->bindParam(':nom_fichier', $filename);
            $stmt->bindValue(':thumbnail', $thumbnailDataUrl, $thumbnailDataUrl === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

            if ($stmt->execute()) {
                return (int)$this->db->lastInsertId();
            } else {
                $this->lastError = $stmt->errorInfo();
                error_log("Erreur BDD (non-exception) lors de l'ajout de l'asset fichier '$name': " . ($this->lastError[2] ?? 'Inconnue'));
                return false;
            }
        } catch (PDOException $e) {
            $this->lastError = $e->errorInfo ?? [$e->getCode(), null, $e->getMessage()];
            // Vérifier si c'est une erreur de duplicata de nom (si on ajoute une contrainte UNIQUE sur 'name')
            // if ($e->getCode() == '23000') { ... }
            error_log("Erreur PDO addFileAsset pour '$name': " . $e->getMessage());
            return false;
        }
    }


}
?>
