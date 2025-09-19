<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Options d'Impression</title>
    <link rel="stylesheet" href="css/style.css">
    <style>
        .univers-selection { max-height: 400px; overflow-y: auto; border: 1px solid var(--border-color); padding: 1rem; border-radius: 4px; }
        .univers-selection label { display: block; margin-bottom: 0.5rem; }
        .selection-actions { margin-top: 1rem; }
    </style>
</head>
<body>
    <?php include 'partials/navbar.php'; ?>
    <div class="container">
        <section>
            <h2>Options d'Impression des Étiquettes</h2>
            <p>Veuillez sélectionner les univers de produits que vous souhaitez imprimer.</p>
            
            <form action="index.php?action=generatePrint" method="POST" target="_blank">
                <div class="form-group">
                    <label><strong>Univers disponibles</strong></label>
                    <div class="selection-actions">
                        <button type="button" id="select-all">Tout sélectionner</button>
                        <button type="button" id="deselect-all">Tout désélectionner</button>
                    </div>
                    <div class="univers-selection">
                        <?php foreach ($universList as $univers): ?>
                            <label>
                                <input type="checkbox" name="univers_ids[]" value="<?= $univers['id'] ?>" checked>
                                <?= htmlspecialchars($univers['nom']) ?>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>
                
                <button type="submit">Générer et Imprimer</button>
            </form>
        </section>
    </div>

    <script>
        document.getElementById('select-all').addEventListener('click', () => {
            document.querySelectorAll('.univers-selection input[type="checkbox"]').forEach(cb => cb.checked = true);
        });
        document.getElementById('deselect-all').addEventListener('click', () => {
            document.querySelectorAll('.univers-selection input[type="checkbox"]').forEach(cb => cb.checked = false);
        });
    </script>
</body>
</html>
