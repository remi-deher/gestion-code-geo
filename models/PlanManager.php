<?php
// Fichier: models/PlanManager.php

class PlanManager {
    private $db;
    // *** AJOUT : Propriété pour stocker la dernière erreur PDO ***
    private $lastError = null;

    public function __construct(PDO $db) {
        $this->db = $db;
        // *** AJOUT : Configurer PDO pour lever des exceptions en cas d'erreur ***
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }

    // *** AJOUT : Méthode pour récupérer la dernière erreur ***
    public function getLastError() {
        return $this->lastError;
    }


    /**
     * Récupère tous les plans de la base de données.
     * @return array La liste des plans.
     */
    public function getAllPlans(): array {
        $this->lastError = null; // Reset error
        try {
            $stmt = $this->db->query("SELECT * FROM plans ORDER BY nom ASC");
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Erreur getAllPlans: " . $e->getMessage());
            $this->lastError = $this->db->errorInfo(); // Stocker l'erreur
            return []; // Retourner un tableau vide en cas d'erreur
        }
    }

      /**
       * Compte le nombre total de plans dans la base de données.
       * @return int Le nombre total de plans.
       */
    public function countTotalPlans(): int {
        $this->lastError = null; // Reset error
        try {
            $stmt = $this->db->query("SELECT COUNT(*) FROM plans");
            $count = $stmt->fetchColumn();
            return ($count !== false) ? (int)$count : 0;
        } catch (PDOException $e) { // Capturer PDOException
            error_log("Erreur countTotalPlans: " . $e->getMessage());
            $this->lastError = $this->db->errorInfo(); // Stocker l'erreur
            return 0; // Retourne 0 en cas d'erreur
        } catch (Exception $e) { // Capturer autres exceptions
             error_log("Erreur countTotalPlans (non-PDO): " . $e->getMessage());
             return 0;
        }
    }

    /**
     * Récupère un plan par son ID.
     * @param int $id ID du plan.
     * @return array|false Les informations du plan ou false si non trouvé.
     */
    public function getPlanById(int $id) {
        $this->lastError = null; // Reset error
        try {
            $stmt = $this->db->prepare("SELECT * FROM plans WHERE id = :id");
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Erreur getPlanById (ID: $id): " . $e->getMessage());
            $this->lastError = $this->db->errorInfo();
            return false;
        }
    }

    /**
     * Récupère un plan avec les IDs des univers associés.
     * @param int $id ID du plan.
     * @return array|false Les informations du plan ou false.
     */
    public function getPlanWithUnivers(int $id) {
        $this->lastError = null; // Reset error
        try {
            $plan = $this->getPlanById($id); // Appelle la méthode déjà protégée
            if (!$plan) {
                return false;
            }

            $stmt = $this->db->prepare("SELECT univers_id FROM plan_univers WHERE plan_id = :plan_id");
            $stmt->bindParam(':plan_id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $plan['univers_ids'] = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
            $plan['univers_ids'] = array_map('intval', $plan['univers_ids']);

            return $plan;
        } catch (PDOException $e) {
            error_log("Erreur getPlanWithUnivers (ID: $id): " . $e->getMessage());
            $this->lastError = $this->db->errorInfo();
            return false;
        }
    }

    /**
     * Ajoute un nouveau plan.
     * @param string $nom Nom du plan.
     * @param string $nomFichier Nom du fichier.
     * @return int|false L'ID du plan créé ou false en cas d'erreur.
     */
    public function addPlan(string $nom, string $nomFichier) {
        $this->lastError = null; // Reset error
        try {
            $sql = "INSERT INTO plans (nom, nom_fichier, created_at, updated_at) VALUES (:nom, :nom_fichier, NOW(), NOW())";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':nom', $nom);
            $stmt->bindParam(':nom_fichier', $nomFichier);
            $stmt->execute(); // Leve une exception si erreur
            return (int)$this->db->lastInsertId();

        } catch (PDOException $e) {
             error_log("Erreur addPlan: " . $e->getMessage());
             $this->lastError = $this->db->errorInfo();
             return false;
        }
    }

    /**
     * Met à jour les informations d'un plan.
     * @param int $id ID du plan.
     * @param string $nom Nouveau nom.
     * @param string|null $zone Nouvelle zone.
     * @param array $universIds Tableau des IDs d'univers.
     * @param string|null $newFilename Nouveau nom de fichier.
     * @return bool True si succès.
     */
    public function updatePlan(int $id, string $nom, ?string $zone, array $universIds, ?string $newFilename): bool {
        $this->lastError = null; // Reset error
        $this->db->beginTransaction();
        try {
            // 1. Mettre à jour la table 'plans'
            $sql = "UPDATE plans SET nom = :nom, zone = :zone, updated_at = NOW()";
            if ($newFilename !== null) {
                $sql .= ", nom_fichier = :nom_fichier, drawing_data = NULL";
            }
            $sql .= " WHERE id = :id";

            $stmt = $this->db->prepare($sql);

            $stmt->bindValue(':nom', $nom);
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            if ($zone === null) {
                $stmt->bindValue(':zone', null, PDO::PARAM_NULL);
            } else {
                $stmt->bindValue(':zone', $zone);
            }
            if ($newFilename !== null) {
                $stmt->bindValue(':nom_fichier', $newFilename);
            }

            $stmt->execute(); // Leve une exception si erreur

            // 2. Mettre à jour les associations dans 'plan_univers'
            $stmtDelete = $this->db->prepare("DELETE FROM plan_univers WHERE plan_id = :plan_id");
            $stmtDelete->bindParam(':plan_id', $id, PDO::PARAM_INT);
            $stmtDelete->execute(); // Leve une exception si erreur

            if (!empty($universIds)) {
                $sqlInsert = "INSERT INTO plan_univers (plan_id, univers_id) VALUES (:plan_id, :univers_id)";
                $stmtInsert = $this->db->prepare($sqlInsert);
                $stmtInsert->bindParam(':plan_id', $id, PDO::PARAM_INT);
                foreach ($universIds as $universId) {
                    $uId = (int)$universId;
                    $stmtInsert->bindParam(':univers_id', $uId, PDO::PARAM_INT);
                    $stmtInsert->execute(); // Leve une exception si erreur
                }
            }

            $this->db->commit();
            return true;

        } catch (PDOException $e) { // Capturer PDOException
            $this->db->rollBack();
            error_log("Erreur updatePlan (ID: $id): " . $e->getMessage());
            $this->lastError = $this->db->errorInfo(); // Utiliser $this->db->errorInfo() car $stmt peut être indéfini
            return false;
        } catch (Exception $e) { // Capturer autres exceptions
             $this->db->rollBack();
             error_log("Erreur updatePlan (ID: $id, non-PDO): " . $e->getMessage());
             return false;
        }
    }


    /**
     * Supprime un plan et ses associations/positions.
     * @param int $id ID du plan.
     * @return bool True si succès.
     */
    public function deletePlan(int $id): bool {
        // Supposer que ON DELETE CASCADE est activé dans la BDD
        $this->lastError = null; // Reset error
        try {
             $stmtPlan = $this->db->prepare("DELETE FROM plans WHERE id = :id");
             $stmtPlan->bindParam(':id', $id, PDO::PARAM_INT);
             $stmtPlan->execute(); // Leve une exception si erreur
             // rowCount() peut être > 0 même si CASCADE échoue sur une autre table,
             // mais c'est mieux que rien pour confirmer la suppression du plan lui-même.
             return $stmtPlan->rowCount() > 0;
        } catch (PDOException $e) {
             error_log("Erreur deletePlan (ID: $id): " . $e->getMessage());
             $this->lastError = $this->db->errorInfo();
             return false;
        }
    }

    /**
     * *** MÉTHODE AVEC LOGS DÉTAILLÉS ***
     * Sauvegarde (crée ou met à jour) une position d'élément géo.
     * Accepte width/height/anchor null.
     * @param int $geoCodeId ID du Géo Code.
     * @param int $planId ID du Plan.
     * @param float $posX Position X (%).
     * @param float $posY Position Y (%).
     * @param int|null $width Largeur (pixels).
     * @param int|null $height Hauteur (pixels).
     * @param float|null $anchorX Ancre X (%).
     * @param float|null $anchorY Ancre Y (%).
     * @param int|null $positionId ID de la position si mise à jour.
     * @return array|false Les données de la position sauvegardée ou false si erreur.
     */
    public function savePosition(
        int $geoCodeId, int $planId, float $posX, float $posY,
        ?int $width, ?int $height, ?float $anchorX, ?float $anchorY,
        ?int $positionId
    ) {
        $this->lastError = null; // Réinitialiser l'erreur
        $action = ($positionId === null) ? 'placé' : 'déplacé';
        $sql = ''; // Initialiser pour le log d'erreur
        $paramsForLog = []; // Initialiser pour le log d'erreur
        $stmt = null; // Initialiser pour le log d'erreur

        try {
            $this->db->beginTransaction();

            if ($positionId === null) {
                // --- INSERT ---
                $sql = "INSERT INTO geo_positions (geo_code_id, plan_id, pos_x, pos_y, width, height, anchor_x, anchor_y, created_at, updated_at)
                        VALUES (:geo_code_id, :plan_id, :pos_x, :pos_y, :width, :height, :anchor_x, :anchor_y, NOW(), NOW())";
                $stmt = $this->db->prepare($sql);

                $paramsForLog = [ // Pour le log
                    ':geo_code_id' => $geoCodeId, ':plan_id' => $planId, ':pos_x' => $posX, ':pos_y' => $posY,
                    ':width' => $width, ':height' => $height, ':anchor_x' => $anchorX, ':anchor_y' => $anchorY
                ];

                $stmt->bindValue(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
                $stmt->bindValue(':plan_id', $planId, PDO::PARAM_INT);
                $stmt->bindValue(':pos_x', $posX);
                $stmt->bindValue(':pos_y', $posY);
                $stmt->bindValue(':width', $width, $width === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
                $stmt->bindValue(':height', $height, $height === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
                $stmt->bindValue(':anchor_x', $anchorX, $anchorX === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $stmt->bindValue(':anchor_y', $anchorY, $anchorY === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

                error_log("PlanManager::savePosition (INSERT) SQL: " . $sql);
                error_log("PlanManager::savePosition (INSERT) PARAMS: " . print_r($paramsForLog, true));

                $stmt->execute();
                $positionId = (int)$this->db->lastInsertId();

            } else {
                // --- UPDATE ---
                $sql = "UPDATE geo_positions
                        SET pos_x = :pos_x, pos_y = :pos_y, width = :width, height = :height,
                            anchor_x = :anchor_x, anchor_y = :anchor_y, updated_at = NOW()
                        WHERE id = :position_id AND geo_code_id = :geo_code_id AND plan_id = :plan_id";
                $stmt = $this->db->prepare($sql);

                 $paramsForLog = [ // Pour le log
                    ':pos_x' => $posX, ':pos_y' => $posY, ':width' => $width, ':height' => $height,
                    ':anchor_x' => $anchorX, ':anchor_y' => $anchorY,
                    ':position_id' => $positionId, ':geo_code_id' => $geoCodeId, ':plan_id' => $planId
                ];

                $stmt->bindValue(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
                $stmt->bindValue(':plan_id', $planId, PDO::PARAM_INT);
                $stmt->bindValue(':pos_x', $posX);
                $stmt->bindValue(':pos_y', $posY);
                $stmt->bindValue(':width', $width, $width === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
                $stmt->bindValue(':height', $height, $height === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
                $stmt->bindValue(':anchor_x', $anchorX, $anchorX === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $stmt->bindValue(':anchor_y', $anchorY, $anchorY === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $stmt->bindValue(':position_id', $positionId, PDO::PARAM_INT);

                error_log("PlanManager::savePosition (UPDATE) SQL: " . $sql);
                error_log("PlanManager::savePosition (UPDATE) PARAMS: " . print_r($paramsForLog, true));

                $stmt->execute();
            }

            // Ajouter à l'historique seulement si l'opération a réussi jusqu'ici
            $this->addToHistory($geoCodeId, $planId, $posX, $posY, $action);

            $this->db->commit();

            // Retourner les données complètes
            $savedData = $this->getPositionById($positionId);
            if ($savedData === false) {
                 // Si getPositionById échoue après un commit réussi (étrange, mais possible)
                 error_log("PlanManager::savePosition ERREUR: Impossible de récupérer la position ID $positionId après sauvegarde.");
                 return false;
            }
            return $savedData;

        } catch (PDOException $e) {
            // Assurer le rollback si une transaction était active
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            error_log("PlanManager::savePosition ERREUR PDOException: " . $e->getMessage());
            error_log("Failed SQL: " . $sql); // Log le SQL qui a échoué
            error_log("Failed PARAMS: " . print_r($paramsForLog, true)); // Log les params
            // Essayer de récupérer l'erreur depuis l'exception ou le statement
            $errorInfo = ($stmt instanceof PDOStatement) ? $stmt->errorInfo() : $this->db->errorInfo();
            $this->lastError = $errorInfo;
            error_log("PDO Error Info: " . print_r($this->lastError, true));
            return false;
        } catch (Exception $e) {
             if ($this->db->inTransaction()) {
                 $this->db->rollBack();
             }
             error_log("PlanManager::savePosition ERREUR Exception: " . $e->getMessage());
             error_log("Trace: " . $e->getTraceAsString());
             return false;
        }
    }


    /**
     * Récupère une position par son ID.
     */
    public function getPositionById(int $positionId) {
        $this->lastError = null; // Reset error
        try {
            $stmt = $this->db->prepare("SELECT * FROM geo_positions WHERE id = :id");
            $stmt->bindParam(':id', $positionId, PDO::PARAM_INT);
            $stmt->execute();
            // Retourner false si fetch échoue (aucune ligne trouvée)
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result !== false ? $result : false;
        } catch (PDOException $e) {
            error_log("Erreur getPositionById (ID: $positionId): " . $e->getMessage());
            $this->lastError = $this->db->errorInfo();
            return false;
        }
    }


    /**
     * Supprime une position spécifique.
     */
    public function removePosition(int $positionId): bool {
        $this->lastError = null; // Reset error
        $this->db->beginTransaction();
        try {
            $stmtInfo = $this->db->prepare("SELECT geo_code_id, plan_id, pos_x, pos_y FROM geo_positions WHERE id = :id");
            $stmtInfo->bindParam(':id', $positionId, PDO::PARAM_INT);
            $stmtInfo->execute();
            $posInfo = $stmtInfo->fetch(PDO::FETCH_ASSOC);

            if (!$posInfo) {
                error_log("removePosition: Position déjà supprimée? (ID: $positionId)");
                $this->db->commit(); // Commit quand même pour être sûr
                return true;
            }

            $stmt = $this->db->prepare("DELETE FROM geo_positions WHERE id = :id");
            $stmt->bindParam(':id', $positionId, PDO::PARAM_INT);
            $stmt->execute();

            $this->addToHistory($posInfo['geo_code_id'], $posInfo['plan_id'], $posInfo['pos_x'], $posInfo['pos_y'], 'supprimé');

            $this->db->commit();
            return true;
        } catch (PDOException $e) {
            $this->db->rollBack();
            error_log("Erreur removePosition (ID: $positionId): " . $e->getMessage());
            $this->lastError = $this->db->errorInfo();
            return false;
        } catch (Exception $e) {
             $this->db->rollBack();
             error_log("Erreur removePosition (ID: $positionId, non-PDO): " . $e->getMessage());
             return false;
        }
    }

    /**
     * Supprime toutes les positions d'un code géo donné sur un plan spécifique.
     */
    public function removeMultiplePositionsByCodeId(int $geoCodeId, int $planId): bool {
        $this->lastError = null; // Reset error
        try {
            // TODO: Ajouter historique pour suppression multiple si nécessaire
            $sql = "DELETE FROM geo_positions WHERE geo_code_id = :geo_code_id AND plan_id = :plan_id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
            $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
            $stmt->execute();
            return true;
        } catch (PDOException $e) {
             error_log("Erreur removeMultiplePositionsByCodeId (Code: $geoCodeId, Plan: $planId): " . $e->getMessage());
             $this->lastError = $this->db->errorInfo();
             return false;
        }
    }

    /**
     * Sauvegarde les données de dessin (annotations JSON) pour un plan.
     */
    public function saveDrawingData(int $planId, ?string $jsonData): bool {
        $this->lastError = null; // Reset error
         try {
             $sql = "UPDATE plans SET drawing_data = :drawing_data, updated_at = NOW() WHERE id = :id";
             $stmt = $this->db->prepare($sql);
             $stmt->bindParam(':id', $planId, PDO::PARAM_INT);
             $stmt->bindValue(':drawing_data', $jsonData, $jsonData === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
             $stmt->execute();
             return true;
        } catch (PDOException $e) {
             error_log("Erreur saveDrawingData (Plan: $planId): " . $e->getMessage());
             $this->lastError = $this->db->errorInfo();
             return false;
        }
    }

    /**
     * Crée un nouveau plan SVG (fichier + BDD) et associe les univers.
     */
    public function savePlanAsSvg(string $nom, string $svgContent, array $universIds) {
        $this->lastError = null; // Reset error
        $uploadDir = __DIR__ . '/../public/uploads/plans/';
        if (!is_dir($uploadDir)) @mkdir($uploadDir, 0777, true);
        $safeName = preg_replace('/[^a-zA-Z0-9-_\.]/', '_', $nom);
        // Utiliser uniqid pour plus de robustesse sur les noms de fichiers concurrents
        $filename = uniqid(time() . '_', true) . '_' . $safeName . '.svg';
        $filepath = $uploadDir . $filename;

        if (@file_put_contents($filepath, $svgContent) === false) {
            error_log("Erreur lors de l'écriture du fichier SVG: " . $filepath);
            return false;
        }

        $this->db->beginTransaction();
        try {
            $sqlPlan = "INSERT INTO plans (nom, nom_fichier, created_at, updated_at) VALUES (:nom, :nom_fichier, NOW(), NOW())";
            $stmtPlan = $this->db->prepare($sqlPlan);
            $stmtPlan->bindParam(':nom', $nom);
            $stmtPlan->bindParam(':nom_fichier', $filename);
            $stmtPlan->execute();
            $planId = (int)$this->db->lastInsertId();

            if (!empty($universIds)) {
                $sqlUniv = "INSERT INTO plan_univers (plan_id, univers_id) VALUES (:plan_id, :univers_id)";
                $stmtUniv = $this->db->prepare($sqlUniv);
                $stmtUniv->bindParam(':plan_id', $planId, PDO::PARAM_INT);
                foreach ($universIds as $uId) {
                    $univId = (int)$uId;
                    $stmtUniv->bindParam(':univers_id', $univId, PDO::PARAM_INT);
                    $stmtUniv->execute();
                }
            }

            $this->db->commit();
            return $planId;

        } catch (PDOException $e) {
            $this->db->rollBack();
            error_log("Erreur savePlanAsSvg: " . $e->getMessage());
            $this->lastError = $this->db->errorInfo();
            if (file_exists($filepath)) @unlink($filepath);
            return false;
        } catch (Exception $e) {
             $this->db->rollBack();
             error_log("Erreur savePlanAsSvg (non-PDO): " . $e->getMessage());
             if (file_exists($filepath)) @unlink($filepath);
             return false;
        }
    }

    /**
     * Met à jour le contenu d'un fichier SVG existant.
     */
    public function updateSvgPlan(int $planId, string $svgContent): bool {
        $this->lastError = null; // Reset error
         try {
            $plan = $this->getPlanById($planId);
            if (!$plan || !str_ends_with(strtolower($plan['nom_fichier']), '.svg')) {
                 error_log("updateSvgPlan: Plan non trouvé ou n'est pas un SVG (ID: $planId)");
                 return false;
            }

            $filepath = __DIR__ . '/../public/uploads/plans/' . $plan['nom_fichier'];

            // Utiliser @ pour supprimer les avertissements si file_put_contents échoue
            if (@file_put_contents($filepath, $svgContent) === false) {
                error_log("Erreur lors de la mise à jour du fichier SVG: " . $filepath);
                return false;
            }

            $stmt = $this->db->prepare("UPDATE plans SET updated_at = NOW() WHERE id = :id");
            $stmt->bindParam(':id', $planId, PDO::PARAM_INT);
            $stmt->execute();

            return true;
        } catch (PDOException $e) {
             error_log("Erreur updateSvgPlan (Plan: $planId): " . $e->getMessage());
             $this->lastError = $this->db->errorInfo();
             return false;
        } catch (Exception $e) { // Pour getPlanById qui peut retourner false
             error_log("Erreur updateSvgPlan (Plan: $planId, non-PDO): " . $e->getMessage());
             return false;
        }
    }


    // --- Historique ---

     /**
     * Ajoute une entrée à l'historique des actions.
     */
    private function addToHistory(int $geoCodeId, int $planId, float $posX, float $posY, string $action) {
        // La variable $action n'est plus utilisée mais on peut la garder si on veut l'ajouter plus tard
        try {
            // Correction nom table ET suppression colonnes 'action' et 'timestamp'
            $sql = "INSERT INTO geo_positions_history (geo_code_id, plan_id, pos_x, pos_y)
                    VALUES (:geo_code_id, :plan_id, :pos_x, :pos_y)";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
            $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
            $stmt->bindParam(':pos_x', $posX); // PDO gère float
            $stmt->bindParam(':pos_y', $posY); // PDO gère float
            // Pas de bindParam pour :action ou timestamp
            $stmt->execute();
        } catch (PDOException $e) {
            // Logguer l'erreur mais ne pas interrompre l'opération principale
            error_log("Erreur addToHistory: " . $e->getMessage() . " | SQL: " . $sql);
            // $this->lastError = $this->db->errorInfo(); // Optionnel: stocker l'erreur si besoin ailleurs
        }
    }

    /**
     * Récupère les dernières entrées de l'historique pour un plan.
     */
    public function getHistoryForPlan(int $planId, int $limit = 50): array {
         $this->lastError = null; // Reset error
         try {
             // Correction nom table historique
             $sql = "SELECT h.*, gc.code_geo
                     FROM geo_positions_history h
                     JOIN geo_codes gc ON h.geo_code_id = gc.id
                     WHERE h.plan_id = :plan_id
                     ORDER BY h.timestamp DESC
                     LIMIT :limit";
             $stmt = $this->db->prepare($sql);
             $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
             $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
             $stmt->execute();
             return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
             error_log("Erreur getHistoryForPlan (Plan: $planId): " . $e->getMessage());
             $this->lastError = $this->db->errorInfo();
             return [];
        }
    }

    /**
     * Récupère une entrée spécifique de l'historique par son ID.
     */
    public function getHistoryEntry(int $historyId) {
         $this->lastError = null; // Reset error
         try {
             // Correction nom table historique
             $stmt = $this->db->prepare("SELECT * FROM geo_positions_history WHERE id = :id");
             $stmt->bindParam(':id', $historyId, PDO::PARAM_INT);
             $stmt->execute();
             return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
             error_log("Erreur getHistoryEntry (ID: $historyId): " . $e->getMessage());
             $this->lastError = $this->db->errorInfo();
             return false;
        }
    }

} // Fin de la classe PlanManager
