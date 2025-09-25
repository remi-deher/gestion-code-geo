<?php $title = 'Exporter les Données'; ?>

<div class="container">
    <section id="export-options">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1><i class="bi bi-download"></i> Exporter les Codes Géo</h1>
        </div>
        <form action="index.php?action=handleExport" method="POST" target="_blank">
            <div class="row g-4">
                <div class="col-lg-7">
                    <div class="card mb-4">
                        <div class="card-header"><span class="step-number">1</span> Filtrer les données à exporter</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">Par Zone :</label>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" name="zones[]" value="vente" id="zone_vente" checked>
                                    <label class="form-check-label" for="zone_vente">Zone de Vente</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" name="zones[]" value="reserve" id="zone_reserve" checked>
                                    <label class="form-check-label" for="zone_reserve">Réserve</label>
                                </div>
                            </div>
                            <hr>
                            <label class="form-label">Par Univers :</label>
                            <div class="d-flex gap-2 mb-2">
                                <button type="button" class="btn btn-sm btn-outline-secondary" id="select-all-univers">Tout cocher</button>
                                <button type="button" class="btn btn-sm btn-outline-secondary" id="deselect-all-univers">Tout décocher</button>
                            </div>
                            <div class="univers-selection" style="max-height: 200px; overflow-y: auto; border: 1px solid #dee2e6; padding: 1rem; border-radius: 0.375rem;">
                                <?php foreach ($universList as $univers): ?>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" name="univers_ids[]" value="<?= $univers['id'] ?>" id="univers-<?= $univers['id'] ?>" checked>
                                        <label class="form-check-label" for="univers-<?= $univers['id'] ?>"><?= htmlspecialchars($univers['nom']) ?></label>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header"><span class="step-number">2</span> Choisir les colonnes à inclure</div>
                        <div class="card-body field-selection">
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" name="columns[]" value="code_geo" id="col_code_geo" checked>
                                <label class="form-check-label" for="col_code_geo">Code Géo</label>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" name="columns[]" value="libelle" id="col_libelle" checked>
                                <label class="form-check-label" for="col_libelle">Libellé</label>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" name="columns[]" value="univers" id="col_univers" checked>
                                <label class="form-check-label" for="col_univers">Univers</label>
                            </div>
                             <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" name="columns[]" value="zone" id="col_zone" checked>
                                <label class="form-check-label" for="col_zone">Zone</label>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" name="columns[]" value="commentaire" id="col_commentaire" checked>
                                <label class="form-check-label" for="col_commentaire">Commentaire</label>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-5">
                    <div class="card sticky-top" style="top: calc(var(--navbar-height) + 1rem);">
                        <div class="card-header"><span class="step-number">3</span> Finaliser l'export</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label fw-bold">Format du fichier :</label>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="format" id="format_csv" value="csv" checked>
                                    <label class="form-check-label" for="format_csv">CSV (pour tableurs)</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="format" id="format_pdf" value="pdf">
                                    <label class="form-check-label" for="format_pdf">PDF (pour impression)</label>
                                </div>
                            </div>
                            <hr>
                            <div class="mb-3">
                                <label for="filename" class="form-label">Nom du fichier (sans extension)</label>
                                <input type="text" id="filename" name="filename" class="form-control" value="export_geocodes_<?= date('Y-m-d') ?>">
                            </div>
                            <div class="d-grid">
                                <button type="submit" class="btn btn-primary btn-lg"><i class="bi bi-download"></i> Lancer l'export</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    </section>
</div>

<?php ob_start(); ?>
<script>
    document.addEventListener('DOMContentLoaded', () => {
        const selectAllBtn = document.getElementById('select-all-univers');
        const deselectAllBtn = document.getElementById('deselect-all-univers');
        const universCheckboxes = document.querySelectorAll('.univers-selection input[type="checkbox"]');

        selectAllBtn.addEventListener('click', () => universCheckboxes.forEach(cb => cb.checked = true));
        deselectAllBtn.addEventListener('click', () => universCheckboxes.forEach(cb => cb.checked = false));
    });
</script>
<?php $body_scripts = ob_get_clean(); ?>
