document.addEventListener('DOMContentLoaded', () => {
    
    // --- LOGIQUE POUR LA PAGE LISTE ---
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

        // Génération des QR Codes
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

        // --- LOGIQUE DE FILTRAGE ---
        const zoneUniversMap = {};
        document.querySelectorAll('.code-geo-item, .geo-table tbody tr').forEach(item => {
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

        function applyFilters() {
            // S'assure que les filtres d'univers sont bien visibles avant de continuer
            updateUniversFiltersVisibility();

            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            
            // Correction clé : S'assure de lire les cases cochées *après* avoir potentiellement mis à jour leur visibilité
            const checkedUnivers = Array.from(universFilters)
                .filter(cb => cb.checked && cb.value !== 'all')
                .map(cb => cb.value);

            const activeZoneEl = document.querySelector('.zone-tab.active');
            const activeZone = activeZoneEl ? activeZoneEl.dataset.zone : 'all';

            document.querySelectorAll('.code-geo-item, .geo-table tbody tr').forEach(item => {
                const searchMatch = (item.dataset.searchable || '').includes(searchTerm);
                const universMatch = checkedUnivers.includes(item.dataset.univers);
                const zoneMatch = (activeZone === 'all' || item.dataset.zone === activeZone);
                
                const displayStyle = item.tagName === 'TR' ? 'table-row' : 'flex';
                // La condition est maintenant robuste : l'élément est affiché s'il correspond aux filtres
                if (searchMatch && universMatch && zoneMatch) {
                    item.style.display = displayStyle;
                } else {
                    item.style.display = 'none';
                }
            });
            
            document.querySelectorAll('.univers-separator').forEach(separator => {
                const hasVisibleItems = document.querySelector(`.code-geo-item[data-univers="${separator.dataset.univers}"][style*="display: flex"]`);
                separator.style.display = hasVisibleItems ? 'block' : 'none';
            });
        }

        // --- GESTION DES ÉVÉNEMENTS ---
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
                
                const allCheckbox = document.querySelector('#filtres-univers input[value="all"]');
                if (allCheckbox && !allCheckbox.checked) {
                    allCheckbox.checked = true;
                    // On déclenche manuellement l'événement pour que les autres cases se cochent
                    allCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    // Si "Tout voir" est déjà coché, on applique juste les filtres
                    applyFilters();
                }
            });
        });

        // Appel initial pour s'assurer que tout est correct au chargement
        applyFilters();
    }

    // --- LOGIQUE POUR LA PAGE DE CRÉATION (INCHANGÉE) ---
    const creationForm = document.getElementById('creation-form');
    if (creationForm) {
        // ...
    }
    
    // --- LOGIQUE POUR LE FORMULAIRE DYNAMIQUE (INCHANGÉE) ---
    const editForm = document.getElementById('edit-form');
    if (creationForm || editForm) {
        // ...
    }
});
