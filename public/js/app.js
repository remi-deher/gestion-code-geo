/* public/js/app.js (Version DataTables + List.js - Avec Extensions + Corrections) */

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

    const allFilterPills = document.querySelectorAll('.filter-pill');
    const allZoneTabs = document.querySelectorAll('.zone-tab, .zone-tabs-mobile > button');

    const tableElement = document.getElementById('geo-table');
    let dataTable = null;
    let cardList = null;

    /**
     * Génère les QR codes pour les conteneurs visibles et vides dans la vue fiches.
     */
    function generateVisibleQrCodes() {
        document.querySelectorAll('#fiches-list-js .list .geo-card-qr:empty').forEach(qrContainer => {
            const codeText = qrContainer.dataset.code;
            try {
                if (codeText && typeof QRCode !== 'undefined') {
                    if (qrContainer.innerHTML === '') {
                        new QRCode(qrContainer, { text: codeText, width: 90, height: 90 });
                    }
                }
            } catch (e) {
                console.error(`Erreur QRCode pour ${codeText}:`, e);
            }
        });
    }

    // --- Initialisation de List.js ---
    if (listJsElement && typeof List !== 'undefined') {
        try {
            const options = {
                valueNames: [ 'code_geo', 'libelle', 'univers', 'zone', 'unplaced' ],
                page: 15,
                pagination: { paginationClass: "pagination", item: '<li class="page-item"><a class="page-link" href="#"></a></li>', activeClass: 'active' },
                listClass: 'list'
            };
            cardList = new List('fiches-list-js', options);

            const sortBySelect = document.getElementById('sort-by');
            if (sortBySelect) {
                sortBySelect.addEventListener('change', (e) => cardList.sort(e.target.value, { order: "asc" }));
            } else { console.warn("Élément #sort-by non trouvé pour List.js"); }

            generateVisibleQrCodes();
            cardList.on('updated', generateVisibleQrCodes);

        } catch (e) {
            console.error("Erreur lors de l'initialisation de List.js:", e);
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
            // Documentation DOM: https://datatables.net/reference/option/dom
            // P: SearchPanes, Q: SearchBuilder, B: Buttons, l: length, f: filtering, r: processing, t: table, i: info, p: pagination
            const dataTableDom =
                "<'row'<'col-sm-12 col-md-12'P>>" + // SearchPanes on top row
                "<'row'<'col-sm-12 col-md-12'Q>>" + // SearchBuilder below SearchPanes
                "<'row mb-3 align-items-center'<'col-sm-12 col-md-6'B><'col-sm-12 col-md-6'f>>" + // Buttons and default filtering input
                "<'row'<'col-sm-12'tr>>" + // The table itself
                "<'row mt-3 align-items-center'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>"; // Info and pagination

            dataTable = $(tableElement).DataTable({
                language: { /* ... Vos traductions ... */
                    searchBuilder: { title: 'Construction de recherche', add: 'Ajouter condition', button: 'Filtre avancé (%d)', clearAll: 'Effacer tout', condition: 'Condition', data: 'Champ', deleteTitle: 'Supprimer règle', value: 'Valeur', logicAnd: 'ET', logicOr: 'OU' },
                    searchPanes: { title: { _: 'Filtres actifs - %d', 0: 'Aucun filtre actif' }, clearMessage: 'Effacer tout', collapse: { 0: 'Filtres rapides', _: 'Filtres rapides (%d)' }, count: '{total}', countFiltered: '{shown} ({total})', emptyPanes: 'Aucun panneau de filtre disponible', loadMessage: 'Chargement...' },
                    select: { rows: { _: '%d lignes sélectionnées', 0: '', 1: '1 ligne sélectionnée' } }
                },
                columnDefs: [
                    { orderable: false, targets: [3, 4] }, // Placements, Actions
                    { searchable: false, targets: [4] }, // Actions
                    // Configurer SearchPanes pour la colonne Univers (index 2)
                    { searchPanes: { show: true }, targets: [2] },
                    { searchPanes: { show: false }, targets: [0, 1, 3, 4] } // Cacher pour les autres
                ],
                order: [[ 2, "asc" ]], // Tri par défaut sur Univers
                responsive: true,
                fixedHeader: true, // Activer FixedHeader
                select: true,      // Activer Select
                searchBuilder: true,// Activer SearchBuilder
                // searchPanes: true, // On l'active via le DOM
                dom: dataTableDom,
                buttons: [ /* ... Vos boutons d'export ... */
                    'copyHtml5', 'excelHtml5', 'csvHtml5', 'pdfHtml5', 'print'
                ]
            });

            // Masquer la barre de recherche globale par défaut (on utilise SearchBuilder/SearchPanes)
            $('.dataTables_filter').hide();

            // S'assurer que les boutons et autres éléments s'affichent correctement
            dataTable.buttons().container().appendTo( $('.col-md-6:eq(0)', dataTable.table().container() ) );


        } catch (e) {
            console.error("Erreur lors de l'initialisation de DataTables:", e);
            dataTable = null;
        }
    } else {
        console.error("ERREUR CRITIQUE : jQuery ou DataTables n'a pas pu être initialisé.");
    }

    // --- Filtre personnalisé pour DataTables (ajusté pour SearchBuilder/Panes) ---
    // Note: SearchBuilder et SearchPanes gèrent leur propre filtrage.
    // Ce filtre personnalisé est toujours utile pour notre logique de zone et univers via les pilules/onglets.
    if (dataTable && $.fn.dataTable) {
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex, rowData, counter) { // ajout rowData et counter
                if (!dataTable) return true;
                if (settings.nTableId !== 'geo-table') return true;

                const filters = getActiveFilters();
                const rowNode = dataTable.row(dataIndex).node();
                if (!rowNode) return false;

                const rowUnivers = rowNode.dataset.univers || '';
                const rowZone = rowNode.dataset.zone || '';
                // Note: La recherche texte (filters.searchTerm) est maintenant gérée par DataTables/SearchBuilder/SearchPanes
                // On pourrait la réintégrer si besoin, mais attention aux conflits

                // 1. Filtre Zone (via onglets)
                let zoneMatch = false;
                if (filters.activeZone === 'all') {
                    zoneMatch = true;
                } else if (filters.activeZone === 'unplaced') {
                    // Vérifie le contenu HTML de la colonne "Placements" (index 3) dans la ligne originale (rowData)
                    const placementHtml = rowData[3] || '';
                    zoneMatch = /aucun/i.test(placementHtml);
                } else {
                    zoneMatch = (rowZone === filters.activeZone);
                }
                if (!zoneMatch) return false;

                // 2. Filtre Univers (via pilules), seulement si pas 'unplaced'
                let universMatch = true;
                if (filters.activeZone !== 'unplaced' && filters.filterByUnivers) {
                    universMatch = filters.activeUniversFilters.has(rowUnivers);
                }

                // Si toutes les conditions personnalisées sont ok, on retourne true
                // Les filtres SearchBuilder/SearchPanes s'appliqueront en plus par DataTables
                return universMatch;
            }
        );
    } else {
         console.warn("Le filtre personnalisé DataTables n'a pas pu être enregistré car dataTable n'est pas initialisé.");
    }

    // --- GESTION DES ÉVÉNEMENTS (Filtrage) ---
    // La recherche globale est maintenant gérée par DataTables, mais on peut la lier à notre input si besoin
    if (searchInput && dataTable) {
        searchInput.addEventListener('input', debounce(() => {
            // Appliquer le terme de recherche global de DataTables
            dataTable.search(searchInput.value).draw();
            // Appliquer aussi les filtres List.js (car DataTables ne filtre que son tableau)
            if(cardList) { applyFiltersToListJs(); }
        }, 300));
    } else if (!searchInput) {
        console.warn("Élément #recherche non trouvé.");
    }

    allFilterPills.forEach(pill => pill.addEventListener('click', handlePillClick));
    allZoneTabs.forEach(tab => tab.addEventListener('click', handleZoneClick));

    // Événements pour changer de vue
    if (viewCardBtn && viewTableBtn) {
        viewCardBtn.addEventListener('click', () => switchView('card'));
        viewTableBtn.addEventListener('click', () => switchView('table'));
    }

    // --- LOGIQUE DES FONCTIONS ---

    function switchView(view) {
         if (view === 'card') {
            if (listJsElement) listJsElement.style.display = 'block';
            if (tableView) tableView.classList.add('d-none');
            if (viewCardBtn) viewCardBtn.classList.add('active');
            if (viewTableBtn) viewTableBtn.classList.remove('active');
            if (cardSortControls) cardSortControls.style.display = 'flex';
        } else { // view === 'table'
            if (listJsElement) listJsElement.style.display = 'none';
            if (tableView) tableView.classList.remove('d-none');
            if (viewCardBtn) viewCardBtn.classList.remove('active');
            if (viewTableBtn) viewTableBtn.classList.add('active');
            if (cardSortControls) cardSortControls.style.display = 'none';

            // Recalculer dimensions pour DataTables et ses extensions
            if (dataTable) {
                 try {
                     dataTable.columns.adjust(); // Ajuste largeur colonnes
                     if (typeof dataTable.responsive === 'object' && typeof dataTable.responsive.recalc === 'function') {
                         dataTable.responsive.recalc(); // Recalcule responsivité
                     }
                     if (typeof dataTable.fixedHeader === 'object' && typeof dataTable.fixedHeader.adjust === 'function') {
                         dataTable.fixedHeader.adjust(); // Ajuste FixedHeader
                     }
                      // Recalculer SearchPanes si nécessaire (peut être gourmand)
                     // if (typeof dataTable.searchPanes === 'object' && typeof dataTable.searchPanes.rebuildPane === 'function') {
                     //    dataTable.searchPanes.rebuildPane();
                     // }
                 } catch(e) {
                     console.error("Error during DataTables adjustments:", e);
                 }
            }
        }
        applyAllFilters();
    }


    function updateUniversFiltersVisibility() {
        const activeZone = document.querySelector('.zone-tab.active, .zone-tabs-mobile > button.active')?.dataset.zone || 'all';
        document.querySelectorAll('.filter-pill[data-zone]').forEach(pill => {
            const pillZone = pill.dataset.zone;
            pill.style.display = (activeZone === 'all' || pillZone === activeZone) ? '' : 'none';
            if (pill.style.display === 'none' && pill.classList.contains('active')) {
                syncPillStates(pill.dataset.filter, false);
            }
        });
        const anyVisibleActive = document.querySelector('.filter-pill.active[data-zone]:not([style*="display: none"])');
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
                const anyActive = document.querySelector('.filter-pill.active[data-zone]:not([style*="display: none"])');
                if (!anyActive) {
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
        }
        applyAllFilters();
    }

    /**
     * Fonction principale qui applique les filtres personnalisés.
     */
    function applyAllFilters() {
        // Appliquer aux fiches (List.js)
        if (cardList) {
            applyFiltersToListJs();
        } else {
             console.warn("Tentative d'appliquer les filtres List.js, mais cardList n'est pas initialisé.");
        }
        // Redessiner le tableau (DataTables) - Ceci déclenche le filtre personnalisé $.fn.dataTable.ext.search
        if (dataTable) {
            dataTable.draw();
        } else {
            console.warn("Tentative d'appliquer les filtres DataTables, mais dataTable n'est pas initialisé.");
        }
    }

    /**
     * Logique de filtrage spécifique pour List.js.
     */
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
            const zone = itemValues.zone || '';
            const isUnplaced = itemValues.unplaced === 'true';

            const searchableText = `${codeGeo} ${libelle} ${univers}`.toLowerCase();

            // 1. Filtre recherche (via notre input custom)
            const searchMatch = searchableText.includes(filters.searchTerm);
            if (!searchMatch) return false;

            // 2. Filtre zone
            if (filters.activeZone === 'unplaced') {
                if (!isUnplaced) return false;
            } else if (filters.activeZone !== 'all') {
                if (zone !== filters.activeZone) return false;
            }

            // 3. Filtre univers (si pas 'unplaced')
            if (filters.activeZone !== 'unplaced' && filters.filterByUnivers) {
                if (!filters.activeUniversFilters.has(univers)) return false;
            }

            return true;
        });

        // Gérer visibilité des séparateurs après filtrage
        const visibleUnivers = new Set();
        cardList.visibleItems.forEach(item => {
            if (!item.elm.classList.contains('univers-separator')) {
                visibleUnivers.add(item.values().univers);
            }
        });
        cardList.items.forEach(item => {
            if (item.elm.classList.contains('univers-separator')) {
                const separatorUnivers = item.values().univers;
                item.elm.style.display = visibleUnivers.has(separatorUnivers) ? 'block' : 'none';
            }
        });
    }

    // --- DÉMARRAGE ---
    const isTableViewHidden = tableView ? tableView.classList.contains('d-none') : true;
    const currentView = isTableViewHidden ? 'card' : 'table';
    switchView(currentView);
    updateUniversFiltersVisibility();

}); // Fin window.addEventListener('load')
