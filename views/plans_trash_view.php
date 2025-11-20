<?php $title = 'Corbeille des Plans'; ?>

<div class="container">
    <section id="plans-trash">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="mb-0 text-danger"><i class="bi bi-trash"></i> Corbeille des Plans</h2>
            <a href="index.php?action=listPlans" class="btn btn-outline-secondary">
                <i class="bi bi-arrow-left"></i> Retour aux plans actifs
            </a>
        </div>

        <?php include __DIR__ . '/partials/flash_messages.php'; ?>

        <?php if (empty($deletedPlans)): ?>
            <div class="alert alert-info text-center py-5">
                <i class="bi bi-recycle fs-1 d-block mb-3"></i>
                <p class="lead mb-0">La corbeille est vide.</p>
            </div>
        <?php else: ?>
            <div class="table-responsive">
                <table class="geo-table">
                    <thead>
                        <tr>
                            <th>Aperçu</th>
                            <th>Nom</th>
                            <th>Fichier</th>
                            <th>Date de suppression</th>
                            <th class="text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($deletedPlans as $plan): 
                             $planImagePath = 'uploads/plans/' . htmlspecialchars($plan['nom_fichier']);
                             $imageSrc = file_exists(__DIR__ . '/../public/' . $planImagePath) ? $planImagePath : 'img/placeholder-plan.png';
                        ?>
                            <tr>
                                <td style="width: 80px;">
                                    <img src="<?= $imageSrc ?>" alt="Aperçu" class="img-thumbnail" style="width: 60px; height: 40px; object-fit: cover;">
                                </td>
                                <td>
                                    <strong><?= htmlspecialchars($plan['nom']) ?></strong>
                                    <?php if($plan['description']): ?>
                                        <br><small class="text-muted"><?= htmlspecialchars(substr($plan['description'], 0, 50)) ?>...</small>
                                    <?php endif; ?>
                                </td>
                                <td class="small text-muted"><?= htmlspecialchars($plan['nom_fichier']) ?></td>
                                <td><?= date('d/m/Y H:i', strtotime($plan['deleted_at'])) ?></td>
                                <td class="text-center">
                                    <div class="d-flex justify-content-center gap-2">
                                        <form action="index.php?action=restorePlan" method="POST" class="d-inline">
                                            <input type="hidden" name="id" value="<?= $plan['id'] ?>">
                                            <button type="submit" class="btn btn-sm btn-success" title="Restaurer">
                                                <i class="bi bi-arrow-counterclockwise"></i> Restaurer
                                            </button>
                                        </form>
                                        
                                        <form action="index.php?action=forceDeletePlan" method="POST" class="d-inline" onsubmit="return confirm('ATTENTION : Cette action est irréversible.\nLe plan et le fichier associé seront définitivement effacés.\n\nConfirmer la suppression ?');">
                                            <input type="hidden" name="id" value="<?= $plan['id'] ?>">
                                            <button type="submit" class="btn btn-sm btn-danger" title="Supprimer définitivement">
                                                <i class="bi bi-x-lg"></i> Supprimer
                                            </button>
                                        </form>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>
    </section>
</div>
