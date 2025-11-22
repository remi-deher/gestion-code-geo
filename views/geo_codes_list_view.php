<?php $title = 'Liste des Codes Géo'; ?>
<?php ob_start(); ?>

<style>
    /* CSS Spécifique */
    div.dtsp-panesContainer { padding-bottom: 1rem; }
    div.dataTables_wrapper div.dataTables_filter input { margin-left: 0.5em; display: inline-block; width: auto; }
    .qr-mini { width: 32px; height: 32px; display: inline-block; vertical-align: middle; }
    table.dataTable thead th.no-sort { pointer-events: none; background-image: none !important; }
    table.dataTable thead th.no-sort::after, table.dataTable thead th.no-sort::before { display: none !important; }
    .bulk-actions-bar {
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(150%);
        background: #212529; color: white; padding: 10px 25px; border-radius: 50px;
        z-index: 1050; box-shadow: 0 10px 30px rgba(0,0,0,0.25); transition: transform 0.3s;
        display: flex; align-items: center; gap: 20px;
    }
    .bulk-actions-bar.visible { transform: translateX(-50%) translateY(0); }
</style>

<?php $head_styles = ob_get_clean(); ?>

<div class="container-fluid px-4 mt-4">
    
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="mb-0"><i class="bi bi-table"></i> Liste des Codes</h2>
        <a href="index.php?action=create" class="btn btn-primary"><i class="bi bi-plus-lg"></i> Nouveau</a>
    </div>

    <div class="card border-0 shadow-sm">
        <div class="card-body">
            <table id="table-codes" class="table table-hover table-striped align-middle" style="width:100%">
                <thead class="bg-light">
                    <tr>
                        <th width="20" class="text-center no-sort">
                            <input type="checkbox" class="form-check-input" id="check-all">
                        </th>
                        <th width="50" class="text-center no-sort">QR</th>
                        <th>Code Géo</th>
                        <th>Libellé</th>
                        <th>Univers</th>
                        <th>Zone</th>
                        <th class="text-end no-sort">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($geoCodes as $code): ?>
                        <tr id="row-<?= $code['id'] ?>" data-id="<?= $code['id'] ?>">
                            <td class="text-center">
                                <input type="checkbox" class="form-check-input item-checkbox" value="<?= $code['id'] ?>">
                            </td>
                            <td class="text-center">
                                <div class="qr-mini" data-code="<?= htmlspecialchars($code['code_geo']) ?>"></div>
                            </td>
                            <td class="font-monospace fw-bold text-primary code-cell">
                                <?= htmlspecialchars($code['code_geo']) ?>
                            </td>
                            <td class="libelle-cell"><?= htmlspecialchars($code['libelle']) ?></td>
                            <td class="univers-cell" data-order="<?= htmlspecialchars($code['univers_nom'] ?? '') ?>" data-search="<?= htmlspecialchars($code['univers_nom'] ?? '') ?>" data-color="<?= $code['univers_color'] ?? '#ccc' ?>">
                                <span class="badge rounded-pill border text-dark fw-normal bg-light">
                                    <span class="d-inline-block rounded-circle me-1" style="width:8px; height:8px; background-color:<?= $code['univers_color'] ?? '#ccc' ?>"></span>
                                    <?= htmlspecialchars($code['univers_nom'] ?? '') ?>
                                </span>
                            </td>
                            <td class="zone-cell">
                                <span class="badge bg-light text-dark border"><?= htmlspecialchars($code['zone']) ?></span>
                            </td>
                            <td class="text-end">
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-light border btn-edit-modal" data-id="<?= $code['id'] ?>" title="Modifier rapidement">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="btn btn-light border btn-print-single" data-id="<?= $code['id'] ?>" title="Imprimer">
                                        <i class="bi bi-printer"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>

    <div class="bulk-actions-bar" id="bulk-actions-bar">
        <span class="fw-bold"><span id="selected-count">0</span> sélectionné(s)</span>
        <div class="vr bg-secondary opacity-50 mx-2"></div>
        <button class="btn btn-sm btn-outline-light border-0" id="bulk-print"><i class="bi bi-printer me-1"></i> Imprimer</button>
        <button class="btn btn-sm btn-outline-danger border-0" id="bulk-delete"><i class="bi bi-trash me-1"></i> Supprimer</button>
        <button class="btn btn-sm text-white-50 ms-2 p-0" id="bulk-close"><i class="bi bi-x-lg"></i></button>
    </div>

    <div class="modal fade" id="editModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title"><i class="bi bi-pencil-square"></i> Modification rapide</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <form id="form-edit-geocode">
                        <input type="hidden" id="edit_id" name="id">
                        
                        <div class="mb-3">
                            <label class="form-label">Code Géo</label>
                            <input type="text" class="form-control font-monospace" id="edit_code_geo" name="code_geo" required>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Libellé</label>
                            <textarea class="form-control" id="edit_libelle" name="libelle" rows="2"></textarea>
                        </div>
                        
                        <div class="row g-2">
                            <div class="col-md-6">
                                <label class="form-label">Univers</label>
                                <select class="form-select" id="edit_univers_id" name="univers_id">
                                    <option value="">-- Choisir --</option>
                                    <?php foreach ($univers as $u): ?>
                                        <option value="<?= $u['id'] ?>" data-color="<?= $u['color'] ?>">
                                            <?= htmlspecialchars($u['nom']) ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Zone</label>
                                <select class="form-select" id="edit_zone" name="zone">
                                    <option value="vente">Vente</option>
                                    <option value="reserve">Réserve</option>
                                </select>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-light" data-bs-dismiss="modal">Annuler</button>
                    <button type="button" class="btn btn-primary" id="btn-save-edit">
                        <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                        Enregistrer
                    </button>
                </div>
            </div>
        </div>
    </div>

</div>
