<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Gérer les Univers</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <?php include 'partials/navbar.php'; ?>
    <div class="container">
        <section id="univers-manager">
            <h2>Gérer les Univers</h2>
            <div class="univers-container">
                <div class="univers-list">
                    <h3>Liste existante</h3>
                    <ul>
                        <?php foreach ($universList as $univers): ?>
                            <li>
                                <span><?= htmlspecialchars($univers['nom']) ?></span>
                                <a href="index.php?action=deleteUnivers&id=<?= $univers['id'] ?>" 
                                   onclick="return confirm('Êtes-vous sûr ? La suppression est impossible si l\'univers est utilisé.');" 
                                   class="btn-delete">❌</a>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                </div>
                <div class="univers-add">
                    <h3>Ajouter un univers</h3>
                    <form action="index.php?action=addUnivers" method="POST">
                        <div class="form-group">
                            <label for="nom">Nom du nouvel univers</label>
                            <input type="text" id="nom" name="nom" required>
                        </div>
                        <button type="submit">Ajouter</button>
                    </form>
                </div>
            </div>
        </section>
    </div>
</body>
</html>
