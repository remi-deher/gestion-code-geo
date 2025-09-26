<?php $title = 'Ajouter un Plan'; ?>

<div class="container">
    <section id="plan-add-form">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="mb-0">Ajouter un nouveau plan</h2>
            <a href="index.php?action=listPlans" class="btn btn-secondary">
                <i class="bi bi-arrow-left"></i> Annuler et retourner à la liste
            </a>
        </div>

        <div class="card">
            <div class="card-body">
                <p class="card-text small text-muted">Formats de fichier acceptés : SVG, PNG, JPG, JPEG. Les PDF seront automatiquement convertis en PNG si l'extension Imagick est installée sur votre serveur.</p>
                <form action="index.php?action=addPlan" method="POST" enctype="multipart/form-data">
                    <div class="mb-3">
                        <label for="nom" class="form-label">Nom du plan</label>
                        <input type="text" id="nom" name="nom" class="form-control" required placeholder="Ex: Plan du rez-de-chaussée">
                    </div>
                    <div class="mb-3">
                        <label for="planFile" class="form-label">Fichier du plan</label>
                        <input type="file" id="planFile" name="planFile" class="form-control" accept=".svg,.png,.jpg,.jpeg,.pdf" required>
                    </div>
                    <div class="d-flex justify-content-end gap-2 mt-4">
                        <button type="submit" class="btn btn-primary">
                            <i class="bi bi-plus-circle-fill"></i> Ajouter le plan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </section>
</div>
