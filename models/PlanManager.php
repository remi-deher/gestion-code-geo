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
            // Ajout json_path
            $stmt = $this->db->query("SELECT id, nom, nom_fichier, json_path, created_at, updated_at FROM plans ORDER BY nom ASC");
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
            // Ajout json_path et updated_at
            $stmt = $this->db->prepare("SELECT id, nom, nom_fichier, json_path, created_at, updated_at, type, description, drawing_data FROM plans WHERE id = :id");
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
     * (Simplifié par rapport à la version précédente, vérifier si ok)
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
     * @param string|null $zone Nouvelle zone. (Note: cette colonne n'existe pas dans le schema.sql initial)
     * @param array $universIds Tableau des IDs d'univers.
     * @param string|null $newFilename Nouveau nom de fichier.
     * @return bool True si succès.
     */
    public function updatePlan(int $id, string $nom, ?string $zone, array $universIds, ?string $newFilename): bool {
        $this->lastError = null; // Reset error
        $this->db->beginTransaction();
        try {
            // 1. Mettre à jour la table 'plans'
            // ATTENTION: La colonne 'zone' n'est pas dans schema.sql, est-ce normal ?
            // Ajout de updated_at
            // Si nouveau fichier, on efface json_path et drawing_data
            $sql = "UPDATE plans SET nom = :nom, updated_at = NOW()";
            // if ($zone !== null) { $sql .= ", zone = :zone"; } // A décommenter si la colonne existe
            if ($newFilename !== null) {
                $sql .= ", nom_fichier = :nom_fichier, drawing_data = NULL, json_path = NULL";
            }
            $sql .= " WHERE id = :id";

            $stmt = $this->db->prepare($sql);

            $stmt->bindValue(':nom', $nom);
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            // if ($zone === null) { $stmt->bindValue(':zone', null, PDO::PARAM_NULL); }
            // else { $stmt->bindValue(':zone', $zone); }
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
     * (Suppression dure, pas de soft delete dans cette version)
     * @param int $id ID du plan.
     * @return bool True si succès.
     */
    public function deletePlan(int $id): bool {
        $this->lastError = null; // Reset error
        $this->db->beginTransaction(); // Use transaction for multi-table delete
        try {
             // 1. Supprimer les positions
             $stmtPos = $this->db->prepare("DELETE FROM geo_positions WHERE plan_id = :id");
             $stmtPos->bindParam(':id', $id, PDO::PARAM_INT);
             $stmtPos->execute();

             // 2. Supprimer les associations univers
             $stmtUniv = $this->db->prepare("DELETE FROM plan_univers WHERE plan_id = :id");
             $stmtUniv->bindParam(':id', $id, PDO::PARAM_INT);
             $stmtUniv->execute();
             
             // 3. Supprimer l'historique (si la table existe)
             // Assumons que la table s'appelle geo_positions_history
             try {
                $stmtHist = $this->db->prepare("DELETE FROM geo_positions_history WHERE plan_id = :id");
                $stmtHist->bindParam(':id', $id, PDO::PARAM_INT);
                $stmtHist->execute();
             } catch (PDOException $e) {
                 // Ignorer si la table n'existe pas, mais logguer l'erreur
                 if ($e->getCode() !== '42S02') { // 42S02 = Table not found
                      error_log("Erreur suppression historique (Plan: $id): " . $e->getMessage());
                      throw $e; // Relancer si c'est une autre erreur
                 }
             }

             // 4. Supprimer le plan
             $stmtPlan = $this->db->prepare("DELETE FROM plans WHERE id = :id");
             $stmtPlan->bindParam(':id', $id, PDO::PARAM_INT);
             $stmtPlan->execute();

             $this->db->commit();
             return $stmtPlan->rowCount() > 0; // Vrai si le plan a été supprimé

        } catch (PDOException $e) {
             $this->db->rollBack();
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
            // Ajout updated_at
            $sqlPlan = "INSERT INTO plans (nom, nom_fichier, created_at, updated_at, type) VALUES (:nom, :nom_fichier, NOW(), NOW(), 'svg')";
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
     * MODIFIÉ : Sauvegarde le contenu JSON dans un fichier et met à jour json_path dans la BDD.
     * @param int $planId L'ID du plan.
     * @param string $jsonContent Le contenu JSON (chaîne).
     * @return array Retourne ['success' => true, 'json_path' => $relativePath] ou ['success' => false, 'error' => 'message'].
     */
    public function updateSvgPlan(int $planId, string $jsonContent): array // Signature modifiée
    {
        $this->lastError = null; // Reset error
        // 1. Sauvegarder le contenu JSON dans un fichier
        $jsonFilePath = $this->saveJsonContent($planId, $jsonContent); // Appel de la nouvelle fonction privée

        if ($jsonFilePath === null) {
            error_log("updateSvgPlan ERREUR: Echec de saveJsonContent pour Plan ID: $planId");
            return ['success' => false, 'error' => 'Erreur lors de la sauvegarde du fichier JSON.'];
        }
        error_log("updateSvgPlan INFO: Fichier JSON sauvegardé: " . $jsonFilePath);


        // 2. Mettre à jour la base de données avec le chemin relatif
        // Assurez-vous que la colonne 'json_path' existe dans votre table 'plans'.
        $sql = "UPDATE plans SET json_path = :json_path, updated_at = NOW() WHERE id = :id";
        $stmt = null; // Init pour le catch

        try {
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':json_path', $jsonFilePath, PDO::PARAM_STR);
            $stmt->bindValue(':id', $planId, PDO::PARAM_INT);

            error_log("updateSvgPlan INFO: Execution de la mise à jour BDD...");
            $stmt->execute(); // Leve une exception si erreur

            error_log("updateSvgPlan INFO: Mise à jour BDD réussie pour Plan ID: $planId");
            // Retourner succès et le chemin relatif
            return ['success' => true, 'json_path' => $jsonFilePath];

        } catch (PDOException $e) {
            error_log("updateSvgPlan ERREUR PDOException (Plan: $planId): " . $e->getMessage());
            $this->lastError = $this->db->errorInfo();
            error_log("PDO Error Info: " . print_r($this->lastError, true));
            return ['success' => false, 'error' => 'Erreur base de données lors de la mise à jour du chemin JSON.'];
        } catch (Exception $e) {
             error_log("updateSvgPlan ERREUR Exception (Plan: $planId): " . $e->getMessage());
             return ['success' => false, 'error' => 'Erreur inattendue lors de la mise à jour du plan.'];
        }
    }

    /**
     * NOUVEAU : Sauvegarde le contenu JSON dans un fichier spécifique au plan.
     * Supprime les anciens fichiers JSON pour ce plan.
     * @param int $planId L'ID du plan.
     * @param string $jsonContent Le contenu JSON à sauvegarder.
     * @return string|null Le chemin relatif du fichier sauvegardé ou null en cas d'erreur.
     */
    private function saveJsonContent(int $planId, string $jsonContent): ?string
    {
        // Chemin absolu vers le dossier de destination
        $baseDir = dirname(__DIR__) . '/public/uploads/plans_json/';

        // Créer le dossier s'il n'existe pas
        if (!is_dir($baseDir)) {
            // Tenter de créer le dossier récursivement avec les bonnes permissions
            if (!@mkdir($baseDir, 0775, true)) { // Utiliser @ pour masquer warning si existe déjà
                // Vérifier si la création a échoué pour une autre raison que "existe déjà"
                if (!is_dir($baseDir)) {
                    error_log("Impossible de créer le dossier: " . $baseDir . " Erreur: " . error_get_last()['message']);
                    return null;
                }
            }
        }

        // Vérifier si le dossier est accessible en écriture
        if (!is_writable($baseDir)) {
             error_log("Le dossier n'est pas accessible en écriture: " . $baseDir);
             // Tenter de changer les permissions (si nécessaire et si autorisé par le système)
             // @chmod($baseDir, 0775);
             // if (!is_writable($baseDir)) { // Re-vérifier après chmod
             //    error_log("chmod n'a pas fonctionné ou n'est pas autorisé pour " . $baseDir);
             //    return null;
             // }
             return null; // Si toujours pas accessible, on abandonne
        }

        // Nettoyer les anciens fichiers JSON pour ce plan
        // Utiliser DIRECTORY_SEPARATOR pour la compatibilité
        $oldFilesPattern = rtrim($baseDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . "plan_" . $planId . "_*.json";
        $oldFiles = glob($oldFilesPattern);
        if ($oldFiles === false) {
             error_log("Erreur lors de la recherche des anciens fichiers JSON: " . $oldFilesPattern);
             // Continuer quand même, mais logger l'erreur
        } else {
            foreach ($oldFiles as $file) {
                if (!@unlink($file)) { // Utiliser @ pour masquer warning si fichier déjà supprimé
                    error_log("Impossible de supprimer l'ancien fichier JSON: " . $file . " Erreur: " . error_get_last()['message']);
                    // Continuer quand même
                } else {
                     error_log("Ancien fichier JSON supprimé: " . $file);
                }
            }
        }


        // Générer le nom du nouveau fichier
        $filename = "plan_" . $planId . "_" . time() . ".json";
        $filePath = rtrim($baseDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $filename; // Chemin absolu pour l'écriture
        $relativePath = 'uploads/plans_json/' . $filename; // Chemin relatif pour la BDD et le retour JS

        // Écrire le contenu dans le nouveau fichier
        if (@file_put_contents($filePath, $jsonContent) === false) {
            error_log("Impossible d'écrire dans le fichier JSON: " . $filePath . " Erreur: " . error_get_last()['message']);
            return null;
        }
        error_log("Fichier JSON écrit avec succès: " . $filePath);

        // Optionnel: Assurer les bonnes permissions sur le fichier créé
        // @chmod($filePath, 0664);

        // Retourner le chemin relatif
        return $relativePath;
    }


    // --- Historique ---

     /**
     * Ajoute une entrée à l'historique des actions.
     */
    private function addToHistory(int $geoCodeId, int $planId, float $posX, float $posY, string $action) {
        // La variable $action n'est plus utilisée mais on peut la garder si on veut l'ajouter plus tard
        try {
            // Correction nom table ET suppression colonnes 'action' et 'timestamp'
            // Assumons que la table s'appelle geo_positions_history
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
            // Ignorer l'erreur si la table n'existe pas
             if ($e->getCode() !== '42S02') { // 42S02 = Table not found
                  // Relancer ou logguer plus sévèrement si ce n'est pas une table manquante
             }
        }
    }

    /**
     * Récupère les dernières entrées de l'historique pour un plan.
     */
    public function getHistoryForPlan(int $planId, int $limit = 50): array {
         $this->lastError = null; // Reset error
         try {
             // Correction nom table historique
             // Assumons que la table s'appelle geo_positions_history
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
             // Ignorer l'erreur si la table n'existe pas
             if ($e->getCode() === '42S02') { return []; } // Table not found
             // Sinon, retourner un tableau vide mais logguer quand même
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
             // Assumons que la table s'appelle geo_positions_history
             $stmt = $this->db->prepare("SELECT * FROM geo_positions_history WHERE id = :id");
             $stmt->bindParam(':id', $historyId, PDO::PARAM_INT);
             $stmt->execute();
             return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
             error_log("Erreur getHistoryEntry (ID: $historyId): " . $e->getMessage());
             $this->lastError = $this->db->errorInfo();
             // Ignorer l'erreur si la table n'existe pas
             if ($e->getCode() === '42S02') { return false; } // Table not found
             return false; // Autre erreur
        }
    }

/**
     * Récupère tous les codes qui ont été placés sur un plan spécifique.
     * C'est la fonction appelée au chargement de la page de l'éditeur.
     * @param int $planId L'ID du plan
     * @return array La liste des codes placés avec leurs données de position
     */
public function getPlacedCodesForPlan($planId) {
        // --- Correction : S'assurer que geo_positions et geo_codes existent ---
        // Jointure avec univers pour la couleur/nom
        $sql = "SELECT
                    gc.id, gc.code_geo, gc.libelle, gc.commentaire, gc.zone,
                    u.nom as univers_nom, u.couleur as univers_color, -- Jointure Univers
                    gp.plan_id, gp.pos_x, gp.pos_y, gp.width, gp.height, gp.anchor_x, gp.anchor_y,
                    gp.id AS position_id
                    -- gp.drawing_data, -- Probablement pas nécessaire ici
                FROM geo_codes gc
                LEFT JOIN univers u ON gc.univers_id = u.id -- JOINTURE UNIVERS
                JOIN geo_positions gp ON gc.id = gp.geo_code_id
                WHERE
                    gp.plan_id = :planId
                    AND gc.deleted_at IS NULL"; // Assumer soft delete sur geo_codes

        try {
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':planId', $planId, PDO::PARAM_INT);
            $stmt->execute();
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Regrouper les positions par geo_code_id
            $groupedResults = [];
            foreach ($results as $row) {
                 $geoCodeId = $row['id'];
                 if (!isset($groupedResults[$geoCodeId])) {
                     // Première fois qu'on voit ce code géo, stocker les infos de base
                     $groupedResults[$geoCodeId] = [
                         'id' => $geoCodeId,
                         'code_geo' => $row['code_geo'],
                         'libelle' => $row['libelle'],
                         'commentaire' => $row['commentaire'],
                         'zone' => $row['zone'],
                         'univers_nom' => $row['univers_nom'],
                         'univers_color' => $row['univers_color'],
                         'placements' => [] // Initialiser le tableau des placements
                     ];
                 }
                 // Ajouter les infos de cette position spécifique
                 $groupedResults[$geoCodeId]['placements'][] = [
                    'plan_id' => $row['plan_id'],
                    'position_id' => $row['position_id'],
                    'pos_x' => $row['pos_x'],
                    'pos_y' => $row['pos_y'],
                    'width' => $row['width'],
                    'height' => $row['height'],
                    'anchor_x' => $row['anchor_x'],
                    'anchor_y' => $row['anchor_y']
                    // 'drawing_data' => $row['drawing_data'] // Si besoin
                 ];
            }
            // Retourner un tableau indexé numériquement comme attendu par le JS
            return array_values($groupedResults);

        } catch (PDOException $e) {
            error_log("Erreur dans getPlacedCodesForPlan (Plan: $planId): " . $e->getMessage());
            $this->lastError = $this->db->errorInfo();
             // Ignorer l'erreur si une table jointe n'existe pas
             if ($e->getCode() === '42S02' || $e->getCode() === '42S22') { // Table or Column not found
                 return [];
             }
            return []; // Retourner vide pour les autres erreurs aussi
        }
    }

} // Fin de la classe PlanManager

