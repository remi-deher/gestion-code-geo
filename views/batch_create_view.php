<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ajout par Lot de Codes Géo</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <?php include 'partials/navbar.php'; ?>
    <div class="container">
        <section id="batch-creation-form">
            <h2>Ajout par Lot de Codes Géo</h2>
            <p>Choisissez une zone et un univers, puis ajoutez autant de codes géo que nécessaire.</p>

            <form action="index.php?action=handleBatchCreate" method="POST">
                <!-- Étape 1 : Sélection de la zone et de l'univers -->
                <div class="form-group-selection">
                    <div class="form-group">
                        <label for="zone">1. Choisir la Zone de stockage</label>
                        <select id="zone" name="zone" required>
                            <option value="">-- D'abord choisir une zone --</option>
                            <option value="vente">Zone de Vente</option>
                            <option value="reserve">Réserve</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="univers_id">2. Choisir l'Univers de produit</label>
                        <select id="univers_id" name="univers_id" required disabled>
                            <option value="">-- En attente d'une zone --</option>
                        </select>
                    </div>
                </div>

                <!-- Étape 2 : Tableau de saisie (initialement caché) -->
                <div id="batch-entry-container" style="display: none;">
                    <h3>3. Saisir les codes et libellés</h3>
                    <table class="geo-table batch-table">
                        <thead>
                            <tr>
                                <th>Code Géo</th>
                                <th>Libellé</th>
                                <th class="no-sort">Action</th>
                            </tr>
                        </thead>
                        <tbody id="batch-tbody">
                            <!-- Les lignes seront ajoutées ici par JavaScript -->
                        </tbody>
                    </table>
                    <div class="batch-actions">
                        <button type="button" id="add-row-btn">Ajouter une ligne</button>
                        <button type="submit">Enregistrer le lot</button>
                    </div>
                </div>
            </form>
        </section>
    </div>

    <script>
        const allUnivers = <?= json_encode($universList ?? []) ?>;

        document.addEventListener('DOMContentLoaded', () => {
            const zoneSelect = document.getElementById('zone');
            const universSelect = document.getElementById('univers_id');
            const batchEntryContainer = document.getElementById('batch-entry-container');
            const batchTbody = document.getElementById('batch-tbody');
            const addRowBtn = document.getElementById('add-row-btn');

            // --- Logique des menus déroulants dynamiques ---
            function updateUniversOptions() {
                const selectedZone = zoneSelect.value;
                universSelect.innerHTML = '<option value="">-- Choisir un univers --</option>';

                if (selectedZone) {
                    const filteredUnivers = allUnivers.filter(u => u.zone_assignee === selectedZone);
                    filteredUnivers.forEach(u => {
                        const option = document.createElement('option');
                        option.value = u.id;
                        option.textContent = u.nom;
                        universSelect.appendChild(option);
                    });
                    universSelect.disabled = filteredUnivers.length === 0;
                    if (filteredUnivers.length === 0) {
                        universSelect.innerHTML = '<option value="">-- Aucun univers pour cette zone --</option>';
                    }
                } else {
                    universSelect.disabled = true;
                }
                
                // On cache le tableau de saisie si l'univers n'est pas sélectionné
                batchEntryContainer.style.display = 'none';
            }

            zoneSelect.addEventListener('change', updateUniversOptions);
            
            universSelect.addEventListener('change', () => {
                // Affiche le tableau de saisie une fois qu'un univers est choisi
                if (universSelect.value) {
                    batchEntryContainer.style.display = 'block';
                    if (batchTbody.rows.length === 0) {
                        addNewRow(); // Ajoute la première ligne automatiquement
                    }
                } else {
                    batchEntryContainer.style.display = 'none';
                }
            });

            // --- Logique pour ajouter/supprimer des lignes ---
            function addNewRow() {
                const newRow = batchTbody.insertRow();
                newRow.innerHTML = `
                    <td><input type="text" name="codes_geo[]" class="form-control" placeholder="Code Géo" required></td>
                    <td><input type="text" name="libelles[]" class="form-control" placeholder="Libellé" required></td>
                    <td class="item-actions"><button type="button" class="btn-delete-row">❌</button></td>
                `;
            }

            addRowBtn.addEventListener('click', addNewRow);
            
            // Délégué d'événement pour gérer la suppression des lignes
            batchTbody.addEventListener('click', (event) => {
                if (event.target.classList.contains('btn-delete-row')) {
                    event.target.closest('tr').remove();
                }
            });
        });
    </script>
</body>
</html>
