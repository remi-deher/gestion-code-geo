<?php $title = 'Tableau de Bord'; ?>

<?php ob_start(); // Début de la capture pour les scripts spécifiques à cette vue ?>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
    document.addEventListener('DOMContentLoaded', function () {
        const chartJsData = <?= json_encode($chartJsData ?? ['labels' => [], 'data' => []]) ?>;

        const ctx = document.getElementById('codesByUniversChart');
        if (ctx && chartJsData && chartJsData.labels.length > 0) { // Vérifier si ctx et données existent
            const codesByUniversChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: chartJsData.labels,
                    datasets: [{
                        label: 'Codes par Univers',
                        data: chartJsData.data,
                        backgroundColor: [ // Fournir un jeu de couleurs
                            '#0d6efd', '#6f42c1', '#d63384', '#fd7e14', '#ffc107',
                            '#198754', '#20c997', '#0dcaf0', '#6c757d', '#adb5bd'
                            // Ajoutez plus de couleurs si nécessaire
                        ],
                        borderColor: '#fff',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                        },
                        title: {
                            display: true,
                            text: 'Répartition des Codes par Univers'
                        }
                    }
                }
            });
        } else if (ctx) {
            ctx.getContext('2d').fillText("Aucune donnée d'univers disponible.", 10, 50);
        }
    });
</script>
<?php $body_scripts = ob_get_clean(); // Fin de la capture ?>

<div class="container mt-4">
    <h1 class="mb-4"><i class="bi bi-speedometer2"></i> Tableau de Bord</h1>

    <div class="row mb-4">
        <div class="col-lg-4 col-md-6 mb-3">
            <div class="card text-white bg-primary h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h5 class="card-title fs-1"><?= $stats['totalCodes'] ?? 0 ?></h5>
                            <p class="card-text">Codes Géo Total</p>
                        </div>
                        <i class="bi bi-box-seam fs-1 opacity-50"></i>
                    </div>
                </div>
                <div class="card-footer d-flex align-items-center justify-content-between">
                    <a href="index.php?action=list" class="small text-white stretched-link">Voir la liste</a>
                    <div class="small text-white"><i class="bi bi-chevron-right"></i></div>
                </div>
            </div>
        </div>

        <div class="col-lg-4 col-md-6 mb-3">
            <div class="card text-white bg-secondary h-100">
                <div class="card-body">
                     <div class="d-flex justify-content-between align-items-center">
                         <div>
                            <h5 class="card-title fs-1"><?= $stats['totalUnivers'] ?? 0 ?></h5>
                            <p class="card-text">Univers Produits</p>
                         </div>
                         <i class="bi bi-tags-fill fs-1 opacity-50"></i>
                     </div>
                </div>
                <div class="card-footer d-flex align-items-center justify-content-between">
                    <a href="index.php?action=listUnivers" class="small text-white stretched-link">Gérer les univers</a>
                    <div class="small text-white"><i class="bi bi-chevron-right"></i></div>
                </div>
            </div>
        </div>

        <div class="col-lg-4 col-md-12 mb-3">
            <div class="card h-100">
                <div class="card-header"><i class="bi bi-geo-alt-fill"></i> Répartition par Zone</div>
                <div class="card-body d-flex flex-column justify-content-center gap-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="fw-bold">Zone de Vente</span>
                            <small class="text-muted d-block"><?= $stats['universByZone']['vente'] ?? 0 ?> univers</small>
                        </div>
                        <span class="zone-badge zone-vente"><?= $stats['codesByZone']['vente'] ?? 0 ?> codes</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="fw-bold">Réserve</span>
                            <small class="text-muted d-block"><?= $stats['universByZone']['reserve'] ?? 0 ?> univers</small>
                        </div>
                        <span class="zone-badge zone-reserve"><?= $stats['codesByZone']['reserve'] ?? 0 ?> codes</span>
                    </div>
                     <?php if(isset($stats['codesByZone']['Non spécifiée']) && $stats['codesByZone']['Non spécifiée'] > 0): ?>
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="fw-bold text-warning">Non spécifiée</span>
                            <small class="text-muted d-block">
                                <?= $stats['universByZone']['Non spécifiée'] ?? 0 ?> univers
                            </small>
                        </div>
                        <span class="badge bg-warning text-dark"><?= $stats['codesByZone']['Non spécifiée'] ?> codes</span>
                    </div>
                    <?php endif; ?>
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
                    <?php if (!empty($chartJsData['labels'])): ?>
                        <canvas id="codesByUniversChart"></canvas>
                    <?php else: ?>
                        <p class="text-center text-muted mt-5">Aucun code géo n'a encore été associé à un univers.</p>
                    <?php endif; ?>
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
                                        <a href="index.php?action=edit&id=<?= $code['id'] ?>" class="text-decoration-none">
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
</div>
