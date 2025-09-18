document.addEventListener('DOMContentLoaded', () => {
    
    // --- Logique commune à plusieurs pages ---
    const searchInput = document.getElementById('recherche');
    const printButton = document.getElementById('print-btn');
    if(printButton) {
        printButton.addEventListener('click', () => window.print());
    }

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

