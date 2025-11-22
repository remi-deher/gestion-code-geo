document.addEventListener('DOMContentLoaded', () => {

    // 1. Initialisation des Toasts (Notifications)
    [].slice.call(document.querySelectorAll('.toast')).map(function (toastEl) {
        new bootstrap.Toast(toastEl).show();
    });

    // =========================================================
    // 2. LIST.JS (Recherche & Tri)
    // =========================================================
    const listId = 'fiches-list-js';
    const listContainer = document.getElementById(listId);
    
    // Sécurité : On vérifie s'il y a des items avant d'initier List.js
    // Cela empêche le crash "The list needs to have at least one item..."
    const hasItems = document.querySelectorAll('.list-item-entry').length > 0;
    let geoCodeList = null;

    if (listContainer && hasItems) {
        const options = {
            // Ces classes CSS doivent exister dans vos <td>
            valueNames: [ 'code_geo', 'libelle', 'univers', 'zone' ],
            listClass: 'list', 
            page: 20, // Pagination
            pagination: {
                paginationClass: 'pagination',
                innerWindow: 1, 
                outerWindow: 1,
                item: '<li class="page-item"><a class="page-link" href="#"></a></li>'
            }
        };

        // Démarrage de List.js
        geoCodeList = new List(listId, options);

        // Événement : Se déclenche après une recherche, un tri ou un changement de page
        geoCodeList.on('updated', function () {
            generateQRs(); // Regénérer les QR de la page visible
            updateBulkUI(); // Mettre à jour l'état des cases à cocher
        });
    }


    // =========================================================
    // 3. QR CODES (Génération automatique)
    // =========================================================
    function generateQRs() {
        if (typeof QRCode === 'undefined') return;
        
        document.querySelectorAll('.qr-mini').forEach(el => {
            // On ne génère que si le conteneur est vide et visible
            if (el.innerHTML.trim() === '') {
                const code = el.dataset.code;
                if (code) {
                    try {
                        new QRCode(el, { 
                            text: code, 
                            width: 28, 
                            height: 28, 
                            correctLevel: QRCode.CorrectLevel.L 
                        });
                    } catch(e) {
                        console.error("Erreur QR", e);
                    }
                }
            }
        });
    }
    // Premier appel au chargement de la page
    generateQRs();


    // =========================================================
    // 4. ACTIONS DE MASSE (Barre flottante)
    // =========================================================
    const bulkBar = document.getElementById('bulk-actions-bar');
    const countEl = document.getElementById('selected-count');
    const checkAll = document.getElementById('check-all');
    let selectedIds = new Set();

    const updateBulkUI = () => {
        // 1. Cocher visuellement les cases correspondantes au Set
        document.querySelectorAll('.item-checkbox').forEach(cb => {
            cb.checked = selectedIds.has(cb.value);
        });
        
        // 2. Mettre à jour la barre flottante
        if(countEl) countEl.textContent = selectedIds.size;
        if(bulkBar) {
            selectedIds.size > 0 ? bulkBar.classList.add('visible') : bulkBar.classList.remove('visible');
        }
    };

    // A. Clic sur une case individuelle (Délégation d'événement)
    if(listContainer) {
        listContainer.addEventListener('change', (e) => {
            if(e.target.classList.contains('item-checkbox')) {
                if(e.target.checked) selectedIds.add(e.target.value);
                else selectedIds.delete(e.target.value);
                updateBulkUI();
            }
        });
    }

    // B. Clic sur "Tout cocher" (seulement la page visible)
    if(checkAll) {
        checkAll.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            // Sélectionner seulement les lignes visibles (non masquées par le filtre)
            const visibleCheckboxes = document.querySelectorAll('.list-item-entry:not([style*="display: none"]) .item-checkbox');
            
            visibleCheckboxes.forEach(cb => {
                cb.checked = isChecked;
                if(isChecked) selectedIds.add(cb.value);
                else selectedIds.delete(cb.value);
            });
            updateBulkUI();
        });
    }

    // C. Bouton "Fermer la barre"
    document.getElementById('bulk-close')?.addEventListener('click', () => {
        selectedIds.clear();
        if(checkAll) checkAll.checked = false;
        updateBulkUI();
    });


    // =========================================================
    // 5. IMPRESSION UNITAIRE & ACTIONS
    // =========================================================
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-print-single');
        if (btn) {
            e.preventDefault();
            printSingleLabel(btn.dataset.id, btn);
        }
    });

    // Logique d'impression PDF (Simplifiée)
    async function printSingleLabel(id, btn) {
        if (typeof jspdf === 'undefined' || typeof QRCode === 'undefined') {
            alert("Erreur : Bibliothèques JS manquantes (jsPDF ou QRCode).");
            return;
        }
        const { jsPDF } = window.jspdf;
        const oldHtml = btn.innerHTML;
        
        // Feedback visuel
        btn.disabled = true; 
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

        try {
            // Récupération des données JSON
            const res = await fetch(`index.php?action=getSingleGeoCodeJson&id=${id}`);
            const json = await res.json();
            
            if(!json.success) throw new Error(json.error || "Données introuvables");
            const data = json.data;

            // Création PDF (70x35mm)
            const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: [70, 35] });
            
            // Texte
            doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
            doc.text(data.code_geo, 35, 12, { align: 'center' });
            
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
            // Tronquer libellé si trop long
            let libelle = data.libelle || '';
            if(libelle.length > 30) libelle = libelle.substring(0, 27) + '...';
            doc.text(libelle, 35, 20, { align: 'center' });

            if(data.univers_nom) {
                doc.setFontSize(8); doc.setTextColor(100);
                doc.text(data.univers_nom, 35, 28, { align: 'center' });
            }

            // Génération QR temporaire pour l'insérer dans le PDF
            const div = document.createElement('div');
            new QRCode(div, { text: data.code_geo, width: 100, height: 100 });
            
            // Petit délai pour laisser le QR se dessiner dans le DOM virtuel
            setTimeout(() => {
                const img = div.querySelector('img');
                if(img && img.src) {
                    doc.addImage(img.src, 'PNG', 2, 2, 14, 14); // QR en haut à gauche
                }
                doc.output('dataurlnewwindow'); // Ouvrir dans un nouvel onglet
                
                // Reset bouton
                btn.disabled = false; 
                btn.innerHTML = oldHtml;
            }, 50);

        } catch(e) {
            console.error(e);
            alert("Erreur lors de l'impression : " + e.message);
            btn.disabled = false; 
            btn.innerHTML = oldHtml;
        }
    }
});
