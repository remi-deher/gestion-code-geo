<?php
// Fichier: controllers/DashboardController.php

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/GeoCodeManager.php';
require_once __DIR__ . '/../models/UniversManager.php';
// Retrait de PlanManager

class DashboardController extends BaseController {

    private $geoCodeManager;
    private $universManager;
    // Retrait de planManager

    public function __construct(PDO $db) {
        $this->geoCodeManager = new GeoCodeManager($db);
        $this->universManager = new UniversManager($db);
        // Retrait de planManager
    }

    public function indexAction() {
        // 1. Récupérer les statistiques simplifiées
        $totalCodes = $this->geoCodeManager->countTotalActiveCodes();
        // Retrait des stats liées aux placements et aux plans

        $stats = [
            'totalCodes' => $totalCodes,
            'totalUnivers' => $this->universManager->countTotalUnivers(),
            // Retrait de totalPlans, placedCodesCount, unplacedCodesCount
            'codesByZone' => $this->geoCodeManager->countCodesByZone(),
            'universByZone' => $this->universManager->countUniversByZone() // Ajouté si la méthode existe
        ];

        // 2. Récupérer les données pour les widgets (inchangé)
        $latestCodes = $this->geoCodeManager->getLatestCodes(5);
        // Retrait de unplacedCodesListWidget

        // 3. Préparer les données pour le graphique (inchangé)
        $codesByUnivers = $this->geoCodeManager->getCodesCountByUnivers();
        $chartLabels = [];
        $chartData = [];
        foreach ($codesByUnivers as $universName => $count) {
             if ($universName !== '__ErreurExecution__') {
                $chartLabels[] = $universName;
                $chartData[] = $count;
             }
        }
        $chartJsData = [
            'labels' => $chartLabels,
            'data' => $chartData
            // Vous pouvez ajouter des couleurs ici si nécessaire
        ];

        // 4. Rendre la vue avec les données simplifiées
        $this->render('dashboard_view', [
            'stats' => $stats,
            'latestCodes' => $latestCodes,
            // Retrait de unplacedCodesList
            'chartJsData' => $chartJsData
        ]);
    }
}
