<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Gérer les Plans</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <?php include 'partials/navbar.php'; ?>
    <div class="container">
        <section id="plan-manager">
            <h2>Gérer les Plans du Magasin</h2>
            <div class="univers-container">
                <div class="univers-add">
                    <h3>Ajouter un plan</h3>
                    <p>Formats acceptés : PNG, JPG, PDF. Les PDFs seront convertis en image.</p>
                    <form action="index.php?action=addPlan" method="POST" enctype="multipart/form-data">
                        <div class="form-group">
                            <label for="nom">Nom du plan (ex: Rez-de-chaussée)</label>
                            <input type="text" id="nom" name="nom" required>
                        </div>
                        <div class="form-group">
                            <label for="planFile">Fichier du plan</label>
                            <input type="file" id="planFile" name="planFile" accept=".png,.jpg,.jpeg,.pdf" required>
                        </div>
                        <button type="submit">Ajouter le plan</button>
                    </form>
                </div>

                <div class="univers-list">
                    <h3>Liste des plans</h3>
                    <table class="geo-table">
                        <thead>
                            <tr>
                                <th>Aperçu</th>
                                <th>Nom du plan</th>
                                <th class="no-sort">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if (!empty($plans)): ?>
                                <?php foreach ($plans as $plan): ?>
                                    <tr>
                                        <td>
                                            <img src="uploads/plans/<?= htmlspecialchars($plan['nom_fichier']) ?>" alt="Aperçu" style="width: 100px; height: auto; border-radius: 4px;">
                                        </td>
                                        <td><?= htmlspecialchars($plan['nom']) ?></td>
                                        <td class="item-actions">
                                            <a href="index.php?action=deletePlan&id=<?= $plan['id'] ?>" class="btn-delete" onclick="return confirm('Êtes-vous sûr de vouloir supprimer ce plan ? Toutes les positions associées seront perdues.');">❌ Supprimer</a>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php else: ?>
                                <tr>
                                    <td colspan="3">Aucun plan n'a été ajouté.</td>
                                </tr>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    </div>
</body>
</html>
