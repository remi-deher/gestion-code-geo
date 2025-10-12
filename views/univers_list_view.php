<?php $title = 'Gérer les Univers'; ?>

<?php ob_start(); ?>
<style>
    .color-picker-wrapper {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .color-picker-wrapper input[type="color"] {
        width: 40px;
        height: 40px;
        padding: 0;
        border: none;
        background: none;
    }
</style>
<?php $head_styles = ob_get_clean(); ?>

<div class="container">
    <section id="univers-manager">
        <h2>Gérer les Univers</h2>
        <div class="univers-container">
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
                    <div class="form-group">
                        <label for="color">Couleur</label>
                        <input type="color" id="color" name="color" value="#3498db">
                    </div>
                    <button type="submit">Ajouter</button>
                </form>
            </div>

            <div class="univers-list">
                <h3>Liste existante</h3>
                <table class="geo-table">
                    <thead>
                        <tr>
                            <th>Nom & Couleur</th>
                            <th>Zone Assignée</th>
                            <th class="no-sort text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (!empty($universList)): ?>
                            <?php foreach ($universList as $univers): ?>
                                <tr>
                                    <form action="index.php?action=updateUnivers" method="POST">
                                        <input type="hidden" name="id" value="<?= $univers['id'] ?>">
                                        <td>
                                            <div class="color-picker-wrapper">
                                                <input type="color" name="color" value="<?= htmlspecialchars($univers['color']) ?>">
                                                <input type="text" name="nom" value="<?= htmlspecialchars($univers['nom']) ?>" class="form-control">
                                            </div>
                                        </td>
                                        <td>
                                            <select name="zone_assignee" class="form-select">
                                                <option value="vente" <?= ($univers['zone_assignee'] == 'vente') ? 'selected' : '' ?>>Vente</option>
                                                <option value="reserve" <?= ($univers['zone_assignee'] == 'reserve') ? 'selected' : '' ?>>Réserve</option>
                                            </select>
                                        </td>
                                        <td class="item-actions text-center">
                                            <button type="submit" class="btn btn-sm btn-success" title="Enregistrer"><i class="bi bi-check-lg"></i></button>
                                            <a href="index.php?action=deleteUnivers&id=<?= $univers['id'] ?>" class="btn btn-sm btn-danger" title="Supprimer" onclick="return confirm('Attention ! Suppression impossible si l\'univers est utilisé.');"><i class="bi bi-trash-fill"></i></a>
                                        </td>
                                    </form>
                                </tr>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <tr>
                                <td colspan="3" class="text-center">Aucun univers n'a été créé.</td>
                            </tr>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </section>
</div>
