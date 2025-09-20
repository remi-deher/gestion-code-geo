<?php $title = 'Tableau de Bord'; ?>

<?php ob_start(); ?>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
document.addEventListener('DOMContentLoaded', () => {
    const ctx = document.getElementById('universChart');
    if (ctx) {
        const chartData = <?= json_encode($chartJsData) ?>;

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Codes Géo',
                    data: chartData.data,
                    backgroundColor: [
                        '#3498db', '#e74c3c', '#2ecc71', '#f1c40f', 
                        '#9b59b6', '#1abc9c', '#e67e22', '#34495e'
                    ],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Répartition des codes par univers'
                    }
                }
            }
        });
    }
});
</script>
<?php $body_scripts = ob_get_clean(); ?>

<div class="container mt-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h1>Tableau de bord</h1>
        <div class="d-flex gap-2">
            <a href="index.php?action=list" class="btn btn-outline-secondary">Voir la liste</a>
            <a href="index.php?action=create" class="btn btn-primary">Ajouter un code</a>
            <a href="index.php?action=plan" class="btn btn-secondary">Voir le plan</a>
        </div>
    </div>

    <div class="row g-4 mb-4">
        <div class="col-md-6 col-lg-3">
            <div class="card h-100">
                <div class="card-body text-center">
                    <h5 class="card-title">Codes Géo Total</h5>
                    <p class="card-text fs-1 fw-bold"><?= $stats['totalCodes'] ?></p>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-lg-3">
            <div class="card h-100">
                <div class="card-body text-center">
                    <h5 class="card-title">Codes Placés</h5>
                    <p class="card-text fs-1 fw-bold text-success"><?= $stats['placedCodes'] ?></p>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-lg-3">
            <div class="card h-100">
                <div class="card-body text-center">
                    <h5 class="card-title">Codes Non Placés</h5>
                    <p class="card-text fs-1 fw-bold text-danger"><?= $stats['unplacedCodes'] ?></p>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-lg-3">
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title text-center mb-3">Répartition par Zone</h5>
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <strong>Zone de Vente</strong>
                            <span class="badge bg-primary rounded-pill"><?= $stats['codesByZone']['vente'] ?? 0 ?> codes</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <strong>Réserve</strong>
                            <span class="badge bg-secondary rounded-pill"><?= $stats['codesByZone']['reserve'] ?? 0 ?> codes</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            Univers Vente
                            <span class="badge bg-light text-dark rounded-pill"><?= $stats['universByZone']['vente'] ?? 0 ?></span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            Univers Réserve
                            <span class="badge bg-light text-dark rounded-pill"><?= $stats['universByZone']['reserve'] ?? 0 ?></span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>

    <div class="row g-4">
        <div class="col-lg-5">
            <div class="card h-100">
                <div class="card-body">
                    <canvas id="universChart"></canvas>
                </div>
            </div>
        </div>
        <div class="col-lg-7">
            <div class="card mb-4">
                <div class="card-header">Codes à placer en priorité</div>
                <ul class="list-group list-group-flush">
                    <?php if (empty($unplacedCodesList)): ?>
                        <li class="list-group-item">🎉 Tous les codes sont placés !</li>
                    <?php else: ?>
                        <?php foreach ($unplacedCodesList as $code): ?>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span><strong><?= htmlspecialchars($code['code_geo']) ?></strong> - <?= htmlspecialchars($code['libelle']) ?></span>
                                <a href="index.php?action=plan" class="btn btn-sm btn-outline-primary">Placer</a>
                            </li>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </ul>
            </div>
            <div class="card">
                <div class="card-header">Derniers codes ajoutés</div>
                <ul class="list-group list-group-flush">
                     <?php foreach ($latestCodes as $code): ?>
                        <li class="list-group-item">
                            <strong><?= htmlspecialchars($code['code_geo']) ?></strong> (<?= htmlspecialchars($code['univers']) ?>) - <?= htmlspecialchars($code['libelle']) ?>
                        </li>
                    <?php endforeach; ?>
                </ul>
            </div>
        </div>
    </div>
</div>
