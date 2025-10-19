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
    const labelsPerPageInput = form.querySelector('#labels_per_page');
    const pageSizeSelect = form.querySelector('#page_size');
    const orientationSelect = form.querySelector('#orientation');
    const columnsInput = form.querySelector('#columns'); // Nouveau
    const marginsInput = form.querySelector('#margins');
    const gapInput = form.querySelector('#gap');
    const templateStyleSelect = form.querySelector('#template_style');

    // --- CONSTANTES ---
    const MIN_LABEL_WIDTH_MM = 20; // Largeur minimale acceptable pour une étiquette (réduit)
    const MIN_LABEL_HEIGHT_MM = 10; // Hauteur minimale acceptable pour une étiquette (réduit)

    // --- Initialisation et Écouteurs ---
    if (!form || !generateBtn || !previewIframe || !loadingIndicator || !labelsPerPageInput || !pageSizeSelect || !orientationSelect || !columnsInput || !marginsInput || !gapInput || !templateStyleSelect) {
        console.error("Un ou plusieurs éléments essentiels du formulaire sont manquants.");
        alert("Erreur: Impossible d'initialiser le formulaire d'impression.");
        return;
    }

    generateBtn.addEventListener('click', generatePdf);

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => universCheckboxes.forEach(cb => cb.checked = true));
    }
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => universCheckboxes.forEach(cb => cb.checked = false));
    }

    // --- Fonctions ---

    /**
     * Lit les options du formulaire, calcule la taille maximale des étiquettes et valide.
     * @returns {object} L'objet options complet pour la génération PDF.
     * @throws {Error} Si la validation échoue.
     */
    function readOptions() {
        const options = {
            universIds: Array.from(form.querySelectorAll('input[name="univers_ids[]"]:checked')).map(cb => cb.value),
            fields: Array.from(form.querySelectorAll('input[name="fields[]"]:checked')).map(cb => cb.value),
            copies: parseInt(form.querySelector('#copies').value, 10) || 1,
            title: form.querySelector('#print_title').value.trim(),
            separateUnivers: form.querySelector('#separate_univers').checked,
            addCutLines: form.querySelector('#add_cut_lines').checked,

            // Layout de base
            targetLabelsPerPage: parseInt(labelsPerPageInput.value, 10) || 10,
            pageSize: pageSizeSelect.value,
            orientation: orientationSelect.value,
            columns: parseInt(columnsInput.value, 10) || 2, // Lecture du nombre de colonnes
            margins: parseFloat(marginsInput.value) || 10,
            gap: parseFloat(gapInput.value) || 0,
            templateStyle: templateStyleSelect.value || 'qr-left',
        };

        // --- VALIDATION & CALCUL TAILLE MAX ---
        options.margins = Math.max(0, options.margins);
        options.columns = Math.max(1, options.columns);
        options.gap = Math.max(0, options.gap);
        options.targetLabelsPerPage = Math.max(1, options.targetLabelsPerPage);

        const pageDimensions = getPageDimensions(options.pageSize, options.orientation);
        options.pageWidth = pageDimensions.width;
        options.pageHeight = pageDimensions.height;

        const availableWidth = options.pageWidth - (2 * options.margins);
        const availableHeight = options.pageHeight - (2 * options.margins);

        if (availableWidth <= 0 || availableHeight <= 0) {
            throw new Error(`Erreur de mise en page: Marges (${options.margins}mm) trop grandes pour le format ${options.pageSize}.`);
        }

        // 1. Calculer la largeur maximale par colonne
        const totalHorizontalGap = (options.columns - 1) * options.gap;
        if (availableWidth - totalHorizontalGap <= 0) {
            throw new Error("Erreur de mise en page: Espace insuffisant pour les colonnes et les espacements horizontaux.");
        }
        const calculatedLabelWidth = (availableWidth - totalHorizontalGap) / options.columns;

        // 2. Calculer le nombre de lignes nécessaires
        const rowsNeeded = Math.ceil(options.targetLabelsPerPage / options.columns);

        // 3. Calculer la hauteur maximale par ligne
        const totalVerticalGap = (rowsNeeded - 1) * options.gap;
         if (availableHeight - totalVerticalGap <= 0 && rowsNeeded > 1) { // Vérifier seulement si plus d'une ligne
            throw new Error(`Erreur de mise en page: Espace insuffisant pour ${rowsNeeded} lignes et les espacements verticaux.`);
        }
        // Gérer le cas d'une seule ligne (pas de gap vertical)
        const calculatedLabelHeight = rowsNeeded > 1
            ? (availableHeight - totalVerticalGap) / rowsNeeded
            : availableHeight / rowsNeeded; // Si une seule ligne, elle prend toute la hauteur dispo

        // 4. Validation des dimensions minimales
        if (calculatedLabelWidth < MIN_LABEL_WIDTH_MM || calculatedLabelHeight < MIN_LABEL_HEIGHT_MM) {
             throw new Error(`Les étiquettes seraient trop petites (${calculatedLabelWidth.toFixed(1)}x${calculatedLabelHeight.toFixed(1)} mm). Minimum requis: ${MIN_LABEL_WIDTH_MM}x${MIN_LABEL_HEIGHT_MM} mm.\nEssayez avec moins de colonnes, moins d'étiquettes par page, des marges/espaces plus petits ou un format/orientation différent.`);
        }

        // Ajouter les dimensions calculées aux options
        options.labelWidth = calculatedLabelWidth;
        options.labelHeight = calculatedLabelHeight;
        options.rows = rowsNeeded; // Pour information/debug

        console.log("Options lues et calculées:", options);
        return options;
    }

    // --- Les autres fonctions (getPageDimensions, fetchGeoCodes, generateQrCodeImages, drawLabel, generatePdf) restent les mêmes que dans la version précédente ---
    // ... (Coller ici les fonctions getPageDimensions, fetchGeoCodes, generateQrCodeImages, drawLabel, generatePdf de la réponse précédente) ...

    function getPageDimensions(pageSize, orientation) {
        const sizes = { 'A4': [210, 297], 'A3': [297, 420], 'letter': [215.9, 279.4] };
        let dims = sizes[pageSize] || sizes['A4'];
        return orientation === 'landscape' ? { width: dims[1], height: dims[0] } : { width: dims[0], height: dims[1] };
    }

    async function fetchGeoCodes(universIds) {
        if (!universIds || universIds.length === 0) return [];
        const params = new URLSearchParams();
        universIds.forEach(id => params.append('univers_ids[]', id));
        const url = `index.php?action=getCodesForPrint&${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erreur serveur (${response.status}) lors de la récupération des codes: ${errorText}`);
        }
        return await response.json();
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

        itemsToGenerate.forEach((code, index) => {
            if (includeQr && code.code_geo) {
                 qrPromises.push(new Promise((resolve) => {
                    const tempDiv = document.createElement('div');
                    tempDiv.id = `qr-temp-${index}-${Date.now()}`;
                    document.body.appendChild(tempDiv);
                    tempDiv.style.position = 'absolute'; tempDiv.style.left = '-9999px';

                    try {
                        new QRCode(tempDiv.id, { text: code.code_geo, width: 128, height: 128, correctLevel: QRCode.CorrectLevel.H });
                        setTimeout(() => {
                             const img = tempDiv.querySelector('img');
                             if (img && img.src) { resolve({ data: code, qrDataUrl: img.src }); }
                             else {
                                const canvas = tempDiv.querySelector('canvas');
                                if (canvas) {
                                    try { resolve({ data: code, qrDataUrl: canvas.toDataURL('image/png') }); }
                                    catch (canvasError) { console.error(`Erreur toDataURL pour ${code.code_geo}:`, canvasError); resolve({ data: code, qrDataUrl: null }); }
                                } else { console.warn(`QR non trouvé pour ${code.code_geo}`); resolve({ data: code, qrDataUrl: null }); }
                             }
                             document.body.removeChild(tempDiv);
                        }, 100);
                    } catch (e) {
                         console.error(`Erreur QRCode pour ${code.code_geo}:`, e); resolve({ data: code, qrDataUrl: null });
                        if (document.body.contains(tempDiv)) { document.body.removeChild(tempDiv); }
                    }
                 }));
            } else { qrPromises.push(Promise.resolve({ data: code, qrDataUrl: null })); }
        });
        return Promise.all(qrPromises);
    }

    function drawLabel(doc, item, x, y, options) {
        const code = item.data;
        const qrDataUrl = item.qrDataUrl;
        const { labelWidth: w, labelHeight: h, fields, templateStyle } = options;
        const baseFontSize = h * 0.18;
        const codeFontSize = Math.min(14, Math.max(5, baseFontSize * 1.2));
        const libelleFontSize = Math.min(10, Math.max(4, baseFontSize * 0.9));
        const smallFontSize = Math.min(8, Math.max(4, baseFontSize * 0.7));
        const padding = Math.min(1.5, w * 0.05, h * 0.05);

        if (options.addCutLines) { doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1); doc.rect(x, y, w, h, 'S'); }

        let qrSize = 0, qrX = x + padding, qrY = y + padding, textX = x + padding, textY = y + padding, textW = w - 2 * padding, textBlockHeight = h - 2 * padding, textAlign = 'left';
        let isQrPresent = fields.includes('qrcode') && qrDataUrl;

        if (isQrPresent) {
            switch (templateStyle) {
                case 'qr-top': qrSize = Math.min(w - 2 * padding, h * 0.5); qrX = x + (w - qrSize) / 2; qrY = y + padding; textY = qrY + qrSize + padding * 0.5; textBlockHeight = h - qrSize - 2.5 * padding; textAlign = 'center'; break;
                case 'compact': qrSize = Math.min(h - 2 * padding, w * 0.3); qrY = y + (h - qrSize) / 2; textX = qrX + qrSize + padding; textW = w - qrSize - 3 * padding; textBlockHeight = h - 2 * padding; break;
                case 'ultra-compact': qrSize = Math.min(h - 2 * padding, w * 0.5); qrY = y + (h - qrSize) / 2; textX = qrX + qrSize + padding; textW = w - qrSize - 3 * padding; textBlockHeight = h - 2 * padding; break;
                default: qrSize = Math.min(h - 2 * padding, w * 0.35); qrY = y + (h - qrSize) / 2; textX = qrX + qrSize + padding; textW = w - qrSize - 3 * padding; textBlockHeight = h - 2 * padding; break;
            }
            qrSize = Math.max(5, qrSize);
            try { if (qrSize > 0 && qrX >= x && qrY >= y) { doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize); } else { console.warn(`QR Size/Pos invalide pour ${code.code_geo}`); isQrPresent = false; } }
            catch (imgError) { console.error(`Erreur addImage QR pour ${code.code_geo}:`, imgError); isQrPresent = false; }
        }

        if (!isQrPresent || templateStyle === 'text-only') { textX = x + padding; textW = w - 2 * padding; textBlockHeight = h - 2 * padding; textAlign = templateStyle === 'text-only' ? 'left' : 'center'; }

        let currentY = textY;
        const baselineShiftFactor = 0.35;
        const addTextLine = (text, size, style, color = 0, opts = {}) => {
            if (!text || String(text).trim() === '') return 0;
            doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(color);
            let effectiveSize = size; const textString = String(text); let textToDraw = textString;
            let textWidth = doc.getTextWidth(textToDraw);
            if (textWidth > textW) { effectiveSize = Math.max(size * (textW / textWidth) * 0.95, 4); doc.setFontSize(effectiveSize); textWidth = doc.getTextWidth(textToDraw); }
            if (textWidth > textW) { const avgCharWidth = textWidth / textToDraw.length; const maxChars = Math.max(1, Math.floor(textW / avgCharWidth) - 1); textToDraw = textToDraw.substring(0, maxChars) + (maxChars > 1 ? '…' : ''); }
            const textHeightMM = effectiveSize * 0.352777 * 1.2; const textYPos = currentY + effectiveSize * baselineShiftFactor;
            if (currentY + textHeightMM > textY + textBlockHeight + padding * 0.5) { console.warn(`Texte "${textToDraw.substring(0, 20)}..." dépasse hauteur bloc pour ${code.code_geo}`); return 0; }
            let currentX = textX; if (textAlign === 'center') { currentX = x + w / 2; } else if (textAlign === 'right') { currentX = x + w - padding; }
            doc.text(textToDraw, currentX, textYPos, { align: textAlign, maxWidth: textW, baseline: 'alphabetic', ...opts });
            doc.setTextColor(0); return textHeightMM;
        };

        if (fields.includes('code_geo') && code.code_geo && templateStyle !== 'text-only') { currentY += addTextLine(code.code_geo, codeFontSize, 'bold'); }
        if (fields.includes('libelle') && code.libelle && templateStyle !== 'ultra-compact') { currentY += addTextLine(code.libelle, libelleFontSize, 'normal'); }
        if (fields.includes('code_geo') && code.code_geo && templateStyle === 'text-only') { currentY += addTextLine(code.code_geo, codeFontSize * 0.9, 'bold'); }
        if (fields.includes('univers') && code.univers && templateStyle !== 'ultra-compact') { currentY += addTextLine(`Univers: ${code.univers}`, smallFontSize, 'italic', 100); }
        if (fields.includes('commentaire') && code.commentaire && templateStyle !== 'ultra-compact') { addTextLine(`Note: ${code.commentaire}`, smallFontSize, 'italic', 100); }
    }

    async function generatePdf() {
        loadingIndicator.style.display = 'block';
        previewIframe.src = 'about:blank';
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Génération...';

        try {
            const options = readOptions(); // Lit, calcule layout et valide

            if (options.universIds.length === 0) { throw new Error("Veuillez sélectionner au moins un univers."); }
            const rawCodes = await fetchGeoCodes(options.universIds);
            if (rawCodes.length === 0) { throw new Error("Aucun code géo à imprimer pour la sélection."); }

            if (options.separateUnivers) { rawCodes.sort((a, b) => { const uc = (a.univers || 'ZZZ').localeCompare(b.univers || 'ZZZ'); return uc !== 0 ? uc : (a.code_geo || '').localeCompare(b.code_geo || ''); }); }
            else { rawCodes.sort((a, b) => (a.code_geo || '').localeCompare(b.code_geo || '')); }

            const itemsToDraw = await generateQrCodeImages(rawCodes, options);

            const doc = new jsPDF({ orientation: options.orientation, unit: 'mm', format: options.pageSize.toLowerCase() });
            doc.setFont('helvetica', 'normal');

            let x = options.margins, y = options.margins, col = 0, row = 0, pageNum = 1, currentUnivers = null, isFirstLabelOnPage = true;

            itemsToDraw.forEach((item) => {
                const itemUnivers = item.data.univers || 'Sans Univers';

                // Saut de page par univers
                if (options.separateUnivers && currentUnivers !== null && itemUnivers !== currentUnivers && !isFirstLabelOnPage) {
                    doc.addPage(options.pageSize.toLowerCase(), options.orientation); pageNum++; x = options.margins; y = options.margins; col = 0; row = 0; isFirstLabelOnPage = true;
                }
                currentUnivers = itemUnivers;

                // Saut de page si bas atteint (avant dessin)
                if (y + options.labelHeight > (options.pageHeight - options.margins + 0.1) && !isFirstLabelOnPage) {
                     doc.addPage(options.pageSize.toLowerCase(), options.orientation); pageNum++; x = options.margins; y = options.margins; col = 0; row = 0; isFirstLabelOnPage = true;
                }

                drawLabel(doc, item, x, y, options); // Dessine l'étiquette
                isFirstLabelOnPage = false;

                // Position suivante
                col++;
                if (col >= options.columns) { col = 0; row++; x = options.margins; y += options.labelHeight + options.gap; }
                else { x += options.labelWidth + options.gap; }
            });

            // Titre et numéros de page
            if (options.title || pageNum > 1) {
                for (let i = 1; i <= pageNum; i++) {
                    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
                    if (options.title) { doc.text(options.title, options.pageWidth / 2, options.margins / 2, { align: 'center', baseline: 'bottom' }); }
                    doc.text(`Page ${i}/${pageNum}`, options.pageWidth - options.margins, options.pageHeight - options.margins / 2, { align: 'right', baseline: 'top' });
                }
            }

            // Affichage
            const pdfBlob = doc.output('blob');
            const pdfObjectUrl = URL.createObjectURL(pdfBlob);
            if (previewIframe.dataset.currentObjectUrl) { URL.revokeObjectURL(previewIframe.dataset.currentObjectUrl); }
            previewIframe.dataset.currentObjectUrl = pdfObjectUrl;
            previewIframe.src = pdfObjectUrl;

        } catch (error) {
            console.error('Erreur PDF:', error); previewIframe.src = 'about:blank'; alert(`Erreur: ${error.message}`);
        } finally {
            loadingIndicator.style.display = 'none'; generateBtn.disabled = false; generateBtn.innerHTML = '<i class="bi bi-file-earmark-pdf-fill"></i> Générer l\'aperçu PDF';
        }
    }

}); // Fin DOMContentLoaded
