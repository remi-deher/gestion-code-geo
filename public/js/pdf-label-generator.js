document.addEventListener('DOMContentLoaded', () => {
    // Vérifie que les bibliothèques sont chargées
    if (typeof jspdf === 'undefined' || typeof QRCode === 'undefined') {
        console.error('Erreur: jsPDF ou QRCode n\'est pas chargé.');
        alert('Erreur critique : les bibliothèques nécessaires n\'ont pas pu être chargées.');
        return;
    }
    const { jsPDF } = jspdf; // Extrait la classe jsPDF

    // --- Éléments du DOM ---
    const form = document.getElementById('print-options-form');
    const generateBtn = document.getElementById('generate-pdf-btn');
    const previewIframe = document.getElementById('pdf-preview-iframe');
    const loadingIndicator = document.getElementById('loading-indicator');
    const layoutPresetSelect = form.querySelector('#layout_preset');
    const customOptionsContainer = form.querySelector('#custom-layout-options');
    const printFieldsCheckboxes = form.querySelectorAll('.print-field'); // Pour l'aperçu dynamique

    // --- Définition des PRESETS (dimensions en mm) ---
    const presets = {
        'classic_14': { name: 'Classique (14/page A4 Portrait)', templateStyle: 'qr-left', labelWidth: 0, labelHeight: 38.1, columns: 2, gap: 4, margins: 10, orientation: 'portrait', pageSize: 'A4' },
        'vertical_10': { name: 'Verticale (10/page A4 Portrait)', templateStyle: 'qr-top', labelWidth: 0, labelHeight: 50.8, columns: 2, gap: 5, margins: 10, orientation: 'portrait', pageSize: 'A4' },
        'compact_30': { name: 'Compacte (30/page A4 Paysage)', templateStyle: 'compact', labelWidth: 0, labelHeight: 25.4, columns: 3, gap: 4, margins: 10, orientation: 'landscape', pageSize: 'A4' },
        'text_21': { name: 'Petite Texte (21/page A4 Portrait)', templateStyle: 'text-only', labelWidth: 0, labelHeight: 29.7, columns: 3, gap: 2, margins: 10, orientation: 'portrait', pageSize: 'A4' },
        'tiny_40': { name: 'Très Petite (40/page A4 Portrait)', templateStyle: 'ultra-compact', labelWidth: 0, labelHeight: 21.2, columns: 4, gap: 2, margins: 10, orientation: 'portrait', pageSize: 'A4' },
        'custom': { name: 'Personnalisé...' }
    };

    // --- Initialisation et Écouteurs ---
    if (generateBtn) {
        generateBtn.addEventListener('click', generatePdf);
    } else {
        console.error("Bouton de génération PDF non trouvé.");
        return;
    }

    if (layoutPresetSelect) {
        layoutPresetSelect.addEventListener('change', handlePresetChange);
        handlePresetChange(); // Appliquer le preset initial
    }

    // Écouteurs pour la mise à jour dynamique de l'aperçu si nécessaire (peut être ajouté)
    // printFieldsCheckboxes.forEach(cb => cb.addEventListener('change', updateSimplePreview));
    // form.addEventListener('change', updateSimplePreview); // Pour style, etc.

    // --- Fonctions ---

    function handlePresetChange() {
        const selectedKey = layoutPresetSelect.value;
        const isCustom = selectedKey === 'custom';
        customOptionsContainer.style.display = isCustom ? 'block' : 'none';

        if (!isCustom && presets[selectedKey]) {
            const preset = presets[selectedKey];
            // Appliquer les valeurs du preset aux champs cachés/visibles
            form.querySelector('#page_size').value = preset.pageSize;
            form.querySelector('#orientation').value = preset.orientation;
            form.querySelector('#margins').value = preset.margins;
            form.querySelector('#columns').value = preset.columns;
            form.querySelector('#gap').value = preset.gap;
            form.querySelector('#label_width').value = preset.labelWidth;
            form.querySelector('#label_height').value = preset.labelHeight;
            form.querySelector('#template_style').value = preset.templateStyle;
        }
        // updateSimplePreview(); // Mettre à jour l'aperçu simple si implémenté
    }

    function readOptions() {
        const selectedPresetKey = layoutPresetSelect.value;
        const isCustom = selectedPresetKey === 'custom';
        const options = {
            presetKey: selectedPresetKey,
            universIds: Array.from(form.querySelectorAll('input[name="univers_ids[]"]:checked')).map(cb => cb.value),
            fields: Array.from(form.querySelectorAll('input[name="fields[]"]:checked')).map(cb => cb.value),
            copies: parseInt(form.querySelector('#copies').value, 10) || 1,
            title: form.querySelector('#print_title').value.trim(),
            separateUnivers: form.querySelector('#separate_univers').checked,
            addCutLines: form.querySelector('#add_cut_lines').checked,

            // Layout
            pageSize: form.querySelector('#page_size').value,
            orientation: form.querySelector('#orientation').value,
            margins: parseFloat(form.querySelector('#margins').value) || 10,
            columns: parseInt(form.querySelector('#columns').value, 10) || 1,
            gap: parseFloat(form.querySelector('#gap').value) || 0,
            labelWidth: parseFloat(form.querySelector('#label_width').value) || 0, // 0 = auto
            labelHeight: parseFloat(form.querySelector('#label_height').value) || 10, // Min 10mm
            templateStyle: form.querySelector('#template_style').value || 'qr-left',
        };

        // Si ce n'est pas custom, on surcharge avec les valeurs du preset
        if (!isCustom && presets[selectedPresetKey]) {
            const preset = presets[selectedPresetKey];
            options.pageSize = preset.pageSize;
            options.orientation = preset.orientation;
            options.margins = preset.margins;
            options.columns = preset.columns;
            options.gap = preset.gap;
            options.labelWidth = preset.labelWidth;
            options.labelHeight = preset.labelHeight;
            options.templateStyle = preset.templateStyle;
        }

        // --- VALIDATION & CALCUL LARGEUR AUTO ---
        options.margins = Math.max(0, options.margins);
        options.columns = Math.max(1, options.columns);
        options.gap = Math.max(0, options.gap);
        options.labelHeight = Math.max(10, options.labelHeight); // Hauteur minimale

        const pageDimensions = getPageDimensions(options.pageSize, options.orientation);
        const availableWidth = pageDimensions.width - (2 * options.margins) - ((options.columns - 1) * options.gap);
        const availableHeight = pageDimensions.height - (2 * options.margins);

        if (availableWidth <= 0 || availableHeight <= 0) {
            throw new Error("Erreur de mise en page: Marges trop grandes ou colonnes trop nombreuses.");
        }

        if (options.labelWidth <= 0) { // Calcul auto
            options.labelWidth = availableWidth / options.columns;
        } else if (options.columns * options.labelWidth + (options.columns - 1) * options.gap > availableWidth + 0.1) { // +0.1 pour marge erreur float
             console.warn("Largeur totale des colonnes et espaces dépasse la largeur disponible. Ajustement...");
             // On pourrait ajuster ici, mais pour l'instant on prévient juste
        }

        const maxRows = Math.floor((availableHeight + options.gap) / (options.labelHeight + options.gap));
         if (maxRows < 1) {
             throw new Error("Erreur de mise en page: Hauteur d'étiquette trop grande pour la page.");
         }
        options.maxRows = maxRows;
        options.pageWidth = pageDimensions.width;
        options.pageHeight = pageDimensions.height;

        // Validation simple
        if (options.labelWidth <= 5 || options.labelHeight <= 5) { // Dimensions minimales
            throw new Error("Dimensions d'étiquette (largeur ou hauteur) trop petites.");
        }

        return options;
    }

    function getPageDimensions(pageSize, orientation) {
        const sizes = { 'A4': [210, 297], 'A5': [148, 210], 'letter': [215.9, 279.4] };
        let dims = sizes[pageSize] || sizes['A4'];
        return orientation === 'landscape' ? { width: dims[1], height: dims[0] } : { width: dims[0], height: dims[1] };
    }

    async function fetchGeoCodes(universIds) {
        if (!universIds || universIds.length === 0) return [];
        const params = new URLSearchParams();
        universIds.forEach(id => params.append('univers_ids[]', id));
        const url = `index.php?action=getCodesForPrint&${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
        return await response.json();
    }

    async function generateQrCodeImages(codes, options) {
        const qrPromises = [];
        const includeQr = options.fields.includes('qrcode');
        const itemsToGenerate = [];

        codes.forEach(code => {
            for (let i = 0; i < options.copies; i++) {
                itemsToGenerate.push(code); // Ajoute une copie de la référence au code
            }
        });

        console.log(`Génération de ${includeQr ? 'QR codes' : 'données'} pour ${itemsToGenerate.length} étiquettes...`);

        // Utilise qrcodejs2
        itemsToGenerate.forEach(code => {
            if (includeQr && code.code_geo) {
                 qrPromises.push(new Promise((resolve) => {
                    const tempDiv = document.createElement('div');
                    try {
                        new QRCode(tempDiv, {
                            text: code.code_geo,
                            width: 128, // Taille temporaire pour génération
                            height: 128,
                            correctLevel: QRCode.CorrectLevel.H
                        });
                        // Récupérer la data URL
                        setTimeout(() => { // Attendre le rendu potentiel du canvas
                             const img = tempDiv.querySelector('img'); // qrcodejs2 génère une img
                             if (img) {
                                resolve({ data: code, qrDataUrl: img.src });
                             } else {
                                const canvas = tempDiv.querySelector('canvas'); // Fallback si c'est un canvas
                                if (canvas) {
                                    resolve({ data: code, qrDataUrl: canvas.toDataURL('image/png') });
                                } else {
                                     console.warn(`Impossible de générer l'image QR pour ${code.code_geo}`);
                                    resolve({ data: code, qrDataUrl: null });
                                }
                             }
                        }, 50);
                    } catch (e) {
                         console.error(`Erreur QRCode pour ${code.code_geo}:`, e);
                        resolve({ data: code, qrDataUrl: null });
                    }
                 }));
            } else {
                 qrPromises.push(Promise.resolve({ data: code, qrDataUrl: null }));
            }
        });

        return Promise.all(qrPromises);
    }

    /**
     * Dessine UNE seule étiquette dans le PDF.
     * @param {jsPDF} doc - L'instance jsPDF.
     * @param {object} item - L'objet { data: codeInfo, qrDataUrl: url }.
     * @param {number} x - Position X du coin supérieur gauche (en mm).
     * @param {number} y - Position Y du coin supérieur gauche (en mm).
     * @param {object} options - Les options de mise en page.
     */
    function drawLabel(doc, item, x, y, options) {
        const code = item.data;
        const qrDataUrl = item.qrDataUrl;
        const { labelWidth: w, labelHeight: h, fields, templateStyle } = options;

        // --- Styles de texte ---
        const codeFontSize = Math.min(14, h * 0.25); // Ajusté
        const libelleFontSize = Math.min(9, h * 0.18); // Ajusté
        const smallFontSize = Math.min(7, h * 0.14); // Ajusté
        const padding = Math.min(2, w * 0.05, h * 0.05); // Paddings internes

        // --- Dessin de la bordure (trait de coupe) ---
        if (options.addCutLines) {
            doc.setDrawColor(200, 200, 200); // Gris clair
            doc.setLineWidth(0.1);
            doc.rect(x, y, w, h);
        }

        // --- Positionnement QR Code & Texte ---
        let qrSize = 0;
        let qrX = x + padding;
        let qrY = y + padding;
        let textX = x + padding;
        let textY = y + padding;
        let textW = w - 2 * padding;
        let textAlign = 'left';

        // Calcule la taille et position du QR basé sur le style
        if (fields.includes('qrcode') && qrDataUrl) {
            switch (templateStyle) {
                case 'qr-top':
                case 'ultra-compact':
                    qrSize = Math.min(w - 2 * padding, h * 0.6); // Prend max 60% hauteur
                    qrX = x + (w - qrSize) / 2; // Centré H
                    textY = qrY + qrSize + padding; // Texte en dessous
                    textW = w - 2 * padding;
                    textAlign = 'center';
                    break;
                case 'compact':
                    qrSize = Math.min(h * 0.8, w * 0.3); // QR petit à gauche
                    textX = qrX + qrSize + padding;
                    textW = w - qrSize - 3 * padding;
                    break;
                case 'qr-left': // Style par défaut
                default:
                    qrSize = Math.min(h * 0.9, w * 0.4); // QR prend ~40% largeur
                    textX = qrX + qrSize + padding;
                    textW = w - qrSize - 3 * padding;
                    break;
            }
            doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
        } else if (templateStyle === 'text-only') {
            // Pas de QR code, le texte prend toute la largeur
            textW = w - 2 * padding;
        }

        // --- Dessin des textes ---
        let currentY = textY;

        if (fields.includes('code_geo') && code.code_geo) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(codeFontSize);
            // doc.text(code.code_geo, textX, currentY + codeFontSize * 0.35, { align: textAlign, maxWidth: textW }); // 0.35 approx pour baseline
            doc.getTextWidth(code.code_geo) > textW ? doc.setFontSize(codeFontSize*0.8) : doc.setFontSize(codeFontSize); // Reduit la taille si texte trop long
            doc.text(code.code_geo, templateStyle == 'qr-top' ? x+w/2 : textX, currentY + codeFontSize * 0.35, { align: textAlign, maxWidth: textW }); // Positionne le texte au milieu si qr-top
            currentY += codeFontSize * 0.7; // Avance Y
        }

        if (fields.includes('libelle') && code.libelle) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(libelleFontSize);
            const libelleLines = doc.splitTextToSize(code.libelle, textW);
            doc.getTextWidth(code.libelle) > textW ? doc.setFontSize(libelleFontSize*0.8) : doc.setFontSize(libelleFontSize); // Reduit la taille si texte trop long
            doc.text(libelleLines, templateStyle == 'qr-top' ? x+w/2 : textX, currentY + libelleFontSize * 0.35, { align: textAlign });
            currentY += libelleLines.length * libelleFontSize * 0.5; // Ajuster selon nb lignes
        }

        if (fields.includes('univers') && code.univers) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(smallFontSize);
            doc.setTextColor(100); // Gris
            doc.text(`Univers: ${code.univers}`, templateStyle == 'qr-top' ? x+w/2 : textX, currentY + smallFontSize * 0.35, { align: textAlign, maxWidth: textW });
            currentY += smallFontSize * 0.5;
            doc.setTextColor(0); // Noir
        }

        if (fields.includes('commentaire') && code.commentaire) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(smallFontSize);
            doc.setTextColor(100);
            const commentLines = doc.splitTextToSize(`Note: ${code.commentaire}`, textW);
            doc.text(commentLines, templateStyle == 'qr-top' ? x+w/2 : textX, currentY + smallFontSize * 0.35, { align: textAlign });
            // Pas besoin d'incrémenter currentY pour le dernier élément
            doc.setTextColor(0);
        }
    }


    /**
     * Fonction principale pour générer le PDF et afficher l'aperçu.
     */
    async function generatePdf() {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (previewIframe) previewIframe.src = 'about:blank';
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Génération...';

        try {
            const options = readOptions();
            console.log("Options lues pour PDF:", options);

            if (options.universIds.length === 0) {
                 throw new Error("Veuillez sélectionner au moins un univers.");
            }

            const rawCodes = await fetchGeoCodes(options.universIds);
            console.log(`${rawCodes.length} codes bruts récupérés.`);
            if (rawCodes.length === 0) {
                throw new Error("Aucun code géo à imprimer pour la sélection.");
            }

            // Tri pour l'option separateUnivers
             if (options.separateUnivers) {
                 rawCodes.sort((a, b) => {
                     const universCompare = (a.univers || '').localeCompare(b.univers || '');
                     if (universCompare !== 0) return universCompare;
                     return (a.code_geo || '').localeCompare(b.code_geo || '');
                 });
             } else {
                  rawCodes.sort((a, b) => (a.code_geo || '').localeCompare(b.code_geo || ''));
             }

            const itemsToDraw = await generateQrCodeImages(rawCodes, options);
            console.log(`${itemsToDraw.length} items (avec copies) prêts à dessiner.`);

            // --- CRÉATION DU PDF ---
            const doc = new jsPDF({
                orientation: options.orientation,
                unit: 'mm',
                format: options.pageSize.toLowerCase()
            });

            // Ajouter la police Helvetica (standard PDF, supporte accents basiques)
             // jsPDF inclut Helvetica par défaut. Pas besoin de l'ajouter explicitement ici
             // pour les caractères simples. Si des caractères plus complexes sont nécessaires,
             // il faudra intégrer une police TTF supportant l'Unicode.
            doc.setFont('helvetica');


            let x = options.margins;
            let y = options.margins;
            let col = 0;
            let pageNum = 1;
            let currentUnivers = null;

            itemsToDraw.forEach((item, index) => {
                const itemUnivers = item.data.univers || 'Sans Univers';

                // Saut de page si nouvelle page par univers
                if (options.separateUnivers && currentUnivers !== null && itemUnivers !== currentUnivers) {
                    doc.addPage(options.pageSize.toLowerCase(), options.orientation);
                    pageNum++;
                    x = options.margins;
                    y = options.margins;
                    col = 0;
                    currentUnivers = itemUnivers;
                } else if (currentUnivers === null) {
                    currentUnivers = itemUnivers;
                }

                // Dessine l'étiquette
                drawLabel(doc, item, x, y, options);

                // Passe à la colonne suivante
                col++;
                if (col >= options.columns) {
                    // Passe à la ligne suivante
                    col = 0;
                    x = options.margins;
                    y += options.labelHeight + options.gap;

                    // Vérifie si on dépasse la page
                    if (y + options.labelHeight > (options.pageHeight - options.margins)) {
                        doc.addPage(options.pageSize.toLowerCase(), options.orientation);
                        pageNum++;
                        x = options.margins;
                        y = options.margins;
                        currentUnivers = itemUnivers; // Réinitialise pour la nouvelle page si separateUnivers est actif
                    }
                } else {
                    // Avance X pour la prochaine colonne
                    x += options.labelWidth + options.gap;
                }
            });

            // Ajout Titre et Numéro de page (optionnel)
            // Note: jsPDF n'a pas de header/footer automatique comme FPDF.
            // On le simule en ajoutant le contenu sur chaque page APRES avoir tout dessiné.
             if (options.title) {
                for (let i = 1; i <= pageNum; i++) {
                    doc.setPage(i);
                    doc.setFontSize(10);
                    doc.setTextColor(150);
                    doc.text(options.title, options.pageWidth / 2, options.margins / 2, { align: 'center' });
                    doc.text(`Page ${i}/${pageNum}`, options.pageWidth - options.margins, options.pageHeight - options.margins / 2, { align: 'right'});
                }
             }

            // --- Affichage dans l'iframe ---
            console.log("Génération du Data URI du PDF...");
            const pdfDataUri = doc.output('datauristring');
            if (previewIframe) {
                 console.log("Affichage dans l'iframe.");
                 previewIframe.src = pdfDataUri;
            } else {
                 console.error("Iframe de prévisualisation non trouvée.");
            }

        } catch (error) {
            console.error('Erreur lors de la génération du PDF:', error);
            alert(`Erreur: ${error.message}`);
            if (previewIframe) previewIframe.src = 'about:blank';
        } finally {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="bi bi-file-earmark-pdf-fill"></i> Générer l\'aperçu PDF';
        }
    }

}); // Fin DOMContentLoaded
