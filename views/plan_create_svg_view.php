<?php $title = 'Créer un Plan SVG'; ?>
<?php ob_start(); ?>
<style>
    /* Styles spécifiques pour la page de création SVG (inchangés) */
    .drawing-toolbar {
        background-color: #f8f9fa;
        padding: 5px;
        border-bottom: 1px solid #dee2e6;
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
        align-items: center;
    }
    .drawing-toolbar .btn-group > .btn, .drawing-toolbar > .btn {
        padding: 0.25rem 0.5rem;
        font-size: 0.875rem;
    }
    .drawing-toolbar .btn.active {
        background-color: var(--bs-primary);
        color: white;
    }
    .drawing-toolbar .form-control-color {
        width: 40px;
        height: 30px;
        padding: 0.1rem;
    }
    .drawing-toolbar .form-control-sm {
        height: 30px;
        padding: 0.25rem 0.5rem;
    }
    .drawing-toolbar .form-check-label {
        cursor: pointer;
    }
    .grid-line { stroke: rgba(0,0,0,0.1); stroke-width: 1; }

    /* Assurer que le conteneur principal prend toute la hauteur */
    .plan-page-container {
        display: flex;
        height: calc(100vh - var(--navbar-height));
        width: 100%;
        margin: 0;
        max-width: 100%;
        padding: 0;
        overflow: hidden;
        position: relative;
    }
     /* Le contenu principal prend toute la largeur car il n'y a pas de sidebar */
    .plan-main-content {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
        width: 100%;
    }
    #plan-container {
        flex-grow: 1;
        background-color: var(--light-gray);
        overflow: hidden;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
<?php $head_styles = ob_get_clean(); ?>

<?php ob_start(); ?>
    <script id="plan-data" type="application/json">
    <?= json_encode([
        'placedGeoCodes' => [], // Vide pour la création
        'universColors' => [], // Vide
        'currentPlan' => null, // Pas de plan existant
        'currentPlanId' => null, // Pas d'ID existant
        'planType' => 'svg_creation', // Type spécifique
        'initialDrawingData' => null, // Pas de dessin initial
        'planUnivers' => [], // Vide
        'csrfToken' => null // Mettre un vrai token CSRF ici si vous en utilisez un
    ]); ?>
    </script>
    <script type="module" src="js/plan/main.js"></script>
<?php $body_scripts = ob_get_clean(); ?>

<div class="plan-page-container">
    <div class="plan-main-content">
        <div class="plan-toolbar no-print">
             <a href="index.php?action=listPlans" class="btn btn-secondary"><i class="bi bi-arrow-left"></i> Retour</a>
             <div class="mx-auto">
                 <h3 class="mb-0 text-center"><i class="bi bi-vector-pen"></i> Créer un Plan SVG</h3>
             </div>
             <div class="d-flex gap-2 align-items-center">
                 <input type="text" id="new-plan-name" class="form-control me-2" placeholder="Nom du nouveau plan..." required style="min-width: 200px;">
                 <button id="save-new-svg-plan-btn" class="btn btn-success flex-shrink-0"><i class="bi bi-save"></i> Enregistrer</button>
             </div>
        </div>

        <div id="drawing-toolbar" class="drawing-toolbar no-print">
             <div class="btn-group" role="group" aria-label="Drawing Tools">
                 <button type="button" class="btn btn-outline-secondary tool-btn active" data-tool="select" title="Sélectionner/Déplacer"><i class="bi bi-cursor-fill"></i></button>
                 <button type="button" class="btn btn-outline-secondary tool-btn" data-tool="rect" title="Rectangle"><i class="bi bi-square"></i></button>
                 <button type="button" class="btn btn-outline-secondary tool-btn" data-tool="line" title="Ligne"><i class="bi bi-slash-lg"></i></button>
                 <button type="button" class="btn btn-outline-secondary tool-btn" data-tool="circle" title="Cercle"><i class="bi bi-circle"></i></button>
             </div>
              <div class="btn-group ms-2" role="group" aria-label="Object Manipulation">
                  <button type="button" id="copy-btn" class="btn btn-outline-secondary" title="Copier la forme sélectionnée"><i class="bi bi-clipboard"></i></button>
                  <button type="button" id="paste-btn" class="btn btn-outline-secondary" title="Coller la forme"><i class="bi bi-clipboard-plus"></i></button>
                  <button type="button" id="delete-shape-btn" class="btn btn-outline-danger" title="Supprimer la forme sélectionnée"><i class="bi bi-trash3"></i></button>
             </div>
             <div class="ms-2 d-flex align-items-center">
                 <label for="stroke-color" class="form-label me-1 mb-0 visually-hidden">Couleur</label>
                 <input type="color" id="stroke-color" class="form-control form-control-color" value="#000000" title="Couleur Trait/Remplissage">
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
                     <input class="form-check-input" type="checkbox" id="grid-toggle" checked>
                     <label class="form-check-label" for="grid-toggle" title="Afficher/Cacher la grille"><i class="bi bi-grid-3x3-gap-fill"></i></label>
                 </div>
                  <div class="form-check form-switch">
                     <input class="form-check-input" type="checkbox" id="snap-toggle" checked>
                     <label class="form-check-label" for="snap-toggle" title="Activer/Désactiver le magnétisme"><i class="bi bi-magnet-fill"></i></label>
                 </div>
             </div>
        </div>

        <div id="plan-container">
             <div id="plan-loader" class="spinner-border text-primary" role="status" style="display: none;"><span class="visually-hidden">Loading...</span></div>
            <canvas id="plan-canvas"></canvas>
            <div id="zoom-controls" class="no-print">
                <button class="btn btn-light" id="zoom-in-btn" title="Zoomer"><i class="bi bi-zoom-in"></i></button>
                <button class="btn btn-light" id="zoom-out-btn" title="Dézoomer"><i class="bi bi-zoom-out"></i></button>
                <button class="btn btn-light" id="zoom-reset-btn" title="Réinitialiser le zoom"><i class="bi bi-aspect-ratio"></i></button>
            </div>
        </div>
    </div>
</div>
<div class="toast-container position-fixed bottom-0 end-0 p-3" id="toast-notification-container" style="z-index: 1100">
</div>
