<?php

require_once '../models/GeoCodeManager.php';

class GeoCodeController {
    
    private $manager;

    public function __construct(PDO $db) {
        $this->manager = new GeoCodeManager($db);
    }

    /**
     * Affiche la liste de tous les codes géo.
     */
    public function listAction() {
        // ... (votre code existant pour listAction)
        $geoCodes = $this->manager->getAllGeoCodes();
        require '../views/geo_codes_view.php';
    }

    /**
     * Gère l'ajout d'un nouveau code géo.
     */
    public function addAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            // Récupérer et nettoyer toutes les données du formulaire
            $code_geo = trim($_POST['code_geo'] ?? '');
            $libelle = trim($_POST['libelle'] ?? '');
            $univers = trim($_POST['univers'] ?? '');
            $zone = $_POST['zone'] ?? ''; // Pas de trim sur un select
            $commentaire = trim($_POST['commentaire'] ?? null);

            // Vérification simple (vous pourrez l'améliorer)
            if (!empty($code_geo) && !empty($libelle) && !empty($univers) && !empty($zone)) {
                // Demande au Modèle d'enregistrer les données avec toutes les variables
                $this->manager->createGeoCode($code_geo, $libelle, $univers, $zone, $commentaire);
            }
            
            // Redirige vers la liste pour voir le résultat
            header('Location: index.php?action=list');
            exit();
        }
        
        // Si ce n'est pas une requête POST, on redirige aussi pour éviter une page blanche
        header('Location: index.php?action=list');
        exit();
    }
}
