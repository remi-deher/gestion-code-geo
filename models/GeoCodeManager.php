<?php
// Fichier : models/GeoCodeManager.php

class GeoCodeManager {
    
    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function getGeoCodeById(int $id) {
        $sql = "SELECT * FROM geo_codes WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getAllGeoCodesWithPositions() {
        $sql = "
            SELECT 
                gc.id, gc.code_geo, gc.libelle, u.nom as univers, gc.zone, gc.commentaire,
                gp.pos_x, gp.pos_y, gp.plan_id
            FROM 
                geo_codes gc
            LEFT JOIN 
                geo_positions gp ON gc.id = gp.geo_code_id
            LEFT JOIN 
                univers u ON gc.univers_id = u.id
            ORDER BY 
                u.nom, gc.code_geo
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function getGeoCodesByUniversIds(array $ids): array {
        if (empty($ids)) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $sql = "
            SELECT gc.id, gc.code_geo, gc.libelle, u.nom as univers, gc.commentaire
            FROM geo_codes gc
            JOIN univers u ON gc.univers_id = u.id
            WHERE gc.univers_id IN ($placeholders)
            ORDER BY u.nom, gc.code_geo
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($ids);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getAvailableCodesForPlan(int $planId): array {
        error_log("--- GeoCodeManager : Début de getAvailableCodesForPlan pour planId = $planId ---");
        
        $sql = "
            SELECT gc.id, gc.code_geo, gc.libelle, u.nom as univers, gc.zone
            FROM geo_codes gc
            JOIN univers u ON gc.univers_id = u.id
            JOIN plans p ON gc.zone = p.zone
            JOIN plan_univers pu ON p.id = pu.plan_id AND u.id = pu.univers_id
            LEFT JOIN geo_positions gp ON gc.id = gp.geo_code_id
            WHERE p.id = :plan_id AND gp.geo_code_id IS NULL
            ORDER BY gc.code_geo
        ";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':plan_id' => $planId]);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

        error_log("--- GeoCodeManager : Requête exécutée. Nombre de codes trouvés : " . count($result) . " ---");
        if (count($result) > 0) {
            error_log("--- GeoCodeManager : Premier code trouvé : " . print_r($result[0], true));
        }
        
        return $result;
    }

    public function createGeoCode(string $code_geo, string $libelle, int $univers_id, string $zone, ?string $commentaire) {
        $sql = "INSERT INTO geo_codes (code_geo, libelle, univers_id, zone, commentaire) VALUES (?, ?, ?, ?, ?)";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$code_geo, $libelle, $univers_id, $zone, $commentaire]);
    }

    public function updateGeoCode(int $id, string $code_geo, string $libelle, int $univers_id, string $zone, ?string $commentaire) {
        $sql = "UPDATE geo_codes SET code_geo = ?, libelle = ?, univers_id = ?, zone = ?, commentaire = ? WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$code_geo, $libelle, $univers_id, $zone, $commentaire, $id]);
    }
    
    public function deleteGeoCode(int $id): bool {
        $sql = "DELETE FROM geo_codes WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }
    
    public function createMultipleGeoCodes(array $codes, UniversManager $universManager) {
        $this->db->beginTransaction();
        try {
            $sql = "INSERT INTO geo_codes (code_geo, libelle, univers_id, zone, commentaire) 
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                    libelle = VALUES(libelle), 
                    univers_id = VALUES(univers_id), 
                    zone = VALUES(zone), 
                    commentaire = VALUES(commentaire)";
            $stmt = $this->db->prepare($sql);

            foreach ($codes as $code) {
                $zone = in_array(strtolower($code['zone']), ['vente', 'reserve']) ? strtolower($code['zone']) : 'vente';
                $univers_id = $universManager->getOrCreateUniversId($code['univers'], $zone);
                
                $stmt->execute([ $code['code_geo'], $code['libelle'], $univers_id, $zone, $code['commentaire'] ]);
            }
            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Erreur lors de l'importation multiple : " . $e->getMessage());
            return false;
        }
    }

    public function createBatchGeoCodes(array $codes): bool {
        $this->db->beginTransaction();
        try {
            $sql = "INSERT INTO geo_codes (code_geo, libelle, univers_id, zone, commentaire) VALUES (?, ?, ?, ?, ?)";
            $stmt = $this->db->prepare($sql);
            foreach ($codes as $code) {
                $stmt->execute([ $code['code_geo'], $code['libelle'], $code['univers_id'], $code['zone'], $code['commentaire'] ]);
            }
            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log($e->getMessage());
            return false;
        }
    }

    public function countTotalCodes(): int {
        return (int)$this->db->query("SELECT COUNT(*) FROM geo_codes")->fetchColumn();
    }

    public function countPlacedCodes(): int {
        return (int)$this->db->query("SELECT COUNT(DISTINCT geo_code_id) FROM geo_positions")->fetchColumn();
    }

    public function getLatestCodes(int $limit = 5): array {
        $sql = "
            SELECT gc.code_geo, gc.libelle, u.nom as univers
            FROM geo_codes gc
            JOIN univers u ON gc.univers_id = u.id
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
}
