<?php
// Fichier: models/GeoCodeManager.php

class GeoCodeManager {
    private $db;
    private $lastError; // Pour stocker la dernière erreur

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    // --- Méthodes existantes (inchangées) ---

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
        $stmt = $this->db->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
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
     * Compte le nombre total de placements de codes géo sur tous les plans.
     * @return int Le nombre total d'entrées dans la table geo_positions.
     */
    public function countPlacedCodes(): int {
        try {
            // Compte distinctement les geo_code_id présents dans geo_positions
            // pour ne compter qu'une fois un code même s'il est sur plusieurs plans
            $stmt = $this->db->query("SELECT COUNT(DISTINCT geo_code_id) FROM geo_positions");
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
                WHERE gc.id = :id"; // Ne filtre pas deleted_at ici pour pouvoir le voir même depuis la corbeille
        $stmt = $this->db->prepare($sql);
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

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
            // ... (bindParam/bindValue comme avant) ...
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
         // Récupérer les anciennes valeurs pour comparaison
         $oldData = $this->getGeoCodeById($id);
         if (!$oldData) return false; // Code non trouvé

        $sql = "UPDATE geo_codes
                SET code_geo = :code_geo, libelle = :libelle, univers_id = :univers_id,
                    commentaire = :commentaire, zone = :zone, updated_at = NOW()
                WHERE id = :id AND deleted_at IS NULL"; // Assurer qu'on met à jour un code actif

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare($sql);
            // ... (bindParam/bindValue comme avant) ...
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':code_geo', $codeGeo);
            $stmt->bindValue(':libelle', $libelle, $libelle === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindParam(':univers_id', $universId, PDO::PARAM_INT);
            $stmt->bindValue(':commentaire', $commentaire, $commentaire === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindValue(':zone', $zone, $zone === null ? PDO::PARAM_NULL : PDO::PARAM_STR);


            if ($stmt->execute()) {
                if ($stmt->rowCount() > 0) {
                     // Comparer les changements pour les détails de l'historique
                     $changes = [];
                     if ($oldData['code_geo'] !== $codeGeo) $changes[] = "CodeGeo: '{$oldData['code_geo']}' -> '$codeGeo'";
                     if ($oldData['libelle'] !== $libelle) $changes[] = "Libellé changé"; // Simplifié
                     if ($oldData['univers_id'] !== $universId) $changes[] = "Univers changé"; // Simplifié
                     if ($oldData['commentaire'] !== $commentaire) $changes[] = "Commentaire changé"; // Simplifié
                     if ($oldData['zone'] !== $zone) $changes[] = "Zone: '{$oldData['zone']}' -> '$zone'";

                     $this->logHistory($id, 'updated', implode('; ', $changes));
                     $this->db->commit();
                     return true;
                } else {
                     // Aucune ligne affectée (peut-être ID inexistant ou déjà supprimé)
                     $this->db->rollBack();
                     return false;
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
                 // Code non trouvé ou déjà supprimé
                 $this->db->rollBack();
                 return false;
            }
        } catch (Exception $e) {
             $this->db->rollBack();
            error_log("Erreur deleteGeoCode (soft delete) (ID: $id): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Récupère les codes géo qui sont dans la corbeille (soft-deleted).
     * @return array La liste des codes géo supprimés.
     */
    public function getDeletedGeoCodes(): array {
         // ... (code inchangé) ...
        $sql = "SELECT gc.*, u.nom AS univers_nom
                FROM geo_codes gc
                LEFT JOIN univers u ON gc.univers_id = u.id
                WHERE gc.deleted_at IS NOT NULL
                ORDER BY gc.deleted_at DESC";
        $stmt = $this->db->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
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
            if (!$codeToRestore) { /* ... erreur ... */ return false; }
            if ($this->codeGeoExists($codeToRestore)) { /* ... erreur duplicata ... */ return false; }

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
     * L'historique associé est conservé grâce à ON DELETE CASCADE sur la FK dans la table history (si défini comme ça).
     * @param int $id ID du code géo.
     * @return bool True si succès.
     */
    public function forceDeleteGeoCode(int $id): bool {
        // Pas besoin de transaction ici, une seule requête
        try {
            // Supprime uniquement s'il est bien marqué comme supprimé
            $stmtCode = $this->db->prepare("DELETE FROM geo_codes WHERE id = :id AND deleted_at IS NOT NULL");
            $stmtCode->bindParam(':id', $id, PDO::PARAM_INT);
            $stmtCode->execute();
            // L'historique n'est PAS mis à jour ici car l'enregistrement disparaît.
            return $stmtCode->rowCount() > 0;
        } catch (Exception $e) {
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
        // ... (code inchangé) ...
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
         // ... (code inchangé) ...
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
                      AND gc.deleted_at IS NULL"; // Important: Ne charge que les positions des codes actifs
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
     * Ajoute ou met à jour la position d'un code géo sur un plan.
     * @param int $geoCodeId
     * @param int $planId
     * @param float $posX Position X en %.
     * @param float $posY Position Y en %.
     * @param int|null $width Largeur (optionnel, stocké en pixels ? ou % ?)
     * @param int|null $height Hauteur (optionnel, stocké en pixels ? ou % ?)
     * @param array|null $properties Propriétés JSON supplémentaires (style, etc.)
     * @return int|false L'ID de la position (geo_positions.id) ou false en cas d'erreur.
     */
    public function setGeoCodePosition(int $geoCodeId, int $planId, float $posX, float $posY, ?int $width = null, ?int $height = null, ?array $properties = null): int|false {
        // Utilisation de INSERT ... ON DUPLICATE KEY UPDATE pour gérer l'ajout et la mise à jour
        $sql = "INSERT INTO geo_positions (geo_code_id, plan_id, pos_x, pos_y, width, height, properties, created_at, updated_at)
                VALUES (:geo_code_id, :plan_id, :pos_x, :pos_y, :width, :height, :properties, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    pos_x = VALUES(pos_x),
                    pos_y = VALUES(pos_y),
                    width = VALUES(width),
                    height = VALUES(height),
                    properties = VALUES(properties),
                    updated_at = NOW()";

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare($sql);
            $propertiesJson = $properties ? json_encode($properties) : null;

            $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
            $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
            $stmt->bindParam(':pos_x', $posX); // PDO::PARAM_STR par défaut convient pour FLOAT
            $stmt->bindParam(':pos_y', $posY);
            $stmt->bindValue(':width', $width, $width === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $stmt->bindValue(':height', $height, $height === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $stmt->bindValue(':properties', $propertiesJson, $propertiesJson === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

            if ($stmt->execute()) {
                // Pour récupérer l'ID, que ce soit un INSERT ou un UPDATE sur MySQL:
                // lastInsertId() fonctionne pour INSERT. Pour UPDATE, il faut re-sélectionner.
                // On peut simplifier en ne retournant que true/false, ou faire une requête SELECT après.
                $positionId = $this->db->lastInsertId();
                 if ($positionId == 0) { // Cela signifie probablement que c'était un UPDATE
                     // Récupérer l'ID existant
                     $selectStmt = $this->db->prepare("SELECT id FROM geo_positions WHERE geo_code_id = :geo_code_id AND plan_id = :plan_id");
                     $selectStmt->execute([':geo_code_id' => $geoCodeId, ':plan_id' => $planId]);
                     $positionId = $selectStmt->fetchColumn();
                 }

                // Enregistrer l'historique du placement/déplacement
                $this->logPositionHistory($geoCodeId, $planId, $posX, $posY, ($positionId == $this->db->lastInsertId() && $this->db->lastInsertId() != 0) ? 'placed' : 'moved');

                $this->db->commit();
                return $positionId ?: false; // Retourne l'ID ou false si l'ID n'a pas pu être récupéré après UPDATE
            } else {
                $this->lastError = $stmt->errorInfo();
                throw new PDOException("Erreur BDD (non-exception) lors du setPosition: " . ($this->lastError[2] ?? 'Inconnue'), (int)($this->lastError[1] ?? 0));
            }
        } catch (PDOException $e) {
            $this->db->rollBack();
            $this->lastError = $e->errorInfo ?? [$e->getCode(), null, $e->getMessage()];
            error_log("Erreur PDO setGeoCodePosition (geoCode: $geoCodeId, plan: $planId): " . $e->getMessage());
            return false;
        }
    }


    /**
     * Supprime la position d'un code géo d'un plan spécifique.
     * @param int $geoCodeId
     * @param int $planId
     * @return bool True si succès.
     */
    public function removeGeoCodePosition(int $geoCodeId, int $planId): bool {
        $this->db->beginTransaction();
        try {
            $sql = "DELETE FROM geo_positions WHERE geo_code_id = :geo_code_id AND plan_id = :plan_id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
            $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);

            if ($stmt->execute()) {
                if ($stmt->rowCount() > 0) {
                     // Enregistrer l'historique de la suppression
                     $this->logPositionHistory($geoCodeId, $planId, null, null, 'removed');
                     $this->db->commit();
                     return true;
                } else {
                     // Aucune ligne supprimée (n'existait peut-être pas)
                     $this->db->rollBack(); // Ou commit() si on ne considère pas ça comme une erreur
                     return false; // Indique que rien n'a été fait
                }
            } else {
                 $this->lastError = $stmt->errorInfo();
                 throw new PDOException("Erreur BDD (non-exception) lors du removePosition: " . ($this->lastError[2] ?? 'Inconnue'), (int)($this->lastError[1] ?? 0));
            }
        } catch (PDOException $e) {
            $this->db->rollBack();
            $this->lastError = $e->errorInfo ?? [$e->getCode(), null, $e->getMessage()];
            error_log("Erreur PDO removeGeoCodePosition (geoCode: $geoCodeId, plan: $planId): " . $e->getMessage());
            return false;
        }
    }


    // --- Fin Gestion des Positions ---

    /**
     * Récupère TOUTES les positions de TOUS les codes géo. (Dupliquée, déjà présente plus haut)
     * @return array Liste de toutes les positions.
     */
    // public function getAllPositions(): array { ... }

    /**
     * Récupère les codes géo (actifs) disponibles pour un plan donné. (Dupliquée)
     * @param int $planId L'ID du plan concerné.
     * @return array Liste des codes géo disponibles.
     */
    // public function getAvailableCodesForPlan(int $planId): array { ... }

    /**
     * Vérifie si un code géo ACTIF existe déjà. (Dupliquée)
     * @param string $codeGeo Le code géo à vérifier.
     * @param int|null $excludeId ID à exclure (pour les mises à jour).
     * @return bool True si le code existe, false sinon.
     */
    // public function codeGeoExists(string $codeGeo, ?int $excludeId = null): bool { ... }

    /**
     * Récupère une liste de codes géo actifs existants parmi ceux fournis. (Dupliquée)
     * @param array $codeGeoList Liste de strings (code_geo).
     * @return array Liste des code_geo qui existent déjà et sont actifs.
     */
    // public function getExistingCodes(array $codeGeoList): array { ... }

    /**
     * Récupère un code géo actif par son nom (code_geo). (Dupliquée)
     * @param string $codeGeo Le code géo exact.
     * @return array|false Les données du code géo ou false.
     */
     // public function getGeoCodeByCode(string $codeGeo) { ... }

    /**
     * Récupère les codes géo actifs pour une liste d'IDs d'univers. (Dupliquée)
     * @param array $universIds Tableau d'IDs d'univers.
     * @return array La liste des codes géo correspondants.
     */
    // public function getGeoCodesByUniversIds(array $universIds): array { ... }

    /**
     * Récupère les codes géo actifs filtrés pour l'export. (Dupliquée)
     * @param array $filters Filtres (zones, univers_ids).
     * @return array La liste des codes géo filtrés.
     */
    // public function getFilteredGeoCodes(array $filters): array { ... }


    /**
     * Ajoute plusieurs codes géo en lot (batch). (Dupliquée)
     * @param array $codesToInsert
     * @return array
     */
    // public function createBatchGeoCodes(array $codesToInsert): array { ... }

    /**
     * Crée plusieurs codes géo (import CSV). (Dupliquée)
     * @param array $codesToInsert
     * @param UniversManager $universManager
     * @return int|false
     */
    // public function createMultipleGeoCodes(array $codesToInsert, UniversManager $universManager): int|false { ... }

    /**
     * Enregistre une action dans la table d'historique des codes géo.
     * @param int $geoCodeId
     * @param string $actionType 'created', 'updated', 'deleted', 'restored'
     * @param string|null $details Détails sur les modifications (pour 'updated')
     */
    private function logHistory(int $geoCodeId, string $actionType, ?string $details = null): void {
        try {
            $sql = "INSERT INTO geo_codes_history (geo_code_id, action_type, details, action_timestamp)
                    VALUES (:geo_code_id, :action_type, :details, NOW())";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
            $stmt->bindParam(':action_type', $actionType);
            $stmt->bindValue(':details', $details, $details === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->execute();
        } catch (Exception $e) {
            error_log("Erreur logHistory pour geo_code_id $geoCodeId: " . $e->getMessage());
            // Ne pas bloquer l'opération principale pour une erreur de log
        }
    }

    /**
     * Enregistre une action dans la table d'historique des positions géo.
     * @param int $geoCodeId
     * @param int $planId
     * @param float|null $posX Position X (ou null si 'removed')
     * @param float|null $posY Position Y (ou null si 'removed')
     * @param string $actionType 'placed', 'moved', 'removed'
     */
    private function logPositionHistory(int $geoCodeId, int $planId, ?float $posX, ?float $posY, string $actionType): void {
         try {
             $sql = "INSERT INTO geo_positions_history (geo_code_id, plan_id, pos_x, pos_y, action_type, action_timestamp)
                     VALUES (:geo_code_id, :plan_id, :pos_x, :pos_y, :action_type, NOW())";
             $stmt = $this->db->prepare($sql);
             $stmt->bindParam(':geo_code_id', $geoCodeId, PDO::PARAM_INT);
             $stmt->bindParam(':plan_id', $planId, PDO::PARAM_INT);
             $stmt->bindValue(':pos_x', $posX); // Null si action = removed
             $stmt->bindValue(':pos_y', $posY); // Null si action = removed
             $stmt->bindParam(':action_type', $actionType);
             $stmt->execute();
         } catch (Exception $e) {
             error_log("Erreur logPositionHistory pour geo_code_id $geoCodeId, plan_id $planId: " . $e->getMessage());
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
