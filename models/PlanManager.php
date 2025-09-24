<?php
// Fichier: models/PlanManager.php

class PlanManager {

    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

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
    
    public function getPlanWithUnivers(int $id): array {
        $plan = $this->getPlanById($id);
        if (!$plan) {
            return [];
        }
        
        $stmt = $this->db->prepare("SELECT univers_id FROM plan_univers WHERE plan_id = ?");
        $stmt->execute([$id]);
        $plan['univers_ids'] = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        return $plan;
    }

    public function deletePlan(int $id): bool {
        $sql = "DELETE FROM plans WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }
    
    public function updatePlanAssociations(int $planId, string $nom, ?string $zone, array $universIds): bool {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("UPDATE plans SET nom = ?, zone = ? WHERE id = ?");
            $stmt->execute([$nom, $zone, $planId]);
            
            $stmt = $this->db->prepare("DELETE FROM plan_univers WHERE plan_id = ?");
            $stmt->execute([$planId]);
            
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

    private function _logHistory(int $geo_code_id, int $plan_id, ?int $pos_x, ?int $pos_y, string $action_type) {
        $sql = "INSERT INTO geo_positions_history (geo_code_id, plan_id, pos_x, pos_y, action_type) VALUES (?, ?, ?, ?, ?)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$geo_code_id, $plan_id, $pos_x, $pos_y, $action_type]);
    }
    
    public function getPositionByCodeId(int $geo_code_id) {
        $stmt = $this->db->prepare("SELECT * FROM geo_positions WHERE geo_code_id = ?");
        $stmt->execute([$geo_code_id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function savePosition(int $geo_code_id, int $plan_id, int $pos_x, int $pos_y, ?int $width = null, ?int $height = null, ?int $anchor_x = null, ?int $anchor_y = null) {
        $existingPosition = $this->getPositionByCodeId($geo_code_id);
        $action = $existingPosition ? 'moved' : 'placed';

        $sql = "INSERT INTO geo_positions (geo_code_id, plan_id, pos_x, pos_y, width, height, anchor_x, anchor_y) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    plan_id = VALUES(plan_id), 
                    pos_x = VALUES(pos_x), 
                    pos_y = VALUES(pos_y),
                    width = VALUES(width),
                    height = VALUES(height),
                    anchor_x = VALUES(anchor_x),
                    anchor_y = VALUES(anchor_y)";
        $stmt = $this->db->prepare($sql);
        $success = $stmt->execute([$geo_code_id, $plan_id, $pos_x, $pos_y, $width, $height, $anchor_x, $anchor_y]);

        if ($success) {
            $this->_logHistory($geo_code_id, $plan_id, $pos_x, $pos_y, $action);
        }
        return $success;
    }

    public function removePosition(int $geo_code_id): bool {
        $existingPosition = $this->getPositionByCodeId($geo_code_id);
        if ($existingPosition) {
            $sql = "DELETE FROM geo_positions WHERE geo_code_id = ?";
            $stmt = $this->db->prepare($sql);
            $success = $stmt->execute([$geo_code_id]);
            if ($success) {
                $this->_logHistory($geo_code_id, $existingPosition['plan_id'], null, null, 'removed');
            }
            return $success;
        }
        return false;
    }

    public function saveMultiplePositions(array $positions, int $plan_id): bool {
        if (empty($positions)) return true;
        $this->db->beginTransaction();
        try {
            $sql = "INSERT INTO geo_positions (geo_code_id, plan_id, pos_x, pos_y, width, height, anchor_x, anchor_y) 
                    VALUES (:geo_code_id, :plan_id, :pos_x, :pos_y, :width, :height, :anchor_x, :anchor_y)
                    ON DUPLICATE KEY UPDATE 
                        plan_id = VALUES(plan_id), 
                        pos_x = VALUES(pos_x), 
                        pos_y = VALUES(pos_y),
                        width = VALUES(width),
                        height = VALUES(height),
                        anchor_x = VALUES(anchor_x),
                        anchor_y = VALUES(anchor_y)";
            $stmt = $this->db->prepare($sql);
            foreach ($positions as $pos) {
                $existingPosition = $this->getPositionByCodeId($pos['id']);
                $action = $existingPosition ? 'moved' : 'placed';
                
                $stmt->execute([
                    ':geo_code_id' => $pos['id'],
                    ':plan_id'     => $plan_id,
                    ':pos_x'       => round($pos['x']),
                    ':pos_y'       => round($pos['y']),
                    ':width'       => $pos['width'] ?? null,
                    ':height'      => $pos['height'] ?? null,
                    ':anchor_x'    => $pos['anchor_x'] ?? null,
                    ':anchor_y'    => $pos['anchor_y'] ?? null
                ]);
                $this->_logHistory($pos['id'], $plan_id, round($pos['x']), round($pos['y']), $action);
            }
            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Erreur lors de la sauvegarde multiple : " . $e->getMessage());
            return false;
        }
    }

    public function getHistoryForPlan(int $planId, int $limit = 10) {
        $sql = "
            SELECT h.*, gc.code_geo
            FROM geo_positions_history h
            JOIN geo_codes gc ON h.geo_code_id = gc.id
            WHERE h.plan_id = ?
            ORDER BY h.action_timestamp DESC
            LIMIT ?
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->bindValue(1, $planId, PDO::PARAM_INT);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function getHistoryEntry(int $historyId) {
        $stmt = $this->db->prepare("SELECT * FROM geo_positions_history WHERE id = ?");
        $stmt->execute([$historyId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function countTotalPlans(): int {
        return (int)$this->db->query("SELECT COUNT(*) FROM plans")->fetchColumn();
    }
}
