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
            <h2>📚 Classeur des emplacements</h2>
            <div id="liste-geocodes">
                 <?php 
                $currentUnivers = null;
                foreach ($geoCodes as $code): 
                    if ($code['univers'] !== $currentUnivers):
                        $currentUnivers = $code['univers'];
                        echo "<h3>" . htmlspecialchars($currentUnivers) . "</h3>";
                    endif;
                ?>
                    <div class="code-geo-item" data-searchable="<?= strtolower(htmlspecialchars($code['code_geo'].' '.$code['libelle'].' '.$code['univers'])) ?>">
                        <div class="qr-code-container" data-code="<?= htmlspecialchars($code['code_geo']) ?>"></div>
                        <div class="details">
                            <h4><?= htmlspecialchars($code['code_geo']) ?> <small> (<?= htmlspecialchars($code['zone']) ?>)</small></h4>
                            <p><?= htmlspecialchars($code['libelle']) ?></p>
                             <?php if (!empty($code['commentaire'])): ?>
                                <p style="font-size: 0.9em; color: #555;">Note: <?= htmlspecialchars($code['commentaire']) ?></p>
                            <?php endif; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
                 <?php if (empty($geoCodes)): ?>
                    <p>Aucun code géo n'a été trouvé. <a href="index.php?action=create">Commencez par en ajouter un !</a></p>
                <?php endif; ?>
            </div>
        </section>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <script src="js/app.js"></script>
</body>
</html>

