document.addEventListener('DOMContentLoaded', () => {
    
    // --- LOGIQUE POUR LA PAGE LISTE ---
    const classeurSection = document.getElementById('classeur');
    if (classeurSection) {

        // --- Récupération des éléments du DOM ---
        const searchInput = document.getElementById('recherche');
        const universFilters = document.querySelectorAll('#filtres-univers input[type="checkbox"]');
        const universFilterLabels = document.querySelectorAll('#filtres-univers label[data-univers-name]');
        const zoneTabs = document.querySelectorAll('.zone-tab');
        
        const viewCardBtn = document.getElementById('view-card-btn');
        const viewTableBtn = document.getElementById('view-table-btn');
        const cardView = document.getElementById('card-view');
        const tableView = document.getElementById('table-view');
        const sortBySelect = document.getElementById('sort-by');
        const sortContainer = document.querySelector('.sort-container');
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
                sortContainer.style.display = 'flex'; // Affiche le tri pour les fiches
            });
            viewTableBtn.addEventListener('click', () => {
                cardView.style.display = 'none';
                tableView.style.display = 'block';
                viewCardBtn.classList.remove('active');
                viewTableBtn.classList.add('active');
                sortContainer.style.display = 'none'; // Cache le tri (géré par les en-têtes)
            });
        }

        // --- LOGIQUE DE FILTRAGE (ADAPTÉE POUR LES DEUX VUES) ---
        function applyFilters() {
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            const checkedUnivers = Array.from(universFilters)
                .filter(cb => cb.checked && cb.value !== 'all')
                .map(cb => cb.value);
            const activeZoneEl = document.querySelector('.zone-tab.active');
            const activeZone = activeZoneEl ? activeZoneEl.dataset.zone : 'all';

            document.querySelectorAll('.geo-card, .geo-table tbody tr').forEach(item => {
                const searchMatch = (item.dataset.searchable || '').includes(searchTerm);
                const universMatch = checkedUnivers.includes(item.dataset.univers);
                const zoneMatch = (activeZone === 'all' || item.dataset.zone === activeZone);
                
                let displayStyle = item.tagName === 'TR' ? 'table-row' : 'grid';
                
                item.style.display = (searchMatch && universMatch && zoneMatch) ? displayStyle : 'none';
            });
            
            // Masque les séparateurs d'univers si besoin (uniquement pour la vue fiche)
            if (cardView.style.display !== 'none') {
                 document.querySelectorAll('.univers-separator').forEach(separator => {
                    let nextElement = separator.nextElementSibling;
                    let hasVisibleItems = false;
                    while(nextElement && nextElement.classList.contains('geo-card')) {
                        if (nextElement.style.display !== 'none') {
                            hasVisibleItems = true;
                            break;
                        }
                        nextElement = nextElement.nextElementSibling;
                    }
                    separator.style.display = hasVisibleItems ? 'block' : 'none';
                });
            }
        }
        
        // --- NOUVELLE LOGIQUE DE TRI ---

        // 1. Tri pour la Vue Fiches via le menu déroulant
        function sortCardView() {
            const sortBy = sortBySelect.value;
            const [key, direction] = sortBy.split('-'); // ex: "code-geo-asc"
            const separators = cardView.querySelectorAll('.univers-separator');
            const cards = Array.from(cardView.querySelectorAll('.geo-card'));
            
            if (key === 'univers') {
                // Le tri par défaut est déjà par univers, on s'assure que les séparateurs sont visibles
                separators.forEach(s => s.style.display = 'block');
                // On regroupe les cartes sous leurs séparateurs respectifs
                const universGroups = {};
                cards.forEach(card => {
                    const universName = card.dataset.univers;
                    if (!universGroups[universName]) universGroups[universName] = [];
                    universGroups[universName].push(card);
                });
                const sortedUniversNames = Object.keys(universGroups).sort((a, b) => a.localeCompare(b));
                cardView.innerHTML = '';
                sortedUniversNames.forEach(name => {
                    const separator = Array.from(separators).find(s => s.dataset.univers === name);
                    if(separator) cardView.appendChild(separator);
                    universGroups[name].forEach(card => cardView.appendChild(card));
                });
            } else {
                // Pour les autres tris, on cache les séparateurs et on trie les fiches
                separators.forEach(s => s.style.display = 'none');
                cards.sort((a, b) => {
                    const valA = a.dataset[key].toLowerCase();
                    const valB = b.dataset[key].toLowerCase();
                    return valA.localeCompare(valB);
                });
                cards.forEach(card => cardView.appendChild(card)); // Ré-insère les fiches triées
            }
        }
        if (sortBySelect) {
            sortBySelect.addEventListener('change', sortCardView);
        }

        // 2. Tri pour la Vue Tableau via les en-têtes
        let currentSort = { column: null, direction: 'asc' };
        
        function sortTable(columnIndex, th) {
            const tableBody = tableView.querySelector('tbody');
            const rows = Array.from(tableBody.querySelectorAll('tr'));
            let direction = 'asc';
            if (currentSort.column === columnIndex && currentSort.direction === 'asc') {
                direction = 'desc';
            }

            rows.sort((a, b) => {
                const cellA = a.children[columnIndex].textContent.trim().toLowerCase();
                const cellB = b.children[columnIndex].textContent.trim().toLowerCase();
                if (cellA < cellB) return direction === 'asc' ? -1 : 1;
                if (cellA > cellB) return direction === 'asc' ? 1 : -1;
                return 0;
            });
            rows.forEach(row => tableBody.appendChild(row));

            tableHeaders.forEach(header => header.classList.remove('asc', 'desc'));
            th.classList.add(direction);
            
            currentSort.column = columnIndex;
            currentSort.direction = direction;
        }

        tableHeaders.forEach((th, index) => {
            th.addEventListener('click', () => sortTable(index, th));
        });

        // --- GESTION DES FILTRES (UNCHANGÉ) ---
        const zoneUniversMap = {};
        document.querySelectorAll('.geo-card, .geo-table tbody tr').forEach(item => {
            const zone = item.dataset.zone;
            const univers = item.dataset.univers;
            if (!zoneUniversMap[zone]) zoneUniversMap[zone] = new Set();
            zoneUniversMap[zone].add(univers);
        });

        function updateUniversFiltersVisibility() {
            const activeZoneEl = document.querySelector('.zone-tab.active');
            if (!activeZoneEl) return;
            const activeZone = activeZoneEl.dataset.zone;
            if (activeZone === 'all') {
                universFilterLabels.forEach(label => label.style.display = 'flex');
                return;
            }
            const allowedUnivers = zoneUniversMap[activeZone] || new Set();
            universFilterLabels.forEach(label => {
                label.style.display = allowedUnivers.has(label.dataset.universName) ? 'flex' : 'none';
            });
        }
        
        function handleUniversCheckbox(event) {
            const allCheckbox = document.querySelector('#filtres-univers input[value="all"]');
            if (event.target.value === 'all') {
                universFilters.forEach(cb => { 
                    if (cb.closest('label').style.display !== 'none') cb.checked = event.target.checked;
                });
            } else {
                if (!event.target.checked) allCheckbox.checked = false;
                const allOthersChecked = Array.from(universFilters).filter(cb => cb.value !== 'all' && cb.closest('label').style.display !== 'none').every(cb => cb.checked);
                allCheckbox.checked = allOthersChecked;
            }
            applyFilters();
        }

        if (searchInput) searchInput.addEventListener('input', applyFilters);
        universFilters.forEach(checkbox => checkbox.addEventListener('change', handleUniversCheckbox));
        zoneTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                zoneTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                updateUniversFiltersVisibility();
                const allCheckbox = document.querySelector('#filtres-univers input[value="all"]');
                if (allCheckbox && !allCheckbox.checked) {
                    allCheckbox.checked = true;
                    allCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    applyFilters();
                }
            });
        });
        
        // --- LOGIQUE POUR LES PAGES DE CRÉATION (UNCHANGÉ) ---
        const creationForm = document.getElementById('creation-form');
        const batchCreationForm = document.getElementById('batch-creation-form');
        if (creationForm || batchCreationForm) { /* ... (Logique existante) ... */ }
    }
});
