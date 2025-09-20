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
        const isActivating = !clickedPill.classList.contains('active');

        // Gère la logique de la pilule "Tout voir"
        if (filterValue === 'all') {
            allFilterPills.forEach(p => p.classList.toggle('active', isActivating));
        } else {
            // Synchronise la pilule cliquée sur les deux vues (desktop et mobile)
            document.querySelectorAll(`.filter-pill[data-filter="${filterValue}"]`).forEach(p => p.classList.toggle('active'));
            
            // Met à jour l'état de la pilule "Tout voir"
            const activePillsCount = document.querySelectorAll('#filtres-univers .filter-pill.active:not([data-filter="all"])').length;
            const allPillCount = document.querySelectorAll('#filtres-univers .filter-pill:not([data-filter="all"])').length;
            document.querySelectorAll('.filter-pill[data-filter="all"]').forEach(p => p.classList.toggle('active', activePillsCount === allPillCount));
        }
        applyFiltersAndSort();
    }

    function handleZoneClick(e) {
        const zoneValue = e.currentTarget.dataset.zone;
        allZoneTabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll(`[data-zone="${zoneValue}"]`).forEach(t => t.classList.add('active'));
        applyFiltersAndSort();
    }

    // --- FONCTION PRINCIPALE DE FILTRAGE, TRI ET AFFICHAGE ---

    function applyFiltersAndSort() {
        // 1. Lire les filtres actifs
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const activeZoneEl = document.querySelector('.zone-tab.active, .zone-tabs-mobile > button.active');
        const activeZone = activeZoneEl ? activeZoneEl.dataset.zone : 'all';
        const activeUniversFilters = new Set(
            Array.from(document.querySelectorAll('#filtres-univers .filter-pill.active:not([data-filter="all"])'))
                 .map(p => p.dataset.filter)
        );
        // Si "Tout voir" est actif, on ajoute tous les univers
        if (document.querySelector('.filter-pill[data-filter="all"].active')) {
            allGeoCards.forEach(card => activeUniversFilters.add(card.dataset.univers));
        }

        // 2. Filtrer les éléments
        allGeoCards.forEach(card => {
            const searchMatch = (card.dataset.searchable || '').includes(searchTerm);
            const universMatch = activeUniversFilters.has(card.dataset.univers);
            const zoneMatch = (activeZone === 'all' || card.dataset.zone === activeZone);
            card.style.display = (searchMatch && universMatch && zoneMatch) ? 'grid' : 'none';
        });

        allTableRows.forEach(row => {
            const searchMatch = (row.dataset.searchable || '').includes(searchTerm);
            const universMatch = activeUniversFilters.has(row.dataset.univers);
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
