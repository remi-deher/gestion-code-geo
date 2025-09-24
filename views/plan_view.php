<?php $title = 'Plan du Magasin'; ?>

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
    // Ces données PHP sont utilisées par plan.js
    let placedGeoCodes = <?= json_encode($placedGeoCodes ?? []); ?>;
    const universColors = <?= json_encode($universColors ?? []); ?>;
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
            </div>
    </div>

    <button id="toggle-sidebar-btn" class="btn btn-light no-print" title="Cacher le panneau">
        <i class="bi bi-chevron-left"></i>
    </button>

    <div class="plan-main-content">
        <div class="plan-toolbar no-print">
            <div class="form-group">
                <label for="plan-selector">Choisir un plan :</label>
                <select id="plan-selector" class="form-select">
                    <option value="">-- Sélectionnez un plan --</option>
                    <?php if (!empty($plans)): foreach ($plans as $plan): ?>
                        <option value="<?= $plan['id'] ?>" data-filename="<?= htmlspecialchars($plan['nom_fichier']) ?>"><?= htmlspecialchars($plan['nom']) ?></option>
                    <?php endforeach; endif; ?>
                </select>
            </div>
             </div>

        <div id="plan-container">
            <canvas id="plan-canvas" style="cursor: grab;"></canvas>
            
            <img src="" alt="Plan du magasin" id="map-image" style="display: none;">
            
            <div id="plan-placeholder" class="no-print"><p>Veuillez sélectionner un plan pour commencer.</p></div>
        </div>
        </div>
</div>
