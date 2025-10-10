<?php $title = 'Consultation du Plan : ' . htmlspecialchars($plan['nom']); ?>

<?php ob_start(); ?>
<script>
    // Données pour le script de visualisation
    let placedGeoCodes = <?= json_encode($placedGeoCodes ?? []); ?>;
    const universColors = <?= json_encode($universColors ?? []); ?>;
    const currentPlanId = <?= json_encode($plan['id']); ?>;
</script>
<script src="js/plan-viewer.js"></script> 
<?php $body_scripts = ob_get_clean(); ?>

<div class="plan-page-container">
    <div class="plan-main-content">
        <div class="plan-toolbar no-print">
            <a href="index.php?action=listPlans" class="btn btn-secondary"><i class="bi bi-arrow-left"></i> Retour à la liste des plans</a>
            <h3 class="mb-0 mx-auto"><?= htmlspecialchars($plan['nom']) ?></h3>
            
            <button class="btn btn-secondary" id="fullscreen-btn" title="Plein écran">
                <i class="bi bi-arrows-fullscreen"></i>
            </button>
            
            <a href="index.php?action=manageCodes&id=<?= $plan['id'] ?>" class="btn btn-primary"><i class="bi bi-pencil-square"></i> Passer en mode édition</a>
        </div>

        <div id="plan-container">
            <canvas id="plan-canvas" style="cursor: grab;"></canvas>
            <img src="uploads/plans/<?= htmlspecialchars($plan['nom_fichier']) ?>" alt="Plan du magasin" id="map-image" style="display: none;">
        </div>
    </div>
</div>
