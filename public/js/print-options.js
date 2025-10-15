document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.print-options-form');
    if (!form) return;

    // --- Éléments du formulaire ---
    const fieldCheckboxes = form.querySelectorAll('input[name="fields[]"]');
    const layoutPresetSelect = form.querySelector('#layout_preset'); // Le nouveau select principal
    
    // Champs de configuration (maintenant cachés et contrôlés par JS)
    const layoutTemplateSelect = form.querySelector('#layout_template');
    const pageSizeSelect = form.querySelector('#page_size');
    const orientationSelect = form.querySelector('#orientation');
    const marginsInput = form.querySelector('#margins');
    const columnsInput = form.querySelector('#columns');
    const gapInput = form.querySelector('#gap');
    
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

    // --- DÉFINITION DES PRÉRÉGLAGES ---
    const presets = {
        'auto': { name: 'Automatique (recommandé)', template: 'qr-left', columns: 2, gap: 4, margins: 10, orientation: 'portrait', page_size: 'A4' },
        'a4-portrait-10': { name: '10 étiquettes / page (Verticales, Portrait)', template: 'qr-top', columns: 2, gap: 5, margins: 10, orientation: 'portrait', page_size: 'A4' },
        'a4-portrait-14': { name: '14 étiquettes / page (Classiques, Portrait)', template: 'qr-left', columns: 2, gap: 4, margins: 10, orientation: 'portrait', page_size: 'A4' },
        'a4-portrait-21': { name: '21 étiquettes / page (Petites, Portrait)', template: 'compact-text', columns: 3, gap: 2, margins: 10, orientation: 'portrait', page_size: 'A4' },
        'a4-portrait-40': { name: '40 étiquettes / page (Très Petites, Portrait)', template: 'ultra-compact', columns: 4, gap: 2, margins: 10, orientation: 'portrait', page_size: 'A4' },
        'a4-landscape-30': { name: '30 étiquettes / page (Compactes, Paysage)', template: 'compact', columns: 3, gap: 4, margins: 10, orientation: 'landscape', page_size: 'A4' }
    };

    /**
     * Applique un préréglage sélectionné aux champs du formulaire.
     */
    function applyPreset() {
        const selectedPresetKey = layoutPresetSelect.value;
        const preset = presets[selectedPresetKey];
        if (!preset) return;

        // Si le préréglage définit un template, on le sélectionne. Sinon, on garde le template manuel.
        if (preset.template) {
            layoutTemplateSelect.value = preset.template;
        }
        
        // On met à jour tous les champs de configuration
        pageSizeSelect.value = preset.page_size;
        orientationSelect.value = preset.orientation;
        marginsInput.value = preset.margins;
        columnsInput.value = preset.columns;
        gapInput.value = preset.gap;

        // On déclenche manuellement un événement 'change' pour que l'aperçu se mette à jour
        form.dispatchEvent(new Event('change'));
    }

    /**
     * Fonction principale de mise à jour de l'aperçu.
     */
    function updatePreview() {
        if (!previewContainer) return;

        // 1. Visibilité des champs de texte
        fieldCheckboxes.forEach(checkbox => {
            const fieldName = checkbox.value;
            const element = previewElements[fieldName];
            if (element) {
                element.style.display = checkbox.checked ? (fieldName === 'qrcode' ? 'flex' : 'block') : 'none';
            }
        });

        // 2. Format/layout de l'étiquette
        const selectedLayout = layoutTemplateSelect.value;
        previewContainer.className = `print-item template-${selectedLayout}`;

        // 3. Redessiner le QR Code
        const isQrCodeVisible = form.querySelector('#field_qrcode').checked;
        previewQrCode.style.display = 'none';
        previewQrCode.innerHTML = '';
        
        if (isQrCodeVisible) {
            let qrSize = 0;
            if (selectedLayout === 'qr-left') qrSize = 80;
            else if (selectedLayout === 'qr-top') qrSize = 100;
            else if (selectedLayout === 'compact') qrSize = 55;
            else if (selectedLayout === 'ultra-compact') qrSize = 40;
            
            if (qrSize > 0) {
                previewQrCode.style.display = 'flex';
                new QRCode(previewQrCode, {
                    text: 'CODE-EXEMPLE',
                    width: qrSize, height: qrSize,
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
        }
    }

    // --- Ajout des écouteurs d'événements ---
    form.addEventListener('change', updatePreview);
    layoutPresetSelect.addEventListener('change', applyPreset);

    // --- Premier appel ---
    applyPreset();
});
