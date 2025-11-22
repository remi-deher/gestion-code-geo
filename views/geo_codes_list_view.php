<?php $title = 'Liste des Codes Géo'; ?>
<?php ob_start(); ?>
<script src="js/app.js" defer></script>
<style>
    /* Indicateurs de tri */
    th.sort { cursor: pointer; user-select: none; }
    th.sort:hover { background-color: #f8f9fa; }
    th.sort.asc:after { content: ' \25B2'; font-size: 0.8em; float: right; } /* Flèche haut */
    th.sort.desc:after { content: ' \25BC'; font-size: 0.8em; float: right; } /* Flèche bas */
    
    /* Barre flottante */
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
        <h2 class="mb-0"><i class="bi bi-list-columns"></i> Liste des Codes</h2>
        <a href="index.php?action=create" class="btn btn-primary"><i class="bi bi-plus-lg"></i> Nouveau</a>
    </div>

    <div id="fiches-list-js">

        <div class="card border-0 shadow-sm mb-3">
            <div class="card-body p-2">
                <div class="input-group">
                    <span class="input-group-text bg-white border-end-0"><i class="bi bi-search"></i></span>
                    <input type="text" class="search form-control border-start-0" placeholder="Rechercher...">
                </div>
            </div>
        </div>

        <div class="table-responsive bg-white rounded shadow-sm border">
            <table class="table table-hover align-middle mb-0">
                <thead class="bg-light">
                    <tr>
                        <th width="40" class="text-center"><input type="checkbox" class="form-check-input" id="check-all"></th>
                        <th class="sort" data-sort="code_geo" style="width: 15%;">Code Géo</th>
                        <th class="sort" data-sort="libelle">Libellé</th>
                        <th class="sort" data-sort="univers" style="width: 20%;">Univers</th>
                        <th class="sort" data-sort="zone" style="width: 10%;">Zone</th>
                        <th class="text-end" style="width: 100px;">Actions</th>
                    </tr>
                </thead>
                
                <tbody class="<?= !empty($geoCodes) ? 'list' : '' ?>">
                    <?php if (empty($geoCodes)): ?>
                        <tr><td colspan="6" class="text-center py-5 text-muted">Aucun code trouvé.</td></tr>
                    <?php else: ?>
                        <?php foreach ($geoCodes as $code): ?>
                            <tr class="list-item-entry">
                                <td class="text-center">
                                    <input type="checkbox" class="form-check-input item-checkbox" value="<?= $code['id'] ?>">
                                </td>
                                
                                <td class="code_geo fw-bold font-monospace text-primary">
                                    <?= htmlspecialchars($code['code_geo']) ?>
                                </td>
                                
                                <td class="libelle"><?= htmlspecialchars($code['libelle']) ?></td>
                                
                                <td class="univers">
                                    <span class="badge rounded-pill border text-dark fw-normal bg-light">
                                        <?= htmlspecialchars($code['univers_nom'] ?? '') ?>
                                    </span>
                                </td>
                                
                                <td class="zone text-capitalize"><?= htmlspecialchars($code['zone']) ?></td>
                                
                                <td class="text-end">
                                    <div class="btn-group btn-group-sm">
                                        <a href="index.php?action=edit&id=<?= $code['id'] ?>" class="btn btn-light border"><i class="bi bi-pencil"></i></a>
                                        <button class="btn btn-light border btn-print-single" data-id="<?= $code['id'] ?>"><i class="bi bi-printer"></i></button>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
        
        <div class="d-flex justify-content-center mt-3">
            <ul class="pagination"></ul>
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
