<?php $title = 'Options d\'Impression des Étiquettes PDF'; ?>
<?php ob_start(); ?>
<script src="js/pdf-label-generator.js" defer></script>
<?php $body_scripts = ob_get_clean(); ?>

<div class="container">
    <section>
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1><i class="bi bi-printer-fill"></i> Options d'Impression PDF</h1>
        </div>

        <form id="print-options-form" class="print-options-form">
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
                                            <input class="form-check-input univers-checkbox" type="checkbox" name="univers_ids[]" value="<?= $univers['id'] ?>" id="univers-<?= $univers['id'] ?>" checked>
                                            <label class="form-check-label" for="univers-<?= $univers['id'] ?>"><?= htmlspecialchars($univers['nom']) ?></label>
                                        </div>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-header"><span class="step-number">2</span> Choisir les informations à inclure</div>
                        <div class="card-body field-selection">
                            <div class="form-check form-switch"><input class="form-check-input print-field" type="checkbox" name="fields[]" value="qrcode" id="field_qrcode" checked><label class="form-check-label" for="field_qrcode">QR Code</label></div>
                            <div class="form-check form-switch"><input class="form-check-input print-field" type="checkbox" name="fields[]" value="code_geo" id="field_code_geo" checked><label class="form-check-label" for="field_code_geo">Code Géo (texte)</label></div>
                            <div class="form-check form-switch"><input class="form-check-input print-field" type="checkbox" name="fields[]" value="libelle" id="field_libelle" checked><label class="form-check-label" for="field_libelle">Libellé</label></div>
                            <div class="form-check form-switch"><input class="form-check-input print-field" type="checkbox" name="fields[]" value="univers" id="field_univers"><label class="form-check-label" for="field_univers">Univers</label></div>
                            <div class="form-check form-switch"><input class="form-check-input print-field" type="checkbox" name="fields[]" value="commentaire" id="field_commentaire"><label class="form-check-label" for="field_commentaire">Commentaire</label></div>
                        </div>
                    </div>

                    <div id="loading-indicator" class="text-center my-3" style="display: none;">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Génération du PDF...</span>
                        </div>
                        <p>Génération du PDF en cours...</p>
                    </div>

                    <div class="form-actions mt-4 mb-4">
                        <button type="button" id="generate-pdf-btn" class="btn btn-primary btn-generate">
                            <i class="bi bi-file-earmark-pdf-fill"></i> Générer l'aperçu PDF
                        </button>
                    </div>

                </div> <div class="col-lg-5">
                    <div class="card sticky-top" style="top: calc(var(--navbar-height) + 1rem);">
                        <div class="card-header"><span class="step-number">3</span> Mise en page et options</div>
                        <div class="card-body">

                            <div class="row g-3 mb-3">
                                <div class="col-6">
                                    <label for="page_size" class="form-label fw-bold">Format Papier</label>
                                    <select id="page_size" name="page_size" class="form-select">
                                        <option value="A4" selected>A4</option>
                                        <option value="A3">A3</option>
                                        <option value="letter">Lettre US</option>
                                    </select>
                                </div>
                                <div class="col-6">
                                    <label for="orientation" class="form-label fw-bold">Orientation</label>
                                    <select id="orientation" name="orientation" class="form-select">
                                        <option value="portrait">Portrait</option>
                                        <option value="landscape" selected>Paysage</option>
                                    </select>
                                </div>
                            </div>

                            <div class="row g-3 mb-3">
                                <div class="col-6">
                                    <label for="labels_per_page" class="form-label">Étiquettes/page (Max)</label>
                                    <input type="number" id="labels_per_page" name="labels_per_page" class="form-control" value="10" min="1" max="100" title="Nombre maximum d'étiquettes à placer sur une page. Saisissez un grand nombre (ex: 99) pour remplir la page.">
                                </div>
                                <div class="col-6">
                                    <label for="columns" class="form-label fw-bold">Colonnes</label>
                                    <input type="number" id="columns" name="columns" class="form-control" value="2" min="1" max="10">
                                </div>
                            </div>

                            <div class="row g-3 mb-3">
                                <div class="col-6">
                                    <label for="margins" class="form-label">Marges (mm)</label>
                                    <input type="number" id="margins" name="margins" class="form-control form-control-sm" value="10" min="0">
                                </div>
                                <div class="col-6">
                                    <label for="gap" class="form-label">Espace (mm)</label>
                                    <input type="number" id="gap" name="gap" class="form-control form-control-sm" value="4" min="0">
                                </div>
                            </div>

                             <div class="mb-3">
                                 <label for="template_style" class="form-label">Style de l'étiquette</label>
                                 <select id="template_style" name="template_style" class="form-select form-select-sm">
                                    <option value="qr-left" selected>QR à gauche</option>
                                    <option value="qr-top">QR en haut</option>
                                    <option value="compact">Compact (QR petit)</option>
                                    <option value="text-only">Texte seul</option>
                                    <option value="ultra-compact">Code et QR seul</option>
                                 </select>
                                 <div class="form-text">Affecte la disposition interne de l'étiquette. Modifiable dans le code JS (fonction drawLabel).</div>
                             </div>

                            <hr>

                            <div class="mb-3">
                                <label for="print_title" class="form-label">Titre de la page (optionnel)</label>
                                <input type="text" id="print_title" name="print_title" class="form-control" placeholder="Ex: Inventaire 2025">
                            </div>
                            <div class="mb-3">
                                <label for="copies" class="form-label">Copies par code</label>
                                <input type="number" id="copies" name="copies" class="form-control" value="1" min="1">
                            </div>
                            <div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" name="separate_univers" value="1" id="separate_univers" checked><label class="form-check-label" for="separate_univers">Nouvelle page par univers</label></div>
                             <div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" name="add_cut_lines" value="1" id="add_cut_lines"><label class="form-check-label" for="add_cut_lines">Ajouter des traits de coupe</label></div>
                             <div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" name="add_column_separators" value="1" id="add_column_separators" checked><label class="form-check-label" for="add_column_separators">Ajouter des séparateurs de colonnes</label></div>

                        </div>
                    </div>
                </div> </div> </form>
    </section>
</div>

<div class="offcanvas offcanvas-end" tabindex="-1" id="pdf-preview-offcanvas" aria-labelledby="pdf-preview-offcanvas-label" style="width: 75vw;">
  <div class="offcanvas-header">
    <h5 class="offcanvas-title" id="pdf-preview-offcanvas-label">Aperçu PDF</h5>
    <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
  </div>
  <div class="offcanvas-body p-0">
    <iframe id="pdf-preview-iframe" style="width: 100%; height: 100%; border: none;" title="Aperçu PDF"></iframe>
  </div>
</div>

<?php ob_start(); ?>
<script>
    // Script simple pour cocher/décocher tout
    document.addEventListener('DOMContentLoaded', () => {
        const selectAllBtn = document.getElementById('select-all');
        const deselectAllBtn = document.getElementById('deselect-all');
        const universCheckboxes = document.querySelectorAll('.univers-selection .univers-checkbox');

        if(selectAllBtn) {
            selectAllBtn.addEventListener('click', () => { universCheckboxes.forEach(cb => cb.checked = true); });
        }
        if(deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => { universCheckboxes.forEach(cb => cb.checked = false); });
        }
    });
</script>
<?php $body_scripts .= ob_get_clean(); ?>
