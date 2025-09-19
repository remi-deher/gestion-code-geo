<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plan du Magasin</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/plan_print.css" media="print">
    <style>
        #univers-legend { margin-top: 2rem; }
        #univers-legend h4 { margin: 0 0 0.5rem 0; }
        .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .legend-color-box { width: 15px; height: 15px; border: 1px solid #ccc; border-radius: 3px; }
        .sidebar-filters { padding-bottom: 1rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1rem; }
        .sidebar-filters input[type="search"] { width: 100%; box-sizing: border-box; margin-bottom: 1rem; }
        .sidebar-filters h4 { margin: 0 0 0.5rem 0; }
        .filter-options label { display: block; font-weight: normal; }
    </style>
</head>
<body>
    <?php include 'partials/navbar.php'; ?>

    <div class="plan-page-container">
        <div id="unplaced-codes-sidebar" class="no-print">
            
            <div class="sidebar-filters">
                <h3>Filtres</h3>
                <input type="search" id="tag-search-input" placeholder="Rechercher un code...">
                <div id="univers-filter-options">
                    <h4>Univers</h4>
                    <label><input type="checkbox" value="all" checked> Tout voir</label>
                    <?php if (!empty($universList)): ?>
                        <?php foreach ($universList as $univers): ?>
                            <label>
                                <input type="checkbox" value="<?= htmlspecialchars($univers['nom']) ?>" checked>
                                <?= htmlspecialchars($univers['nom']) ?>
                            </label>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <h3>Codes à placer</h3>
            <div id="unplaced-list"></div>
            
            <div id="univers-legend">
                <h4>Légende</h4>
                <?php if (!empty($universColors)): ?>
                    <?php foreach ($universColors as $univers => $color): ?>
                        <div class="legend-item">
                            <div class="legend-color-box" style="background-color: <?= htmlspecialchars($color) ?>;"></div>
                            <span><?= htmlspecialchars($univers) ?></span>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>

        <div class="plan-main-content">
            <div class="plan-toolbar no-print">
                <div class="form-group">
                    <label for="plan-selector">Choisir un plan :</label>
                    <select id="plan-selector">
                        <option value="">-- Sélectionnez un plan --</option>
                        <?php if (!empty($plans)): ?>
                            <?php foreach ($plans as $plan): ?>
                                <option value="<?= $plan['id'] ?>" data-filename="<?= htmlspecialchars($plan['nom_fichier']) ?>">
                                    <?= htmlspecialchars($plan['nom']) ?>
                                </option>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </select>
                </div>
                <button id="print-plan-btn" disabled>🖨️ Imprimer le plan</button>
            </div>

            <div id="plan-container">
                 <div id="zoom-wrapper">
                    <img src="" alt="Plan du magasin" id="map-image" style="display: none;">
                    </div>
                <div id="plan-placeholder">
                    <p>Veuillez sélectionner un plan pour commencer.</p>
                </div>
            </div>

            <div id="zoom-controls" class="no-print">
                <button id="zoom-in-btn">+</button>
                <button id="zoom-out-btn">-</button>
                <button id="zoom-reset-btn">⟲</button>
            </div>
        </div>
    </div>

    <script src="https://unpkg.com/@panzoom/panzoom@4.5.1/dist/panzoom.min.js"></script>

    <script>
        const geoCodesData = <?= json_encode($geoCodes ?? []); ?>;
        const plansData = <?= json_encode($plans ?? []); ?>;
        const universColors = <?= json_encode($universColors ?? []); ?>;
    </script>
    <script src="js/plan.js"></script> 
</body>
</html>
