<?php
// Fichier: models/PlanManager.php

class PlanManager {

    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * MODIFIÉ : Récupère tous les plans avec leur zone et les noms des univers associés.
     */
    public function getAllPlans() {
        $sql = "
            SELECT p.*, GROUP_CONCAT(u.nom SEPARATOR ', ') as univers_names
            FROM plans p
            LEFT JOIN plan_univers pu ON p.id = pu.plan_id
            LEFT JOIN univers u ON pu.univers_id = u.id
            GROUP BY p.id
            ORDER BY p.nom
        ";
        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
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
    
    /**
     * NOUVEAU : Récupère un plan et les IDs de ses univers associés.
     */
    public function getPlanWithUnivers(int $id): array {
        $plan = $this->getPlanById($id);
        if (!$plan) {
            return [];
        }
        
        $stmt = $this->db->prepare("SELECT univers_id FROM plan_univers WHERE plan_id = ?");
        $stmt->execute([$id]);
        // fetchAll(PDO::FETCH_COLUMN) retourne un tableau simple [id1, id2, ...]
        $plan['univers_ids'] = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        return $plan;
    }

    public function deletePlan(int $id): bool {
        $sql = "DELETE FROM plans WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }
    
    /**
     * NOUVEAU : Met à jour le nom, la zone et les univers associés à un plan.
     */
    public function updatePlanAssociations(int $planId, string $nom, ?string $zone, array $universIds): bool {
        $this->db->beginTransaction();
        try {
            // 1. Mettre à jour le nom et la zone du plan
            $stmt = $this->db->prepare("UPDATE plans SET nom = ?, zone = ? WHERE id = ?");
            $stmt->execute([$nom, $zone, $planId]);
            
            // 2. Supprimer les anciennes associations d'univers
            $stmt = $this->db->prepare("DELETE FROM plan_univers WHERE plan_id = ?");
            $stmt->execute([$planId]);
            
            // 3. Insérer les nouvelles associations
            if (!empty($universIds)) {
                $sql = "INSERT INTO plan_univers (plan_id, univers_id) VALUES (?, ?)";
                $stmt = $this->db->prepare($sql);
                foreach ($universIds as $universId) {
                    $stmt->execute([$planId, (int)$universId]);
                }
            }
            
            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Erreur lors de la mise à jour des associations du plan : " . $e->getMessage());
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

    public function removePosition(int $geo_code_id): bool {
        $sql = "DELETE FROM geo_positions WHERE geo_code_id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$geo_code_id]);
    }

    public function saveMultiplePositions(array $positions, int $plan_id): bool {
        if (empty($positions)) return true;
        $this->db->beginTransaction();
        try {
            $sql = "INSERT INTO geo_positions (geo_code_id, plan_id, pos_x, pos_y) 
                    VALUES (:geo_code_id, :plan_id, :pos_x, :pos_y)
                    ON DUPLICATE KEY UPDATE pos_x = VALUES(pos_x), pos_y = VALUES(pos_y)";
            $stmt = $this->db->prepare($sql);
            foreach ($positions as $pos) {
                $stmt->execute([
                    ':geo_code_id' => $pos['id'],
                    ':plan_id'     => $plan_id,
                    ':pos_x'       => round($pos['x']),
                    ':pos_y'       => round($pos['y'])
                ]);
            }
            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Erreur lors de la sauvegarde multiple : " . $e->getMessage());
            return false;
        }
    }

    public function countTotalPlans(): int {
        return (int)$this->db->query("SELECT COUNT(*) FROM plans")->fetchColumn();
    }
}
