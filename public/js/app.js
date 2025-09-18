document.addEventListener('DOMContentLoaded', () => {
    
    // --- GESTION DES NOTIFICATIONS "TOAST" ---
    const toastContainer = document.querySelector('.toast-container');
    const toastNotification = document.getElementById('toast-notification');

    if (toastNotification && toastContainer) {
        toastContainer.appendChild(toastNotification);
        setTimeout(() => toastNotification.classList.add('show'), 100);

        const closeButton = toastNotification.querySelector('.toast-close');
        const closeToast = () => {
            if (toastNotification) {
                toastNotification.classList.remove('show');
                setTimeout(() => toastNotification.remove(), 500);
            }
        };
        const timeout = setTimeout(closeToast, 5000);
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                clearTimeout(timeout);
                closeToast();
            });
        }
    }


    // --- LOGIQUE POUR LA PAGE LISTE ---
    const classeurSection = document.getElementById('classeur');
    if (classeurSection) {

        const searchInput = document.getElementById('recherche');
        const universCheckboxes = document.querySelectorAll('#filtres-univers input[type="checkbox"]');
        const allUniversCheckbox = document.querySelector('#filtres-univers input[value="all"]');
        const zoneTabs = document.querySelectorAll('.zone-tab');
        const viewListBtn = document.getElementById('view-list-btn');
        const viewTableBtn = document.getElementById('view-table-btn');
        const listView = document.getElementById('list-view');
        const tableView = document.getElementById('table-view');

        // Génération des QR Codes
        document.querySelectorAll('.qr-code-container').forEach(container => {
            const codeText = container.dataset.code;
            if (codeText && typeof QRCode !== 'undefined') {
                new QRCode(container, { text: codeText, width: 80, height: 80 });
            }
        });
        
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

        // --- FONCTION DE FILTRAGE CENTRALE (CORRIGÉE) ---
        function applyFilters() {
            // CORRECTION : Ajout de vérifications pour éviter les erreurs si les éléments n'existent pas.
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            const activeZoneEl = document.querySelector('.zone-tab.active');
            if (!activeZoneEl) return; // Arrête la fonction si aucun onglet de zone n'est actif.
            const activeZone = activeZoneEl.dataset.zone;

            const checkedUnivers = Array.from(universCheckboxes)
                                        .filter(cb => cb.checked && cb.value !== 'all')
                                        .map(cb => cb.value);

            document.querySelectorAll('.code-geo-item, .geo-table tbody tr').forEach(item => {
                const universMatch = allUniversCheckbox && (allUniversCheckbox.checked || checkedUnivers.includes(item.dataset.univers));
                const searchMatch = (item.dataset.searchable || '').includes(searchTerm);
                const zoneMatch = (activeZone === 'all' || item.dataset.zone === activeZone);
                
                const isVisible = searchMatch && universMatch && zoneMatch;
                item.style.display = isVisible ? (item.tagName === 'TR' ? 'table-row' : 'flex') : 'none';
            });
            
            document.querySelectorAll('.univers-separator').forEach(separator => {
                const hasVisibleItems = document.querySelector(`.code-geo-item[data-univers="${separator.dataset.univers}"][style*="display: flex"]`);
                separator.style.display = hasVisibleItems ? 'block' : 'none';
            });
        }

        // --- GESTION DES ÉVÉNEMENTS (LOGIQUE SIMPLIFIÉE) ---
        if (searchInput) {
            searchInput.addEventListener('input', applyFilters);
        }
        
        universCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (checkbox.value === 'all') {
                    // Si on clique sur "Tout voir", toutes les autres cases prennent sa valeur (cochée ou décochée)
                    universCheckboxes.forEach(cb => { cb.checked = checkbox.checked; });
                } else {
                    // Si on décoche une case, "Tout voir" doit être décoché
                    if (!checkbox.checked) {
                        allUniversCheckbox.checked = false;
                    }
                    // Si toutes les cases (sauf "Tout voir") sont cochées, cocher aussi "Tout voir"
                    const specificCheckboxes = Array.from(universCheckboxes).filter(cb => cb.value !== 'all');
                    if (specificCheckboxes.every(cb => cb.checked)) {
                        allUniversCheckbox.checked = true;
                    }
                }
                applyFilters();
            });
        });
        
        zoneTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                zoneTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                applyFilters();
            });
        });

        // Appel initial pour que la vue soit correcte au chargement
        applyFilters();
    }

    // --- LOGIQUE POUR LA PAGE DE CRÉATION/ÉDITION ---
    const formPage = document.getElementById('creation-form') || document.getElementById('edit-form');
    if (formPage) {
        const codeGeoInput = document.getElementById('code_geo');
        const qrCodePreview = document.getElementById('qrcode-preview');

        const updateQRCode = () => {
             if (qrCodePreview && codeGeoInput) {
                qrCodePreview.innerHTML = '';
                const text = codeGeoInput.value.trim();
                if (text && typeof QRCode !== 'undefined') {
                    new QRCode(qrCodePreview, { text, width: 128, height: 128 });
                } else {
                    qrCodePreview.textContent = 'Saisir un code géo...';
                }
            }
        };
        
        if (codeGeoInput) {
            codeGeoInput.addEventListener('input', updateQRCode);
            updateQRCode(); // Appel pour pré-remplir sur la page d'édition
        }
    }
});
