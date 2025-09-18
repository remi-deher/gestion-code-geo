<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestionnaire de Codes Géo</title>
    <!-- Le CSS est dans un fichier séparé dans le dossier public -->
    <link rel="stylesheet" href="css/style.css">
</head>
<body>

    <!-- NOUVELLE BARRE DE NAVIGATION -->
    <nav class="navbar">
        <div class="navbar-brand">Gestion Géo 🏬</div>
        <div class="navbar-controls">
            <input type="search" id="recherche" placeholder="Rechercher...">
            <button id="print-btn">🖨️ Imprimer</button>
        </div>
    </nav>

    <div class="container">
        <header>
            <h1>Gestionnaire de Codes Géo</h1>
        </header>

        <section id="creation-form">
            <h2>Ajouter un nouvel emplacement</h2>
            <!-- Le formulaire poste ses données vers l'action 'add' gérée par le routeur -->
            <form action="index.php?action=add" method="POST">
                <div class="form-group">
                    <label for="code_geo">Code Géo</label>
                    <input type="text" id="code_geo" name="code_geo" placeholder="Ex: ZV-A01-R2-N3" required>
                </div>
                <div class="form-group">
                    <label for="univers">Univers de produit</label>
                    <input type="text" id="univers" name="univers" placeholder="Ex: Épicerie Salée" required>
                </div>
                <div class="form-group form-group-full">
                    <label for="libelle">Libellé</label>
                    <input type="text" id="libelle" name="libelle" placeholder="Ex: Rayon Pâtes, 2ème étagère" required>
                </div>
                <div class="form-group form-group-full">
                    <label for="commentaire">Commentaire (optionnel)</label>
                    <textarea id="commentaire" name="commentaire" placeholder="Informations additionnelles..."></textarea>
                </div>
                <div class="form-group">
                    <label for="zone">Zone de stockage</label>
                    <select id="zone" name="zone" required>
                        <option value="vente">Zone de Vente</option>
                        <option value="reserve">Réserve</option>
                    </select>
                </div>
                 <div class="form-group">
                    <label>Aperçu du QR Code</label>
                    <div id="qrcode-preview">Saisir un code géo...</div>
                </div>
                <button type="submit" class="form-group-full">Ajouter le code géo</button>
            </form>
        </section>

        <hr style="margin: 3rem 0;">

        <!-- BLOC DE DÉBOGAGE : Affiche le contenu brut de la variable $geoCodes -->
        <div style="background-color: #ffffe0; border: 1px solid #e6db55; padding: 1rem; margin-bottom: 2rem; border-radius: 5px; font-family: monospace;">
            <h3 style="margin-top: 0; color: #d9534f;">--- Informations de Débogage (à supprimer plus tard) ---</h3>
            <p><strong>Contenu de la variable <code>$geoCodes</code> reçu par la vue :</strong></p>
            <pre><?php var_dump($geoCodes); ?></pre>
            <p style="font-size: 0.9em; margin-top: 1rem;"><em>Si vous voyez un `array` avec vos données, la connexion à la BDD est fonctionnelle. Si vous voyez `NULL` ou un `array` vide alors que vous avez des données, le problème vient du contrôleur ou du modèle.</em></p>
        </div>
        <!-- FIN DU BLOC DE DÉBOGAGE -->

        <section id="classeur">
            <h2>📚 Classeur des emplacements</h2>
            <div id="liste-geocodes">
                <?php 
                $currentUnivers = null;
                // La variable $geoCodes est fournie par le contrôleur
                foreach ($geoCodes as $code): 
                    if ($code['univers'] !== $currentUnivers):
                        $currentUnivers = $code['univers'];
                        // On utilise htmlspecialchars pour la sécurité contre les failles XSS
                        echo "<h3>" . htmlspecialchars($currentUnivers) . "</h3>";
                    endif;
                ?>
                    <div class="code-geo-item">
                        <!-- L'attribut data-code permet au JS de récupérer la valeur à encoder -->
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
                    <p>Aucun code géo n'a été trouvé. Commencez par en ajouter un !</p>
                <?php endif; ?>
            </div>
        </section>
    </div>
    
    <!-- Inclusions JavaScript à la fin du body -->
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <script src="js/app.js"></script>
</body>
</html>

