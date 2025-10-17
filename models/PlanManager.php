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
            SELECT p.id, p.nom, p.nom_fichier, p.zone, GROUP_CONCAT(DISTINCT u.nom ORDER BY u.nom SEPARATOR ', ') as univers_names
            FROM plans p
            LEFT JOIN plan_univers pu ON p.id = pu.plan_id
            LEFT JOIN univers u ON pu.univers_id = u.id
            GROUP BY p.id
            ORDER BY p.nom
        ";
        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Ajoute un nouveau plan (image) à la base de données.
     * @param string $nom Nom du plan.
     * @param string $nom_fichier Nom du fichier image du plan.
     * @return bool True si succès, False sinon.
     */
    public function addPlan(string $nom, string $nom_fichier): bool {
        // Cette fonction reste pour l'ajout de plans basés sur des images
        $sql = "INSERT INTO plans (nom, nom_fichier) VALUES (?, ?)";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$nom, $nom_fichier]);
    }

    /**
     * Récupère les informations d'un plan par son ID, y compris les données de dessin.
     * @param int $id ID du plan.
     * @return array|false Tableau associatif du plan ou false si non trouvé.
     */
    public function getPlanById(int $id) {
        // Ajout de drawing_data à la sélection
        $stmt = $this->db->prepare("SELECT id, nom, nom_fichier, zone, drawing_data FROM plans WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Récupère un plan avec la liste des IDs des univers qui lui sont associés.
     * @param int $id ID du plan.
     * @return array Tableau associatif du plan avec une clé 'univers_ids' contenant un tableau d'IDs.
     */
    public function getPlanWithUnivers(int $id): array {
        $plan = $this->getPlanById($id); // Récupère maintenant aussi drawing_data
        if (!$plan) {
            return [];
        }

        $stmt = $this->db->prepare("SELECT univers_id FROM plan_univers WHERE plan_id = ?");
        $stmt->execute([$id]);
        $plan['univers_ids'] = $stmt->fetchAll(PDO::FETCH_COLUMN);

        return $plan;
    }

    /**
     * Supprime un plan de la base de données.
     * @param int $id ID du plan à supprimer.
     * @return bool True si succès, False sinon.
     */
    public function deletePlan(int $id): bool {
        // La suppression en cascade gère plan_univers et geo_positions
        $sql = "DELETE FROM plans WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }

    /**
     * Met à jour les informations d'un plan image et ses associations avec les univers.
     * Gère aussi le remplacement du fichier image.
     * NE PAS UTILISER pour mettre à jour le contenu d'un SVG. Utilisez updateSvgPlan().
     * NE PAS UTILISER pour sauvegarder les annotations. Utilisez saveDrawingData().
     * @param int $planId ID du plan à mettre à jour.
     * @param string $nom Nouveau nom du plan.
     * @param string|null $zone Nouvelle zone associée (null si aucune).
     * @param array $universIds Tableau des IDs des univers à associer.
     * @param string|null $newFilename Nouveau nom de fichier si l'image a été remplacée.
     * @return bool True si succès, False sinon.
     */
    public function updatePlan(int $planId, string $nom, ?string $zone, array $universIds, ?string $newFilename = null): bool {
        $this->db->beginTransaction();
        try {
            // 1. Mise à jour de la table 'plans' (nom, zone, nom_fichier si changé)
            $sql = "UPDATE plans SET nom = ?, zone = ?";
            $params = [$nom, $zone];

            if ($newFilename !== null) {
                $sql .= ", nom_fichier = ?";
                $params[] = $newFilename;
            }

            $sql .= " WHERE id = ?";
            $params[] = $planId;

            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);

            // 2. Mise à jour des associations dans 'plan_univers'
            $stmt = $this->db->prepare("DELETE FROM plan_univers WHERE plan_id = ?");
            $stmt->execute([$planId]);

            if (!empty($universIds)) {
                $sqlInsert = "INSERT INTO plan_univers (plan_id, univers_id) VALUES (?, ?)";
                $stmtInsert = $this->db->prepare($sqlInsert);
                foreach ($universIds as $universId) {
                    $stmtInsert->execute([$planId, (int)$universId]);
                }
            }

            $this->db->commit();
            return true;

        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Erreur lors de la mise à jour (métadonnées) du plan ID {$planId} : " . $e->getMessage());
            return false;
        }
    }

     /**
     * Sauvegarde les données de dessin (annotations JSON) pour un plan.
     * @param int $planId ID du plan.
     * @param string|null $jsonData Les données JSON des objets Fabric, ou null pour effacer.
     * @return bool True si succès, False sinon.
     */
    public function saveDrawingData(int $planId, ?string $jsonData): bool {
        try {
            $sql = "UPDATE plans SET drawing_data = ? WHERE id = ?";
            $stmt = $this->db->prepare($sql);
            // Utiliser null si la chaîne est vide ou null
            $dataToSave = ($jsonData === '' || $jsonData === null) ? null : $jsonData;
            return $stmt->execute([$dataToSave, $planId]);
        } catch (PDOException $e) {
            error_log("Erreur sauvegarde drawing_data pour plan {$planId}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Crée un nouveau plan à partir de contenu SVG.
     * @param string $nom Nom du nouveau plan.
     * @param string $svgContent Contenu SVG complet.
     * @return int|false L'ID du nouveau plan ou false en cas d'erreur.
     */
    public function savePlanAsSvg(string $nom, string $svgContent) {
        $uploadDir = __DIR__ . '/../public/uploads/plans/';
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0777, true)) {
            error_log("Impossible de créer le dossier d'upload SVG: " . $uploadDir);
            return false;
        }

        $safeFilename = preg_replace('/[^a-zA-Z0-9-_\.]/', '_', $nom);
        // Évite les doubles extensions si le nom contient déjà .svg
        if (str_ends_with($safeFilename, '.svg')) {
             $safeFilename = substr($safeFilename, 0, -4);
        }
        $newFilename = time() . '_' . $safeFilename . '.svg';
        $destinationPath = $uploadDir . $newFilename;

        if (file_put_contents($destinationPath, $svgContent) === false) {
            error_log("Impossible d'écrire le fichier SVG: " . $destinationPath);
            return false;
        }

        try {
            // Insère le nouveau plan SVG (zone et drawing_data sont NULL par défaut)
            $sql = "INSERT INTO plans (nom, nom_fichier) VALUES (?, ?)";
            $stmt = $this->db->prepare($sql);
            if ($stmt->execute([$nom, $newFilename])) {
                return (int)$this->db->lastInsertId();
            } else {
                unlink($destinationPath);
                return false;
            }
        } catch (PDOException $e) {
            error_log("Erreur insertion BDD plan SVG: " . $e->getMessage());
            if(file_exists($destinationPath)) unlink($destinationPath);
            return false;
        }
    }

    /**
     * Met à jour le contenu d'un fichier SVG de plan existant.
     * @param int $planId ID du plan à mettre à jour.
     * @param string $svgContent Nouveau contenu SVG.
     * @return bool True si succès, False sinon.
     */
    public function updateSvgPlan(int $planId, string $svgContent): bool {
        $plan = $this->getPlanById($planId);
        if (!$plan || !str_ends_with(strtolower($plan['nom_fichier']), '.svg')) {
            error_log("Tentative d'update SVG sur un plan non SVG ou inexistant: ID " . $planId);
            return false;
        }

        $filePath = __DIR__ . '/../public/uploads/plans/' . $plan['nom_fichier'];

        if (file_put_contents($filePath, $svgContent) === false) {
            error_log("Impossible de mettre à jour le fichier SVG: " . $filePath);
            return false;
        }
        return true;
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
            $stmt->bindParam(1, $geo_code_id, PDO::PARAM_INT);
            $stmt->bindParam(2, $plan_id, PDO::PARAM_INT);
            // Utiliser PDO::PARAM_STR pour les floats ici, PDO gère la conversion
            $stmt->bindParam(3, $pos_x, $pos_x === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindParam(4, $pos_y, $pos_y === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindParam(5, $action_type, PDO::PARAM_STR);
            $stmt->execute();
        } catch (PDOException $e) {
             error_log("Erreur lors de l'enregistrement de l'historique de position : " . $e->getMessage());
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
     * Retourne les informations de la position sauvegardée (y compris l'ID).
     * @param int $geo_code_id ID du code géo.
     * @param int $plan_id ID du plan.
     * @param float $pos_x Position X (en pourcentage).
     * @param float $pos_y Position Y (en pourcentage).
     * @param int|null $width Largeur optionnelle (pixels).
     * @param int|null $height Hauteur optionnelle (pixels).
     * @param float|null $anchor_x Position X de l'ancre de flèche (pourcentage).
     * @param float|null $anchor_y Position Y de l'ancre de flèche (pourcentage).
     * @param int|null $position_id ID de la position si c'est une mise à jour.
     * @return array|false Tableau avec les données sauvegardées (incluant 'position_id') ou false si échec.
     */
    public function savePosition(int $geo_code_id, int $plan_id, float $pos_x, float $pos_y, ?int $width = null, ?int $height = null, ?float $anchor_x = null, ?float $anchor_y = null, ?int $position_id = null) {

        // Validation basique des pourcentages
        $pos_x = max(0.0, min(100.0, $pos_x));
        $pos_y = max(0.0, min(100.0, $pos_y));
        if ($anchor_x !== null) $anchor_x = max(0.0, min(100.0, $anchor_x));
        if ($anchor_y !== null) $anchor_y = max(0.0, min(100.0, $anchor_y));

        try {
            $action_type = '';
            if ($position_id) {
                // Mise à jour
                $action_type = 'moved';
                $sql = "UPDATE geo_positions SET pos_x = ?, pos_y = ?, width = ?, height = ?, anchor_x = ?, anchor_y = ? WHERE id = ?";
                $stmt = $this->db->prepare($sql);
                $success = $stmt->execute([$pos_x, $pos_y, $width, $height, $anchor_x, $anchor_y, $position_id]);
            } else {
                // Insertion
                $action_type = 'placed';
                $sql = "INSERT INTO geo_positions (geo_code_id, plan_id, pos_x, pos_y, width, height, anchor_x, anchor_y)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
                $stmt = $this->db->prepare($sql);
                $success = $stmt->execute([$geo_code_id, $plan_id, $pos_x, $pos_y, $width, $height, $anchor_x, $anchor_y]);
                if ($success) {
                    $position_id = (int)$this->db->lastInsertId(); // Récupère le nouvel ID
                }
            }

            if ($success) {
                $this->_logHistory($geo_code_id, $plan_id, $pos_x, $pos_y, $action_type);
                // Retourne les données sauvegardées, y compris l'ID de position
                return [
                    'position_id' => $position_id,
                    'geo_code_id' => $geo_code_id,
                    'plan_id'     => $plan_id,
                    'pos_x'       => $pos_x,
                    'pos_y'       => $pos_y,
                    'width'       => $width,
                    'height'      => $height,
                    'anchor_x'    => $anchor_x,
                    'anchor_y'    => $anchor_y
                ];
            }
            return false; // Échec de l'exécution SQL

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
        $stmt = $this->db->prepare("SELECT geo_code_id, plan_id FROM geo_positions WHERE id = ?");
        $stmt->execute([$position_id]);
        $existingPosition = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existingPosition) {
            try {
                $sql = "DELETE FROM geo_positions WHERE id = ?";
                $stmt = $this->db->prepare($sql);
                $success = $stmt->execute([$position_id]);
                if ($success && $stmt->rowCount() > 0) { // Vérifie qu'une ligne a été affectée
                    $this->_logHistory($existingPosition['geo_code_id'], $existingPosition['plan_id'], null, null, 'removed');
                }
                return $success; // Retourne true même si rien n'a été supprimé (id inexistant)
            } catch (PDOException $e) {
                 error_log("Erreur lors de la suppression de la position ID {$position_id} : " . $e->getMessage());
                 return false;
            }
        }
        return false; // La position n'existait pas initialement
    }

    /**
     * Supprime toutes les positions d'un code géo donné sur un plan spécifique.
     * @param int $geo_code_id ID du code géo.
     * @param int $plan_id ID du plan.
     * @return bool True si succès (même si rien n'est supprimé), False en cas d'erreur.
     */
    public function removeMultiplePositionsByCodeId(int $geo_code_id, int $plan_id): bool {
         try {
            $sql = "DELETE FROM geo_positions WHERE geo_code_id = ? AND plan_id = ?";
            $stmt = $this->db->prepare($sql);
            $success = $stmt->execute([$geo_code_id, $plan_id]);
            if ($success && $stmt->rowCount() > 0) { // Log seulement si qqch a été supprimé
                 $this->_logHistory($geo_code_id, $plan_id, null, null, 'removed');
            }
            return $success;
        } catch (PDOException $e) {
             error_log("Erreur lors de la suppression multiple pour code {$geo_code_id} sur plan {$plan_id} : " . $e->getMessage());
             return false;
        }
    }

    /**
     * Sauvegarde plusieurs nouvelles positions en une seule transaction.
     * Retourne un tableau des nouvelles positions créées avec leurs IDs.
     * @param array $positions Tableau de positions à créer. Chaque élément doit contenir ['id', 'x', 'y'] et optionnellement width, height, anchor_x, anchor_y.
     * @param int $plan_id ID du plan concerné.
     * @return array|false Tableau des nouvelles positions créées ou false en cas d'erreur.
     */
    public function saveMultiplePositions(array $positions, int $plan_id): array|false {
        if (empty($positions)) return [];

        $newlyCreatedPositions = [];
        $this->db->beginTransaction();
        try {
            $sql = "INSERT INTO geo_positions (geo_code_id, plan_id, pos_x, pos_y, width, height, anchor_x, anchor_y)
                    VALUES (:geo_code_id, :plan_id, :pos_x, :pos_y, :width, :height, :anchor_x, :anchor_y)";
            $stmt = $this->db->prepare($sql);

            foreach ($positions as $pos) {
                if (!isset($pos['id'], $pos['x'], $pos['y'])) continue;

                $pos_x = max(0.0, min(100.0, (float)$pos['x']));
                $pos_y = max(0.0, min(100.0, (float)$pos['y']));
                $anchor_x = isset($pos['anchor_x']) ? max(0.0, min(100.0, (float)$pos['anchor_x'])) : null;
                $anchor_y = isset($pos['anchor_y']) ? max(0.0, min(100.0, (float)$pos['anchor_y'])) : null;
                $width = isset($pos['width']) ? (int)$pos['width'] : null;
                $height = isset($pos['height']) ? (int)$pos['height'] : null;
                $geo_code_id = (int)$pos['id'];

                $stmt->execute([
                    ':geo_code_id' => $geo_code_id,
                    ':plan_id'     => $plan_id,
                    ':pos_x'       => $pos_x,
                    ':pos_y'       => $pos_y,
                    ':width'       => $width,
                    ':height'      => $height,
                    ':anchor_x'    => $anchor_x,
                    ':anchor_y'    => $anchor_y
                ]);
                $newPositionId = (int)$this->db->lastInsertId();
                $this->_logHistory($geo_code_id, $plan_id, $pos_x, $pos_y, 'placed');
                $newlyCreatedPositions[] = [
                    'position_id' => $newPositionId, 'geo_code_id' => $geo_code_id, 'plan_id' => $plan_id,
                    'pos_x' => $pos_x, 'pos_y' => $pos_y, 'width' => $width, 'height' => $height,
                    'anchor_x' => $anchor_x, 'anchor_y' => $anchor_y
                ];
            }

            $this->db->commit();
            return $newlyCreatedPositions;

        } catch (Exception $e) {
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
    public function getHistoryForPlan(int $planId, int $limit = 20) { // Augmenté la limite par défaut
        $sql = "
            SELECT h.id, h.geo_code_id, h.plan_id, h.pos_x, h.pos_y, h.action_type, h.action_timestamp,
                   gc.code_geo
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
        return (int)$this->db->query("SELECT COUNT(*) FROM plans")->fetchColumn();
    }
}
