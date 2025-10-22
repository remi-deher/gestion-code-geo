<?php $title = 'Édition du Plan : ' . htmlspecialchars($plan['nom']); ?>
<?php ob_start(); ?>
<link rel="stylesheet" href="public/css/plan_print.css" media="print">
<style>
    /* Styles pour la modale de sélection de code */
    #codeSelectModal .list-group-item {
        cursor: pointer;
    }
    #codeSelectModal .list-group-item:hover {
        background-color: #f8f9fa;
    }
    #codeSelectModal .modal-body {
        max-height: 60vh; /* Hauteur max pour la liste déroulante */
        overflow-y: auto;
    }

    /* Styles pour le filtre de la modale */
    #modal-code-list .list-group-item.hidden {
        display: none;
    }

    /* Style pour objets SVG verrouillés (optionnel) */
    .svg-locked {
        /* On pourrait ajouter un style visuel, mais Fabric le gère */
    }

    /* Style pour le bouton de verrouillage actif */
    #toggle-lock-svg-btn.active {
        background-color: var(--bs-secondary);
        color: var(--bs-white);
    }
</style>
<?php $head_styles = ob_get_clean(); ?>

<?php ob_start(); ?>
    <script id="plan-data" type="application/json">
    <?= json_encode([
        'placedGeoCodes' => $placedGeoCodes ?? [],
        'universColors' => $universColors ?? [],
        'currentPlan' => $plan ?? null,
        'currentPlanId' => $plan['id'] ?? null,
        'planType' => $planType ?? 'unknown', // 'image', 'svg', ou 'svg_creation'
        'initialDrawingData' => isset($plan['drawing_data']) ? json_decode($plan['drawing_data']) : null,
        'planUnivers' => $universList ?? [],
        'csrfToken' => $_SESSION['csrf_token'] ?? '' // Assurez-vous d'avoir un token CSRF en session
    ]); ?>
    </script>
    <script type="module" src="js/plan/main.js"></script>
<?php $body_scripts = ob_get_clean(); ?>

<div class="plan-page-container">
    <div id="unplaced-codes-sidebar" class="no-print">
       <div class="sidebar-header p-3 border-bottom d-flex justify-content-between align-items-center">
           <h5 class="mb-0">Informations Plan</h5>
           <button id="add-code-btn" class="btn btn-sm btn-outline-primary" title="Ajouter un nouveau code géo à la base">
               <i class="bi bi-plus-circle"></i> Ajouter
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
                        <input type="search" id="tag-search-input" placeholder="Filtrer les listes..." class="form-control mb-2">
                        </div>
                </div>
            </div>

            <div class="accordion-item">
                <h2 class="accordion-header" id="heading-codes-placed">
                    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-codes-placed" aria-expanded="true" aria-controls="collapse-codes-placed">
                        Codes Placés <span id="placed-counter" class="badge bg-primary ms-2">0</span>
                    </button>
                </h2>
                <div id="collapse-codes-placed" class="accordion-collapse collapse show" aria-labelledby="heading-codes-placed">
                    <div class="accordion-body p-0" id="placed-list-container" style="max-height: 30vh; overflow-y: auto;">
                         <div id="placed-list" class="list-group list-group-flush"><p class="text-muted small p-3">Chargement...</p></div>
                    </div>
                </div>
            </div>

            <div class="accordion-item">
                <h2 class="accordion-header" id="heading-codes-dispo">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-codes-dispo" aria-expanded="false" aria-controls="collapse-codes-dispo">
                        Codes Disponibles <span id="dispo-counter" class="badge bg-secondary ms-2">0</span>
                    </button>
                </h2>
                <div id="collapse-codes-dispo" class="accordion-collapse collapse" aria-labelledby="heading-codes-dispo">
                    <div class="accordion-body p-0" id="dispo-list-container" style="max-height: 40vh; overflow-y: auto;">
                         <div id="dispo-list" class="list-group list-group-flush"><p class="text-muted small p-3">Chargement...</p></div>
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
    <button id="toggle-sidebar-btn" class="btn btn-light no-print" title="Afficher/Cacher le panneau">
        <i class="bi bi-chevron-left"></i>
    </button>

    <div class="plan-main-content">

        <div class="plan-toolbar no-print">
            <a href="index.php?action=listPlans" class="btn btn-secondary"><i class="bi bi-arrow-left"></i> Retour</a>

             <div class="mx-auto d-flex align-items-center">
                <h3 class="mb-0 text-center me-3">
                    <i class="bi bi-pencil-square"></i> Mode Édition : <strong><?= htmlspecialchars($plan['nom']) ?></strong>
                </h3>

                <select id="page-format-select" class="form-select form-select-sm" style="width: auto;" title="Afficher un guide de page">
                    <option value="none">Pas de guide</option>
                    <option value="A4-P">A4 Portrait</option>
                    <option value="A4-L">A4 Paysage</option>
                    <option value="A3-P">A3 Portrait</option>
                    <option value="A3-L">A3 Paysage</option>
                 </select>
             </div>

            <div class="d-flex gap-2 align-items-center">
                 <?php if ($planType === 'svg'): ?>
                 <button id="toggle-lock-svg-btn" class="btn btn-outline-secondary active" title="Verrouiller/Déverrouiller les éléments du plan (Ctrl+L)">
                     <i class="bi bi-lock-fill"></i> <span class="btn-text">Verrouillé</span>
                 </button>
                 <?php endif; ?>

                 <button class="btn btn-secondary" type="button" data-bs-toggle="offcanvas" data-bs-target="#assetsOffcanvas" aria-controls="assetsOffcanvas" title="Assets (Formes/Textes pré-enregistrés)">
                    <i class="bi bi-star-fill"></i>
                 </button>

                 <button id="save-drawing-btn" class="btn btn-success"><i class="bi bi-save"></i> Sauvegarder</button>

                 <a href="index.php?action=printPlan&id=<?= $plan['id'] ?>" class="btn btn-info" target="_blank" title="Imprimer le plan">
                    <i class="bi bi-printer-fill"></i>
                 </a>

                 <button class="btn btn-secondary" id="fullscreen-btn" title="Plein écran">
                    <i class="bi bi-arrows-fullscreen"></i>
                 </button>
            </div>
        </div>

        <div id="drawing-toolbar" class="drawing-toolbar no-print">
            <div class="btn-group me-2" role="group" aria-label="Drawing Tools">
                <button type="button" class="btn btn-outline-secondary tool-btn active" data-tool="select" title="Sélectionner/Déplacer (V)"><i class="bi bi-cursor-fill"></i></button>
                <button type="button" class="btn btn-outline-secondary tool-btn" data-tool="rect" title="Rectangle (R)"><i class="bi bi-square"></i></button>
                <button type="button" class="btn btn-outline-secondary tool-btn" data-tool="line" title="Ligne (L)"><i class="bi bi-slash-lg"></i></button>
                <button type="button" class="btn btn-outline-secondary tool-btn" data-tool="circle" title="Cercle (C)"><i class="bi bi-circle"></i></button>
                <button type="button" class="btn btn-outline-secondary tool-btn" data-tool="text" title="Texte libre (T)"><i class="bi bi-fonts"></i></button>
             </div>

             <!-- AJOUT DES BOUTONS GROUPER/DÉGROUPER -->
             <div class="btn-group me-2" role="group" aria-label="Object Manipulation">
                <button type="button" class="btn btn-outline-secondary" id="group-btn" title="Grouper (Ctrl+G)" disabled><i class="bi bi-collection"></i></button>
                <button type="button" class="btn btn-outline-secondary" id="ungroup-btn" title="Dégrouper (Ctrl+Shift+G)" disabled><i class="bi bi-box-arrow-up-right"></i></button>
             </div>
             <!-- FIN DE L'AJOUT -->

             <div class="btn-group me-2" role="group" aria-label="Clipboard">
                 <button type="button" class="btn btn-outline-secondary" id="copy-btn" title="Copier (Ctrl+C)"><i class="bi bi-clipboard"></i></button>
                 <button type="button" class="btn btn-outline-secondary" id="paste-btn" title="Coller (Ctrl+V)"><i class="bi bi-clipboard-plus"></i></button>
             </div>

             <div class="btn-group me-2" role="group" aria-label="Grid/Snap">
                <input type="checkbox" class="btn-check" id="grid-toggle" autocomplete="off">
                <label class="btn btn-outline-secondary" for="grid-toggle" title="Afficher la grille"><i class="bi bi-grid-3x3-gap"></i></label>

                <input type="checkbox" class="btn-check" id="snap-toggle" autocomplete="off">
                <label class="btn btn-outline-secondary" for="snap-toggle" title="Magnétisme à la grille"><i class="bi bi-magnet"></i></label>
            </div>

             <div class="d-flex align-items-center gap-2" style="margin-left: auto;">
                <label for="stroke-color-picker" class="form-label mb-0 small" title="Couleur du contour">Contour:</label>
                <input type="color" class="form-control form-control-color" id="stroke-color-picker" value="#000000" title="Couleur du contour">

                <label for="fill-color-picker" class="form-label mb-0 small" title="Couleur de remplissage">Fond:</label>
                <input type="color" class="form-control form-control-color" id="fill-color-picker" value="#FFFFFF" title="Couleur de remplissage">
                <button type="button" class="btn btn-sm btn-outline-secondary" id="fill-transparent-btn" title="Fond transparent"><i class="bi bi-slash-circle"></i></button>
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

<select id="page-format-select" class="form-select form-select-sm">
  <option value="Original">Taille Originale</option>
  <option value="A4_Portrait">A4 Portrait</option>
  <option value="A4_Landscape">A4 Paysage</option>
  <option value="A3_Portrait">A3 Portrait</option>
  <option value="A3_Landscape">A3 Paysage</option>
</select>

        <div id="tag-edit-toolbar" class="tag-toolbar no-print">
             <button id="toolbar-highlight" class="btn btn-sm btn-info" title="Surligner toutes les instances"><i class="bi bi-search"></i></button>

             <button id="toolbar-arrow" class="btn btn-sm btn-secondary" title="Ajouter/Modifier la flèche"><i class="bi bi-arrow-up-right"></i></button>

             <div class="btn-group btn-group-sm" role="group" id="toolbar-size-group">
                <button type="button" class="btn btn-secondary size-btn" data-size="small">S</button>
                <button type="button" class="btn btn-secondary size-btn" data-size="medium">M</button>
                <button type="button" class="btn btn-secondary size-btn" data-size="large">L</button>
            </div>

             <button id="toolbar-delete" class="btn btn-sm btn-danger" title="Supprimer (Suppr)"><i class="bi bi-trash"></i></button>
        </div>
    </div>
</div>

<div class="modal fade" id="codeSelectModal" tabindex="-1" aria-labelledby="codeSelectModalLabel" aria-hidden="true">
  <div class="modal-dialog modal-lg"> <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="codeSelectModalLabel">Sélectionner un Code Géo à Placer</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
         <input type="search" id="modal-code-search" class="form-control mb-3" placeholder="Filtrer les codes...">
         <div id="modal-code-list" class="list-group">
            <p class="text-muted">Chargement des codes disponibles...</p>
         </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
        </div>
    </div>
  </div>
</div>


<div class="modal fade" id="add-code-modal" tabindex="-1" aria-labelledby="addCodeModalLabel" aria-hidden="true">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addCodeModalLabel">Ajouter un nouveau Code Géo</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="add-code-form">
                    <div class="mb-3">
                        <label for="new-code-geo" class="form-label">Code Géo <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="new-code-geo" required>
                    </div>
                    <div class="mb-3">
                        <label for="new-libelle" class="form-label">Libellé</label>
                        <input type="text" class="form-control" id="new-libelle">
                    </div>
                    <div class="mb-3">
                        <label for="new-univers-id" class="form-label">Univers <span class="text-danger">*</span></label>
                        <select class="form-select" id="new-univers-id" required>
                            <option value="">Sélectionner un univers...</option>
                            </select>
                    </div>
                     <div class="mb-3">
                        <label for="new-commentaire" class="form-label">Commentaire</label>
                        <textarea class="form-control" id="new-commentaire" rows="2"></textarea>
                    </div>
                    <div class="mb-3">
                        <label for="new-zone" class="form-label">Zone</label>
                        <input type="text" class="form-control" id="new-zone">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
                <button type="button" class="btn btn-primary" id="save-new-code-btn">
                    <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" style="display: none;"></span>
                    Enregistrer
                </button>
            </div>
        </div>
    </div>
</div>

<div class="offcanvas offcanvas-end" tabindex="-1" id="assetsOffcanvas" aria-labelledby="assetsOffcanvasLabel">
  <div class="offcanvas-header">
    <h5 id="assetsOffcanvasLabel">Assets</h5>
    <button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
  </div>
  <div class="offcanvas-body">
    <p class="small text-muted">Sélectionnez un ou plusieurs objets (textes, formes) sur le plan, puis cliquez sur "Enregistrer la sélection" pour créer un asset réutilisable.</p>
    <button class="btn btn-primary w-100 mb-3" id="save-asset-btn">
        <i class="bi bi-plus-circle"></i> Enregistrer la sélection comme Asset
    </button>
    <hr>
    <h6>Assets disponibles</h6>
    <div id="assets-list" class="list-group">
        <p class="text-muted small">Chargement...</p>
    </div>
  </div>
</div>

<div class="toast-container position-fixed bottom-0 end-0 p-3" id="toast-notification-container" style="z-index: 1100">
</div>

