<?php $title = 'Liste des Codes Géo'; ?>
<?php ob_start(); ?>

<style>
    /* CSS Spécifique à cette page */
    div.dtsp-panesContainer { padding-bottom: 1rem; }
    /* Alignement recherche */
    div.dataTables_wrapper div.dataTables_filter input { margin-left: 0.5em; display: inline-block; width: auto; }
    .qr-mini { width: 32px; height: 32px; display: inline-block; vertical-align: middle; }
    
    /* Barre d'actions flottante */
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
                        <th width="10" class="text-center no-sort">
                            <input type="checkbox" class="form-check-input" id="check-all">
                        </th>
                        <th width="50">QR</th>
                        <th>Code Géo</th>
                        <th>Libellé</th>
                        <th>Univers</th>
                        <th>Zone</th>
                        <th class="text-end no-sort">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($geoCodes as $code): ?>
                        <tr data-id="<?= $code['id'] ?>">
                            <td class="text-center">
                                <input type="checkbox" class="form-check-input item-checkbox" value="<?= $code['id'] ?>">
                            </td>
                            <td class="text-center">
                                <div class="qr-mini" data-code="<?= htmlspecialchars($code['code_geo']) ?>"></div>
                            </td>
                            <td class="font-monospace fw-bold text-primary">
                                <?= htmlspecialchars($code['code_geo']) ?>
                            </td>
                            <td><?= htmlspecialchars($code['libelle']) ?></td>
                            <td data-order="<?= htmlspecialchars($code['univers_nom'] ?? '') ?>" data-search="<?= htmlspecialchars($code['univers_nom'] ?? '') ?>">
                                <span class="badge rounded-pill border text-dark fw-normal bg-light">
                                    <span class="d-inline-block rounded-circle me-1" style="width:8px; height:8px; background-color:<?= $code['univers_color'] ?? '#ccc' ?>"></span>
                                    <?= htmlspecialchars($code['univers_nom'] ?? '') ?>
                                </span>
                            </td>
                            <td>
                                <span class="badge bg-light text-dark border"><?= htmlspecialchars($code['zone']) ?></span>
                            </td>
                            <td class="text-end">
                                <div class="btn-group btn-group-sm">
                                    <a href="index.php?action=edit&id=<?= $code['id'] ?>" class="btn btn-light border"><i class="bi bi-pencil"></i></a>
                                    <button class="btn btn-light border btn-print-single" data-id="<?= $code['id'] ?>"><i class="bi bi-printer"></i></button>
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

</div>
