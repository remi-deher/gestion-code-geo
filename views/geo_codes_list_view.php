<?php $title = 'Liste des Codes Géo'; ?>
<?php $body_scripts = '<script src="js/app.js"></script>'; ?>

<div class="container">
    <section id="classeur">
        <div class="toolbar">
            <h2>📚 Classeur des emplacements</h2>
            
            <div id="filtres-univers" class="d-flex flex-wrap align-items-center gap-2">
                <strong>Filtrer :</strong>
                <span class="badge filter-pill active" data-filter="all">Tout voir</span>
                <?php if (!empty($univers) && is_array($univers)): ?>
                    <?php foreach ($univers as $u): ?>
                        <span class="badge filter-pill active" data-filter="<?= htmlspecialchars($u['nom']) ?>">
                            <?= htmlspecialchars($u['nom']) ?>
                        </span>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>

            <div class="zone-tabs">
                <button class="zone-tab active" data-zone="all">Toutes les zones</button>
                <button class="zone-tab" data-zone="vente">Zone de Vente</button>
                <button class="zone-tab" data-zone="reserve">Réserve</button>
            </div>
        </div>

        <div class="view-controls">
            <div class="view-switcher">
                <button id="view-card-btn" class="active">Vue Fiches</button>
                <button id="view-table-btn">Vue Tableau</button>
            </div>
            <div class="sort-container">
                <label for="sort-by">Trier par :</label>
                <select id="sort-by">
                    <option value="univers-asc">Univers (A-Z)</option>
                    <option value="code-geo-asc">Code Géo (A-Z)</option>
                    <option value="libelle-asc">Libellé (A-Z)</option>
                </select>
            </div>
        </div>

        <div id="card-view">
            <?php if (!empty($geoCodes) && is_array($geoCodes)): ?>
                <?php 
                $currentUnivers = null;
                usort($geoCodes, function($a, $b) {
                    return strcmp($a['univers'], $b['univers']) ?: strcmp($a['code_geo'], $b['code_geo']);
                });
                foreach ($geoCodes as $code): 
                    if ($code['univers'] !== $currentUnivers):
                        $currentUnivers = $code['univers'];
                        echo "<h3 class='univers-separator' data-univers=\"".htmlspecialchars($currentUnivers)."\">" . htmlspecialchars($currentUnivers) . "</h3>";
                    endif;
                ?>
                    <div class="geo-card" 
                         data-searchable="<?= strtolower(htmlspecialchars($code['code_geo'].' '.$code['libelle'].' '.$code['univers'].' '.$code['commentaire'])) ?>"
                         data-univers="<?= htmlspecialchars($code['univers']) ?>"
                         data-zone="<?= htmlspecialchars($code['zone']) ?>"
                         data-code_geo="<?= htmlspecialchars($code['code_geo']) ?>"
                         data-libelle="<?= htmlspecialchars($code['libelle']) ?>">
                        
                        <div class="geo-card-qr" data-code="<?= htmlspecialchars($code['code_geo']) ?>"></div>
                        <div class="geo-card-info">
                            <div class="info-code">
                                <span class="code-badge"><?= htmlspecialchars($code['code_geo']) ?></span>
                                <span class="zone-badge zone-<?= htmlspecialchars($code['zone']) ?>"><?= htmlspecialchars($code['zone']) ?></span>
                            </div>
                            <div class="info-libelle"><?= htmlspecialchars($code['libelle']) ?></div>
                            <?php if (!empty($code['commentaire'])): ?>
                                <div class="info-comment">💬 <?= htmlspecialchars($code['commentaire']) ?></div>
                            <?php endif; ?>
                        </div>
                        <div class="geo-card-actions d-grid gap-2">
                            <a href="index.php?action=edit&id=<?= $code['id'] ?>" class="btn btn-sm btn-warning">
                                <i class="bi bi-pencil-fill"></i><span class="btn-text"> Modifier</span>
                            </a>
                            <a href="index.php?action=delete&id=<?= $code['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('Êtes-vous sûr ?');">
                                <i class="bi bi-trash-fill"></i><span class="btn-text"> Supprimer</span>
                            </a>
                        </div>
                    </div>
                <?php endforeach; ?>
            <?php else: ?>
                <p>Aucun code géo trouvé. <a href="index.php?action=create">Commencez par en ajouter un !</a></p>
            <?php endif; ?>
        </div>

        <div id="table-view" style="display: none;">
            <table class="geo-table">
                <thead>
                    <tr>
                        <th data-sort="code_geo">Code Géo</th>
                        <th data-sort="libelle">Libellé</th>
                        <th data-sort="univers">Univers</th>
                        <th data-sort="zone">Zone</th>
                        <th class="no-print no-sort">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (!empty($geoCodes) && is_array($geoCodes)): ?>
                        <?php foreach ($geoCodes as $code): ?>
                            <tr data-searchable="<?= strtolower(htmlspecialchars($code['code_geo'].' '.$code['libelle'].' '.$code['univers'])) ?>"
                                data-univers="<?= htmlspecialchars($code['univers']) ?>"
                                data-zone="<?= htmlspecialchars($code['zone']) ?>">
                                <td><?= htmlspecialchars($code['code_geo']) ?></td>
                                <td><?= htmlspecialchars($code['libelle']) ?></td>
                                <td><?= htmlspecialchars($code['univers']) ?></td>
                                <td><?= htmlspecialchars($code['zone']) ?></td>
                                <td class="item-actions no-print text-center">
                                    <a href="index.php?action=edit&id=<?= $code['id'] ?>" class="btn btn-warning" title="Modifier">
                                        <i class="bi bi-pencil-fill"></i>
                                    </a>
                                    <a href="index.php?action=delete&id=<?= $code['id'] ?>" class="btn btn-danger" title="Supprimer" onclick="return confirm('Êtes-vous sûr ?');">
                                        <i class="bi bi-trash-fill"></i>
                                    </a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </section>
</div>
