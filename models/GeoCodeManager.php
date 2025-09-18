<?php

class GeoCodeManager {
    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Récupère tous les codes géo, avec leurs positions s'ils en ont.
     * @return array
     */
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

    public function createGeoCode(string $code_geo, string $libelle, string $univers, string $zone, ?string $commentaire) {
        $sql = "INSERT INTO geo_codes (code_geo, libelle, univers, zone, commentaire) VALUES (?, ?, ?, ?, ?)";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$code_geo, $libelle, $univers, $zone, $commentaire]);
    }

    /**
     * Sauvegarde la position d'un code géo.
     * Met à jour si la position existe déjà, sinon l'insère.
     * @param int $geo_code_id
     * @param int $pos_x
     * @param int $pos_y
     * @return bool
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
}
