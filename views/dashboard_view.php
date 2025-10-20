<?php $title = 'Tableau de Bord'; ?>

<?php ob_start(); // Début de la capture pour les scripts spécifiques à cette vue ?>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
    document.addEventListener('DOMContentLoaded', function () {
        // Données JSON préparées par le contrôleur
        const chartJsData = <?= json_encode($chartJsData ?? ['labels' => [], 'data' => []]) ?>;
        
        // Configuration du graphique
        const ctx = document.getElementById('codesByUniversChart').getContext('2d');
        const codesByUniversChart = new Chart(ctx, {
            type: 'doughnut', // Type de graphique (camembert)
            data: {
                labels: chartJsData.labels,
                datasets: [{
                    label: 'Codes par Univers',
                    data: chartJsData.data,
                    backgroundColor: [ // Fournir un jeu de couleurs ou le générer
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                        'rgba(255, 159, 64, 0.7)',
                        'rgba(199, 199, 199, 0.7)',
                        'rgba(83, 102, 255, 0.7)',
                        'rgba(40, 159, 64, 0.7)',
                        'rgba(210, 99, 132, 0.7)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)',
                        'rgba(199, 199, 199, 1)',
                        'rgba(83, 102, 255, 1)',
                        'rgba(40, 159, 64, 1)',
                        'rgba(210, 99, 132, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Permet au graphique de remplir le conteneur
                plugins: {
                    legend: {
                        position: 'right', // Afficher la légende à droite
                    },
                    title: {
                        display: true,
                        text: 'Répartition des Codes par Univers'
                    }
                }
            }
        });
    });
</script>
<?php $body_scripts = ob_get_clean(); // Fin de la capture ?>

<div class="container mt-4">
    <h1 class="mb-4"><i class="bi bi-speedometer2"></i> Tableau de Bord</h1>

    <div class="row mb-4">
        <div class="col-md-3 mb-3">
            <div class="card text-white bg-primary h-100">
                <div class="card-body">
                    <h5 class="card-title"><?= $stats['totalCodes'] ?? 0 ?></h5>
                    <p class="card-text">Codes Géo Total</p>
                </div>
                <div class="card-footer d-flex align-items-center justify-content-between">
                    <a href="index.php?action=listGeoCodes" class="small text-white stretched-link">Voir détails</a>
                    <div class="small text-white"><i class="bi bi-chevron-right"></i></div>
                </div>
            </div>
        </div>

        <div class="col-md-3 mb-3">
            <div class="card text-white bg-success h-100">
                <div class="card-body">
                    <h5 class="card-title"><?= $stats['placedCodesCount'] ?? 0 ?></h5>
                    <p class="card-text">Placements Effectués</p>
                </div>
                 <div class="card-footer d-flex align-items-center justify-content-between">
                    <span class="small text-white">Nombre total de positions</span>
                    </div>
            </div>
        </div>

        <div class="col-md-3 mb-3">
            <div class="card text-white bg-warning h-100">
                <div class="card-body">
                    <h5 class="card-title"><?= $stats['unplacedCodesCount'] ?? 0 ?></h5>
                    <p class="card-text">Codes Non Placés</p>
                </div>
                 <div class="card-footer d-flex align-items-center justify-content-between">
                    <span class="small text-white">Codes jamais utilisés</span>
                    </div>
            </div>
        </div>
        
        <div class="col-md-3 mb-3">
            <div class="card text-white bg-info h-100">
                <div class="card-body">
                    <h5 class="card-title"><?= $stats['totalPlans'] ?? 0 ?></h5>
                    <p class="card-text">Plans Disponibles</p>
                </div>
                <div class="card-footer d-flex align-items-center justify-content-between">
                    <a href="index.php?action=listPlans" class="small text-white stretched-link">Voir la liste</a>
                    <div class="small text-white"><i class="bi bi-chevron-right"></i></div>
                </div>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-lg-6 mb-4">
            <div class="card h-100">
                <div class="card-header">
                    <i class="bi bi-pie-chart-fill me-1"></i>
                    Codes par Univers
                </div>
                <div class="card-body" style="position: relative; height:300px">
                    <canvas id="codesByUniversChart"></canvas>
                </div>
                 <div class="card-footer small text-muted">Répartition des codes géo existants.</div>
            </div>
        </div>

        <div class="col-lg-6 mb-4">
            <div class="card h-100">
                <div class="card-header">
                    <i class="bi bi-clock-history me-1"></i>
                    Derniers Codes Modifiés
                </div>
                <div class="card-body">
                    <?php if (!empty($latestCodes)): ?>
                        <ul class="list-group list-group-flush">
                            <?php foreach ($latestCodes as $code): ?>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    <div>
                                        <a href="index.php?action=editGeoCode&id=<?= $code['id'] ?>" class="text-decoration-none">
                                            <?= htmlspecialchars($code['code_geo']) ?>
                                        </a>
                                        <small class="d-block text-muted"><?= htmlspecialchars($code['libelle'] ?? '') ?></small>
                                    </div>
                                    <span class="badge rounded-pill" style="background-color: <?= htmlspecialchars($code['univers_color'] ?? '#6c757d') ?>; color: white;">
                                         <?= htmlspecialchars($code['univers_nom'] ?? 'Inconnu') ?>
                                    </span>
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    <?php else: ?>
                        <p class="text-muted">Aucun code géo trouvé.</p>
                    <?php endif; ?>
                </div>
                 <div class="card-footer small text-muted">Les 5 derniers codes ajoutés ou mis à jour.</div>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-12 mb-4">
             <div class="card">
                 <div class="card-header">
                     <i class="bi bi-journal-x me-1"></i>
                     Codes Géo Jamais Placés (Échantillon)
                 </div>
                 <div class="card-body">
                     <?php if (!empty($unplacedCodesList)): ?>
                         <ul class="list-group list-group-flush">
                             <?php foreach ($unplacedCodesList as $code): ?>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                     <div>
                                         <a href="index.php?action=editGeoCode&id=<?= $code['id'] ?>" class="text-decoration-none">
                                             <?= htmlspecialchars($code['code_geo']) ?>
                                         </a>
                                         <small class="d-block text-muted"><?= htmlspecialchars($code['libelle'] ?? '') ?></small>
                                     </div>
                                     <span class="badge rounded-pill" style="background-color: <?= htmlspecialchars($code['univers_color'] ?? '#6c757d') ?>; color: white;">
                                          <?= htmlspecialchars($code['univers_nom'] ?? 'Inconnu') ?>
                                     </span>
                                 </li>
                            <?php endforeach; ?>
                         </ul>
                     <?php else: ?>
                         <p class="text-muted">Tous les codes géo ont été placés au moins une fois, ou aucun code n'existe.</p>
                     <?php endif; ?>
                 </div>
                 <div class="card-footer small text-muted">Liste des codes qui n'apparaissent sur aucun plan (max 10 affichés).</div>
             </div>
        </div>
     </div>

</div>
