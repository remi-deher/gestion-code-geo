<?php $title = 'Historique des Modifications'; ?>

<div class="container">
    <section id="full-history">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="mb-0"><i class="bi bi-clock-history"></i> Historique Global</h2>
            <a href="index.php?action=dashboard" class="btn btn-outline-secondary">
                <i class="bi bi-arrow-left"></i> Retour au tableau de bord
            </a>
        </div>
        
        <p>Voici les 50 dernières modifications effectuées sur l'ensemble des codes géographiques.</p>

        <div class="table-responsive">
            <table class="geo-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Code Géo</th>
                        <th>Action</th>
                        <th>Détails</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($history)): ?>
                        <tr>
                            <td colspan="4" class="text-center text-muted">Aucune modification n'a été enregistrée pour le moment.</td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($history as $entry): ?>
                            <tr>
                                <td><?= date('d/m/Y H:i:s', strtotime($entry['action_timestamp'])) ?></td>
                                <td>
                                    <a href="index.php?action=edit&id=<?= $entry['geo_code_id'] ?>">
                                        <?= htmlspecialchars($entry['code_geo']) ?>
                                    </a>
                                </td>
                                <td>
                                    <?php 
                                        $action = htmlspecialchars($entry['action_type']);
                                        $badge_class = 'bg-secondary';
                                        if ($action == 'created') $badge_class = 'bg-success';
                                        if ($action == 'updated') $badge_class = 'bg-warning text-dark';
                                        if ($action == 'deleted') $badge_class = 'bg-danger';
                                        if ($action == 'restored') $badge_class = 'bg-info text-dark';
                                    ?>
                                    <span class="badge <?= $badge_class ?>"><?= ucfirst($action) ?></span>
                                </td>
                                <td style="font-size: 0.8rem; color: #6c757d;"><?= htmlspecialchars($entry['details'] ?? 'N/A') ?></td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </section>
</div>
