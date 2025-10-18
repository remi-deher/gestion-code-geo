document.addEventListener('DOMContentLoaded', () => {
    // Vérifie que les bibliothèques sont chargées
    if (typeof jspdf === 'undefined' || typeof QRCode === 'undefined') {
        console.error('Erreur: jsPDF ou QRCode (qrcodejs2) n\'est pas chargé.');
        alert('Erreur critique : les bibliothèques nécessaires n\'ont pas pu être chargées. Vérifiez les inclusions dans layout.php.');
        return;
    }
    const { jsPDF } = jspdf; // Extrait la classe jsPDF de l'objet global jspdf

    // --- Éléments du DOM ---
    const form = document.getElementById('print-options-form');
    const generateBtn = document.getElementById('generate-pdf-btn');
    const previewIframe = document.getElementById('pdf-preview-iframe');
    const loadingIndicator = document.getElementById('loading-indicator');
    const universCheckboxes = form.querySelectorAll('.univers-checkbox');
    const selectAllBtn = document.getElementById('select-all');
    const deselectAllBtn = document.getElementById('deselect-all');
    const layoutPresetSelect = form.querySelector('#layout_preset');
    const customOptionsContainer = form.querySelector('#custom-layout-options');
    const printFieldsCheckboxes = form.querySelectorAll('.print-field'); // Pour l'aperçu dynamique (si besoin)

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
    if (!form || !generateBtn || !previewIframe || !loadingIndicator || !layoutPresetSelect || !customOptionsContainer) {
        console.error("Un ou plusieurs éléments essentiels du formulaire sont manquants.");
        return;
    }

    generateBtn.addEventListener('click', generatePdf);
    layoutPresetSelect.addEventListener('change', handlePresetChange);

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => universCheckboxes.forEach(cb => cb.checked = true));
    }
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => universCheckboxes.forEach(cb => cb.checked = false));
    }

    handlePresetChange(); // Appliquer le preset initial au chargement

    // --- Fonctions ---

    function handlePresetChange() {
        const selectedKey = layoutPresetSelect.value;
        const isCustom = selectedKey === 'custom';
        customOptionsContainer.style.display = isCustom ? 'block' : 'none';

        if (!isCustom && presets[selectedKey]) {
            const preset = presets[selectedKey];
            // Appliquer les valeurs du preset aux champs
            form.querySelector('#page_size').value = preset.pageSize;
            form.querySelector('#orientation').value = preset.orientation;
            form.querySelector('#margins').value = preset.margins;
            form.querySelector('#columns').value = preset.columns;
            form.querySelector('#gap').value = preset.gap;
            form.querySelector('#label_width').value = preset.labelWidth;
            form.querySelector('#label_height').value = preset.labelHeight;
            form.querySelector('#template_style').value = preset.templateStyle;
        }
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
        options.labelHeight = Math.max(5, options.labelHeight); // Hauteur minimale réduite

        const pageDimensions = getPageDimensions(options.pageSize, options.orientation);
        options.pageWidth = pageDimensions.width;
        options.pageHeight = pageDimensions.height;

        const availableWidth = options.pageWidth - (2 * options.margins);
        const availableHeight = options.pageHeight - (2 * options.margins);

        if (availableWidth <= 0 || availableHeight <= 0) {
            throw new Error(`Erreur de mise en page: Marges (${options.margins}mm) trop grandes pour le format ${options.pageSize}.`);
        }

        // Calcul largeur auto SI labelWidth est 0
        if (options.labelWidth <= 0) {
            const totalGapWidth = (options.columns - 1) * options.gap;
            if (availableWidth - totalGapWidth <= 0) {
                 throw new Error("Erreur de mise en page: Espace insuffisant pour les colonnes et les espacements.");
            }
            options.labelWidth = (availableWidth - totalGapWidth) / options.columns;
        } else {
             // Vérification si la largeur manuelle + gaps dépasse la page
             const totalRequiredWidth = options.columns * options.labelWidth + (options.columns - 1) * options.gap;
             if (totalRequiredWidth > availableWidth + 0.1) { // Tolérance pour erreurs float
                 throw new Error(`Erreur: La largeur totale des étiquettes (${totalRequiredWidth.toFixed(1)}mm) dépasse la largeur disponible (${availableWidth.toFixed(1)}mm).`);
             }
        }

        // Calcul du nombre max de lignes
        const rowHeightWithGap = options.labelHeight + options.gap;
        options.maxRows = rowHeightWithGap > 0 ? Math.floor((availableHeight + options.gap) / rowHeightWithGap) : 0;

         if (options.maxRows < 1) {
             throw new Error(`Erreur de mise en page: Hauteur d'étiquette (${options.labelHeight}mm) trop grande pour la page (max ${availableHeight.toFixed(1)}mm disponible).`);
         }

        // Validation finale des dimensions calculées/fournies
        if (options.labelWidth <= 3 || options.labelHeight <= 3) { // Dimensions minimales absolues
            throw new Error("Dimensions d'étiquette (largeur ou hauteur) invalides ou trop petites.");
        }

        console.log("Options calculées:", options);
        return options;
    }

    function getPageDimensions(pageSize, orientation) {
        const sizes = { 'A4': [210, 297], 'A5': [148, 210], 'letter': [215.9, 279.4] };
        let dims = sizes[pageSize] || sizes['A4'];
        // jsPDF utilise [width, height]
        return orientation === 'landscape' ? { width: dims[1], height: dims[0] } : { width: dims[0], height: dims[1] };
    }

    async function fetchGeoCodes(universIds) {
        if (!universIds || universIds.length === 0) return [];
        const params = new URLSearchParams();
        universIds.forEach(id => params.append('univers_ids[]', id));
        const url = `index.php?action=getCodesForPrint&${params.toString()}`;
        console.log("Fetching codes from:", url);
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Server response:", errorText);
            throw new Error(`Erreur serveur (${response.status}) lors de la récupération des codes.`);
        }
        const data = await response.json();
        console.log(`Received ${data.length} codes from server.`);
        return data;
    }

    async function generateQrCodeImages(codes, options) {
        const qrPromises = [];
        const includeQr = options.fields.includes('qrcode');
        const itemsToGenerate = [];

        codes.forEach(code => {
            for (let i = 0; i < options.copies; i++) {
                itemsToGenerate.push(code);
            }
        });

        console.log(`Génération de ${includeQr ? 'QR codes' : 'données'} pour ${itemsToGenerate.length} étiquettes...`);

        // Utilise qrcodejs2
        itemsToGenerate.forEach((code, index) => {
            if (includeQr && code.code_geo) {
                 qrPromises.push(new Promise((resolve) => {
                    const tempDiv = document.createElement('div');
                    // Attribue un ID unique au cas où plusieurs s'exécutent en parallèle
                    tempDiv.id = `qr-temp-${index}-${Date.now()}`;
                    document.body.appendChild(tempDiv); // Doit être dans le DOM pour qrcodejs2 img
                    tempDiv.style.position = 'absolute';
                    tempDiv.style.left = '-9999px'; // Hors écran

                    try {
                        new QRCode(tempDiv.id, {
                            text: code.code_geo,
                            width: 128,
                            height: 128,
                            correctLevel: QRCode.CorrectLevel.H
                        });
                        // Récupérer la data URL de l'image générée
                        setTimeout(() => { // Attendre le rendu potentiel
                             const img = tempDiv.querySelector('img');
                             if (img && img.src) {
                                resolve({ data: code, qrDataUrl: img.src });
                             } else {
                                const canvas = tempDiv.querySelector('canvas'); // Fallback si c'est un canvas
                                if (canvas) {
                                    try {
                                        resolve({ data: code, qrDataUrl: canvas.toDataURL('image/png') });
                                    } catch (canvasError) {
                                         console.error(`Erreur toDataURL pour ${code.code_geo}:`, canvasError);
                                         resolve({ data: code, qrDataUrl: null });
                                    }
                                } else {
                                     console.warn(`Impossible de trouver l'image ou le canvas QR pour ${code.code_geo}`);
                                    resolve({ data: code, qrDataUrl: null });
                                }
                             }
                             document.body.removeChild(tempDiv); // Nettoyer le DOM
                        }, 100); // Délai un peu plus long pour être sûr
                    } catch (e) {
                         console.error(`Erreur lors de l'instanciation de QRCode pour ${code.code_geo}:`, e);
                        resolve({ data: code, qrDataUrl: null });
                        if (document.body.contains(tempDiv)) {
                           document.body.removeChild(tempDiv);
                        }
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

        // --- Styles de texte (ajustés dynamiquement) ---
        const baseFontSize = h * 0.2; // Taille de base relative à la hauteur
        const codeFontSize = Math.min(14, Math.max(6, baseFontSize * 1.1));
        const libelleFontSize = Math.min(10, Math.max(5, baseFontSize * 0.8));
        const smallFontSize = Math.min(8, Math.max(4, baseFontSize * 0.6));
        const padding = Math.min(2, w * 0.05, h * 0.05);

        // --- Dessin de la bordure (trait de coupe) ---
        if (options.addCutLines) {
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.1);
            doc.rect(x, y, w, h, 'S'); // 'S' pour Stroke
        }

        // --- Positionnement QR Code & Texte ---
        let qrSize = 0;
        let qrX = x + padding;
        let qrY = y + padding;
        let textX = x + padding;
        let textY = y + padding;
        let textW = w - 2 * padding;
        let textBlockHeight = h - 2 * padding;
        let textAlign = 'left';
        let isQrPresent = fields.includes('qrcode') && qrDataUrl;

        // Calcul taille/position QR basé sur style
        if (isQrPresent) {
            switch (templateStyle) {
                case 'qr-top':
                    qrSize = Math.min(w - 2 * padding, h * 0.55); // QR prend ~55% hauteur max
                    qrX = x + (w - qrSize) / 2; // Centré H
                    qrY = y + padding;
                    textY = qrY + qrSize + padding * 0.5; // Texte en dessous
                    textBlockHeight = h - qrSize - 2.5 * padding;
                    textAlign = 'center';
                    break;
                case 'compact':
                    qrSize = Math.min(h - 2 * padding, w * 0.35); // QR petit à gauche
                    qrY = y + (h - qrSize) / 2; // Centré V
                    textX = qrX + qrSize + padding;
                    textW = w - qrSize - 3 * padding;
                    break;
                 case 'ultra-compact':
                    qrSize = Math.min(h - 2*padding, w * 0.5); // QR un peu plus grand
                    qrX = x + padding;
                     qrY = y + (h - qrSize) / 2; // Centré V
                    textX = qrX + qrSize + padding;
                    textW = w - qrSize - 3 * padding;
                    break;
                case 'qr-left': // Style par défaut
                default:
                    qrSize = Math.min(h - 2 * padding, w * 0.4); // QR prend ~40% largeur
                    qrY = y + (h - qrSize) / 2; // Centré V
                    textX = qrX + qrSize + padding;
                    textW = w - qrSize - 3 * padding;
                    break;
            }
             try {
                // S'assure que les dimensions sont positives
                if (qrSize > 0) {
                    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
                } else {
                    console.warn("QR Size calculé à 0 ou moins pour", code.code_geo);
                }
             } catch (imgError) {
                 console.error(`Erreur jsPDF.addImage pour ${code.code_geo}:`, imgError);
                 // On continue sans QR code
                 isQrPresent = false; // Marque comme non présent pour la suite
                 // Réinitialise textX/textW si le QR n'a pas pu être dessiné
                 if (templateStyle === 'qr-left' || templateStyle === 'compact' || templateStyle === 'ultra-compact') {
                     textX = x + padding;
                     textW = w - 2 * padding;
                 }
            }
        }

        // Si pas de QR (soit option, soit erreur, soit style 'text-only'), le texte prend toute la place
        if (!isQrPresent || templateStyle === 'text-only') {
             textX = x + padding;
             textW = w - 2 * padding;
             textAlign = templateStyle === 'text-only' ? 'left' : textAlign; // Garde centré pour qr-top si QR échoue
        }

        // --- Dessin des textes ---
        let currentY = textY;
        const baselineShiftFactor = 0.35; // Facteur pour simuler la baseline

        // Fonction pour ajouter du texte avec gestion de la taille et de la position Y
        const addTextLine = (text, size, style, color = 0, options = {}) => {
            if (!text || text.trim() === '') return 0; // Ne rien faire si texte vide

            doc.setFont('helvetica', style);
            doc.setFontSize(size);
            doc.setTextColor(color);

            let effectiveSize = size;
            // Ajustement simple de la taille si trop large
            if (doc.getTextWidth(text) > textW) {
                effectiveSize = size * (textW / doc.getTextWidth(text)) * 0.95; // Réduit un peu plus
                effectiveSize = Math.max(effectiveSize, 4); // Taille minimale
                doc.setFontSize(effectiveSize);
            }

            const textHeight = effectiveSize * 0.352777 * 1.2; // Convert pt to mm and add line height factor
            const textYPos = currentY + effectiveSize * baselineShiftFactor;

            // Vérifie si le texte dépasse la hauteur disponible
            if (currentY + textHeight > y + textBlockHeight + padding) {
                console.warn(`Texte "${text.substring(0,20)}..." dépasse la hauteur pour ${code.code_geo}`);
                return 0; // Ne dessine pas si ça dépasse
            }

            // Calcule la position X pour l'alignement
            let currentX = textX;
            if (textAlign === 'center') {
                currentX = x + w / 2;
            } else if (textAlign === 'right') {
                currentX = x + w - padding;
            }

            doc.text(text, currentX, textYPos, {
                align: textAlign,
                maxWidth: textW,
                ...options // Pour passer d'autres options jsPDF si besoin
            });
            doc.setTextColor(0); // Reset color
            return textHeight; // Retourne la hauteur utilisée
        };


        // Dessiner les champs demandés
        if (fields.includes('code_geo') && code.code_geo && templateStyle !== 'text-only') {
             currentY += addTextLine(code.code_geo, codeFontSize, 'bold');
        }
        if (fields.includes('libelle') && code.libelle && templateStyle !== 'ultra-compact') {
            currentY += addTextLine(code.libelle, libelleFontSize, 'normal');
        }
        // Pour les styles 'text-only', on met le code géo après le libellé
        if (fields.includes('code_geo') && code.code_geo && templateStyle === 'text-only') {
            currentY += addTextLine(code.code_geo, codeFontSize * 0.8, 'bold'); // Un peu plus petit
        }
        if (fields.includes('univers') && code.univers && templateStyle !== 'ultra-compact') {
             currentY += addTextLine(`Univers: ${code.univers}`, smallFontSize, 'italic', 100);
        }
        if (fields.includes('commentaire') && code.commentaire && templateStyle !== 'ultra-compact') {
             addTextLine(`Note: ${code.commentaire}`, smallFontSize, 'italic', 100);
        }
    }


    /**
     * Fonction principale pour générer le PDF et afficher l'aperçu.
     */
    async function generatePdf() {
        loadingIndicator.style.display = 'block';
        previewIframe.src = 'about:blank';
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Génération...';

        try {
            const options = readOptions(); // Lit et valide les options

            if (options.universIds.length === 0) {
                 throw new Error("Veuillez sélectionner au moins un univers.");
            }

            const rawCodes = await fetchGeoCodes(options.universIds);
            if (rawCodes.length === 0) {
                throw new Error("Aucun code géo à imprimer pour la sélection.");
            }

            // Tri pour l'option separateUnivers ou tri simple par code_geo
             if (options.separateUnivers) {
                 rawCodes.sort((a, b) => {
                     const universCompare = (a.univers || 'ZZZ').localeCompare(b.univers || 'ZZZ'); // Met "Sans univers" à la fin
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
            doc.setFont('helvetica', 'normal'); // Police par défaut

            let x = options.margins;
            let y = options.margins;
            let col = 0;
            let pageNum = 1;
            let currentUnivers = null;
            let isFirstPage = true;

            itemsToDraw.forEach((item) => {
                const itemUnivers = item.data.univers || 'Sans Univers';

                // Saut de page si nouvelle page par univers (et pas la première étiquette)
                if (options.separateUnivers && currentUnivers !== null && itemUnivers !== currentUnivers && !isFirstPage) {
                    doc.addPage(options.pageSize.toLowerCase(), options.orientation);
                    pageNum++;
                    x = options.margins;
                    y = options.margins;
                    col = 0;
                }
                currentUnivers = itemUnivers;
                isFirstPage = false; // Marque que la première étiquette a été placée

                // Dessine l'étiquette
                drawLabel(doc, item, x, y, options);

                // Passe à la colonne/ligne suivante
                col++;
                if (col >= options.columns) { // Fin de ligne
                    col = 0;
                    x = options.margins;
                    y += options.labelHeight + options.gap;

                    // Vérifie si on dépasse la page (en hauteur)
                    // Ajoute une petite marge pour éviter les erreurs d'arrondi
                    if (y + options.labelHeight > (options.pageHeight - options.margins + 0.1)) {
                        doc.addPage(options.pageSize.toLowerCase(), options.orientation);
                        pageNum++;
                        x = options.margins;
                        y = options.margins;
                        // Ne pas réinitialiser currentUnivers ici si on n'est pas en mode separateUnivers
                         if (options.separateUnivers) {
                             // Si on change de page en mode séparation, on reprend le même univers
                             // Pas besoin de changer currentUnivers ici.
                         }
                    }
                } else { // Colonne suivante
                    x += options.labelWidth + options.gap;
                }
            });

            // Ajout Titre et Numéro de page (après avoir dessiné toutes les étiquettes)
             if (options.title || pageNum > 1) {
                for (let i = 1; i <= pageNum; i++) {
                    doc.setPage(i); // Sélectionne la page
                    doc.setFontSize(8); // Petite police
                    doc.setTextColor(150); // Gris

                    // Ajoute le titre en haut au centre
                    if (options.title) {
                        doc.text(options.title, options.pageWidth / 2, options.margins / 2, { align: 'center' });
                    }

                    // Ajoute le numéro de page en bas à droite
                    doc.text(`Page ${i}/${pageNum}`, options.pageWidth - options.margins, options.pageHeight - options.margins / 2, { align: 'right'});
                }
             }

	     // --- Affichage dans l'iframe via Blob et Object URL ---
            console.log("Génération du Blob PDF...");
            const pdfBlob = doc.output('blob'); // Génère le PDF comme un Blob
            console.log("Création de l'Object URL...");
            const pdfObjectUrl = URL.createObjectURL(pdfBlob); // Crée une URL temporaire

            // Nettoyage de l'ancienne URL si elle existe pour éviter les fuites mémoire
            if (previewIframe.dataset.currentObjectUrl) {
                URL.revokeObjectURL(previewIframe.dataset.currentObjectUrl);
            }
            // Stocke la nouvelle URL pour pouvoir la révoquer plus tard
            previewIframe.dataset.currentObjectUrl = pdfObjectUrl;

            console.log("Affichage dans l'iframe via Object URL:", pdfObjectUrl.substring(0, 100) + "...");
            previewIframe.src = pdfObjectUrl; // Utilise l'URL de l'objet Blob

        } catch (error) {
            console.error('Erreur lors de la génération du PDF:', error);
            alert(`Erreur: ${error.message}`);
            previewIframe.src = 'about:blank';
        } finally {
            loadingIndicator.style.display = 'none';
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="bi bi-file-earmark-pdf-fill"></i> Générer l\'aperçu PDF';
        }
    }

}); // Fin DOMContentLoaded
