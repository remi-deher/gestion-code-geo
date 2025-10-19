/* public/js/app.js (Version DataTables + List.js - Vérifications Robustes) */

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
                // Tri initial appliqué par List.js
            } else { console.warn("Élément #sort-by non trouvé pour List.js"); }
            
            // Initialiser les QR Codes
            document.querySelectorAll('#fiches-list-js .geo-card-qr').forEach(qrContainer => { 
                 const codeText = qrContainer.dataset.code;
                 try {
                     if (codeText && typeof QRCode !== 'undefined') { new QRCode(qrContainer, { text: codeText, width: 90, height: 90 }); }
                 } catch (e) { console.error(`Erreur QRCode pour ${codeText}:`, e); }
             });
        } catch (e) {
            console.error("Erreur lors de l'initialisation de List.js:", e);
            cardList = null; // S'assurer que cardList est null en cas d'erreur
        }
    } else {
        console.error("List.js n'a pas pu être initialisé (DOM ou Librairie manquante).");
    }

    // --- Fonction pour récupérer les filtres actifs ---
    function getActiveFilters() {
        // VÉRIFICATION ROBUSTE : Utiliser des valeurs par défaut si les éléments n'existent pas
        const searchTerm = (searchInput && searchInput.value) ? searchInput.value.toLowerCase().trim() : ''; 
        const activeZoneEl = document.querySelector('.zone-tab.active, .zone-tabs-mobile > button.active');
        const activeZone = activeZoneEl ? activeZoneEl.dataset.zone : 'all';
        const activeUniversPills = document.querySelectorAll('.filter-pill.active[data-zone]');
        const allUniversPillActive = document.querySelector('.filter-pill[data-filter="all"].active');
        const filterByUnivers = !allUniversPillActive && activeUniversPills.length > 0;
        const activeUniversFilters = new Set(Array.from(activeUniversPills).map(p => p.dataset.filter));
        
        // Log pour déboguer si les filtres ne fonctionnent pas
        // console.log('Filtres Actifs:', { searchTerm, activeZone, filterByUnivers, activeUniversFilters: Array.from(activeUniversFilters) });
        
        return { searchTerm, activeZone, filterByUnivers, activeUniversFilters };
    }

    // --- Initialisation de DataTables ---
    if (tableElement && typeof $ !== 'undefined' && $.fn.dataTable) {
        try {
            dataTable = $(tableElement).DataTable({
                language: { "sZeroRecords": "Aucun élément correspondant trouvé", /* ... autres traductions ... */ },
                "columnDefs": [ { "orderable": false, "targets": [3, 4] }, { "searchable": false, "targets": [3, 4] } ],
                "order": [[ 2, "asc" ]],
                "responsive": true,
                "dom": "<'row mb-3 align-items-center'<'col-sm-12 col-md-6'B><'col-sm-12 col-md-6'f>>" + // Ajout align-items-center
                       "<'row'<'col-sm-12'tr>>" +
                       "<'row mt-3 align-items-center'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>", // Ajout align-items-center
                "buttons": [ /* ... exports ... */ ]
            });
            $('.dataTables_filter').hide(); 
        } catch (e) {
            console.error("Erreur lors de l'initialisation de DataTables:", e);
            dataTable = null; // S'assurer que dataTable est null en cas d'erreur
        }
    } else {
        console.error("ERREUR CRITIQUE : jQuery ou DataTables n'a pas pu être initialisé.");
    }

    // --- Filtre personnalisé pour DataTables ---
    if (dataTable && $.fn.dataTable) {
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                // Vérifier si dataTable existe toujours (sécurité)
                if (!dataTable) return true; 

                if (settings.nTableId !== 'geo-table') return true;
                const filters = getActiveFilters(); // Appeler la fonction ici est sûr
                const rowNode = dataTable.row(dataIndex).node(); 
                if (!rowNode) return false;

                const rowUnivers = rowNode.dataset.univers || '';
                const rowZone = rowNode.dataset.zone || '';
                const rowSearchable = (rowNode.dataset.searchable || '').toLowerCase();
                const searchMatch = rowSearchable.includes(filters.searchTerm);
                let isVisible = false;

                if (filters.activeZone === 'unplaced') {
                    const placementText = data[3] || ''; 
                    const hasPlacements = !/aucun/i.test(placementText); 
                    isVisible = searchMatch && !hasPlacements;
                } else {
                    const universMatch = !filters.filterByUnivers || filters.activeUniversFilters.has(rowUnivers);
                    const zoneMatch = (filters.activeZone === 'all' || rowZone === filters.activeZone);
                    isVisible = searchMatch && universMatch && zoneMatch;
                }
                return isVisible;
            }
        );
    } else {
         console.warn("Le filtre personnalisé DataTables n'a pas pu être enregistré car dataTable n'est pas initialisé.");
    }

    // --- GESTION DES ÉVÉNEMENTS (Filtrage) ---
    if (searchInput) { 
        searchInput.addEventListener('input', debounce(applyAllFilters, 250));
    } else {
        console.warn("Élément #recherche non trouvé.");
    }

    allFilterPills.forEach(pill => pill.addEventListener('click', handlePillClick)); // Simplifié
    allZoneTabs.forEach(tab => tab.addEventListener('click', handleZoneClick));     // Simplifié
    
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
        }
    }

    function updateUniversFiltersVisibility() { 
        const activeZone = document.querySelector('.zone-tab.active, .zone-tabs-mobile > button.active')?.dataset.zone || 'all';
        document.querySelectorAll('.filter-pill[data-zone]').forEach(pill => {
            pill.style.display = (activeZone === 'all' || pill.dataset.zone === activeZone) ? '' : 'none';
            if (pill.style.display === 'none' && pill.classList.contains('active')) {
                pill.classList.remove('active');
            }
        });
        document.querySelectorAll('#filtres-univers, #filtres-univers-mobile').forEach(container => {
            const activeVisibleSpecific = container.querySelectorAll('.filter-pill.active[data-zone]:not([style*="display: none"])').length;
            const toutVoir = container.querySelector('.filter-pill[data-filter="all"]');
            if(toutVoir) toutVoir.classList.toggle('active', activeVisibleSpecific === 0);
        });
    }

    function syncPillStates(filter, isActive) { 
        document.querySelectorAll(`.filter-pill[data-filter="${filter}"]`).forEach(p => p.classList.toggle('active', isActive));
     }

    function handlePillClick(e) { 
        const clickedPill = e.currentTarget;
        const filterValue = clickedPill.dataset.filter;
        if (filterValue === 'all') {
            syncPillStates('all', true);
            document.querySelectorAll('.filter-pill[data-zone].active').forEach(p => syncPillStates(p.dataset.filter, false));
        } else {
            const newState = !clickedPill.classList.contains('active');
            syncPillStates(filterValue, newState);
            if (newState) {
                syncPillStates('all', false);
            } else if (!document.querySelector('.filter-pill.active[data-zone]')) {
                syncPillStates('all', true);
            }
        }
        applyAllFilters(); // Appliquer après modification
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
        if (showUnivers) updateUniversFiltersVisibility();
        applyAllFilters(); // Appliquer après modification
    }

    /**
     * Fonction principale qui applique les filtres
     */
    function applyAllFilters() {
        // Appliquer aux fiches (List.js)
        if (cardList) {
            applyFiltersToListJs();
        } else {
             console.warn("Tentative d'appliquer les filtres List.js, mais cardList n'est pas initialisé.");
        }
        
        // Redessiner le tableau (DataTables)
        if (dataTable) {
            dataTable.draw(); // Déclenche le filtre personnalisé DataTables
        } else {
            console.warn("Tentative d'appliquer les filtres DataTables, mais dataTable n'est pas initialisé.");
        }
    }
    
    /**
     * Logique de filtrage pour List.js
     */
    function applyFiltersToListJs() {
        if (!cardList) return; // Sécurité
        const filters = getActiveFilters(); 

        cardList.filter((item) => {
            // Garder les séparateurs SAUF si aucun item de cet univers n'est visible
            if (item.elm.classList.contains('univers-separator')) {
                return true; 
            }
            const itemValues = item.values(); 
            const searchableText = `${itemValues.code_geo} ${itemValues.libelle} ${itemValues.univers}`.toLowerCase();
            const searchMatch = searchableText.includes(filters.searchTerm);
            if (!searchMatch) return false;

            if (filters.activeZone === 'unplaced') {
                if (itemValues.unplaced !== 'true') return false;
            } else {
                if (filters.activeZone !== 'all' && itemValues.zone !== filters.activeZone) return false;
                if (filters.filterByUnivers && !filters.activeUniversFilters.has(itemValues.univers)) return false;
            }
            return true; 
        });
        
        // Gérer la visibilité des séparateurs après filtrage
        let visibleSeparators = {};
        cardList.visibleItems.forEach(item => {
            if (!item.elm.classList.contains('univers-separator')) {
                visibleSeparators[item.values().univers] = true;
            }
        });
        cardList.items.forEach(item => {
            if (item.elm.classList.contains('univers-separator')) {
                item.elm.style.display = visibleSeparators[item.values().univers] ? 'block' : 'none';
            }
        });
    }

    // --- DÉMARRAGE ---
    // Les filtres sont appliqués par défaut par l'initialisation des librairies elles-mêmes
    
    // Afficher la vue correcte au chargement
    const isTableViewHidden = tableView ? tableView.classList.contains('d-none') : true; 
    const currentView = isTableViewHidden ? 'card' : 'table';
    switchView(currentView);

}); // Fin du 'window.addEventListener('load')'
