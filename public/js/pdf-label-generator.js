document.addEventListener('DOMContentLoaded', () => {
    // Vérifie que les bibliothèques sont chargées
    if (typeof jspdf === 'undefined' || typeof QRCode === 'undefined' || typeof bootstrap === 'undefined') {
        console.error('Erreur: jsPDF, QRCode (qrcodejs2) ou Bootstrap JS n\'est pas chargé.');
        alert('Erreur critique : les bibliothèques nécessaires n\'ont pas pu être chargées. Vérifiez les inclusions dans layout.php.');
        return;
    }
    const { jsPDF } = jspdf;

    // --- Éléments du DOM ---
    const form = document.getElementById('print-options-form');
    const generateBtn = document.getElementById('generate-pdf-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const universCheckboxes = form.querySelectorAll('.univers-checkbox');
    const selectAllBtn = document.getElementById('select-all');
    const deselectAllBtn = document.getElementById('deselect-all');
    const labelsPerPageInput = form.querySelector('#labels_per_page');
    const pageSizeSelect = form.querySelector('#page_size');
    const orientationSelect = form.querySelector('#orientation');
    const columnsInput = form.querySelector('#columns');
    const marginsInput = form.querySelector('#margins');
    const gapInput = form.querySelector('#gap');
    const templateStyleSelect = form.querySelector('#template_style');
    const addColumnSeparatorsCheckbox = form.querySelector('#add_column_separators');

    // --- NOUVEAU : Gestion de l'Offcanvas ---
    const previewOffcanvasEl = document.getElementById('pdf-preview-offcanvas');
    const previewIframe = document.getElementById('pdf-preview-iframe'); // Toujours nécessaire
    if (!previewOffcanvasEl || !previewIframe) {
        console.error("L'élément offcanvas 'pdf-preview-offcanvas' ou l'iframe 'pdf-preview-iframe' est manquant.");
        alert("Erreur: Impossible d'initialiser l'aperçu PDF.");
        return;
    }
    // Crée une instance Bootstrap Offcanvas
    const previewOffcanvas = new bootstrap.Offcanvas(previewOffcanvasEl);


    // --- CONSTANTES ---
    const MIN_LABEL_WIDTH_MM = 20;
    const MIN_LABEL_HEIGHT_MM = 10;

    // --- Initialisation et Écouteurs ---
    if (!form || !generateBtn || !loadingIndicator || !labelsPerPageInput || !pageSizeSelect || !orientationSelect || !columnsInput || !marginsInput || !gapInput || !templateStyleSelect || !addColumnSeparatorsCheckbox) {
        console.error("Un ou plusieurs éléments essentiels du formulaire sont manquants.");
        alert("Erreur: Impossible d'initialiser le formulaire d'impression.");
        return;
    }

    generateBtn.addEventListener('click', generatePdf);
    if (selectAllBtn) { /* ... écouteur ... */ }
    if (deselectAllBtn) { /* ... écouteur ... */ }


    // --- Fonctions ---

    function readOptions() {
        // ... (La fonction readOptions reste identique à la version précédente) ...
        const options = {
            universIds: Array.from(form.querySelectorAll('input[name="univers_ids[]"]:checked')).map(cb => cb.value),
            fields: Array.from(form.querySelectorAll('input[name="fields[]"]:checked')).map(cb => cb.value),
            copies: parseInt(form.querySelector('#copies').value, 10) || 1,
            title: form.querySelector('#print_title').value.trim(),
            separateUnivers: form.querySelector('#separate_univers').checked,
            addCutLines: form.querySelector('#add_cut_lines').checked,
            addColumnSeparators: addColumnSeparatorsCheckbox.checked,
            targetLabelsPerPage: parseInt(labelsPerPageInput.value, 10) || 10,
            pageSize: pageSizeSelect.value,
            orientation: orientationSelect.value,
            columns: parseInt(columnsInput.value, 10) || 2,
            margins: parseFloat(marginsInput.value) || 10,
            gap: parseFloat(gapInput.value) || 0,
            templateStyle: templateStyleSelect.value || 'qr-left',
        };
        options.margins = Math.max(0, options.margins);
        options.columns = Math.max(1, options.columns);
        options.gap = Math.max(0, options.gap);
        options.targetLabelsPerPage = Math.max(1, options.targetLabelsPerPage);
        const pageDimensions = getPageDimensions(options.pageSize, options.orientation);
        options.pageWidth = pageDimensions.width;
        options.pageHeight = pageDimensions.height;
        const availableWidth = options.pageWidth - (2 * options.margins);
        const availableHeight = options.pageHeight - (2 * options.margins);
        if (availableWidth <= 0 || availableHeight <= 0) { throw new Error(`Erreur: Marges (${options.margins}mm) trop grandes.`); }
        const totalHorizontalGap = (options.columns - 1) * options.gap;
        if (availableWidth - totalHorizontalGap <= 0) { throw new Error(`Erreur: Espace insuffisant pour ${options.columns} colonnes.`); }
        const calculatedLabelWidth = (availableWidth - totalHorizontalGap) / options.columns;
        const potentialMaxRows = options.gap > 0 ? Math.floor((availableHeight + options.gap) / (MIN_LABEL_HEIGHT_MM + options.gap)) : Math.floor(availableHeight / MIN_LABEL_HEIGHT_MM);
        const maxRowsPossible = Math.max(1, potentialMaxRows);
        const rowsNeeded = Math.ceil(options.targetLabelsPerPage / options.columns);
        const actualRowsPerPage = Math.min(rowsNeeded, maxRowsPossible);
        const totalVerticalGap = (actualRowsPerPage - 1) * options.gap;
         if (availableHeight - totalVerticalGap <= 0 && actualRowsPerPage > 1) { throw new Error(`Erreur: Espace vertical insuffisant pour ${actualRowsPerPage} lignes.`); }
        const calculatedLabelHeight = actualRowsPerPage > 0 ? (availableHeight - totalVerticalGap) / actualRowsPerPage : 0;
        if (calculatedLabelWidth < MIN_LABEL_WIDTH_MM || calculatedLabelHeight < MIN_LABEL_HEIGHT_MM) { throw new Error(`Étiquettes trop petites (${calculatedLabelWidth.toFixed(1)}x${calculatedLabelHeight.toFixed(1)} mm). Min: ${MIN_LABEL_WIDTH_MM}x${MIN_LABEL_HEIGHT_MM} mm.`); }
        options.labelWidth = calculatedLabelWidth;
        options.labelHeight = calculatedLabelHeight;
        options.rows = actualRowsPerPage;
        console.log("Options lues et calculées:", options);
        return options;
    }

    function getPageDimensions(pageSize, orientation) {
        // ... (Identique) ...
        const sizes = { 'A4': [210, 297], 'A3': [297, 420], 'letter': [215.9, 279.4] };
        let dims = sizes[pageSize] || sizes['A4'];
        return orientation === 'landscape' ? { width: dims[1], height: dims[0] } : { width: dims[0], height: dims[1] };
    }

    async function fetchGeoCodes(universIds) {
        // ... (Identique) ...
        if (!universIds || universIds.length === 0) return [];
        const params = new URLSearchParams();
        universIds.forEach(id => params.append('univers_ids[]', id));
        const url = `index.php?action=getCodesForPrint&${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) { const errorText = await response.text(); throw new Error(`Erreur serveur (${response.status}): ${errorText}`); }
        const data = await response.json();
        return data;
    }

    async function generateQrCodeImages(codes, options) {
        // ... (Identique) ...
        const qrPromises = []; const includeQr = options.fields.includes('qrcode'); const itemsToGenerate = [];
        codes.forEach(code => { for (let i = 0; i < options.copies; i++) { itemsToGenerate.push(code); } });
        itemsToGenerate.forEach((code, index) => {
            if (includeQr && code.code_geo) {
                qrPromises.push(new Promise((resolve) => {
                    const tempDiv = document.createElement('div'); tempDiv.id = `qr-temp-${index}-${Date.now()}`;
                    document.body.appendChild(tempDiv); tempDiv.style.position = 'absolute'; tempDiv.style.left = '-9999px';
                    try {
                        new QRCode(tempDiv.id, { text: code.code_geo, width: 128, height: 128, correctLevel: QRCode.CorrectLevel.H });
                        setTimeout(() => {
                            const img = tempDiv.querySelector('img'); if (img && img.src) { resolve({ data: code, qrDataUrl: img.src }); }
                            else { const canvas = tempDiv.querySelector('canvas'); if (canvas) { try { resolve({ data: code, qrDataUrl: canvas.toDataURL('image/png') }); } catch (e) { resolve({ data: code, qrDataUrl: null }); } } else { resolve({ data: code, qrDataUrl: null }); } }
                            document.body.removeChild(tempDiv);
                        }, 100);
                    } catch (e) { resolve({ data: code, qrDataUrl: null }); if (document.body.contains(tempDiv)) { document.body.removeChild(tempDiv); } }
                }));
            } else { qrPromises.push(Promise.resolve({ data: code, qrDataUrl: null })); }
        });
        return Promise.all(qrPromises);
    }

    function drawLabel(doc, item, x, y, options) {
        // ... (Identique à la version précédente, avec les tailles de police augmentées) ...
        const code = item.data; const qrDataUrl = item.qrDataUrl; const { labelWidth: w, labelHeight: h, fields, templateStyle } = options;
        const baseFontSize = h * 0.22; const codeFontSize = Math.min(16, Math.max(7, baseFontSize * 1.3)); const libelleFontSize = Math.min(12, Math.max(6, baseFontSize * 1.0)); const smallFontSize = Math.min(10, Math.max(5, baseFontSize * 0.8)); const padding = Math.min(2, w * 0.05, h * 0.05);
        if (options.addCutLines) { doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1); doc.rect(x, y, w, h, 'S'); }
        let qrSize = 0, qrX = x + padding, qrY = y + padding, textX = x + padding, textY = y + padding, textW = w - 2 * padding, textBlockHeight = h - 2 * padding, textAlign = 'left';
        let isQrPresent = fields.includes('qrcode') && qrDataUrl;
        if (isQrPresent) {
            switch (templateStyle) {
                case 'qr-top': qrSize = Math.min(w - 2 * padding, h * 0.5); qrX = x + (w - qrSize) / 2; qrY = y + padding; textY = qrY + qrSize + padding * 0.7; textBlockHeight = h - qrSize - 3 * padding; textAlign = 'center'; break;
                case 'compact': qrSize = Math.min(h - 2 * padding, w * 0.3); qrY = y + (h - qrSize) / 2; textX = qrX + qrSize + padding * 1.5; textW = w - qrSize - 3.5 * padding; textBlockHeight = h - 2 * padding; break;
                case 'ultra-compact': qrSize = Math.min(h - 2 * padding, w * 0.5); qrY = y + (h - qrSize) / 2; textX = qrX + qrSize + padding; textW = w - qrSize - 3 * padding; textBlockHeight = h - 2 * padding; break;
                default: qrSize = Math.min(h - 2 * padding, w * 0.35); qrY = y + (h - qrSize) / 2; textX = qrX + qrSize + padding * 1.5; textW = w - qrSize - 3.5 * padding; textBlockHeight = h - 2 * padding; break;
            }
            qrSize = Math.max(5, qrSize);
            try { if (qrSize > 0 && qrX >= x && qrY >= y) { doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize); } else { isQrPresent = false; } }
            catch (e) { isQrPresent = false; }
        }
        if (!isQrPresent || templateStyle === 'text-only') { textX = x + padding; textW = w - 2 * padding; textBlockHeight = h - 2 * padding; textAlign = templateStyle === 'text-only' ? 'left' : 'center'; }
        let currentY = textY; const baselineShiftFactor = 0.35;
        const addTextLine = (text, size, style, color = 0, opts = {}) => {
            if (!text || String(text).trim() === '') return 0;
            doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(color);
            let effectiveSize = size; const textString = String(text); let textToDraw = textString;
            let textWidth = doc.getTextWidth(textToDraw); if (textWidth > textW) { effectiveSize = Math.max(size * (textW / textWidth) * 0.95, 4); doc.setFontSize(effectiveSize); textWidth = doc.getTextWidth(textToDraw); }
            if (textWidth > textW) { const avgCharWidth = textWidth / textToDraw.length || 1; const maxChars = Math.max(1, Math.floor(textW / avgCharWidth) - 1); textToDraw = textToDraw.substring(0, maxChars) + (maxChars > 1 ? '…' : ''); }
            const textHeightMM = effectiveSize * 0.352777 * 1.25; const textYPos = currentY + effectiveSize * baselineShiftFactor;
            if (currentY + textHeightMM > textY + textBlockHeight + padding * 0.5) { return 0; }
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

    /**
     * Fonction principale pour générer le PDF et afficher l'aperçu.
     */
    async function generatePdf() {
        loadingIndicator.style.display = 'block';
        previewIframe.src = 'about:blank'; // Vide l'aperçu précédent
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Génération...';

        try {
            const options = readOptions();

            if (options.universIds.length === 0) { throw new Error("Veuillez sélectionner au moins un univers."); }
            const rawCodes = await fetchGeoCodes(options.universIds);
            if (rawCodes.length === 0) { throw new Error("Aucun code géo à imprimer pour la sélection."); }

            // ... (Tri des codes, identique) ...
            if (options.separateUnivers) { rawCodes.sort((a, b) => { const uc = (a.univers || 'ZZZ').localeCompare(b.univers || 'ZZZ'); return uc !== 0 ? uc : (a.code_geo || '').localeCompare(b.code_geo || ''); }); }
            else { rawCodes.sort((a, b) => (a.code_geo || '').localeCompare(b.code_geo || '')); }

            const itemsToDraw = await generateQrCodeImages(rawCodes, options);

            const doc = new jsPDF({ orientation: options.orientation, unit: 'mm', format: options.pageSize.toLowerCase() });
            doc.setFont('helvetica', 'normal');

            let x = options.margins, y = options.margins, col = 0, row = 0, pageNum = 1, currentUnivers = null, isFirstLabelOnPage = true;
            let labelCounterOnPage = 0;

            const addNewPage = () => {
                doc.addPage(options.pageSize.toLowerCase(), options.orientation); pageNum++; x = options.margins; y = options.margins; col = 0; row = 0; isFirstLabelOnPage = true; labelCounterOnPage = 0;
                drawSeparatorsIfNeeded(pageNum);
            };

            const drawSeparatorsIfNeeded = (currentPage) => {
                // ... (Identique) ...
                if (options.addColumnSeparators && options.columns > 1) {
                    doc.setPage(currentPage); doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1);
                    const lineY1 = options.margins; const lineY2 = options.pageHeight - options.margins;
                    for (let c = 1; c < options.columns; c++) {
                        const lineX = options.margins + c * options.labelWidth + (c - 0.5) * options.gap;
                        doc.line(lineX, lineY1, lineX, lineY2);
                    }
                }
            };

            drawSeparatorsIfNeeded(pageNum); // Première page

            // ... (Boucle itemsToDraw, identique) ...
            itemsToDraw.forEach((item) => {
                const itemUnivers = item.data.univers || 'Sans Univers';
                let newPageNeeded = false;
                if (labelCounterOnPage >= options.targetLabelsPerPage && !isFirstLabelOnPage) { newPageNeeded = true; }
                if (options.separateUnivers && currentUnivers !== null && itemUnivers !== currentUnivers && !isFirstLabelOnPage) { newPageNeeded = true; }
                currentUnivers = itemUnivers;
                if (y + options.labelHeight > (options.pageHeight - options.margins + 0.1) && !isFirstLabelOnPage) { newPageNeeded = true; }
                if (newPageNeeded) { addNewPage(); }
                drawLabel(doc, item, x, y, options);
                isFirstLabelOnPage = false; labelCounterOnPage++;
                col++;
                if (col >= options.columns) { col = 0; row++; x = options.margins; y += options.labelHeight + options.gap; }
                else { x += options.labelWidth + options.gap; }
            });

            // ... (Ajout Titre et Pages, identique) ...
            if (options.title || pageNum > 1) {
                for (let i = 1; i <= pageNum; i++) {
                    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
                    if (options.title) { doc.text(options.title, options.pageWidth / 2, options.margins / 2, { align: 'center', baseline: 'bottom' }); }
                    doc.text(`Page ${i}/${pageNum}`, options.pageWidth - options.margins, options.pageHeight - options.margins / 2, { align: 'right', baseline: 'top' });
                }
            }

            // --- MODIFIÉ : Affichage dans l'Offcanvas ---
            console.log("Génération du Blob PDF...");
            const pdfBlob = doc.output('blob');
            const pdfObjectUrl = URL.createObjectURL(pdfBlob);

            if (previewIframe.dataset.currentObjectUrl) {
                URL.revokeObjectURL(previewIframe.dataset.currentObjectUrl);
            }
            previewIframe.dataset.currentObjectUrl = pdfObjectUrl;

            console.log("Affichage dans l'iframe de l'offcanvas...");
            previewIframe.src = pdfObjectUrl; // Charge le PDF
            
            previewOffcanvas.show(); // Ouvre le panneau glissant

        } catch (error) {
            console.error('Erreur PDF:', error);
            previewOffcanvas.hide(); // S'assure que le panneau est fermé en cas d'erreur
            alert(`Erreur: ${error.message}`);
        } finally {
            loadingIndicator.style.display = 'none';
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="bi bi-file-earmark-pdf-fill"></i> Générer l\'aperçu PDF';
        }
    }

}); // Fin DOMContentLoaded
