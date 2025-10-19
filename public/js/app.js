/* public/js/app.js (Version DataTables + List.js - Avec Sélecteur de Longueur - Correction Pagination) */

window.addEventListener('load', () => {

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    const classeurSection = document.getElementById('classeur');
    if (!classeurSection) return;

    // --- Éléments du DOM ---
    const searchInput = document.getElementById('recherche');
    const viewCardBtn = document.getElementById('view-card-btn');
    const viewTableBtn = document.getElementById('view-table-btn');
    const tableView = document.getElementById('table-view');
    const cardSortControls = document.getElementById('card-sort-controls');
    const listJsElement = document.getElementById('fiches-list-js');
    const itemsPerPageSelect = document.getElementById('items-per-page');
    const pageLengthControls = document.getElementById('page-length-controls');

    const allFilterPills = document.querySelectorAll('.filter-pill');
    const allZoneTabs = document.querySelectorAll('.zone-tab, .zone-tabs-mobile > button');

    const tableElement = document.getElementById('geo-table');
    let dataTable = null;
    let cardList = null;

    /**
     * Génère les QR codes pour les conteneurs visibles et vides dans la vue fiches.
     */
    function generateVisibleQrCodes() {
        const listItems = listJsElement.querySelectorAll('.list .geo-card');
        listItems.forEach(card => {
            if (card.style.display !== 'none') {
                const qrContainer = card.querySelector('.geo-card-qr:empty');
                if (qrContainer) {
                    const codeText = qrContainer.dataset.code;
                    try {
                        if (codeText && typeof QRCode !== 'undefined') {
                            new QRCode(qrContainer, { text: codeText, width: 90, height: 90, correctLevel: QRCode.CorrectLevel.L });
                        }
                    } catch (e) {
                        console.error(`Erreur QRCode pour ${codeText}:`, e);
                        qrContainer.textContent = 'Erreur QR';
                    }
                }
            }
        });
    }

    // --- Initialisation de List.js ---
    if (listJsElement && typeof List !== 'undefined') {
        try {
            let initialPageValue = itemsPerPageSelect ? parseInt(itemsPerPageSelect.value, 10) : 15;
            if (initialPageValue === -1) {
                initialPageValue = 5000;
            }

            const options = {
                valueNames: [
                    'code_geo', 'libelle', 'univers', 'zone', 'unplaced',
                    { data: ['zone'] },
                    { data: ['univers'] }
                ],
                page: initialPageValue,
                pagination: {
                    paginationClass: "pagination", // Classe Bootstrap pour l'UL
                    // item: '<li><a class="page-link page" href="#"></a></li>', // On laisse List.js générer les items par défaut
                    activeClass: 'active' // Classe Bootstrap pour le LI actif
                    // innerWindow et outerWindow peuvent être ajoutés ici si besoin
                },
                listClass: 'list',
                searchClass: 'listjs-search'
            };
            cardList = new List('fiches-list-js', options);

            const sortBySelect = document.getElementById('sort-by');
            if (sortBySelect) {
                cardList.sort(sortBySelect.value, { order: "asc" });
                sortBySelect.addEventListener('change', (e) => cardList.sort(e.target.value, { order: "asc" }));
            } else { console.warn("Élément #sort-by non trouvé pour List.js"); }

            generateVisibleQrCodes();
            cardList.on('updated', generateVisibleQrCodes);

        } catch (e) {
            console.error("Erreur lors de l'initialisation de List.js:", e); // L'erreur apparaîtra ici
            cardList = null;
        }
    } else {
        console.error("List.js n'a pas pu être initialisé (DOM ou Librairie manquante).");
    }

    // --- Fonction pour récupérer les filtres actifs ---
    function getActiveFilters() {
        const searchTerm = (searchInput && searchInput.value) ? searchInput.value.toLowerCase().trim() : '';
        const activeZoneEl = document.querySelector('.zone-tab.active, .zone-tabs-mobile > button.active');
        const activeZone = activeZoneEl ? activeZoneEl.dataset.zone : 'all';
        const activeUniversPills = document.querySelectorAll('.filter-pill.active[data-zone]');
        const allUniversPillActive = document.querySelector('.filter-pill[data-filter="all"].active');
        const filterByUnivers = !allUniversPillActive && activeUniversPills.length > 0;
        const activeUniversFilters = new Set(Array.from(activeUniversPills).map(p => p.dataset.filter));

        return { searchTerm, activeZone, filterByUnivers, activeUniversFilters };
    }

    // --- Initialisation de DataTables ---
    if (tableElement && typeof $ !== 'undefined' && $.fn.dataTable) {
        try {
            const pageLengthOptions = [
                [15, 30, 50, -1],
                ['15', '30', '50', 'Tous']
            ];
            let initialPageLength = itemsPerPageSelect ? parseInt(itemsPerPageSelect.value, 10) : 15;

            const dataTableDom =
                "<'row'<'col-sm-12 col-md-12'P>>" +
                "<'row'<'col-sm-12 col-md-12'Q>>" +
                "<'row mb-3 align-items-center'<'col-sm-12 col-md-auto'l><'col-sm-12 col-md'B><'col-sm-12 col-md-auto'f>>" +
                "<'row'<'col-sm-12'tr>>" +
                "<'row mt-3 align-items-center'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>";

            dataTable = $(tableElement).DataTable({
                language: {
                    search: "_INPUT_",
                    searchPlaceholder: "Recherche rapide...",
                    lengthMenu: "Afficher _MENU_",
                    info: "Affichage _START_ à _END_ sur _TOTAL_ codes",
                    infoEmpty: "Aucun code à afficher",
                    infoFiltered: "(filtré sur _MAX_ au total)",
                    paginate: { first: "«", previous: "‹", next: "›", last: "»" },
                    searchBuilder: { title: 'Construction de recherche', add: 'Ajouter condition', button: 'Filtre avancé (%d)', clearAll: 'Effacer tout', condition: 'Condition', data: 'Champ', deleteTitle: 'Supprimer règle', value: 'Valeur', logicAnd: 'ET', logicOr: 'OU' },
                    searchPanes: { title: { _: 'Filtres actifs - %d', 0: 'Aucun filtre actif' }, clearMessage: 'Effacer tout', collapse: { 0: 'Filtres rapides', _: 'Filtres rapides (%d)' }, count: '{total}', countFiltered: '{shown} ({total})', emptyPanes: 'Aucun filtre', loadMessage: 'Chargement...' },
                    select: { rows: { _: '%d lignes sél.', 0: '', 1: '1 ligne sél.' } },
                    buttons: { copyTitle: 'Copié dans le presse-papier', copySuccess: { _: '%d lignes copiées', 1: '1 ligne copiée' } }
                },
                columnDefs: [
                    { orderable: false, targets: [3, 4] },
                    { searchable: false, targets: [4] },
                    { responsivePriority: 1, targets: 0 },
                    { responsivePriority: 2, targets: 1 },
                    { responsivePriority: 3, targets: 2 },
                    { responsivePriority: 4, targets: 3 },
                    { responsivePriority: 1000, targets: 4 },
                    { searchPanes: { show: true, columns: [2] } },
                    { searchPanes: { show: false }, targets: [0, 1, 3, 4] }
                ],
                order: [[ 2, "asc" ]],
                responsive: { details: { type: 'inline' } },
                fixedHeader: true,
                select: { style: 'os', selector: 'td:first-child' },
                searchBuilder: true,
                dom: dataTableDom,
                lengthMenu: pageLengthOptions,
                pageLength: initialPageLength,
                buttons: [
                    { extend: 'copyHtml5', text: '<i class="bi bi-clipboard"></i> Copier', titleAttr: 'Copier', exportOptions: { columns: ':visible:not(:last-child)' } },
                    { extend: 'excelHtml5', text: '<i class="bi bi-file-earmark-excel"></i> Excel', titleAttr: 'Exporter en Excel', exportOptions: { columns: ':visible:not(:last-child)' } },
                    { extend: 'csvHtml5', text: '<i class="bi bi-file-earmark-spreadsheet"></i> CSV', titleAttr: 'Exporter en CSV', exportOptions: { columns: ':visible:not(:last-child)' } },
                    { extend: 'pdfHtml5', text: '<i class="bi bi-file-earmark-pdf"></i> PDF', titleAttr: 'Exporter en PDF', exportOptions: { columns: ':visible:not(:last-child)' } },
                    { extend: 'print', text: '<i class="bi bi-printer"></i> Imprimer', titleAttr: 'Imprimer', exportOptions: { columns: ':visible:not(:last-child)' } }
                ]
            });

            $('.dataTables_filter').hide();
            dataTable.buttons().container().appendTo( $('.col-md:eq(1)', dataTable.table().container() ) );
            $('.dataTables_length select').val(initialPageLength).trigger('change');

        } catch (e) {
            console.error("Erreur DataTables:", e);
            dataTable = null;
        }
    } else {
        console.error("jQuery ou DataTables non initialisé.");
    }

    // --- Filtre personnalisé pour DataTables ---
    if (dataTable && $.fn.dataTable) {
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex, rowData) {
                if (!dataTable) return true;
                if (settings.nTableId !== 'geo-table') return true;

                const filters = getActiveFilters();
                const rowUnivers = rowData[2] || '';
                const placementHtml = rowData[3] || '';
                const rowNode = dataTable.row(dataIndex).node();
                const rowZone = rowNode ? rowNode.dataset.zone : '';

                let zoneMatch = false;
                if (filters.activeZone === 'all') {
                    zoneMatch = true;
                } else if (filters.activeZone === 'unplaced') {
                    zoneMatch = /aucun/i.test(placementHtml);
                } else {
                    zoneMatch = (rowZone === filters.activeZone);
                }
                if (!zoneMatch) return false;

                let universMatch = true;
                if (filters.activeZone !== 'unplaced' && filters.filterByUnivers) {
                    universMatch = filters.activeUniversFilters.has(rowUnivers);
                }

                return universMatch;
            }
        );
    } else {
         console.warn("Filtre DataTables personnalisé non enregistré.");
    }

    // --- GESTION DES ÉVÉNEMENTS ---
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            const searchTerm = searchInput.value;
            if (dataTable) {
                dataTable.search(searchTerm).draw();
            }
            if (cardList) {
                applyFiltersToListJs();
            }
        }, 300));
    } else {
        console.warn("Élément #recherche non trouvé.");
    }

    allFilterPills.forEach(pill => pill.addEventListener('click', handlePillClick));
    allZoneTabs.forEach(tab => tab.addEventListener('click', handleZoneClick));
    if (viewCardBtn && viewTableBtn) {
        viewCardBtn.addEventListener('click', () => switchView('card'));
        viewTableBtn.addEventListener('click', () => switchView('table'));
    }

    if (itemsPerPageSelect) {
        itemsPerPageSelect.addEventListener('change', (e) => {
            const newValue = parseInt(e.target.value, 10);

            if (cardList && listJsElement && listJsElement.style.display !== 'none') {
                const listJsPageValue = (newValue === -1) ? 5000 : newValue;
                cardList.page = listJsPageValue;
                cardList.update();
            }

            if (dataTable) {
                 dataTable.page.len(newValue).draw();
                 $('.dataTables_length select').val(newValue); // Synchronise le select DT
            }
        });
    }

    if(dataTable && itemsPerPageSelect) {
        $(dataTable.table().container()).on('length.dt', function (e, settings, len) {
            itemsPerPageSelect.value = len;
        });
    }

    // --- LOGIQUE DES FONCTIONS ---

    function switchView(view) {
         if (view === 'card') {
            if (listJsElement) listJsElement.style.display = 'block';
            if (tableView) tableView.classList.add('d-none');
            if (viewCardBtn) viewCardBtn.classList.add('active');
            if (viewTableBtn) viewTableBtn.classList.remove('active');
            if (cardSortControls) cardSortControls.style.display = 'flex';
            if (pageLengthControls) pageLengthControls.style.display = 'flex';

        } else {
            if (listJsElement) listJsElement.style.display = 'none';
            if (tableView) tableView.classList.remove('d-none');
            if (viewCardBtn) viewCardBtn.classList.remove('active');
            if (viewTableBtn) viewTableBtn.classList.add('active');
            if (cardSortControls) cardSortControls.style.display = 'none';
            if (pageLengthControls) pageLengthControls.style.display = 'none';

            if (dataTable) {
                 try {
                     dataTable.columns.adjust().responsive.recalc().fixedHeader.adjust();
                     if (dataTable.searchPanes && dataTable.searchPanes.rebuildPane) {
                         dataTable.searchPanes.rebuildPane(undefined, true);
                     }
                 } catch(e) { console.error("Error adjusting DataTables:", e); }
            }
        }
        applyAllFilters();
    }

    function updateUniversFiltersVisibility() {
        const activeZone = document.querySelector('.zone-tab.active, .zone-tabs-mobile > button.active')?.dataset.zone || 'all';
        let anyVisibleActive = false;

        document.querySelectorAll('.filter-pill[data-zone]').forEach(pill => {
            const pillZone = pill.dataset.zone;
            const shouldBeVisible = (activeZone === 'all' || pillZone === activeZone);
            pill.style.display = shouldBeVisible ? '' : 'none';
            if (!shouldBeVisible && pill.classList.contains('active')) {
                syncPillStates(pill.dataset.filter, false);
            }
            if (shouldBeVisible && pill.classList.contains('active')) {
                anyVisibleActive = true;
            }
        });

        syncPillStates('all', !anyVisibleActive);
    }

    function syncPillStates(filter, isActive) {
        document.querySelectorAll(`.filter-pill[data-filter="${filter}"]`).forEach(p => p.classList.toggle('active', isActive));
     }

    function handlePillClick(e) {
        const clickedPill = e.currentTarget;
        const filterValue = clickedPill.dataset.filter;

        if (filterValue === 'all') {
            syncPillStates('all', true);
            document.querySelectorAll('.filter-pill[data-zone].active:not([style*="display: none"])').forEach(p => syncPillStates(p.dataset.filter, false));
        } else {
            const newState = !clickedPill.classList.contains('active');
            syncPillStates(filterValue, newState);

            if (newState) {
                syncPillStates('all', false);
            } else {
                const anyActiveVisible = document.querySelector('.filter-pill.active[data-zone]:not([style*="display: none"])');
                if (!anyActiveVisible) {
                    syncPillStates('all', true);
                }
            }
        }
        applyAllFilters();
     }

    function handleZoneClick(e) {
        const zoneValue = e.currentTarget.dataset.zone;
        document.querySelectorAll('.zone-tab, .zone-tabs-mobile > button').forEach(t => t.classList.remove('active'));
        document.querySelectorAll(`.zone-tab[data-zone="${zoneValue}"], .zone-tabs-mobile > button[data-zone="${zoneValue}"]`).forEach(t => t.classList.add('active'));

        const showUnivers = (zoneValue !== 'unplaced');
        ['#filtres-univers', '#filtres-univers-mobile'].forEach(sel => {
            const el = document.querySelector(sel);
            if(el) el.style.display = showUnivers ? (sel.includes('mobile') ? 'flex' : 'block') : 'none';
        });

        if (showUnivers) {
            updateUniversFiltersVisibility();
        } else {
             syncPillStates('all', true);
             document.querySelectorAll('.filter-pill[data-zone].active').forEach(p => syncPillStates(p.dataset.filter, false));
        }
        applyAllFilters();

        if (e.currentTarget.closest('.offcanvas-body')) {
            const offcanvasElement = document.getElementById('filtersOffcanvas');
            const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvasElement);
            if (offcanvasInstance) {
                offcanvasInstance.hide();
            }
        }
    }

    function applyAllFilters() {
        if (cardList) {
            applyFiltersToListJs();
        }
        if (dataTable) {
            dataTable.draw();
        }
    }

    function applyFiltersToListJs() {
        if (!cardList) return;
        const filters = getActiveFilters();

        cardList.filter((item) => {
            if (item.elm.classList.contains('univers-separator')) {
                 return true;
            }

            const itemValues = item.values();
            const codeGeo = itemValues.code_geo || '';
            const libelle = itemValues.libelle || '';
            const univers = itemValues.univers || '';
            const zone = item.elm.dataset.zone || '';
            const isUnplaced = itemValues.unplaced === 'true';
            const searchableText = `${codeGeo} ${libelle} ${univers}`.toLowerCase();

            if (filters.searchTerm && !searchableText.includes(filters.searchTerm)) return false;

            if (filters.activeZone === 'unplaced') {
                if (!isUnplaced) return false;
            } else if (filters.activeZone !== 'all') {
                if (zone !== filters.activeZone) return false;
            }

            if (filters.activeZone !== 'unplaced' && filters.filterByUnivers) {
                if (!filters.activeUniversFilters.has(univers)) return false;
            }

            return true;
        });

        setTimeout(() => {
            const visibleUnivers = new Set();
            cardList.visibleItems.forEach(item => {
                if (!item.elm.classList.contains('univers-separator')) {
                    visibleUnivers.add(item.elm.dataset.univers || item.values().univers);
                }
            });
            cardList.items.forEach(item => {
                if (item.elm.classList.contains('univers-separator')) {
                    const separatorUnivers = item.values().univers;
                    item.elm.style.display = visibleUnivers.has(separatorUnivers) ? 'block' : 'none';
                }
            });
            generateVisibleQrCodes();
        }, 0);
    }

    // --- DÉMARRAGE ---
    const isTableViewHidden = tableView ? tableView.classList.contains('d-none') : true;
    const currentView = isTableViewHidden ? 'card' : 'table';
    switchView(currentView);
    updateUniversFiltersVisibility();

}); // Fin window.addEventListener('load')
