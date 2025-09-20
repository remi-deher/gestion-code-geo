<?php $title = 'Modifier le Plan'; ?>

<?php ob_start(); ?>
<style>
    .univers-checkbox-list {
        max-height: 400px;
        overflow-y: auto;
        border: 1px solid var(--border-color);
        padding: 1rem;
        border-radius: 0.375rem; /* Bootstrap 5 radius */
    }
    .univers-checkbox-list .form-check {
        margin-bottom: 0.5rem;
    }
</style>
<?php $head_styles = ob_get_clean(); ?>

<div class="container">
    <section id="plan-edit-form">
        <h2 class="mb-4">Modifier le plan : <?= htmlspecialchars($plan['nom']) ?></h2>

        <div class="card">
            <div class="card-body">
                <form action="index.php?action=updatePlan" method="POST">
                    <input type="hidden" name="plan_id" value="<?= $plan['id'] ?>">

                    <div class="mb-3">
                        <label for="nom" class="form-label">Nom du plan</label>
                        <input type="text" id="nom" name="nom" class="form-control" value="<?= htmlspecialchars($plan['nom']) ?>" required>
                    </div>

                    <div class="mb-3">
                        <label for="zone" class="form-label">Zone de stockage associée</label>
                        <select id="zone" name="zone" class="form-select">
                            <option value="">-- Aucune --</option>
                            <option value="vente" <?= (isset($plan['zone']) && $plan['zone'] == 'vente') ? 'selected' : '' ?>>Zone de Vente</option>
                            <option value="reserve" <?= (isset($plan['zone']) && $plan['zone'] == 'reserve') ? 'selected' : '' ?>>Réserve</option>
                        </select>
                        <div class="form-text">Le choix d'une zone filtrera la liste des univers ci-dessous.</div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Univers associés à ce plan</label>
                        <div class="univers-checkbox-list">
                            <?php if (empty($allUnivers)): ?>
                                <p>Aucun univers n'a été créé. <a href="index.php?action=listUnivers">En créer un</a>.</p>
                            <?php else: ?>
                                <?php foreach ($allUnivers as $univers): ?>
                                    <div class="form-check" data-zone="<?= htmlspecialchars($univers['zone_assignee']) ?>">
                                        <input class="form-check-input" type="checkbox" name="univers_ids[]" value="<?= $univers['id'] ?>" id="univers-<?= $univers['id'] ?>"
                                            <?= in_array($univers['id'], $plan['univers_ids']) ? 'checked' : '' ?>>
                                        <label class="form-check-label" for="univers-<?= $univers['id'] ?>">
                                            <?= htmlspecialchars($univers['nom']) ?>
                                        </label>
                                    </div>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </div>
                    </div>

                    <div class="d-flex justify-content-end gap-2 mt-4">
                        <a href="index.php?action=listPlans" class="btn btn-secondary">Annuler</a>
                        <button type="submit" class="btn btn-primary">Enregistrer les modifications</button>
                    </div>
                </form>
            </div>
        </div>
    </section>
</div>

<?php ob_start(); ?>
<script>
document.addEventListener('DOMContentLoaded', () => {
    const zoneSelect = document.getElementById('zone');
    const universCheckboxes = document.querySelectorAll('.univers-checkbox-list .form-check');

    function filterUnivers() {
        const selectedZone = zoneSelect.value;
        
        universCheckboxes.forEach(checkboxContainer => {
            // Si aucune zone n'est sélectionnée, on affiche tout.
            // Sinon, on n'affiche que les univers correspondant à la zone sélectionnée.
            if (selectedZone === "" || checkboxContainer.dataset.zone === selectedZone) {
                checkboxContainer.style.display = 'block';
            } else {
                checkboxContainer.style.display = 'none';
            }
        });
    }

    // Appelle la fonction une première fois au chargement de la page
    filterUnivers();

    // Ajoute un écouteur d'événement pour réagir aux changements
    zoneSelect.addEventListener('change', filterUnivers);
});
</script>
<?php $body_scripts = ob_get_clean(); ?>
