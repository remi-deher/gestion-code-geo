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
        <div class="plan-controls">
            <!-- Ici on ajoutera un bouton pour uploader une image de plan -->
            <button>Charger un plan</button>
            <span>Zoomez et déplacez les étiquettes sur le plan.</span>
        </div>
        <div id="plan-container">
            <!-- Le plan du magasin (image) sera affiché ici -->
            <img src="https://placehold.co/1200x800?text=Plan+du+magasin" alt="Plan du magasin" id="map-image">
            
            <!-- Les étiquettes des codes géo seront ajoutées ici par JavaScript -->
            <!-- Exemple d'étiquette déplaçable -->
            <div class="geo-tag" style="left: 100px; top: 150px;">ZV-E12-R3-N2</div>
        </div>
    </div>
    <script src="js/app.js"></script>
    <script src="js/plan.js"></script> <!-- Un nouveau fichier JS pour la logique du plan -->
</body>
</html>
