document.addEventListener('DOMContentLoaded', () => {
    const planContainer = document.getElementById('plan-container');
    const unplacedList = document.getElementById('unplaced-list');
    const mapImage = document.getElementById('map-image');

    // Vérification de la présence des éléments essentiels
    if (!planContainer || !unplacedList || !mapImage || typeof geoCodesData === 'undefined') {
        console.error('Éléments requis pour la page du plan manquants ou données non chargées.');
        return;
    }

    // --- FONCTIONS ---

    /**
     * Crée une étiquette (tag) déplaçable pour un code géo.
     * @param {object} code - Les données du code géo.
     * @returns {HTMLElement} L'élément HTML de l'étiquette.
     */
    function createTag(code) {
        const tag = document.createElement('div');
        tag.className = 'geo-tag';
        tag.textContent = code.code_geo;
        tag.dataset.id = code.id;
        tag.draggable = true;

        // Création de l'infobulle (tooltip)
        if (code.libelle) {
            const tooltip = document.createElement('span');
            tooltip.className = 'tag-tooltip';
            tooltip.textContent = code.libelle;
            tag.appendChild(tooltip);
        }

        return tag;
    }

    /**
     * Sauvegarde la position d'une étiquette via un appel AJAX (Fetch API).
     * @param {number} id - L'ID du code géo.
     * @param {number} x - La coordonnée x en pourcentage.
     * @param {number} y - La coordonnée y en pourcentage.
     */
    async function savePosition(id, x, y) {
        try {
            const response = await fetch('index.php?action=savePosition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: parseInt(id),
                    x: Math.round(x),
                    y: Math.round(y)
                })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            if (result.status !== 'success') {
                console.error('Échec de la sauvegarde de la position :', result.message);
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de la position :', error);
        }
    }

    // --- INITIALISATION ---

    // Peuplement de la barre latérale et de la carte avec les codes existants
    geoCodesData.forEach(code => {
        const tag = createTag(code);
        if (code.pos_x != null && code.pos_y != null) {
            tag.style.left = `${code.pos_x}%`;
            tag.style.top = `${code.pos_y}%`;
            planContainer.appendChild(tag);
        } else {
            unplacedList.appendChild(tag);
        }
    });

    // --- LOGIQUE DE DRAG & DROP ---
    let draggedTag = null;

    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('geo-tag')) {
            draggedTag = e.target;
            // Ajoute un effet visuel pendant le glissement
            setTimeout(() => {
                draggedTag.style.opacity = '0.5';
            }, 0);
        }
    });

    document.addEventListener('dragend', (e) => {
        if (draggedTag) {
            // Rétablit l'apparence normale
            draggedTag.style.opacity = '1';
            draggedTag = null;
        }
    });

    planContainer.addEventListener('dragover', (e) => {
        e.preventDefault(); // Nécessaire pour autoriser le drop
    });

    planContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedTag) {
            const mapRect = mapImage.getBoundingClientRect();
            // Calcule la position relative à l'image en pourcentage
            let x = ((e.clientX - mapRect.left) / mapRect.width) * 100;
            let y = ((e.clientY - mapRect.top) / mapRect.height) * 100;

            // Contraint les valeurs entre 0 et 100
            x = Math.max(0, Math.min(100, x));
            y = Math.max(0, Math.min(100, y));

            draggedTag.style.left = `${x}%`;
            draggedTag.style.top = `${y}%`;

            // Ajoute l'élément au conteneur du plan s'il vient de la barre latérale
            if (draggedTag.parentElement !== planContainer) {
                 planContainer.appendChild(draggedTag);
            }
            
            savePosition(draggedTag.dataset.id, x, y);
        }
    });
});
