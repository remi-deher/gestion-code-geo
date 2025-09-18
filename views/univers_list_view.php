<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Gérer les Univers</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <?php include 'partials/navbar.php'; ?>
    <?php include 'partials/flash_messages.php'; ?>

    <div class="container">
        <section id="univers-manager">
            <h2>Gérer les Univers de Produits</h2>
            <div class="univers-container">
                <div class="univers-list">
                    <h3>Liste existante</h3>
                    <?php if (!empty($universList)): ?>
                        <ul>
                            <?php foreach ($universList as $univers): ?>
                                <li>
                                    <span><?= htmlspecialchars($univers['nom']) ?></span>
                                    <a href="index.php?action=deleteUnivers&id=<?= $univers['id'] ?>" 
                                       onclick="return confirm('Êtes-vous sûr ? La suppression est impossible si l\'univers est utilisé par un ou plusieurs codes géo.');" 
                                       class="btn-delete" title="Supprimer">❌</a>
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    <?php else: ?>
                        <p>Aucun univers n'a été créé pour le moment.</p>
                    <?php endif; ?>
                </div>
                <div class="univers-add">
                    <h3>Ajouter un univers</h3>
                    <form action="index.php?action=addUnivers" method="POST" class="form-container">
                        <div class="form-group form-group-full">
                            <label for="nom">Nom du nouvel univers</label>
                            <input type="text" id="nom" name="nom" required placeholder="Ex: Épicerie Sucrée">
                        </div>
                        <div class="form-group-full">
                            <button type="submit">➕ Ajouter l'univers</button>
                        </div>
                    </form>
                </div>
            </div>
        </section>
    </div>

    <script src="js/app.js"></script>
</body>
</html>
