document.addEventListener('DOMContentLoaded', () => {
    
    // --- Logique commune à plusieurs pages ---
    const searchInput = document.getElementById('recherche');

    // --- Logique pour la page LISTE ---
    const listeContainer = document.getElementById('liste-geocodes');
    if (listeContainer) {
        // Génération des QR Codes
        document.querySelectorAll('.qr-code-container').forEach(container => {
            const codeText = container.dataset.code;
            if (codeText) new QRCode(container, { text: codeText, width: 80, height: 80 });
        });

        // Filtrage de la recherche
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const searchTerm = searchInput.value.toLowerCase();
                document.querySelectorAll('.code-geo-item').forEach(item => {
                    const searchableText = item.dataset.searchable || '';
                    item.style.display = searchableText.includes(searchTerm) ? '' : 'none';
                });
            });
        }

        // NOUVEAU : Filtrage par univers
        const universFilters = document.querySelectorAll('#filtres-univers input[type="checkbox"]');
        universFilters.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const allCheckbox = document.querySelector('#filtres-univers input[value="all"]');
                
                // Gérer la case "Tout voir"
                if (checkbox.value === 'all' && checkbox.checked) {
                    universFilters.forEach(cb => cb.checked = true);
                } else if (checkbox.value !== 'all' && !checkbox.checked) {
                    allCheckbox.checked = false;
                }

                const checkedUnivers = Array.from(universFilters)
                                            .filter(cb => cb.checked && cb.value !== 'all')
                                            .map(cb => cb.value);

                document.querySelectorAll('.code-geo-item, .univers-separator').forEach(item => {
                    const itemUnivers = item.dataset.univers;
                    item.style.display = checkedUnivers.includes(itemUnivers) ? '' : 'none';
                });
            });
        });

    }

    // --- Logique pour la page CRÉATION ---
    const creationForm = document.getElementById('creation-form');
    if (creationForm) {
        const codeGeoInput = document.getElementById('code_geo');
        const qrCodePreview = document.getElementById('qrcode-preview');

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
});
