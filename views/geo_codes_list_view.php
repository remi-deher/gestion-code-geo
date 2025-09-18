<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Liste des Codes Géo</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>

    <?php include 'partials/navbar.php'; ?>

    <div class="container">
        <section id="classeur">
            <div class="toolbar">
                <h2>📚 Classeur des emplacements</h2>
                <div id="filtres-univers">
                    <strong>Filtrer par univers :</strong>
                    <label><input type="checkbox" value="all" checked> Tout voir</label>
                    <?php foreach ($univers as $u): ?>
                        <label data-univers-name="<?= htmlspecialchars($u['nom']) ?>">
                            <input type="checkbox" value="<?= htmlspecialchars($u['nom']) ?>" checked> <?= htmlspecialchars($u['nom']) ?>
                        </label>
                    <?php endforeach; ?>
                </div>
                <div class="zone-tabs">
                    <button class="zone-tab active" data-zone="all">Toutes les zones</button>
                    <button class="zone-tab" data-zone="vente">Zone de Vente</button>
                    <button class="zone-tab" data-zone="reserve">Réserve</button>
                </div>
            </div>
            
            <div class="view-switcher">
                <button id="view-list-btn" class="active">Vue Liste</button>
                <button id="view-table-btn">Vue Tableau</button>
            </div>

            <div id="list-view">
                <div id="liste-geocodes">
                    <?php if (!empty($geoCodes)): ?>
                        <?php 
                        $currentUnivers = null;
                        foreach ($geoCodes as $code): 
                            if ($code['univers'] !== $currentUnivers):
                                $currentUnivers = $code['univers'];
                                echo "<h3 class='univers-separator' data-univers=\"".htmlspecialchars($currentUnivers)."\">" . htmlspecialchars($currentUnivers) . "</h3>";
                            endif;
                        ?>
                            <div class="code-geo-item" 
                                 data-searchable="<?= strtolower(htmlspecialchars($code['code_geo'].' '.$code['libelle'].' '.$code['univers'])) ?>"
                                 data-univers="<?= htmlspecialchars($code['univers']) ?>"
                                 data-zone="<?= htmlspecialchars($code['zone']) ?>">
                                <div class="qr-code-container" data-code="<?= htmlspecialchars($code['code_geo']) ?>"></div>
                                <div class="details">
                                    <h4><?= htmlspecialchars($code['code_geo']) ?> <small> (<?= htmlspecialchars($code['zone']) ?>)</small></h4>
                                    <p><?= htmlspecialchars($code['libelle']) ?></p>
                                     <?php if (!empty($code['commentaire'])): ?>
                                        <p class="comment">Note: <?= htmlspecialchars($code['commentaire']) ?></p>
                                    <?php endif; ?>
                                </div>
                                <div class="item-actions">
                                    <a href="index.php?action=edit&id=<?= $code['id'] ?>" class="btn-edit">✏️ Modifier</a>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php else: ?>
                        <p>Aucun code géo n'a été trouvé. <a href="index.php?action=create">Commencez par en ajouter un !</a></p>
                    <?php endif; ?>
                </div>
            </div>
            
            <div id="table-view" style="display: none;">
                <table class="geo-table">
                    <thead>
                        <tr>
                            <th data-sort="code_geo">Code Géo</th>
                            <th data-sort="libelle">Libellé</th>
                            <th data-sort="univers">Univers</th>
                            <th data-sort="zone">Zone</th>
                            <th class="no-sort">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (!empty($geoCodes)): ?>
                            <?php foreach ($geoCodes as $code): ?>
                                <tr data-searchable="<?= strtolower(htmlspecialchars($code['code_geo'].' '.$code['libelle'].' '.$code['univers'])) ?>"
                                    data-univers="<?= htmlspecialchars($code['univers']) ?>"
                                    data-zone="<?= htmlspecialchars($code['zone']) ?>">
                                    <td data-label="Code Géo"><?= htmlspecialchars($code['code_geo']) ?></td>
                                    <td data-label="Libellé"><?= htmlspecialchars($code['libelle']) ?></td>
                                    <td data-label="Univers"><?= htmlspecialchars($code['univers']) ?></td>
                                    <td data-label="Zone"><?= htmlspecialchars($code['zone']) ?></td>
                                    <td data-label="Actions" class="item-actions">
                                        <a href="index.php?action=edit&id=<?= $code['id'] ?>" class="btn-edit">✏️ Modifier</a>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
            
        </section>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
