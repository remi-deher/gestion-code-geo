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
            // fetchColumn() retourne directement la valeur de la première colonne (le COUNT)
            // ou false en cas d'erreur ou si aucune ligne n'est retournée.
            $count = $stmt->fetchColumn();
            return ($count !== false) ? (int)$count : 0;
        } catch (Exception $e) {
            error_log("Erreur countTotalActiveCodes: " . $e->getMessage());
            return 0; // Retourne 0 en cas d'erreur
        }
    }

     /**
     * Compte le nombre total de placements de codes géo sur tous les plans.
     * @return int Le nombre total d'entrées dans la table geo_positions.
     */
    public function countPlacedCodes(): int {
        try {
            // Compte simplement le nombre de lignes dans la table des positions
            $stmt = $this->db->query("SELECT COUNT(*) FROM geo_positions");
            $count = $stmt->fetchColumn();
            return ($count !== false) ? (int)$count : 0;
        } catch (Exception $e) {
            error_log("Erreur countPlacedCodes: " . $e->getMessage());
            return 0; // Retourne 0 en cas d'erreur
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
        // Vérifier l'unicité du code géo
        if ($this->codeGeoExists($codeGeo)) {
             error_log("Tentative d'ajout d'un code géo dupliqué: " . $codeGeo);
             // On pourrait lever une exception ici pour une meilleure gestion des erreurs
             // throw new Exception("Le code géo '$codeGeo' existe déjà.");
            return false;
        }

        $sql = "INSERT INTO geo_codes (code_geo, libelle, univers_id, commentaire, zone, created_at, updated_at)
                VALUES (:code_geo, :libelle, :univers_id, :commentaire, :zone, NOW(), NOW())";
        $stmt = $this->db->prepare($sql);
        $stmt->bindParam(':code_geo', $codeGeo);
        // Utiliser bindValue pour gérer NULL correctement
        $stmt->bindValue(':libelle', $libelle, $libelle === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindParam(':univers_id', $universId, PDO::PARAM_INT);
        $stmt->bindValue(':commentaire', $commentaire, $commentaire === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->bindValue(':zone', $zone, $zone === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

        if ($stmt->execute()) {
            return (int)$this->db->lastInsertId();
        }
        // Log l'erreur si l'exécution échoue
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
         // Vérifier l'unicité si le code géo a changé
         if ($this->codeGeoExists($codeGeo, $id)) {
             error_log("Tentative de mise à jour vers un code géo dupliqué: " . $codeGeo);
             // throw new Exception("Le code géo '$codeGeo' existe déjà.");
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
        // Si ON DELETE CASCADE est activé pour geo_positions.geo_code_id,
        // une simple suppression suffit.
        // Sinon, il faut supprimer les positions d'abord (ce qui est fait ici pour plus de sûreté).

        $this->db->beginTransaction();
        try {
            // 1. Supprimer les positions associées
            $stmtPos = $this->db->prepare("DELETE FROM geo_positions WHERE geo_code_id = :id");
            $stmtPos->bindParam(':id', $id, PDO::PARAM_INT);
            $stmtPos->execute(); // On continue même si rien n'est supprimé

            // 2. Supprimer les entrées d'historique associées (si la table existe)
            // $stmtHist = $this->db->prepare("DELETE FROM historique WHERE geo_code_id = :id");
            // $stmtHist->bindParam(':id', $id, PDO::PARAM_INT);
            // $stmtHist->execute();

            // 3. Supprimer le code géo
            $stmtCode = $this->db->prepare("DELETE FROM geo_codes WHERE id = :id");
            $stmtCode->bindParam(':id', $id, PDO::PARAM_INT);
            if (!$stmtCode->execute()) {
                 throw new Exception("Erreur BDD lors de la suppression du code géo.");
            }

            // Vérifier si la suppression a bien eu lieu
            if ($stmtCode->rowCount() === 0) {
                 // Le code n'existait peut-être pas, ce n'est pas forcément une erreur
                 // Mais on peut choisir de le signaler ou de considérer que c'est ok.
                 // Pour l'instant, on considère que c'est ok.
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
     * Utilisé pour l'affichage initial des plans (view, manage, print).
     * @return array Liste des codes géo, chacun avec une clé 'placements' contenant un tableau de ses positions.
     */
    public function getAllGeoCodesWithPositions(): array {
        $codes = $this->getAllGeoCodes(); // Récupère infos de base (code, libelle, univers...)
        $positions = $this->getAllPositions(); // Récupère toutes les positions

        $codesById = [];
        foreach ($codes as $code) {
            $code['placements'] = []; // Initialise le tableau des placements
            $codesById[$code['id']] = $code;
        }

        foreach ($positions as $pos) {
            // Vérifier si le code existe (au cas où il y aurait des positions orphelines)
            if (isset($codesById[$pos['geo_code_id']])) {
                 // Ajouter la position au bon code géo
                $codesById[$pos['geo_code_id']]['placements'][] = $pos;
            } else {
                 // Logguer une position orpheline si nécessaire
                 error_log("Position orpheline trouvée: position_id=" . $pos['id'] . ", geo_code_id=" . $pos['geo_code_id']);
            }
        }

        // Retourne un tableau indexé numériquement, prêt pour json_encode
        return array_values($codesById);
    }

    /**
     * Récupère TOUTES les positions de TOUS les codes géo.
     * @return array Liste de toutes les positions.
     */
    public function getAllPositions(): array {
        $stmt = $this->db->query("SELECT * FROM geo_positions ORDER BY plan_id, geo_code_id");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Récupère les codes géo associés aux univers d'un plan donné,
     * mais SEULEMENT ceux qui n'ont PAS ENCORE de position sur CE plan.
     * Utilisé pour peupler la modale de sélection et la liste "Disponibles" de la sidebar.
     * @param int $planId L'ID du plan concerné.
     * @return array Liste des codes géo disponibles.
     */
    public function getAvailableCodesForPlan(int $planId): array {
        // 1. Trouver les IDs des univers liés au plan
        $stmtUniv = $this->db->prepare("SELECT univers_id FROM plan_univers WHERE plan_id = :plan_id");
        $stmtUniv->bindParam(':plan_id', $planId, PDO::PARAM_INT);
        $stmtUniv->execute();
        $universIds = $stmtUniv->fetchAll(PDO::FETCH_COLUMN, 0);
        $universIds = array_map('intval', $universIds); // Assurer que ce sont des entiers

        if (empty($universIds)) {
            return []; // Si le plan n'est lié à aucun univers, aucun code n'est disponible
        }

        // Créer les placeholders pour la clause IN (?, ?, ...)
        $placeholders = implode(',', array_fill(0, count($universIds), '?'));

        // 2. Sélectionner les codes géo de ces univers QUI N'ONT PAS de position pour ce planId
        //    Jointure avec 'univers' pour récupérer le nom de l'univers directement
        $sql = "SELECT gc.id, gc.code_geo, gc.libelle, gc.commentaire, gc.zone,
                       gc.univers_id, u.nom as univers
                FROM geo_codes gc
                JOIN univers u ON gc.univers_id = u.id
                WHERE gc.univers_id IN ($placeholders)
                  AND NOT EXISTS (
                      SELECT 1
                      FROM geo_positions gp
                      WHERE gp.geo_code_id = gc.id AND gp.plan_id = ?
                  )
                ORDER BY gc.code_geo ASC";

        $stmt = $this->db->prepare($sql);

        // Binder les IDs d'univers + le planId
        $params = array_merge($universIds, [$planId]);

        // Exécuter avec les paramètres
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Vérifie si un code géo existe déjà.
     * @param string $codeGeo Le code géo à vérifier.
     * @param int|null $excludeId ID à exclure de la vérification (utile lors de la mise à jour).
     * @return bool True si le code existe (et n'est pas $excludeId), false sinon.
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
     * Peut être utile pour l'importation ou la recherche.
     * @param string $codeGeo Le code géo exact.
     * @return array|false Les données du code géo ou false si non trouvé.
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

}
