<?php
// Fichier: models/GeoCodeManager.php

class GeoCodeManager {
    private $db;

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
            $stmt = $this->db->query("SELECT COUNT(*) FROM geo_codes");
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
     * Compte le nombre de codes géo par zone.
     * @return array Tableau associatif ['Nom de la Zone' => count, ...].
     */
    public function countCodesByZone(): array {
        $counts = [];
        try {
            // Utilise COALESCE et NULLIF pour regrouper les zones vides/NULL
            $sql = "SELECT COALESCE(NULLIF(zone, ''), 'Non spécifiée') AS zone_name, COUNT(*) AS count 
                    FROM geo_codes 
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
     * Compte le nombre de codes géo pour chaque univers.
     * @return array Tableau associatif ['Nom de l'Univers' => count, ...].
     */
    public function getCodesCountByUnivers(): array {
        $counts = [];
        try {
            // Jointure pour obtenir le nom de l'univers et GROUP BY pour compter
            $sql = "SELECT u.nom AS univers_nom, COUNT(gc.id) AS count 
                    FROM geo_codes gc
                    JOIN univers u ON gc.univers_id = u.id 
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
     * Récupère les N derniers codes géo ajoutés ou mis à jour.
     * @param int $limit Le nombre de codes à récupérer (par défaut 5).
     * @return array La liste des codes géo récents avec infos d'univers.
     */
    public function getLatestCodes(int $limit = 5): array {
        try {
            $sql = "SELECT gc.*, u.nom AS univers_nom, u.color AS univers_color
                    FROM geo_codes gc
                    LEFT JOIN univers u ON gc.univers_id = u.id
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
     * Récupère les codes géo qui n'ont jamais été placés sur aucun plan.
     * @param int $limit Le nombre maximum de codes à retourner (par défaut 5).
     * @return array La liste des codes géo non placés avec infos d'univers.
     */
    public function getUnplacedCodes(int $limit = 5): array {
        try {
            $sql = "SELECT gc.*, u.nom AS univers_nom, u.color AS univers_color
                    FROM geo_codes gc
                    LEFT JOIN univers u ON gc.univers_id = u.id
                    WHERE NOT EXISTS (
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
     * @param string|null $zone Zone.
     * @return int|false L'ID du code géo créé ou false en cas d'erreur (ex: code dupliqué).
     */
    public function addGeoCode(string $codeGeo, ?string $libelle, int $universId, ?string $commentaire, ?string $zone) {
        if ($this->codeGeoExists($codeGeo)) {
             error_log("Tentative d'ajout d'un code géo dupliqué: " . $codeGeo);
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

        if ($stmt->execute()) {
            return (int)$this->db->lastInsertId();
        }
        error_log("Erreur BDD lors de l'ajout du code géo: " . print_r($stmt->errorInfo(), true));
        return false;
    }

    /**
     * Met à jour un code géo existant.
     * @param int $id ID du code géo.
     * @param string $codeGeo Le code géo unique.
     * @param string|null $libelle Le libellé.
     * @param int $universId L'ID de l'univers associé.
     * @param string|null $commentaire Commentaire.
     * @param string|null $zone Zone.
     * @return bool True si succès, false sinon (ex: code dupliqué).
     */
    public function updateGeoCode(int $id, string $codeGeo, ?string $libelle, int $universId, ?string $commentaire, ?string $zone): bool {
         if ($this->codeGeoExists($codeGeo, $id)) {
             error_log("Tentative de mise à jour vers un code géo dupliqué: " . $codeGeo);
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

        $success = $stmt->execute();
        if (!$success) {
            error_log("Erreur BDD lors de la mise à jour du code géo ID $id: " . print_r($stmt->errorInfo(), true));
        }
        return $success;
    }

    /**
     * Supprime un code géo (et ses positions via cascade ou manuellement).
     * @param int $id ID du code géo.
     * @return bool True si succès.
     */
    public function deleteGeoCode(int $id): bool {
        $this->db->beginTransaction();
        try {
            $stmtPos = $this->db->prepare("DELETE FROM geo_positions WHERE geo_code_id = :id");
            $stmtPos->bindParam(':id', $id, PDO::PARAM_INT);
            $stmtPos->execute();
            // $stmtHist = $this->db->prepare("DELETE FROM historique WHERE geo_code_id = :id"); ...
            $stmtCode = $this->db->prepare("DELETE FROM geo_codes WHERE id = :id");
            $stmtCode->bindParam(':id', $id, PDO::PARAM_INT);
            if (!$stmtCode->execute()) {
                 throw new Exception("Erreur BDD lors de la suppression du code géo.");
            }
            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Erreur deleteGeoCode (ID: $id): " . $e->getMessage());
            return false;
        }
    }

    /**
     * Récupère tous les codes géo AVEC leurs positions groupées.
     * @return array Liste des codes géo, chacun avec une clé 'placements'.
     */
    public function getAllGeoCodesWithPositions(): array {
        $codes = $this->getAllGeoCodes();
        $positions = $this->getAllPositions();
        $codesById = [];
        foreach ($codes as $code) {
            $code['placements'] = [];
            $codesById[$code['id']] = $code;
        }
        foreach ($positions as $pos) {
            if (isset($codesById[$pos['geo_code_id']])) {
                $codesById[$pos['geo_code_id']]['placements'][] = $pos;
            } else {
                 error_log("Position orpheline trouvée: position_id=" . $pos['id'] . ", geo_code_id=" . $pos['geo_code_id']);
            }
        }
        return array_values($codesById);
    }

    /**
     * Récupère TOUTES les positions de TOUS les codes géo.
     * @return array Liste de toutes les positions.
     */
    public function getAllPositions(): array {
	$stmt = $this->db->query("SELECT id AS position_id, geo_code_id, plan_id, pos_x, pos_y, width, height, anchor_x, anchor_y
                          FROM geo_positions ORDER BY plan_id, geo_code_id");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Récupère les codes géo disponibles pour un plan donné.
     * @param int $planId L'ID du plan concerné.
     * @return array Liste des codes géo disponibles.
     */

public function getAvailableCodesForPlan(int $planId): array
{
    // die("DEBUG: Entered getAvailableCodesForPlan with planId: " . $planId); // <-- DEBUG 1

    // 1. Récupérer les IDs des univers associés à ce plan
    $planUniversSql = "SELECT univers_id FROM plan_univers WHERE plan_id = :plan_id";
    $stmtUnivers = $this->db->prepare($planUniversSql);
    $stmtUnivers->execute(['plan_id' => $planId]);
    $universRows = $stmtUnivers->fetchAll(PDO::FETCH_ASSOC);
    $universIds = array_column($universRows, 'univers_id');

    if (empty($universIds)) {
        return []; // Aucun univers lié, donc aucun code dispo
    }
    // var_dump($universIds); // <-- DEBUG 2
    // die("DEBUG: Univers IDs found.");

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

    // --- DEBUGGING START ---
    // echo "DEBUG: SQL Query: " . $sql;
    // echo "DEBUG: Params: "; print_r($params);
    // die(" --- Débogage avant prepare/execute --- ");
    // --- DEBUGGING END ---


    try {
        $stmt = $this->db->prepare($sql);

         // --- DEBUGGING ---
         // die("DEBUG: Statement prepared."); 
         // --- /DEBUGGING ---

        $stmt->execute($params);

        // --- DEBUGGING ---
         // die("DEBUG: Statement executed.");
        // --- /DEBUGGING ---

    } catch (PDOException $e) {
        // Log l'erreur réelle côté serveur
        error_log("PDO Error in getAvailableCodesForPlan: " . $e->getMessage()); 
        // Renvoyer une erreur JSON claire au client
        // Note: On ne peut pas faire echo json_encode ici car le contrôleur le fait déjà.
        // Il faudrait propager l'exception ou retourner un code d'erreur.
        // Pour le débogage, on peut faire un die() ici :
         die("ERREUR PDO: " . $e->getMessage()); 
        // En production, il faudrait throw $e; et laisser le contrôleur gérer.
    }

    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    // die("DEBUG: Fetched results."); // <-- DEBUG FINAL
    return $results ?: [];
}

    /**
     * Vérifie si un code géo existe déjà.
     * @param string $codeGeo Le code géo à vérifier.
     * @param int|null $excludeId ID à exclure.
     * @return bool True si le code existe, false sinon.
     */
    public function codeGeoExists(string $codeGeo, ?int $excludeId = null): bool {
        $sql = "SELECT COUNT(*) FROM geo_codes WHERE code_geo = :code_geo";
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
     * Récupère un code géo par son nom (code_geo).
     * @param string $codeGeo Le code géo exact.
     * @return array|false Les données du code géo ou false.
     */
     public function getGeoCodeByCode(string $codeGeo) {
         $sql = "SELECT gc.*, u.nom AS univers_nom, u.color AS univers_color
                 FROM geo_codes gc
                 LEFT JOIN univers u ON gc.univers_id = u.id
                 WHERE gc.code_geo = :code_geo";
         $stmt = $this->db->prepare($sql);
         $stmt->bindParam(':code_geo', $codeGeo);
         $stmt->execute();
         return $stmt->fetch(PDO::FETCH_ASSOC);
     }

/**
     * Récupère les codes géo pour une liste d'IDs d'univers.
     * @param array $universIds Tableau d'IDs d'univers.
     * @return array La liste des codes géo correspondants.
     */
    public function getGeoCodesByUniversIds(array $universIds): array {
        if (empty($universIds)) {
            return [];
        }
        // Crée une chaîne de placeholders (?, ?, ?) pour la requête SQL
        $inPlaceholders = str_repeat('?,', count($universIds) - 1) . '?';

        // Modifiez la requête pour inclure les jointures nécessaires
        // et sélectionner les champs requis par pdf-label-generator.js
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
            $this->lastError = $this->db->errorInfo(); // Assurez-vous d'avoir $lastError et getLastError()
            return []; // Retourne un tableau vide en cas d'erreur
        }
    }
}
