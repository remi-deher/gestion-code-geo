<?php
// Vue: plan_editor_view.php
// !! N'utilise PAS le layout standard !!
$title = $title ?? 'Éditeur de Plan'; // Utilise le titre passé par le contrôleur ou un défaut
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($title) ?></title>

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

    <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js" integrity="sha512-CeIsOAsgJnmevfCi2C7Zsyy6bQKi43utIjdA87Q0ZY84oDqnI0uwfM9+bKiIkI75lUeI00WG/+uJzOmuHlesMA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

    <link rel="stylesheet" href="css/pages/_plan-editor.css"> <?php // Fichier CSS à créer ?>

    <style>
        /* Styles pour le mode plein écran */
        html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden; /* Empêche le défilement de la page */
        }
        #editor-container {
            display: flex;
            flex-direction: column;
            height: 100vh; /* Prend toute la hauteur de la fenêtre */
        }
        #canvas-wrapper {
            flex-grow: 1; /* Prend l'espace restant */
            position: relative;
            overflow: hidden; /* Empêche le canvas de déborder */
             background-color: #f8f9fa; /* Fond gris clair pour la zone du canvas */
        }
         #plan-canvas {
            /* Le canvas lui-même sera dimensionné par Fabric.js */
            /* border: 1px dashed #ccc; */ /* Pour visualiser la zone */
        }
    </style>
</head>
<body>

    <div id="editor-container">
        <nav class="navbar navbar-light bg-light py-1 px-3 border-bottom shadow-sm editor-controls">
            <div class="d-flex align-items-center gap-3">
                <a href="index.php?action=listPlans" class="btn btn-outline-secondary btn-sm" title="Retour à la liste des plans">
                    <i class="bi bi-arrow-left-circle-fill fs-5"></i>
                    <span class="d-none d-md-inline ms-1">Retour</span>
                </a>
                <h5 class="mb-0 text-truncate" title="<?= htmlspecialchars($currentPlan['nom']) ?>">
                     <i class="bi bi-map"></i> <?= htmlspecialchars($currentPlan['nom']) ?>
                </h5>
            </div>

            <div class="d-flex align-items-center gap-2">
                <button class="btn btn-outline-secondary btn-sm" type="button" data-bs-toggle="offcanvas" data-bs-target="#sidebarOffcanvas" aria-controls="sidebarOffcanvas" title="Afficher Codes Géo & Assets">
                    <i class="bi bi-layout-sidebar-inset fs-5"></i>
                     <span class="d-none d-md-inline ms-1">Codes/Assets</span>
                </button>
                 <button class="btn btn-success btn-sm" id="save-drawing-btn" title="Enregistrer les modifications du dessin">
                    <i class="bi bi-save-fill"></i>
                     <span class="d-none d-md-inline ms-1">Enregistrer</span>
                 </button>
                <button class="btn btn-info btn-sm" id="print-plan-btn" title="Imprimer le plan">
                    <i class="bi bi-printer-fill"></i>
                     <span class="d-none d-md-inline ms-1">Imprimer</span>
                </button>
                <button class="btn btn-warning btn-sm" id="export-plan-btn" title="Exporter le plan">
                    <i class="bi bi-download"></i>
                     <span class="d-none d-md-inline ms-1">Exporter</span>
                </button>
            </div>
        </nav>

        <div class="toolbar bg-light border-bottom p-2 text-center" id="fabric-toolbar">
            <small>Barre d'outils Fabric.js (à venir)</small>
            </div>

        <div id="canvas-wrapper">
            <canvas id="plan-canvas"></canvas>
             <div id="loading-indicator" class="position-absolute top-50 start-50 translate-middle" style="display: none; z-index: 10;">
                 <div class="spinner-border text-primary" role="status">
                     <span class="visually-hidden">Chargement...</span>
                 </div>
            </div>
        </div>
    </div>

    <div class="offcanvas offcanvas-start" tabindex="-1" id="sidebarOffcanvas" aria-labelledby="sidebarOffcanvasLabel">
        <div class="offcanvas-header">
            <h5 class="offcanvas-title" id="sidebarOffcanvasLabel">Codes Géo & Assets</h5>
            <button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body">
            <ul class="nav nav-tabs nav-fill mb-3" id="sidebarTab" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="geocodes-tab" data-bs-toggle="tab" data-bs-target="#geocodes-panel" type="button" role="tab" aria-controls="geocodes-panel" aria-selected="true">
                        <i class="bi bi-geo-alt-fill"></i> Codes Géo
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="assets-tab" data-bs-toggle="tab" data-bs-target="#assets-panel" type="button" role="tab" aria-controls="assets-panel" aria-selected="false">
                         <i class="bi bi-box-seam"></i> Assets
                    </button>
                </li>
            </ul>

            <div class="tab-content" id="sidebarTabContent">
                <div class="tab-pane fade show active" id="geocodes-panel" role="tabpanel" aria-labelledby="geocodes-tab">
                    <h6>Codes Géo Disponibles</h6>
                    <input type="search" id="geocode-search" class="form-control form-control-sm mb-2" placeholder="Filtrer les codes...">
                    <ul class="list-group list-group-flush" id="available-geocodes-list" style="max-height: 70vh; overflow-y: auto;">
                        <?php if (empty($availableGeoCodes)): ?>
                            <li class="list-group-item text-muted small">Aucun code disponible pour ce plan (vérifiez les univers associés ou les codes déjà placés).</li>
                        <?php else: ?>
                            <?php foreach($availableGeoCodes as $code): ?>
                                <li class="list-group-item list-group-item-action available-geocode-item"
                                    data-id="<?= $code['id'] ?>"
                                    data-code="<?= htmlspecialchars($code['code_geo']) ?>"
                                    data-libelle="<?= htmlspecialchars($code['libelle']) ?>"
                                    data-univers-id="<?= $code['univers_id'] ?>"
                                    style="cursor: grab;"
                                    draggable="true"
                                    title="<?= htmlspecialchars($code['libelle']) ?> (<?= htmlspecialchars($code['univers_nom']) ?>)">
                                    <small><?= htmlspecialchars($code['code_geo']) ?></small>
                                </li>
                            <?php endforeach; ?>
                         <?php endif; ?>
                    </ul>
                     <p class="mt-3 small text-muted">Cliquez ou glissez un code sur le plan pour le placer.</p>
                </div>

		<div class="tab-pane fade" id="assets-panel" role="tabpanel" aria-labelledby="assets-tab">
                     <h6>Bibliothèque d'Assets</h6>

                     <input type="search" id="asset-search" class="form-control form-control-sm mb-2" placeholder="Filtrer les assets...">

                     <ul class="list-group list-group-flush" id="available-assets-list" style="max-height: 70vh; overflow-y: auto;">
                         <li id="asset-list-placeholder" class="list-group-item text-muted small">Chargement des assets...</li>
                     </ul>

                     <p class="mt-3 small text-muted">Cliquez ou glissez un asset sur le plan pour le placer.</p>

                     <hr>
                     <a href="index.php?action=manageAssets" class="btn btn-outline-secondary btn-sm mt-2">
                         <i class="bi bi-gear-fill"></i> Gérer la bibliothèque d'assets
                     </a>
                </div>

            </div>
        </div>
    </div>

    <script>
        // Passer les données du contrôleur au JavaScript
        window.planData = {
            currentPlan: <?= json_encode($currentPlan ?? null) ?>,
            placedGeoCodes: <?= json_encode($placedGeoCodes ?? []) ?>,
            availableGeoCodes: <?= json_encode($availableGeoCodes ?? []) ?>,
            universColors: <?= json_encode($universColors ?? []) ?>,
            assets: <?= json_encode($assets ?? []) ?>,
            saveDrawingUrl: 'index.php?action=apiSaveDrawing',
            placeGeoCodeUrl: 'index.php?action=apiPlaceGeoCode',
            removeGeoCodeUrl: 'index.php?action=apiRemoveGeoCode',
            csrfToken: '<?= $csrfToken ?? '' ?>' // Si vous utilisez un token CSRF
        };
    </script>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>

    <script type="module" src="js/plan-editor.js"></script> <?php // Fichier JS principal à créer ?>

</body>
</html>
