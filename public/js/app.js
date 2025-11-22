// Fichier: public/js/app.js

// On attend que le DOM soit chargé ET que jQuery soit prêt
$(document).ready(function() {

    // --- 0. VÉRIFICATION DE SÉCURITÉ ---
    if (!$.fn.DataTable) {
        console.error("❌ ERREUR : DataTables n'est pas chargé. Vérifiez l'ordre des scripts dans layout.php");
        return;
    }

    // --- 1. INITIALISATION DES TOASTS (Notifications) ---
    const toastElList = [].slice.call(document.querySelectorAll('.toast'));
    toastElList.map(function (toastEl) {
        new bootstrap.Toast(toastEl).show();
    });


    // =========================================================
    // 2. CONFIGURATION DATATABLES (Tableau + Filtres)
    // =========================================================
    
    const $table = $('#table-codes');

    // On ne lance DataTables que si le tableau existe sur la page
    if ($table.length > 0) {
        
        const table = $table.DataTable({
            // Configuration de la langue
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/fr-FR.json',
                searchPanes: {
                    title: {
                        _: 'Filtres actifs - %d',
                        0: 'Filtres (Aucun)',
                        1: '1 Filtre actif'
                    },
                    collapse: { 0: 'Filtres', _: 'Filtres (%d)' },
                    clearMessage: 'Effacer tout',
                    count: '{total}',
                    countFiltered: '{shown} ({total})'
                }
            },

            // Disposition des éléments (DOM Layout)
            // P = SearchPanes (Les filtres)
            // f = Champ de recherche global
            // r = Indicateur de chargement
            // t = Le tableau
            // i = Info (1 à 10 sur 50)
            // p = Pagination
            dom: '<"d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3"P f>rt<"d-flex justify-content-between align-items-center mt-3"ip>',
            
            // Configuration des Filtres Automatiques (SearchPanes)
            searchPanes: {
                layout: 'columns-2', // Affichage sur 2 colonnes
                initCollapsed: true, // Replié par défaut
                cascadePanes: true,  // Filtrer "Zone" met à jour les options de "Univers"
                viewTotal: true      // Affiche le nombre total (ex: Vente (12))
            },
            
            // Configuration des colonnes
            columnDefs: [
                // Désactiver le tri sur: Checkbox(0), QR(1), Actions(6)
                { orderable: false, targets: [0, 1, 6] },
                
                // Activer les filtres automatiques UNIQUEMENT sur Univers(4) et Zone(5)
                { searchPanes: { show: true }, targets: [4, 5] },
                
                // Désactiver les filtres automatiques sur les autres colonnes
                { searchPanes: { show: false }, targets: '_all' }
            ],

            // CALLBACK IMPORTANT : Appelé à chaque fois que le tableau est dessiné (page, tri, filtre)
            drawCallback: function() {
                generateQRs();  // On doit régénérer les QR codes visibles
                updateBulkUI(); // On met à jour l'état des checkboxes
            }
        });
    }


    // =========================================================
    // 3. QR CODES (Génération dynamique)
    // =========================================================
    function generateQRs() {
        if (typeof QRCode === 'undefined') return;
        
        // On sélectionne les conteneurs QR qui sont actuellement visibles dans le DOM
        $('.qr-mini').each(function() {
            const el = $(this);
            // Si le conteneur est vide (pas encore de QR généré)
            if (el.html().trim() === '') {
                const code = el.data('code');
                if (code) {
                    try {
                        new QRCode(this, { 
                            text: String(code), 
                            width: 28, 
                            height: 28, 
                            correctLevel: QRCode.CorrectLevel.L 
                        });
                    } catch(e) { 
                        console.error("Erreur génération QR", e); 
                    }
                }
            }
        });
    }


    // =========================================================
    // 4. ACTIONS DE MASSE (Checkboxes persistantes)
    // =========================================================
    let selectedIds = new Set();
    const bulkBar = $('#bulk-actions-bar');
    const countEl = $('#selected-count');

    function updateBulkUI() {
        // On parcourt les checkboxes visibles pour voir si elles doivent être cochées
        $('.item-checkbox').each(function() {
            const val = $(this).val();
            $(this).prop('checked', selectedIds.has(val));
        });
        
        // Mise à jour de la barre flottante
        countEl.text(selectedIds.size);
        if(selectedIds.size > 0) bulkBar.addClass('visible');
        else bulkBar.removeClass('visible');
    }

    // Délégation d'événement : On écoute sur le TBODY car les lignes changent avec la pagination
    $('#table-codes tbody').on('change', '.item-checkbox', function() {
        const val = $(this).val();
        if(this.checked) selectedIds.add(val);
        else selectedIds.delete(val);
        updateBulkUI();
    });

    // Bouton "Tout cocher" (Coche tout ce qui est visible sur la page actuelle)
    $('#check-all').on('change', function() {
        const isChecked = this.checked;
        $('.item-checkbox').each(function() {
            const val = $(this).val();
            $(this).prop('checked', isChecked);
            if(isChecked) selectedIds.add(val);
            else selectedIds.delete(val);
        });
        updateBulkUI();
    });

    // Bouton "Fermer / Tout désélectionner"
    $('#bulk-close').click(function() {
        selectedIds.clear();
        $('#check-all').prop('checked', false);
        updateBulkUI();
    });

    // Action Suppression (Exemple)
    $('#bulk-delete').click(function() {
        if (selectedIds.size === 0) return;
        if(confirm('Voulez-vous vraiment supprimer ' + selectedIds.size + ' éléments ?')) {
            alert("Logique de suppression à implémenter pour les IDs: " + Array.from(selectedIds).join(', '));
            // Ici: Appel AJAX ou soumission de formulaire
        }
    });


    // =========================================================
    // 5. IMPRESSION ÉTIQUETTE UNITAIRE (PDF)
    // =========================================================
    $(document).on('click', '.btn-print-single', function(e) {
        e.preventDefault();
        const btn = $(this);
        printSingleLabel(btn.data('id'), btn[0]);
    });

    async function printSingleLabel(id, btn) {
        // Vérification des librairies
        if (typeof window.jspdf === 'undefined' || typeof QRCode === 'undefined') {
            alert("Erreur : Les librairies jsPDF ou QRCode ne sont pas chargées."); return;
        }
        
        const { jsPDF } = window.jspdf;
        const oldHtml = btn.innerHTML;
        
        // Feedback chargement
        btn.disabled = true; 
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

        try {
            // 1. Récupération des données
            const res = await fetch(`index.php?action=getSingleGeoCodeJson&id=${id}`);
            const json = await res.json();
            
            if(!json.success) throw new Error(json.error || "Erreur inconnue");
            const data = json.data;

            // 2. Création du PDF (70x35mm)
            const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: [70, 35] });
            
            doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
            doc.text(String(data.code_geo), 35, 12, { align: 'center' });
            
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
            let libelle = data.libelle || '';
            // Tronquer si trop long
            if(libelle.length > 30) libelle = libelle.substring(0, 27) + '...';
            doc.text(libelle, 35, 20, { align: 'center' });

            // 3. Génération QR Code temporaire (pour l'insérer comme image)
            const tempDiv = document.createElement('div');
            // QR haute qualité pour l'impression
            new QRCode(tempDiv, { text: String(data.code_geo), width: 100, height: 100 });
            
            // Petit délai pour laisser le QR se générer
            setTimeout(() => {
                const img = tempDiv.querySelector('img');
                if(img) {
                    // Ajout image au PDF (x:2, y:2, w:14, h:14)
                    doc.addImage(img.src, 'PNG', 2, 2, 14, 14);
                }
                // Ouvrir PDF dans nouvel onglet
                doc.output('dataurlnewwindow');
                
                // Reset bouton
                btn.disabled = false; 
                btn.innerHTML = oldHtml;
            }, 100);

        } catch(e) {
            console.error(e);
            alert("Erreur impression : " + e.message);
            btn.disabled = false; 
            btn.innerHTML = oldHtml;
        }
    }

});
