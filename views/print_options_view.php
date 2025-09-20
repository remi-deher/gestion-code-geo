<?php $title = 'Options d\'Impression des Étiquettes'; ?>

<?php ob_start(); ?>
<style>
    .template-choices { display: flex; flex-wrap: wrap; gap: 1rem; }
    .template-option input[type="radio"] { display: none; }
    .template-option label {
        display: block;
        padding: 0.5rem;
        border: 2px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s ease-in-out;
    }
    .template-option input[type="radio"]:checked + label {
        border-color: var(--primary-color);
        box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
        background-color: #e9f4ff;
    }
    .template-preview {
        height: 80px;
        width: 140px;
        background-color: #f8f9fa;
        border: 1px dashed #ccc;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px;
    }
    .template-preview .qr { width: 40px; height: 40px; background-color: #adb5bd; flex-shrink: 0; }
    .template-preview .text { flex-grow: 1; height: 80%; background-color: #ced4da; }
    .template-preview.layout-qr-top { flex-direction: column; }
    .template-preview.layout-compact .text { height: 40%; }
    .template-option span { font-weight: 500; font-size: 0.9rem; }
</style>
<?php $head_styles = ob_get_clean(); ?>

<div class="container">
    <section>
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1>Options d'Impression</h1>
        </div>
        <form action="index.php?action=generatePrint" method="POST" target="_blank" class="print-options-form">
            <div class="row g-4">
                <div class="col-lg-7">
                    <div class="card">
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

                <div class="col-lg-5">
                    <div class="card">
                        <div class="card-header"><span class="step-number">3</span> Choisir la disposition</div>
                        <div class="card-body">
                            <div class="template-choices">
                                <div class="template-option">
                                    <input type="radio" name="template" value="qr-left" id="template-qr-left" checked>
                                    <label for="template-qr-left">
                                        <div class="template-preview layout-qr-left"><div class="qr"></div><div class="text"></div></div>
                                        <span>Classique</span>
                                    </label>
                                </div>
                                <div class="template-option">
                                    <input type="radio" name="template" value="qr-top" id="template-qr-top">
                                    <label for="template-qr-top">
                                        <div class="template-preview layout-qr-top"><div class="qr"></div><div class="text"></div></div>
                                        <span>Vertical</span>
                                    </label>
                                </div>
                                <div class="template-option">
                                    <input type="radio" name="template" value="compact" id="template-compact">
                                    <label for="template-compact">
                                        <div class="template-preview layout-compact"><div class="qr"></div><div class="text"></div></div>
                                        <span>Compact</span>
                                    </label>
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
    document.addEventListener('DOMContentLoaded', () => {
        const selectAllBtn = document.getElementById('select-all');
        const deselectAllBtn = document.getElementById('deselect-all');
        const universCheckboxes = document.querySelectorAll('.univers-selection input[type="checkbox"]');

        if(selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                universCheckboxes.forEach(cb => cb.checked = true);
            });
        }
        
        if(deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                universCheckboxes.forEach(cb => cb.checked = false);
            });
        }
    });
</script>
<?php $body_scripts = ob_get_clean(); ?>
