document.addEventListener('DOMContentLoaded', () => {
    
    const classeurSection = document.getElementById('classeur');
    if (!classeurSection) {
        return; 
    }

    // --- Récupération des éléments du DOM ---
    const searchInput = document.getElementById('recherche');
    const viewCardBtn = document.getElementById('view-card-btn');
    const viewTableBtn = document.getElementById('view-table-btn');
    const cardView = document.getElementById('card-view');
    const tableView = document.getElementById('table-view');
    const sortBySelect = document.getElementById('sort-by');
    
    const allFilterPills = document.querySelectorAll('.filter-pill');
    const allZoneTabs = document.querySelectorAll('.zone-tab, .zone-tabs-mobile > button');
    
    const allGeoCards = Array.from(cardView.querySelectorAll('.geo-card'));
    const allTableRows = Array.from(tableView.querySelectorAll('tbody tr'));
    
    // --- GESTION DES ÉVÉNEMENTS ---

    if (viewCardBtn && viewTableBtn) {
        viewCardBtn.addEventListener('click', () => switchView('card'));
        viewTableBtn.addEventListener('click', () => switchView('table'));
    }

    if (searchInput) searchInput.addEventListener('input', applyFiltersAndSort);
    if (sortBySelect) sortBySelect.addEventListener('change', applyFiltersAndSort);
    
    allFilterPills.forEach(pill => pill.addEventListener('click', handlePillClick));
    allZoneTabs.forEach(tab => tab.addEventListener('click', handleZoneClick));

    // --- LOGIQUE DES FONCTIONS ---

    function switchView(view) {
        if (view === 'card') {
            cardView.classList.remove('d-none');
            tableView.classList.add('d-none');
            viewCardBtn.classList.add('active');
            viewTableBtn.classList.remove('active');
        } else { // view === 'table'
            cardView.classList.add('d-none');
            tableView.classList.remove('d-none');
            viewCardBtn.classList.remove('active');
            viewTableBtn.classList.add('active');
        }
    }
    
    function updateUniversFiltersVisibility() {
        const activeZone = document.querySelector('.zone-tab.active')?.dataset.zone || 'all';
        const universPills = document.querySelectorAll('.filter-pill[data-zone]');

        universPills.forEach(pill => {
            const pillZone = pill.dataset.zone;
            if (activeZone === 'all' || pillZone === activeZone) {
                pill.style.display = '';
            } else {
                pill.style.display = 'none';
                pill.classList.remove('active');
            }
        });

        document.querySelectorAll('#filtres-univers, #filtres-univers-mobile').forEach(container => {
            const activeVisiblePills = container.querySelectorAll('.filter-pill.active[data-zone]:not([style*="display: none"])').length;
            const toutVoirPill = container.querySelector('.filter-pill[data-filter="all"]');
            if (toutVoirPill) {
                toutVoirPill.classList.toggle('active', activeVisiblePills === 0);
            }
        });
    }

    function handlePillClick(e) {
        const clickedPill = e.currentTarget;
        const filterValue = clickedPill.dataset.filter;
        
        if (filterValue === 'all') {
            const activeZone = document.querySelector('.zone-tab.active')?.dataset.zone || 'all';
            document.querySelectorAll('.filter-pill[data-zone]').forEach(p => {
                 if (activeZone === 'all' || p.dataset.zone === activeZone) {
                    p.classList.remove('active');
                }
            });
            clickedPill.classList.add('active');
        } else {
            clickedPill.classList.toggle('active');
            const container = clickedPill.closest('.filter-pills');
            if(container) container.querySelector('.filter-pill[data-filter="all"]')?.classList.remove('active');
        }

        syncPillStates(filterValue, clickedPill.classList.contains('active'));
        applyFiltersAndSort();
    }

    function syncPillStates(filter, isActive) {
        document.querySelectorAll(`.filter-pill[data-filter="${filter}"]`).forEach(p => p.classList.toggle('active', isActive));
    }

    function handleZoneClick(e) {
        const zoneValue = e.currentTarget.dataset.zone;
        allZoneTabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll(`[data-zone="${zoneValue}"]`).forEach(t => t.classList.add('active'));
        
        const universFiltersDesktop = document.querySelector('#filtres-univers');
        const universFiltersMobile = document.querySelector('#filtres-univers-mobile');
    
        if (zoneValue === 'unplaced') {
            if (universFiltersDesktop) universFiltersDesktop.style.display = 'none';
            if (universFiltersMobile) universFiltersMobile.style.display = 'none';
        } else {
            if (universFiltersDesktop) universFiltersDesktop.style.display = 'block';
            if (universFiltersMobile) universFiltersMobile.style.display = 'flex';
            updateUniversFiltersVisibility();
        }
        
        applyFiltersAndSort();
    }
    
    function applyFiltersAndSort() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const activeZoneEl = document.querySelector('.zone-tab.active, .zone-tabs-mobile > button.active');
        const activeZone = activeZoneEl ? activeZoneEl.dataset.zone : 'all';
        
        let activeUniversFilters = new Set(
            Array.from(document.querySelectorAll('#filtres-univers .filter-pill.active[data-zone]'))
                 .map(p => p.dataset.filter)
        );
        
        const allUniversPillActive = document.querySelector('#filtres-univers .filter-pill[data-filter="all"].active');
        if (allUniversPillActive) {
            activeUniversFilters.clear();
        }

        allGeoCards.forEach(card => {
            const searchMatch = (card.dataset.searchable || '').includes(searchTerm);
            let isVisible = false;

            if (activeZone === 'unplaced') {
                const hasPlacements = card.querySelector('.info-placements') !== null;
                isVisible = searchMatch && !hasPlacements;
            } else {
                const universMatch = activeUniversFilters.size === 0 || activeUniversFilters.has(card.dataset.univers);
                const zoneMatch = (activeZone === 'all' || card.dataset.zone === activeZone);
                isVisible = searchMatch && universMatch && zoneMatch;
            }
            card.style.display = isVisible ? 'grid' : 'none';
        });

        allTableRows.forEach(row => {
            const searchMatch = (row.dataset.searchable || '').includes(searchTerm);
            let isVisible = false;

            if (activeZone === 'unplaced') {
                const placementCell = row.querySelector('td[data-label="Placements"]');
                const hasPlacements = placementCell && placementCell.textContent.trim() !== 'Aucun';
                isVisible = searchMatch && !hasPlacements;
            } else {
                const universMatch = activeUniversFilters.size === 0 || activeUniversFilters.has(row.dataset.univers);
                const zoneMatch = (activeZone === 'all' || row.dataset.zone === activeZone);
                isVisible = searchMatch && universMatch && zoneMatch;
            }
            row.style.display = isVisible ? '' : 'none';
        });

        sortVisibleElements();
    }

    function sortVisibleElements() {
        if (!sortBySelect) return;
        const sortBy = sortBySelect.value;
        const [key] = sortBy.split('-');

        const visibleCards = allGeoCards.filter(card => card.style.display !== 'none');
        visibleCards.sort((a, b) => (a.dataset[key] || '').localeCompare(b.dataset[key] || ''));
        
        cardView.innerHTML = '';
        let lastUnivers = null;
        visibleCards.forEach(card => {
            const currentUnivers = card.dataset.univers;
            if (sortBy === 'univers-asc' && currentUnivers !== lastUnivers) {
                const separator = document.createElement('h3');
                separator.className = 'univers-separator';
                separator.textContent = currentUnivers;
                cardView.appendChild(separator);
                lastUnivers = currentUnivers;
            }
            cardView.appendChild(card);
        });

        const tableBody = tableView.querySelector('tbody');
        if (tableBody) {
            const visibleRows = allTableRows.filter(row => row.style.display !== 'none');
            visibleRows.sort((a, b) => (a.dataset[key] || '').localeCompare(b.dataset[key] || ''));
            visibleRows.forEach(row => tableBody.appendChild(row));
        }
    }
    
    // --- DÉMARRAGE ---
    
    allGeoCards.forEach(card => {
        const qrContainer = card.querySelector('.geo-card-qr');
        if(qrContainer) {
            const codeText = qrContainer.dataset.code;
            if (codeText) new QRCode(qrContainer, { text: codeText, width: 90, height: 90 });
        }
    });

    applyFiltersAndSort();
});
