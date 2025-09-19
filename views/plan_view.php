<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plan du Magasin</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/plan_print.css" media="print">
</head>
<body>
    <?php include 'partials/navbar.php'; ?>

    <div class="plan-page-container">
        <div id="unplaced-codes-sidebar" class="no-print">
            <h3>Codes à placer</h3>
            <div id="unplaced-list">
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
                <div id="plan-placeholder">
                    <p>Veuillez sélectionner un plan pour commencer.</p>
                </div>
                <img src="" alt="Plan du magasin" id="map-image" style="display: none;">
            </div>
        </div>
    </div>

    <script>
        const geoCodesData = <?= json_encode($geoCodes ?? []); ?>;
        const plansData = <?= json_encode($plans ?? []); ?>;
    </script>
    <script src="js/plan.js"></script> 
</body>
</html>
