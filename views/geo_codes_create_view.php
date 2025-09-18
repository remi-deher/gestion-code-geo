<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ajouter un Code Géo</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <?php include 'partials/navbar.php'; ?>
    <div class="container">
        <section id="creation-form">
            <h2>Ajouter un nouvel emplacement</h2>
            <form action="index.php?action=add" method="POST">
                 <div class="form-group">
                    <label for="code_geo">Code Géo</label>
                    <input type="text" id="code_geo" name="code_geo" placeholder="Ex: ZV-A01-R2-N3" required>
                </div>
                <div class="form-group">
                    <label for="univers_id">Univers de produit</label>
                    <select id="univers_id" name="univers_id" required>
                        <option value="">-- Choisir un univers --</option>
                        <?php if (!empty($universList)): ?>
                            <?php foreach ($universList as $univers): ?>
                                <option value="<?= $univers['id'] ?>"><?= htmlspecialchars($univers['nom']) ?></option>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </select>
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
    </div>
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <script src="js/app.js"></script>
</body>
</html>

