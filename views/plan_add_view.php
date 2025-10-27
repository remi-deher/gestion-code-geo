<?php $title = 'Ajouter un Nouveau Plan'; ?>

<?php ob_start(); // Début capture pour styles/scripts spécifiques ?>
<style>
    .univers-checkbox-list {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid #ccc;
        padding: 1rem;
        border-radius: 4px;
        background-color: #f8f9fa;
    }
    .mode-selection .btn {
        width: 100%;
        text-align: left;
    }
    .mode-selection .btn.active {
        box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
    }
    #file-upload-section, #drawing-options-section {
        border-left: 3px solid #0d6efd;
        padding-left: 15px;
        margin-left: -15px;
    }
</style>
<?php $head_styles = ob_get_clean(); ?>

<div class="container">
    <section id="add-plan-form">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="mb-0"><i class="bi bi-file-earmark-plus-fill"></i> Ajouter un Nouveau Plan</h1>
            <a href="index.php?action=listPlans" class="btn btn-outline-secondary">
                <i class="bi bi-arrow-left"></i> Annuler et Retourner à la liste
            </a>
        </div>

        <?php include __DIR__ . '/partials/flash_messages.php'; ?>


        <form action="index.php?action=handleAddPlan" method="POST" enctype="multipart/form-data" class="needs-validation" novalidate>
            <div class="row g-4">
                
                <div class="col-md-6">
                    
                    <div class="mb-3">
                        <label for="nom" class="form-label">Nom du Plan <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="nom" name="nom" required>
                        <div class="invalid-feedback">
                            Veuillez entrer un nom pour le plan.
                        </div>
                    </div>

                     <div class="mb-3">
                        <label for="pageFormat" class="form-label">Format de Page du Plan <span class="text-danger">*</span></label>
                        <select class="form-select" id="pageFormat" name="page_format" required>
                            <option value="">-- Choisir un format --</option>
                            <option value="A4-P">A4 Portrait (210x297 mm)</option>
                            <option value="A4-L">A4 Paysage (297x210 mm)</option>
                            <option value="A3-P">A3 Portrait (297x420 mm)</option>
                            <option value="A3-L">A3 Paysage (420x297 mm)</option>
                            <option value="Custom">Personnalisé (Taille du fichier)</option>
                        </select>
                        <div class="form-text">Ce format définit la taille d'impression réelle du plan.</div>
                        <div class="invalid-feedback">Veuillez choisir le format de page.</div>
                    </div>

                    <div class="mb-3">
                        <label for="description" class="form-label">Description (Optionnel)</label>
                        <textarea class="form-control" id="description" name="description" rows="3"></textarea>
                    </div>

                     <div class="mb-3">
                        <label for="zone" class="form-label">Zone (Optionnel)</label>
                        <select class="form-select" id="zone" name="zone">
                            <option value="">-- Non spécifiée --</option>
                            <option value="vente">Zone de Vente</option>
                            <option value="reserve">Réserve</option>
                        </select>
                    </div>
                </div>

                <div class="col-md-6">
                     <label class="form-label">Mode de création <span class="text-danger">*</span></label>
                     <div class="mb-4 mode-selection">
                         <input type="hidden" name="creation_mode" id="creation-mode" value="import">
                         <div class="btn-group w-100" role="group">
                             <button type="button" class="btn btn-outline-primary active" data-mode="import">
                                 <i class="bi bi-upload"></i> Importer un fichier
                             </button>
                             <button type="button" class="btn btn-outline-primary" data-mode="draw">
                                 <i class="bi bi-pencil-square"></i> Dessiner mon plan
                             </button>
                         </div>
                     </div>
                     
                     <div id="file-upload-section">
                         <div class="mb-3">
                            <label for="planFile" class="form-label">Fichier du Plan <span class="text-danger">*</span></label>
                            <input class="form-control" type="file" id="planFile" name="planFile" accept=".jpg,.jpeg,.png,.svg,.pdf" required>
                            <div class="form-text">Formats autorisés : JPG, PNG, SVG, PDF.</div>
                            <div class="invalid-feedback">
                                Veuillez sélectionner un fichier valide.
                            </div>
                        </div>
                         <div class="mb-4">
                            <label class="form-label">Univers Associés (Optionnel)</label>
                            <div class="univers-checkbox-list">
                                <?php if (empty($universList)): ?>
                                     <p class="text-muted small">Aucun univers n'a été créé.</p>
                                <?php else: ?>
                                    <?php foreach ($universList as $univers): ?>
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" name="univers_ids[]" value="<?= $univers['id'] ?>" id="univers-<?= $univers['id'] ?>">
                                            <label class="form-check-label" for="univers-<?= $univers['id'] ?>">
                                                <?= htmlspecialchars($univers['nom']) ?> (<?= htmlspecialchars(ucfirst($univers['zone_assignee'])) ?>)
                                            </label>
                                        </div>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </div>
                         </div>
                     </div>
                     
                     <div id="drawing-options-section" style="display: none;">
                          <div class="alert alert-info">
                              Un plan vierge sera créé à l'échelle du format choisi.
                          </div>
                          <div class="mb-4">
                            <label class="form-label">Univers Associés (Optionnel)</label>
                            <div class="univers-checkbox-list">
                                <?php if (empty($universList)): ?>
                                     <p class="text-muted small">Aucun univers n'a été créé.</p>
                                <?php else: ?>
                                    <?php foreach ($universList as $univers): ?>
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" name="univers_ids_draw[]" value="<?= $univers['id'] ?>" id="univers-draw-<?= $univers['id'] ?>">
                                            <label class="form-check-label" for="univers-draw-<?= $univers['id'] ?>">
                                                <?= htmlspecialchars($univers['nom']) ?> (<?= htmlspecialchars(ucfirst($univers['zone_assignee'])) ?>)
                                            </label>
                                        </div>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </div>
                         </div>
                     </div>
                </div>

            </div>

            <hr class="my-4">

            <div class="d-flex justify-content-end">
                <button type="submit" class="btn btn-primary btn-lg">
                    <i class="bi bi-check-lg"></i> Créer le plan
                </button>
            </div>

        </form>
    </section>
</div>

<?php ob_start(); ?>
<script>
document.addEventListener('DOMContentLoaded', function() {
    const creationModeInput = document.getElementById('creation-mode');
    const importSection = document.getElementById('file-upload-section');
    const drawSection = document.getElementById('drawing-options-section');
    const importButton = document.querySelector('[data-mode="import"]');
    const drawButton = document.querySelector('[data-mode="draw"]');
    const planFileInput = document.getElementById('planFile');
    const form = document.querySelector('.needs-validation');
    const pageFormatSelect = document.getElementById('pageFormat'); // Le sélecteur est maintenant commun

    function setMode(mode) {
        creationModeInput.value = mode;

        // Mise à jour visuelle des boutons et sections
        if (mode === 'import') {
            importButton.classList.add('active');
            drawButton.classList.remove('active');
            importSection.style.display = 'block';
            drawSection.style.display = 'none';
            planFileInput.required = true;
        } else { // mode === 'draw'
            drawButton.classList.add('active');
            importButton.classList.remove('active');
            drawSection.style.display = 'block';
            importSection.style.display = 'none';
            planFileInput.required = false;
        }
    }

    importButton.addEventListener('click', function(e) {
        e.preventDefault();
        setMode('import');
    });

    drawButton.addEventListener('click', function(e) {
        e.preventDefault();
        setMode('draw');
    });

    // Gestion de la validation pour le champ Fichier
    form.addEventListener('submit', function (event) {
        const isImportMode = (creationModeInput.value === 'import');
        
        // Rendre le champ fichier requis SEULEMENT si mode import
        if (isImportMode) {
             planFileInput.setAttribute('required', 'required');
        } else {
             planFileInput.removeAttribute('required'); 
        }

        // Le champ pageFormat reste requis dans tous les cas grâce au HTML
        
        if (!form.checkValidity()) {
          event.preventDefault()
          event.stopPropagation()
        }
        form.classList.add('was-validated')
    }, false);


    // Initialisation
    setMode(creationModeInput.value); 

    // Activer la validation Bootstrap standard pour les autres champs
    Array.prototype.slice.call(document.querySelectorAll('.needs-validation'))
        .forEach(function (form) {
          form.addEventListener('submit', function (event) {
            if (!form.checkValidity()) {
              event.preventDefault()
              event.stopPropagation()
            }
            form.classList.add('was-validated')
          }, false)
        })
});
</script>
<?php $body_scripts = ob_get_clean(); ?>
