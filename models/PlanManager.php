<?php
// Fichier: models/PlanManager.php

class PlanManager {
    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Récupère tous les plans de la base de données.
     * @return array La liste des plans.
     */
    public function getAllPlans(): array {
        $stmt = $this->db->query("SELECT * FROM plans ORDER BY nom ASC");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Récupère un plan par son ID.
     * Inclut maintenant les données de dessin (drawing_data).
     * @param int $id ID du plan.
     * @return array|false Les informations du plan ou false si non trouvé.
     */
    public function getPlanById(int $id) {
        $stmt = $this->db->prepare("SELECT * FROM plans WHERE id = :id");
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Récupère un plan avec les IDs des univers associés.
     * @param int $id ID du plan.
     * @return array|false Les informations du plan avec une clé 'univers_ids' (tableau d'IDs) ou false.
     */
    public function getPlanWithUnivers(int $id) {
        $plan = $this->getPlanById($id);
        if (!$plan) {
            return false;
        }

        $stmt = $this->db->prepare("SELECT univers_id FROM plan_univers WHERE plan_id = :plan_id");
        $stmt->bindParam(':plan_id', $id, PDO::PARAM_INT);
        $stmt->execute();
        // Récupère uniquement la colonne 'univers_id' dans un tableau simple
        $plan['univers_ids'] = $stmt->fetchAll(PDO::FETCH_COLUMN, 0); 
        
        // Convertir les IDs en entiers (fetchAll(PDO::FETCH_COLUMN) peut renvoyer des strings)
        $plan['univers_ids'] = array_map('intval', $plan['univers_ids']);

        return $plan;
    }

    /**
     * Ajoute un nouveau plan (image/svg uploadé initialement).
     * N'associe PAS d'univers ici.
     * @param string $nom Nom du plan.
     * @param string $nomFichier Nom du fichier (après upload/conversion).
     * @return int|false L'ID du plan créé ou false en cas d'erreur.
     */
    public function addPlan(string $nom, string $nomFichier) {
        $sql = "INSERT INTO plans (nom, nom_fichier, created_at, updated_at) VALUES (:nom, :nom_fichier, NOW(), NOW())";
        $stmt = $this->db->prepare($sql);
        $stmt->bindParam(':nom', $nom);
        $stmt->bindParam(':nom_fichier', $nomFichier);
        if ($stmt->execute()) {
            return (int)$this->db->lastInsertId();
        }
        return false;
    }

    /**
     * Met à jour les informations d'un plan (nom, zone, univers, fichier).
     * @param int $id ID du plan.
     * @param string $nom Nouveau nom.
     * @param string|null $zone Nouvelle zone (peut être null).
     * @param array $universIds Tableau des IDs d'univers à associer.
     * @param string|null $newFilename Nouveau nom de fichier si changé, sinon null.
     * @return bool True si succès.
     */
    public function updatePlan(int $id, string $nom, ?string $zone, array $universIds, ?string $newFilename): bool {
        $this->db->beginTransaction();
        try {
            // 1. Mettre à jour la table 'plans'
            $sql = "UPDATE plans SET nom = :nom, zone = :zone, updated_at = NOW()";
            if ($newFilename !== null) {
                $sql .= ", nom_fichier = :nom_fichier";
                 // Si on change le fichier, on efface les anciennes annotations JSON
                 $sql .= ", drawing_data = NULL"; 
            }
            $sql .= " WHERE id = :id";
            
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':nom', $nom);
            // Gérer la zone nulle
            if ($zone === null) {
                $stmt->bindValue(':zone', null, PDO::PARAM_NULL);
            } else {
                $stmt->bindParam(':zone', $zone);
            }
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            if ($newFilename !== null) {
                $stmt->bindParam(':nom_fichier', $newFilename);
            }
            if (!$stmt->execute()) {
                throw new Exception("Erreur lors de la mise à jour du plan.");
            }

            // 2. Mettre à jour les associations dans 'plan_univers'
            // Supprimer les anciennes associations
            $stmtDelete = $this->db->prepare("DELETE FROM plan_univers WHERE plan_id = :plan_id");
            $stmtDelete->bindParam(':plan_id', $id, PDO::PARAM_INT);
            $stmtDelete->execute(); // Pas besoin de vérifier le retour ici

            // Ajouter les nouvelles associations
            if (!empty($universIds)) {
                $sqlInsert = "INSERT INTO plan_univers (plan_id, univers_id) VALUES (:plan_id, :univers_id)";
                $stmtInsert = $this->db->prepare($sqlInsert);
                $stmtInsert->bindParam(':plan_id', $id, PDO::PARAM_INT);
                foreach ($universIds as $universId) {
                    $uId = (int)$universId; // Assurer que c'est un entier
                    $stmtInsert->bindParam(':univers_id', $uId, PDO::PARAM_INT);
                    if (!$stmtInsert->execute()) {
                        // Log l'erreur mais continue si possible? Ou rollback? Rollback est plus sûr.
                         error_log("Erreur insertion plan_univers: plan $id, univers $uId");
                         throw new Exception("Erreur lors de l'association des univers.");
                    }
                }
            }

            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Erreur updatePlan (ID: $id): " . $e->getMessage());
            return false;
        }
    }


    /**
     * Supprime un plan et ses associations/positions.
     * @param int $id ID du plan.
     * @return bool True si succès.
     */
    public function deletePlan(int $id): bool {
        // La suppression devrait cascader grâce aux contraintes FOREIGN KEY:
        // DELETE FROM plans WHERE id = ?
        // Devrait supprimer automatiquement les entrées dans plan_univers et geo_positions.
        // Assurez-vous que vos contraintes sont définies avec ON DELETE CASCADE.
        
        // Si pas de CASCADE, il faut supprimer manuellement :
        $this->db->beginTransaction();
        try {
             // 1. Supprimer historique lié (si table existe)
             // $stmtHist = $this->db->prepare("DELETE FROM historique WHERE plan_id = :id");
             // $stmtHist->bindParam(':id', $id, PDO::PARAM_INT);
             // $stmtHist->execute();
             
             // 2. Supprimer positions liées
             $stmtPos = $this->db->prepare("DELETE FROM geo_positions WHERE plan_id = :id");
             $stmtPos->bindParam(':id', $id, PDO::PARAM_INT);
             $stmtPos->execute();
             
             // 3. Supprimer associations univers
             $stmtUniv = $this->db->prepare("DELETE FROM plan_univers WHERE plan_id = :id");
             $stmtUniv->bindParam(':id', $id, PDO::PARAM_INT);
             $stmtUniv->execute();
             
             // 4. Supprimer le plan
             $stmtPlan = $this->db->prepare("DELETE FROM plans WHERE id = :id");
             $stmtPlan->bindParam(':id', $id, PDO::PARAM_INT);
             if (!$stmtPlan->execute()) {
                 throw new Exception("Erreur lors de la suppression du plan principal.");
             }
             
             $this->db->commit();
             return true;
        } catch (Exception $e) {
             $this->db->rollBack();
             error_log("Erreur deletePlan (ID: $id): " . $e->getMessage());
             return false;
        }
    }

    /**
     * Sauvegarde (ajoute ou met à jour) la position d'un code géo sur un plan.
     * Gère les NULL pour width, height, anchor_x, anchor_y.
     * @param int $geoCodeId ID du code géo.
     * @param int $planId ID du plan.
     * @param float $posX Position X en %.
     * @param float $posY Position Y en %.
     * @param int|null $width Largeur en pixels (ou null).
     * @param int|null $height Hauteur en pixels (ou null).
     * @param float|null $anchorX Ancre X en % (ou null).
     * @param float|null $anchorY Ancre Y en % (ou null).
     * @param int|null $positionId ID de la position si mise à jour, null si création.
     * @return array|false Les données de la position sauvegardée (avec ID) ou false.
     */
    public function savePosition(
        int $geoCodeId, int $planId, float $posX, float $posY,
        ?int $width, ?int $height, ?float $anchorX, ?float $anchorY, ?int $positionId = null
    ) {
        $action = ''; // Pour l'historique
        $this->db->beginTransaction();
        try {
            if ($positionId) {
                // Mise à jour
                $action = 'déplacé';
                $sql = "UPDATE geo_positions 
                        SET pos_x = :pos_x, pos_y = :pos_y, 
                            width = :width, height = :height, 
                            anchor_x = :anchor_x, anchor_y = :anchor_y,
                            updated_at = NOW() 
                        WHERE id = :position_id AND geo_code_id = :geo_code_id AND plan_id = :plan_id";
                $stmt = $this->db->prepare($sql);
                $stmt->bindParam(':position_id', $positionId, PDO::PARAM_INT);

            } else {
                // Création
                $action = 'placé';
                $sql = "INSERT INTO geo_positions 
                        (geo_code_id, plan_id, pos_x, pos_y, width, height, anchor_x, anchor_y, created_at, updated_at) 
                        VALUES 
                        (:geo_code_id, :plan_id, :pos_x, :pos_y, :width, :height, :anchor_x, :anchor_y, NOW(), NOW())";
                $stmt = $this->db->prepare($sql);
            }

            // Bind commun
            $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
            $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
            $stmt->bindParam(':pos_x', $posX);
            $stmt->bindParam(':pos_y', $posY);
            // Gérer les NULL proprement avec bindValue
            $stmt->bindValue(':width', $width, $width === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $stmt->bindValue(':height', $height, $height === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $stmt->bindValue(':anchor_x', $anchorX, $anchorX === null ? PDO::PARAM_NULL : PDO::PARAM_STR); // PDO::PARAM_STR pour float
            $stmt->bindValue(':anchor_y', $anchorY, $anchorY === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

            if (!$stmt->execute()) {
                 throw new Exception("Erreur BDD lors de l'exécution de la requête savePosition.");
            }

            if (!$positionId) {
                $positionId = (int)$this->db->lastInsertId();
            }
            
            // Enregistrer l'action dans l'historique
            $this->addToHistory($geoCodeId, $planId, $posX, $posY, $action);

            $this->db->commit();

            // Retourner les données complètes (utile pour le JS)
            return [
                'id' => $geoCodeId, // ID Code Géo
                'position_id' => $positionId, // ID Position
                'plan_id' => $planId,
                'pos_x' => $posX,
                'pos_y' => $posY,
                'width' => $width,
                'height' => $height,
                'anchor_x' => $anchorX,
                'anchor_y' => $anchorY
            ];

        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Erreur savePosition: " . $e->getMessage() . " | Données: " . print_r(func_get_args(), true));
            return false;
        }
    }

    /**
     * Supprime une position spécifique.
     * @param int $positionId ID de la position (geo_positions.id).
     * @return bool True si succès.
     */
    public function removePosition(int $positionId): bool {
        $this->db->beginTransaction();
        try {
            // Récupérer les infos pour l'historique AVANT suppression
            $stmtInfo = $this->db->prepare("SELECT geo_code_id, plan_id, pos_x, pos_y FROM geo_positions WHERE id = :id");
            $stmtInfo->bindParam(':id', $positionId, PDO::PARAM_INT);
            $stmtInfo->execute();
            $posInfo = $stmtInfo->fetch(PDO::FETCH_ASSOC);

            if (!$posInfo) {
                throw new Exception("Position non trouvée pour l'historique.");
            }

            // Supprimer la position
            $stmt = $this->db->prepare("DELETE FROM geo_positions WHERE id = :id");
            $stmt->bindParam(':id', $positionId, PDO::PARAM_INT);
            if (!$stmt->execute()) {
                 throw new Exception("Erreur BDD lors de la suppression de la position.");
            }
            
            // Ajouter à l'historique
            $this->addToHistory($posInfo['geo_code_id'], $posInfo['plan_id'], $posInfo['pos_x'], $posInfo['pos_y'], 'supprimé');

            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Erreur removePosition (ID: $positionId): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Supprime toutes les positions d'un code géo donné sur un plan spécifique.
     * @param int $geoCodeId ID du code géo.
     * @param int $planId ID du plan.
     * @return bool True si succès.
     */
    public function removeMultiplePositionsByCodeId(int $geoCodeId, int $planId): bool {
         // Note: L'historique n'est pas géré pour la suppression multiple pour l'instant
         $sql = "DELETE FROM geo_positions WHERE geo_code_id = :geo_code_id AND plan_id = :plan_id";
         $stmt = $this->db->prepare($sql);
         $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
         $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
         return $stmt->execute();
    }

    /**
     * Sauvegarde les données de dessin (annotations JSON) pour un plan.
     * @param int $planId ID du plan.
     * @param string|null $jsonData Données JSON (ou null pour effacer).
     * @return bool True si succès.
     */
    public function saveDrawingData(int $planId, ?string $jsonData): bool {
        $sql = "UPDATE plans SET drawing_data = :drawing_data, updated_at = NOW() WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->bindParam(':id', $planId, PDO::PARAM_INT);
        // Gérer le JSON null
        $stmt->bindValue(':drawing_data', $jsonData, $jsonData === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        return $stmt->execute();
    }

    /**
     * Crée un nouveau plan SVG (fichier + BDD) et associe les univers.
     * @param string $nom Nom du plan.
     * @param string $svgContent Contenu du fichier SVG.
     * @param array $universIds Tableau d'IDs d'univers à associer.
     * @return int|false L'ID du plan créé ou false en cas d'erreur.
     */
    public function savePlanAsSvg(string $nom, string $svgContent, array $universIds) {
        $uploadDir = __DIR__ . '/../public/uploads/plans/';
        if (!is_dir($uploadDir)) @mkdir($uploadDir, 0777, true);

        // Générer un nom de fichier unique
        $safeName = preg_replace('/[^a-zA-Z0-9-_\.]/', '_', $nom);
        $filename = time() . '_' . $safeName . '.svg';
        $filepath = $uploadDir . $filename;

        // Écrire le contenu SVG dans le fichier
        if (file_put_contents($filepath, $svgContent) === false) {
            error_log("Erreur lors de l'écriture du fichier SVG: " . $filepath);
            return false;
        }
        
        $this->db->beginTransaction();
        try {
            // Ajouter le plan à la BDD
            $sqlPlan = "INSERT INTO plans (nom, nom_fichier, created_at, updated_at) VALUES (:nom, :nom_fichier, NOW(), NOW())";
            $stmtPlan = $this->db->prepare($sqlPlan);
            $stmtPlan->bindParam(':nom', $nom);
            $stmtPlan->bindParam(':nom_fichier', $filename);
            if (!$stmtPlan->execute()) {
                 throw new Exception("Erreur BDD lors de la création de l'entrée plan.");
            }
            $planId = (int)$this->db->lastInsertId();

            // Associer les univers
            if (!empty($universIds)) {
                $sqlUniv = "INSERT INTO plan_univers (plan_id, univers_id) VALUES (:plan_id, :univers_id)";
                $stmtUniv = $this->db->prepare($sqlUniv);
                $stmtUniv->bindParam(':plan_id', $planId, PDO::PARAM_INT);
                foreach ($universIds as $uId) {
                    $univId = (int)$uId;
                    $stmtUniv->bindParam(':univers_id', $univId, PDO::PARAM_INT);
                    if (!$stmtUniv->execute()) {
                         throw new Exception("Erreur BDD lors de l'association de l'univers ID: $univId");
                    }
                }
            }
            
            $this->db->commit();
            return $planId;

        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Erreur savePlanAsSvg: " . $e->getMessage());
            // Supprimer le fichier SVG créé si la BDD échoue
            if (file_exists($filepath)) @unlink($filepath);
            return false;
        }
    }

    /**
     * Met à jour le contenu d'un fichier SVG existant.
     * @param int $planId ID du plan.
     * @param string $svgContent Nouveau contenu SVG.
     * @return bool True si succès.
     */
    public function updateSvgPlan(int $planId, string $svgContent): bool {
        $plan = $this->getPlanById($planId);
        if (!$plan || !str_ends_with(strtolower($plan['nom_fichier']), '.svg')) {
             error_log("updateSvgPlan: Plan non trouvé ou n'est pas un SVG (ID: $planId)");
             return false;
        }
        
        $filepath = __DIR__ . '/../public/uploads/plans/' . $plan['nom_fichier'];
        
        // Écrire le nouveau contenu dans le fichier
        if (file_put_contents($filepath, $svgContent) === false) {
            error_log("Erreur lors de la mise à jour du fichier SVG: " . $filepath);
            return false;
        }
        
        // Mettre à jour la date 'updated_at' dans la BDD
        $stmt = $this->db->prepare("UPDATE plans SET updated_at = NOW() WHERE id = :id");
        $stmt->bindParam(':id', $planId, PDO::PARAM_INT);
        $stmt->execute(); // Pas critique si ça échoue, mais on le fait quand même
        
        return true;
    }


    // --- Historique ---

    /**
     * Ajoute une entrée à l'historique des actions.
     * @param int $geoCodeId ID du code géo.
     * @param int $planId ID du plan.
     * @param float $posX Position X.
     * @param float $posY Position Y.
     * @param string $action Description ('placé', 'déplacé', 'supprimé').
     */
    private function addToHistory(int $geoCodeId, int $planId, float $posX, float $posY, string $action) {
        try {
            // Assurez-vous que la table 'historique' existe avec les bonnes colonnes
            $sql = "INSERT INTO historique (geo_code_id, plan_id, pos_x, pos_y, action, timestamp) 
                    VALUES (:geo_code_id, :plan_id, :pos_x, :pos_y, :action, NOW())";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
            $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
            $stmt->bindParam(':pos_x', $posX);
            $stmt->bindParam(':pos_y', $posY);
            $stmt->bindParam(':action', $action);
            $stmt->execute();
        } catch (Exception $e) {
            // Log l'erreur mais ne bloque pas l'opération principale (save/remove Position)
            error_log("Erreur addToHistory: " . $e->getMessage());
        }
    }

    /**
     * Récupère les dernières entrées de l'historique pour un plan.
     * @param int $planId ID du plan.
     * @param int $limit Nombre d'entrées à récupérer.
     * @return array Liste des entrées d'historique.
     */
    public function getHistoryForPlan(int $planId, int $limit = 50): array {
        $sql = "SELECT h.*, gc.code_geo 
                FROM historique h 
                JOIN geo_codes gc ON h.geo_code_id = gc.id 
                WHERE h.plan_id = :plan_id 
                ORDER BY h.timestamp DESC 
                LIMIT :limit";
        $stmt = $this->db->prepare($sql);
        $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Récupère une entrée spécifique de l'historique par son ID.
     * @param int $historyId ID de l'entrée d'historique.
     * @return array|false L'entrée d'historique ou false si non trouvée.
     */
    public function getHistoryEntry(int $historyId) {
         $stmt = $this->db->prepare("SELECT * FROM historique WHERE id = :id");
         $stmt->bindParam(':id', $historyId, PDO::PARAM_INT);
         $stmt->execute();
         return $stmt->fetch(PDO::FETCH_ASSOC);
    }

}
