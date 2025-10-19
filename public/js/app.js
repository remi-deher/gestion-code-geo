/* public/js/app.js (Version List.js SEULEMENT - v6 - Correction Erreur 'childNodes') */

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
    const listJsElement = document.getElementById('fiches-list-js');
    
    const allFilterPills = document.querySelectorAll('.filter-pill');
    const allZoneTabs = document.querySelectorAll('.zone-tab, .zone-tabs-mobile > button');

    let cardList = null;

    /**
     * Génère les QR codes pour les conteneurs visibles et vides dans la vue fiches.
     */
    function generateVisibleQrCodes() {
        if (!listJsElement) return;
        const listItems = listJsElement.querySelectorAll('.list .geo-card');
        
        listItems.forEach(card => {
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
        });
    }

    // --- Initialisation de List.js ---
    if (listJsElement && typeof List !== 'undefined') {
        try {

            // CORRECTION: L'option 'pagination: false' causait l'erreur.
            // Nous la retirons complètement de l'objet 'options'.
            // 'page: 10000' est la bonne méthode pour tout afficher.
            const options = {
                valueNames: [
                    'code_geo', 'libelle', 'univers', 'zone', 'unplaced',
                    { data: ['zone'] },
                    { data: ['univers'] }
                ],
                page: 10000, // Affiche "tout"
                // La clé 'pagination' est volontairement omise pour désactiver le plugin
                listClass: 'list',
                searchClass: 'listjs-search'
            };
            
            // L'erreur se produisait sur cette ligne
            cardList = new List('fiches-list-js', options);

            // Logique de tri conservée
            const sortBySelect = document.getElementById('sort-by');
            if (sortBySelect) {
                cardList.sort(sortBySelect.value, { order: "asc" });
                sortBySelect.addEventListener('change', (e) => cardList.sort(e.target.value, { order: "asc" }));
            } else { console.warn("Élément #sort-by non trouvé pour List.js"); }

            // Génération des QR codes après la mise à jour de la liste
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


    // --- GESTION DES ÉVÉNEMENTS ---
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            // S'applique uniquement à List.js
            if (cardList) {
                applyFiltersToListJs();
            }
        }, 300));
    } else {
        console.warn("Élément #recherche non trouvé.");
    }

    allFilterPills.forEach(pill => pill.addEventListener('click', handlePillClick));
    allZoneTabs.forEach(tab => tab.addEventListener('click', handleZoneClick));
    

    // --- LOGIQUE DES FONCTIONS ---

    // Fonctions de gestion des filtres (conservées pour List.js)
    function updateUniversFiltersVisibility() {
        const activeZone = document.querySelector('.zone-tab.active, .zone-tabs-mobile > button.active')?.dataset.zone || 'all';
        let anyVisibleActive = false;

        document.querySelectorAll('.filter-pill[data-zone]').forEach(pill => {
            const pillZone = pill.dataset.zone;
            const shouldBeVisible = (activeZone === 'all' || pillZone === activeZone); // Correction ici (activeZon -> activeZone)
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
    }

    // Logique de filtre pour List.js (conservée)
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

        // Logique pour afficher/cacher les séparateurs d'univers
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
            generateVisibleQrCodes(); // Regénérer les QR codes après filtrage
        }, 0);
    }

    // --- DÉMARRAGE ---
    if (listJsElement) listJsElement.style.display = 'block';
    updateUniversFiltersVisibility();
    applyFiltersToListJs(); // Applique les filtres initiaux

}); // Fin window.addEventListener('load')
