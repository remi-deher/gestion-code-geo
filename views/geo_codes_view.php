<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Gestionnaire de Codes Géo</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="container">
        <section id="creation-form">
            <h2>Ajouter un nouvel emplacement</h2>
            <form action="index.php?action=add" method="POST">
                <input type="text" name="code_geo" placeholder="Ex: ZV-A01-R2-N3" required>
                 <input type="text" name="libelle" placeholder="Ex: Rayon Pâtes" required>
                 <button type="submit">Ajouter</button>
            </form>
        </section>

        <section id="classeur">
            <h2>📚 Classeur des emplacements</h2>
            <div id="liste-geocodes">
                <?php 
                $currentUnivers = null;
                // La variable $geoCodes est fournie par le contrôleur
                foreach ($geoCodes as $code): 
                    // Si on change d'univers, on affiche un nouveau titre
                    if ($code['univers'] !== $currentUnivers):
                        $currentUnivers = $code['univers'];
                        echo "<h3>" . htmlspecialchars($currentUnivers) . "</h3>";
                    endif;
                ?>
                    <div class="code-geo-item">
                        <div class="qr-code-container" data-code="<?= htmlspecialchars($code['code_geo']) ?>"></div>
                        <div class="details">
                            <h4><?= htmlspecialchars($code['code_geo']) ?></h4>
                            <p><?= htmlspecialchars($code['libelle']) ?></p>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
