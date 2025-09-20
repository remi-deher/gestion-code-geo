<?php $title = 'Options d\'Impression'; ?>

<div class="container">
    <section>
        <h2>Options d'Impression des Étiquettes</h2>
        <p>Veuillez sélectionner les univers de produits que vous souhaitez imprimer.</p>
        <form action="index.php?action=generatePrint" method="POST" target="_blank">
            <div class="form-group">
                <label><strong>Univers disponibles</strong></label>
                <div class="selection-actions" style="margin-top: 1rem; margin-bottom: 1rem; display: flex; gap: 1rem;">
                    <button type="button" id="select-all">Tout sélectionner</button>
                    <button type="button" id="deselect-all">Tout désélectionner</button>
                </div>
                <div class="univers-selection" style="max-height: 400px; overflow-y: auto; border: 1px solid #dee2e6; padding: 1rem; border-radius: 4px;">
                    <?php foreach ($universList as $univers): ?>
                        <label style="display: block; margin-bottom: 0.5rem;">
                            <input type="checkbox" name="univers_ids[]" value="<?= $univers['id'] ?>" checked>
                            <?= htmlspecialchars($univers['nom']) ?>
                        </label>
                    <?php endforeach; ?>
                </div>
            </div>
            <button type="submit" style="margin-top: 1rem;">Générer et Imprimer</button>
        </form>
    </section>
</div>

<?php ob_start(); ?>
<script>
    document.getElementById('select-all').addEventListener('click', () => {
        document.querySelectorAll('.univers-selection input[type="checkbox"]').forEach(cb => cb.checked = true);
    });
    document.getElementById('deselect-all').addEventListener('click', () => {
        document.querySelectorAll('.univers-selection input[type="checkbox"]').forEach(cb => cb.checked = false);
    });
</script>
<?php $body_scripts = ob_get_clean(); ?>
