<?php
// Fichier: models/PlanManager.php

class PlanManager {
    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Récupère tous les plans actifs avec les noms des univers associés.
     * @return array La liste des plans.
     */
    public function getAllPlansWithUnivers(): array {
        $sql = "SELECT p.*, GROUP_CONCAT(u.nom SEPARATOR ', ') AS univers_names
                FROM plans p
                LEFT JOIN plan_univers pu ON p.id = pu.plan_id
                LEFT JOIN univers u ON pu.univers_id = u.id
                WHERE p.deleted_at IS NULL
                GROUP BY p.id
                ORDER BY p.nom ASC";
        try {
            $stmt = $this->db->query($sql);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Erreur getAllPlansWithUnivers: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Récupère un plan par son ID.
     * @param int $id ID du plan.
     * @return array|false Les informations du plan ou false si non trouvé.
     */
    public function getPlanById(int $id) {
        $sql = "SELECT * FROM plans WHERE id = :id AND deleted_at IS NULL";
        $stmt = $this->db->prepare($sql);
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Récupère les IDs des univers associés à un plan.
     * @param int $planId ID du plan.
     * @return array Liste des IDs d'univers.
     */
    public function getUniversIdsForPlan(int $planId): array {
        $sql = "SELECT univers_id FROM plan_univers WHERE plan_id = :plan_id";
        $stmt = $this->db->prepare($sql);
        $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    /**
     * Ajoute un nouveau plan.
     * @param string $nom Nom du plan.
     * @param string $nomFichier Nom du fichier image/svg/pdf.
     * @param string $type Type de plan ('image', 'svg', 'pdf').
     * @param string|null $description Description optionnelle.
     * @param string|null $zone Zone ('vente' ou 'reserve').
     * @param array $universIds IDs des univers associés.
     * @param string|null $drawingData Données JSON du dessin Fabric.js (pour les plans dessinés).
     * @param string|null $pageFormat Format de page (pour les plans dessinés).
     * @return int|false L'ID du plan créé ou false en cas d'erreur.
     */
    public function addPlan(string $nom, string $nomFichier, string $type, ?string $description, ?string $zone, array $universIds, ?string $drawingData = null, ?string $pageFormat = null) {
        $this->db->beginTransaction();
        try {
            $sql = "INSERT INTO plans (nom, nom_fichier, type, description, zone, drawing_data, page_format, created_at, updated_at)
                    VALUES (:nom, :nom_fichier, :type, :description, :zone, :drawing_data, :page_format, NOW(), NOW())";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':nom', $nom);
            $stmt->bindParam(':nom_fichier', $nomFichier);
            $stmt->bindParam(':type', $type);
            $stmt->bindValue(':description', $description, $description === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindValue(':zone', $zone, $zone === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindValue(':drawing_data', $drawingData, $drawingData === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindValue(':page_format', $pageFormat, $pageFormat === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

            if (!$stmt->execute()) {
                throw new Exception("Erreur lors de l'insertion du plan.");
            }
            $planId = (int)$this->db->lastInsertId();

            // Associer les univers
            $this->updatePlanUniversAssociations($planId, $universIds);

            $this->db->commit();
            return $planId;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Erreur addPlan: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Met à jour les informations d'un plan et ses associations d'univers.
     * @param int $id ID du plan.
     * @param string $nom Nom du plan.
     * @param string|null $description Description optionnelle.
     * @param string|null $zone Zone ('vente' ou 'reserve').
     * @param array $universIds IDs des univers associés.
     * @param string|null $drawingData Données JSON du dessin Fabric.js.
     * @param string|null $pageFormat Format de page.
     * @return bool True si succès, false sinon.
     */
    public function updatePlan(int $id, string $nom, ?string $description, ?string $zone, array $universIds, ?string $drawingData = null, ?string $pageFormat = null): bool {
        $this->db->beginTransaction();
        try {
            $sql = "UPDATE plans SET nom = :nom, description = :description, zone = :zone, drawing_data = :drawing_data, page_format = :page_format, updated_at = NOW()
                    WHERE id = :id AND deleted_at IS NULL";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':nom', $nom);
            $stmt->bindValue(':description', $description, $description === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindValue(':zone', $zone, $zone === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindValue(':drawing_data', $drawingData, $drawingData === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindValue(':page_format', $pageFormat, $pageFormat === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

            if (!$stmt->execute()) {
                throw new Exception("Erreur lors de la mise à jour du plan.");
            }

            // Mettre à jour les associations d'univers
            $this->updatePlanUniversAssociations($id, $universIds);

            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Erreur updatePlan (ID: $id): " . $e->getMessage());
            return false;
        }
    }

     /**
     * Met à jour uniquement les données de dessin d'un plan (Fabric.js JSON).
     * @param int $id ID du plan.
     * @param string $drawingData Données JSON du dessin Fabric.js.
     * @return bool True si succès, false sinon.
     */
    public function updatePlanDrawingData(int $id, string $drawingData): bool {
        try {
            $sql = "UPDATE plans SET drawing_data = :drawing_data, updated_at = NOW()
                    WHERE id = :id AND deleted_at IS NULL";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':drawing_data', $drawingData, PDO::PARAM_STR); // Assurez-vous que c'est bien une chaîne JSON
            return $stmt->execute();
        } catch (PDOException $e) {
            error_log("Erreur updatePlanDrawingData (ID: $id): " . $e->getMessage());
            return false;
        }
    }


    /**
     * Supprime (soft delete) un plan.
     * @param int $id ID du plan.
     * @return bool True si succès.
     */
    public function deletePlan(int $id): bool {
        try {
            $sql = "UPDATE plans SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            error_log("Erreur deletePlan (ID: $id): " . $e->getMessage());
            return false;
        }
    }

/**
     * Récupère les plans qui sont dans la corbeille (soft-deleted).
     * @return array La liste des plans supprimés.
     */
    public function getDeletedPlans(): array {
        $sql = "SELECT * FROM plans WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC";
        try {
            $stmt = $this->db->query($sql);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Erreur getDeletedPlans: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Restaure un plan supprimé.
     * @param int $id ID du plan.
     * @return bool True si succès.
     */
    public function restorePlan(int $id): bool {
        try {
            $sql = "UPDATE plans SET deleted_at = NULL WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            error_log("Erreur restorePlan (ID: $id): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Supprime définitivement un plan et son fichier associé.
     * @param int $id ID du plan.
     * @return bool True si succès.
     */
    public function forceDeletePlan(int $id): bool {
        // 1. Récupérer le nom du fichier avant suppression
        $sqlInfo = "SELECT nom_fichier FROM plans WHERE id = :id";
        $stmtInfo = $this->db->prepare($sqlInfo);
        $stmtInfo->bindParam(':id', $id, PDO::PARAM_INT);
        $stmtInfo->execute();
        $filename = $stmtInfo->fetchColumn();

        $this->db->beginTransaction();
        try {
            // 2. Supprimer de la BDD
            $sql = "DELETE FROM plans WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            // La suppression en cascade des geo_positions et plan_univers est gérée par MySQL (ON DELETE CASCADE)
            
            $this->db->commit();

            // 3. Supprimer le fichier physique s'il existe
            if ($filename) {
                $filePath = __DIR__ . '/../public/uploads/plans/' . $filename;
                if (file_exists($filePath)) {
                    unlink($filePath);
                }
            }
            return true;
        } catch (Exception $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            error_log("Erreur forceDeletePlan (ID: $id): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Met à jour les associations entre un plan et ses univers.
     * @param int $planId ID du plan.
     * @param array $newUniversIds Liste des nouveaux IDs d'univers à associer.
     * @throws Exception En cas d'erreur lors de la mise à jour des associations.
     */
    private function updatePlanUniversAssociations(int $planId, array $newUniversIds) {
        // 1. Supprimer les anciennes associations
        $deleteSql = "DELETE FROM plan_univers WHERE plan_id = :plan_id";
        $deleteStmt = $this->db->prepare($deleteSql);
        $deleteStmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
        if (!$deleteStmt->execute()) {
            throw new Exception("Erreur lors de la suppression des anciennes associations d'univers.");
        }

        // 2. Insérer les nouvelles associations (si $newUniversIds n'est pas vide)
        if (!empty($newUniversIds)) {
            $insertSql = "INSERT INTO plan_univers (plan_id, univers_id) VALUES (:plan_id, :univers_id)";
            $insertStmt = $this->db->prepare($insertSql);
            $insertStmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);

            foreach ($newUniversIds as $universId) {
                $uid = (int)$universId;
                if ($uid > 0) { // Vérification simple
                    $insertStmt->bindParam(':univers_id', $uid, PDO::PARAM_INT);
                    if (!$insertStmt->execute()) {
                         // Log l'erreur mais ne lance pas forcément d'exception pour permettre les autres insertions
                         error_log("Erreur lors de l'insertion de l'association plan $planId <-> univers $uid");
                         // throw new Exception("Erreur lors de l'insertion d'une association d'univers.");
                    }
                }
            }
        }
    }
}
