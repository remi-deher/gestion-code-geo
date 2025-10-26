<?php
// Fichier: views/partials/navbar.php

// On détermine l'action en cours pour la classe "active"
$current_action = $_GET['action'] ?? 'dashboard';

// On définit les groupes d'actions pour les menus déroulants
$management_actions = ['listUnivers', 'fullHistory', 'trash']; // Actions de gestion des codes
$data_actions = ['showImport', 'showExport']; // Actions de données des codes
// Actions liées aux plans (pour le menu actif)
$plan_actions = ['listPlans', 'addPlanForm', 'editPlan', 'viewPlan', 'printPlan']; // Actions liées aux plans

?>

<nav class="navbar navbar-expand-lg navbar-light bg-light fixed-top navbar-custom">
    <div class="container-fluid">
        <a class="navbar-brand" href="index.php?action=dashboard">🏬 Gestion Géo</a>

        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar" aria-controls="mainNavbar" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="mainNavbar">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                <li class="nav-item">
                    <a class="nav-link <?= ($current_action == 'dashboard') ? 'active' : '' ?>" href="index.php?action=dashboard">Tableau de bord</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link <?= ($current_action == 'list') ? 'active' : '' ?>" href="index.php?action=list">Liste des codes</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link <?= (in_array($current_action, $plan_actions)) ? 'active' : '' ?>" href="index.php?action=listPlans">Gestion des Plans</a>
                </li>
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle <?= in_array($current_action, ['create', 'showBatchCreate']) ? 'active' : '' ?>" href="#" id="addDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                        Ajouter Codes
                    </a>
                    <ul class="dropdown-menu" aria-labelledby="addDropdown">
                        <li><a class="dropdown-item" href="index.php?action=create">Ajouter un code</a></li>
                        <li><a class="dropdown-item" href="index.php?action=showBatchCreate">Ajout par lot</a></li>
                    </ul>
                </li>

                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle <?= in_array($current_action, $management_actions) ? 'active' : '' ?>" href="#" id="managementDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                        Gestion Codes
                    </a>
                    <ul class="dropdown-menu" aria-labelledby="managementDropdown">
                        <li><a class="dropdown-item" href="index.php?action=listUnivers">Gérer les univers</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="index.php?action=fullHistory">Historique global</a></li>
                         <li><a class="dropdown-item" href="index.php?action=trash">Corbeille</a></li>
                    </ul>
                </li>

                 <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle <?= in_array($current_action, $data_actions) ? 'active' : '' ?>" href="#" id="dataDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                        Données Codes
                    </a>
                     <ul class="dropdown-menu" aria-labelledby="dataDropdown">
                        <li><a class="dropdown-item" href="index.php?action=showImport">Importer</a></li>
                        <li><a class="dropdown-item" href="index.php?action=showExport">Exporter</a></li>
                        </ul>
                </li>
                 <li class="nav-item">
                    <a class="nav-link <?= ($current_action == 'printLabels') ? 'active' : '' ?>" href="index.php?action=printLabels">Imprimer Étiquettes</a>
                </li>

            </ul>
            </div>
    </div>
</nav>
