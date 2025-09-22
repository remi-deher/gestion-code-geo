document.addEventListener('DOMContentLoaded', () => {
    
    const classeurSection = document.getElementById('classeur');
    if (!classeurSection) {
        return; // Stoppe le script si on n'est pas sur la bonne page
    }

    // --- Récupération des éléments du DOM ---
    const searchInput = document.getElementById('recherche');
    const viewCardBtn = document.getElementById('view-card-btn');
    const viewTableBtn = document.getElementById('view-table-btn');
    const cardView = document.getElementById('card-view');
    const tableView = document.getElementById('table-view');
    const sortBySelect = document.getElementById('sort-by');
    
    // Filtres (Desktop + Mobile Off-canvas)
    const allFilterPills = document.querySelectorAll('.filter-pill');
    const allZoneTabs = document.querySelectorAll('.zone-tab, .zone-tabs-mobile > button');
    
    // Stockage des éléments de la liste pour ne pas avoir à les relire du DOM
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

    // --- NOUVELLE FONCTION ---
    /**
     * Met à jour la visibilité des filtres "univers" en fonction de la zone sélectionnée.
     */
    function updateUniversFiltersVisibility() {
        const activeZone = document.querySelector('.zone-tab.active')?.dataset.zone || 'all';
        const universPills = document.querySelectorAll('.filter-pill[data-zone]');

        universPills.forEach(pill => {
            const pillZone = pill.dataset.zone;
            if (activeZone === 'all' || pillZone === activeZone) {
                pill.style.display = ''; // Affiche la pilule
            } else {
                pill.style.display = 'none'; // Masque la pilule
                // Si la pilule masquée était active, on la désactive
                pill.classList.remove('active');
            }
        });

        // S'assure que la pilule "Tout voir" est active si aucune autre ne l'est
        document.querySelectorAll('#filtres-univers, #filtres-univers-mobile').forEach(container => {
            const activeVisiblePills = container.querySelectorAll('.filter-pill.active[data-zone]:not([style*="display: none"])').length;
            const toutVoirPill = container.querySelector('.filter-pill[data-filter="all"]');
            if (toutVoirPill) {
                toutVoirPill.classList.toggle('active', activeVisiblePills === 0);
            }
        });
    }

    // --- LOGIQUE DES ÉVÉNEMENTS ---

    function switchView(view) {
        if (view === 'card') {
            cardView.style.display = 'flex';
            tableView.style.display = 'none';
            viewCardBtn.classList.add('active');
            viewTableBtn.classList.remove('active');
        } else {
            cardView.style.display = 'none';
            tableView.style.display = 'block';
            viewCardBtn.classList.remove('active');
            viewTableBtn.classList.add('active');
        }
    }

    function handlePillClick(e) {
        const clickedPill = e.currentTarget;
        const filterValue = clickedPill.dataset.filter;
        
        if (filterValue === 'all') {
            // Si on clique sur "Tout voir", on désactive les autres pilules de la même zone
            const activeZone = document.querySelector('.zone-tab.active')?.dataset.zone || 'all';
            document.querySelectorAll('.filter-pill[data-zone]').forEach(p => {
                 if (activeZone === 'all' || p.dataset.zone === activeZone) {
                    p.classList.remove('active');
                }
            });
            clickedPill.classList.add('active');
        } else {
            // Active ou désactive la pilule cliquée
            clickedPill.classList.toggle('active');
            // Désactive "Tout voir" si une autre pilule est active
            const container = clickedPill.closest('.filter-pills');
            if(container) container.querySelector('.filter-pill[data-filter="all"]')?.classList.remove('active');
        }

        // Synchronise l'état entre la vue desktop et mobile
        syncPillStates(filterValue, clickedPill.classList.contains('active'));
        
        applyFiltersAndSort();
    }

    function syncPillStates(filter, isActive) {
        document.querySelectorAll(`.filter-pill[data-filter="${filter}"]`).forEach(p => p.classList.toggle('active', isActive));
    }

    // --- FONCTION MISE À JOUR ---
    function handleZoneClick(e) {
        const zoneValue = e.currentTarget.dataset.zone;
        allZoneTabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll(`[data-zone="${zoneValue}"]`).forEach(t => t.classList.add('active'));
        
        // On met à jour les filtres d'univers visibles
        updateUniversFiltersVisibility();
        // On applique les filtres globaux
        applyFiltersAndSort();
    }

    // --- FONCTION PRINCIPALE DE FILTRAGE, TRI ET AFFICHAGE ---

    function applyFiltersAndSort() {
        // 1. Lire les filtres actifs
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const activeZoneEl = document.querySelector('.zone-tab.active, .zone-tabs-mobile > button.active');
        const activeZone = activeZoneEl ? activeZoneEl.dataset.zone : 'all';
        
        let activeUniversFilters = new Set(
            Array.from(document.querySelectorAll('#filtres-univers .filter-pill.active[data-zone]'))
                 .map(p => p.dataset.filter)
        );
        
        // Si "Tout voir" est actif, on considère tous les univers de la zone visible
        if (document.querySelector('#filtres-univers .filter-pill[data-filter="all"].active')) {
            activeUniversFilters = new Set(
                 Array.from(document.querySelectorAll('#filtres-univers .filter-pill[data-zone]:not([style*="display: none"])'))
                 .map(p => p.dataset.filter)
            );
        }


        // 2. Filtrer les éléments
        allGeoCards.forEach(card => {
            const searchMatch = (card.dataset.searchable || '').includes(searchTerm);
            const universMatch = activeUniversFilters.size === 0 || activeUniversFilters.has(card.dataset.univers);
            const zoneMatch = (activeZone === 'all' || card.dataset.zone === activeZone);
            card.style.display = (searchMatch && universMatch && zoneMatch) ? 'grid' : 'none';
        });

        allTableRows.forEach(row => {
            const searchMatch = (row.dataset.searchable || '').includes(searchTerm);
            const universMatch = activeUniversFilters.size === 0 || activeUniversFilters.has(row.dataset.univers);
            const zoneMatch = (activeZone === 'all' || row.dataset.zone === activeZone);
            row.style.display = (searchMatch && universMatch && zoneMatch) ? '' : 'none';
        });

        // 3. Trier les éléments qui sont actuellement visibles
        sortVisibleElements();
    }

    function sortVisibleElements() {
        const sortBy = sortBySelect.value;
        const [key] = sortBy.split('-');

        // Trier les fiches
        const visibleCards = allGeoCards.filter(card => card.style.display !== 'none');
        visibleCards.sort((a, b) => (a.dataset[key] || '').localeCompare(b.dataset[key] || ''));
        
        // Vider et reconstruire la vue fiches avec les séparateurs
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

        // Trier le tableau
        const tableBody = tableView.querySelector('tbody');
        if (tableBody) {
            const visibleRows = allTableRows.filter(row => row.style.display !== 'none');
            visibleRows.sort((a, b) => (a.dataset[key] || '').localeCompare(b.dataset[key] || ''));
            visibleRows.forEach(row => tableBody.appendChild(row));
        }
    }
    
    // --- DÉMARRAGE ---
    
    // Génère les QR Codes au chargement
    allGeoCards.forEach(card => {
        const qrContainer = card.querySelector('.geo-card-qr');
        if(qrContainer) {
            const codeText = qrContainer.dataset.code;
            if (codeText) new QRCode(qrContainer, { text: codeText, width: 90, height: 90 });
        }
    });

    // Applique les filtres une première fois au chargement pour s'assurer que tout est correct
    applyFiltersAndSort();
});
