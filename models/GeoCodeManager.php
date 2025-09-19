<?php
// Fichier : models/GeoCodeManager.php

class GeoCodeManager {
    
    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    // --- Méthodes pour les Codes Géo ---

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
    
    public function createMultipleGeoCodes(array $codes) {
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
                $univers_id = $this->getOrCreateUniversId($code['univers'], $zone);
                
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

    public function savePosition(int $geo_code_id, int $plan_id, int $pos_x, int $pos_y) {
        $sql = "INSERT INTO geo_positions (geo_code_id, plan_id, pos_x, pos_y) 
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE plan_id = VALUES(plan_id), pos_x = VALUES(pos_x), pos_y = VALUES(pos_y)";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$geo_code_id, $plan_id, $pos_x, $pos_y]);
    }

    // --- GESTION DES UNIVERS ---
    public function getUniversById(int $id) {
        $stmt = $this->db->prepare("SELECT * FROM univers WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getAllUnivers() {
        return $this->db->query("SELECT id, nom, zone_assignee FROM univers ORDER BY nom")->fetchAll(PDO::FETCH_ASSOC);
    }
    
    private function getOrCreateUniversId(string $nom, string $zone): int {
        if (empty(trim($nom))) {
            $nom = "Indéfini";
        }
        
        $stmt = $this->db->prepare("SELECT id FROM univers WHERE nom = ?");
        $stmt->execute([$nom]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result) {
            return (int)$result['id'];
        } else {
            $this->addUnivers($nom, $zone);
            return (int)$this->db->lastInsertId();
        }
    }

    public function addUnivers(string $nom, string $zone) {
        $sql = "INSERT INTO univers (nom, zone_assignee) VALUES (?, ?)";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$nom, $zone]);
    }

    public function deleteUnivers(int $id) {
        $checkSql = "SELECT COUNT(*) FROM geo_codes WHERE univers_id = ?";
        $checkStmt = $this->db->prepare($checkSql);
        $checkStmt->execute([$id]);
        if ($checkStmt->fetchColumn() > 0) {
            return false;
        }
        $sql = "DELETE FROM univers WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }
    
    public function updateUniversZone(int $id, string $zone): bool {
        if (!in_array($zone, ['vente', 'reserve'])) {
            return false;
        }
        $sql = "UPDATE univers SET zone_assignee = ? WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$zone, $id]);
    }

    // --- NOUVELLES MÉTHODES POUR LA GESTION DES PLANS ---
    
    public function getAllPlans() {
        return $this->db->query("SELECT * FROM plans ORDER BY nom")->fetchAll(PDO::FETCH_ASSOC);
    }

    public function addPlan(string $nom, string $nom_fichier): bool {
        $sql = "INSERT INTO plans (nom, nom_fichier) VALUES (?, ?)";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$nom, $nom_fichier]);
    }

    public function getPlanById(int $id) {
        $stmt = $this->db->prepare("SELECT * FROM plans WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function deletePlan(int $id): bool {
        $sql = "DELETE FROM plans WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }
}
