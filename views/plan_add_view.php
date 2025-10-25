<?php $title = 'Ajouter un Plan'; ?>

<?php ob_start(); // Début capture pour le script JS ?>
<script>
document.addEventListener('DOMContentLoaded', () => {
    const choiceImport = document.getElementById('choiceImport');
    const choiceDraw = document.getElementById('choiceDraw');
    const uploadFormSection = document.getElementById('upload-form-section');
    const drawLinkSection = document.getElementById('draw-link-section');

    function toggleSections() {
        if (choiceImport && choiceImport.checked) {
            uploadFormSection.style.display = 'block';
            drawLinkSection.style.display = 'none';
        } else if (choiceDraw && choiceDraw.checked) {
            uploadFormSection.style.display = 'none';
            drawLinkSection.style.display = 'block';
        } else {
            // État initial ou si rien n'est coché (ne devrait pas arriver avec des radios)
            uploadFormSection.style.display = 'none';
            drawLinkSection.style.display = 'none';
        }
    }

    if (choiceImport) {
        choiceImport.addEventListener('change', toggleSections);
    }
    if (choiceDraw) {
        choiceDraw.addEventListener('change', toggleSections);
    }

    // Afficher la section d'import par défaut au chargement
    if (choiceImport) {
        choiceImport.checked = true; // Coche l'import par défaut
    }
    toggleSections(); // Appelle une fois pour l'état initial
});
</script>
<?php $body_scripts = ob_get_clean(); // Fin capture ?>

<div class="container">
    <section id="plan-add-form">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="mb-0">Ajouter un nouveau plan</h2>
            <a href="index.php?action=listPlans" class="btn btn-secondary">
                <i class="bi bi-arrow-left"></i> Annuler et retourner à la liste
            </a>
        </div>

        <div class="card">
            <div class="card-header">
                Choisissez une méthode de création :
            </div>
            <div class="card-body">
                
                <div class="mb-3">
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="radio" name="creationChoice" id="choiceImport" value="import" checked>
                        <label class="form-check-label" for="choiceImport">
                            <i class="bi bi-upload"></i> Importer un fichier (SVG, PNG, JPG, PDF)
                        </label>
                    </div>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="radio" name="creationChoice" id="choiceDraw" value="draw">
                        <label class="form-check-label" for="choiceDraw">
                            <i class="bi bi-vector-pen"></i> Dessiner un nouveau plan (SVG)
                        </label>
                    </div>
                </div>

                <hr>

                
                <div id="upload-form-section" style="display: none;">
                    <h5>Importer un fichier existant</h5>
                    <p class="card-text small text-muted">Formats acceptés : SVG, PNG, JPG, JPEG. Les PDF seront convertis en PNG si possible.</p>
                    <form action="index.php?action=addPlan" method="POST" enctype="multipart/form-data">
                        <div class="mb-3">
                            <label for="nomImport" class="form-label">Nom du plan</label>
                            <input type="text" id="nomImport" name="nom" class="form-control" required placeholder="Ex: Plan du rez-de-chaussée">
                        </div>
                        <div class="mb-3">
                            <label for="planFile" class="form-label">Fichier du plan</label>
                            <input type="file" id="planFile" name="planFile" class="form-control" accept=".svg,.png,.jpg,.jpeg,.pdf" required>
                        </div>
                        <div class="d-flex justify-content-end gap-2 mt-4">
                            <button type="submit" class="btn btn-primary">
                                <i class="bi bi-plus-circle-fill"></i> Ajouter le plan importé
                            </button>
                        </div>
                    </form>
                </div>

                
                <div id="draw-link-section" style="display: none;">
                    <h5>Dessiner un nouveau plan</h5>
                    <p>Vous serez redirigé vers l'éditeur de dessin pour créer votre plan au format SVG.</p>
                    <a href="index.php?action=createBlankPlan" class="btn btn-primary">
                        <i class="bi bi-pencil-square"></i> Commencer à dessiner
                    </a>
                </div>

            </div>
        </div>
    </section>
</div>
