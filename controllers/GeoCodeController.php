<?php

require_once 'models/GeoCodeManager.php';

class GeoCodeController {
    
    private $manager;

    public function __construct(PDO $db) {
        $this->manager = new GeoCodeManager($db);
    }

    /**
     * Affiche la liste de tous les codes géo.
     */
    public function listAction() {
        // 1. Demande les données au Modèle
        $geoCodes = $this->manager->getAllGeoCodes();

        // 2. Charge la Vue et lui passe les données
        require 'views/geo_codes_view.php';
    }

    /**
     * Gère l'ajout d'un nouveau code géo.
     */
    public function addAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            // Récupérer et nettoyer les données du formulaire
            $code_geo = trim($_POST['code_geo']);
            $libelle = trim($_POST['libelle']);
            // ... récupérer les autres champs
            
            // 1. Demande au Modèle d'enregistrer les données
            $success = $this->manager->createGeoCode($code_geo, $libelle, ...);

            // 2. Redirige vers la liste pour voir le résultat
            header('Location: index.php?action=list');
            exit();
        }
    }
}
