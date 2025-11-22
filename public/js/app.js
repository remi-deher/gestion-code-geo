$(document).ready(function() {

    // --- 0. SÉCURITÉ ---
    if (!$.fn.DataTable) {
        console.error("❌ ERREUR : DataTables non chargé.");
        return;
    }

    // --- 1. TOASTS ---
    [].slice.call(document.querySelectorAll('.toast')).map(t => new bootstrap.Toast(t).show());

    // =========================================================
    // 2. DATATABLES INIT
    // =========================================================
    const $tableEl = $('#table-codes');
    let table = null;

    if ($tableEl.length > 0) {
        table = $tableEl.DataTable({
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/fr-FR.json',
                searchPanes: {
                    title: { _: 'Filtres actifs - %d', 0: 'Filtres', 1: '1 Filtre' },
                    collapse: { 0: 'Filtres', _: 'Filtres (%d)' }
                }
            },
            stateSave: true, // CONSERVE LE CONTEXTE (page, tri, recherche) au reload !
            dom: '<"d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3"P f>rt<"d-flex justify-content-between align-items-center mt-3"ip>',
            searchPanes: { layout: 'columns-2', initCollapsed: true, cascadePanes: true, viewTotal: true },
            columnDefs: [
                { orderable: false, targets: [0, 1, 6] },
                { searchPanes: { show: true }, targets: [4, 5] },
                { searchPanes: { show: false }, targets: '_all' }
            ],
            drawCallback: function() {
                generateQRs(); 
                updateBulkUI();
            }
        });
    }

    // =========================================================
    // 3. ÉDITION RAPIDE (MODALE)
    // =========================================================
    const editModal = new bootstrap.Modal(document.getElementById('editModal'));
    
    // A. Ouvrir la modale et charger les données
    $(document).on('click', '.btn-edit-modal', async function(e) {
        e.preventDefault();
        const id = $(this).data('id');
        const btn = $(this);
        const originalIcon = btn.html();
        
        // Petit feedback visuel
        btn.html('<span class="spinner-border spinner-border-sm" style="width:1rem;height:1rem;"></span>');

        try {
            // On utilise l'action existante qui renvoie le JSON
            const res = await fetch(`index.php?action=getSingleGeoCodeJson&id=${id}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.error);

            const data = json.data;

            // Remplissage du formulaire
            $('#edit_id').val(data.id);
            $('#edit_code_geo').val(data.code_geo);
            $('#edit_libelle').val(data.libelle);
            $('#edit_univers_id').val(data.univers_id);
            $('#edit_zone').val(data.zone);

            editModal.show();

        } catch(error) {
            alert("Erreur lors du chargement : " + error.message);
        } finally {
            btn.html(originalIcon);
        }
    });

    // B. Sauvegarder les modifications
    $('#btn-save-edit').click(async function() {
        const btn = $(this);
        const spinner = btn.find('.spinner-border');
        
        // Validation basique
        const form = document.getElementById('form-edit-geocode');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // UI Loading
        btn.prop('disabled', true);
        spinner.removeClass('d-none');

        try {
            const formData = new FormData(form);
            
            // Envoi vers le contrôleur Update
            // Note : Il faut s'assurer que votre GeoCodeController gère 'update' en POST
            // Si votre contrôleur redirige après update, fetch le suivra, ce n'est pas grave.
            const res = await fetch('index.php?action=update', {
                method: 'POST',
                body: formData
            });

            // On considère que si le statut est 200, c'est bon (même si c'est une redirection HTML)
            if (res.ok) {
                // --- MISE À JOUR DU TABLEAU SANS RELOAD ---
                const id = formData.get('id');
                const row = $('#row-' + id);
                
                // Mise à jour visuelle des cellules
                row.find('.code-cell').text(formData.get('code_geo'));
                row.find('.libelle-cell').text(formData.get('libelle'));
                row.find('.zone-cell span').text(formData.get('zone'));
                
                // Pour l'univers, c'est un peu plus complexe (texte + couleur)
                const selectUni = document.getElementById('edit_univers_id');
                const selectedOption = selectUni.options[selectUni.selectedIndex];
                const uniName = selectedOption.text.trim();
                const uniColor = selectedOption.getAttribute('data-color');
                
                // HTML du badge univers
                const badgeHtml = `
                    <span class="badge rounded-pill border text-dark fw-normal bg-light">
                        <span class="d-inline-block rounded-circle me-1" style="width:8px; height:8px; background-color:${uniColor}"></span>
                        ${uniName}
                    </span>
                `;
                
                // Mise à jour Cellule Univers + Attributs DataTables pour le tri/filtre
                const cellUni = row.find('.univers-cell');
                cellUni.html(badgeHtml);
                cellUni.attr('data-order', uniName);
                cellUni.attr('data-search', uniName);
                
                // IMPORTANT : Invalider les données DataTables pour que le tri/filtre marche avec les nouvelles valeurs
                if(table) {
                    table.row(row).invalidate().draw(false); // false = on reste sur la même page
                    generateQRs(); // Regénérer le QR si le code a changé
                }

                editModal.hide();
                // Petit feedback visuel (Flash vert sur la ligne)
                row.addClass('table-success');
                setTimeout(() => row.removeClass('table-success'), 1500);
            
            } else {
                throw new Error("Erreur serveur lors de la sauvegarde.");
            }

        } catch(error) {
            console.error(error);
            alert("Erreur : " + error.message);
        } finally {
            btn.prop('disabled', false);
            spinner.addClass('d-none');
        }
    });


    // =========================================================
    // 4. QR CODES
    // =========================================================
    function generateQRs() {
        if (typeof QRCode === 'undefined') return;
        $('.qr-mini').each(function() {
            const el = $(this);
            if (el.html().trim() === '') { // Générer seulement si vide
                // On prend la valeur directement depuis la cellule voisine qui est à jour
                const row = el.closest('tr');
                const currentCode = row.find('.code-cell').text().trim();
                
                if (currentCode) {
                    try {
                        el.empty(); // Vider au cas où
                        new QRCode(this, { 
                            text: currentCode, 
                            width: 28, height: 28, 
                            correctLevel: QRCode.CorrectLevel.L 
                        });
                    } catch(e) {}
                }
            }
        });
    }

    // =========================================================
    // 5. ACTIONS DE MASSE & CHECKBOXES
    // =========================================================
    let selectedIds = new Set();
    const bulkBar = $('#bulk-actions-bar');
    const countEl = $('#selected-count');

    function updateBulkUI() {
        $('.item-checkbox').each(function() {
            $(this).prop('checked', selectedIds.has($(this).val()));
        });
        countEl.text(selectedIds.size);
        selectedIds.size > 0 ? bulkBar.addClass('visible') : bulkBar.removeClass('visible');
    }

    $('#table-codes tbody').on('change', '.item-checkbox', function() {
        const val = $(this).val();
        this.checked ? selectedIds.add(val) : selectedIds.delete(val);
        updateBulkUI();
    });

    $('#check-all').on('change', function() {
        const isChecked = this.checked;
        $('.item-checkbox').each(function() {
            const val = $(this).val();
            $(this).prop('checked', isChecked);
            isChecked ? selectedIds.add(val) : selectedIds.delete(val);
        });
        updateBulkUI();
    });

    $('#bulk-close').click(() => {
        selectedIds.clear();
        $('#check-all').prop('checked', false);
        updateBulkUI();
    });

    $('#bulk-delete').click(() => {
        if(selectedIds.size > 0 && confirm('Supprimer ' + selectedIds.size + ' éléments ?')) {
            alert("Simulation suppression : " + Array.from(selectedIds).join(', '));
        }
    });

    // =========================================================
    // 6. IMPRESSION UNITAIRE
    // =========================================================
    $(document).on('click', '.btn-print-single', function(e) {
        e.preventDefault();
        const btn = $(this);
        printSingleLabel(btn.data('id'), btn[0]);
    });

    async function printSingleLabel(id, btn) {
        if (typeof window.jspdf === 'undefined') { alert("Libs manquantes"); return; }
        const { jsPDF } = window.jspdf;
        const oldHtml = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '...';

        try {
            const res = await fetch(`index.php?action=getSingleGeoCodeJson&id=${id}`);
            const json = await res.json();
            if(!json.success) throw new Error(json.error);
            const data = json.data;

            const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: [70, 35] });
            doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
            doc.text(String(data.code_geo), 35, 12, { align: 'center' });
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
            let lib = data.libelle || '';
            if(lib.length > 30) lib = lib.substring(0, 27) + '...';
            doc.text(lib, 35, 20, { align: 'center' });

            const div = document.createElement('div');
            new QRCode(div, { text: String(data.code_geo), width: 100, height: 100 });
            setTimeout(() => {
                const img = div.querySelector('img');
                if(img) doc.addImage(img.src, 'PNG', 2, 2, 14, 14);
                doc.output('dataurlnewwindow');
                btn.disabled = false; btn.innerHTML = oldHtml;
            }, 100);
        } catch(e) {
            console.error(e);
            btn.disabled = false; btn.innerHTML = oldHtml;
        }
    }
});
