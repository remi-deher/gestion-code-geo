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
            <div class="d-none d-lg-block">
                <div class="filter-section">
                    <strong>Zone :</strong>
                    <div class="zone-tabs d-flex flex-wrap align-items-center gap-2 mt-2">
                        <button class="zone-tab active" data-zone="all">Toutes</button>
                        <button class="zone-tab" data-zone="vente">Vente</button>
                        <button class="zone-tab" data-zone="reserve">Réserve</button>
                        <button class="zone-tab" data-zone="unplaced">Non placés</button>
                    </div>
                </div>
                <div class="filter-section mt-3">
                    <strong>Univers :</strong>
                    <div id="filtres-univers" class="filter-pills d-flex flex-wrap align-items-center gap-2 mt-2">
                        <span class="badge filter-pill active" data-filter="all">Tout voir</span>
                        <?php if (!empty($univers)): foreach ($univers as $u): ?>
                            <span class="badge filter-pill active"
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
            <div class="sort-container">
                <label for="sort-by" class="form-label">Trier par :</label>
                <select id="sort-by" class="form-select form-select-sm">
                    <option value="univers-asc">Univers (A-Z)</option>
                    <option value="code-geo-asc">Code Géo (A-Z)</option>
                    <option value="libelle-asc">Libellé (A-Z)</option>
                </select>
            </div>
        </div>

        <div id="card-view" class="d-flex flex-column gap-3">
            <?php if (empty($geoCodes)): ?>
                <p>Aucun code géo n'a été trouvé dans la base de données.</p>
            <?php else: ?>
                <?php foreach ($geoCodes as $code): ?>
                    <div class="geo-card"
                         data-searchable="<?= strtolower(htmlspecialchars(($code['code_geo'] ?? '').' '.($code['libelle'] ?? '').' '.($code['univers'] ?? '').' '.($code['commentaire'] ?? ''))) ?>"
                         data-univers="<?= htmlspecialchars($code['univers'] ?? '') ?>"
                         data-zone="<?= htmlspecialchars($code['zone'] ?? '') ?>"
                         data-code_geo="<?= htmlspecialchars($code['code_geo'] ?? '') ?>"
                         data-libelle="<?= htmlspecialchars($code['libelle'] ?? '') ?>">

                        <div class="geo-card-qr" data-code="<?= htmlspecialchars($code['code_geo'] ?? '') ?>"></div>
                        <div class="geo-card-info">
                            <div class="info-code">
                                <span class="code-badge"><?= htmlspecialchars($code['code_geo'] ?? '') ?></span>
                                <span class="zone-badge zone-<?= htmlspecialchars($code['zone'] ?? '') ?>"><?= htmlspecialchars($code['zone'] ?? '') ?></span>
                            </div>
                            <div class="info-libelle"><?= htmlspecialchars($code['libelle'] ?? '') ?></div>
                            <?php if (!empty($code['commentaire'])): ?>
                                <div class="info-comment">💬 <?= htmlspecialchars($code['commentaire']) ?></div>
                            <?php endif; ?>

                            <?php if (!empty($code['placements'])): ?>
                                <div class="info-placements">
                                    <small class="text-muted">
                                        <i class="bi bi-pin-map-fill"></i> Placé sur :
                                        <?php foreach ($code['placements'] as $placement): ?>
                                            <a href="index.php?action=viewPlan&id=<?= $placement['plan_id'] ?>" class="badge bg-secondary text-decoration-none">
                                                <?= htmlspecialchars($placement['plan_name'] ?? '') ?> (<?= $placement['placement_count'] ?? 0 ?>x)
                                            </a>
                                        <?php endforeach; ?>
                                    </small>
                                </div>
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

        <div id="table-view" class="d-none">
            <table class="geo-table responsive-table">
                <thead>
                    <tr>
                        <th data-sort="code_geo">Code Géo</th>
                        <th data-sort="libelle">Libellé</th>
                        <th data-sort="univers">Univers</th>
                        <th>Placements</th>
                        <th class="no-print no-sort text-center">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (!empty($geoCodes)): ?>
                        <?php foreach ($geoCodes as $code): ?>
                            <tr data-searchable="<?= strtolower(htmlspecialchars(($code['code_geo'] ?? '').' '.($code['libelle'] ?? '').' '.($code['univers'] ?? ''))) ?>"
                                data-univers="<?= htmlspecialchars($code['univers'] ?? '') ?>"
                                data-zone="<?= htmlspecialchars($code['zone'] ?? '') ?>"
                                data-code_geo="<?= htmlspecialchars($code['code_geo'] ?? '') ?>"
                                data-libelle="<?= htmlspecialchars($code['libelle'] ?? '') ?>">
                                <td data-label="Code Géo"><?= htmlspecialchars($code['code_geo'] ?? '') ?></td>
                                <td data-label="Libellé"><?= htmlspecialchars($code['libelle'] ?? '') ?></td>
                                <td data-label="Univers"><?= htmlspecialchars($code['univers'] ?? '') ?></td>
                                <td data-label="Placements">
                                    <?php if (empty($code['placements'])): ?>
                                        <span class="text-muted small">Aucun</span>
                                    <?php else: ?>
                                        <?php foreach ($code['placements'] as $placement): ?>
                                            <a href="index.php?action=viewPlan&id=<?= $placement['plan_id'] ?>" class="badge bg-secondary text-decoration-none mb-1 d-inline-block">
                                                <?= htmlspecialchars($placement['plan_name'] ?? '') ?> (<?= $placement['placement_count'] ?? 0 ?>x)
                                            </a>
                                        <?php endforeach; ?>
                                    <?php endif; ?>
                                </td>
                                <td data-label="Actions" class="item-actions no-print text-center">
                                    <a href="index.php?action=edit&id=<?= $code['id'] ?>" class="btn btn-warning" title="Modifier"><i class="bi bi-pencil-fill"></i></a>
                                    <a href="index.php?action=history&id=<?= $code['id'] ?>" class="btn btn-info" title="Historique"><i class="bi bi-clock-history"></i></a>
                                    <a href="index.php?action=printSingle&id=<?= $code['id'] ?>" target="_blank" class="btn btn-secondary" title="Imprimer"><i class="bi bi-printer-fill"></i></a>
                                    <a href="index.php?action=delete&id=<?= $code['id'] ?>" class="btn btn-danger" title="Supprimer" onclick="return confirm('Mettre ce code à la corbeille ?');"><i class="bi bi-trash-fill"></i></a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
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
        <h5>Zone</h5>
        <div class="zone-tabs-mobile btn-group w-100 mb-4" role="group">
            <button type="button" class="btn btn-outline-secondary active" data-zone="all">Toutes</button>
            <button type="button" class="btn btn-outline-secondary" data-zone="vente">Vente</button>
            <button type="button" class="btn btn-outline-secondary" data-zone="reserve">Réserve</button>
            <button type="button" class="btn btn-outline-secondary" data-zone="unplaced">Non placés</button>
        </div>
        <h5>Univers</h5>
        <div id="filtres-univers-mobile" class="filter-pills d-flex flex-wrap align-items-center gap-2">
             <span class="badge filter-pill active" data-filter="all">Tout voir</span>
            <?php if (!empty($univers)): foreach ($univers as $u): ?>
                <span class="badge filter-pill active"
                      data-filter="<?= htmlspecialchars($u['nom'] ?? '') ?>"
                      data-zone="<?= htmlspecialchars($u['zone_assignee'] ?? '') ?>">
                    <?= htmlspecialchars($u['nom'] ?? '') ?>
                </span>
            <?php endforeach; endif; ?>
        </div>
    </div>
</div>
