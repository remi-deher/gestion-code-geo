<?php $title = 'Édition du Plan : ' . htmlspecialchars($plan['nom']); ?>

<?php ob_start(); ?>
<link rel="stylesheet" href="css/plan_print.css" media="print">
<?php $head_styles = ob_get_clean(); ?>

<?php ob_start(); ?>
<script>
    let placedGeoCodes = <?= json_encode($placedGeoCodes ?? []); ?>;
    const universColors = <?= json_encode($universColors ?? []); ?>;
    const currentPlan = <?= json_encode($plan); ?>;
    const currentPlanId = currentPlan.id;
    const planUnivers = <?= json_encode($universList) ?>;
</script>
<script src="js/plan.js"></script> 
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
                    <div class="accordion-body" id="unplaced-list-container">
                         <div id="unplaced-list"><p class="text-muted small">Chargement...</p></div>
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
                    <div class="accordion-body" id="legend-container"></div>
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
            <div class="mx-auto">
                <h3 class="mb-0 text-center">
                    <i class="bi bi-pencil-square"></i> Mode Édition : <strong><?= htmlspecialchars($plan['nom']) ?></strong>
                </h3>
            </div>
            <div class="d-flex gap-2">
                <a href="index.php?action=printPlan&id=<?= $plan['id'] ?>" class="btn btn-info" target="_blank" title="Imprimer le plan">
                    <i class="bi bi-printer-fill"></i>
                </a>
                <button class="btn btn-secondary" id="fullscreen-btn" title="Plein écran">
                    <i class="bi bi-arrows-fullscreen"></i>
                </button>
            </div>
        </div>

        <div id="plan-container">
            <div id="plan-loader" class="spinner-border text-primary" role="status" style="display: none;"><span class="visually-hidden">Loading...</span></div>
            <canvas id="plan-canvas"></canvas>
            <img src="uploads/plans/<?= htmlspecialchars($plan['nom_fichier']) ?>" alt="Plan du magasin" id="map-image" style="display: none;">
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
            <button id="toolbar-delete" class="btn btn-sm btn-danger" title="Supprimer"><i class="bi bi-trash"></i></button>
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

<div id="print-output" class="print-container" style="display:none;">
    <div class="print-header-container"></div>
    <img id="printed-canvas" src="" alt="Plan à imprimer" />
    <div class="print-legend-container"></div>
</div>
