<?php $title = 'Liste des Codes Géo'; ?>
<?php $body_scripts = '<script src="js/app.js"></script>'; // Assurez-vous que qrcodejs est toujours dans layout.php ?>

<div class="container">
    <section id="classeur">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <h2 class="mb-0">📚 Classeur des emplacements</h2>

            <div class="d-flex gap-2">
                <a href="index.php?action=printLabels" target="_blank" class="btn btn-outline-secondary">
                    <i class="bi bi-printer-fill"></i> Imprimer des étiquettes
                </a>
                <a href="index.php?action=trash" class="btn btn-outline-secondary">
                    <i class="bi bi-trash"></i> Corbeille
                </a>
                <a href="index.php?action=fullHistory" class="btn btn-outline-info">
                    <i class="bi bi-clock-history"></i> Historique Global
                </a>
            </div>
        </div>

        <div class="filter-control-panel">
             <button class="btn btn-primary w-100 d-lg-none filters-offcanvas-trigger" type="button" data-bs-toggle="offcanvas" data-bs-target="#filtersOffcanvas">
                <i class="bi bi-funnel-fill"></i> Afficher les filtres
            </button>
            <div class="d-none d-lg-block desktop-filters">
                <div class="filter-section">
                    <strong>Zone :</strong>
                    <div class="zone-tabs d-flex flex-wrap align-items-center gap-2 mt-2">
                        <button class="zone-tab active" data-zone="all">Toutes</button>
                        <button class="zone-tab" data-zone="vente">Vente</button>
                        <button class="zone-tab" data-zone="reserve">Réserve</button>
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
                    // Tri initial par Univers (conservé car utile pour les séparateurs)
                    usort($geoCodes, function($a, $b) {
                        return strnatcmp($a['univers_nom'] ?? '', $b['univers_nom'] ?? '');
                    });
                    $currentUnivers = null;
                    foreach ($geoCodes as $code):
                        // Affichage du séparateur d'univers
                        if (($code['univers_nom'] ?? '') !== $currentUnivers):
                            $currentUnivers = $code['univers_nom'] ?? '';
                    ?>
                            <h3 class="univers-separator" style="display: block;">
                                <span class="univers"><?= htmlspecialchars($currentUnivers) ?></span>
                                <span class="code_geo d-none"></span> <span class="libelle d-none"></span>
                                <span class="zone d-none"></span>
                            </h3>
                    <?php
                        endif;
                    ?>
                        <div class="geo-card"
                             data-zone="<?= htmlspecialchars($code['zone'] ?? '') ?>"
                             data-univers="<?= htmlspecialchars($code['univers_nom'] ?? '') ?>">

                            <span class="univers d-none"><?= htmlspecialchars($code['univers_nom'] ?? '') ?></span>
                            <span class="zone d-none"><?= htmlspecialchars($code['zone'] ?? '') ?></span>
                            <div class="geo-card-qr" data-code="<?= htmlspecialchars($code['code_geo'] ?? '') ?>"></div>

                             <div class="geo-card-info">
                                <div class="info-code">
                                    <span class="code_geo code-badge"><?= htmlspecialchars($code['code_geo'] ?? '') ?></span>
                                    <span class="zone-badge zone-<?= htmlspecialchars($code['zone'] ?? '') ?>"><?= htmlspecialchars($code['zone'] ?? '') ?></span>
                                </div>
                                <div class="info-libelle libelle"><?= htmlspecialchars($code['libelle'] ?? '') ?></div>
                                <?php if (!empty($code['commentaire'])): ?> <div class="info-comment">💬 <?= htmlspecialchars($code['commentaire']) ?></div> <?php endif; ?>
                                </div>

                             <div class="geo-card-actions d-grid gap-2">
                                <a href="index.php?action=edit&id=<?= $code['id'] ?>" class="btn btn-sm btn-warning"><i class="bi bi-pencil-fill"></i><span class="btn-text"> Modifier</span></a>
                                <a href="index.php?action=history&id=<?= $code['id'] ?>" class="btn btn-sm btn-info"><i class="bi bi-clock-history"></i><span class="btn-text"> Historique</span></a>
                                <a href="index.php?action=delete&id=<?= $code['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('Mettre ce code à la corbeille ?');"><i class="bi bi-trash-fill"></i><span class="btn-text"> Corbeille</span></a>
                                <a href="index.php?action=printSingle&id=<?= $code['id'] ?>" target="_blank" class="btn btn-sm btn-secondary"><i class="bi bi-printer-fill"></i><span class="btn-text"> Imprimer</span></a>
                             </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
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
