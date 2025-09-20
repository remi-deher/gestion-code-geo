<?php $title = 'Options d\'Impression des Étiquettes'; ?>

<div class="container">
    <section>
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1>Options d'Impression</h1>
        </div>

        <form action="index.php?action=generatePrint" method="POST" target="_blank" class="print-options-form">
            <div class="row">
                <div class="col-lg-8">
                    <div class="card">
                        <div class="card-header">
                            <span class="step-number">1</span> Sélectionner les univers
                        </div>
                        <div class="card-body">
                            <div class="d-flex gap-2 mb-3">
                                <button type="button" class="btn btn-sm btn-outline-secondary" id="select-all">Tout sélectionner</button>
                                <button type="button" class="btn btn-sm btn-outline-secondary" id="deselect-all">Tout désélectionner</button>
                            </div>
                            <div class="univers-selection">
                                <?php if (empty($universList)): ?>
                                    <p class="text-muted">Aucun univers n'a été créé.</p>
                                <?php else: ?>
                                    <?php foreach ($universList as $univers): ?>
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" name="univers_ids[]" value="<?= $univers['id'] ?>" id="univers-<?= $univers['id'] ?>" checked>
                                            <label class="form-check-label" for="univers-<?= $univers['id'] ?>">
                                                <?= htmlspecialchars($univers['nom']) ?>
                                            </label>
                                        </div>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                             <span class="step-number">2</span> Choisir les informations à inclure
                        </div>
                        <div class="card-body field-selection">
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" name="fields[]" value="qrcode" id="field_qrcode" checked>
                                <label class="form-check-label" for="field_qrcode">QR Code</label>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" name="fields[]" value="code_geo" id="field_code_geo" checked>
                                <label class="form-check-label" for="field_code_geo">Code Géo (texte)</label>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" name="fields[]" value="libelle" id="field_libelle" checked>
                                <label class="form-check-label" for="field_libelle">Libellé</label>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" name="fields[]" value="univers" id="field_univers">
                                <label class="form-check-label" for="field_univers">Univers</label>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" name="fields[]" value="commentaire" id="field_commentaire">
                                <label class="form-check-label" for="field_commentaire">Commentaire</label>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-4">
                    <div class="card">
                        <div class="card-header">
                            <span class="step-number">3</span> Mise en page
                        </div>
                        <div class="card-body">
                             <div class="mb-3">
                                <label for="print_title" class="form-label">Titre de la page (optionnel)</label>
                                <input type="text" id="print_title" name="print_title" class="form-control" placeholder="Ex: Inventaire Septembre 2025">
                            </div>
                             <div class="mb-3">
                                <label for="copies" class="form-label">Copies par étiquette</label>
                                <input type="number" id="copies" name="copies" class="form-control" value="1" min="1" max="100">
                            </div>
                            <div class="mb-3">
                                <label for="layout_format" class="form-label">Format des étiquettes</label>
                                <select name="layout_format" id="layout_format" class="form-select">
                                    <option value="medium_2x4">Format moyen (8 par page)</option>
                                    <option value="large_2x2">Grand format (4 par page)</option>
                                    <option value="small_3x7">Petit format (21 par page)</option>
                                </select>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="show_date" value="1" id="show_date" checked>
                                <label class="form-check-label" for="show_date">
                                    Afficher la date de génération
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card sticky-top" style="top: calc(var(--navbar-height) + 1rem);">
                        <div class="card-header"><i class="bi bi-eye-fill"></i> Aperçu en direct</div>
                        <div class="card-body">
                            <div id="preview-box">
                                <div id="label-preview-container" class="print-item">
                                    <div class="print-qr-code" id="preview-qrcode"></div>
                                    <div class="print-details">
                                        <div class="print-code" id="preview-code-geo">ZV-A01-R2-N3</div>
                                        <div class="print-libelle" id="preview-libelle">Exemple de Libellé</div>
                                        <div class="print-univers" id="preview-univers"><strong>Univers :</strong> High-Tech</div>
                                        <div class="print-comment" id="preview-commentaire"><strong>Note :</strong> Fragile</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
            </div>
            
            <div class="form-actions">
                <button type="submit" class="btn btn-primary btn-generate">
                    <i class="bi bi-printer-fill"></i> Générer les étiquettes
                </button>
            </div>
        </form>
    </section>
</div>

<?php ob_start(); ?>
<script>
    // Script pour "Tout sélectionner" / "Tout désélectionner"
    document.addEventListener('DOMContentLoaded', () => {
        const selectAllBtn = document.getElementById('select-all');
        const deselectAllBtn = document.getElementById('deselect-all');
        const universCheckboxes = document.querySelectorAll('.univers-selection input[type="checkbox"]');

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                universCheckboxes.forEach(cb => cb.checked = true);
            });
        }
        
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                universCheckboxes.forEach(cb => cb.checked = false);
            });
        }
    });
</script>
<script src="js/print-options.js"></script>
<?php $body_scripts = ob_get_clean(); ?>
