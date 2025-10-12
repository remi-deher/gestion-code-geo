<?php $title = 'Options d\'Impression des Étiquettes'; ?>

<?php ob_start(); ?>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<script src="js/print-options.js"></script>
<?php $body_scripts = ob_get_clean(); ?>


<div class="container">
    <section>
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1><i class="bi bi-printer-fill"></i> Options d'Impression</h1>
        </div>
        
        <form action="index.php?action=generatePrint" method="POST" target="_blank" class="print-options-form">
            <div class="row g-4">
                <div class="col-lg-7">
                    
                    <div class="card mb-4">
                        <div class="card-header"><span class="step-number">1</span> Sélectionner les univers</div>
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
                        <div class="card-header"><span class="step-number">2</span> Choisir les informations à inclure</div>
                        <div class="card-body field-selection">
                            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" name="fields[]" value="qrcode" id="field_qrcode" checked><label class="form-check-label" for="field_qrcode">QR Code</label></div>
                            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" name="fields[]" value="code_geo" id="field_code_geo" checked><label class="form-check-label" for="field_code_geo">Code Géo (texte)</label></div>
                            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" name="fields[]" value="libelle" id="field_libelle" checked><label class="form-check-label" for="field_libelle">Libellé</label></div>
                            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" name="fields[]" value="univers" id="field_univers"><label class="form-check-label" for="field_univers">Univers</label></div>
                            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" name="fields[]" value="commentaire" id="field_commentaire"><label class="form-check-label" for="field_commentaire">Commentaire</label></div>
                        </div>
                    </div>

                </div>

                <div class="col-lg-5">
                    <div class="card sticky-top" style="top: calc(var(--navbar-height) + 1rem);">
                        <div class="card-header"><span class="step-number">3</span> Aperçu et mise en page</div>
                        <div class="card-body">
                            
                            <div class="mb-4">
                                <label class="form-label fw-bold">Aperçu de l'étiquette :</label>
                                <div id="preview-box">
                                    <div class="print-item" id="label-preview-container">
                                        <div class="print-qr-code" id="preview-qrcode"></div>
                                        <div class="print-details" id="preview-details">
                                            <div id="preview-code-geo" class="print-code">ZV-A01-R2-N3</div>
                                            <div id="preview-libelle" class="print-libelle">Exemple de Libellé</div>
                                            <div id="preview-univers" class="print-univers" style="display: none;"><strong>Univers :</strong> High-Tech</div>
                                            <div id="preview-commentaire" class="print-comment" style="display: none;"><strong>Note :</strong> Fragile</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label fw-bold">Disposition des étiquettes</label>
                                 <select name="template" id="layout_format" class="form-select mb-2">
                                    <option value="qr-left">Classique (85mm x 40mm)</option>
                                    <option value="qr-top">Verticale (60mm x 55mm)</option>
                                    <option value="compact">Compacte (85mm x 25mm)</option>
                                </select>
                                <div class="row g-2">
                                    <div class="col"><label for="columns" class="form-label small">Colonnes</label><input type="number" id="columns" name="columns" class="form-control" value="2" min="1" max="5"></div>
                                    <div class="col"><label for="gap" class="form-label small">Espace (mm)</label><input type="number" id="gap" name="gap" class="form-control" value="4" min="0"></div>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label fw-bold">Mise en page de la feuille</label>
                                <div class="row g-2">
                                    <div class="col"><label for="page_size" class="form-label small">Format</label><select name="page_size" id="page_size" class="form-select"><option value="A4" selected>A4</option><option value="A5">A5</option><option value="letter">Letter</option></select></div>
                                    <div class="col"><label for="orientation" class="form-label small">Orientation</label><select name="orientation" id="orientation" class="form-select"><option value="portrait" selected>Portrait</option><option value="landscape">Paysage</option></select></div>
                                    <div class="col"><label for="margins" class="form-label small">Marges (mm)</label><input type="number" id="margins" name="margins" class="form-control" value="10" min="0"></div>
                                </div>
                            </div>
                            
                            <hr>

                            <div class="mb-3">
                                <label for="print_title" class="form-label">Titre de la page (optionnel)</label>
                                <input type="text" id="print_title" name="print_title" class="form-control" placeholder="Ex: Inventaire 2025">
                            </div>
                            <div class="mb-3">
                                <label for="copies" class="form-label">Copies par étiquette</label>
                                <input type="number" id="copies" name="copies" class="form-control" value="1" min="1">
                            </div>
                            <div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" name="cut_lines" value="1" id="cut_lines"><label class="form-check-label" for="cut_lines">Afficher les traits de coupe</label></div>
                            <div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" name="separate_univers" value="1" id="separate_univers" checked><label class="form-check-label" for="separate_univers">Séparer les univers par page</label></div>
                            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" name="show_footer" value="1" id="show_footer" checked><label class="form-check-label" for="show_footer">Afficher l'en-tête et le pied de page</label></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="submit" class="btn btn-primary btn-generate"><i class="bi bi-file-earmark-text-fill"></i> Générer la page d'impression</button>
            </div>
        </form>
    </section>
</div>

<?php ob_start(); ?>
<script>
    document.addEventListener('DOMContentLoaded', () => {
        const selectAllBtn = document.getElementById('select-all');
        const deselectAllBtn = document.getElementById('deselect-all');
        const universCheckboxes = document.querySelectorAll('.univers-selection input[type="checkbox"]');

        if(selectAllBtn) {
            selectAllBtn.addEventListener('click', () => { universCheckboxes.forEach(cb => cb.checked = true); });
        }
        
        if(deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => { universCheckboxes.forEach(cb => cb.checked = false); });
        }
    });
</script>
<?php $body_scripts .= ob_get_clean(); ?>
