/* public/js/app.js (Version DataTables + List.js - Vérifications Robustes et Correction QR Code + Correction Responsive) */

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

    /**
     * Génère les QR codes pour les conteneurs visibles et vides dans la vue fiches.
     */
    function generateVisibleQrCodes() {
        // Sélectionne uniquement les conteneurs QR visibles dans la liste List.js ET qui sont vides
        document.querySelectorAll('#fiches-list-js .list .geo-card-qr:empty').forEach(qrContainer => {
            const codeText = qrContainer.dataset.code;
            try {
                if (codeText && typeof QRCode !== 'undefined') {
                    // Vérification supplémentaire que le conteneur est bien vide avant de générer
                    if (qrContainer.innerHTML === '') {
                        new QRCode(qrContainer, { text: codeText, width: 90, height: 90 });
                        // console.log(`QR Code généré pour ${codeText}`); // Optionnel: pour débug
                    }
                }
            } catch (e) {
                console.error(`Erreur QRCode pour ${codeText}:`, e);
                // Optionnel: afficher un message d'erreur dans le conteneur
                // qrContainer.innerHTML = '<small class="text-danger">Erreur QR</small>';
            }
        });
    }

    // --- Initialisation de List.js ---
    if (listJsElement && typeof List !== 'undefined') {
        try {
            const options = {
                valueNames: [ 'code_geo', 'libelle', 'univers', 'zone', 'unplaced' ],
                page: 15,
                pagination: { paginationClass: "pagination", item: '<li class="page-item"><a class="page-link" href="#"></a></li>', activeClass: 'active' },
                listClass: 'list' // Classe des éléments à paginer/filtrer/trier
            };
            cardList = new List('fiches-list-js', options);

            const sortBySelect = document.getElementById('sort-by');
            if (sortBySelect) {
                sortBySelect.addEventListener('change', (e) => cardList.sort(e.target.value, { order: "asc" }));
            } else { console.warn("Élément #sort-by non trouvé pour List.js"); }

            // Générer les QR Codes initiaux
            generateVisibleQrCodes(); // Appel initial

            // Ajouter un écouteur pour les mises à jour de List.js
            cardList.on('updated', function () {
                // console.log('List.js updated, regenerating QR Codes...'); // Optionnel: pour débug
                generateVisibleQrCodes(); // Rappeler la fonction après chaque update (filtre, pagination, tri)
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
        const searchTerm = (searchInput && searchInput.value) ? searchInput.value.toLowerCase().trim() : '';
        const activeZoneEl = document.querySelector('.zone-tab.active, .zone-tabs-mobile > button.active');
        const activeZone = activeZoneEl ? activeZoneEl.dataset.zone : 'all';
        const activeUniversPills = document.querySelectorAll('.filter-pill.active[data-zone]');
        const allUniversPillActive = document.querySelector('.filter-pill[data-filter="all"].active');
        const filterByUnivers = !allUniversPillActive && activeUniversPills.length > 0;
        const activeUniversFilters = new Set(Array.from(activeUniversPills).map(p => p.dataset.filter));

        return { searchTerm, activeZone, filterByUnivers, activeUniversFilters };
    }

    // --- Initialisation de DataTables ---
    if (tableElement && typeof $ !== 'undefined' && $.fn.dataTable) {
        try {
            dataTable = $(tableElement).DataTable({
                language: {
                    "sEmptyTable":     "Aucune donnée disponible dans le tableau",
                    "sInfo":           "Affichage de l'élément _START_ à _END_ sur _TOTAL_ éléments",
                    "sInfoEmpty":      "Affichage de l'élément 0 à 0 sur 0 élément",
                    "sInfoFiltered":   "(filtré à partir de _MAX_ éléments au total)",
                    "sInfoPostFix":    "",
                    "sInfoThousands":  ",",
                    "sLengthMenu":     "Afficher _MENU_ éléments",
                    "sLoadingRecords": "Chargement...",
                    "sProcessing":     "Traitement...",
                    "sSearch":         "Rechercher :",
                    "sZeroRecords":    "Aucun élément correspondant trouvé",
                    "oPaginate": {
                        "sFirst":    "Premier",
                        "sLast":     "Dernier",
                        "sNext":     "Suivant",
                        "sPrevious": "Précédent"
                    },
                    "oAria": {
                        "sSortAscending":  ": activer pour trier la colonne par ordre croissant",
                        "sSortDescending": ": activer pour trier la colonne par ordre décroissant"
                    },
                    "select": {
                        "rows": {
                            "_": "%d lignes sélectionnées",
                            "0": "Aucune ligne sélectionnée",
                            "1": "1 ligne sélectionnée"
                        }
                    }
                },
                "columnDefs": [
                    { "orderable": false, "targets": [3, 4] }, // Colonnes Placement et Actions non triables
                    { "searchable": false, "targets": [3, 4] } // Colonnes Placement et Actions non cherchables par DataTables
                ],
                "order": [[ 2, "asc" ]], // Tri par défaut sur la colonne Univers (index 2)
                "responsive": true, // Activer la responsivité
                "dom": "<'row mb-3 align-items-center'<'col-sm-12 col-md-6'B><'col-sm-12 col-md-6'f>>" +
                       "<'row'<'col-sm-12'tr>>" +
                       "<'row mt-3 align-items-center'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
                "buttons": [ // Configuration des boutons d'export (optionnel)
                    { extend: 'copyHtml5', text: 'Copier', exportOptions: { columns: ':visible:not(.no-print)' } },
                    { extend: 'excelHtml5', text: 'Excel', exportOptions: { columns: ':visible:not(.no-print)' } },
                    { extend: 'csvHtml5', text: 'CSV', exportOptions: { columns: ':visible:not(.no-print)' } },
                    { extend: 'pdfHtml5', text: 'PDF', exportOptions: { columns: ':visible:not(.no-print)' } },
                    { extend: 'print', text: 'Imprimer', exportOptions: { columns: ':visible:not(.no-print)' } }
                ]
            });
            $('.dataTables_filter').hide(); // Cacher la recherche par défaut de DataTables
        } catch (e) {
            console.error("Erreur lors de l'initialisation de DataTables:", e);
            dataTable = null;
        }
    } else {
        console.error("ERREUR CRITIQUE : jQuery ou DataTables n'a pas pu être initialisé.");
    }

    // --- Filtre personnalisé pour DataTables ---
    if (dataTable && $.fn.dataTable) {
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                if (!dataTable) return true;
                if (settings.nTableId !== 'geo-table') return true; // S'applique seulement à notre tableau

                const filters = getActiveFilters();
                const rowNode = dataTable.row(dataIndex).node();
                if (!rowNode) return false; // Ne devrait pas arriver

                // Lire les données depuis les attributs data-* de la ligne <tr>
                const rowUnivers = rowNode.dataset.univers || '';
                const rowZone = rowNode.dataset.zone || '';
                const rowSearchable = (rowNode.dataset.searchable || '').toLowerCase(); // Utilise l'attribut data-searchable

                // 1. Vérifier la correspondance de la recherche
                const searchMatch = rowSearchable.includes(filters.searchTerm);
                if (!searchMatch) return false;

                // 2. Vérifier la correspondance de la zone
                let zoneMatch = false;
                if (filters.activeZone === 'all') {
                    zoneMatch = true;
                } else if (filters.activeZone === 'unplaced') {
                    // Vérifie le contenu texte de la colonne "Placements" (index 3)
                    const placementText = data[3] || '';
                    zoneMatch = /aucun/i.test(placementText); // Affiche si 'Aucun' est présent
                } else {
                    zoneMatch = (rowZone === filters.activeZone);
                }
                if (!zoneMatch) return false;

                // 3. Vérifier la correspondance de l'univers (seulement si une zone spécifique ou 'all' est sélectionnée)
                let universMatch = true; // Vrai par défaut
                if (filters.activeZone !== 'unplaced' && filters.filterByUnivers) {
                    universMatch = filters.activeUniversFilters.has(rowUnivers);
                }

                return universMatch; // La ligne est visible si toutes les conditions sont remplies
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

    allFilterPills.forEach(pill => pill.addEventListener('click', handlePillClick));
    allZoneTabs.forEach(tab => tab.addEventListener('click', handleZoneClick));

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

            // Important: Redessiner DataTables pour ajuster les colonnes si elles étaient cachées
            // AJOUT DE LA VÉRIFICATION ROBUSTE ICI
            if (dataTable && typeof dataTable.responsive === 'object' && typeof dataTable.responsive.recalc === 'function') { // Vérifie si l'extension responsive est chargée
                 try {
                     // Recalculer la responsivité ET ajuster les colonnes
                     dataTable.columns.adjust().responsive.recalc();
                 } catch(e) {
                     console.error("Error during DataTables responsive recalc:", e);
                 }
            } else if (dataTable) {
                // Si responsive n'existe pas mais dataTable oui, juste ajuster les colonnes
                try {
                    dataTable.columns.adjust();
                } catch(e) {
                    console.error("Error during DataTables column adjust:", e);
                }
                console.warn("DataTables Responsive extension not detected during switchView, only adjusting columns.");
            }
        }
        // Appliquer les filtres à la nouvelle vue affichée
        applyAllFilters();
    }


    function updateUniversFiltersVisibility() {
        const activeZone = document.querySelector('.zone-tab.active, .zone-tabs-mobile > button.active')?.dataset.zone || 'all';
        document.querySelectorAll('.filter-pill[data-zone]').forEach(pill => {
            const pillZone = pill.dataset.zone;
            pill.style.display = (activeZone === 'all' || pillZone === activeZone) ? '' : 'none';
            // Déselectionner si caché
            if (pill.style.display === 'none' && pill.classList.contains('active')) {
                syncPillStates(pill.dataset.filter, false);
            }
        });
        // Vérifier s'il faut réactiver "Tout voir"
        const anyVisibleActive = document.querySelector('.filter-pill.active[data-zone]:not([style*="display: none"])');
        syncPillStates('all', !anyVisibleActive); // Activer "Tout voir" si aucun autre filtre spécifique visible n'est actif
    }

    function syncPillStates(filter, isActive) {
        document.querySelectorAll(`.filter-pill[data-filter="${filter}"]`).forEach(p => p.classList.toggle('active', isActive));
     }

    function handlePillClick(e) {
        const clickedPill = e.currentTarget;
        const filterValue = clickedPill.dataset.filter;
        if (filterValue === 'all') {
            // Activer "all", désactiver les autres visibles
            syncPillStates('all', true);
            document.querySelectorAll('.filter-pill[data-zone].active:not([style*="display: none"])').forEach(p => syncPillStates(p.dataset.filter, false));
        } else {
            // Basculer l'état du filtre cliqué
            const newState = !clickedPill.classList.contains('active');
            syncPillStates(filterValue, newState);
            // Si on vient d'activer un filtre, désactiver "all"
            if (newState) {
                syncPillStates('all', false);
            } else {
                // Si on a désactivé le dernier filtre actif, réactiver "all"
                const anyActive = document.querySelector('.filter-pill.active[data-zone]:not([style*="display: none"])');
                if (!anyActive) {
                    syncPillStates('all', true);
                }
            }
        }
        applyAllFilters();
     }

    function handleZoneClick(e) {
        const zoneValue = e.currentTarget.dataset.zone;
        // Mettre à jour l'état actif des onglets (desktop et mobile)
        document.querySelectorAll('.zone-tab, .zone-tabs-mobile > button').forEach(t => t.classList.remove('active'));
        document.querySelectorAll(`.zone-tab[data-zone="${zoneValue}"], .zone-tabs-mobile > button[data-zone="${zoneValue}"]`).forEach(t => t.classList.add('active'));

        const showUnivers = (zoneValue !== 'unplaced');
        // Afficher/cacher les conteneurs de filtres d'univers
        ['#filtres-univers', '#filtres-univers-mobile'].forEach(sel => {
            const el = document.querySelector(sel);
            if(el) el.style.display = showUnivers ? (sel.includes('mobile') ? 'flex' : 'block') : 'none';
        });

        if (showUnivers) {
            updateUniversFiltersVisibility(); // Ajuste la visibilité et l'état des pilules
        }
        applyAllFilters();
    }

    /**
     * Fonction principale qui applique les filtres aux deux vues.
     */
    function applyAllFilters() {
        if (cardList) {
            applyFiltersToListJs();
        } else {
             console.warn("Tentative d'appliquer les filtres List.js, mais cardList n'est pas initialisé.");
        }
        if (dataTable) {
            dataTable.draw(); // Déclenche le filtre personnalisé DataTables
        } else {
            console.warn("Tentative d'appliquer les filtres DataTables, mais dataTable n'est pas initialisé.");
        }
    }

    /**
     * Logique de filtrage spécifique pour List.js.
     */
    function applyFiltersToListJs() {
        if (!cardList) return;
        const filters = getActiveFilters();

        cardList.filter((item) => {
            // Les séparateurs sont toujours gardés initialement, on gère leur visibilité après
            if (item.elm.classList.contains('univers-separator')) {
                return true;
            }

            const itemValues = item.values();
            // Assurer que les valeurs existent avant de les utiliser
            const codeGeo = itemValues.code_geo || '';
            const libelle = itemValues.libelle || '';
            const univers = itemValues.univers || '';
            const zone = itemValues.zone || '';
            const isUnplaced = itemValues.unplaced === 'true'; // Comparaison stricte

            const searchableText = `${codeGeo} ${libelle} ${univers}`.toLowerCase();

            // 1. Filtre recherche
            const searchMatch = searchableText.includes(filters.searchTerm);
            if (!searchMatch) return false;

            // 2. Filtre zone
            if (filters.activeZone === 'unplaced') {
                if (!isUnplaced) return false;
            } else if (filters.activeZone !== 'all') {
                if (zone !== filters.activeZone) return false;
            }
             // Si on est sur 'unplaced', on ignore le filtre univers
            if (filters.activeZone === 'unplaced') {
                return true; // Déjà filtré par search et isUnplaced
            }

            // 3. Filtre univers (seulement si une zone ou 'all' est sélectionnée)
            if (filters.filterByUnivers) {
                if (!filters.activeUniversFilters.has(univers)) return false;
            }

            return true; // L'élément passe tous les filtres
        });

        // Gérer la visibilité des séparateurs après le filtrage principal
        const visibleUnivers = new Set();
        cardList.visibleItems.forEach(item => {
            if (!item.elm.classList.contains('univers-separator')) {
                visibleUnivers.add(item.values().univers);
            }
        });

        cardList.items.forEach(item => {
            if (item.elm.classList.contains('univers-separator')) {
                const separatorUnivers = item.values().univers;
                // Affiche le séparateur seulement si au moins un item de cet univers est visible
                item.elm.style.display = visibleUnivers.has(separatorUnivers) ? 'block' : 'none';
            }
        });
    }

    // --- DÉMARRAGE ---
    const isTableViewHidden = tableView ? tableView.classList.contains('d-none') : true;
    const currentView = isTableViewHidden ? 'card' : 'table';
    switchView(currentView); // Applique la vue correcte et les filtres initiaux
    // S'assurer que les filtres univers sont corrects au départ
    updateUniversFiltersVisibility();

}); // Fin window.addEventListener('load')
