<?php $title = 'Gestion des Assets'; ?>

<?php ob_start(); // CSS spécifique si besoin ?>
<style>
    .asset-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem; }
    .asset-card { border: 1px solid #ddd; border-radius: 4px; padding: 1rem; text-align: center; position: relative; }
    .asset-card img { max-width: 100%; height: 80px; object-fit: contain; margin-bottom: 0.5rem; background-color: #f8f9fa; border: 1px solid #eee; }
    .asset-card .asset-name { font-size: 0.9rem; font-weight: bold; word-break: break-word; }
    .asset-card .delete-asset-btn { position: absolute; top: 5px; right: 5px; background: rgba(255,0,0,0.7); border: none; color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 10px; line-height: 10px; padding: 0; cursor: pointer; }
    .asset-card .delete-asset-btn:hover { background: red; }
</style>
<?php $head_styles = ob_get_clean(); ?>

<div class="container">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h1><i class="bi bi-box-seam"></i> Gestion des Assets</h1>
        <a href="index.php?action=listPlans" class="btn btn-outline-secondary">
            <i class="bi bi-arrow-left"></i> Retour aux Plans
        </a>
    </div>

    <?php include __DIR__ . '/partials/flash_messages.php'; ?>

    <div class="card mb-4">
        <div class="card-header">Ajouter un Asset (depuis l'éditeur de plan)</div>
        <div class="card-body">
            <p>Pour ajouter un nouvel asset, allez dans l'éditeur d'un plan (<a href="index.php?action=listPlans">Liste des plans</a>), sélectionnez un ou plusieurs objets, puis utilisez le bouton "Créer Asset" dans la barre d'outils.</p>
            <p class="small text-muted">(L'import direct de fichiers SVG/Image sera ajouté ultérieurement ici si besoin).</p>
        </div>
    </div>

    <div class="card">
        <div class="card-header">Bibliothèque d'Assets</div>
        <div class="card-body">
            <div class="asset-list" id="asset-list-container">
                <?php if (empty($assets)): ?>
                    <p class="text-muted">Aucun asset n'a été créé pour le moment.</p>
                <?php else: ?>
                    <?php foreach ($assets as $asset): ?>
                        <div class="asset-card" data-asset-id="<?= $asset['id'] ?>">
                            <button class="delete-asset-btn" title="Supprimer">&times;</button>
                            <?php if (!empty($asset['thumbnail'])): ?>
                                <img src="<?= htmlspecialchars($asset['thumbnail']) ?>" alt="Aperçu de <?= htmlspecialchars($asset['name']) ?>">
                            <?php else: ?>
                                <div style="height: 80px; display: flex; align-items: center; justify-content: center; background-color: #f0f0f0; color: #aaa; font-size: 2rem;">
                                    <i class="bi bi-bounding-box"></i> </div>
                            <?php endif; ?>
                            <div class="asset-name"><?= htmlspecialchars($asset['name']) ?></div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>

<?php ob_start(); // JS pour la suppression ?>
<script>
    document.addEventListener('DOMContentLoaded', () => {
        const assetListContainer = document.getElementById('asset-list-container');
        if (!assetListContainer) return;

        assetListContainer.addEventListener('click', async (event) => {
            if (event.target.classList.contains('delete-asset-btn')) {
                const card = event.target.closest('.asset-card');
                const assetId = card?.dataset.assetId;
                const assetName = card?.querySelector('.asset-name')?.textContent || 'cet asset';

                if (assetId && confirm(`Êtes-vous sûr de vouloir supprimer définitivement "${assetName}" ? Cette action est irréversible.`)) {
                    try {
                        const response = await fetch('index.php?action=apiDeleteAsset', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            body: JSON.stringify({ id: parseInt(assetId) })
                        });

                        const result = await response.json();

                        if (response.ok && result.success) {
                            card.remove();
                            // Afficher un toast de succès (si vous avez la fonction showToast)
                            // showToast('Asset supprimé.', 'success');
                            alert('Asset supprimé.'); // Fallback simple
                            if (assetListContainer.children.length === 0) {
                                 assetListContainer.innerHTML = '<p class="text-muted">Aucun asset n\'a été créé pour le moment.</p>';
                            }
                        } else {
                            throw new Error(result.error || `Erreur ${response.status}`);
                        }
                    } catch (error) {
                        console.error("Erreur suppression asset:", error);
                        alert(`Erreur lors de la suppression : ${error.message}`);
                    }
                }
            }
        });
    });
</script>
<?php $body_scripts = ob_get_clean(); ?>
