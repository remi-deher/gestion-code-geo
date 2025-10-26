<?php $title = 'Exporter les Données'; ?>

<?php ob_start(); ?>
<link rel="stylesheet" href="css/pages/_export.css">
<?php $head_styles = ob_get_clean(); ?>

<div class="container">
    <form action="index.php?action=handleExport" method="POST" class="export-options-form">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <h1 class="mb-0"><i class="bi bi-download"></i> Exporter les Codes Géo</h1>
            <button type="submit" class="btn btn-primary btn-lg">
                <i class="bi bi-file-earmark-arrow-down-fill"></i> Lancer l'export
            </button>
        </div>

        <div class="row g-4">
            <!-- Card 1: Filtres -->
            <div class="col-lg-6">
                <div class="card h-100">
                    <div class="card-header d-flex align-items-center">
                        <span class="step-number">1</span>
                        <span>Filtres (Optionnel)</span>
                    </div>
                    <div class="card-body">
                        <p class="card-text text-muted small">Ne sélectionnez rien pour tout exporter.</p>
                        
                        <div class="mb-3">
                            <label class="form-label fw-bold">Par Zone :</label>
                            <div class="form-check-group">
                                <div class="form-check">
                                    <input class="form-check-input zone-filter" type="checkbox" name="zones[]" value="vente" id="zone_vente" checked>
                                    <label class="form-check-label" for="zone_vente">Zone de Vente</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input zone-filter" type="checkbox" name="zones[]" value="reserve" id="zone_reserve" checked>
                                    <label class="form-check-label" for="zone_reserve">Réserve</label>
                                </div>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label fw-bold">Par Univers :</label>
                            <div class="d-flex gap-2 mb-2">
                                <button type="button" class="btn btn-sm btn-outline-secondary" id="select-all-univers">Tout cocher</button>
                                <button type="button" class="btn btn-sm btn-outline-secondary" id="deselect-all-univers">Tout décocher</button>
                            </div>
                            <div id="univers-checkbox-list" class="univers-selection border p-3 rounded" style="max-height: 200px; overflow-y: auto;">
                                <?php if (empty($universList)): ?>
                                    <p class="text-muted small mb-0">Aucun univers trouvé.</p>
                                <?php else: ?>
                                    <?php foreach ($universList as $univers): ?>
                                        <div class="form-check" data-zone="<?= htmlspecialchars($univers['zone_assignee']) ?>">
                                            <input class="form-check-input" type="checkbox" name="univers_ids[]" value="<?= $univers['id'] ?>" id="univers-<?= $univers['id'] ?>" checked>
                                            <label class="form-check-label" for="univers-<?= $univers['id'] ?>"><?= htmlspecialchars($univers['nom']) ?></label>
                                        </div>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Card 2: Options -->
            <div class="col-lg-6">
                <div class="card h-100">
                    <div class="card-header d-flex align-items-center">
                        <span class="step-number">2</span>
                        <span>Options d'Export</span>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label fw-bold">Colonnes à inclure :</label>
                            <div class="form-check-group columns-grid">
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
                                    <input class="form-check-input" type="checkbox" name="columns[]" value="commentaire" id="col_commentaire">
                                    <label class="form-check-label" for="col_commentaire">Commentaire</label>
                                </div>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-bold">Format :</label>
                            <div class="form-check-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="format" id="format_csv" value="csv" checked>
                                    <label class="form-check-label" for="format_csv">CSV (Excel)</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="format" id="format_pdf" value="pdf">
                                    <label class="form-check-label" for="format_pdf">PDF (Tableau)</label>
                                </div>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="filename" class="form-label fw-bold">Nom du fichier :</label>
                            <input type="text" id="filename" name="filename" class="form-control" value="export_codes_geo_<?= date('Y-m-d') ?>">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </form>
</div>

<?php ob_start(); ?>
<script>
document.addEventListener('DOMContentLoaded', () => {
    // --- Logique pour Tout cocher/décocher les univers ---
    const selectAllBtn = document.getElementById('select-all-univers');
    const deselectAllBtn = document.getElementById('deselect-all-univers');
    const universCheckboxes = document.querySelectorAll('#univers-checkbox-list .form-check-input');
    const zoneFilters = document.querySelectorAll('.zone-filter');
    const universContainers = document.querySelectorAll('#univers-checkbox-list .form-check');

    if(selectAllBtn) selectAllBtn.addEventListener('click', () => {
        // Ne coche que les cases actuellement visibles
        document.querySelectorAll('#univers-checkbox-list .form-check:not([style*="display: none"]) .form-check-input').forEach(cb => cb.checked = true);
    });
    if(deselectAllBtn) deselectAllBtn.addEventListener('click', () => {
        universCheckboxes.forEach(cb => cb.checked = false);
    });

    // --- Logique de filtrage des univers par zone ---
    function filterUniverses() {
        const selectedZones = new Set(
            Array.from(zoneFilters)
                 .filter(cb => cb.checked)
                 .map(cb => cb.value)
        );

        universContainers.forEach(container => {
            // Si aucune zone n'est cochée, tout afficher. Sinon, filtrer.
            const isVisible = selectedZones.size === 0 || selectedZones.has(container.dataset.zone);
            container.style.display = isVisible ? 'block' : 'none';
            if (!isVisible) {
                // On décoche l'univers s'il est caché
                container.querySelector('input[type="checkbox"]').checked = false;
            }
        });
    }

    // Ajoute un écouteur sur chaque case à cocher de zone
    zoneFilters.forEach(checkbox => checkbox.addEventListener('change', filterUniverses));

    // Exécute le filtre une fois au chargement
    filterUniverses();
});
</script>
<?php $body_scripts = ob_get_clean(); ?>
