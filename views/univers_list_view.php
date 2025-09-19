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
                <!-- Formulaire d'ajout -->
                <div class="univers-add">
                    <h3>Ajouter un univers</h3>
                    <form action="index.php?action=addUnivers" method="POST">
                        <div class="form-group">
                            <label for="nom">Nom du nouvel univers</label>
                            <input type="text" id="nom" name="nom" required>
                        </div>
                        <div class="form-group">
                            <label for="zone_assignee">Assigner à la zone</label>
                            <select name="zone_assignee" id="zone_assignee">
                                <option value="vente">Zone de Vente</option>
                                <option value="reserve">Réserve</option>
                            </select>
                        </div>
                        <button type="submit">Ajouter</button>
                    </form>
                </div>

                <!-- Liste des univers existants -->
                <div class="univers-list">
                    <h3>Liste existante</h3>
                    <p>Changez la zone ou téléchargez un modèle d'import pour l'import par lot.</p>
                    <table class="geo-table">
                        <thead>
                            <tr>
                                <th>Nom de l'univers</th>
                                <th>Zone Assignée</th>
                                <th>Modèle d'Import</th>
                                <th class="no-sort">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if (!empty($universList)): ?>
                                <?php foreach ($universList as $univers): ?>
                                    <tr>
                                        <td><?= htmlspecialchars($univers['nom']) ?></td>
                                        <td>
                                            <select class="zone-assign-select" data-id="<?= $univers['id'] ?>">
                                                <option value="vente" <?= ($univers['zone_assignee'] == 'vente') ? 'selected' : '' ?>>Zone de Vente</option>
                                                <option value="reserve" <?= ($univers['zone_assignee'] == 'reserve') ? 'selected' : '' ?>>Réserve</option>
                                            </select>
                                        </td>
                                        <!-- Colonne pour le téléchargement du modèle -->
                                        <td class="item-actions">
                                            <a href="index.php?action=exportTemplate&id=<?= $univers['id'] ?>" class="btn-download">📥 Télécharger</a>
                                        </td>
                                        <td class="item-actions">
                                            <a href="index.php?action=deleteUnivers&id=<?= $univers['id'] ?>" class="btn-delete" onclick="return confirm('Attention ! La suppression est impossible si l\'univers est utilisé.');">❌</a>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php else: ?>
                                <tr>
                                    <td colspan="4">Aucun univers n'a été créé.</td>
                                </tr>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    </div>
<script>
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.zone-assign-select').forEach(select => {
        select.addEventListener('change', (event) => {
            const universId = event.target.dataset.id;
            const newZone = event.target.value;
            const icon = document.createElement('span');
            icon.textContent = ' 💾';
            event.target.parentNode.appendChild(icon);

            fetch('index.php?action=updateUniversZone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: universId, zone: newZone })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    icon.textContent = ' ✅';
                } else {
                    icon.textContent = ' ❌';
                    alert('Erreur lors de la mise à jour.');
                }
                setTimeout(() => icon.remove(), 2000);
            });
        });
    });
});
</script>
</body>
</html>
