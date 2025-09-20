<?php
// Fichier: models/PlanManager.php

class PlanManager {

    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

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

    public function countTotalPlans(): int {
        return (int)$this->db->query("SELECT COUNT(*) FROM plans")->fetchColumn();
    }

    /**
     * NOUVELLE FONCTION pour sauvegarder plusieurs positions en une seule transaction.
     */
    public function saveMultiplePositions(array $positions, int $plan_id): bool {
        if (empty($positions)) {
            return true;
        }
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
}
