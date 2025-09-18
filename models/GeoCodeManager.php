<?php

class GeoCodeManager {
    private $db;

    // Le constructeur reçoit la connexion à la base de données
    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Récupère tous les codes géo depuis la base de données.
     * @return array
     */
    public function getAllGeoCodes() {
        // Prépare la requête pour éviter les injections SQL
        $stmt = $this->db->prepare("SELECT * FROM geo_codes ORDER BY univers, code_geo");
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Crée un nouveau code géo dans la base de données.
     * @param string $code_geo
     * @param string $libelle
     * @param string $univers
     * @param string $zone
     * @param string|null $commentaire
     * @return bool
     */
    public function createGeoCode(string $code_geo, string $libelle, string $univers, string $zone, ?string $commentaire) {
        $sql = "INSERT INTO geo_codes (code_geo, libelle, univers, zone, commentaire) VALUES (?, ?, ?, ?, ?)";
        $stmt = $this->db->prepare($sql);
        // L'exécution retourne true en cas de succès, false sinon.
        return $stmt->execute([$code_geo, $libelle, $univers, $zone, $commentaire]);
    }
    
    // Vous ajouterez ici les méthodes updateGeoCode() et deleteGeoCode()...
}
