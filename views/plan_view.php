<?php $title = 'Édition du Plan : ' . htmlspecialchars($plan['nom']); ?>

<?php ob_start(); ?>
<link rel="stylesheet" href="css/plan_print.css" media="print">
<style>
    /* Styles CSS spécifiques à plan_view.php (inchangés) */
    .drawing-toolbar {
        background-color: #f8f9fa;
        padding: 5px 10px; /* Ajusté */
        border-bottom: 1px solid var(--border-color);
        display: flex; /* Affiché par défaut */
        gap: 8px; /* Espace entre groupes d'outils */
        flex-wrap: wrap;
        align-items: center;
        flex-shrink: 0; /* Ne doit pas rétrécir */
        min-height: 40px; /* Hauteur minimale */
    }
    .drawing-toolbar .btn-group > .btn,
    .drawing-toolbar > .btn {
        padding: 0.25rem 0.5rem;
        font-size: 0.875rem;
        display: inline-flex; /* Pour centrer icônes */
        align-items: center;
        justify-content: center;
    }
    .drawing-toolbar .btn.active {
        background-color: var(--primary-color); /* Couleur Bootstrap pour active */
        color: white;
        border-color: var(--primary-color);
    }
    .drawing-toolbar .form-control-color {
        width: 35px; /* Taille cohérente */
        height: 30px;
        padding: 0.1rem;
        border: 1px solid #ced4da;
        cursor: pointer;
        vertical-align: middle; /* Alignement vertical */
    }
    .drawing-toolbar .form-control-sm {
        height: 30px;
        padding: 0.25rem 0.5rem;
        vertical-align: middle;
    }
    .drawing-toolbar .form-check-label {
        cursor: pointer;
        display: flex;
        align-items: center;
        margin-bottom: 0; /* Important dans flex */
        padding-left: 0.25rem; /* Espace après l'input */
    }
     .drawing-toolbar .form-check-input {
        cursor: pointer;
        margin-top: 0; /* Aligner avec label */
     }
    /* Style pour le guide de page (sera créé par JS) */
    /* .page-guide-rect { /* Pas besoin ici, géré directement par Fabric */ } */
</style>
<?php $head_styles = ob_get_clean(); ?>

<?php ob_start(); ?>
    <script id="plan-data" type="application/json">
    <?= json_encode([
        'placedGeoCodes' => $placedGeoCodes ?? [],
        'universColors' => $universColors ?? [],
        'currentPlan' => $plan ?? null,
        'currentPlanId' => $plan['id'] ?? null,
        'planType' => $planType ?? 'unknown',
        'initialDrawingData' => isset($plan['drawing_data']) ? json_decode($plan['drawing_data']) : null,
        'planUnivers' => $universList ?? [],
        'csrfToken' => null // Mettre un vrai token CSRF ici si vous en utilisez un
    ]); ?>
    </script>
    <script type="module" src="js/plan/main.js"></script>
<?php $body_scripts = ob_get_clean(); ?>

<div class="plan-page-container">
    <div id="unplaced-codes-sidebar" class="no-print">
        <div class="add-code-section">
            <button id="add-code-btn" class="btn btn-primary w-100">
                <i class="bi bi-plus-circle-fill"></i> Ajouter un code
            </button>
        </div>
        <div class="accordion w-100" id="sidebar-accordion">
            <div class="accordion-item">
                <h2 class="accordion-header" id="heading-filters">
                    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-filters" aria-expanded="true" aria-controls="collapse-filters">
                        Filtres
                    </button>
                </h2>
                <div id="collapse-filters" class="accordion-collapse collapse show" aria-labelledby="heading-filters">
                    <div class="accordion-body">
                        <input type="search" id="tag-search-input" placeholder="Rechercher un code..." class="form-control mb-2">
                    </div>
                </div>
            </div>
            <div class="accordion-item">
                <h2 class="accordion-header" id="heading-codes">
                    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-codes" aria-expanded="true" aria-controls="collapse-codes">
                        Codes disponibles <span id="unplaced-counter" class="badge bg-secondary ms-2">0</span>
                    </button>
                </h2>
                <div id="collapse-codes" class="accordion-collapse collapse show" aria-labelledby="heading-codes">
                    <div class="accordion-body p-0" id="unplaced-list-container">
                         <div id="unplaced-list" class="list-group list-group-flush"><p class="text-muted small p-3">Chargement...</p></div>
                    </div>
                </div>
            </div>
             <div class="accordion-item">
                <h2 class="accordion-header" id="heading-legend">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-legend" aria-expanded="false" aria-controls="collapse-legend">
                        Légende
                    </button>
                </h2>
                <div id="collapse-legend" class="accordion-collapse collapse" aria-labelledby="heading-legend">
                    <div class="accordion-body" id="legend-container"><p class="text-muted small">Chargement...</p></div>
                </div>
            </div>
        </div>
    </div>
    <button id="toggle-sidebar-btn" class="btn btn-light no-print" title="Cacher le panneau">
        <i class="bi bi-chevron-left"></i>
    </button>

    <div class="plan-main-content">
        <div class="plan-toolbar no-print">
            <a href="index.php?action=listPlans" class="btn btn-secondary"><i class="bi bi-arrow-left"></i> Retour</a>
            <div class="mx-auto d-flex align-items-center"> <h3 class="mb-0 text-center me-3">
                    <i class="bi bi-pencil-square"></i> Mode Édition : <strong><?= htmlspecialchars($plan['nom']) ?></strong>
                </h3>
                <div class="d-flex align-items-center">
                    <label for="page-format-select" class="form-label mb-0 me-2 small">Format:</label>
                    <select id="page-format-select" class="form-select form-select-sm" style="width: auto;">
                        <option value="custom" selected>Libre (Canvas)</option>
                        <option value="A4_landscape">A4 Paysage</option>
                        <option value="A4_portrait">A4 Portrait</option>
                        <option value="A3_landscape">A3 Paysage</option>
                        <option value="A3_portrait">A3 Portrait</option>
                    </select>
                </div>
            </div>
            <div class="d-flex gap-2 align-items-center">
                 <button class="btn btn-secondary" type="button" data-bs-toggle="offcanvas" data-bs-target="#assetsOffcanvas" aria-controls="assetsOffcanvas" title="Assets">
                    <i class="bi bi-star-fill"></i>
                </button>
                 <button id="save-drawing-btn" class="btn btn-success"><i class="bi bi-save"></i> Sauvegarder...</button> <a href="index.php?action=printPlan&id=<?= $plan['id'] ?>" class="btn btn-info" target="_blank" title="Imprimer le plan">
                    <i class="bi bi-printer-fill"></i>
                 </a>
                 <button class="btn btn-secondary" id="fullscreen-btn" title="Plein écran">
                    <i class="bi bi-arrows-fullscreen"></i>
                 </button>
            </div>
        </div>

        <div id="drawing-toolbar" class="drawing-toolbar no-print">
             <div class="btn-group" role="group" aria-label="Drawing Tools">
                <button type="button" class="btn btn-outline-secondary tool-btn active" data-tool="select" title="Sélectionner/Déplacer"><i class="bi bi-cursor-fill"></i></button>
                <button type="button" class="btn btn-outline-secondary tool-btn" data-tool="rect" title="Rectangle (double-clic pour texte)"><i class="bi bi-square"></i></button>
                <button type="button" class="btn btn-outline-secondary tool-btn" data-tool="line" title="Ligne"><i class="bi bi-slash-lg"></i></button>
                <button type="button" class="btn btn-outline-secondary tool-btn" data-tool="circle" title="Cercle (double-clic pour texte)"><i class="bi bi-circle"></i></button>
                <button type="button" class="btn btn-outline-secondary tool-btn" data-tool="text" title="Texte libre"><i class="bi bi-fonts"></i></button>
             </div>
             <div class="btn-group ms-2" role="group" aria-label="Object Manipulation">
                 <button type="button" id="copy-btn" class="btn btn-outline-secondary" title="Copier la forme sélectionnée"><i class="bi bi-clipboard"></i></button>
                 <button type="button" id="paste-btn" class="btn btn-outline-secondary" title="Coller la forme"><i class="bi bi-clipboard-plus"></i></button>
                 <button type="button" id="delete-shape-btn" class="btn btn-outline-danger" title="Supprimer la forme sélectionnée"><i class="bi bi-trash3"></i></button>
            </div>
            <div class="btn-group ms-2" role="group" aria-label="Grouping">
                <button type="button" id="group-btn" class="btn btn-outline-secondary" title="Grouper la sélection" disabled><i class="bi bi-bounding-box"></i></button>
                <button type="button" id="ungroup-btn" class="btn btn-outline-secondary" title="Dégrouper la sélection" disabled><i class="bi bi-box-arrow-in-down-right"></i></button>
            </div>
            <div class="ms-2 d-flex align-items-center">
                <label for="stroke-color" class="form-label me-1 mb-0 visually-hidden">Couleur</label>
                <input type="color" id="stroke-color" class="form-control form-control-color" value="#000000" title="Couleur Trait/Texte/Remplissage">
                <label for="stroke-width" class="form-label ms-2 me-1 mb-0 visually-hidden">Épaisseur</label>
                <input type="number" id="stroke-width" class="form-control form-control-sm" value="2" min="1" max="50" style="width: 60px;" title="Épaisseur du trait">
                 <div class="form-check form-switch ms-3" title="Remplir la forme (au lieu de juste le contour)">
                    <input class="form-check-input" type="checkbox" id="fill-shape-toggle">
                    <label class="form-check-label" for="fill-shape-toggle"><i class="bi bi-paint-bucket"></i></label>
                </div>
                <input type="color" id="fill-color" class="form-control form-control-color ms-1" value="#cccccc" title="Couleur de remplissage" style="display:none;">
            </div>
            <div class="ms-auto d-flex align-items-center">
                 <div class="form-check form-switch me-3">
                    <input class="form-check-input" type="checkbox" id="grid-toggle">
                    <label class="form-check-label" for="grid-toggle" title="Afficher/Cacher la grille"><i class="bi bi-grid-3x3-gap-fill"></i></label>
                </div>
                 <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="snap-toggle">
                    <label class="form-check-label" for="snap-toggle" title="Activer/Désactiver le magnétisme"><i class="bi bi-magnet-fill"></i></label>
                </div>
            </div>
        </div>

        <div id="plan-container">
            <div id="plan-loader" class="spinner-border text-primary" role="status" style="display: none;"><span class="visually-hidden">Loading...</span></div>
            <canvas id="plan-canvas"></canvas>
            <?php if ($planType === 'image' && isset($plan['nom_fichier'])): ?>
                <img src="uploads/plans/<?= htmlspecialchars($plan['nom_fichier']) ?>" alt="Plan source" id="map-image" style="display: none;">
            <?php endif; ?>
            <div id="zoom-controls" class="no-print">
                <button class="btn btn-light" id="zoom-in-btn" title="Zoomer"><i class="bi bi-zoom-in"></i></button>
                <button class="btn btn-light" id="zoom-out-btn" title="Dézoomer"><i class="bi bi-zoom-out"></i></button>
                <button class="btn btn-light" id="zoom-reset-btn" title="Réinitialiser le zoom"><i class="bi bi-aspect-ratio"></i></button>
            </div>
        </div>

        <div id="tag-edit-toolbar" class="tag-toolbar no-print">
            <button id="toolbar-highlight" class="btn btn-sm btn-info" title="Surligner toutes les instances"><i class="bi bi-search"></i></button>
            <button id="toolbar-arrow" class="btn btn-sm btn-secondary" title="Ajouter/Modifier la flèche"><i class="bi bi-arrow-up-right"></i></button>
            <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-secondary size-btn" data-size="small">S</button>
                <button type="button" class="btn btn-secondary size-btn" data-size="medium">M</button>
                <button type="button" class="btn btn-secondary size-btn" data-size="large">L</button>
            </div>
            <button id="toolbar-delete" class="btn btn-sm btn-danger" title="Supprimer le tag géo"><i class="bi bi-trash"></i></button>
        </div>
    </div>
</div>

<div class="modal fade" id="add-code-modal" tabindex="-1" aria-labelledby="addCodeModalLabel" aria-hidden="true">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addCodeModalLabel">Ajouter un nouveau code géo</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="add-code-form">
                    <div class="mb-3">
                        <label for="new-code-geo" class="form-label">Code Géo</label>
                        <input type="text" class="form-control" id="new-code-geo" name="code_geo" required>
                    </div>
                    <div class="mb-3">
                        <label for="new-libelle" class="form-label">Libellé</label>
                        <input type="text" class="form-control" id="new-libelle" name="libelle" required>
                    </div>
                    <div class="mb-3">
                        <label for="new-univers-id" class="form-label">Univers</label>
                        <select class="form-select" id="new-univers-id" name="univers_id" required></select>
                    </div>
                    <div class="mb-3">
                        <label for="new-commentaire" class="form-label">Commentaire (optionnel)</label>
                        <textarea class="form-control" id="new-commentaire" name="commentaire"></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
                <button type="button" class="btn btn-primary" id="save-new-code-btn">Enregistrer</button>
            </div>
        </div>
    </div>
</div>

<div class="toast-container position-fixed bottom-0 end-0 p-3" id="toast-notification-container" style="z-index: 1100">
</div>
