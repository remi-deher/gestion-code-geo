document.addEventListener('DOMContentLoaded', () => {
    
    // --- LOGIQUE POUR LA PAGE LISTE ---
    // On n'exécute ce bloc que si on est sur la page contenant le classeur
    const classeurSection = document.getElementById('classeur');
    if (classeurSection) {

        // --- Récupération des éléments du DOM ---
        const searchInput = document.getElementById('recherche');
        const universFilters = document.querySelectorAll('#filtres-univers input[type="checkbox"]');
        const universFilterLabels = document.querySelectorAll('#filtres-univers label[data-univers-name]');
        const zoneTabs = document.querySelectorAll('.zone-tab');
        
        const viewListBtn = document.getElementById('view-list-btn');
        const viewTableBtn = document.getElementById('view-table-btn');
        const listView = document.getElementById('list-view');
        const tableView = document.getElementById('table-view');
        const geoTable = document.querySelector('.geo-table');

        // Génération des QR Codes pour la vue liste (si elle est présente)
        if (listView) {
            document.querySelectorAll('.qr-code-container').forEach(container => {
                const codeText = container.dataset.code;
                if (codeText) new QRCode(container, { text: codeText, width: 80, height: 80 });
            });
        }
        
        // --- GESTION DU CHANGEMENT DE VUE ---
        if (viewListBtn && viewTableBtn && listView && tableView) {
            viewListBtn.addEventListener('click', () => {
                listView.style.display = 'block';
                tableView.style.display = 'none';
                viewListBtn.classList.add('active');
                viewTableBtn.classList.remove('active');
            });
            viewTableBtn.addEventListener('click', () => {
                listView.style.display = 'none';
                tableView.style.display = 'block';
                viewListBtn.classList.remove('active');
                viewTableBtn.classList.add('active');
            });
        }

        // --- LOGIQUE DE FILTRAGE (ADAPTÉE POUR LES DEUX VUES) ---
        // Création d'une map pour savoir quels univers appartiennent à quelle zone
        const zoneUniversMap = {};
        document.querySelectorAll('.code-geo-item, .geo-table tbody tr').forEach(item => {
            const zone = item.dataset.zone;
            const univers = item.dataset.univers;
            if (!zoneUniversMap[zone]) zoneUniversMap[zone] = new Set();
            zoneUniversMap[zone].add(univers);
        });

        // Met à jour la visibilité des filtres d'univers
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
                const universName = label.dataset.universName;
                label.style.display = allowedUnivers.has(universName) ? 'flex' : 'none';
            });
        }

        // Fonction centrale qui applique tous les filtres actifs
        function applyFilters() {
            updateUniversFiltersVisibility();
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            const checkedUnivers = Array.from(universFilters).filter(cb => cb.checked && cb.value !== 'all').map(cb => cb.value);
            const activeZoneEl = document.querySelector('.zone-tab.active');
            const activeZone = activeZoneEl ? activeZoneEl.dataset.zone : 'all';

            // Itère sur les éléments des deux vues pour les filtrer
            document.querySelectorAll('.code-geo-item, .geo-table tbody tr').forEach(item => {
                const searchMatch = (item.dataset.searchable || '').includes(searchTerm);
                const universMatch = checkedUnivers.includes(item.dataset.univers);
                const zoneMatch = (activeZone === 'all' || item.dataset.zone === activeZone);
                
                const displayStyle = item.tagName === 'TR' ? 'table-row' : 'flex';
                item.style.display = (searchMatch && universMatch && zoneMatch) ? displayStyle : 'none';
            });
            
            // Masque les titres d'univers si aucun élément n'est visible en dessous
            document.querySelectorAll('.univers-separator').forEach(separator => {
                const hasVisibleItems = document.querySelector(`.code-geo-item[data-univers="${separator.dataset.univers}"][style*="display: flex"]`);
                separator.style.display = hasVisibleItems ? 'block' : 'none';
            });
        }

        // --- GESTION DU TRI DU TABLEAU ---
        if (geoTable) {
            geoTable.querySelectorAll('thead th[data-sort]').forEach(headerCell => {
                headerCell.addEventListener('click', () => {
                    const tableBody = geoTable.querySelector('tbody');
                    const order = headerCell.classList.contains('asc') ? 'desc' : 'asc';
                    
                    Array.from(tableBody.querySelectorAll('tr'))
                        .sort((a, b) => {
                            const aText = a.querySelector(`td:nth-child(${headerCell.cellIndex + 1})`).textContent.trim();
                            const bText = b.querySelector(`td:nth-child(${headerCell.cellIndex + 1})`).textContent.trim();
                            return (order === 'asc' ? 1 : -1) * aText.localeCompare(bText, undefined, { numeric: true });
                        })
                        .forEach(tr => tableBody.appendChild(tr));

                    geoTable.querySelectorAll('thead th').forEach(th => th.classList.remove('asc', 'desc'));
                    headerCell.classList.add(order);
                });
            });
        }

        // --- GESTION DES ÉVÉNEMENTS ---
        function handleUniversCheckbox(event) {
            const allCheckbox = document.querySelector('#filtres-univers input[value="all"]');
            if (event.target.value === 'all') {
                universFilters.forEach(cb => { 
                    if (cb.closest('label').style.display !== 'none') {
                        cb.checked = event.target.checked;
                    }
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
                
                const allCheckbox = document.querySelector('#filtres-univers input[value="all"]');
                if (allCheckbox && !allCheckbox.checked) {
                    allCheckbox.checked = true;
                    // Déclenche l'événement pour cocher toutes les autres cases visibles
                    allCheckbox.dispatchEvent(new Event('change')); 
                }
                
                applyFilters();
            });
        });

        applyFilters(); // Appel initial pour mettre en place les filtres au chargement
    }

    // --- LOGIQUE POUR LA PAGE DE CRÉATION ---
    const creationForm = document.getElementById('creation-form');
    if (creationForm) {
        const codeGeoInput = document.getElementById('code_geo');
        const qrCodePreview = document.getElementById('qrcode-preview');

        if (codeGeoInput && qrCodePreview) {
            codeGeoInput.addEventListener('input', () => {
                qrCodePreview.innerHTML = '';
                const text = codeGeoInput.value.trim();
                if (text) {
                    new QRCode(qrCodePreview, { text: text, width: 128, height: 128 });
                } else {
                    qrCodePreview.textContent = 'Saisir un code géo...';
                }
            });
        }
    }
});
