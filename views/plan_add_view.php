<?php $title = 'Ajouter un Nouveau Plan'; ?>

<?php ob_start(); // Début capture pour styles/scripts spécifiques ?>
<style>
    /* Optionnel: Style pour la zone de sélection des univers */
    .univers-checkbox-list {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid #ccc;
        padding: 1rem;
        border-radius: 4px;
        background-color: #f8f9fa;
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
                        <label for="planFile" class="form-label">Fichier du Plan <span class="text-danger">*</span></label>
                        <input class="form-control" type="file" id="planFile" name="planFile" accept=".jpg,.jpeg,.png,.svg,.pdf" required>
                        <div class="form-text">Formats autorisés : JPG, PNG, SVG, PDF.</div>
                        <div class="invalid-feedback">
                            Veuillez sélectionner un fichier valide.
                        </div>
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
                         <div class="form-text">Utile pour filtrer les plans dans la liste.</div>
                    </div>

                </div>

                <div class="col-md-6">
                    <label class="form-label">Univers Associés (Optionnel)</label>
                    <div class="univers-checkbox-list mb-3">
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
                     <div class="form-text">Permet de déterminer quels codes géo seront disponibles sur ce plan.</div>
                </div>

            </div>

            <hr class="my-4">

            <div class="d-flex justify-content-end">
                <button type="submit" class="btn btn-primary btn-lg">
                    <i class="bi bi-check-lg"></i> Enregistrer le nouveau plan
                </button>
            </div>

        </form>
    </section>
</div>

<?php ob_start(); // Début capture pour JS spécifique si besoin ?>
<script>
// Activer la validation Bootstrap standard
(function () {
  'use strict'
  var forms = document.querySelectorAll('.needs-validation')
  Array.prototype.slice.call(forms)
    .forEach(function (form) {
      form.addEventListener('submit', function (event) {
        if (!form.checkValidity()) {
          event.preventDefault()
          event.stopPropagation()
        }
        form.classList.add('was-validated')
      }, false)
    })
})()
</script>
<?php $body_scripts = ob_get_clean(); ?>
