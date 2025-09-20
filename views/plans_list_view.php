<?php $title = 'Gérer les Plans'; ?>

<div class="container">
    <section id="plan-manager">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="mb-0">Gérer les Plans du Magasin</h2>
        </div>
        
        <?php include __DIR__ . '/partials/flash_messages.php'; ?>
        
        <div class="row g-4">
            <div class="col-lg-5 col-xl-4">
                <div class="card sticky-top" style="top: calc(var(--navbar-height) + 1rem);">
                    <div class="card-header">
                        <h3 class="h5 mb-0"><i class="bi bi-plus-circle-fill"></i> Ajouter un plan</h3>
                    </div>
                    <div class="card-body">
                        <p class="card-text small text-muted">Formats acceptés : PNG, JPG, PDF.</p>
                        <form action="index.php?action=addPlan" method="POST" enctype="multipart/form-data">
                            <div class="mb-3">
                                <label for="nom" class="form-label">Nom du plan</label>
                                <input type="text" id="nom" name="nom" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label for="planFile" class="form-label">Fichier du plan</label>
                                <input type="file" id="planFile" name="planFile" class="form-control" accept=".png,.jpg,.jpeg,.pdf" required>
                            </div>
                            <button type="submit" class="btn btn-primary w-100">Ajouter le plan</button>
                        </form>
                    </div>
                </div>
            </div>

            <div class="col-lg-7 col-xl-8">
                <h3>Liste des plans existants</h3>
                <?php if (!empty($plans)): ?>
                    <div class="row g-3">
                        <?php foreach ($plans as $plan): ?>
                            <div class="col-12">
                                <div class="card plan-card">
                                    <div class="row g-0">
                                        <div class="col-md-4">
                                            <img src="uploads/plans/<?= htmlspecialchars($plan['nom_fichier']) ?>" class="img-fluid rounded-start" alt="Aperçu de <?= htmlspecialchars($plan['nom']) ?>">
                                        </div>
                                        <div class="col-md-8 d-flex flex-column">
                                            <div class="card-body">
                                                <h5 class="card-title"><?= htmlspecialchars($plan['nom']) ?></h5>
                                                <p class="card-text mb-2">
                                                    <strong>Zone :</strong>
                                                    <?php if ($plan['zone']): ?>
                                                        <span class="badge bg-secondary"><?= htmlspecialchars(ucfirst($plan['zone'])) ?></span>
                                                    <?php else: ?>
                                                        <span class="badge bg-light text-dark">Non définie</span>
                                                    <?php endif; ?>
                                                </p>
                                                <p class="card-text small text-muted">
                                                    <strong>Univers :</strong> <?= htmlspecialchars($plan['univers_names'] ?? 'Aucun') ?>
                                                </p>
                                            </div>
                                            <div class="card-footer bg-transparent border-top-0 mt-auto d-flex justify-content-end gap-2">
                                                <a href="index.php?action=editPlan&id=<?= $plan['id'] ?>" class="btn btn-sm btn-warning">
                                                    <i class="bi bi-pencil-fill"></i> Modifier
                                                </a>
                                                <a href="index.php?action=deletePlan&id=<?= $plan['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('Sûr de vouloir supprimer ce plan ?');">
                                                    <i class="bi bi-trash-fill"></i> Supprimer
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php else: ?>
                    <div class="alert alert-info">Aucun plan n'a été ajouté pour le moment.</div>
                <?php endif; ?>
            </div>
        </div>
    </section>
</div>
