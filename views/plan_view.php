<?php $title = 'Édition du Plan : ' . htmlspecialchars($plan['nom']); ?>

<?php ob_start(); ?>
<link rel="stylesheet" href="css/plan_print.css" media="print">
<style>
    /* Styles pour la barre latérale et la légende */
    .sidebar-accordion .accordion-item { border-bottom: 1px solid var(--border-color); }
    .sidebar-accordion .accordion-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; cursor: pointer; background-color: #fff; user-select: none; }
    .sidebar-accordion .accordion-header:hover { background-color: var(--light-gray); }
    .sidebar-accordion .accordion-header h3 { margin: 0; font-size: 1.1rem; }
    .sidebar-accordion .accordion-arrow { font-weight: bold; transition: transform 0.3s ease; }
    .sidebar-accordion .accordion-content { max-height: 0; overflow: hidden; transition: max-height 0.3s ease, padding 0.3s ease; padding: 0 1rem; }
    .sidebar-accordion .accordion-item.open .accordion-content { max-height: 500px; padding: 1rem; overflow-y: auto; }
    .sidebar-accordion .accordion-item.open .accordion-arrow { transform: rotate(90deg); }
    #unplaced-list .unplaced-item { cursor: pointer; background-color: var(--light-gray); padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border-color); margin-bottom: 0.5rem; }
    #unplaced-list .unplaced-item:hover, .unplaced-item.placement-active { background-color: #e9ecef; }
    .unplaced-item .item-code { font-weight: bold; }
    .unplaced-item .item-libelle { font-size: 0.8rem; color: #6c757d; }
    .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .legend-color-box { width: 15px; height: 15px; border: 1px solid #ccc; border-radius: 3px; }
    #history-list .history-item { font-size: 0.85rem; padding: 0.5rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
</style>
<?php $head_styles = ob_get_clean(); ?>

<?php ob_start(); ?>
<script>
    let placedGeoCodes = <?= json_encode($placedGeoCodes ?? []); ?>;
    const universColors = <?= json_encode($universColors ?? []); ?>;
    // On passe l'objet complet du plan actuel au JavaScript
    const currentPlan = <?= json_encode($plan); ?>;
    const currentPlanId = currentPlan.id;
</script>
<script src="js/plan.js"></script> 
<?php $body_scripts = ob_get_clean(); ?>

<div class="plan-page-container">
    <div id="unplaced-codes-sidebar" class="no-print">
        <div class="sidebar-accordion">
            <div class="accordion-item open">
                <div class="accordion-header"><h3>Filtres</h3><span class="accordion-arrow">▶</span></div>
                <div class="accordion-content">
                    <input type="search" id="tag-search-input" placeholder="Rechercher un code..." class="form-control mb-3">
                    <p class="small text-muted">Filtre la liste des codes à placer.</p>
                </div>
            </div>
            <div class="accordion-item open">
                <div class="accordion-header"><h3>Codes à placer <span id="unplaced-counter">(0)</span></h3><span class="accordion-arrow">▶</span></div>
                <div class="accordion-content" id="unplaced-list-container">
                    <div id="unplaced-list"><p class="text-muted small">Veuillez sélectionner un plan.</p></div>
                </div>
            </div>
             <div class="accordion-item">
                <div class="accordion-header"><h3>Légende</h3><span class="accordion-arrow">▶</span></div>
                <div class="accordion-content" id="legend-container">
                    </div>
            </div>
        </div>
    </div>

    <button id="toggle-sidebar-btn" class="btn btn-light no-print" title="Cacher le panneau">
        <i class="bi bi-chevron-left"></i>
    </button>

    <div class="plan-main-content">
        <div class="plan-toolbar no-print">
            <a href="index.php?action=listPlans" class="btn btn-secondary"><i class="bi bi-arrow-left"></i> Retour aux plans</a>
            
            <div class="mx-auto">
                <h3 class="mb-0 text-center">
                    <i class="bi bi-pencil-square"></i> Mode Édition : <strong><?= htmlspecialchars($plan['nom']) ?></strong>
                </h3>
            </div>

            <button class="btn btn-primary" id="print-plan-btn" data-bs-toggle="modal" data-bs-target="#print-options-modal">
                <i class="bi bi-printer-fill"></i> Imprimer
            </button>
            <button class="btn btn-secondary" id="fullscreen-btn" title="Plein écran">
                <i class="bi bi-arrows-fullscreen"></i>
            </button>
        </div>

        <div id="plan-container">
            <div id="plan-loader" class="spinner-border text-primary" role="status" style="display: none;">
                <span class="visually-hidden">Loading...</span>
            </div>
            
            <canvas id="plan-canvas"></canvas>
            
            <img src="uploads/plans/<?= htmlspecialchars($plan['nom_fichier']) ?>" alt="Plan du magasin" id="map-image" style="display: none;">
            
            <div id="plan-placeholder" class="no-print" style="display: none;"><p>Veuillez sélectionner un plan pour commencer.</p></div>

            <div id="zoom-controls" class="no-print">
                <button class="btn btn-light" id="zoom-in-btn" title="Zoomer"><i class="bi bi-zoom-in"></i></button>
                <button class="btn btn-light" id="zoom-out-btn" title="Dézoomer"><i class="bi bi-zoom-out"></i></button>
                <button class="btn btn-light" id="zoom-reset-btn" title="Réinitialiser le zoom"><i class="bi bi-aspect-ratio"></i></button>
            </div>
        </div>
        
        <div id="tag-edit-toolbar" class="tag-toolbar no-print">
            <button id="toolbar-arrow" class="btn btn-sm btn-secondary" title="Ajouter/Modifier la flèche"><i class="bi bi-arrow-up-right"></i></button>
            <button id="toolbar-resize" class="btn btn-sm btn-secondary" title="Redimensionner"><i class="bi bi-arrows-fullscreen"></i></button>
            <button id="toolbar-delete" class="btn btn-sm btn-danger" title="Supprimer"><i class="bi bi-trash"></i></button>
        </div>
    </div>
</div>

<div class="modal fade" id="print-options-modal" tabindex="-1" aria-labelledby="printOptionsModalLabel" aria-hidden="true">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="printOptionsModalLabel">Options d'impression du plan</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div class="mb-3">
            <label for="print-title" class="form-label">Titre du document (optionnel)</label>
            <input type="text" class="form-control" id="print-title" placeholder="Ex: Plan d'implantation - Hiver 2025">
        </div>
        <div class="form-check form-switch mb-3">
            <input class="form-check-input" type="checkbox" id="print-legend-toggle" checked>
            <label class="form-check-label" for="print-legend-toggle">Inclure la légende des univers</label>
        </div>
        <hr>
        <h6>Filtrer les univers à imprimer</h6>
        <div id="print-univers-filter" class="d-flex flex-wrap gap-2">
            </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
        <button type="button" class="btn btn-primary" id="execute-print-btn">Imprimer</button>
      </div>
    </div>
  </div>
</div>
