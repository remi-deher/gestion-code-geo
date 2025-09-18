<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plan du Magasin</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <?php include 'partials/navbar.php'; ?>

    <div class="container-full">
        <div id="unplaced-codes-sidebar">
            <h3>Codes à placer</h3>
            <div id="unplaced-list">
                </div>
        </div>
        <div id="plan-container">
            <img src="https://placehold.co/1200x800/f0f0f0/cccccc?text=Plan+du+magasin" alt="Plan du magasin" id="map-image">
            </div>
    </div>

    <script>
        const geoCodesData = <?= json_encode($geoCodes ?? []); ?>;
    </script>
    <script src="js/plan.js"></script> 
</body>
</html>
