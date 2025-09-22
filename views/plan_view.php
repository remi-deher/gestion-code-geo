<?php $title = 'Plan du Magasin'; ?>

<?php ob_start(); ?>
<link rel="stylesheet" href="css/plan_print.css" media="print">
<style>
    .sidebar-accordion .accordion-item { border-bottom: 1px solid var(--border-color); }
    .sidebar-accordion .accordion-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; cursor: pointer; background-color: #fff; user-select: none; }
    .sidebar-accordion .accordion-header:hover { background-color: var(--light-gray); }
    .sidebar-accordion .accordion-header h3 { margin: 0; font-size: 1.1rem; }
    .sidebar-accordion .accordion-arrow { font-weight: bold; transition: transform 0.3s ease; }
    .sidebar-accordion .accordion-content { max-height: 0; overflow: hidden; transition: max-height 0.3s ease, padding 0.3s ease; padding: 0 1rem; }
    .sidebar-accordion .accordion-item.open .accordion-content { max-height: 500px; padding: 1rem; overflow-y: auto; }
    .sidebar-accordion .accordion-item.open .accordion-arrow { transform: rotate(90deg); }
    #unplaced-list .unplaced-item { cursor: grab; background-color: var(--light-gray); padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border-color); margin-bottom: 0.5rem; }
    #unplaced-list .unplaced-item:hover { background-color: #e9ecef; }
    .unplaced-item .item-code { font-weight: bold; display: block; }
    .unplaced-item .item-libelle { font-size: 0.8rem; color: #6c757d; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .legend-color-box { width: 15px; height: 15px; border: 1px solid #ccc; border-radius: 3px; }
</style>
<?php $head_styles = ob_get_clean(); ?>

<?php ob_start(); ?>
<script src="https://unpkg.com/@panzoom/panzoom@4.5.1/dist/panzoom.min.js"></script>
<script>
    // On ne passe plus que les codes déjà placés et les couleurs
    const placedGeoCodes = <?= json_encode($placedGeoCodes ?? []); ?>;
    const universColors = <?= json_encode($universColors ?? []); ?>;
</script>
<script src="js/plan.js"></script> 
<?php $body_scripts = ob_get_clean(); ?>


<div class="plan-page-container">
    <div id="unplaced-codes-sidebar" class="no-print">
        <div class="sidebar-accordion">
            <div class="accordion-item open">
                <div class="accordion-header">
                    <h3>Filtres</h3>
                    <span class="accordion-arrow">▶</span>
                </div>
                <div class="accordion-content">
                    <input type="search" id="tag-search-input" placeholder="Rechercher un code..." class="form-control mb-3">
                    <p class="small text-muted">Les filtres s'appliquent sur la liste des codes à placer et sur les étiquettes du plan.</p>
                </div>
            </div>
            <div class="accordion-item open">
                <div class="accordion-header">
                    <h3>Codes à placer <span id="unplaced-counter">(0)</span></h3>
                    <span class="accordion-arrow">▶</span>
                </div>
                <div class="accordion-content" id="unplaced-list-container">
                    <div id="unplaced-list">
                        <p class="text-muted small">Veuillez sélectionner un plan pour voir les codes disponibles.</p>
                    </div>
                </div>
            </div>
            <div class="accordion-item">
                <div class="accordion-header">
                    <h3>Légende</h3>
                    <span class="accordion-arrow">▶</span>
                </div>
                <div class="accordion-content">
                    <?php if (!empty($universColors)): foreach ($universColors as $univers => $color): ?>
                        <div class="legend-item">
                            <div class="legend-color-box" style="background-color: <?= htmlspecialchars($color) ?>;"></div>
                            <span><?= htmlspecialchars($univers) ?></span>
                        </div>
                    <?php endforeach; endif; ?>
                </div>
            </div>
        </div>
    </div>

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
            <button id="print-plan-btn" class="btn btn-secondary" disabled><i class="bi bi-printer-fill"></i> Imprimer le plan</button>
        </div>
        <div id="plan-container">
            <div id="zoom-wrapper">
                <img src="" alt="Plan du magasin" id="map-image" style="display: none;">
            </div>
            <div id="plan-placeholder" class="no-print"><p>Veuillez sélectionner un plan pour commencer.</p></div>
        </div>
        <div id="zoom-controls" class="no-print">
            <button id="zoom-in-btn" class="btn btn-light" title="Zoomer">+</button>
            <button id="zoom-out-btn" class="btn btn-light" title="Dézoomer">-</button>
            <button id="zoom-reset-btn" class="btn btn-light" title="Réinitialiser">⟲</button>
        </div>
    </div>
</div>

<div class="modal fade" id="geoCodeDetailModal" tabindex="-1" aria-labelledby="geoCodeDetailModalLabel" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="geoCodeDetailModalLabel">Détails du Code Géo</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <p><strong>Code Géo :</strong> <span id="modal-code-geo" class="badge bg-primary fs-6"></span></p>
        <p><strong>Libellé :</strong> <span id="modal-libelle"></span></p>
        <p><strong>Univers :</strong> <span id="modal-univers"></span></p>
        <p><strong>Commentaire :</strong> <span id="modal-commentaire"></span></p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-danger me-auto" id="modal-unplace-btn">
            <i class="bi bi-x-circle-fill"></i> Retirer du plan
        </button>
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
        <a href="#" id="modal-edit-btn" class="btn btn-warning">
            <i class="bi bi-pencil-fill"></i> Modifier
        </a>
      </div>
    </div>
  </div>
</div>
