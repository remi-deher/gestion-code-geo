document.addEventListener('DOMContentLoaded', () => {
    
    // --- Common logic ---
    const searchInput = document.getElementById('recherche');

    // --- LOGIC FOR THE LIST PAGE ---
    const listeContainer = document.getElementById('liste-geocodes');
    if (listeContainer) {
        // Generate QR Codes
        document.querySelectorAll('.qr-code-container').forEach(container => {
            const codeText = container.dataset.code;
            if (codeText) new QRCode(container, { text: codeText, width: 80, height: 80 });
        });

        // Search filter
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const searchTerm = searchInput.value.toLowerCase();
                document.querySelectorAll('.code-geo-item').forEach(item => {
                    const searchableText = item.dataset.searchable || '';
                    item.style.display = searchableText.includes(searchTerm) ? '' : 'none';
                });
            });
        }

        // Universe filtering
        const universFilters = document.querySelectorAll('#filtres-univers input[type="checkbox"]');
        universFilters.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const allCheckbox = document.querySelector('#filtres-univers input[value="all"]');
                
                // Handle "Select All" checkbox
                if (checkbox.value === 'all' && checkbox.checked) {
                    universFilters.forEach(cb => cb.checked = true);
                } else if (checkbox.value !== 'all' && !checkbox.checked) {
                    allCheckbox.checked = false;
                } else if (Array.from(universFilters).every(cb => cb.value === 'all' || cb.checked)) {
                    allCheckbox.checked = true;
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

    // --- LOGIC FOR THE CREATE PAGE ---
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
