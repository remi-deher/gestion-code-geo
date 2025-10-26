<?php $title = 'Les Plans du Magasin'; ?>

<?php ob_start(); // Début capture pour CSS spécifique si besoin ?>
<link rel="stylesheet" href="css/pages/_plans-list.css">
<?php $head_styles = ob_get_clean(); ?>


<div class="container">
    <section id="plan-manager">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <h1 class="mb-0"><i class="bi bi-map-fill"></i> Gestion des Plans</h1>
            <a href="index.php?action=addPlanForm" class="btn btn-primary">
                <i class="bi bi-plus-circle-fill"></i> Ajouter un nouveau plan
            </a>
        </div>

        <?php include __DIR__ . '/partials/flash_messages.php'; // Inclut les messages flash ?>

        <?php if (!empty($plans)): ?>
            <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
                <?php foreach ($plans as $plan):
                    // Construire le chemin vers l'aperçu/image
                    $planImagePath = 'uploads/plans/' . htmlspecialchars($plan['nom_fichier']);
                    // Vérifier si le fichier existe pour éviter les erreurs
                    $imageSrc = file_exists(__DIR__ . '/../public/' . $planImagePath) ? $planImagePath : 'img/placeholder-plan.png'; // Mettez un placeholder si besoin
                ?>
                    <div class="col">
                        <div class="card h-100 plan-card shadow-sm">
                            <a href="index.php?action=viewPlan&id=<?= $plan['id'] ?>" class="plan-card-link">
                                <img src="<?= $imageSrc ?>" class="card-img-top plan-card-img" alt="Aperçu de <?= htmlspecialchars($plan['nom']) ?>">
                            </a>
                            <div class="card-body d-flex flex-column">
                                <h5 class="card-title">
                                     <a href="index.php?action=viewPlan&id=<?= $plan['id'] ?>" class="text-decoration-none">
                                        <?= htmlspecialchars($plan['nom']) ?>
                                     </a>
                                </h5>
                                <?php if (!empty($plan['description'])): ?>
                                    <p class="card-text small text-muted mb-2"><?= nl2br(htmlspecialchars($plan['description'])) ?></p>
                                <?php endif; ?>

                                <p class="card-text mb-2">
                                    <small class="text-muted">Zone :</small>
                                    <?php if (!empty($plan['zone'])): ?>
                                        <span class="badge rounded-pill bg-<?= ($plan['zone'] == 'vente') ? 'info' : 'warning' ?> text-dark"><?= htmlspecialchars(ucfirst($plan['zone'])) ?></span>
                                    <?php else: ?>
                                        <span class="badge rounded-pill bg-light text-dark">Non définie</span>
                                    <?php endif; ?>
                                </p>
                                <p class="card-text small text-muted mt-auto pt-2">
                                    <strong>Univers associés :</strong> <?= htmlspecialchars($plan['univers_names'] ?? 'Aucun') ?>
                                </p>
                            </div>
                             <div class="card-footer bg-light d-flex justify-content-end gap-2">
                                 <a href="index.php?action=editPlan&id=<?= $plan['id'] ?>" class="btn btn-sm btn-outline-secondary" title="Modifier les informations">
                                     <i class="bi bi-pencil-fill"></i> Modifier
                                 </a>
                                 <a href="index.php?action=printPlan&id=<?= $plan['id'] ?>" class="btn btn-sm btn-outline-info" title="Imprimer le plan" target="_blank">
                                     <i class="bi bi-printer-fill"></i> Imprimer
                                 </a>
                                 <a href="index.php?action=deletePlan&id=<?= $plan['id'] ?>" class="btn btn-sm btn-outline-danger" title="Supprimer le plan" onclick="return confirm('Êtes-vous sûr de vouloir mettre ce plan à la corbeille ?');">
                                     <i class="bi bi-trash-fill"></i> Supprimer
                                 </a>
                             </div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php else: ?>
            <div class="alert alert-info text-center">
                <p class="lead mb-3">Aucun plan n'a été ajouté pour le moment.</p>
                <a href="index.php?action=addPlanForm" class="btn btn-primary">
                    <i class="bi bi-plus-circle-fill"></i> Créer votre premier plan
                </a>
            </div>
        <?php endif; ?>
    </section>
</div>
