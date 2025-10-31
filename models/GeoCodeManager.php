<?php
// Fichier: models/GeoCodeManager.php

class GeoCodeManager {
    private $db;
    private $lastError; // Pour stocker la dernière erreur

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    // --- Méthodes de Récupération & Comptage ---
    
    /**
     * Récupère tous les codes géo actifs avec leurs informations d'univers.
     * @return array La liste des codes géo.
     */
    public function getAllGeoCodes(): array {
        $sql = "SELECT gc.*, u.nom AS univers_nom, u.color AS univers_color
                FROM geo_codes gc
                LEFT JOIN univers u ON gc.univers_id = u.id
                WHERE gc.deleted_at IS NULL  -- Exclure les codes supprimés
                ORDER BY gc.code_geo ASC";
        try {
            $stmt = $this->db->query($sql);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Erreur getAllGeoCodes: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Compte le nombre total de codes géo actifs dans la base de données.
     * @return int Le nombre total de codes géo.
     */
    public function countTotalActiveCodes(): int {
        try {
            $stmt = $this->db->query("SELECT COUNT(*) FROM geo_codes WHERE deleted_at IS NULL");
            $count = $stmt->fetchColumn();
            return ($count !== false) ? (int)$count : 0;
        } catch (Exception $e) {
            error_log("Erreur countTotalActiveCodes: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Compte le nombre de codes géo distincts qui ont au moins une position sur un plan.
     * @return int Le nombre de codes géo placés.
     */
    public function countPlacedCodes(): int {
        try {
            $sql = "SELECT COUNT(DISTINCT gp.geo_code_id)
                    FROM geo_positions gp
                    JOIN geo_codes gc ON gp.geo_code_id = gc.id
                    WHERE gc.deleted_at IS NULL"; // Compte seulement si le code géo est actif
            $stmt = $this->db->query($sql);
            $count = $stmt->fetchColumn();
            return ($count !== false) ? (int)$count : 0;
        } catch (Exception $e) {
            error_log("Erreur countPlacedCodes: " . $e->getMessage());
            return 0;
        }
    }


    /**
     * Compte le nombre de codes géo actifs par zone.
     * @return array Tableau associatif ['Nom de la Zone' => count, ...].
     */
    public function countCodesByZone(): array {
        $counts = [];
        try {
            $sql = "SELECT COALESCE(NULLIF(zone, ''), 'Non spécifiée') AS zone_name, COUNT(*) AS count
                    FROM geo_codes
                    WHERE deleted_at IS NULL
                    GROUP BY zone_name
                    ORDER BY zone_name ASC";
            $stmt = $this->db->query($sql);
            $results = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
            if ($results !== false) {
                foreach ($results as $zone => $count) {
                    $counts[$zone] = (int)$count;
                }
            }
        } catch (Exception $e) {
            error_log("Erreur countCodesByZone: " . $e->getMessage());
            $counts['__ErreurExecution__'] = 0;
        }
        return $counts;
    }

     /**
     * Compte le nombre de codes géo actifs pour chaque univers.
     * @return array Tableau associatif ['Nom de l'Univers' => count, ...].
     */
    public function getCodesCountByUnivers(): array {
        $counts = [];
        try {
            $sql = "SELECT u.nom AS univers_nom, COUNT(gc.id) AS count
                    FROM geo_codes gc
                    JOIN univers u ON gc.univers_id = u.id
                    WHERE gc.deleted_at IS NULL
                    GROUP BY u.nom
                    ORDER BY u.nom ASC";
            $stmt = $this->db->query($sql);
            $results = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
            if ($results !== false) {
                foreach ($results as $univers => $count) {
                    $counts[$univers] = (int)$count;
                }
            }
        } catch (Exception $e) {
            error_log("Erreur getCodesCountByUnivers: " . $e->getMessage());
            $counts['__ErreurExecution__'] = 0;
        }
        return $counts;
    }


    /**
     * Récupère les N derniers codes géo actifs ajoutés ou mis à jour.
     * @param int $limit Le nombre de codes à récupérer (par défaut 5).
     * @return array La liste des codes géo récents avec infos d'univers.
     */
    public function getLatestCodes(int $limit = 5): array {
        try {
            $sql = "SELECT gc.*, u.nom AS univers_nom, u.color AS univers_color
                    FROM geo_codes gc
                    LEFT JOIN univers u ON gc.univers_id = u.id
                    WHERE gc.deleted_at IS NULL
                    ORDER BY gc.updated_at DESC, gc.created_at DESC
                    LIMIT :limit";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            error_log("Erreur getLatestCodes: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Récupère les codes géo actifs qui n'ont jamais été placés sur aucun plan.
     * @param int $limit Le nombre maximum de codes à retourner (par défaut 5).
     * @return array La liste des codes géo non placés avec infos d'univers.
     */
    public function getUnplacedCodes(int $limit = 5): array {
        try {
            $sql = "SELECT gc.*, u.nom AS univers_nom, u.color AS univers_color
                    FROM geo_codes gc
                    LEFT JOIN univers u ON gc.univers_id = u.id
                    WHERE gc.deleted_at IS NULL
                    AND NOT EXISTS (
                        SELECT 1
                        FROM geo_positions gp
                        WHERE gp.geo_code_id = gc.id
                    )
                    ORDER BY gc.created_at DESC
                    LIMIT :limit";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            error_log("Erreur getUnplacedCodes: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Récupère un code géo par son ID avec les informations d'univers.
     * @param int $id ID du code géo.
     * @return array|false Les informations du code géo ou false si non trouvé.
     */
    public function getGeoCodeById(int $id) {
        $sql = "SELECT gc.*, u.nom AS univers_nom, u.color AS univers_color
                FROM geo_codes gc
                LEFT JOIN univers u ON gc.univers_id = u.id
                WHERE gc.id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

     /**
     * Récupère un code géo actif par son nom (code_geo).
     * @param string $codeGeo Le code géo exact.
     * @return array|false Les données du code géo ou false.
     */
     public function getGeoCodeByCode(string $codeGeo) {
         $sql = "SELECT gc.*, u.nom AS univers_nom, u.color AS univers_color
                 FROM geo_codes gc
                 LEFT JOIN univers u ON gc.univers_id = u.id
                 WHERE gc.code_geo = :code_geo AND gc.deleted_at IS NULL";
         $stmt = $this->db->prepare($sql);
         $stmt->bindParam(':code_geo', $codeGeo);
         $stmt->execute();
         return $stmt->fetch(PDO::FETCH_ASSOC);
     }

    // --- Méthodes CRUD & Historique ---

    /**
     * Ajoute un nouveau code géo et enregistre l'action dans l'historique.
     * @param string $codeGeo
     * @param string|null $libelle
     * @param int $universId
     * @param string|null $commentaire
     * @param string|null $zone
     * @return int|false L'ID du code géo créé ou false en cas d'erreur.
     */
    public function addGeoCode(string $codeGeo, ?string $libelle, int $universId, ?string $commentaire, ?string $zone) {
        if ($this->codeGeoExists($codeGeo)) {
             $this->lastError = ['23000', null, "Le code '$codeGeo' existe déjà."];
             error_log("Tentative d'ajout d'un code géo actif dupliqué: " . $codeGeo);
             return false;
        }

        $sql = "INSERT INTO geo_codes (code_geo, libelle, univers_id, commentaire, zone, created_at, updated_at)
                VALUES (:code_geo, :libelle, :univers_id, :commentaire, :zone, NOW(), NOW())";
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':code_geo', $codeGeo);
            $stmt->bindValue(':libelle', $libelle, $libelle === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindParam(':univers_id', $universId, PDO::PARAM_INT);
            $stmt->bindValue(':commentaire', $commentaire, $commentaire === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindValue(':zone', $zone, $zone === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

            if ($stmt->execute()) {
                $lastId = (int)$this->db->lastInsertId();
                $this->logHistory($lastId, 'created');
                $this->db->commit();
                return $lastId;
            } else {
                $this->lastError = $stmt->errorInfo();
                throw new PDOException("Erreur BDD (non-exception) lors de l'ajout: " . ($this->lastError[2] ?? 'Inconnue'), (int)($this->lastError[1] ?? 0));
            }
        } catch (PDOException $e) {
            $this->db->rollBack();
            $this->lastError = $e->errorInfo ?? [$e->getCode(), null, $e->getMessage()];
            error_log("Erreur PDO lors de l'ajout du code géo {$codeGeo}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Met à jour un code géo existant et enregistre l'action dans l'historique.
     * @param int $id
     * @param string $codeGeo
     * @param string|null $libelle
     * @param int $universId
     * @param string|null $commentaire
     * @param string|null $zone
     * @return bool True si succès, false sinon.
     */
    public function updateGeoCode(int $id, string $codeGeo, ?string $libelle, int $universId, ?string $commentaire, ?string $zone): bool {
         if ($this->codeGeoExists($codeGeo, $id)) {
             $this->lastError = ['23000', null, "Le code '$codeGeo' existe déjà pour un autre ID."];
             error_log("Tentative de mise à jour vers un code géo actif dupliqué: " . $codeGeo);
             return false;
         }
         $oldData = $this->getGeoCodeById($id);
         if (!$oldData) return false;

        $sql = "UPDATE geo_codes
                SET code_geo = :code_geo, libelle = :libelle, univers_id = :univers_id,
                    commentaire = :commentaire, zone = :zone, updated_at = NOW()
                WHERE id = :id AND deleted_at IS NULL";

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':code_geo', $codeGeo);
            $stmt->bindValue(':libelle', $libelle, $libelle === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindParam(':univers_id', $universId, PDO::PARAM_INT);
            $stmt->bindValue(':commentaire', $commentaire, $commentaire === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindValue(':zone', $zone, $zone === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

            if ($stmt->execute()) {
                if ($stmt->rowCount() > 0) {
                     $changes = [];
                     if ($oldData['code_geo'] !== $codeGeo) $changes[] = "CodeGeo: '{$oldData['code_geo']}' -> '$codeGeo'";
                     if ($oldData['libelle'] !== $libelle) $changes[] = "Libellé changé";
                     if ($oldData['univers_id'] !== $universId) $changes[] = "Univers changé";
                     if (($oldData['commentaire'] ?? '') !== ($commentaire ?? '')) $changes[] = "Commentaire changé";
                     if (($oldData['zone'] ?? '') !== ($zone ?? '')) $changes[] = "Zone: '{$oldData['zone']}' -> '$zone'";

                     $this->logHistory($id, 'updated', empty($changes) ? 'Aucun changement détecté' : implode('; ', $changes));
                     $this->db->commit();
                     return true;
                } else {
                     $this->db->rollBack(); return false; // ID non trouvé ou déjà supprimé
                }
            } else {
                 $this->lastError = $stmt->errorInfo();
                 throw new PDOException("Erreur BDD (non-exception) lors de la MAJ: " . ($this->lastError[2] ?? 'Inconnue'), (int)($this->lastError[1] ?? 0));
            }
        } catch (PDOException $e) {
            $this->db->rollBack();
            $this->lastError = $e->errorInfo ?? [$e->getCode(), null, $e->getMessage()];
            error_log("Erreur PDO lors de la MAJ du code géo ID {$id} vers {$codeGeo}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Effectue un soft delete et enregistre l'action.
     * @param int $id ID du code géo.
     * @return bool True si succès.
     */
    public function deleteGeoCode(int $id): bool {
         $this->db->beginTransaction();
        try {
            $sql = "UPDATE geo_codes SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id AND deleted_at IS NULL";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $rowCount = $stmt->rowCount();
            if ($rowCount > 0) {
                 $this->logHistory($id, 'deleted');
                 $this->db->commit();
                 return true;
            } else {
                 $this->db->rollBack(); return false;
            }
        } catch (Exception $e) {
             if ($this->db->inTransaction()) $this->db->rollBack();
            error_log("Erreur deleteGeoCode (soft delete) (ID: $id): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Récupère les codes géo qui sont dans la corbeille (soft-deleted).
     * @return array La liste des codes géo supprimés.
     */
    public function getDeletedGeoCodes(): array {
        $sql = "SELECT gc.*, u.nom AS univers_nom
                FROM geo_codes gc
                LEFT JOIN univers u ON gc.univers_id = u.id
                WHERE gc.deleted_at IS NOT NULL
                ORDER BY gc.deleted_at DESC";
        try {
            $stmt = $this->db->query($sql);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Erreur getDeletedGeoCodes: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Restaure un code géo et enregistre l'action.
     * @param int $id ID du code géo à restaurer.
     * @return bool True si succès.
     */
    public function restoreGeoCode(int $id): bool {
         try {
            $stmtCheck = $this->db->prepare("SELECT code_geo FROM geo_codes WHERE id = :id AND deleted_at IS NOT NULL");
            $stmtCheck->bindParam(':id', $id, PDO::PARAM_INT);
            $stmtCheck->execute();
            $codeToRestore = $stmtCheck->fetchColumn();

            if (!$codeToRestore) {
                error_log("Tentative de restauration d'un code ID $id non trouvé ou non supprimé.");
                return false;
            }
            if ($this->codeGeoExists($codeToRestore)) {
                 error_log("Impossible de restaurer le code ID $id car le code_geo '$codeToRestore' existe déjà activement.");
                 $this->lastError = ['23000', null, "Un code actif '$codeToRestore' existe déjà."];
                 return false;
            }

            $this->db->beginTransaction();
            $sql = "UPDATE geo_codes SET deleted_at = NULL, updated_at = NOW() WHERE id = :id AND deleted_at IS NOT NULL";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            if ($stmt->execute() && $stmt->rowCount() > 0) {
                 $this->logHistory($id, 'restored');
                 $this->db->commit();
                 return true;
            } else {
                 $this->db->rollBack();
                 return false;
            }
        } catch (Exception $e) {
             if ($this->db->inTransaction()) $this->db->rollBack();
            error_log("Erreur restoreGeoCode (ID: $id): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Supprime définitivement un code géo (utilisé depuis la corbeille).
     * @param int $id ID du code géo.
     * @return bool True si succès.
     */
    public function forceDeleteGeoCode(int $id): bool {
        try {
            // Doit être exécuté dans une transaction pour s'assurer que tout est supprimé
            $this->db->beginTransaction();
            
            // 1. Supprimer de geo_codes
            $stmtCode = $this->db->prepare("DELETE FROM geo_codes WHERE id = :id AND deleted_at IS NOT NULL");
            $stmtCode->bindParam(':id', $id, PDO::PARAM_INT);
            $stmtCode->execute();
            $rowCount = $stmtCode->rowCount();

            if ($rowCount > 0) {
                // 2. Supprimer l'historique (optionnel, mais propre)
                $stmtHist = $this->db->prepare("DELETE FROM geo_codes_history WHERE geo_code_id = :id");
                $stmtHist->bindParam(':id', $id, PDO::PARAM_INT);
                $stmtHist->execute();

                // 3. Les positions (geo_positions) et leur historique (geo_positions_history)
                // sont supprimées en cascade (ON DELETE CASCADE ou SET NULL) par les contraintes BDD
                
                $this->db->commit();
                return true;
            } else {
                $this->db->rollBack(); // Code non trouvé ou non "soft-deleted"
                return false;
            }
        } catch (Exception $e) {
             if ($this->db->inTransaction()) $this->db->rollBack();
            error_log("Erreur forceDeleteGeoCode (ID: $id): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Récupère l'historique pour un code géo spécifique.
     * @param int $geoCodeId ID du code géo.
     * @return array La liste des entrées d'historique.
     */
    public function getHistoryForGeoCode(int $geoCodeId): array {
        try {
            $sql = "SELECT * FROM geo_codes_history
                    WHERE geo_code_id = :geo_code_id
                    ORDER BY action_timestamp DESC";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            error_log("Erreur getHistoryForGeoCode (ID: $geoCodeId): " . $e->getMessage());
            return [];
        }
    }

    /**
     * Récupère l'historique global (limité aux 100 dernières actions).
     * @return array La liste des entrées d'historique.
     */
    public function getFullHistory(): array {
        try {
            $sql = "SELECT h.*, COALESCE(gc.code_geo, '(Supprimé)') as code_geo
                    FROM geo_codes_history h
                    LEFT JOIN geo_codes gc ON h.geo_code_id = gc.id
                    ORDER BY h.action_timestamp DESC
                    LIMIT 100";
            $stmt = $this->db->query($sql);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            error_log("Erreur getFullHistory: " . $e->getMessage());
            return [];
        }
    }

    // --- Gestion des Positions ---

     /**
     * Récupère toutes les positions pour un plan donné.
     * @param int $planId ID du plan.
     * @return array Liste des positions.
     */
    public function getPositionsForPlan(int $planId): array {
        try {
            $sql = "SELECT id AS position_id, geo_code_id, plan_id, pos_x, pos_y, width, height, anchor_x, anchor_y, properties
                    FROM geo_positions
                    WHERE plan_id = :plan_id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Erreur PDO dans getPositionsForPlan (planId: $planId): " . $e->getMessage());
            return [];
        }
    }

    /**
     * Récupère toutes les positions pour un plan donné AVEC les détails du code géo associé.
     * Utilisé pour initialiser l'éditeur de plan.
     * @param int $planId ID du plan.
     * @return array Liste des positions avec détails.
     */
    public function getPositionsForPlanWithDetails(int $planId): array {
        try {
            $sql = "SELECT
                        gp.id AS position_id, gp.geo_code_id, gp.plan_id, gp.pos_x, gp.pos_y,
                        gp.width, gp.height, gp.anchor_x, gp.anchor_y, gp.properties,
                        gc.code_geo, gc.libelle, gc.commentaire, gc.zone,
                        gc.univers_id, u.nom as univers_nom, u.color as univers_color
                    FROM geo_positions gp
                    JOIN geo_codes gc ON gp.geo_code_id = gc.id
                    LEFT JOIN univers u ON gc.univers_id = u.id
                    WHERE gp.plan_id = :plan_id
                      AND gc.deleted_at IS NULL"; // Ne charge que les positions des codes actifs
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Erreur PDO dans getPositionsForPlanWithDetails (planId: $planId): " . $e->getMessage());
            return [];
        }
    }

    /**
     * Ajoute ou met à jour la position d'un code géo sur un plan et enregistre l'historique.
     * @param int $geoCodeId
     * @param int $planId
     * @param float $posX Position X en %.
     * @param float $posY Position Y en %.
     * @param int|null $positionId ID de la position (geo_positions.id) si c'est un UPDATE.
     * @param int|null $width Largeur (optionnel)
     * @param int|null $height Hauteur (optionnel)
     * @param array|null $properties Propriétés JSON supplémentaires
     * @return int|false L'ID de la position (geo_positions.id) ou false en cas d'erreur.
     */
    public function setGeoCodePosition(int $geoCodeId, int $planId, float $posX, float $posY, ?int $positionId = null, ?int $width = null, ?int $height = null, ?array $properties = null): int|false {
        
        $propertiesJson = $properties ? json_encode($properties) : null;
        $this->db->beginTransaction();
        
        try {
            if ($positionId !== null && $positionId > 0) {
                // --- C'est un UPDATE (déplacement) ---
                // On met à jour la ligne existante basée sur son ID unique de position
                $sql = "UPDATE geo_positions 
                        SET pos_x = :pos_x, pos_y = :pos_y, width = :width, height = :height, properties = :properties, updated_at = NOW()
                        WHERE id = :position_id AND plan_id = :plan_id AND geo_code_id = :geo_code_id";
                
                $stmt = $this->db->prepare($sql);
                $stmt->bindParam(':pos_x', $posX);
                $stmt->bindParam(':pos_y', $posY);
                $stmt->bindValue(':width', $width, $width === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
                $stmt->bindValue(':height', $height, $height === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
                $stmt->bindValue(':properties', $propertiesJson, $propertiesJson === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $stmt->bindParam(':position_id', $positionId, PDO::PARAM_INT);
                $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
                $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);

                if ($stmt->execute()) {
                    // MODIFICATION: Passer le $positionId à l'historique
                    $this->logPositionHistory($geoCodeId, $planId, $positionId, $posX, $posY, 'moved');
                    $this->db->commit();
                    return $positionId; // Retourne l'ID existant
                }

            } else {
                // --- C'est un INSERT (nouveau placement) ---
                // On crée une nouvelle ligne
                $sql = "INSERT INTO geo_positions (geo_code_id, plan_id, pos_x, pos_y, width, height, properties, created_at, updated_at)
                        VALUES (:geo_code_id, :plan_id, :pos_x, :pos_y, :width, :height, :properties, NOW(), NOW())";
                
                $stmt = $this->db->prepare($sql);
                $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
                $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
                $stmt->bindParam(':pos_x', $posX);
                $stmt->bindParam(':pos_y', $posY);
                $stmt->bindValue(':width', $width, $width === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
                $stmt->bindValue(':height', $height, $height === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
                $stmt->bindValue(':properties', $propertiesJson, $propertiesJson === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

                if ($stmt->execute()) {
                    $lastId = (int)$this->db->lastInsertId();
                    // MODIFICATION: Passer le $lastId (nouvel ID) à l'historique
                    $this->logPositionHistory($geoCodeId, $planId, $lastId, $posX, $posY, 'placed');
                    $this->db->commit();
                    return $lastId; // Retourne le NOUVEL ID
                }
            }
            
            // Si l'exécution a échoué
            $this->lastError = $stmt->errorInfo();
            throw new PDOException("Erreur BDD setPosition: " . ($this->lastError[2] ?? 'Inconnue'), (int)($this->lastError[1] ?? 0));

        } catch (PDOException $e) {
            $this->db->rollBack();
            $this->lastError = $e->errorInfo ?? [$e->getCode(), null, $e->getMessage()];
            error_log("Erreur PDO setGeoCodePosition (geoCode: $geoCodeId, plan: $planId, posId: " . ($positionId ?? 'NULL') . "): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Supprime la position d'un code géo d'un plan spécifique et enregistre l'historique.
     * @param int $geoCodeId
     * @param int $planId
     * @param int|null $positionId L'ID unique de la position à supprimer
     * @return bool True si succès.
     */
    public function removeGeoCodePosition(int $geoCodeId, int $planId, ?int $positionId = null): bool {
        // MODIFICATION: On a besoin du positionId pour savoir QUEL repère supprimer
        if ($positionId === null || $positionId <= 0) {
             error_log("Tentative de suppression de geo_position sans positionId (geoCodeId: $geoCodeId, planId: $planId)");
             $this->lastError = [null, null, "ID de position manquant pour la suppression."];
             return false;
        }
        
        $this->db->beginTransaction();
        try {
            // Récupérer les infos AVANT de supprimer (pour le log)
            $stmtPos = $this->db->prepare("SELECT pos_x, pos_y FROM geo_positions WHERE id = :position_id");
            $stmtPos->bindParam(':position_id', $positionId, PDO::PARAM_INT);
            $stmtPos->execute();
            $posData = $stmtPos->fetch(PDO::FETCH_ASSOC);
            
            if (!$posData) {
                 // Le repère n'existe peut-être déjà plus, ce n'est pas une erreur fatale
                 $this->db->rollBack();
                 error_log("Tentative de suppression d'une positionId $positionId non trouvée.");
                 return false; 
            }

            // Supprimer en utilisant l'ID unique de la position
            $sql = "DELETE FROM geo_positions WHERE id = :position_id AND geo_code_id = :geo_code_id AND plan_id = :plan_id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':position_id', $positionId, PDO::PARAM_INT);
            $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
            $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);

            if ($stmt->execute()) {
                if ($stmt->rowCount() > 0) {
                     // Log avec le positionId
                     $this->logPositionHistory($geoCodeId, $planId, $positionId, $posData['pos_x'], $posData['pos_y'], 'removed');
                     $this->db->commit();
                     return true;
                } else {
                     $this->db->rollBack(); return false; // N'existait pas ou ne correspondait pas
                }
            } else {
                 $this->lastError = $stmt->errorInfo();
                 throw new PDOException("Erreur BDD removePosition: " . ($this->lastError[2] ?? 'Inconnue'), (int)($this->lastError[1] ?? 0));
            }
        } catch (Exception $e) { // Attrape Exception et PDOException
            $this->db->rollBack();
            $this->lastError = $this->db->errorInfo() ?? ['ERR', null, $e->getMessage()];
            error_log("Erreur PDO removeGeoCodePosition (posId: $positionId, geoCode: $geoCodeId, plan: $planId): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Récupère les codes géo actifs disponibles pour un plan donné.
     * (Codes des univers liés au plan)
     * @param int $planId L'ID du plan concerné.
     * @return array Liste des codes géo disponibles.
     */
    public function getAvailableCodesForPlan(int $planId): array {
        // 1. Récupérer les IDs des univers associés à ce plan
        $planUniversSql = "SELECT univers_id FROM plan_univers WHERE plan_id = :plan_id";
        $stmtUnivers = $this->db->prepare($planUniversSql);
        $stmtUnivers->bindParam(':plan_id', $planId, PDO::PARAM_INT);
        $stmtUnivers->execute();
        $universRows = $stmtUnivers->fetchAll(PDO::FETCH_ASSOC);
        $universIds = array_column($universRows, 'univers_id');

        if (empty($universIds)) {
            return []; // Aucun univers lié, donc aucun code dispo
        }

        // 2. Préparer les placeholders pour la clause IN des univers
        $inUnivers = str_repeat('?,', count($universIds) - 1) . '?';

        // 3. MODIFICATION: On sélectionne TOUS les codes des univers liés
        // La logique de placement multiple est gérée par le JS/Contrôleur.
        $sql = "SELECT gc.id, gc.code_geo, gc.libelle, gc.commentaire, gc.zone,
                       gc.univers_id, u.nom as univers_nom, u.color as univers_color
                FROM geo_codes gc
                JOIN univers u ON gc.univers_id = u.id
                WHERE gc.deleted_at IS NULL
                  AND gc.univers_id IN ($inUnivers)
                ORDER BY gc.code_geo ASC";
        
        // 4. Préparer les paramètres pour l'exécution
        $params = $universIds;

        try {
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (PDOException $e) {
            error_log("PDO Error in getAvailableCodesForPlan (planId: $planId): " . $e->getMessage());
             return []; // Retourner un tableau vide en cas d'erreur
        }
    }


    // --- Import / Export / Batch ---

    /**
     * Récupère une liste de codes géo actifs existants parmi ceux fournis.
     * @param array $codeGeoList Liste de strings (code_geo).
     * @return array Liste des code_geo qui existent déjà et sont actifs.
     */
    public function getExistingCodes(array $codeGeoList): array {
        if (empty($codeGeoList)) return [];
        $uniqueCodes = array_values(array_unique(array_filter($codeGeoList)));
        if (empty($uniqueCodes)) return [];
        $inPlaceholders = str_repeat('?,', count($uniqueCodes) - 1) . '?';
        $sql = "SELECT code_geo FROM geo_codes WHERE code_geo IN ($inPlaceholders) AND deleted_at IS NULL";
        try {
            $stmt = $this->db->prepare($sql);
            $stmt->execute($uniqueCodes);
            return $stmt->fetchAll(PDO::FETCH_COLUMN);
        } catch (PDOException $e) {
            error_log("Erreur getExistingCodes: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Récupère les codes géo actifs pour une liste d'IDs d'univers.
     * @param array $universIds Tableau d'IDs d'univers.
     * @return array La liste des codes géo correspondants.
     */
    public function getGeoCodesByUniversIds(array $universIds): array {
        if (empty($universIds)) return [];
        $inPlaceholders = str_repeat('?,', count($universIds) - 1) . '?';
        $sql = "SELECT gc.id, gc.code_geo, gc.libelle, gc.commentaire, u.nom AS univers
                FROM geo_codes gc
                LEFT JOIN univers u ON gc.univers_id = u.id
                WHERE gc.univers_id IN ($inPlaceholders) AND gc.deleted_at IS NULL
                ORDER BY u.nom, gc.code_geo ASC";
        try {
            $stmt = $this->db->prepare($sql);
            $stmt->execute($universIds);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Erreur getGeoCodesByUniversIds: " . $e->getMessage());
            $this->lastError = $this->db->errorInfo();
            return [];
        }
    }

    /**
     * Récupère les codes géo actifs filtrés pour l'export.
     * @param array $filters Filtres (zones, univers_ids).
     * @return array La liste des codes géo filtrés.
     */
    public function getFilteredGeoCodes(array $filters): array {
        $sql = "SELECT gc.code_geo, gc.libelle, gc.commentaire, gc.zone, u.nom AS univers
                FROM geo_codes gc
                LEFT JOIN univers u ON gc.univers_id = u.id
                WHERE gc.deleted_at IS NULL";
        $params = [];
        $conditions = [];
        if (!empty($filters['zones'])) {
            $zonePlaceholders = str_repeat('?,', count($filters['zones']) - 1) . '?';
            $conditions[] = "gc.zone IN ($zonePlaceholders)";
            $params = array_merge($params, $filters['zones']);
        }
        if (!empty($filters['univers_ids'])) {
             $universPlaceholders = str_repeat('?,', count($filters['univers_ids']) - 1) . '?';
             $conditions[] = "gc.univers_id IN ($universPlaceholders)";
             $params = array_merge($params, $filters['univers_ids']);
        }
        if (!empty($conditions)) $sql .= " AND " . implode(" AND ", $conditions);
        $sql .= " ORDER BY gc.code_geo ASC";
        try {
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Erreur getFilteredGeoCodes: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Ajoute plusieurs codes géo en lot (batch), avec historique.
     * @param array $codesToInsert [['code_geo', 'libelle', 'univers_id', 'zone', 'commentaire']]
     * @return array ['success' => count, 'errors' => [messages]]
     */
    public function createBatchGeoCodes(array $codesToInsert): array {
        $results = ['success' => 0, 'errors' => []];
        $sql = "INSERT INTO geo_codes (code_geo, libelle, univers_id, zone, commentaire, created_at, updated_at)
                VALUES (:code_geo, :libelle, :univers_id, :zone, :commentaire, NOW(), NOW())";
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare($sql);
            foreach ($codesToInsert as $codeData) {
                if ($this->codeGeoExists($codeData['code_geo'])) {
                    $results['errors'][] = "Code '" . htmlspecialchars($codeData['code_geo']) . "' existe déjà.";
                    continue;
                }
                // Bind parameters
                $stmt->bindParam(':code_geo', $codeData['code_geo']);
                $stmt->bindValue(':libelle', $codeData['libelle']);
                $stmt->bindParam(':univers_id', $codeData['univers_id'], PDO::PARAM_INT);
                $stmt->bindParam(':zone', $codeData['zone']);
                $stmt->bindValue(':commentaire', $codeData['commentaire']);

                if ($stmt->execute()) {
                    $lastId = $this->db->lastInsertId();
                    $this->logHistory($lastId, 'created', 'Ajout par lot');
                    $results['success']++;
                } else {
                    $errorInfo = $stmt->errorInfo();
                    $results['errors'][] = "Erreur BDD pour " . htmlspecialchars($codeData['code_geo']) . ": " . ($errorInfo[2] ?? '?');
                }
            }
            $this->db->commit();
        } catch (PDOException $e) {
             if ($this->db->inTransaction()) $this->db->rollBack();
             error_log("Erreur PDO createBatchGeoCodes: " . $e->getMessage());
             $results['errors'][] = "Erreur Transaction: " . $e->getMessage();
             $results['success'] = 0; // Annuler succès si transaction échoue
        }
        return $results;
    }

    /**
     * Crée plusieurs codes géo (import CSV), gère les univers, avec historique.
     * @param array $codesToInsert [['code_geo', 'libelle', 'univers'(nom), 'zone', 'commentaire']]
     * @param UniversManager $universManager
     * @return int|false Nombre inséré ou false si erreur transaction.
     */
    public function createMultipleGeoCodes(array $codesToInsert, UniversManager $universManager): int|false {
        $insertedCount = 0;
        $sql = "INSERT INTO geo_codes (code_geo, libelle, univers_id, zone, commentaire, created_at, updated_at)
                VALUES (:code_geo, :libelle, :univers_id, :zone, :commentaire, NOW(), NOW())";
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare($sql);
            $universCache = [];
            foreach ($codesToInsert as $codeData) {
                // Gérer l'univers (création si inexistant)
                $universName = trim($codeData['univers'] ?? 'Indéfini');
                if (empty($universName)) $universName = 'Indéfini';
                $universId = $universCache[$universName]['id'] ?? null;
                $universZone = $universCache[$universName]['zone_assignee'] ?? null;
                if ($universId === null) {
                    $univers = $universManager->getUniversByName($universName);
                    if ($univers) {
                        $universId = $univers['id']; $universZone = $univers['zone_assignee'];
                        $universCache[$universName] = $univers;
                    } else {
                        // Créer l'univers
                        $zoneForNewUnivers = strtolower($codeData['zone'] ?? 'vente');
                        if (!in_array($zoneForNewUnivers, ['vente', 'reserve'])) $zoneForNewUnivers = 'vente';
                        
                        $newUniversId = $universManager->addUnivers($universName, $zoneForNewUnivers, null); // Couleur par défaut
                        if (!$newUniversId) {
                            error_log("Échec création univers '$universName' pour import."); continue;
                        }
                        $universId = $newUniversId;
                        $universZone = $zoneForNewUnivers;
                        $universCache[$universName] = ['id' => $universId, 'zone_assignee' => $universZone];
                    }
                }

                // Déterminer la zone
                $zone = strtolower($codeData['zone'] ?? $universZone ?? 'vente');
                if (!in_array($zone, ['vente', 'reserve'])) $zone = 'vente';

                // Bind parameters
                $stmt->bindParam(':code_geo', $codeData['code_geo']);
                $stmt->bindValue(':libelle', $codeData['libelle']);
                $stmt->bindParam(':univers_id', $universId, PDO::PARAM_INT);
                $stmt->bindParam(':zone', $zone);
                $stmt->bindValue(':commentaire', $codeData['commentaire']);

                if ($stmt->execute()) {
                    $lastId = $this->db->lastInsertId();
                    $this->logHistory($lastId, 'created', 'Import CSV');
                    $insertedCount++;
                } else {
                    $errorInfo = $stmt->errorInfo();
                    error_log("Échec insertion CSV pour " . $codeData['code_geo'] . ": " . ($errorInfo[2] ?? '?'));
                }
            }
            $this->db->commit();
        } catch (PDOException | Exception $e) { // Attrape PDO et autres exceptions
            if ($this->db->inTransaction()) $this->db->rollBack();
            error_log("Erreur Transaction createMultipleGeoCodes: " . $e->getMessage());
            $this->lastError = $this->db->errorInfo() ?? [$e->getCode(), null, $e->getMessage()];
            return false;
        }
        return $insertedCount;
    }

    // --- Fonctions Utilitaires ---

    /**
     * Vérifie si un code géo ACTIF existe déjà.
     * @param string $codeGeo Le code géo à vérifier.
     * @param int|null $excludeId ID à exclure (pour les mises à jour).
     * @return bool True si le code existe, false sinon.
     */
    public function codeGeoExists(string $codeGeo, ?int $excludeId = null): bool {
        $sql = "SELECT COUNT(*) FROM geo_codes WHERE code_geo = :code_geo AND deleted_at IS NULL";
        $params = [':code_geo' => $codeGeo];
        if ($excludeId !== null) {
            $sql .= " AND id != :exclude_id";
            $params[':exclude_id'] = $excludeId;
        }
        try {
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            return $stmt->fetchColumn() > 0;
        } catch (PDOException $e) {
            error_log("Erreur codeGeoExists pour '$codeGeo': ".$e->getMessage());
            return false; 
        }
    }

    /**
     * Enregistre une action dans la table d'historique des codes géo.
     * @param int $geoCodeId
     * @param string $actionType 'created', 'updated', 'deleted', 'restored'
     * @param string|null $details Détails sur les modifications (pour 'updated')
     */
    private function logHistory(int $geoCodeId, string $actionType, ?string $details = null): void {
        try {
            // Utilise le nom de table correct de votre SQL
            $sql = "INSERT INTO geo_codes_history (geo_code_id, action_type, details, action_timestamp)
                    VALUES (:geo_code_id, :action_type, :details, NOW())";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
            $stmt->bindParam(':action_type', $actionType);
            $stmt->bindValue(':details', $details, $details === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->execute();
        } catch (Exception $e) {
            error_log("Erreur logHistory pour geo_code_id $geoCodeId: " . $e->getMessage());
        }
    }

    /**
     * Enregistre une action dans la table d'historique des positions géo.
     * @param int $geoCodeId
     * @param int $planId
     * @param int|null $positionId ID de la position (geo_positions.id)
     * @param float|null $posX Position X (ou null si 'removed')
     * @param float|null $posY Position Y (ou null si 'removed')
     * @param string $actionType 'placed', 'moved', 'removed'
     */
    private function logPositionHistory(int $geoCodeId, int $planId, ?int $positionId, ?float $posX, ?float $posY, string $actionType): void {
         try {
             // MODIFICATION: Ajout de la colonne 'position_id'
             // (Cette requête échouera si la BDD n'est pas mise à jour)
             $sql = "INSERT INTO geo_positions_history (geo_code_id, plan_id, position_id, pos_x, pos_y, action_type, action_timestamp)
                     VALUES (:geo_code_id, :plan_id, :position_id, :pos_x, :pos_y, :action_type, NOW())";
             $stmt = $this->db->prepare($sql);
             $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
             $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
             $stmt->bindValue(':position_id', $positionId, $positionId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
             $stmt->bindValue(':pos_x', $posX);
             $stmt->bindValue(':pos_y', $posY);
             $stmt->bindParam(':action_type', $actionType);
             $stmt->execute();
         } catch (Exception $e) {
             error_log("Erreur logPositionHistory (posId $positionId, géoId $geoCodeId, planId $planId): " . $e->getMessage());
         }
    }

    /**
     * Retourne les dernières informations d'erreur PDO enregistrées par le manager.
     * @return array|null
     */
    public function getLastError(): ?array {
        return $this->lastError;
    }

}

