// Fichier: public/js/app.js

document.addEventListener('DOMContentLoaded', () => {

    // -----------------------------------------------------------------
    // 1. Initialisation des Toasts (Notifications)
    // -----------------------------------------------------------------
    const toastElList = [].slice.call(document.querySelectorAll('.toast'));
    const toastList = toastElList.map(function (toastEl) {
        // On le crée mais on ne le montre pas, sauf s'il a 'data-bs-autohide="true"'
        const toast = new bootstrap.Toast(toastEl, {
            autohide: toastEl.dataset.bsAutohide !== 'false' // Les flashes PHP doivent s'auto-cacher
        });
        if (toastEl.dataset.bsAutohide !== 'false') {
             toast.show(); // Affiche les toasts flash PHP
        }
        return toast;
    });

    // Fonction utilitaire pour afficher un toast JS (si nécessaire)
    // function showToast(message, type = 'info') {
    //     // Logique pour créer un toast dynamiquement et l'afficher
    //     // ... (non implémenté ici)
    // }


    // -----------------------------------------------------------------
    // 2. Initialisation de List.js (Tri et Filtre)
    // -----------------------------------------------------------------
    const listJsContainer = document.getElementById('fiches-list-js');
    let geoCodeList = null;
    let listJsOptions = {};

    if (listJsContainer) {
        listJsOptions = {
            valueNames: [
                'code_geo',
                'libelle',
                'univers', // Utilise le span caché .univers
                'zone'     // Utilise le span caché .zone
            ],
            page: 10000, // Nombre d'items par page (très haut pour "pas de pagination")
            pagination: { // Active la pagination si 'page' est plus bas
                paginationClass: 'pagination', // Classe Bootstrap
                innerWindow: 1,
                outerWindow: 0
            },
            // List.js trouve les items (les .geo-card) automatiquement
            // en tant qu'enfants directs de l'élément .list
        };

        geoCodeList = new List('fiches-list-js', listJsOptions);

        // Gérer l'état "vide" (si on ajoute un message "aucun résultat")
        // geoCodeList.on('updated', (list) => {
        //     const noResultsEl = listJsContainer.querySelector('.no-results-message');
        //     if (noResultsEl) {
        //         noResultsEl.style.display = list.matchingItems.length > 0 ? 'none' : 'block';
        //     }
        // });
    }


    // -----------------------------------------------------------------
    // 3. Logique des Filtres (Zone, Univers, Recherche, Tri)
    // -----------------------------------------------------------------
    let currentZoneFilter = 'all';
    let currentUniversFilter = 'all';

    // Fonction de filtrage principale (appelée par List.js)
    const filterFunction = (item) => {
        const itemEl = item.elm; // L'élément DOM de la carte (.geo-card)

        const zoneMatch = (currentZoneFilter === 'all') || (itemEl.dataset.zone === currentZoneFilter);
        const universMatch = (currentUniversFilter === 'all') || (itemEl.dataset.univers === currentUniversFilter);

        return zoneMatch && universMatch; // Doit correspondre aux DEUX filtres
    };

    // Attacher les écouteurs de filtres (Zone et Univers)
    // Cible tous les panneaux de contrôle (desktop + mobile offcanvas)
    const allFilterControls = document.querySelectorAll('.zone-tabs, .zone-tabs-mobile, #filtres-univers, #filtres-univers-mobile');
    allFilterControls.forEach(control => {
        control.addEventListener('click', (e) => {
            const target = e.target;
            let filtersChanged = false;

            // Clic sur un onglet Zone
            if (target.classList.contains('zone-tab')) {
                currentZoneFilter = target.dataset.zone;
                filtersChanged = true;
                // Mettre à jour l'état 'active' pour tous les boutons de zone
                document.querySelectorAll('.zone-tab').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.zone === currentZoneFilter);
                });
                // Filtrer les pilules univers pour ne montrer que celles de la zone
                filterUniversPills();
            }

            // Clic sur une pilule Univers
            if (target.classList.contains('filter-pill')) {
                currentUniversFilter = target.dataset.filter;
                filtersChanged = true;
                // Mettre à jour 'active' pour toutes les pilules univers
                document.querySelectorAll('.filter-pill').forEach(pill => {
                    pill.classList.toggle('active', pill.dataset.filter === currentUniversFilter);
                });
            }

            // Appliquer le filtre List.js si un filtre a changé
            if (geoCodeList && filtersChanged) {
                geoCodeList.filter(filterFunction);
            }
        });
    });

    // Fonction pour filtrer les pilules Univers en fonction de la Zone
    function filterUniversPills() {
        document.querySelectorAll('.filter-pill[data-zone]').forEach(pill => {
             const pillZone = pill.dataset.zone;
             // Afficher la pilule si 'Toutes' est sélectionné, ou si la zone correspond
             pill.style.display = (currentZoneFilter === 'all' || pillZone === currentZoneFilter) ? 'inline-block' : 'none';
        });
        // Si le filtre univers actif est maintenant caché, réinitialiser le filtre univers
        const activePill = document.querySelector(`.filter-pill[data-filter="${currentUniversFilter}"]`);
        if (activePill && activePill.style.display === 'none') {
            currentUniversFilter = 'all'; // Réinitialiser
            document.querySelectorAll('.filter-pill').forEach(pill => {
                pill.classList.toggle('active', pill.dataset.filter === 'all');
            });
        }
    }
    filterUniversPills(); // Appel initial au chargement

    // --- Recherche (lier desktop et mobile) ---
    const searchInputs = document.querySelectorAll('.listjs-search');
    searchInputs.forEach(input => {
        input.addEventListener('keyup', (e) => {
            const searchString = e.target.value;
            if (geoCodeList) geoCodeList.search(searchString);
            // Synchroniser les champs de recherche
            searchInputs.forEach(si => { if (si !== e.target) si.value = searchString; });
        });
    });

    // --- Tri (lier desktop et mobile) ---
    const sortSelects = document.querySelectorAll('.sort');
    sortSelects.forEach(select => {
        select.addEventListener('change', (e) => {
            const sortBy = e.target.value;
            if (geoCodeList) geoCodeList.sort(sortBy, { order: 'asc' });
            // Synchroniser les sélecteurs de tri
            sortSelects.forEach(ss => { if (ss !== e.target) ss.value = sortBy; });
        });
    });


    // -----------------------------------------------------------------
    // 4. Génération des QR Codes dans la liste
    // -----------------------------------------------------------------
    if (typeof QRCode !== 'undefined') {
        document.querySelectorAll('.geo-card-qr').forEach(qrContainer => {
            const code = qrContainer.dataset.code;
            if (code) {
                try {
                    new QRCode(qrContainer, {
                        text: code,
                        width: 64, // Taille pour la liste
                        height: 64,
                        correctLevel: QRCode.CorrectLevel.M // Correction moyenne
                    });
                } catch (e) {
                    console.error("Erreur génération QR Code pour la liste:", e);
                    qrContainer.innerHTML = '<span class="small text-danger">Erreur QR</span>';
                }
            }
        });
    } else {
        console.warn("QRCode library (qrcodejs2) n'est pas chargée. Les QR codes de la liste ne seront pas affichés.");
    }


    // -----------------------------------------------------------------
    // 5. Logique d'impression d'étiquette unique (nouvelle)
    // -----------------------------------------------------------------

    // Utiliser la délégation d'événements sur le conteneur de liste
    if (listJsContainer) {
        listJsContainer.addEventListener('click', (event) => {
            const printButton = event.target.closest('.btn-print-single');
            if (printButton) {
                event.preventDefault(); // Empêche tout comportement par défaut
                const geoCodeId = printButton.dataset.id;
                if (geoCodeId) {
                    console.log(`Demande d'impression pour ID: ${geoCodeId}`);
                    printSingleLabel(parseInt(geoCodeId, 10), printButton); // Passe le bouton pour le feedback visuel
                } else {
                    console.error("Bouton Imprimer cliqué mais data-id manquant.");
                }
            }
        });
    }

    /**
     * Fonction principale pour imprimer une étiquette unique
     * @param {number} geoCodeId L'ID du code à imprimer
     * @param {HTMLElement} buttonEl Le bouton qui a été cliqué (pour feedback)
     */
    async function printSingleLabel(geoCodeId, buttonEl) {
        // Vérifier si les bibliothèques sont chargées
        if (typeof jspdf === 'undefined' || typeof QRCode === 'undefined') {
            console.error('Erreur: jsPDF ou QRCode (qrcodejs2) n\'est pas chargé.');
            alert('Erreur critique : librairies PDF ou QRCode manquantes.');
            return;
        }
        // Accéder à la classe jsPDF via l'objet global jspdf
        const { jsPDF } = jspdf;

        let originalButtonHtml = '';
        if (buttonEl) {
            originalButtonHtml = buttonEl.innerHTML;
            buttonEl.disabled = true;
            // Spinner Bootstrap
            buttonEl.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`;
        }

        try {
            // 1. Récupérer les données du serveur
            console.log(`Récupération JSON pour ID ${geoCodeId}...`);
            const response = await fetch(`index.php?action=getSingleGeoCodeJson&id=${geoCodeId}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Erreur HTTP ${response.status}` }));
                throw new Error(errorData.error || `Erreur serveur ${response.status}`);
            }
            const result = await response.json();
            if (!result.success || !result.data) {
                throw new Error(result.error || "Données du code géo non trouvées.");
            }
            const codeData = result.data;
            console.log("Données reçues pour impression:", codeData);

            // 2. Générer l'image du QR Code (en base64)
            let qrCodeDataUrl = null;
            if (codeData.code_geo) {
                qrCodeDataUrl = await generateSingleQrCode(codeData.code_geo);
            }

            // 3. Créer le document PDF (Taille étiquette: 70mm x 35mm)
            const labelWidthMM = 70;
            const labelHeightMM = 35;
            const doc = new jsPDF({
                orientation: 'landscape', // l > h
                unit: 'mm',
                format: [labelWidthMM, labelHeightMM] // [width, height]
            });

            // 4. Dessiner le contenu sur le PDF
            drawSingleLabelOnPdf(doc, codeData, qrCodeDataUrl, 0, 0, labelWidthMM, labelHeightMM);

            // 5. Ouvrir le PDF dans une nouvelle fenêtre
            doc.output('dataurlnewwindow', { filename: `etiquette_${codeData.code_geo}.pdf` });

        } catch (error) {
            console.error('Erreur lors de la génération de l\'étiquette PDF:', error);
            alert(`Impossible de générer l'étiquette : ${error.message}`);
        } finally {
            // 6. Restaurer le bouton
            if (buttonEl) {
                buttonEl.disabled = false;
                buttonEl.innerHTML = originalButtonHtml;
            }
        }
    }

    /**
     * Génère un QR Code et retourne son Data URL (base64)
     * @param {string} text Le texte à encoder
     * @returns {Promise<string|null>} L'URL de données (base64) ou null
     */
    function generateSingleQrCode(text) {
        return new Promise((resolve, reject) => {
            // Créer un conteneur temporaire hors écran
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            document.body.appendChild(tempDiv);
            
            try {
                // Instancier QRCode
                new QRCode(tempDiv, {
                    text: text,
                    width: 128, // Résolution suffisante
                    height: 128,
                    correctLevel: QRCode.CorrectLevel.H // Correction d'erreur élevée
                });

                // Laisser 100ms à qrcodejs2 pour dessiner (canvas ou img)
                setTimeout(() => {
                    let dataUrl = null;
                    const canvas = tempDiv.querySelector('canvas');
                    const img = tempDiv.querySelector('img');

                    if (canvas) {
                        try { dataUrl = canvas.toDataURL('image/png'); } catch (e) { console.error("Erreur toDataURL:", e); }
                    } else if (img && img.src) {
                        dataUrl = img.src; // Si qrcodejs utilise une img (fallback)
                    } else {
                        console.warn("QRCode n'a généré ni canvas ni img.");
                    }
                    
                    document.body.removeChild(tempDiv); // Nettoyer le DOM
                    resolve(dataUrl); // Renvoyer l'URL (ou null)
                
                }, 100);
            
            } catch (e) {
                console.error("Erreur instanciation QRCode:", e);
                if (document.body.contains(tempDiv)) document.body.removeChild(tempDiv);
                reject(e); // Rejeter la promesse
            }
        });
    }

    /**
     * Dessine le contenu de l'étiquette sur le document jsPDF
     * @param {jsPDF} doc L'instance jsPDF
     * @param {object} codeData Données (code_geo, libelle, univers_nom, commentaire)
     * @param {string|null} qrDataUrl L'URL base64 du QR code
     * @param {number} x Position X de départ
     * @param {number} y Position Y de départ
     * @param {number} w Largeur totale étiquette
     * @param {number} h Hauteur totale étiquette
     */
    function drawSingleLabelOnPdf(doc, codeData, qrDataUrl, x, y, w, h) {
        const padding = 2; // Marge interne en mm
        let qrSize = 0;
        let textX = x + padding;

        // 1. Dessiner le QR Code (s'il existe)
        if (qrDataUrl) {
            qrSize = Math.min(h - 2 * padding, w * 0.4); // 40% largeur max, contraint par hauteur
            qrSize = Math.max(10, qrSize); // Taille min
            textX = x + padding + qrSize + padding; // Décaler le texte
            try {
                const qrActualY = y + (h - qrSize) / 2; // Centrer verticalement
                doc.addImage(qrDataUrl, 'PNG', x + padding, qrActualY, qrSize, qrSize);
            } catch (e) {
                console.error("Erreur jspdf.addImage QR:", e);
                qrSize = 0; // Reset si erreur
                textX = x + padding;
            }
        }

        // 2. Préparer les infos texte
        const textW = w - (qrSize > 0 ? (qrSize + 3 * padding) : (2 * padding)); // Largeur dispo
        const textBlockY = y + padding;
        const textBlockH = h - 2 * padding;
        
        doc.setFont('helvetica', 'normal'); // Police "safe"
        
        // Tailles de police dynamiques (basées sur hauteur étiquette)
        const codeFontSize = Math.min(12, Math.max(7, h * 0.25));
        const libelleFontSize = Math.min(9, Math.max(6, h * 0.20));
        const smallFontSize = Math.min(8, Math.max(5, h * 0.18));
        const baselineShift = 0.35; // Facteur pt -> mm pour position Y (approx)

        // Infos à afficher
        const lines = [];
        if (codeData.code_geo) lines.push({ text: codeData.code_geo, size: codeFontSize, style: 'bold', color: 0 });
        if (codeData.libelle) lines.push({ text: codeData.libelle, size: libelleFontSize, style: 'normal', color: 0 });
        if (codeData.univers_nom) lines.push({ text: `Univers: ${codeData.univers_nom}`, size: smallFontSize, style: 'italic', color: 100 });
        if (codeData.commentaire) lines.push({ text: `${codeData.commentaire}`, size: smallFontSize, style: 'italic', color: 100 });

        // Calculer la hauteur totale du bloc texte
        let totalTextHeight = 0;
        const ptToMm = 0.352777; // 1 pt = 0.352777 mm
        const lineHeightFactor = 1.15; // Interligne 15%
        
        lines.forEach(line => {
            doc.setFont('helvetica', line.style);
            doc.setFontSize(line.size);
            const splitLines = doc.splitTextToSize(line.text, textW);
            totalTextHeight += (splitLines.length * (line.size * ptToMm * lineHeightFactor));
        });

        // Position Y de départ pour centrer le bloc verticalement
        let currentY = textBlockY + (textBlockH - totalTextHeight) / 2;
        if (currentY < textBlockY) currentY = textBlockY; // Ne pas déborder en haut

        // 3. Dessiner le texte, ligne par ligne
        lines.forEach(line => {
            doc.setFont('helvetica', line.style);
            doc.setFontSize(line.size);
            doc.setTextColor(line.color || 0);
            
            const splitLines = doc.splitTextToSize(line.text, textW);
            const textHeight = (splitLines.length * (line.size * ptToMm * lineHeightFactor));
            
            // Position Y pour cette ligne (baseline du premier mot)
            const lineYPos = currentY + (line.size * baselineShift); // position = Y + (taille police * facteur)
            
            doc.text(splitLines, textX, lineYPos, { maxWidth: textW, baseline: 'alphabetic', align: 'left' });
            
            currentY += textHeight; // Avancer Y pour le prochain bloc de texte
        });
    }

}); // Fin DOMContentLoaded
