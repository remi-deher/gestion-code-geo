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
        $totalCodes = $this->geoCodeManager->countTotalCodes();
        $placedCodes = $this->geoCodeManager->countPlacedCodes();
        
        $stats = [
            'totalCodes' => $totalCodes,
            'placedCodes' => $placedCodes,
            'unplacedCodes' => $totalCodes - $placedCodes,
            'totalUnivers' => $this->universManager->countTotalUnivers(),
            'totalPlans' => $this->planManager->countTotalPlans(),
            // NOUVELLES DONNÉES PAR ZONE
            'codesByZone' => $this->geoCodeManager->countCodesByZone(),
            'universByZone' => $this->universManager->countUniversByZone()
        ];

        // 2. Récupérer les données pour les widgets
        $latestCodes = $this->geoCodeManager->getLatestCodes(5);
        $unplacedCodesList = $this->geoCodeManager->getUnplacedCodes(10);
        
        // 3. Préparer les données pour le graphique
        $codesByUnivers = $this->geoCodeManager->getCodesCountByUnivers();
        $chartLabels = [];
        $chartData = [];
        foreach ($codesByUnivers as $data) {
            $chartLabels[] = $data['nom'];
            $chartData[] = $data['count'];
        }
        $chartJsData = [
            'labels' => $chartLabels,
            'data' => $chartData
        ];

        // 4. Rendre la vue avec toutes les données
        $this->render('dashboard_view', [
            'stats' => $stats,
            'latestCodes' => $latestCodes,
            'unplacedCodesList' => $unplacedCodesList,
            'chartJsData' => $chartJsData
        ]);
    }
}
