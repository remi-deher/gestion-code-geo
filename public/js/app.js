document.addEventListener('DOMContentLoaded', () => {
    
    const classeurSection = document.getElementById('classeur');
    if (classeurSection) {

        // --- Récupération des éléments du DOM ---
        const searchInput = document.getElementById('recherche');
        const zoneTabs = document.querySelectorAll('.zone-tab');
        const viewCardBtn = document.getElementById('view-card-btn');
        const viewTableBtn = document.getElementById('view-table-btn');
        const cardView = document.getElementById('card-view');
        const tableView = document.getElementById('table-view');
        const sortBySelect = document.getElementById('sort-by');
        const tableHeaders = document.querySelectorAll('.geo-table th[data-sort]');

        // Génération des QR Codes
        if (cardView) {
            cardView.querySelectorAll('.geo-card-qr').forEach(container => {
                const codeText = container.dataset.code;
                if (codeText) {
                    new QRCode(container, { text: codeText, width: 90, height: 90 });
                }
            });
        }
        
        // --- GESTION DU CHANGEMENT DE VUE ---
        if (viewCardBtn && viewTableBtn && cardView && tableView) {
            viewCardBtn.addEventListener('click', () => {
                cardView.style.display = 'flex';
                tableView.style.display = 'none';
                viewCardBtn.classList.add('active');
                viewTableBtn.classList.remove('active');
                sortBySelect.parentElement.style.display = 'flex';
            });
            viewTableBtn.addEventListener('click', () => {
                cardView.style.display = 'none';
                tableView.style.display = 'block';
                viewCardBtn.classList.remove('active');
                viewTableBtn.classList.add('active');
                sortBySelect.parentElement.style.display = 'none';
            });
        }

        // --- NOUVELLE LOGIQUE DE FILTRAGE (PILULES) ---
        const filterPills = document.querySelectorAll('#filtres-univers .filter-pill');
        let activeUniversFilters = new Set();

        // Initialisation : tous les univers sont actifs au début
        filterPills.forEach(pill => {
            if (pill.dataset.filter !== 'all') {
                activeUniversFilters.add(pill.dataset.filter);
            }
        });

        filterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                const filterValue = pill.dataset.filter;
                const allPill = document.querySelector('.filter-pill[data-filter="all"]');
                
                if (filterValue === 'all') {
                    // Si on clique sur "Tout voir", on active ou désactive tout
                    const shouldActivate = !allPill.classList.contains('active');
                    activeUniversFilters.clear();
                    filterPills.forEach(p => {
                        p.classList.toggle('active', shouldActivate);
                        if (shouldActivate && p.dataset.filter !== 'all') {
                            activeUniversFilters.add(p.dataset.filter);
                        }
                    });
                } else {
                    // Si on clique sur un autre filtre
                    pill.classList.toggle('active');
                    if (activeUniversFilters.has(filterValue)) {
                        activeUniversFilters.delete(filterValue);
                    } else {
                        activeUniversFilters.add(filterValue);
                    }
                    // Mettre à jour l'état de "Tout voir"
                    allPill.classList.toggle('active', activeUniversFilters.size === filterPills.length - 1);
                }
                applyFilters();
            });
        });

        // --- FONCTION DE FILTRAGE PRINCIPALE ---
        function applyFilters() {
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            const activeZoneEl = document.querySelector('.zone-tab.active');
            const activeZone = activeZoneEl ? activeZoneEl.dataset.zone : 'all';

            document.querySelectorAll('.geo-card, .geo-table tbody tr').forEach(item => {
                const searchMatch = (item.dataset.searchable || '').includes(searchTerm);
                const universMatch = activeUniversFilters.has(item.dataset.univers);
                const zoneMatch = (activeZone === 'all' || item.dataset.zone === activeZone);
                
                let displayStyle = item.tagName === 'TR' ? '' : 'grid';
                
                item.style.display = (searchMatch && universMatch && zoneMatch) ? displayStyle : 'none';
            });
            
            if (cardView.style.display !== 'none') {
                 document.querySelectorAll('.univers-separator').forEach(separator => {
                    let nextElement = separator.nextElementSibling;
                    let hasVisibleItems = false;
                    while(nextElement && (nextElement.classList.contains('geo-card') || nextElement.classList.contains('univers-separator'))) {
                        if (nextElement.classList.contains('geo-card') && nextElement.style.display !== 'none') {
                            hasVisibleItems = true;
                            break;
                        }
                        if (nextElement.classList.contains('univers-separator')) {
                           break;
                        }
                        nextElement = nextElement.nextElementSibling;
                    }
                    separator.style.display = hasVisibleItems ? 'block' : 'none';
                });
            }
        }

        // Tri pour la Vue Fiches
        function sortCardView() {
            const sortBy = sortBySelect.value;
            const cards = Array.from(cardView.querySelectorAll('.geo-card'));
            const separators = Array.from(cardView.querySelectorAll('.univers-separator'));

            cards.sort((a, b) => {
                let valA, valB;
                if (sortBy === 'univers-asc') {
                    valA = a.dataset.univers.toLowerCase();
                    valB = b.dataset.univers.toLowerCase();
                } else if (sortBy === 'code-geo-asc') {
                    valA = a.dataset.code_geo.toLowerCase();
                    valB = b.dataset.code_geo.toLowerCase();
                } else { // libelle-asc
                    valA = a.dataset.libelle.toLowerCase();
                    valB = b.dataset.libelle.toLowerCase();
                }
                return valA.localeCompare(valB);
            });
            
            // On vide et on ré-insère tout dans le bon ordre
            cardView.innerHTML = '';
            let lastUnivers = null;
            cards.forEach(card => {
                const currentUnivers = card.dataset.univers;
                if (sortBy === 'univers-asc' && currentUnivers !== lastUnivers) {
                    const separator = separators.find(s => s.dataset.univers === currentUnivers);
                    if (separator) cardView.appendChild(separator);
                    lastUnivers = currentUnivers;
                }
                cardView.appendChild(card);
            });
            applyFilters(); // Ré-appliquer les filtres pour cacher les séparateurs vides
        }
        if (sortBySelect) {
            sortBySelect.addEventListener('change', sortCardView);
        }

        // Tri pour la Vue Tableau
        function sortTable(columnIndex, th) {
            // ... (logique de tri du tableau existante)
        }
        tableHeaders.forEach((th, index) => {
            th.addEventListener('click', () => sortTable(index, th));
        });

        // --- ÉVÉNEMENTS ---
        if (searchInput) searchInput.addEventListener('input', applyFilters);
        
        zoneTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                zoneTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                applyFilters();
            });
        });

        // Initialisation
        applyFilters();
    }
});
