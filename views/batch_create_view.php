<?php $title = 'Ajout par Lot'; ?>

<?php ob_start(); ?>
<script>
    const allUnivers = <?= json_encode($universList ?? []) ?>;
    document.addEventListener('DOMContentLoaded', () => {
        const zoneSelect = document.getElementById('zone');
        const universSelect = document.getElementById('univers_id');
        const batchEntryContainer = document.getElementById('batch-entry-container');
        const batchTbody = document.getElementById('batch-tbody');
        const addRowBtn = document.getElementById('add-row-btn');

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
            } else {
                universSelect.disabled = true;
            }
            batchEntryContainer.style.display = 'none';
        }

        zoneSelect.addEventListener('change', updateUniversOptions);
        
        universSelect.addEventListener('change', () => {
            if (universSelect.value) {
                batchEntryContainer.style.display = 'block';
                if (batchTbody.rows.length === 0) addNewRow();
            } else {
                batchEntryContainer.style.display = 'none';
            }
        });

        function addNewRow() {
            const newRow = batchTbody.insertRow();
            newRow.innerHTML = `
                <td><input type="text" name="codes_geo[]" class="form-control" placeholder="Code Géo" required></td>
                <td><input type="text" name="libelles[]" class="form-control" placeholder="Libellé" required></td>
                <td class="item-actions"><button type="button" class="btn-delete-row">❌</button></td>
            `;
        }

        addRowBtn.addEventListener('click', addNewRow);
        
        batchTbody.addEventListener('click', (event) => {
            if (event.target.classList.contains('btn-delete-row')) {
                event.target.closest('tr').remove();
            }
        });
    });
</script>
<?php $body_scripts = ob_get_clean(); ?>

<div class="container">
    <section id="batch-creation-form">
        <h2>Ajout par Lot de Codes Géo</h2>
        <p>Choisissez une zone et un univers, puis ajoutez autant de codes géo que nécessaire.</p>
        <form action="index.php?action=handleBatchCreate" method="POST">
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
                    <tbody id="batch-tbody"></tbody>
                </table>
                <div class="batch-actions">
                    <button type="button" id="add-row-btn">Ajouter une ligne</button>
                    <button type="submit">Enregistrer le lot</button>
                </div>
            </div>
        </form>
    </section>
</div>
