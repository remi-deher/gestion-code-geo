<?php $title = 'Liste des Codes Géo'; ?>
<?php $body_scripts = '<script src="js/app.js"></script>'; ?>

<div class="container">
    <section id="classeur">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <h2 class="mb-0">📚 Classeur des emplacements</h2>
            <a href="index.php?action=trash" class="btn btn-outline-secondary">
                <i class="bi bi-trash"></i> Corbeille
            </a>
        </div>

        <div class="filter-control-panel">
             <button class="btn btn-primary w-100 d-lg-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#filtersOffcanvas">
                <i class="bi bi-funnel-fill"></i> Afficher les filtres
            </button>
            <div class="d-none d-lg-block desktop-filters">
                <div class="filter-section">
                    <strong>Zone :</strong>
                    <div class="zone-tabs d-flex flex-wrap align-items-center gap-2 mt-2">
                        <button class="zone-tab active" data-zone="all">Toutes</button>
                        <button class="zone-tab" data-zone="vente">Vente</button>
                        <button class="zone-tab" data-zone="reserve">Réserve</button>
                        <button class="zone-tab" data-zone="unplaced">Non placés</button>
                    </div>
                </div>
                <div class="filter-section mt-3" id="filtres-univers">
                    <strong>Univers :</strong>
                    <div class="filter-pills d-flex flex-wrap align-items-center gap-2 mt-2">
                        <span class="badge filter-pill active" data-filter="all">Tout voir</span>
                        <?php if (!empty($univers)): foreach ($univers as $u): ?>
                            <span class="badge filter-pill"
                                  data-filter="<?= htmlspecialchars($u['nom'] ?? '') ?>"
                                  data-zone="<?= htmlspecialchars($u['zone_assignee'] ?? '') ?>">
                                <?= htmlspecialchars($u['nom'] ?? '') ?>
                            </span>
                        <?php endforeach; endif; ?>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="view-controls">
            <div class="view-switcher">
                <button id="view-card-btn" class="active">Vue Fiches</button>
                <button id="view-table-btn">Vue Tableau</button>
            </div>
             
             <div class="d-flex align-items-center" id="page-length-controls">
                <label for="items-per-page" class="form-label me-2 mb-0">Afficher :</label>
                <select id="items-per-page" class="form-select form-select-sm" style="width: auto;">
                    <option value="15">15</option>
                    <option value="30">30</option>
                    <option value="50">50</option>
                    <option value="-1">Tous</option> 
                </select>
                <span class="ms-2">éléments</span>
             </div>

             <div class="sort-container" id="card-sort-controls"> 
                 <label for="sort-by" class="form-label">Trier par :</label>
                <select id="sort-by" class="form-select form-select-sm sort" data-sort="univers"> 
                    <option value="univers">Univers (A-Z)</option>
                    <option value="code_geo">Code Géo (A-Z)</option>
                    <option value="libelle">Libellé (A-Z)</option>
                </select>
            </div>
        </div>

        <div id="fiches-list-js" style="display: block;"> 
            <div class="list d-flex flex-column gap-3"> 
                <?php if (empty($geoCodes)): ?>
                    <p>Aucun code géo n'a été trouvé dans la base de données.</p>
                <?php else: ?>
                    <?php 
                    $currentUnivers = null; 
                    usort($geoCodes, function($a, $b) {
                        return strnatcmp($a['univers_nom'] ?? '', $b['univers_nom'] ?? '');
                    });
                    foreach ($geoCodes as $code): 
                        if (($code['univers_nom'] ?? '') !== $currentUnivers):
                            $currentUnivers = $code['univers_nom'] ?? '';
                    ?>
                            <h3 class="univers-separator" style="display: block;"> 
                                <span class="univers"><?= htmlspecialchars($currentUnivers) ?></span>
                                <span class="code_geo d-none"></span> <span class="libelle d-none"></span>
                                <span class="zone d-none"></span> <span class="unplaced d-none"></span> 
                            </h3>
                    <?php 
                        endif; 
                        $is_unplaced = empty($code['placements']);
                    ?>
                        <div class="geo-card" 
                             data-zone="<?= htmlspecialchars($code['zone'] ?? '') ?>" 
                             data-univers="<?= htmlspecialchars($code['univers_nom'] ?? '') ?>"> 
                            
                            <span class="univers d-none"><?= htmlspecialchars($code['univers_nom'] ?? '') ?></span>
                            <span class="zone d-none"><?= htmlspecialchars($code['zone'] ?? '') ?></span>
                            <span class="unplaced d-none"><?= $is_unplaced ? 'true' : 'false' ?></span>
                            
                             <div class="geo-card-qr" data-code="<?= htmlspecialchars($code['code_geo'] ?? '') ?>"></div>
                            <div class="geo-card-info">
                                <div class="info-code">
                                    <span class="code_geo code-badge"><?= htmlspecialchars($code['code_geo'] ?? '') ?></span>
                                    <span class="zone-badge zone-<?= htmlspecialchars($code['zone'] ?? '') ?>"><?= htmlspecialchars($code['zone'] ?? '') ?></span>
                                </div>
                                <div class="info-libelle libelle"><?= htmlspecialchars($code['libelle'] ?? '') ?></div>
                                <?php if (!empty($code['commentaire'])): ?> <div class="info-comment">💬 <?= htmlspecialchars($code['commentaire']) ?></div> <?php endif; ?>
                                <?php if (!empty($code['placements'])): ?> 
                                    <div class="info-placements"> 
                                        <?php 
                                        $placementsText = [];
                                        foreach ($code['placements'] as $placement) {
                                            $placementsText[] = '<span class="badge bg-light text-dark border">' . htmlspecialchars($placement['plan_name'] ?? '') . ' (' . ($placement['placement_count'] ?? 0) . 'x)</span>';
                                        }
                                        echo implode(' ', $placementsText); 
                                        ?>
                                    </div> 
                                <?php else: ?>
                                    <div class="info-placements"><span class="badge bg-warning text-dark">⚠️ Non placé</span></div>
                                <?php endif; ?>
                            </div>
                             <div class="geo-card-actions d-grid gap-2">
                                <a href="index.php?action=edit&id=<?= $code['id'] ?>" class="btn btn-sm btn-warning"><i class="bi bi-pencil-fill"></i><span class="btn-text"> Modifier</span></a>
                                <a href="index.php?action=history&id=<?= $code['id'] ?>" class="btn btn-sm btn-info"><i class="bi bi-clock-history"></i><span class="btn-text"> Historique</span></a>
                                <a href="index.php?action=delete&id=<?= $code['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('Mettre ce code à la corbeille ?');"><i class="bi bi-trash-fill"></i><span class="btn-text"> Supprimer</span></a>
                                <a href="index.php?action=printSingle&id=<?= $code['id'] ?>" target="_blank" class="btn btn-sm btn-secondary"><i class="bi bi-printer-fill"></i><span class="btn-text"> Imprimer</span></a>
                             </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
            <ul class="pagination justify-content-center mt-4"></ul>
        </div>

        <div id="table-view" class="d-none"> 
            <table id="geo-table" class="geo-table responsive-table table table-striped table-bordered" style="width:100%">
                <thead>
                    <tr>
                        <th>Code Géo</th>
                        <th>Libellé</th>
                        <th>Univers</th>
                        <th>Placements</th>
                        <th class="no-print no-sort text-center">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (!empty($geoCodes)): ?>
                        <?php foreach ($geoCodes as $code): ?>
                            <tr data-univers="<?= htmlspecialchars($code['univers_nom'] ?? '') ?>"
                                data-zone="<?= htmlspecialchars($code['zone'] ?? '') ?>">
                                <td data-label="Code Géo"><?= htmlspecialchars($code['code_geo'] ?? '') ?></td>
                                <td data-label="Libellé"><?= htmlspecialchars($code['libelle'] ?? '') ?></td>
                                <td data-label="Univers"><?= htmlspecialchars($code['univers_nom'] ?? '') ?></td>
                                <td data-label="Placements">
                                    <?php if (empty($code['placements'])): ?>
                                        <span class="text-muted small">Aucun</span>
                                    <?php else: ?>
                                        <?php 
                                        $placementsText = [];
                                        foreach ($code['placements'] as $placement) {
                                            $placementsText[] = htmlspecialchars($placement['plan_name'] ?? '') . ' (' . ($placement['placement_count'] ?? 0) . 'x)';
                                        }
                                        echo implode('<br>', $placementsText);
                                        ?>
                                    <?php endif; ?>
                                </td>
                                <td data-label="Actions" class="item-actions no-print text-center">
                                     <a href="index.php?action=edit&id=<?= $code['id'] ?>" class="btn btn-warning btn-sm" title="Modifier"><i class="bi bi-pencil-fill"></i></a>
                                     <a href="index.php?action=history&id=<?= $code['id'] ?>" class="btn btn-info btn-sm" title="Historique"><i class="bi bi-clock-history"></i></a>
                                     <a href="index.php?action=printSingle&id=<?= $code['id'] ?>" target="_blank" class="btn btn-secondary btn-sm" title="Imprimer"><i class="bi bi-printer-fill"></i></a>
                                     <a href="index.php?action=delete&id=<?= $code['id'] ?>" class="btn btn-danger btn-sm" title="Supprimer" onclick="return confirm('Mettre ce code à la corbeille ?');"><i class="bi bi-trash-fill"></i></a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php else: ?>
                        <tr>
                            <td colspan="5" class="text-center">Aucun code géo trouvé.</td>
                        </tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </section>
</div>

<div class="offcanvas offcanvas-start" tabindex="-1" id="filtersOffcanvas" aria-labelledby="filtersOffcanvasLabel">
    <div class="offcanvas-header">
        <h5 class="offcanvas-title" id="filtersOffcanvasLabel"><i class="bi bi-funnel-fill"></i> Filtres</h5>
        <button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
    </div>
    <div class="offcanvas-body">
        <div class="filter-section mb-3">
            <strong>Zone :</strong>
            <div class="zone-tabs-mobile d-grid gap-2 mt-2">
                <button class="btn btn-outline-secondary zone-tab active" data-zone="all">Toutes</button>
                <button class="btn btn-outline-secondary zone-tab" data-zone="vente">Vente</button>
                <button class="btn btn-outline-secondary zone-tab" data-zone="reserve">Réserve</button>
                <button class="btn btn-outline-secondary zone-tab" data-zone="unplaced">Non placés</button>
            </div>
        </div>
        <div class="filter-section" id="filtres-univers-mobile">
            <strong>Univers :</strong>
            <div class="filter-pills d-flex flex-wrap align-items-center gap-2 mt-2">
                <span class="badge filter-pill active" data-filter="all">Tout voir</span>
                <?php if (!empty($univers)): foreach ($univers as $u): ?>
                    <span class="badge filter-pill"
                          data-filter="<?= htmlspecialchars($u['nom'] ?? '') ?>"
                          data-zone="<?= htmlspecialchars($u['zone_assignee'] ?? '') ?>">
                        <?= htmlspecialchars($u['nom'] ?? '') ?>
                    </span>
                <?php endforeach; endif; ?>
            </div>
        </div>
    </div>
</div>
