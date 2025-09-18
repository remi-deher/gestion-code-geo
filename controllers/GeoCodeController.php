<?php

require_once '../models/GeoCodeManager.php';

class GeoCodeController {
    
    private $manager;

    public function __construct(PDO $db) {
        $this->manager = new GeoCodeManager($db);
    }

    /**
     * Affiche la page avec la LISTE de tous les codes géo.
     */
    public function listAction() {
        $geoCodes = $this->manager->getAllGeoCodes();
        // On charge la vue qui affiche uniquement la liste
        require '../views/geo_codes_list_view.php';
    }

    /**
     * Affiche la page avec le FORMULAIRE de création.
     */
    public function createAction() {
        // Cette vue contient uniquement le formulaire
        require '../views/geo_codes_create_view.php';
    }

    /**
     * Gère l'AJOUT d'un nouveau code géo (traitement du formulaire).
     */
    public function addAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $code_geo = trim($_POST['code_geo'] ?? '');
            $libelle = trim($_POST['libelle'] ?? '');
            $univers = trim($_POST['univers'] ?? '');
            $zone = $_POST['zone'] ?? '';
            $commentaire = trim($_POST['commentaire'] ?? null);

            if (!empty($code_geo) && !empty($libelle) && !empty($univers) && !empty($zone)) {
                $this->manager->createGeoCode($code_geo, $libelle, $univers, $zone, $commentaire);
            }
        }
        // Après l'ajout, on redirige vers la liste pour voir le résultat
        header('Location: index.php?action=list');
        exit();
    }

    /**
     * Affiche la page du PLAN du magasin.
     */
    public function planAction() {
        // Pour le futur, on récupérera ici les positions des codes
        require '../views/plan_view.php';
    }
}
