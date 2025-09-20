document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.print-options-form');
    if (!form) return;

    // --- Éléments du formulaire ---
    const fieldCheckboxes = form.querySelectorAll('input[name="fields[]"]');
    const layoutSelect = form.querySelector('#layout_format');
    
    // --- Éléments de l'aperçu ---
    const previewContainer = form.querySelector('#label-preview-container');
    const previewQrCode = form.querySelector('#preview-qrcode');
    const previewDetails = form.querySelector('#preview-details');
    const previewElements = {
        qrcode: previewQrCode,
        code_geo: form.querySelector('#preview-code-geo'),
        libelle: form.querySelector('#preview-libelle'),
        univers: form.querySelector('#preview-univers'),
        commentaire: form.querySelector('#preview-commentaire')
    };

    // --- Fonction principale de mise à jour ---
    function updatePreview() {
        if (!previewContainer) return;

        // 1. Mettre à jour la visibilité des champs
        fieldCheckboxes.forEach(checkbox => {
            const fieldName = checkbox.value;
            const element = previewElements[fieldName];
            if (element) {
                const parent = element.closest('.print-qr-code, .print-details > div');
                if(parent) {
                    parent.style.display = checkbox.checked ? '' : 'none';
                } else {
                    element.style.display = checkbox.checked ? '' : 'none';
                }
            }
        });

        // 2. Mettre à jour le format/layout et le QR Code
        const selectedLayout = layoutSelect.value;
        let qrSize = 80;
        
        // Appliquer les styles directement pour un aperçu fidèle
        previewContainer.style.gridTemplateColumns = '80px 1fr'; // Medium
        if (selectedLayout === 'large_2x2') {
            qrSize = 100;
            previewContainer.style.gridTemplateColumns = '100px 1fr';
        } else if (selectedLayout === 'small_3x7') {
            qrSize = 50;
            previewContainer.style.gridTemplateColumns = '50px 1fr';
        }

        const isQrCodeVisible = form.querySelector('#field_qrcode').checked;
        if (isQrCodeVisible) {
            previewQrCode.innerHTML = '';
            new QRCode(previewQrCode, {
                text: 'CODE-EXEMPLE',
                width: qrSize,
                height: qrSize,
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }

    // --- Ajout des écouteurs d'événements ---
    form.addEventListener('change', updatePreview);

    // --- Premier appel pour initialiser l'aperçu ---
    updatePreview();
});
