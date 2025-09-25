<?php $title = 'Historique du Code Géo'; ?>

<div class="container">
    <section id="history">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2><i class="bi bi-clock-history"></i> Historique pour : <?= htmlspecialchars($geoCode['code_geo']) ?></h2>
            <a href="index.php?action=list" class="btn btn-outline-secondary">
                <i class="bi bi-arrow-left"></i> Retour à la liste
            </a>
        </div>

        <ul class="list-group">
            <?php foreach ($history as $entry): ?>
                <li class="list-group-item">
                    <p class="mb-1"><strong>Action :</strong> <?= htmlspecialchars(ucfirst($entry['action_type'])) ?></p>
                    <p class="mb-1"><strong>Date :</strong> <?= date('d/m/Y H:i', strtotime($entry['action_timestamp'])) ?></p>
                    <?php if (!empty($entry['details'])): ?>
                        <p class="mb-0"><strong>Détails :</strong> <?= htmlspecialchars($entry['details']) ?></p>
                    <?php endif; ?>
                </li>
            <?php endforeach; ?>
        </ul>
    </section>
</div>
