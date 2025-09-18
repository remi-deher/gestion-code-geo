<?php

class GeoCodeManager {
    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function getAllGeoCodesWithPositions() {
        $sql = "
            SELECT 
                gc.id, gc.code_geo, gc.libelle, gc.univers, gc.zone, gc.commentaire,
                gp.pos_x, gp.pos_y
            FROM 
                geo_codes gc
            LEFT JOIN 
                geo_positions gp ON gc.id = gp.geo_code_id
            ORDER BY 
                gc.univers, gc.code_geo
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * NOUVELLE METHODE : Récupère tous les univers distincts.
     * @return array
     */
    public function getDistinctUnivers() {
        $sql = "SELECT DISTINCT univers FROM geo_codes ORDER BY univers";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }


    public function createGeoCode(string $code_geo, string $libelle, string $univers, string $zone, ?string $commentaire) {
        // ON DUPLICATE KEY UPDATE permet d'éviter les erreurs si un code géo existe déjà
        // et de le mettre à jour à la place.
        $sql = "INSERT INTO geo_codes (code_geo, libelle, univers, zone, commentaire) 
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                libelle = VALUES(libelle), 
                univers = VALUES(univers), 
                zone = VALUES(zone), 
                commentaire = VALUES(commentaire)";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$code_geo, $libelle, $univers, $zone, $commentaire]);
    }
    
    /**
     * NOUVELLE METHODE : Insère plusieurs codes géo en une seule transaction.
     * @param array $codes
     * @return bool
     */
    public function createMultipleGeoCodes(array $codes) {
        $this->db->beginTransaction();
        try {
            foreach ($codes as $code) {
                $this->createGeoCode(
                    $code['code_geo'],
                    $code['libelle'],
                    $code['univers'],
                    $code['zone'],
                    $code['commentaire']
                );
            }
            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            return false;
        }
    }


    public function savePosition(int $geo_code_id, int $pos_x, int $pos_y) {
        $sql = "
            INSERT INTO geo_positions (geo_code_id, pos_x, pos_y) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE pos_x = VALUES(pos_x), pos_y = VALUES(pos_y)
        ";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$geo_code_id, $pos_x, $pos_y]);
    }
}
