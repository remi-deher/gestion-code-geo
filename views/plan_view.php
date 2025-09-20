<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plan du Magasin</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/plan_print.css" media="print">
    <style>
        /* --- STYLES POUR LA BARRE LATÉRALE AMÉLIORÉE --- */
        .sidebar-accordion .accordion-item {
            border-bottom: 1px solid var(--border-color);
        }
        .sidebar-accordion .accordion-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            cursor: pointer;
            background-color: #fff;
            user-select: none;
        }
        .sidebar-accordion .accordion-header:hover {
            background-color: var(--light-gray);
        }
        .sidebar-accordion .accordion-header h3 {
            margin: 0;
            font-size: 1.1rem;
        }
        .sidebar-accordion .accordion-arrow {
            font-weight: bold;
            transition: transform 0.3s ease;
        }
        .sidebar-accordion .accordion-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease, padding 0.3s ease;
            padding: 0 1rem;
        }
        .sidebar-accordion .accordion-item.open .accordion-content {
            max-height: 500px; 
            padding: 1rem;
            overflow-y: auto;
        }
        .sidebar-accordion .accordion-item.open .accordion-arrow {
            transform: rotate(90deg);
        }

        /* Amélioration de la liste des codes à placer */
        #unplaced-list .unplaced-item {
            cursor: grab;
            background-color: var(--light-gray);
            padding: 0.5rem;
            border-radius: 4px;
            border: 1px solid var(--border-color);
            margin-bottom: 0.5rem;
        }
        #unplaced-list .unplaced-item:hover {
            background-color: #e9ecef;
        }
        .unplaced-item .item-code {
            font-weight: bold;
            display: block;
        }
        .unplaced-item .item-libelle {
            font-size: 0.8rem;
            color: #6c757d;
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .legend-color-box { width: 15px; height: 15px; border: 1px solid #ccc; border-radius: 3px; }
    </style>
</head>
<body>

    <div class="plan-page-container">
        <div id="unplaced-codes-sidebar" class="no-print">
            
            <div class="sidebar-accordion">
                <div class="accordion-item open">
                    <div class="accordion-header">
                        <h3>Filtres</h3>
                        <span class="accordion-arrow">▶</span>
                    </div>
                    <div class="accordion-content">
                        <input type="search" id="tag-search-input" placeholder="Rechercher un code..." class="form-control">
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
                </div>

                <div class="accordion-item open">
                    <div class="accordion-header">
                        <h3>Codes à placer <span id="unplaced-counter">(0)</span></h3>
                        <span class="accordion-arrow">▶</span>
                    </div>
                    <div class="accordion-content" id="unplaced-list-container">
                        <div id="unplaced-list"></div>
                    </div>
                </div>

                <div class="accordion-item">
                    <div class="accordion-header">
                        <h3>Légende</h3>
                        <span class="accordion-arrow">▶</span>
                    </div>
                    <div class="accordion-content">
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
