<?php
// Fichier: models/GeoCodeManager.php

class GeoCodeManager {
    private $db;
    private $lastError; // Ajout pour stocker la dernière erreur

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Récupère tous les codes géo avec leurs informations d'univers.
     * @return array La liste des codes géo.
     */
    public function getAllGeoCodes(): array {
        $sql = "SELECT gc.*, u.nom AS univers_nom, u.color AS univers_color
                FROM geo_codes gc
                LEFT JOIN univers u ON gc.univers_id = u.id
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
            // Modifié pour exclure les soft-deleted
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
            $stmt = $this->db->query("SELECT COUNT(*) FROM geo_positions");
            $count = $stmt->fetchColumn();
            return ($count !== false) ? (int)$count : 0;
        } catch (Exception $e) {
            error_log("Erreur countPlacedCodes: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Compte le nombre de codes géo par zone (excluant soft-deleted).
     * @return array Tableau associatif ['Nom de la Zone' => count, ...].
     */
    public function countCodesByZone(): array {
        $counts = [];
        try {
            // Utilise COALESCE et NULLIF pour regrouper les zones vides/NULL
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
     * Compte le nombre de codes géo pour chaque univers (excluant soft-deleted).
     * @return array Tableau associatif ['Nom de l'Univers' => count, ...].
     */
    public function getCodesCountByUnivers(): array {
        $counts = [];
        try {
            // Jointure pour obtenir le nom de l'univers et GROUP BY pour compter
            $sql = "SELECT u.nom AS univers_nom, COUNT(gc.id) AS count
                    FROM geo_codes gc
                    JOIN univers u ON gc.univers_id = u.id
                    WHERE gc.deleted_at IS NULL
                    GROUP BY u.nom
                    ORDER BY u.nom ASC";
            $stmt = $this->db->query($sql);

            // Récupère les résultats sous forme [univers_nom => count]
            $results = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

            // S'assurer que les comptes sont des entiers
            if ($results !== false) {
                foreach ($results as $univers => $count) {
                    $counts[$univers] = (int)$count;
                }
            }

        } catch (Exception $e) {
            error_log("Erreur getCodesCountByUnivers: " . $e->getMessage());
            $counts['__ErreurExecution__'] = 0; // Indication d'erreur pour le debug
        }
        return $counts;
    }


    /**
     * Récupère les N derniers codes géo ajoutés ou mis à jour (excluant soft-deleted).
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
     * Récupère les codes géo qui n'ont jamais été placés sur aucun plan (excluant soft-deleted).
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
     * Ajoute un nouveau code géo.
     * @param string $codeGeo Le code géo unique.
     * @param string|null $libelle Le libellé.
     * @param int $universId L'ID de l'univers associé.
     * @param string|null $commentaire Commentaire.
     * @param string|null $zone Zone ('vente' ou 'reserve').
     * @return int|false L'ID du code géo créé ou false en cas d'erreur (ex: code dupliqué).
     */
    public function addGeoCode(string $codeGeo, ?string $libelle, int $universId, ?string $commentaire, ?string $zone) {
        // Vérifie si un code ACTIF existe déjà
        if ($this->codeGeoExists($codeGeo)) {
             error_log("Tentative d'ajout d'un code géo actif dupliqué: " . $codeGeo);
            return false;
        }

        $sql = "INSERT INTO geo_codes (code_geo, libelle, univers_id, commentaire, zone, created_at, updated_at)
                VALUES (:code_geo, :libelle, :univers_id, :commentaire, :zone, NOW(), NOW())";
        $stmt = $this->db->prepare($sql);
        $stmt->bindParam(':code_geo', $codeGeo);
        $stmt->bindValue(':libelle', $libelle, $libelle === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindParam(':univers_id', $universId, PDO::PARAM_INT);
        $stmt->bindValue(':commentaire', $commentaire, $commentaire === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(':zone', $zone, $zone === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

        // --- AJOUT TRY-CATCH ---
        try {
            if ($stmt->execute()) {
                return (int)$this->db->lastInsertId();
            } else {
                // Erreur autre que PDOException (moins probable)
                $this->lastError = $stmt->errorInfo();
                error_log("Erreur BDD (non-exception) lors de l'ajout du code géo: " . print_r($this->lastError, true));
                return false;
            }
        } catch (PDOException $e) {
            // Vérifie si c'est une erreur de contrainte d'unicité (code 23000)
            if ($e->getCode() === '23000') {
                 error_log("Erreur BDD : Tentative d'ajout d'un code géo dupliqué (possiblement soft-deleted) : " . $codeGeo . " - " . $e->getMessage());
                 return false; // Renvoie false pour les duplicatas
            } else {
                 // Pour les autres erreurs PDO, log et re-lance (ou retourne false)
                 error_log("Erreur PDO lors de l'ajout du code géo: " . $e->getMessage());
                 $this->lastError = $this->db->errorInfo();
                 // throw $e; // Optionnel: Re-lancer l'exception si le contrôleur doit savoir
                 return false; // Ou simplement retourner false
            }
        }
        // --- FIN TRY-CATCH ---
    }


    /**
     * Met à jour un code géo existant.
     * Gère également l'erreur de duplicata lors de la mise à jour.
     * @param int $id ID du code géo.
     * @param string $codeGeo Le code géo unique.
     * @param string|null $libelle Le libellé.
     * @param int $universId L'ID de l'univers associé.
     * @param string|null $commentaire Commentaire.
     * @param string|null $zone Zone ('vente' ou 'reserve').
     * @return bool True si succès, false sinon (ex: code dupliqué).
     */
    public function updateGeoCode(int $id, string $codeGeo, ?string $libelle, int $universId, ?string $commentaire, ?string $zone): bool {
         // Vérifie si le NOUVEAU code existe déjà pour un AUTRE ID
         if ($this->codeGeoExists($codeGeo, $id)) {
             error_log("Tentative de mise à jour vers un code géo actif dupliqué: " . $codeGeo);
             return false;
         }

        $sql = "UPDATE geo_codes
                SET code_geo = :code_geo, libelle = :libelle, univers_id = :univers_id,
                    commentaire = :commentaire, zone = :zone, updated_at = NOW()
                WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->bindParam(':code_geo', $codeGeo);
        $stmt->bindValue(':libelle', $libelle, $libelle === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindParam(':univers_id', $universId, PDO::PARAM_INT);
        $stmt->bindValue(':commentaire', $commentaire, $commentaire === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(':zone', $zone, $zone === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

        // --- AJOUT TRY-CATCH ---
        try {
            $success = $stmt->execute();
            if (!$success) {
                $this->lastError = $stmt->errorInfo();
                error_log("Erreur BDD (non-exception) lors de la MAJ du code géo ID $id: " . print_r($this->lastError, true));
            }
            return $success;
        } catch (PDOException $e) {
             if ($e->getCode() === '23000') {
                 error_log("Erreur BDD : Tentative de MAJ vers un code géo dupliqué (possiblement soft-deleted) : " . $codeGeo . " - " . $e->getMessage());
                 return false;
             } else {
                 error_log("Erreur PDO lors de la MAJ du code géo ID $id: " . $e->getMessage());
                 $this->lastError = $this->db->errorInfo();
                 return false;
             }
        }
        // --- FIN TRY-CATCH ---
    }


    /**
     * Effectue un soft delete (met à la corbeille).
     * @param int $id ID du code géo.
     * @return bool True si succès.
     */
    public function deleteGeoCode(int $id): bool {
        try {
            // Met à jour deleted_at au lieu de supprimer
            $sql = "UPDATE geo_codes SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            // Retourne true si une ligne a été affectée
            return $stmt->rowCount() > 0;
        } catch (Exception $e) {
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
        $stmt = $this->db->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Restaure un code géo depuis la corbeille (annule le soft delete).
     * Vérifie si un code ACTIF avec le même 'code_geo' existe avant de restaurer.
     * @param int $id ID du code géo à restaurer.
     * @return bool True si succès.
     */
    public function restoreGeoCode(int $id): bool {
         try {
            // 1. Récupérer le code_geo de l'élément à restaurer
            $stmtCheck = $this->db->prepare("SELECT code_geo FROM geo_codes WHERE id = :id AND deleted_at IS NOT NULL");
            $stmtCheck->bindParam(':id', $id, PDO::PARAM_INT);
            $stmtCheck->execute();
            $codeToRestore = $stmtCheck->fetchColumn();

            if (!$codeToRestore) {
                error_log("Tentative de restauration d'un code ID $id non trouvé ou non supprimé.");
                return false; // Code non trouvé ou pas dans la corbeille
            }

            // 2. Vérifier si un code ACTIF avec le même code_geo existe DÉJÀ
            if ($this->codeGeoExists($codeToRestore)) {
                 error_log("Impossible de restaurer le code ID $id car le code_geo '$codeToRestore' existe déjà activement.");
                 $this->lastError = ['23000', null, "Un code actif '$codeToRestore' existe déjà."]; // Simule une erreur de duplicata
                 return false; // Un code actif existe déjà
            }

            // 3. Procéder à la restauration
            $sql = "UPDATE geo_codes SET deleted_at = NULL, updated_at = NOW() WHERE id = :id AND deleted_at IS NOT NULL";
            $stmt = $this->db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->rowCount() > 0;
        } catch (Exception $e) {
            error_log("Erreur restoreGeoCode (ID: $id): " . $e->getMessage());
            return false;
        }
    }


    /**
     * Supprime définitivement un code géo de la BDD (utilisé depuis la corbeille).
     * @param int $id ID du code géo.
     * @return bool True si succès.
     */
    public function forceDeleteGeoCode(int $id): bool {
        $this->db->beginTransaction();
        try {
            // On s'assure que les dépendances (positions, history) sont gérées (ON DELETE CASCADE)
            // Supprime uniquement s'il est bien marqué comme supprimé
            $stmtCode = $this->db->prepare("DELETE FROM geo_codes WHERE id = :id AND deleted_at IS NOT NULL");
            $stmtCode->bindParam(':id', $id, PDO::PARAM_INT);
            $deleted = $stmtCode->execute();

            if (!$deleted) {
                 // Soit l'ID n'existe pas, soit il n'était pas dans la corbeille
                 // On peut considérer ça comme une non-erreur et commit quand même
                 // ou rollback si on veut être strict. Ici, on commit.
                 // throw new Exception("Code non trouvé ou non supprimé pour suppression définitive.");
            }

            $this->db->commit();
            // Retourne true si une ligne a été affectée par DELETE
            return $stmtCode->rowCount() > 0;
        } catch (Exception $e) {
            $this->db->rollBack();
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
             // Jointure pour récupérer le code_geo même s'il a été supprimé
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

    /**
     * Récupère tous les codes géo (actifs) AVEC leurs positions groupées.
     * @return array Liste des codes géo, chacun avec une clé 'placements'.
     */
    public function getAllGeoCodesWithPositions(): array {
        // 1. Récupère les codes actifs
         $sqlCodes = "SELECT gc.*, u.nom AS univers_nom, u.color AS univers_color
                FROM geo_codes gc
                LEFT JOIN univers u ON gc.univers_id = u.id
                WHERE gc.deleted_at IS NULL
                ORDER BY gc.code_geo ASC";
        $stmtCodes = $this->db->query($sqlCodes);
        $codes = $stmtCodes->fetchAll(PDO::FETCH_ASSOC);

        // 2. Récupère toutes les positions
        $positions = $this->getAllPositions();

        // 3. Assemble les données
        $codesById = [];
        foreach ($codes as $code) {
            $code['placements'] = [];
            $codesById[$code['id']] = $code;
        }
        foreach ($positions as $pos) {
            if (isset($codesById[$pos['geo_code_id']])) {
                $codesById[$pos['geo_code_id']]['placements'][] = $pos;
            } else {
                 // La position est liée à un code géo supprimé ou inexistant
                 // error_log("Position orpheline (ou liée à un code supprimé) trouvée: position_id=" . $pos['position_id'] . ", geo_code_id=" . $pos['geo_code_id']);
                 // On ignore simplement cette position plutôt que de logger une erreur fréquente
            }
        }
        return array_values($codesById);
    }

    /**
     * Récupère TOUTES les positions de TOUS les codes géo.
     * @return array Liste de toutes les positions.
     */
    public function getAllPositions(): array {
        try {
            $stmt = $this->db->query("SELECT id AS position_id, geo_code_id, plan_id, pos_x, pos_y, width, height, anchor_x, anchor_y
                                  FROM geo_positions ORDER BY plan_id, geo_code_id");
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
             error_log("Erreur PDO dans getAllPositions: " . $e->getMessage());
             return [];
        }
    }


    /**
     * Récupère les codes géo (actifs) disponibles pour un plan donné.
     * (Codes des univers liés au plan, qui ne sont pas DÉJÀ sur ce plan)
     * @param int $planId L'ID du plan concerné.
     * @return array Liste des codes géo disponibles.
     */
    public function getAvailableCodesForPlan(int $planId): array {
        // 1. Récupérer les IDs des univers associés à ce plan
        $planUniversSql = "SELECT univers_id FROM plan_univers WHERE plan_id = :plan_id";
        $stmtUnivers = $this->db->prepare($planUniversSql);
        $stmtUnivers->execute(['plan_id' => $planId]);
        $universRows = $stmtUnivers->fetchAll(PDO::FETCH_ASSOC);
        $universIds = array_column($universRows, 'univers_id');

        if (empty($universIds)) {
            return []; // Aucun univers lié, donc aucun code dispo
        }

        // 2. Préparer les placeholders pour la clause IN des univers
        $inUnivers = str_repeat('?,', count($universIds) - 1) . '?';

        // 3. Construire la requête SQL principale
        $sql = "SELECT gc.id, gc.code_geo, gc.libelle, gc.commentaire, gc.zone,
                       gc.univers_id, u.nom as univers_nom, u.color as univers_color
                FROM geo_codes gc
                JOIN univers u ON gc.univers_id = u.id
                WHERE gc.deleted_at IS NULL
                  AND gc.univers_id IN ($inUnivers)
                  AND NOT EXISTS (
                      SELECT 1
                      FROM geo_positions gp
                      WHERE gp.geo_code_id = gc.id
                        AND gp.plan_id = ?
                  )
                ORDER BY gc.code_geo ASC";

        // 4. Préparer les paramètres pour l'exécution
        $params = array_merge($universIds, [$planId]);

        try {
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
        } catch (PDOException $e) {
            error_log("PDO Error in getAvailableCodesForPlan: " . $e->getMessage());
             // En production, on ne devrait pas faire die()
             // throw new RuntimeException("Erreur lors de la récupération des codes disponibles.");
             return []; // Retourner un tableau vide en cas d'erreur
        }

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return $results ?: [];
    }

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
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn() > 0;
    }

    /**
     * Récupère une liste de codes géo actifs existants parmi ceux fournis.
     * @param array $codeGeoList Liste de strings (code_geo).
     * @return array Liste des code_geo qui existent déjà et sont actifs.
     */
    public function getExistingCodes(array $codeGeoList): array {
        if (empty($codeGeoList)) {
            return [];
        }
        $uniqueCodes = array_unique(array_filter($codeGeoList)); // Nettoyer et dédoublonner
        if (empty($uniqueCodes)) {
             return [];
        }

        $inPlaceholders = str_repeat('?,', count($uniqueCodes) - 1) . '?';
        $sql = "SELECT code_geo FROM geo_codes WHERE code_geo IN ($inPlaceholders) AND deleted_at IS NULL";

        try {
            $stmt = $this->db->prepare($sql);
            // PDO attend un tableau indexé numériquement pour execute() avec des placeholders '?'
            $stmt->execute(array_values($uniqueCodes));
            return $stmt->fetchAll(PDO::FETCH_COLUMN); // Renvoie un tableau plat
        } catch (PDOException $e) {
            error_log("Erreur getExistingCodes: " . $e->getMessage());
            return [];
        }
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

    /**
     * Récupère les codes géo actifs pour une liste d'IDs d'univers.
     * @param array $universIds Tableau d'IDs d'univers.
     * @return array La liste des codes géo correspondants.
     */
    public function getGeoCodesByUniversIds(array $universIds): array {
        if (empty($universIds)) {
            return [];
        }
        // Crée une chaîne de placeholders (?, ?, ?) pour la requête SQL
        $inPlaceholders = str_repeat('?,', count($universIds) - 1) . '?';

        $sql = "SELECT gc.id, gc.code_geo, gc.libelle, gc.commentaire, u.nom AS univers
                FROM geo_codes gc
                LEFT JOIN univers u ON gc.univers_id = u.id
                WHERE gc.univers_id IN ($inPlaceholders)
                AND gc.deleted_at IS NULL
                ORDER BY u.nom, gc.code_geo ASC"; // Tri optionnel

        try {
            $stmt = $this->db->prepare($sql);
            $stmt->execute($universIds); // Passe le tableau d'IDs
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Erreur getGeoCodesByUniversIds: " . $e->getMessage());
            $this->lastError = $this->db->errorInfo();
            return []; // Retourne un tableau vide en cas d'erreur
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

        if (!empty($conditions)) {
            $sql .= " AND " . implode(" AND ", $conditions);
        }

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
     * Ajoute plusieurs codes géo en lot (batch).
     * @param array $codesToInsert Tableau de tableaux associatifs contenant les données des codes.
     * Chaque tableau doit avoir : ['code_geo', 'libelle', 'univers_id', 'zone', 'commentaire']
     * @return array Un tableau avec le nombre de succès et la liste des erreurs.
     */
    public function createBatchGeoCodes(array $codesToInsert): array {
        $results = ['success' => 0, 'errors' => []];

        // Préparation de la requête
        $sql = "INSERT INTO geo_codes (code_geo, libelle, univers_id, zone, commentaire, created_at, updated_at)
                VALUES (:code_geo, :libelle, :univers_id, :zone, :commentaire, NOW(), NOW())";

        $this->db->beginTransaction(); // Commence une transaction

        try {
            $stmt = $this->db->prepare($sql);

            foreach ($codesToInsert as $codeData) {
                // 1. Vérifier si un code ACTIF existe déjà
                if ($this->codeGeoExists($codeData['code_geo'])) {
                    $results['errors'][] = "Le code " . htmlspecialchars($codeData['code_geo']) . " existe déjà activement.";
                    continue; // Passe au suivant
                }

                // 2. Lier les paramètres
                $stmt->bindParam(':code_geo', $codeData['code_geo']);
                $stmt->bindValue(':libelle', $codeData['libelle'], $codeData['libelle'] === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $stmt->bindParam(':univers_id', $codeData['univers_id'], PDO::PARAM_INT);
                $stmt->bindParam(':zone', $codeData['zone']); // Doit être 'vente' ou 'reserve'
                $stmt->bindValue(':commentaire', $codeData['commentaire'], $codeData['commentaire'] === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

                // 3. Exécuter (le try-catch externe gère les duplicatas soft-deleted)
                if ($stmt->execute()) {
                    $results['success']++;
                } else {
                    $errorInfo = $stmt->errorInfo();
                    $results['errors'][] = "Erreur BDD (non-exception) pour " . htmlspecialchars($codeData['code_geo']) . ": " . ($errorInfo[2] ?? 'Erreur inconnue');
                }
            }

            $this->db->commit(); // Valide les insertions

        } catch (PDOException $e) {
             if ($e->getCode() === '23000') {
                 // Erreur de duplicata interceptée pendant le lot (probablement un code soft-deleted)
                 $this->db->rollBack(); // Annule TOUT le lot en cas de duplicata
                 error_log("Erreur createBatchGeoCodes (Duplicata détecté dans le lot): " . $e->getMessage());
                 $results['errors'][] = "Erreur de duplicata détectée dans le lot. L'opération a été annulée. Vérifiez les codes (y compris la corbeille).";
                 $results['success'] = 0; // Réinitialise le compteur de succès
             } else {
                 $this->db->rollBack(); // Annule tout en cas d'autre erreur majeure
                 error_log("Erreur PDO createBatchGeoCodes: " . $e->getMessage());
                 $results['errors'][] = "Erreur de transaction PDO: " . $e->getMessage();
                 $results['success'] = 0;
             }
        } catch (Exception $e) { // Autre type d'exception
            $this->db->rollBack();
            error_log("Erreur Exception createBatchGeoCodes: " . $e->getMessage());
            $results['errors'][] = "Erreur générale de transaction : " . $e->getMessage();
            $results['success'] = 0;
        }

        return $results;
    }


    /**
     * Crée plusieurs codes géo (généralement depuis un import CSV).
     * Gère la création/récupération d'univers par leur nom.
     * NE GÈRE PAS les duplicatas de code_geo (le contrôleur doit le faire en amont).
     *
     * @param array $codesToInsert Tableau de tableaux associatifs.
     * Format attendu: ['code_geo', 'libelle', 'univers' (nom), 'zone', 'commentaire']
     * @param UniversManager $universManager Instance pour gérer les univers.
     * @return int Le nombre de codes géo insérés avec succès (ou false en cas d'erreur de transaction).
     */
    public function createMultipleGeoCodes(array $codesToInsert, UniversManager $universManager): int|false {
        $insertedCount = 0;

        // Préparation de la requête
        $sql = "INSERT INTO geo_codes (code_geo, libelle, univers_id, zone, commentaire, created_at, updated_at)
                VALUES (:code_geo, :libelle, :univers_id, :zone, :commentaire, NOW(), NOW())";

        $this->db->beginTransaction();

        try {
            $stmt = $this->db->prepare($sql);
            $universCache = []; // Cache simple pour éviter les requêtes répétées

            foreach ($codesToInsert as $codeData) {
                // 1. Gérer l'univers
                $universName = trim($codeData['univers'] ?? 'Indéfini');
                if (empty($universName)) $universName = 'Indéfini';
                $universId = null;
                $universZone = null;

                // Chercher dans le cache d'abord
                if (isset($universCache[$universName])) {
                    $universId = $universCache[$universName]['id'];
                    $universZone = $universCache[$universName]['zone_assignee'];
                } else {
                    // Sinon, chercher en BDD
                    $univers = $universManager->getUniversByName($universName);
                    if ($univers) {
                        $universId = $univers['id'];
                        $universZone = $univers['zone_assignee'];
                        $universCache[$universName] = $univers; // Mettre en cache
                    }
                }

                // 2. Déterminer la zone (priorité à la zone du CSV, sinon celle de l'univers)
                $zone = $codeData['zone'] ?? $universZone ?? 'vente';
                // Assurer que la zone est valide pour l'ENUM
                if (!in_array($zone, ['vente', 'reserve'])) {
                    $zone = 'vente'; // Défaut de sécurité
                }

                // Si l'univers n'a pas été trouvé ni en cache ni en BDD, on le crée
                if ($universId === null) {
                    $newUniversId = $universManager->addUnivers($universName, $zone, null); // Ajout de null pour la couleur
                    if (!$newUniversId) {
                         error_log("Échec de la création de l'univers '$universName' pendant l'import.");
                         // On pourrait décider d'arrêter ou de continuer sans cet enregistrement
                         continue; // Ici on saute cette ligne
                    }
                    $universId = $newUniversId;
                    // Ajouter au cache pour les prochaines itérations
                    $universCache[$universName] = ['id' => $universId, 'zone_assignee' => $zone];
                }


                // 3. Lier les paramètres
                $stmt->bindParam(':code_geo', $codeData['code_geo']);
                $stmt->bindValue(':libelle', $codeData['libelle'], $codeData['libelle'] === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $stmt->bindParam(':univers_id', $universId, PDO::PARAM_INT);
                $stmt->bindParam(':zone', $zone);
                $stmt->bindValue(':commentaire', $codeData['commentaire'], $codeData['commentaire'] === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

                // 4. Exécuter (Assume pas de duplicata ici)
                if ($stmt->execute()) {
                    $insertedCount++;
                } else {
                    // Log l'erreur mais continue le lot (commit sera fait à la fin si pas d'exception)
                    $errorInfo = $stmt->errorInfo();
                    error_log("Échec d'insertion CSV pour " . $codeData['code_geo'] . ": " . ($errorInfo[2] ?? 'Erreur inconnue'));
                }
            }

            $this->db->commit();

        } catch (PDOException $e) { // Attrape les erreurs PDO pendant l'insertion
            $this->db->rollBack();
            error_log("Erreur PDO createMultipleGeoCodes (Transaction): " . $e->getMessage());
            $this->lastError = $this->db->errorInfo();
            return false; // Retourne false en cas d'échec de la transaction
        } catch (Exception $e) { // Attrape d'autres exceptions (ex: venant de UniversManager)
            $this->db->rollBack();
            error_log("Erreur Exception createMultipleGeoCodes (Transaction): " . $e->getMessage());
            return false;
        }

        return $insertedCount;
    }


    /**
     * Retourne les dernières informations d'erreur PDO enregistrées par le manager.
     * @return array|null
     */
    public function getLastError(): ?array {
        return $this->lastError;
    }

}
