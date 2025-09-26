<?php $title = 'Les Plans du Magasin'; ?>

<div class="container">
    <section id="plan-manager">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="mb-0">Les Plans du Magasin</h2>
            <a href="index.php?action=addPlanForm" class="btn btn-primary">
                <i class="bi bi-plus-circle-fill"></i> Ajouter un nouveau plan
            </a>
        </div>
        
        <?php include __DIR__ . '/partials/flash_messages.php'; ?>
        
        <?php if (!empty($plans)): ?>
            <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
                <?php foreach ($plans as $plan): ?>
                    <div class="col">
                        <div class="card h-100 plan-card">
                            <img src="uploads/plans/<?= htmlspecialchars($plan['nom_fichier']) ?>" class="card-img-top" alt="Aperçu de <?= htmlspecialchars($plan['nom']) ?>">
                            <div class="card-body d-flex flex-column">
                                <h5 class="card-title"><?= htmlspecialchars($plan['nom']) ?></h5>
                                <p class="card-text mb-2">
                                    <strong>Zone :</strong>
                                    <?php if (!empty($plan['zone'])): ?>
                                        <span class="badge bg-secondary"><?= htmlspecialchars(ucfirst($plan['zone'])) ?></span>
                                    <?php else: ?>
                                        <span class="badge bg-light text-dark">Non définie</span>
                                    <?php endif; ?>
                                </p>
                                <p class="card-text small text-muted">
                                    <strong>Univers :</strong> <?= htmlspecialchars($plan['univers_names'] ?? 'Aucun') ?>
                                </p>
                                <div class="mt-auto d-flex justify-content-between gap-2 pt-3">
                                    <a href="index.php?action=viewPlan&id=<?= $plan['id'] ?>" class="btn btn-sm btn-outline-primary w-100">
                                        <i class="bi bi-eye-fill"></i> Consulter
                                    </a>
                                    <a href="index.php?action=manageCodes&id=<?= $plan['id'] ?>" class="btn btn-sm btn-primary w-100">
                                        <i class="bi bi-pencil-square"></i> Gérer les codes
                                    </a>
                                </div>
                            </div>
                             <div class="card-footer text-center">
                                 <a href="index.php?action=editPlan&id=<?= $plan['id'] ?>" class="btn btn-sm btn-warning">
                                     <i class="bi bi-pencil-fill"></i> Modifier les informations
                                 </a>
                                 <a href="index.php?action=deletePlan&id=<?= $plan['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('Sûr de vouloir supprimer ce plan ?');">
                                     <i class="bi bi-trash-fill"></i>
                                 </a>
                             </div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php else: ?>
            <div class="alert alert-info text-center">
                <p>Aucun plan n'a été ajouté pour le moment.</p>
                <a href="index.php?action=addPlanForm" class="btn btn-primary">
                    <i class="bi bi-plus-circle-fill"></i> Créer votre premier plan
                </a>
            </div>
        <?php endif; ?>
    </section>
</div>
