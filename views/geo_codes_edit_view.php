<?php $title = 'Modifier le Code Géo'; ?>

<div class="container">
    <section id="edit-form">
        <h2>Modifier l'emplacement : <?= htmlspecialchars($geoCode['code_geo']) ?></h2>
        <form action="index.php?action=update" method="POST">
            <input type="hidden" name="id" value="<?= $geoCode['id'] ?>">
             <div class="form-group">
                <label for="code_geo">Code Géo</label>
                <input type="text" id="code_geo" name="code_geo" value="<?= htmlspecialchars($geoCode['code_geo']) ?>" required>
            </div>
            <div class="form-group">
                <label for="univers_id">Univers de produit</label>
                <select id="univers_id" name="univers_id" required>
                    <?php foreach ($universList as $univers): ?>
                        <option value="<?= $univers['id'] ?>" <?= ($univers['id'] == $geoCode['univers_id']) ? 'selected' : '' ?>>
                            <?= htmlspecialchars($univers['nom']) ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group form-group-full">
                <label for="libelle">Libellé</label>
                <input type="text" id="libelle" name="libelle" value="<?= htmlspecialchars($geoCode['libelle']) ?>" required>
            </div>
            <div class="form-group form-group-full">
                <label for="commentaire">Commentaire</label>
                <textarea id="commentaire" name="commentaire"><?= htmlspecialchars($geoCode['commentaire']) ?></textarea>
            </div>
            <div class="form-group">
                <label for="zone">Zone de stockage</label>
                <select id="zone" name="zone" required>
                    <option value="vente" <?= ($geoCode['zone'] == 'vente') ? 'selected' : '' ?>>Zone de Vente</option>
                    <option value="reserve" <?= ($geoCode['zone'] == 'reserve') ? 'selected' : '' ?>>Réserve</option>
                </select>
            </div>
            <button type="submit" class="form-group-full">Enregistrer les modifications</button>
        </form>
    </section>
</div>
