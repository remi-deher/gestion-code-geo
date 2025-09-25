<?php $title = 'Corbeille'; ?>

<div class="container">
    <section id="trash">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2><i class="bi bi-trash"></i> Corbeille</h2>
            <a href="index.php?action=list" class="btn btn-outline-secondary">
                <i class="bi bi-arrow-left"></i> Retour à la liste
            </a>
        </div>

        <?php if (empty($deletedGeoCodes)): ?>
            <div class="alert alert-info">La corbeille est vide.</div>
        <?php else: ?>
            <table class="geo-table">
                <thead>
                    <tr>
                        <th>Code Géo</th>
                        <th>Libellé</th>
                        <th>Date de suppression</th>
                        <th class="no-sort text-center">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($deletedGeoCodes as $code): ?>
                        <tr>
                            <td><?= htmlspecialchars($code['code_geo']) ?></td>
                            <td><?= htmlspecialchars($code['libelle']) ?></td>
                            <td><?= date('d/m/Y H:i', strtotime($code['deleted_at'])) ?></td>
                            <td class="item-actions text-center">
                                <a href="index.php?action=restore&id=<?= $code['id'] ?>" class="btn btn-success" title="Restaurer"><i class="bi bi-arrow-counterclockwise"></i></a>
                                <a href="index.php?action=forceDelete&id=<?= $code['id'] ?>" class="btn btn-danger" title="Supprimer définitivement" onclick="return confirm('Cette action est irréversible. Êtes-vous sûr ?');"><i class="bi bi-trash-fill"></i></a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </section>
</div>
