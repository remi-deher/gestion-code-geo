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
    // NOUVEAU: Récupération des nouveaux champs
    const labelsPerPageInput = form.querySelector('#labels_per_page');
    const pageSizeSelect = form.querySelector('#page_size');
    const orientationSelect = form.querySelector('#orientation');
    const marginsInput = form.querySelector('#margins');
    const gapInput = form.querySelector('#gap');
    const templateStyleSelect = form.querySelector('#template_style');

    // --- CONSTANTES ---
    const MIN_LABEL_WIDTH_MM = 25; // Largeur minimale acceptable pour une étiquette
    const MIN_LABEL_HEIGHT_MM = 15; // Hauteur minimale acceptable pour une étiquette

    // --- Initialisation et Écouteurs ---
    if (!form || !generateBtn || !previewIframe || !loadingIndicator || !labelsPerPageInput || !pageSizeSelect || !orientationSelect || !marginsInput || !gapInput || !templateStyleSelect) {
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
     * Lit les options du formulaire, calcule la mise en page et valide.
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
            margins: parseFloat(marginsInput.value) || 10,
            gap: parseFloat(gapInput.value) || 0,
            templateStyle: templateStyleSelect.value || 'qr-left',
        };

        // --- VALIDATION & CALCUL LAYOUT ---
        options.margins = Math.max(0, options.margins);
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

        // Calculer la meilleure disposition (colonnes, lignes, taille étiquette)
        const layout = calculateLayout(options.targetLabelsPerPage, availableWidth, availableHeight, options.gap);

        if (!layout) {
             throw new Error(`Impossible de faire tenir ${options.targetLabelsPerPage} étiquettes sur une page ${options.pageSize} ${options.orientation} avec ces marges/espacements.\nEssayez de réduire le nombre d'étiquettes, d'augmenter la taille du papier, ou de réduire les marges/espacements.`);
        }

        // Ajouter les dimensions calculées aux options
        options.columns = layout.columns;
        options.rows = layout.rows; // Pour info, pas directement utilisé par drawLabel
        options.labelWidth = layout.labelWidth;
        options.labelHeight = layout.labelHeight;

        // Validation finale des dimensions calculées (assurée par calculateLayout)

        console.log("Options lues et calculées:", options);
        return options;
    }

    /**
     * Calcule la disposition optimale (colonnes, lignes, taille) pour un nombre donné d'étiquettes.
     * @param {number} targetCount - Nombre d'étiquettes à faire tenir.
     * @param {number} availableWidth - Largeur disponible en mm.
     * @param {number} availableHeight - Hauteur disponible en mm.
     * @param {number} gap - Espace entre étiquettes en mm.
     * @returns {object|null} { columns, rows, labelWidth, labelHeight } ou null si impossible.
     */
    function calculateLayout(targetCount, availableWidth, availableHeight, gap) {
        let bestLayout = null;
        let minWastedSpace = Infinity;

        // Essayer différentes configurations de colonnes (de 1 à N)
        // Limite arbitraire pour éviter des calculs excessifs (ex: max 10 cols)
        for (let cols = 1; cols <= Math.min(targetCount, 10); cols++) {
            // Calculer le nombre de lignes nécessaires (arrondi supérieur)
            const rows = Math.ceil(targetCount / cols);

            // Calculer la taille maximale possible pour chaque étiquette avec cette disposition
            const totalHorizontalGap = (cols - 1) * gap;
            const potentialLabelWidth = (availableWidth - totalHorizontalGap) / cols;

            const totalVerticalGap = (rows - 1) * gap;
            const potentialLabelHeight = (availableHeight - totalVerticalGap) / rows;

            // Vérifier si les dimensions sont au-dessus du minimum acceptable
            if (potentialLabelWidth >= MIN_LABEL_WIDTH_MM && potentialLabelHeight >= MIN_LABEL_HEIGHT_MM) {
                // Calculer l'espace total réellement utilisé par les étiquettes de cette taille
                const actualLabelsOnPage = cols * rows; // Peut être > targetCount
                const usedWidth = cols * potentialLabelWidth + totalHorizontalGap;
                const usedHeight = rows * potentialLabelHeight + totalVerticalGap;
                const wastedSpace = (availableWidth * availableHeight) - (usedWidth * usedHeight);

                // On cherche la disposition qui minimise l'espace perdu tout en respectant
                // le nombre d'étiquettes minimum demandé (actualLabelsOnPage >= targetCount)
                // et en favorisant des proportions "raisonnables" (pas trop étroites/hautes).
                // Ici, on prend simplement la première solution valide, mais on pourrait affiner.
                // OU: on prend celle qui minimise l'espace perdu et contient ASSEZ d'étiquettes.
                if (actualLabelsOnPage >= targetCount && wastedSpace < minWastedSpace) {
                     minWastedSpace = wastedSpace;
                     bestLayout = {
                        columns: cols,
                        rows: rows,
                        labelWidth: potentialLabelWidth,
                        labelHeight: potentialLabelHeight
                    };
                    // console.log(`Layout potentiel trouvé: ${cols}x${rows}, Size: ${potentialLabelWidth.toFixed(1)}x${potentialLabelHeight.toFixed(1)}, Waste: ${wastedSpace.toFixed(1)}`);
                }
            }
        }

        if (bestLayout) {
             console.log(`Layout final choisi: ${bestLayout.columns}x${bestLayout.rows}, Size: ${bestLayout.labelWidth.toFixed(1)}x${bestLayout.labelHeight.toFixed(1)}`);
        } else {
             console.log("Aucun layout valide trouvé pour", targetCount, "étiquettes.");
        }
        return bestLayout;
    }


    function getPageDimensions(pageSize, orientation) {
        const sizes = { 'A4': [210, 297], 'A3': [297, 420], 'letter': [215.9, 279.4] };
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
                            width: 128, // Taille fixe pour la génération, sera redimensionné dans le PDF
                            height: 128,
                            correctLevel: QRCode.CorrectLevel.H // Niveau de correction élevé
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
                                         resolve({ data: code, qrDataUrl: null }); // Renvoyer null si erreur
                                    }
                                } else {
                                     console.warn(`Impossible de trouver l'image ou le canvas QR pour ${code.code_geo}`);
                                    resolve({ data: code, qrDataUrl: null }); // Renvoyer null si QR non généré
                                }
                             }
                             document.body.removeChild(tempDiv); // Nettoyer le DOM
                        }, 100); // Délai augmenté pour plus de sûreté
                    } catch (e) {
                         console.error(`Erreur lors de l'instanciation de QRCode pour ${code.code_geo}:`, e);
                        resolve({ data: code, qrDataUrl: null }); // Renvoyer null en cas d'erreur
                        // Assurer le nettoyage même si erreur avant le setTimeout
                        if (document.body.contains(tempDiv)) {
                           document.body.removeChild(tempDiv);
                        }
                    }
                 }));
            } else {
                 // Si pas de QR code demandé ou pas de code_geo, résoudre avec null
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
     * @param {object} options - Les options de mise en page (avec labelWidth/Height calculés).
     */
    function drawLabel(doc, item, x, y, options) {
        const code = item.data;
        const qrDataUrl = item.qrDataUrl;
        const { labelWidth: w, labelHeight: h, fields, templateStyle } = options;

        // --- Styles de texte (adaptés à la hauteur de l'étiquette) ---
        // Ajustement plus agressif pour petites étiquettes
        const baseFontSize = h * 0.18; // Réduit un peu le facteur de base
        const codeFontSize = Math.min(14, Math.max(5, baseFontSize * 1.2)); // Minimum 5pt
        const libelleFontSize = Math.min(10, Math.max(4, baseFontSize * 0.9)); // Minimum 4pt
        const smallFontSize = Math.min(8, Math.max(4, baseFontSize * 0.7)); // Minimum 4pt
        const padding = Math.min(1.5, w * 0.05, h * 0.05); // Padding réduit

        // --- Dessin de la bordure (trait de coupe) ---
        if (options.addCutLines) {
            doc.setDrawColor(200, 200, 200); // Gris clair
            doc.setLineWidth(0.1);
            doc.rect(x, y, w, h, 'S'); // 'S' pour Stroke (contour)
        }

        // --- Positionnement QR Code & Texte ---
        let qrSize = 0;
        let qrX = x + padding;
        let qrY = y + padding;
        let textX = x + padding;
        let textY = y + padding;
        let textW = w - 2 * padding;
        let textBlockHeight = h - 2 * padding; // Hauteur dispo pour le bloc texte
        let textAlign = 'left';
        let isQrPresent = fields.includes('qrcode') && qrDataUrl;

        // Calcul taille/position QR basé sur style et dimensions DISPONIBLES
        if (isQrPresent) {
            switch (templateStyle) {
                case 'qr-top':
                    qrSize = Math.min(w - 2 * padding, h * 0.5); // Limité par largeur et ~50% hauteur
                    qrX = x + (w - qrSize) / 2; // Centré H
                    qrY = y + padding;
                    textY = qrY + qrSize + padding * 0.5; // Texte en dessous
                    textBlockHeight = h - qrSize - 2.5 * padding;
                    textAlign = 'center';
                    break;
                case 'compact':
                    qrSize = Math.min(h - 2 * padding, w * 0.3); // QR petit à gauche (~30% largeur)
                    qrY = y + (h - qrSize) / 2; // Centré V
                    textX = qrX + qrSize + padding;
                    textW = w - qrSize - 3 * padding;
                    textBlockHeight = h - 2 * padding; // Prend toute la hauteur
                    break;
                 case 'ultra-compact':
                    qrSize = Math.min(h - 2 * padding, w * 0.5); // QR prend jusqu'à 50% largeur
                    qrX = x + padding;
                    qrY = y + (h - qrSize) / 2; // Centré V
                    textX = qrX + qrSize + padding;
                    textW = w - qrSize - 3 * padding;
                    textBlockHeight = h - 2 * padding;
                    break;
                case 'qr-left': // Style par défaut
                default:
                    qrSize = Math.min(h - 2 * padding, w * 0.35); // QR prend ~35% largeur max
                    qrY = y + (h - qrSize) / 2; // Centré V
                    textX = qrX + qrSize + padding;
                    textW = w - qrSize - 3 * padding; // Largeur restante pour le texte
                    textBlockHeight = h - 2 * padding; // Prend toute la hauteur
                    break;
            }

            qrSize = Math.max(5, qrSize); // Taille minimale QR pour lisibilité

            try {
                // Ajouter l'image QR si la taille est valide
                if (qrSize > 0 && qrX >= x && qrY >= y) { // Vérifs de base
                    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
                } else {
                     console.warn(`QR Size ou Position invalide pour ${code.code_geo}: Size=${qrSize}, X=${qrX}, Y=${qrY}`);
                     isQrPresent = false; // Ne pas essayer de dessiner le QR
                }
             } catch (imgError) {
                 console.error(`Erreur jsPDF.addImage pour QR de ${code.code_geo}:`, imgError);
                 isQrPresent = false; // Marquer comme non présent si erreur
            }
        }

        // Si pas de QR (option, erreur, ou style 'text-only'), le texte prend toute la place
        if (!isQrPresent || templateStyle === 'text-only') {
             textX = x + padding;
             textW = w - 2 * padding;
             textBlockHeight = h - 2 * padding;
             textAlign = templateStyle === 'text-only' ? 'left' : 'center'; // Centrer par défaut si pas de QR
        }

        // --- Dessin des textes ---
        let currentY = textY;
        const baselineShiftFactor = 0.35; // Facteur approx pour positionner le bas du texte

        // Fonction helper pour ajouter une ligne de texte
        const addTextLine = (text, size, style, color = 0, options = {}) => {
            if (!text || String(text).trim() === '') return 0; // Ignore lignes vides

            doc.setFont('helvetica', style); // Police simple
            doc.setFontSize(size);
            doc.setTextColor(color);

            let effectiveSize = size;
            const textString = String(text); // Assurer que c'est une chaîne
            let textToDraw = textString;

            // Ajustement simple de la taille si trop large (avant troncature)
            let textWidth = doc.getTextWidth(textToDraw);
            if (textWidth > textW) {
                effectiveSize = size * (textW / textWidth) * 0.95; // Réduire proportionnellement
                effectiveSize = Math.max(effectiveSize, 4); // Taille minimale absolue
                doc.setFontSize(effectiveSize);
                textWidth = doc.getTextWidth(textToDraw); // Recalculer la largeur avec la nouvelle taille
            }

            // Troncature si toujours trop large (même après réduction de taille)
            if (textWidth > textW) {
                // Approximation simple pour tronquer
                const avgCharWidth = textWidth / textToDraw.length;
                const maxChars = Math.floor(textW / avgCharWidth) - 1; // Estimer le nb max de chars
                if (maxChars > 1) {
                    textToDraw = textToDraw.substring(0, maxChars) + '…';
                } else {
                    textToDraw = '…'; // Si vraiment trop petit
                }
            }


            const textHeightMM = effectiveSize * 0.352777 * 1.2; // Conversion pt -> mm + interligne
            const textYPos = currentY + effectiveSize * baselineShiftFactor; // Position Y de la baseline

            // Vérifier si la ligne dépasse la hauteur disponible DU BLOC TEXTE
            if (currentY + textHeightMM > textY + textBlockHeight + padding * 0.5) { // Ajoute une petite tolérance
                 console.warn(`Texte "${textToDraw.substring(0, 20)}..." dépasse hauteur bloc pour ${code.code_geo}`);
                return 0; // Ne pas dessiner si ça dépasse
            }

            // Calculer position X selon alignement
            let currentX = textX;
            if (textAlign === 'center') {
                 // Pour le centrage, le X dans doc.text est le centre
                currentX = x + w / 2;
            } else if (textAlign === 'right') {
                currentX = x + w - padding;
            } // 'left' est déjà textX

            doc.text(textToDraw, currentX, textYPos, {
                align: textAlign,
                maxWidth: textW, // jsPDF gère aussi la troncature avec maxWidth, mais on l'a fait manuellement
                baseline: 'alphabetic', // Standard
                ...options
            });
            doc.setTextColor(0); // Reset couleur texte à noir
            return textHeightMM; // Retourne la hauteur utilisée par cette ligne
        };


        // Dessiner les champs demandés selon le style
        if (fields.includes('code_geo') && code.code_geo && templateStyle !== 'text-only') {
             currentY += addTextLine(code.code_geo, codeFontSize, 'bold');
        }
        if (fields.includes('libelle') && code.libelle && templateStyle !== 'ultra-compact') {
            currentY += addTextLine(code.libelle, libelleFontSize, 'normal');
        }
        // Style 'text-only': code géo après le libellé
        if (fields.includes('code_geo') && code.code_geo && templateStyle === 'text-only') {
            currentY += addTextLine(code.code_geo, codeFontSize * 0.9, 'bold'); // Un peu plus petit
        }
        if (fields.includes('univers') && code.univers && templateStyle !== 'ultra-compact') {
             currentY += addTextLine(`Univers: ${code.univers}`, smallFontSize, 'italic', 100); // Gris
        }
        if (fields.includes('commentaire') && code.commentaire && templateStyle !== 'ultra-compact') {
             addTextLine(`Note: ${code.commentaire}`, smallFontSize, 'italic', 100); // Gris
             // Ne pas incrémenter currentY pour le dernier élément pour éviter dépassement
        }
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
            const options = readOptions(); // Lit, calcule la mise en page et valide

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
            let row = 0; // Suivre la ligne actuelle
            let pageNum = 1;
            let currentUnivers = null;
            let isFirstLabelOnPage = true; // Pour gérer le saut de page par univers

            itemsToDraw.forEach((item) => {
                const itemUnivers = item.data.univers || 'Sans Univers';

                // --- Gestion Saut de Page ---
                // 1. Saut si nouvelle page par univers demandé
                if (options.separateUnivers && currentUnivers !== null && itemUnivers !== currentUnivers && !isFirstLabelOnPage) {
                    doc.addPage(options.pageSize.toLowerCase(), options.orientation);
                    pageNum++;
                    x = options.margins;
                    y = options.margins;
                    col = 0;
                    row = 0;
                    isFirstLabelOnPage = true;
                     console.log(`Saut de page (nouvel univers): ${itemUnivers}, Page ${pageNum}`);
                }
                currentUnivers = itemUnivers; // Mettre à jour l'univers courant

                // 2. Saut si on dépasse le bas de la page (calculé avant de dessiner)
                // Vérifie si la PROCHAINE position Y (après avoir fini la ligne actuelle) dépasserait la marge du bas
                if (y + options.labelHeight > (options.pageHeight - options.margins + 0.1) && !isFirstLabelOnPage) {
                     doc.addPage(options.pageSize.toLowerCase(), options.orientation);
                     pageNum++;
                     x = options.margins;
                     y = options.margins;
                     col = 0;
                     row = 0;
                     isFirstLabelOnPage = true;
                     console.log(`Saut de page (fin de page atteinte), Page ${pageNum}`);
                     // Si separateUnivers est actif, on continue avec le même univers sur la nouvelle page
                }

                // Dessine l'étiquette à la position actuelle (x, y)
                drawLabel(doc, item, x, y, options);
                isFirstLabelOnPage = false; // Marque que la première étiquette de la page est placée

                // --- Mise à jour position pour la prochaine étiquette ---
                col++;
                if (col >= options.columns) { // Fin de ligne, passer à la ligne suivante
                    col = 0;
                    row++;
                    x = options.margins;
                    y += options.labelHeight + options.gap;
                    // La vérification du saut de page se fera au début de la prochaine itération
                } else { // Colonne suivante sur la même ligne
                    x += options.labelWidth + options.gap;
                }
            });

            // Ajout Titre et Numéro de page (après avoir dessiné toutes les étiquettes)
             if (options.title || pageNum > 1) {
                for (let i = 1; i <= pageNum; i++) {
                    doc.setPage(i); // Sélectionne la page pour y ajouter du texte
                    doc.setFontSize(8);
                    doc.setTextColor(150); // Gris

                    // Titre en haut au centre (si défini)
                    if (options.title) {
                        doc.text(options.title, options.pageWidth / 2, options.margins / 2, { align: 'center', baseline: 'bottom' });
                    }

                    // Numéro de page en bas à droite
                    doc.text(`Page ${i}/${pageNum}`, options.pageWidth - options.margins, options.pageHeight - options.margins / 2, { align: 'right', baseline: 'top' });
                }
             }

	     // --- Affichage dans l'iframe ---
            console.log("Génération du Blob PDF...");
            const pdfBlob = doc.output('blob');
            console.log("Création de l'Object URL...");
            const pdfObjectUrl = URL.createObjectURL(pdfBlob);

            // Nettoyage de l'ancienne URL si elle existe
            if (previewIframe.dataset.currentObjectUrl) {
                URL.revokeObjectURL(previewIframe.dataset.currentObjectUrl);
            }
            previewIframe.dataset.currentObjectUrl = pdfObjectUrl; // Stocke la nouvelle URL

            console.log("Affichage dans l'iframe...");
            previewIframe.src = pdfObjectUrl; // Charge le PDF dans l'iframe

        } catch (error) {
            console.error('Erreur lors de la génération du PDF:', error);
            // Afficher l'erreur à l'utilisateur de manière plus visible
            previewIframe.src = 'about:blank'; // Vide l'aperçu
            // Afficher l'erreur dans une div ou une alerte Bootstrap si possible
            alert(`Erreur: ${error.message}`);
        } finally {
            loadingIndicator.style.display = 'none';
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="bi bi-file-earmark-pdf-fill"></i> Générer l\'aperçu PDF';
        }
    }

}); // Fin DOMContentLoaded
