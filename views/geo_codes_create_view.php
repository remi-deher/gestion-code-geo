<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ajouter un Code Géo</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <?php include 'partials/navbar.php'; ?>
    <div class="container">
        <section id="creation-form">
            <h2>Ajouter un nouvel emplacement</h2>
            <form action="index.php?action=add" method="POST">
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
                 <div class="form-group">
                    <label for="code_geo">3. Code Géo</label>
                    <input type="text" id="code_geo" name="code_geo" placeholder="Ex: ZV-A01-R2-N3" required>
                </div>
                <div class="form-group form-group-full">
                    <label for="libelle">4. Libellé</label>
                    <input type="text" id="libelle" name="libelle" placeholder="Ex: Rayon Pâtes, 2ème étagère" required>
                </div>
                <div class="form-group form-group-full">
                    <label for="commentaire">Commentaire (optionnel)</label>
                    <textarea id="commentaire" name="commentaire" placeholder="Informations additionnelles..."></textarea>
                </div>
                 <div class="form-group">
                    <label>Aperçu du QR Code</label>
                    <div id="qrcode-preview">Saisir un code géo...</div>
                </div>
                <button type="submit" class="form-group-full">Ajouter le code géo</button>
            </form>
        </section>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <script>
        // On passe la liste des univers du PHP au JavaScript
        const allUnivers = <?= json_encode($universList ?? []) ?>;

        document.addEventListener('DOMContentLoaded', () => {
            const codeGeoInput = document.getElementById('code_geo');
            const qrCodePreview = document.getElementById('qrcode-preview');
            const zoneSelect = document.getElementById('zone');
            const universSelect = document.getElementById('univers_id');

            // --- Logique du QR Code ---
            if (codeGeoInput && qrCodePreview) {
                codeGeoInput.addEventListener('input', () => {
                    qrCodePreview.innerHTML = '';
                    const text = codeGeoInput.value.trim();
                    if (text) {
                        new QRCode(qrCodePreview, { text: text, width: 128, height: 128 });
                    } else {
                        qrCodePreview.textContent = 'Saisir un code géo...';
                    }
                });
            }

            // --- Logique du formulaire dynamique ---
            if (zoneSelect && universSelect) {
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
                        universSelect.innerHTML = '<option value="">-- En attente d\'une zone --</option>';
                    }
                }
                zoneSelect.addEventListener('change', updateUniversOptions);
            }
        });
    </script>
</body>
</html>
