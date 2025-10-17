<?php
// Fichier: models/GeoCodeManager.php

class GeoCodeManager {

    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Récupère tous les codes géo actifs (non soft-deleted).
     * @return array La liste des codes géo.
     */
    public function getAllGeoCodes() {
        $stmt = $this->db->query("
            SELECT gc.*, u.nom as univers_nom 
            FROM geo_codes gc 
            JOIN univers u ON gc.univers_id = u.id 
            WHERE gc.deleted_at IS NULL
            ORDER BY gc.code_geo ASC
        ");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Récupère un code géo par son ID.
     * @param int $id L'ID du code géo.
     * @return array|false Les données du code géo ou false si non trouvé.
     */
    public function getGeoCodeById(int $id) {
        $stmt = $this->db->prepare("
            SELECT gc.*, u.nom as univers_nom 
            FROM geo_codes gc
            JOIN univers u ON gc.univers_id = u.id
            WHERE gc.id = ?
        ");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    /**
     * [CORRIGÉ] Récupère tous les codes géo avec leurs positions regroupées.
     * C'est la fonction principale utilisée par l'éditeur de plan.
     * La structure retournée est un tableau de codes géo, où chaque code a un sous-tableau 'placements'.
     * @return array Liste des codes géo avec leurs placements.
     */
    public function getAllGeoCodesWithPositions(): array {
        $sql = "
            SELECT 
                gc.id, gc.code_geo, gc.libelle, gc.commentaire, gc.univers_id, gc.zone,
                u.nom AS univers,
                gp.id AS position_id, gp.plan_id, gp.pos_x, gp.pos_y, 
                gp.width, gp.height, gp.anchor_x, gp.anchor_y
            FROM geo_codes gc
            JOIN univers u ON gc.univers_id = u.id
            LEFT JOIN geo_positions gp ON gc.id = gp.geo_code_id
            WHERE gc.deleted_at IS NULL
            ORDER BY gc.code_geo ASC, gp.plan_id
        ";
        
        $stmt = $this->db->query($sql);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $groupedCodes = [];
        foreach ($results as $row) {
            $codeId = $row['id'];
            
            // Si le code n'est pas encore dans notre tableau, on l'ajoute
            if (!isset($groupedCodes[$codeId])) {
                $groupedCodes[$codeId] = [
                    'id' => $codeId,
                    'code_geo' => $row['code_geo'],
                    'libelle' => $row['libelle'],
                    'commentaire' => $row['commentaire'],
                    'univers_id' => $row['univers_id'],
                    'zone' => $row['zone'],
                    'univers' => $row['univers'],
                    'placements' => [] // Initialise le tableau des placements
                ];
            }
            
            // Si une position existe pour cette ligne, on l'ajoute au sous-tableau 'placements'
            if ($row['position_id'] !== null) {
                $groupedCodes[$codeId]['placements'][] = [
                    'position_id' => (int)$row['position_id'],
                    'plan_id' => (int)$row['plan_id'],
                    'pos_x' => (float)$row['pos_x'],
                    'pos_y' => (float)$row['pos_y'],
                    'width' => $row['width'] ? (int)$row['width'] : null,
                    'height' => $row['height'] ? (int)$row['height'] : null,
                    'anchor_x' => $row['anchor_x'] ? (float)$row['anchor_x'] : null,
                    'anchor_y' => $row['anchor_y'] ? (float)$row['anchor_y'] : null
                ];
            }
        }
        
        // Retourne un tableau indexé numériquement, pas associatif
        return array_values($groupedCodes);
    }


    /**
     * Crée un nouveau code géo.
     * @param string $code_geo Le code.
     * @param string $libelle Le libellé.
     * @param int $univers_id L'ID de l'univers.
     * @param string|null $commentaire Le commentaire.
     * @return int|false L'ID du code créé ou false en cas d'échec ou de duplicata.
     */
    public function createGeoCode(string $code_geo, string $libelle, int $univers_id, ?string $commentaire) {
        try {
            // Récupérer la zone de l'univers
            $stmt = $this->db->prepare("SELECT zone_assignee FROM univers WHERE id = ?");
            $stmt->execute([$univers_id]);
            $univers = $stmt->fetch();
            $zone = $univers ? $univers['zone_assignee'] : 'vente';

            $sql = "INSERT INTO geo_codes (code_geo, libelle, univers_id, zone, commentaire) VALUES (?, ?, ?, ?, ?)";
            $stmt = $this->db->prepare($sql);
            if ($stmt->execute([$code_geo, $libelle, $univers_id, $zone, $commentaire])) {
                $lastId = (int)$this->db->lastInsertId();
                $this->_logHistory($lastId, 'created', json_encode(['code_geo' => $code_geo, 'libelle' => $libelle, 'univers_id' => $univers_id, 'commentaire' => $commentaire]));
                return $lastId;
            }
            return false;
        } catch (PDOException $e) {
            // Gérer les erreurs (notamment duplicata)
            if ($e->errorInfo[1] == 1062) { // Code erreur MySQL pour duplicata
                return false; 
            }
            error_log("Erreur PDO GeoCodeManager::createGeoCode: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Met à jour un code géo existant.
     * @param int $id L'ID du code à mettre à jour.
     * @param string $code_geo Le nouveau code.
     * @param string $libelle Le nouveau libellé.
     * @param int $univers_id Le nouvel ID d'univers.
     * @param string|null $commentaire Le nouveau commentaire.
     * @return bool True si succès, False sinon.
     */
    public function updateGeoCode(int $id, string $code_geo, string $libelle, int $univers_id, ?string $commentaire): bool {
        try {
            $oldCode = $this->getGeoCodeById($id); // Pour l'historique

            $stmt = $this->db->prepare("SELECT zone_assignee FROM univers WHERE id = ?");
            $stmt->execute([$univers_id]);
            $univers = $stmt->fetch();
            $zone = $univers ? $univers['zone_assignee'] : 'vente';

            $sql = "UPDATE geo_codes SET code_geo = ?, libelle = ?, univers_id = ?, zone = ?, commentaire = ? WHERE id = ?";
            $stmt = $this->db->prepare($sql);
            $success = $stmt->execute([$code_geo, $libelle, $univers_id, $zone, $commentaire, $id]);
            
            if ($success && $oldCode) {
                 $changes = $this->_getChanges($oldCode, ['code_geo' => $code_geo, 'libelle' => $libelle, 'univers_id' => $univers_id, 'commentaire' => $commentaire]);
                 if(!empty($changes)) {
                     $this->_logHistory($id, 'updated', json_encode($changes));
                 }
            }
            return $success;
        } catch (PDOException $e) {
            error_log("Erreur PDO GeoCodeManager::updateGeoCode: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Effectue un soft delete sur un code géo.
     * @param int $id L'ID du code à supprimer.
     * @return bool True si succès, False sinon.
     */
    public function softDeleteGeoCode(int $id): bool {
        try {
            $sql = "UPDATE geo_codes SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?";
            $stmt = $this->db->prepare($sql);
            $success = $stmt->execute([$id]);
            if ($success && $stmt->rowCount() > 0) {
                $this->_logHistory($id, 'deleted', 'Mis à la corbeille');
            }
            return $success;
        } catch (PDOException $e) {
            error_log("Erreur PDO GeoCodeManager::softDeleteGeoCode: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Restaure un code géo qui a été soft-deleted.
     * @param int $id L'ID du code à restaurer.
     * @return bool True si succès, False sinon.
     */
    public function restoreGeoCode(int $id): bool {
        try {
            $sql = "UPDATE geo_codes SET deleted_at = NULL WHERE id = ?";
            $stmt = $this->db->prepare($sql);
            $success = $stmt->execute([$id]);
            if ($success && $stmt->rowCount() > 0) {
                $this->_logHistory($id, 'restored', 'Restauré depuis la corbeille');
            }
            return $success;
        } catch (PDOException $e) {
            error_log("Erreur PDO GeoCodeManager::restoreGeoCode: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Supprime définitivement un code géo de la base de données.
     * @param int $id L'ID du code à supprimer.
     * @return bool True si succès, False sinon.
     */
    public function forceDeleteGeoCode(int $id): bool {
        try {
            // La suppression en cascade dans la BDD gère geo_positions et geo_positions_history.
            // On supprime manuellement l'historique spécifique à geo_codes.
            $stmtHistory = $this->db->prepare("DELETE FROM geo_codes_history WHERE geo_code_id = ?");
            $stmtHistory->execute([$id]);

            $sql = "DELETE FROM geo_codes WHERE id = ?";
            $stmt = $this->db->prepare($sql);
            return $stmt->execute([$id]);
        } catch (PDOException $e) {
            error_log("Erreur PDO GeoCodeManager::forceDeleteGeoCode: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Récupère les codes géo qui sont dans la corbeille.
     * @return array La liste des codes géo supprimés.
     */
    public function getTrashedGeoCodes() {
        $stmt = $this->db->query("
            SELECT gc.*, u.nom as univers_nom 
            FROM geo_codes gc
            LEFT JOIN univers u ON gc.univers_id = u.id
            WHERE gc.deleted_at IS NOT NULL 
            ORDER BY gc.deleted_at DESC
        ");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Récupère les codes disponibles pour un plan donné.
     * Joint les univers associés au plan pour filtrer les codes pertinents.
     * Compte aussi combien de fois chaque code est déjà placé sur CE plan.
     * @param int $planId ID du plan.
     * @return array Liste des codes disponibles avec leur compte de placement sur le plan.
     */
    public function getAvailableCodesForPlan(int $planId): array {
        $sql = "
            SELECT 
                gc.id, gc.code_geo, gc.libelle, u.nom AS univers,
                (SELECT COUNT(*) FROM geo_positions WHERE geo_code_id = gc.id AND plan_id = :planId) as placement_count
            FROM geo_codes gc
            JOIN univers u ON gc.univers_id = u.id
            JOIN plan_univers pu ON u.id = pu.univers_id AND pu.plan_id = :planId
            WHERE gc.deleted_at IS NULL
            ORDER BY u.nom, gc.code_geo
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':planId' => $planId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Journalise une action dans la table d'historique des codes géo.
     * @param int $geoCodeId ID du code concerné.
     * @param string $actionType Type d'action.
     * @param string|null $details Détails de l'action (par ex., JSON des modifications).
     */
    private function _logHistory(int $geoCodeId, string $actionType, ?string $details = null) {
        try {
            $sql = "INSERT INTO geo_codes_history (geo_code_id, action_type, details) VALUES (?, ?, ?)";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$geoCodeId, $actionType, $details]);
        } catch (PDOException $e) {
            error_log("Erreur historique GeoCode {$geoCodeId}: " . $e->getMessage());
        }
    }
    
    /**
     * Calcule les différences entre l'ancien et le nouvel état d'un code géo.
     * @param array $oldData Données avant modification.
     * @param array $newData Données après modification.
     * @return array Tableau associatif des champs modifiés ['champ' => ['old' => val_old, 'new' => val_new]].
     */
    private function _getChanges(array $oldData, array $newData): array {
        $changes = [];
        $fieldsToCompare = ['code_geo', 'libelle', 'univers_id', 'commentaire']; // Champs pertinents pour l'historique
        foreach ($fieldsToCompare as $field) {
            // Gérer les cas où une valeur pourrait être null
            $oldValue = $oldData[$field] ?? null;
            $newValue = $newData[$field] ?? null;
            if ($oldValue !== $newValue) {
                $changes[$field] = ['old' => $oldValue, 'new' => $newValue];
            }
        }
        return $changes;
    }

    /**
     * Récupère l'historique complet des modifications pour un code géo spécifique.
     * @param int $geoCodeId ID du code géo.
     * @return array Liste des entrées d'historique.
     */
    public function getHistoryForCode(int $geoCodeId): array {
        $sql = "SELECT * FROM geo_codes_history WHERE geo_code_id = ? ORDER BY action_timestamp DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$geoCodeId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Récupère les dernières entrées de l'historique pour tous les codes géo.
     * @param int $limit Nombre maximum d'entrées à retourner.
     * @return array Liste des entrées d'historique.
     */
    public function getFullHistory(int $limit = 100): array {
        $sql = "
            SELECT h.*, gc.code_geo 
            FROM geo_codes_history h
            JOIN geo_codes gc ON h.geo_code_id = gc.id 
            ORDER BY h.action_timestamp DESC
            LIMIT ?
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Compte le nombre total de codes géo actifs.
     * @return int Le nombre total.
     */
    public function countTotalActiveCodes(): int {
        return (int)$this->db->query("SELECT COUNT(*) FROM geo_codes WHERE deleted_at IS NULL")->fetchColumn();
    }
    
    /**
     * Vérifie si un code géo existe déjà (utile avant création/import).
     * @param string $code_geo Le code à vérifier.
     * @return bool True si le code existe, False sinon.
     */
    public function codeGeoExists(string $code_geo): bool {
        $stmt = $this->db->prepare("SELECT 1 FROM geo_codes WHERE code_geo = ? AND deleted_at IS NULL LIMIT 1");
        $stmt->execute([$code_geo]);
        return $stmt->fetchColumn() !== false;
    }

    /**
     * Récupère un code géo par son code unique (pas par ID).
     * Utilisé principalement pour l'import/batch.
     * @param string $code_geo Le code géo.
     * @return array|false Les données ou false si non trouvé/supprimé.
     */
    public function getGeoCodeByCode(string $code_geo) {
        $stmt = $this->db->prepare("SELECT * FROM geo_codes WHERE code_geo = ? AND deleted_at IS NULL");
        $stmt->execute([$code_geo]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Crée plusieurs codes géo en une seule transaction (batch).
     * @param array $codesData Tableau de données pour les codes à créer. Chaque élément ['code_geo', 'libelle', 'univers_id', 'commentaire'].
     * @return array ['success' => int, 'errors' => array] Nombre de succès et liste des erreurs (duplicata ou autre).
     */
    public function batchCreateGeoCodes(array $codesData): array {
        $successCount = 0;
        $errors = [];
        $this->db->beginTransaction();
        try {
            foreach ($codesData as $index => $data) {
                if (empty($data['code_geo']) || empty($data['libelle']) || empty($data['univers_id'])) {
                    $errors[] = "Ligne " . ($index + 1) . ": Données incomplètes (code_geo, libelle, univers_id requis).";
                    continue;
                }
                $result = $this->createGeoCode($data['code_geo'], $data['libelle'], (int)$data['univers_id'], $data['commentaire'] ?? null);
                if ($result !== false) {
                    $successCount++;
                } else {
                    $errors[] = "Ligne " . ($index + 1) . ": Code Géo '{$data['code_geo']}' existe déjà ou erreur lors de la création.";
                }
            }
            $this->db->commit();
        } catch (Exception $e) {
            $this->db->rollBack();
            $errors[] = "Erreur transactionnelle: " . $e->getMessage();
            error_log("Erreur batchCreateGeoCodes: " . $e->getMessage());
        }
        return ['success' => $successCount, 'errors' => $errors];
    }
    
    /**
     * Récupère tous les codes géo pour l'exportation, y compris les informations de l'univers.
     * @return array Liste des codes géo formatés pour l'export.
     */
    public function getCodesForExport(): array {
        $sql = "
            SELECT gc.code_geo, gc.libelle, u.nom AS univers_nom, gc.zone, gc.commentaire, gc.created_at, gc.updated_at
            FROM geo_codes gc
            JOIN univers u ON gc.univers_id = u.id
            WHERE gc.deleted_at IS NULL
            ORDER BY gc.code_geo ASC
        ";
        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    }

}
