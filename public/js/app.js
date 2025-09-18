document.addEventListener('DOMContentLoaded', () => {
    
    // --- LOGIQUE POUR LA PAGE LISTE ---
    const listeContainer = document.getElementById('liste-geocodes');
    if (listeContainer) {
        // Éléments spécifiques à la page liste
        const searchInput = document.getElementById('recherche');
        const universFilters = document.querySelectorAll('#filtres-univers input[type="checkbox"]');
        const zoneTabs = document.querySelectorAll('.zone-tab');

        // Génération des QR Codes
        document.querySelectorAll('.qr-code-container').forEach(container => {
            const codeText = container.dataset.code;
            if (codeText) new QRCode(container, { text: codeText, width: 80, height: 80 });
        });
        
        // Gère la logique de la case "Tout voir" pour les univers
        function handleUniversCheckbox(event) {
            const allCheckbox = document.querySelector('#filtres-univers input[value="all"]');
            
            if (event.target.value === 'all') {
                // Si on clique sur "Tout voir", on coche/décoche tout le reste
                universFilters.forEach(cb => {
                    if (cb.value !== 'all') {
                        cb.checked = event.target.checked;
                    }
                });
            } else {
                // Si on décoche une case, on décoche aussi "Tout voir"
                if (!event.target.checked) {
                    allCheckbox.checked = false;
                }
                // Si toutes les autres sont cochées, on coche "Tout voir"
                const allOthersChecked = Array.from(universFilters)
                    .filter(cb => cb.value !== 'all')
                    .every(cb => cb.checked);
                allCheckbox.checked = allOthersChecked;
            }
            applyFilters();
        }

        // --- Fonction principale qui applique TOUS les filtres ---
        function applyFilters() {
            // 1. Lire l'état actuel de tous les filtres
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            
            const checkedUnivers = Array.from(universFilters)
                .filter(cb => cb.checked && cb.value !== 'all')
                .map(cb => cb.value);

            const activeZoneEl = document.querySelector('.zone-tab.active');
            const activeZone = activeZoneEl ? activeZoneEl.dataset.zone : 'all';

            // 2. Parcourir chaque élément et décider de l'afficher ou non
            document.querySelectorAll('.code-geo-item').forEach(item => {
                const searchableText = item.dataset.searchable || '';
                const itemUnivers = item.dataset.univers;
                const itemZone = item.dataset.zone;

                const searchMatch = searchableText.includes(searchTerm);
                const universMatch = checkedUnivers.includes(itemUnivers);
                const zoneMatch = (activeZone === 'all' || itemZone === activeZone);

                // L'élément n'est visible que si TOUTES les conditions sont remplies
                if (searchMatch && universMatch && zoneMatch) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });

            // 3. Afficher ou masquer les titres des univers en fonction des éléments visibles
            document.querySelectorAll('.univers-separator').forEach(separator => {
                const separatorUnivers = separator.dataset.univers;
                const hasVisibleItems = document.querySelector(`.code-geo-item[data-univers="${separatorUnivers}"][style*="display: flex"]`);
                
                if (hasVisibleItems) {
                    separator.style.display = 'block';
                } else {
                    separator.style.display = 'none';
                }
            });
        }

        // --- Écouteurs d'événements (avec vérifications) ---
        if (searchInput) {
            searchInput.addEventListener('input', applyFilters);
        }
        universFilters.forEach(checkbox => checkbox.addEventListener('change', handleUniversCheckbox));
        zoneTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                zoneTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                applyFilters();
            });
        });

        // Appliquer les filtres une première fois au chargement de la page
        applyFilters();
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

