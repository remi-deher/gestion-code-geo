<?php
// Fichier : models/GeoCodeManager.php

class GeoCodeManager {
    
    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Enregistre une action dans l'historique des codes géo.
     */
    private function logHistory(int $geo_code_id, string $action, ?string $details = null) {
        $sql = "INSERT INTO geo_codes_history (geo_code_id, action_type, details) VALUES (?, ?, ?)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$geo_code_id, $action, $details]);
    }

    /**
     * Récupère l'historique pour un code géo spécifique.
     */
    public function getHistoryForGeoCode(int $id) {
        $stmt = $this->db->prepare("SELECT * FROM geo_codes_history WHERE geo_code_id = ? ORDER BY action_timestamp DESC");
        $stmt->execute([$id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getFullHistory(int $limit = 50): array {
        $sql = "
            SELECT 
                h.action_type,
                h.details,
                h.action_timestamp,
                gc.code_geo,
                gc.id as geo_code_id
            FROM 
                geo_codes_history h
            JOIN 
                geo_codes gc ON h.geo_code_id = gc.id
            ORDER BY 
                h.action_timestamp DESC
            LIMIT ?
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getGeoCodeById(int $id) {
        $sql = "SELECT * FROM geo_codes WHERE id = ? AND deleted_at IS NULL";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getAllGeoCodesWithPositions() {
        $sql = "
            SELECT 
                gc.id, gc.code_geo, gc.libelle, u.nom as univers, gc.zone, gc.commentaire,
                gp.id as position_id, gp.plan_id, gp.pos_x, gp.pos_y, gp.width, gp.height, gp.anchor_x, gp.anchor_y
            FROM 
                geo_codes gc
            LEFT JOIN 
                geo_positions gp ON gc.id = gp.geo_code_id
            LEFT JOIN 
                univers u ON gc.univers_id = u.id
            WHERE 
                gc.deleted_at IS NULL
            ORDER BY 
                u.nom, gc.code_geo
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Crée un nouveau code géo et retourne son ID.
     * @return int|false L'ID du nouvel enregistrement ou false si échec.
     */
    public function createGeoCode(string $code_geo, string $libelle, int $univers_id, string $zone, ?string $commentaire) {
        $sql = "INSERT INTO geo_codes (code_geo, libelle, univers_id, zone, commentaire) VALUES (?, ?, ?, ?, ?)";
        $stmt = $this->db->prepare($sql);
        if ($stmt->execute([$code_geo, $libelle, $univers_id, $zone, $commentaire])) {
            $lastId = (int)$this->db->lastInsertId();
            $this->logHistory($lastId, 'created');
            return $lastId;
        }
        return false;
    }

    public function updateGeoCode(int $id, string $code_geo, string $libelle, int $univers_id, string $zone, ?string $commentaire) {
        $oldData = $this->getGeoCodeById($id);
        $sql = "UPDATE geo_codes SET code_geo = ?, libelle = ?, univers_id = ?, zone = ?, commentaire = ? WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $success = $stmt->execute([$code_geo, $libelle, $univers_id, $zone, $commentaire, $id]);
        
        if ($success) {
            $details = [];
            if ($oldData['code_geo'] !== $code_geo) $details[] = "code_geo: '{$oldData['code_geo']}' -> '$code_geo'";
            if ($oldData['libelle'] !== $libelle) $details[] = "libelle: '{$oldData['libelle']}' -> '$libelle'";
            if ($oldData['univers_id'] != $univers_id) $details[] = "univers_id: '{$oldData['univers_id']}' -> '$univers_id'";
            if ($oldData['zone'] !== $zone) $details[] = "zone: '{$oldData['zone']}' -> '$zone'";
            if ($oldData['commentaire'] !== $commentaire) $details[] = "commentaire: '{$oldData['commentaire']}' -> '$commentaire'";

            if (!empty($details)) {
                $this->logHistory($id, 'updated', implode(' | ', $details));
            }
        }
        return $success;
    }

    public function deleteGeoCode(int $id): bool {
        $sql = "UPDATE geo_codes SET deleted_at = NOW() WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $success = $stmt->execute([$id]);
        if ($success) {
            $this->logHistory($id, 'deleted');
        }
        return $success;
    }

    public function getDeletedGeoCodes() {
        $sql = "SELECT gc.*, u.nom as univers FROM geo_codes gc LEFT JOIN univers u ON gc.univers_id = u.id WHERE gc.deleted_at IS NOT NULL ORDER BY gc.deleted_at DESC";
        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    }

    public function restoreGeoCode(int $id): bool {
        $sql = "UPDATE geo_codes SET deleted_at = NULL WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $success = $stmt->execute([$id]);
        if ($success) {
            $this->logHistory($id, 'restored');
        }
        return $success;
    }

    public function forceDeleteGeoCode(int $id): bool {
        $sql = "DELETE FROM geo_codes WHERE id = ? AND deleted_at IS NOT NULL";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }
    
    public function countTotalCodes(): int {
        return (int)$this->db->query("SELECT COUNT(*) FROM geo_codes WHERE deleted_at IS NULL")->fetchColumn();
    }

    public function countPlacedCodes(): int {
        return (int)$this->db->query("SELECT COUNT(DISTINCT geo_code_id) FROM geo_positions gp JOIN geo_codes gc ON gp.geo_code_id = gc.id WHERE gc.deleted_at IS NULL")->fetchColumn();
    }
    
    public function getLatestCodes(int $limit = 5): array {
        $sql = "
            SELECT gc.code_geo, gc.libelle, u.nom as univers
            FROM geo_codes gc
            JOIN univers u ON gc.univers_id = u.id
            WHERE gc.deleted_at IS NULL
            ORDER BY gc.id DESC
            LIMIT :limit
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getUnplacedCodes(int $limit = 10): array {
        $sql = "
            SELECT gc.id, gc.code_geo, gc.libelle
            FROM geo_codes gc
            LEFT JOIN geo_positions gp ON gc.id = gp.geo_code_id
            WHERE gp.geo_code_id IS NULL
            ORDER BY gc.id ASC
            LIMIT :limit
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getCodesCountByUnivers(): array {
        $sql = "
            SELECT u.nom, COUNT(gc.id) as count
            FROM univers u
            JOIN geo_codes gc ON u.id = gc.univers_id
            GROUP BY u.nom
            ORDER BY count DESC
        ";
        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    }

    public function countCodesByZone(): array {
        $sql = "
            SELECT zone, COUNT(id) as count
            FROM geo_codes
            GROUP BY zone
        ";
        return $this->db->query($sql)->fetchAll(PDO::FETCH_KEY_PAIR);
    }

    public function getAvailableCodesForPlan(int $planId): array
    {
        $sql = "
            SELECT 
                gc.id, 
                gc.code_geo, 
                gc.libelle, 
                u.nom AS univers,
                COUNT(gp.id) as placement_count 
            FROM 
                geo_codes gc
            JOIN 
                univers u ON gc.univers_id = u.id
            JOIN 
                plan_univers pu ON u.id = pu.univers_id
            LEFT JOIN 
                geo_positions gp ON gc.id = gp.geo_code_id AND gp.plan_id = ?
            WHERE 
                gc.deleted_at IS NULL
                AND pu.plan_id = ?
            GROUP BY 
                gc.id, gc.code_geo, gc.libelle, u.nom
            ORDER BY 
                gc.code_geo
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$planId, $planId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getGeoCodesByUniversIds(array $universIds): array
    {
        if (empty($universIds)) {
            return [];
        }
        $in = str_repeat('?,', count($universIds) - 1) . '?';
        $sql = "
            SELECT gc.*, u.nom as univers
            FROM geo_codes gc
            LEFT JOIN univers u ON gc.univers_id = u.id
            WHERE gc.univers_id IN ($in) AND gc.deleted_at IS NULL
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($universIds);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
