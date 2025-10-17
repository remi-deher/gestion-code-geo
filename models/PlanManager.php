<?php
// Fichier: models/PlanManager.php

class PlanManager {

    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Récupère tous les plans avec les noms des univers associés concaténés.
     * @return array Liste des plans.
     */
    public function getAllPlans() {
        $sql = "
            SELECT p.*, GROUP_CONCAT(DISTINCT u.nom ORDER BY u.nom SEPARATOR ', ') as univers_names
            FROM plans p
            LEFT JOIN plan_univers pu ON p.id = pu.plan_id
            LEFT JOIN univers u ON pu.univers_id = u.id
            GROUP BY p.id
            ORDER BY p.nom
        ";
        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Ajoute un nouveau plan à la base de données.
     * @param string $nom Nom du plan.
     * @param string $nom_fichier Nom du fichier image/svg du plan.
     * @return bool True si succès, False sinon.
     */
    public function addPlan(string $nom, string $nom_fichier): bool {
        $sql = "INSERT INTO plans (nom, nom_fichier) VALUES (?, ?)";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$nom, $nom_fichier]);
    }

    /**
     * Récupère les informations d'un plan par son ID.
     * @param int $id ID du plan.
     * @return array|false Tableau associatif du plan ou false si non trouvé.
     */
    public function getPlanById(int $id) {
        $stmt = $this->db->prepare("SELECT * FROM plans WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    /**
     * Récupère un plan avec la liste des IDs des univers qui lui sont associés.
     * @param int $id ID du plan.
     * @return array Tableau associatif du plan avec une clé 'univers_ids' contenant un tableau d'IDs.
     */
    public function getPlanWithUnivers(int $id): array {
        $plan = $this->getPlanById($id);
        if (!$plan) {
            return [];
        }
        
        $stmt = $this->db->prepare("SELECT univers_id FROM plan_univers WHERE plan_id = ?");
        $stmt->execute([$id]);
        // PDO::FETCH_COLUMN récupère directement les valeurs de la première colonne
        $plan['univers_ids'] = $stmt->fetchAll(PDO::FETCH_COLUMN); 
        
        return $plan;
    }

    /**
     * Supprime un plan de la base de données.
     * @param int $id ID du plan à supprimer.
     * @return bool True si succès, False sinon.
     */
    public function deletePlan(int $id): bool {
        // La suppression en cascade devrait gérer les tables plan_univers et geo_positions
        $sql = "DELETE FROM plans WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }
    
    /**
     * Met à jour les informations d'un plan et ses associations avec les univers.
     * Peut aussi mettre à jour le nom du fichier image associé.
     * @param int $planId ID du plan à mettre à jour.
     * @param string $nom Nouveau nom du plan.
     * @param string|null $zone Nouvelle zone associée (null si aucune).
     * @param array $universIds Tableau des IDs des univers à associer.
     * @param string|null $newFilename Nouveau nom de fichier si le plan a été remplacé.
     * @return bool True si succès, False sinon.
     */
    public function updatePlan(int $planId, string $nom, ?string $zone, array $universIds, ?string $newFilename = null): bool {
        $this->db->beginTransaction();
        try {
            // 1. Mise à jour de la table 'plans'
            $sql = "UPDATE plans SET nom = ?, zone = ?";
            $params = [$nom, $zone];
            
            // Ajoute la mise à jour du nom de fichier seulement si un nouveau nom est fourni
            if ($newFilename !== null) {
                $sql .= ", nom_fichier = ?";
                $params[] = $newFilename;
            }
            
            $sql .= " WHERE id = ?";
            $params[] = $planId;
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            
            // 2. Mise à jour des associations dans 'plan_univers'
            // D'abord, supprimer les anciennes associations
            $stmt = $this->db->prepare("DELETE FROM plan_univers WHERE plan_id = ?");
            $stmt->execute([$planId]);
            
            // Ensuite, insérer les nouvelles associations (si $universIds n'est pas vide)
            if (!empty($universIds)) {
                $sqlInsert = "INSERT INTO plan_univers (plan_id, univers_id) VALUES (?, ?)";
                $stmtInsert = $this->db->prepare($sqlInsert);
                foreach ($universIds as $universId) {
                    // S'assurer que les IDs sont des entiers
                    $stmtInsert->execute([$planId, (int)$universId]); 
                }
            }
            
            // Valider la transaction
            $this->db->commit();
            return true;

        } catch (Exception $e) {
            // Annuler la transaction en cas d'erreur
            $this->db->rollBack();
            error_log("Erreur lors de la mise à jour du plan ID {$planId} : " . $e->getMessage());
            return false;
        }
    }

    /**
     * Enregistre une action dans l'historique des positions.
     * @param int $geo_code_id ID du code géo.
     * @param int $plan_id ID du plan.
     * @param float|null $pos_x Position X (ou null si retrait).
     * @param float|null $pos_y Position Y (ou null si retrait).
     * @param string $action_type Type d'action ('placed', 'moved', 'removed').
     */
    private function _logHistory(int $geo_code_id, int $plan_id, ?float $pos_x, ?float $pos_y, string $action_type) {
        try {
            $sql = "INSERT INTO geo_positions_history (geo_code_id, plan_id, pos_x, pos_y, action_type) VALUES (?, ?, ?, ?, ?)";
            $stmt = $this->db->prepare($sql);
            // Utiliser PDO::PARAM_NULL si les valeurs sont null
            $stmt->bindParam(1, $geo_code_id, PDO::PARAM_INT);
            $stmt->bindParam(2, $plan_id, PDO::PARAM_INT);
            $stmt->bindParam(3, $pos_x, $pos_x === null ? PDO::PARAM_NULL : PDO::PARAM_STR); // PDO traite float comme STR ici
            $stmt->bindParam(4, $pos_y, $pos_y === null ? PDO::PARAM_NULL : PDO::PARAM_STR); // PDO traite float comme STR ici
            $stmt->bindParam(5, $action_type, PDO::PARAM_STR);
            $stmt->execute();
        } catch (PDOException $e) {
             error_log("Erreur lors de l'enregistrement de l'historique de position : " . $e->getMessage());
             // Ne pas bloquer l'opération principale si l'historique échoue
        }
    }
    
    /**
     * Récupère toutes les positions d'un code géo donné.
     * @param int $geo_code_id ID du code géo.
     * @return array Liste des positions.
     */
    public function getPositionsByCodeId(int $geo_code_id) {
        $stmt = $this->db->prepare("SELECT * FROM geo_positions WHERE geo_code_id = ?");
        $stmt->execute([$geo_code_id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Crée ou met à jour une position pour un code géo sur un plan.
     * @param int $geo_code_id ID du code géo.
     * @param int $plan_id ID du plan.
     * @param float $pos_x Position X (en pourcentage).
     * @param float $pos_y Position Y (en pourcentage).
     * @param int|null $width Largeur optionnelle (pixels).
     * @param int|null $height Hauteur optionnelle (pixels).
     * @param float|null $anchor_x Position X de l'ancre de flèche (pourcentage).
     * @param float|null $anchor_y Position Y de l'ancre de flèche (pourcentage).
     * @param int|null $position_id ID de la position si c'est une mise à jour.
     * @return bool True si succès, False sinon.
     */
    public function savePosition(int $geo_code_id, int $plan_id, float $pos_x, float $pos_y, ?int $width = null, ?int $height = null, ?float $anchor_x = null, ?float $anchor_y = null, ?int $position_id = null): bool {
        
        // Validation basique des pourcentages
        $pos_x = max(0, min(100, $pos_x));
        $pos_y = max(0, min(100, $pos_y));
        if ($anchor_x !== null) $anchor_x = max(0, min(100, $anchor_x));
        if ($anchor_y !== null) $anchor_y = max(0, min(100, $anchor_y));

        try {
            if ($position_id) {
                // Mise à jour d'une position existante
                $sql = "UPDATE geo_positions SET pos_x = ?, pos_y = ?, width = ?, height = ?, anchor_x = ?, anchor_y = ? WHERE id = ?";
                $stmt = $this->db->prepare($sql);
                $success = $stmt->execute([$pos_x, $pos_y, $width, $height, $anchor_x, $anchor_y, $position_id]);
                if ($success) {
                    // On logue l'historique uniquement si la mise à jour réussit
                    $this->_logHistory($geo_code_id, $plan_id, $pos_x, $pos_y, 'moved');
                }
                return $success;
            } else {
                // Insertion d'une nouvelle position
                $sql = "INSERT INTO geo_positions (geo_code_id, plan_id, pos_x, pos_y, width, height, anchor_x, anchor_y) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
                $stmt = $this->db->prepare($sql);
                $success = $stmt->execute([$geo_code_id, $plan_id, $pos_x, $pos_y, $width, $height, $anchor_x, $anchor_y]);

                if ($success) {
                     // On logue l'historique uniquement si l'insertion réussit
                    $this->_logHistory($geo_code_id, $plan_id, $pos_x, $pos_y, 'placed');
                }
                return $success;
            }
        } catch (PDOException $e) {
             error_log("Erreur lors de la sauvegarde de la position : " . $e->getMessage());
             return false;
        }
    }

    /**
     * Supprime une position spécifique par son ID.
     * @param int $position_id ID de la position à supprimer.
     * @return bool True si succès, False sinon.
     */
    public function removePosition(int $position_id): bool {
        // Récupérer les infos avant suppression pour l'historique
        $stmt = $this->db->prepare("SELECT geo_code_id, plan_id FROM geo_positions WHERE id = ?");
        $stmt->execute([$position_id]);
        $existingPosition = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existingPosition) {
            try {
                $sql = "DELETE FROM geo_positions WHERE id = ?";
                $stmt = $this->db->prepare($sql);
                $success = $stmt->execute([$position_id]);
                if ($success) {
                    // Log après la suppression réussie
                    $this->_logHistory($existingPosition['geo_code_id'], $existingPosition['plan_id'], null, null, 'removed');
                }
                return $success;
            } catch (PDOException $e) {
                 error_log("Erreur lors de la suppression de la position ID {$position_id} : " . $e->getMessage());
                 return false;
            }
        }
        return false; // La position n'existait pas
    }
    
    /**
     * Supprime toutes les positions d'un code géo donné sur un plan spécifique.
     * @param int $geo_code_id ID du code géo.
     * @param int $plan_id ID du plan.
     * @return bool True si au moins une ligne a été supprimée ou s'il n'y avait rien à supprimer, False en cas d'erreur.
     */
    public function removeMultiplePositionsByCodeId(int $geo_code_id, int $plan_id): bool {
         try {
            $sql = "DELETE FROM geo_positions WHERE geo_code_id = ? AND plan_id = ?";
            $stmt = $this->db->prepare($sql);
            $success = $stmt->execute([$geo_code_id, $plan_id]);
            // On logue même si rien n'a été supprimé (l'intention était de tout enlever)
            $this->_logHistory($geo_code_id, $plan_id, null, null, 'removed'); 
            return $success; // execute retourne true même si 0 lignes affectées
        } catch (PDOException $e) {
             error_log("Erreur lors de la suppression multiple pour code {$geo_code_id} sur plan {$plan_id} : " . $e->getMessage());
             return false;
        }
    }

    /**
     * Sauvegarde plusieurs positions en une seule transaction.
     * @param array $positions Tableau de positions, chaque élément doit contenir au moins ['id', 'x', 'y'].
     * @param int $plan_id ID du plan concerné.
     * @return bool True si succès, False sinon.
     */
    public function saveMultiplePositions(array $positions, int $plan_id): bool {
        if (empty($positions)) return true; // Rien à faire
        
        $this->db->beginTransaction();
        try {
            // Préparer une seule fois la requête
            $sql = "INSERT INTO geo_positions (geo_code_id, plan_id, pos_x, pos_y, width, height, anchor_x, anchor_y) 
                    VALUES (:geo_code_id, :plan_id, :pos_x, :pos_y, :width, :height, :anchor_x, :anchor_y)";
            $stmt = $this->db->prepare($sql);
            
            foreach ($positions as $pos) {
                // Validation minimale
                if (!isset($pos['id'], $pos['x'], $pos['y'])) continue; 

                // Assurer que les pourcentages sont valides
                $pos_x = max(0, min(100, (float)$pos['x']));
                $pos_y = max(0, min(100, (float)$pos['y']));
                $anchor_x = isset($pos['anchor_x']) ? max(0, min(100, (float)$pos['anchor_x'])) : null;
                $anchor_y = isset($pos['anchor_y']) ? max(0, min(100, (float)$pos['anchor_y'])) : null;

                $stmt->execute([
                    ':geo_code_id' => (int)$pos['id'],
                    ':plan_id'     => $plan_id,
                    ':pos_x'       => $pos_x,
                    ':pos_y'       => $pos_y,
                    ':width'       => isset($pos['width']) ? (int)$pos['width'] : null,
                    ':height'      => isset($pos['height']) ? (int)$pos['height'] : null,
                    ':anchor_x'    => $anchor_x,
                    ':anchor_y'    => $anchor_y
                ]);
                // Loguer chaque placement individuellement
                $this->_logHistory((int)$pos['id'], $plan_id, $pos_x, $pos_y, 'placed');
            }
            
            // Valider la transaction si tout s'est bien passé
            $this->db->commit();
            return true;

        } catch (Exception $e) {
            // Annuler en cas d'erreur
            $this->db->rollBack();
            error_log("Erreur lors de la sauvegarde multiple sur plan {$plan_id} : " . $e->getMessage());
            return false;
        }
    }

    /**
     * Récupère les dernières entrées de l'historique pour un plan donné.
     * @param int $planId ID du plan.
     * @param int $limit Nombre maximum d'entrées à retourner.
     * @return array Liste des entrées de l'historique.
     */
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
    
    /**
     * Récupère une entrée spécifique de l'historique par son ID.
     * @param int $historyId ID de l'entrée d'historique.
     * @return array|false Tableau associatif de l'entrée ou false si non trouvée.
     */
    public function getHistoryEntry(int $historyId) {
        $stmt = $this->db->prepare("SELECT * FROM geo_positions_history WHERE id = ?");
        $stmt->execute([$historyId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Compte le nombre total de plans actifs.
     * @return int Nombre total de plans.
     */
    public function countTotalPlans(): int {
        // Il n'y a pas de colonne 'deleted_at' pour les plans pour l'instant
        return (int)$this->db->query("SELECT COUNT(*) FROM plans")->fetchColumn(); 
    }
}
