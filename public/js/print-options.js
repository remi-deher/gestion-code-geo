document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.print-options-form');
    if (!form) return;

    // --- Éléments du formulaire ---
    const fieldCheckboxes = form.querySelectorAll('input[name="fields[]"]');
    const layoutSelect = form.querySelector('#layout_format');
    
    // --- Éléments de l'aperçu ---
    const previewContainer = form.querySelector('#label-preview-container');
    const previewQrCode = form.querySelector('#preview-qrcode');
    const previewElements = {
        qrcode: previewQrCode,
        code_geo: form.querySelector('#preview-code-geo'),
        libelle: form.querySelector('#preview-libelle'),
        univers: form.querySelector('#preview-univers'),
        commentaire: form.querySelector('#preview-commentaire')
    };

    let qrCodeInstance = null; // Pour garder une référence au QR Code

    // --- Fonction principale de mise à jour ---
    function updatePreview() {
        if (!previewContainer) return;

        // 1. Mettre à jour la visibilité des champs
        fieldCheckboxes.forEach(checkbox => {
            const fieldName = checkbox.value;
            const element = previewElements[fieldName];
            if (element) {
                element.style.display = checkbox.checked ? '' : 'none';
            }
        });

        // 2. Mettre à jour le QR Code
        const isQrCodeVisible = form.querySelector('#field_qrcode').checked;
        if (isQrCodeVisible) {
            previewQrCode.innerHTML = ''; // Vider l'ancien QR Code
            qrCodeInstance = new QRCode(previewQrCode, {
                text: 'CODE-EXEMPLE',
                width: 80,
                height: 80,
                correctLevel: QRCode.CorrectLevel.H
            });
        }

        // 3. Mettre à jour le format/layout de l'étiquette
        const selectedLayout = layoutSelect.value;
        // On simule l'effet du CSS en ajoutant la classe au body de l'aperçu
        // Pour cela, nous utilisons un conteneur parent.
        const previewBox = document.getElementById('preview-box');
        if(previewBox){
            previewBox.className = ''; // Réinitialiser les classes
            previewBox.classList.add(selectedLayout);
        }
    }

    // --- Ajout des écouteurs d'événements ---
    form.addEventListener('change', updatePreview);

    // --- Premier appel pour initialiser l'aperçu ---
    updatePreview();
});
