<?php

class GeoCodeManager {
    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Récupère un code géo par son ID.
     * @param int $id
     * @return array|false
     */
    public function getGeoCodeById(int $id) {
        $sql = "SELECT * FROM geo_codes WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Récupère tous les codes géo, avec leurs positions et le nom de l'univers.
     * @return array
     */
    public function getAllGeoCodesWithPositions() {
        // CORRECTION : Remplacement de "JOIN univers" par "LEFT JOIN univers"
        // Cela assure que les codes géo sont affichés même si leur univers a été supprimé.
        $sql = "
            SELECT 
                gc.id, gc.code_geo, gc.libelle, u.nom as univers, gc.zone, gc.commentaire,
                gp.pos_x, gp.pos_y
            FROM 
                geo_codes gc
            LEFT JOIN 
                geo_positions gp ON gc.id = gp.geo_code_id
            LEFT JOIN 
                univers u ON gc.univers_id = u.id
            ORDER BY 
                u.nom, gc.code_geo
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Crée un nouveau code géo.
     */
    public function createGeoCode(string $code_geo, string $libelle, int $univers_id, string $zone, ?string $commentaire) {
        $sql = "INSERT INTO geo_codes (code_geo, libelle, univers_id, zone, commentaire) VALUES (?, ?, ?, ?, ?)";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$code_geo, $libelle, $univers_id, $zone, $commentaire]);
    }

    /**
     * Met à jour un code géo existant.
     */
    public function updateGeoCode(int $id, string $code_geo, string $libelle, int $univers_id, string $zone, ?string $commentaire) {
        $sql = "UPDATE geo_codes SET code_geo = ?, libelle = ?, univers_id = ?, zone = ?, commentaire = ? WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$code_geo, $libelle, $univers_id, $zone, $commentaire, $id]);
    }
    
    /**
     * Insère plusieurs codes géo (utilisé pour l'import).
     */
    public function createMultipleGeoCodes(array $codes) {
        $this->db->beginTransaction();
        try {
            foreach ($codes as $code) {
                $univers_id = $this->getOrCreateUniversId($code['univers']);
                
                $sql = "INSERT INTO geo_codes (code_geo, libelle, univers_id, zone, commentaire) 
                        VALUES (?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE 
                        libelle = VALUES(libelle), 
                        univers_id = VALUES(univers_id), 
                        zone = VALUES(zone), 
                        commentaire = VALUES(commentaire)";
                $stmt = $this->db->prepare($sql);
                $stmt->execute([
                    $code['code_geo'],
                    $code['libelle'],
                    $univers_id,
                    $code['zone'],
                    $code['commentaire']
                ]);
            }
            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            // Log l'erreur peut être une bonne idée ici
            return false;
        }
    }


    /**
     * Sauvegarde la position d'un code géo.
     */
    public function savePosition(int $geo_code_id, int $pos_x, int $pos_y) {
        $sql = "
            INSERT INTO geo_positions (geo_code_id, pos_x, pos_y) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE pos_x = VALUES(pos_x), pos_y = VALUES(pos_y)
        ";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$geo_code_id, $pos_x, $pos_y]);
    }

    // --- GESTION DES UNIVERS ---

    /**
     * Récupère tous les univers.
     */
    public function getAllUnivers() {
        return $this->db->query("SELECT * FROM univers ORDER BY nom")->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Récupère l'ID d'un univers par son nom, ou le crée s'il n'existe pas.
     */
    private function getOrCreateUniversId(string $nom): int {
        $stmt = $this->db->prepare("SELECT id FROM univers WHERE nom = ?");
        $stmt->execute([$nom]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($result) {
            return $result['id'];
        } else {
            $this->addUnivers($nom);
            return $this->db->lastInsertId();
        }
    }

    /**
     * Ajoute un nouvel univers.
     */
    public function addUnivers(string $nom) {
        $sql = "INSERT INTO univers (nom) VALUES (?) ON DUPLICATE KEY UPDATE nom=nom"; // Évite les erreurs si l'univers existe déjà
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$nom]);
    }

    /**
     * Supprime un univers.
     */
    public function deleteUnivers(int $id) {
        $checkSql = "SELECT COUNT(*) FROM geo_codes WHERE univers_id = ?";
        $checkStmt = $this->db->prepare($checkSql);
        $checkStmt->execute([$id]);
        if ($checkStmt->fetchColumn() > 0) {
            return false; // Empêche la suppression si utilisé
        }

        $sql = "DELETE FROM univers WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }
}
