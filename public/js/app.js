document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded event fired.'); // Log: Début de l'exécution

    const classeurSection = document.getElementById('classeur');
    if (!classeurSection) {
        console.warn('[DEBUG] Section #classeur non trouvée. Arrêt du script.'); // Log: Élément essentiel manquant
        return;
    }

    // --- Récupération des éléments du DOM ---
    console.log('[DEBUG] Récupération des éléments du DOM...');
    const searchInput = document.getElementById('recherche');
    const viewCardBtn = document.getElementById('view-card-btn');
    const viewTableBtn = document.getElementById('view-table-btn');
    const cardView = document.getElementById('card-view');
    const tableView = document.getElementById('table-view');
    const sortBySelect = document.getElementById('sort-by');

    const allFilterPills = document.querySelectorAll('.filter-pill');
    const allZoneTabs = document.querySelectorAll('.zone-tab, .zone-tabs-mobile > button');

    const allGeoCards = cardView ? Array.from(cardView.querySelectorAll('.geo-card')) : [];
    const allTableRows = tableView ? Array.from(tableView.querySelectorAll('tbody tr')) : [];

    console.log(`[DEBUG] Éléments trouvés: searchInput=${!!searchInput}, viewCardBtn=${!!viewCardBtn}, viewTableBtn=${!!viewTableBtn}, cardView=${!!cardView}, tableView=${!!tableView}, sortBySelect=${!!sortBySelect}, allFilterPills=${allFilterPills.length}, allZoneTabs=${allZoneTabs.length}, allGeoCards=${allGeoCards.length}, allTableRows=${allTableRows.length}`);

    // --- GESTION DES ÉVÉNEMENTS ---
    console.log('[DEBUG] Ajout des écouteurs d\'événements...');

    if (viewCardBtn && viewTableBtn) {
        viewCardBtn.addEventListener('click', () => switchView('card'));
        viewTableBtn.addEventListener('click', () => switchView('table'));
        console.log('[DEBUG] Écouteurs pour switchView ajoutés.');
    } else {
        console.warn('[DEBUG] Boutons de changement de vue manquants.');
    }

    if (searchInput) {
         searchInput.addEventListener('input', applyFiltersAndSort);
         console.log('[DEBUG] Écouteur pour searchInput ajouté.');
    } else {
        console.warn('[DEBUG] Champ de recherche manquant.');
    }
    if (sortBySelect) {
         sortBySelect.addEventListener('change', applyFiltersAndSort);
         console.log('[DEBUG] Écouteur pour sortBySelect ajouté.');
    } else {
        console.warn('[DEBUG] Sélecteur de tri manquant.');
    }

    allFilterPills.forEach(pill => pill.addEventListener('click', handlePillClick));
    console.log(`[DEBUG] Écouteurs ajoutés pour ${allFilterPills.length} pilules de filtre.`);
    allZoneTabs.forEach(tab => tab.addEventListener('click', handleZoneClick));
    console.log(`[DEBUG] Écouteurs ajoutés pour ${allZoneTabs.length} onglets de zone.`);

    // --- LOGIQUE DES FONCTIONS ---

    function switchView(view) {
        console.log(`[DEBUG] switchView appelé avec view='${view}'.`);
        if (!cardView || !tableView || !viewCardBtn || !viewTableBtn) {
            console.error('[DEBUG] Éléments manquants pour switchView.');
            return;
        }
        if (view === 'card') {
            cardView.classList.remove('d-none');
            tableView.classList.add('d-none');
            viewCardBtn.classList.add('active');
            viewTableBtn.classList.remove('active');
            console.log('[DEBUG] Vue Fiches activée.');
        } else { // view === 'table'
            cardView.classList.add('d-none');
            tableView.classList.remove('d-none');
            viewCardBtn.classList.remove('active');
            viewTableBtn.classList.add('active');
            console.log('[DEBUG] Vue Tableau activée.');
        }
    }

    function updateUniversFiltersVisibility() {
        console.log('[DEBUG] updateUniversFiltersVisibility appelé.');
        const activeZone = document.querySelector('.zone-tab.active, .zone-tabs-mobile > button.active')?.dataset.zone || 'all';
        console.log(`[DEBUG] Zone active détectée: '${activeZone}'.`);
        const universPills = document.querySelectorAll('.filter-pill[data-zone]');
        let visiblePillsCount = 0;

        universPills.forEach(pill => {
            const pillZone = pill.dataset.zone;
            if (activeZone === 'all' || pillZone === activeZone) {
                pill.style.display = ''; // Utiliser '' pour réinitialiser au style par défaut (visible)
                visiblePillsCount++;
            } else {
                pill.style.display = 'none';
                // Si la pilule est cachée mais active, on la désactive pour éviter les incohérences
                if (pill.classList.contains('active')) {
                    pill.classList.remove('active');
                    console.log(`[DEBUG] Pilule '${pill.dataset.filter}' désactivée car cachée.`);
                }
            }
        });
        console.log(`[DEBUG] ${visiblePillsCount} pilules d'univers sont visibles pour la zone '${activeZone}'.`);

        // Gérer l'état "Tout voir" en fonction des pilules visibles *et* actives
        document.querySelectorAll('#filtres-univers, #filtres-univers-mobile').forEach(container => {
            // Compte les pilules spécifiques (pas "Tout voir") qui sont actives ET visibles
            const activeVisibleSpecificPills = container.querySelectorAll('.filter-pill.active[data-zone]:not([style*="display: none"])').length;
            const toutVoirPill = container.querySelector('.filter-pill[data-filter="all"]');
            if (toutVoirPill) {
                // Activer "Tout voir" SEULEMENT si AUCUNE pilule spécifique n'est active parmi les visibles
                const shouldToutVoirBeActive = activeVisibleSpecificPills === 0;
                toutVoirPill.classList.toggle('active', shouldToutVoirBeActive);
                console.log(`[DEBUG] Conteneur ${container.id}: ${activeVisibleSpecificPills} pilules spécifiques actives et visibles. "Tout voir" est ${shouldToutVoirBeActive ? 'actif' : 'inactif'}.`);
            }
        });
    }

     /**
     * Synchronise l'état 'active' pour tous les filtres ayant la même valeur data-filter.
     * @param {string} filter - La valeur de data-filter à synchroniser.
     * @param {boolean} isActive - L'état actif à appliquer (true ou false).
     */
     function syncPillStates(filter, isActive) {
        console.log(`[DEBUG] syncPillStates appelé pour filter='${filter}', isActive=${isActive}.`);
        const pillsToSync = document.querySelectorAll(`.filter-pill[data-filter="${filter}"]`);
        pillsToSync.forEach(p => {
            const changed = p.classList.contains('active') !== isActive;
            p.classList.toggle('active', isActive);
            //if (changed) console.log(`[DEBUG]   - État de ${p.closest('.filter-pills')?.id || 'conteneur inconnu'}->${filter} mis à ${isActive}.`);
        });
        console.log(`[DEBUG] Synchronisation terminée pour '${filter}'. ${pillsToSync.length} éléments affectés.`);
    }

    /**
     * Gère le clic sur une pilule de filtre (Univers).
     * @param {Event} e - L'événement de clic.
     */
     function handlePillClick(e) {
        const clickedPill = e.currentTarget;
        const filterValue = clickedPill.dataset.filter;
        console.log(`[DEBUG] handlePillClick: Clic sur '${filterValue}'.`);

        if (filterValue === 'all') {
            console.log('[DEBUG] Clic sur "Tout voir".');
            // 1. Activer tous les boutons "Tout voir"
            syncPillStates('all', true);
            // 2. Désactiver tous les autres filtres d'univers (visibles ou non)
            document.querySelectorAll('.filter-pill[data-zone]').forEach(p => {
                 if (p.classList.contains('active')) {
                     syncPillStates(p.dataset.filter, false); // Désactive et synchronise
                 }
            });
        } else {
            console.log(`[DEBUG] Clic sur filtre spécifique '${filterValue}'.`);
            const wasActive = clickedPill.classList.contains('active');
            const newStateIsActive = !wasActive; // Le nouvel état après toggle
            console.log(`[DEBUG] Nouvel état pour '${filterValue}' sera: ${newStateIsActive}.`);

            // 1. Synchroniser l'état (activé/désactivé) de ce filtre spécifique sur les deux vues
            syncPillStates(filterValue, newStateIsActive);

            if (newStateIsActive) {
                // 2. Si on active un filtre, désactiver "Tout voir" partout
                console.log('[DEBUG] Activation filtre spécifique -> Désactivation de "Tout voir".');
                syncPillStates('all', false);
            } else {
                // 3. Si on désactive un filtre, vérifier s'il reste d'autres filtres actifs *dans n'importe quel conteneur*
                //    On cherche un filtre actif qui n'est pas "Tout voir"
                const anyOtherActive = document.querySelector('.filter-pill.active[data-zone]');
                console.log(`[DEBUG] Désactivation filtre spécifique. Reste-t-il d'autres actifs ? ${!!anyOtherActive}`);
                if (!anyOtherActive) {
                    // S'il n'y a plus aucun filtre spécifique actif, réactiver "Tout voir" partout
                    console.log('[DEBUG] Aucun autre filtre spécifique actif -> Réactivation de "Tout voir".');
                    syncPillStates('all', true);
                }
            }
        }

        // Appliquer les filtres et le tri après avoir mis à jour les états
        console.log('[DEBUG] Appel de applyFiltersAndSort depuis handlePillClick.');
        applyFiltersAndSort();
    }


    function handleZoneClick(e) {
        const zoneValue = e.currentTarget.dataset.zone;
        console.log(`[DEBUG] handleZoneClick: Zone sélectionnée='${zoneValue}'.`);
        allZoneTabs.forEach(t => t.classList.remove('active'));
        // Appliquer 'active' à tous les boutons correspondants (desktop + mobile)
        document.querySelectorAll(`.zone-tab[data-zone="${zoneValue}"], .zone-tabs-mobile > button[data-zone="${zoneValue}"]`).forEach(t => t.classList.add('active'));
        console.log(`[DEBUG] Classe 'active' appliquée aux onglets pour la zone '${zoneValue}'.`);

        const universFiltersDesktop = document.querySelector('#filtres-univers');
        const universFiltersMobile = document.querySelector('#filtres-univers-mobile');

        const showUniversFilters = (zoneValue !== 'unplaced');
        console.log(`[DEBUG] Afficher les filtres univers ? ${showUniversFilters}`);

        if (universFiltersDesktop) universFiltersDesktop.style.display = showUniversFilters ? 'block' : 'none';
        if (universFiltersMobile) universFiltersMobile.style.display = showUniversFilters ? 'flex' : 'none';

        if (showUniversFilters) {
            console.log('[DEBUG] Appel de updateUniversFiltersVisibility depuis handleZoneClick.');
            updateUniversFiltersVisibility(); // Met à jour la visibilité ET l'état "Tout voir" si besoin
        }

        console.log('[DEBUG] Appel de applyFiltersAndSort depuis handleZoneClick.');
        applyFiltersAndSort();
    }

function applyFiltersAndSort() {
        console.log('[DEBUG] applyFiltersAndSort appelé.');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const activeZoneEl = document.querySelector('.zone-tab.active, .zone-tabs-mobile > button.active');
        const activeZone = activeZoneEl ? activeZoneEl.dataset.zone : 'all';

        const activeUniversPills = document.querySelectorAll('.filter-pill.active[data-zone]');
        let activeUniversFilters = new Set(Array.from(activeUniversPills).map(p => p.dataset.filter));

        const allUniversPillActive = document.querySelector('.filter-pill[data-filter="all"].active');
        const filterByUnivers = !allUniversPillActive && activeUniversPills.length > 0;

        // --- NOUVEAU LOG : Afficher les filtres actifs exactement comme dans le Set ---
        if (filterByUnivers) {
            console.log('[DEBUG] Filtres univers actifs dans le Set:', JSON.stringify(Array.from(activeUniversFilters)));
        } else {
            console.log('[DEBUG] Condition "Tout voir" active ou aucun filtre spécifique.');
            activeUniversFilters.clear();
        }
        // --- FIN NOUVEAU LOG ---

        console.log(`[DEBUG] applyFiltersAndSort: Zone='${activeZone}', Terme='${searchTerm}', FilterByUnivers=${filterByUnivers}.`);

        let visibleCardsCount = 0;
        let visibleRowsCount = 0;

        // --- NOUVEAU LOG : Fonction pour afficher les codes des caractères ---
        const logCharCodes = (label, str) => {
            const codes = Array.from(str).map(char => char.charCodeAt(0)).join(', ');
            console.log(`[DEBUG CHARCODES] ${label}: "${str}" [${codes}]`);
        };
        // --- FIN NOUVEAU LOG ---

        allGeoCards.forEach((card, index) => {
            const cardUnivers = card.dataset.univers || '';
            const cardZone = card.dataset.zone || '';
            const cardSearchable = (card.dataset.searchable || '').toLowerCase();
            const searchMatch = cardSearchable.includes(searchTerm);
            let isVisible = false;

            if (activeZone === 'unplaced') {
                const hasPlacements = card.querySelector('.info-placements') !== null;
                isVisible = searchMatch && !hasPlacements;
            } else {
                const universMatch = !filterByUnivers || activeUniversFilters.has(cardUnivers);
                const zoneMatch = (activeZone === 'all' || cardZone === activeZone);
                isVisible = searchMatch && universMatch && zoneMatch;

                // --- MODIFICATION LOG DÉTAILLÉ ---
                if (filterByUnivers && index < 2) { // Log only for first 2 cards when filtering
                    console.log(`[DEBUG CARD ${index}] Code: ${card.dataset.code_geo}, Univers: "${cardUnivers}", Zone: "${cardZone}", Search: ${searchMatch}, UniversMatch: ${universMatch} (Set has: ${activeUniversFilters.has(cardUnivers)}), ZoneMatch: ${zoneMatch}, IsVisible: ${isVisible}`);
                    // Log des codes caractères pour comparaison
                    logCharCodes(`  Card Univers`, cardUnivers);
                    if (activeUniversPills.length > 0) {
                        logCharCodes(`  First Active Filter`, activeUniversPills[0].dataset.filter);
                    }
                }
                // --- FIN MODIFICATION LOG ---
            }
            card.style.display = isVisible ? 'grid' : 'none';
            if(isVisible) visibleCardsCount++;
        });

        allTableRows.forEach((row, index) => {
             const rowUnivers = row.dataset.univers || '';
             const rowZone = row.dataset.zone || '';
             const rowSearchable = (row.dataset.searchable || '').toLowerCase();
             const searchMatch = rowSearchable.includes(searchTerm);
             let isVisible = false;

             if (activeZone === 'unplaced') {
                 const placementCell = row.querySelector('td[data-label="Placements"]');
                 const hasPlacements = placementCell && placementCell.textContent.trim() !== 'Aucun';
                 isVisible = searchMatch && !hasPlacements;
             } else {
                 const universMatch = !filterByUnivers || activeUniversFilters.has(rowUnivers);
                 const zoneMatch = (activeZone === 'all' || rowZone === activeZone);
                 isVisible = searchMatch && universMatch && zoneMatch;

                  // --- MODIFICATION LOG DÉTAILLÉ ---
                 if (filterByUnivers && index < 2) { // Log only for first 2 rows when filtering
                       console.log(`[DEBUG ROW ${index}] Code: ${row.dataset.code_geo}, Univers: "${rowUnivers}", Zone: "${rowZone}", Search: ${searchMatch}, UniversMatch: ${universMatch} (Set has: ${activeUniversFilters.has(rowUnivers)}), ZoneMatch: ${zoneMatch}, IsVisible: ${isVisible}`);
                       logCharCodes(`  Row Univers`, rowUnivers);
                       if (activeUniversPills.length > 0) {
                          logCharCodes(`  First Active Filter`, activeUniversPills[0].dataset.filter);
                       }
                 }
                 // --- FIN MODIFICATION LOG ---
             }
             row.style.display = isVisible ? '' : 'none';
              if(isVisible) visibleRowsCount++;
        });


        console.log(`[DEBUG] applyFiltersAndSort: ${visibleCardsCount} cartes visibles, ${visibleRowsCount} lignes visibles.`);

        sortVisibleElements();
    }

    function sortVisibleElements() {
        if (!sortBySelect) {
             console.warn('[DEBUG] sortVisibleElements: Sélecteur de tri non trouvé.');
             return;
        }
        const sortBy = sortBySelect.value;
        const [key, direction] = sortBy.split('-'); // ex: 'univers', 'asc'
        const isAsc = direction === 'asc';
        console.log(`[DEBUG] sortVisibleElements: Tri par '${key}' direction '${direction}'.`);

        // Tri des cartes visibles
        if (cardView) {
            const visibleCards = allGeoCards.filter(card => card.style.display !== 'none');
            visibleCards.sort((a, b) => {
                const valA = a.dataset[key] || '';
                const valB = b.dataset[key] || '';
                const comparison = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
                return isAsc ? comparison : -comparison;
            });

            // Vider et réinsérer les cartes triées, en gérant les séparateurs d'univers si nécessaire
            cardView.innerHTML = '';
            let lastUnivers = null;
            visibleCards.forEach(card => {
                const currentUnivers = card.dataset.univers;
                // Ajouter séparateur seulement si trié par univers ASC
                if (key === 'univers' && isAsc && currentUnivers !== lastUnivers) {
                    const separator = document.createElement('h3');
                    separator.className = 'univers-separator'; // Assurez-vous que cette classe existe dans votre CSS
                    separator.textContent = currentUnivers || 'Univers non défini';
                    cardView.appendChild(separator);
                    lastUnivers = currentUnivers;
                    //console.log(`[DEBUG] Ajout séparateur pour univers '${currentUnivers}'.`);
                }
                cardView.appendChild(card);
            });
             console.log(`[DEBUG] ${visibleCards.length} cartes réinsérées dans cardView.`);
        } else {
            console.warn('[DEBUG] sortVisibleElements: Conteneur cardView non trouvé.');
        }

        // Tri des lignes visibles
        const tableBody = tableView ? tableView.querySelector('tbody') : null;
        if (tableBody) {
            const visibleRows = allTableRows.filter(row => row.style.display !== 'none');
            visibleRows.sort((a, b) => {
                const valA = a.dataset[key] || '';
                const valB = b.dataset[key] || '';
                const comparison = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
                return isAsc ? comparison : -comparison;
            });
            // Vider et réinsérer les lignes triées
            visibleRows.forEach(row => tableBody.appendChild(row)); // appendChild déplace l'élément s'il existe déjà
            console.log(`[DEBUG] ${visibleRows.length} lignes réordonnées dans tableView.`);
        } else {
            console.warn('[DEBUG] sortVisibleElements: Conteneur tbody non trouvé.');
        }
    }

    // --- DÉMARRAGE ---
    console.log('[DEBUG] Initialisation des QR codes...');
    allGeoCards.forEach(card => {
        const qrContainer = card.querySelector('.geo-card-qr');
        if(qrContainer) {
            const codeText = qrContainer.dataset.code;
            try {
                if (codeText) {
                    // Vérifier si QRCode est défini avant de l'utiliser
                    if (typeof QRCode !== 'undefined') {
                        new QRCode(qrContainer, { text: codeText, width: 90, height: 90 });
                    } else {
                        console.error('[DEBUG] Librairie QRCode non chargée.');
                        qrContainer.textContent = 'QR Error';
                    }
                }
            } catch (e) {
                console.error(`[DEBUG] Erreur lors de la génération du QRCode pour ${codeText}:`, e);
                qrContainer.textContent = 'QR Error';
            }
        }
    });
    console.log('[DEBUG] QR codes initialisés (ou tentative).');

    console.log('[DEBUG] Appel initial de applyFiltersAndSort.');
    applyFiltersAndSort(); // Appliquer les filtres et le tri par défaut au chargement

    console.log('[DEBUG] Script app.js initialisé complètement.');
});
