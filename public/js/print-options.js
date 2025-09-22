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
        qrcode: form.querySelector('#preview-qrcode'),
        code_geo: form.querySelector('#preview-code-geo'),
        libelle: form.querySelector('#preview-libelle'),
        univers: form.querySelector('#preview-univers'),
        commentaire: form.querySelector('#preview-commentaire')
    };

    // --- Fonction principale de mise à jour ---
    function updatePreview() {
        if (!previewContainer) return;

        // 1. Mettre à jour la visibilité des champs de texte
        fieldCheckboxes.forEach(checkbox => {
            const fieldName = checkbox.value;
            const element = previewElements[fieldName];
            if (element) {
                // On gère le QR code et les autres champs différemment
                if (fieldName === 'qrcode') {
                    element.style.display = checkbox.checked ? 'flex' : 'none';
                } else {
                     element.style.display = checkbox.checked ? 'block' : 'none';
                }
            }
        });

        // 2. Mettre à jour le format/layout de l'étiquette
        const selectedLayout = layoutSelect.value;
        previewContainer.className = `print-item template-${selectedLayout}`;

        // 3. Redessiner le QR Code avec la bonne taille
        const isQrCodeVisible = form.querySelector('#field_qrcode').checked;
        if (isQrCodeVisible) {
            let qrSize = 80; // Taille par défaut pour 'qr-left'
            if (selectedLayout === 'qr-top') {
                qrSize = 100;
            } else if (selectedLayout === 'compact') {
                qrSize = 55;
            }
            
            previewQrCode.innerHTML = ''; // Vider l'ancien QR code
            new QRCode(previewQrCode, {
                text: 'CODE-EXEMPLE',
                width: qrSize,
                height: qrSize,
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
             previewQrCode.innerHTML = '';
        }
    }

    // --- Ajout des écouteurs d'événements ---
    form.addEventListener('change', updatePreview);

    // --- Premier appel pour initialiser l'aperçu au chargement de la page ---
    updatePreview();
});
