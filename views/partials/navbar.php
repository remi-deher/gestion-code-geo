<?php
// On détermine l'action en cours pour la classe "active"
$current_action = $_GET['action'] ?? 'dashboard';

// On définit les groupes d'actions pour les menus déroulants
$management_actions = ['listUnivers', 'listPlans'];
$data_actions = ['showImport', 'export'];
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
    <a class="nav-link <?= ($current_action == 'listPlans') ? 'active' : '' ?>" href="index.php?action=listPlans">Plan du magasin</a>
</li>
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle <?= in_array($current_action, ['create', 'showBatchCreate']) ? 'active' : '' ?>" href="#" id="addDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                        Ajouter
                    </a>
                    <ul class="dropdown-menu" aria-labelledby="addDropdown">
                        <li><a class="dropdown-item" href="index.php?action=create">Ajouter un code</a></li>
                        <li><a class="dropdown-item" href="index.php?action=showBatchCreate">Ajout par lot</a></li>
                    </ul>
                </li>

                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle <?= in_array($current_action, $management_actions) ? 'active' : '' ?>" href="#" id="managementDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                        Gestion
                    </a>
                    <ul class="dropdown-menu" aria-labelledby="managementDropdown">
                        <li><a class="dropdown-item" href="index.php?action=listUnivers">Gérer les univers</a></li>
                        <li><a class="dropdown-item" href="index.php?action=listPlans">Gérer les plans</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="index.php?action=fullHistory">Historique global</a></li>
                    </ul>
                </li>

                 <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle <?= in_array($current_action, $data_actions) ? 'active' : '' ?>" href="#" id="dataDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                        Données
                    </a>
		 <ul class="dropdown-menu" aria-labelledby="dataDropdown">
    			<li><a class="dropdown-item" href="index.php?action=showImport">Importer</a></li>
    			<li><a class="dropdown-item" href="index.php?action=showExport">Exporter</a></li>
		 </ul>
                </li>
            </ul>

            <div class="d-flex align-items-center">
                <input class="form-control me-2" type="search" id="recherche" placeholder="Rechercher...">
                <div class="print-menu">
                    <button id="print-btn" class="btn btn-outline-secondary">🖨️ Imprimer</button>
                    <div class="print-options dropdown-menu">
                        <a class="dropdown-item" href="javascript:window.print();">Imprimer la vue actuelle</a>
                        <a class="dropdown-item" href="index.php?action=printLabels" target="_blank">Imprimer des étiquettes</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</nav>
