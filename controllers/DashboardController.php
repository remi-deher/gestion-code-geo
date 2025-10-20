<?php
// Fichier: controllers/DashboardController.php

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/GeoCodeManager.php';
require_once __DIR__ . '/../models/UniversManager.php';
require_once __DIR__ . '/../models/PlanManager.php';

class DashboardController extends BaseController {

    private $geoCodeManager;
    private $universManager;
    private $planManager;

    public function __construct(PDO $db) {
        $this->geoCodeManager = new GeoCodeManager($db);
        $this->universManager = new UniversManager($db);
        $this->planManager = new PlanManager($db);
    }

    public function indexAction() {
        // 1. Récupérer les statistiques
        $totalCodes = $this->geoCodeManager->countTotalActiveCodes();
        $placedCodes = $this->geoCodeManager->countPlacedCodes(); // Compte les entrées dans geo_positions
        $unplacedCount = $totalCodes - count($this->geoCodeManager->getAllPositions()); // Une autre façon de compter
        // Il vaut mieux compter les codes géo qui n'ont AUCUNE position
        $unplacedCodesListForCount = $this->geoCodeManager->getUnplacedCodes(PHP_INT_MAX); // Récupère tous les non placés
        $actualUnplacedCount = count($unplacedCodesListForCount);

        $stats = [
            'totalCodes' => $totalCodes,
            'placedCodesCount' => $placedCodes, // Nombre total de placements
            // 'distinctPlacedCodes' => a calculer si besoin (COUNT DISTINCT geo_code_id FROM geo_positions)
            'unplacedCodesCount' => $actualUnplacedCount, // Nombre de codes jamais placés
            'totalUnivers' => $this->universManager->countTotalUnivers(),
            'totalPlans' => $this->planManager->countTotalPlans(),
            'codesByZone' => $this->geoCodeManager->countCodesByZone(),
            // 'universByZone' => $this->universManager->countUniversByZone() // Assurez-vous que cette méthode existe aussi
        ];

        // 2. Récupérer les données pour les widgets (limitées)
        $latestCodes = $this->geoCodeManager->getLatestCodes(5);
        $unplacedCodesListWidget = $this->geoCodeManager->getUnplacedCodes(10); // Liste limitée pour widget

        // 3. Préparer les données pour le graphique (comptes par univers)
        $codesByUnivers = $this->geoCodeManager->getCodesCountByUnivers();
        $chartLabels = [];
        $chartData = [];
        // Boucle corrigée :
        foreach ($codesByUnivers as $universName => $count) {
             // Exclure la clé d'erreur potentielle
             if ($universName !== '__ErreurExecution__') {
                $chartLabels[] = $universName; // La clé est le nom de l'univers
                $chartData[] = $count;         // La valeur est le compte
             }
        }
        $chartJsData = [
            'labels' => $chartLabels,
            'data' => $chartData
            // Ajouter les couleurs si besoin ici, récupérées depuis UniversManager
        ];

        // 4. Rendre la vue avec toutes les données
        $this->render('dashboard_view', [
            'stats' => $stats,
            'latestCodes' => $latestCodes,
            'unplacedCodesList' => $unplacedCodesListWidget, // Passer la liste limitée
            'chartJsData' => $chartJsData
        ]);
    }
}
