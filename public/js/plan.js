document.addEventListener('DOMContentLoaded', () => {
    // --- Récupération des éléments du DOM ---
    const planContainer = document.getElementById('plan-container');
    const unplacedList = document.getElementById('unplaced-list');
    const mapImage = document.getElementById('map-image');
    const planSelector = document.getElementById('plan-selector');
    const printBtn = document.getElementById('print-plan-btn');
    const placeholder = document.getElementById('plan-placeholder');

    // Vérification de la présence des éléments
    if (!planContainer || !unplacedList || !mapImage || !planSelector || typeof geoCodesData === 'undefined') {
        console.error('Éléments de la page du plan manquants ou données non chargées.');
        return;
    }

    let currentPlanId = null;

    // --- FONCTIONS ---

    /**
     * Crée une étiquette (tag) déplaçable pour un code géo.
     */
    function createTag(code) {
        const tag = document.createElement('div');
        tag.className = 'geo-tag';
        tag.textContent = code.code_geo;
        tag.dataset.id = code.id;
        tag.draggable = true;

        const tooltip = document.createElement('span');
        tooltip.className = 'tag-tooltip';
        tooltip.textContent = code.libelle || 'Pas de libellé';
        tag.appendChild(tooltip);

        return tag;
    }

    /**
     * Met à jour l'affichage en fonction du plan sélectionné.
     */
    function updateDisplayForPlan(planId) {
        currentPlanId = planId;
        
        // Nettoyage de l'interface
        unplacedList.innerHTML = '';
        planContainer.querySelectorAll('.geo-tag').forEach(tag => tag.remove());

        if (!planId) {
            mapImage.style.display = 'none';
            placeholder.style.display = 'block';
            printBtn.disabled = true;
            return;
        }

        // Affiche la bonne image de plan
        const selectedOption = planSelector.querySelector(`option[value="${planId}"]`);
        mapImage.src = `uploads/plans/${selectedOption.dataset.filename}`;
        mapImage.style.display = 'block';
        placeholder.style.display = 'none';
        printBtn.disabled = false;
        
        // Filtre et affiche les étiquettes
        const placedCodesIds = new Set();
        geoCodesData.forEach(code => {
            if (code.plan_id == planId && code.pos_x != null && code.pos_y != null) {
                const tag = createTag(code);
                tag.style.left = `${code.pos_x}%`;
                tag.style.top = `${code.pos_y}%`;
                planContainer.appendChild(tag);
                placedCodesIds.add(code.id.toString());
            }
        });
        
        // Remplit la liste des codes non placés
        geoCodesData.forEach(code => {
            if (!placedCodesIds.has(code.id.toString()) && code.plan_id != planId) {
                 unplacedList.appendChild(createTag(code));
            }
        });
    }

    /**
     * Sauvegarde la position d'une étiquette via Fetch API.
     */
    async function savePosition(id, x, y) {
        if (!currentPlanId) return; // Ne sauvegarde rien si aucun plan n'est sélectionné

        try {
            const response = await fetch('index.php?action=savePosition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: parseInt(id),
                    plan_id: parseInt(currentPlanId),
                    x: Math.round(x),
                    y: Math.round(y)
                })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            // Met à jour les données locales pour ne pas avoir à recharger la page
            const code = geoCodesData.find(c => c.id == id);
            if(code) {
                code.plan_id = currentPlanId;
                code.pos_x = x;
                code.pos_y = y;
            }

        } catch (error) {
            console.error('Erreur lors de la sauvegarde de la position :', error);
        }
    }

    // --- GESTION DES ÉVÉNEMENTS ---

    planSelector.addEventListener('change', (e) => {
        updateDisplayForPlan(e.target.value);
    });

    printBtn.addEventListener('click', () => {
        window.print();
    });

    // --- LOGIQUE DE DRAG & DROP ---
    let draggedTag = null;

    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('geo-tag')) {
            draggedTag = e.target;
            setTimeout(() => {
                if (draggedTag) draggedTag.style.opacity = '0.5';
            }, 0);
        }
    });

    document.addEventListener('dragend', () => {
        if (draggedTag) {
            draggedTag.style.opacity = '1';
            draggedTag = null;
        }
    });

    planContainer.addEventListener('dragover', (e) => {
        e.preventDefault(); 
    });

    planContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedTag && currentPlanId) {
            const mapRect = mapImage.getBoundingClientRect();
            let x = ((e.clientX - mapRect.left) / mapRect.width) * 100;
            let y = ((e.clientY - mapRect.top) / mapRect.height) * 100;
            
            x = Math.max(0, Math.min(100, x));
            y = Math.max(0, Math.min(100, y));

            draggedTag.style.left = `${x}%`;
            draggedTag.style.top = `${y}%`;

            if (draggedTag.parentElement !== planContainer) {
                 planContainer.appendChild(draggedTag);
            }
            
            savePosition(draggedTag.dataset.id, x, y);
        }
    });

    // Initialisation
    updateDisplayForPlan(null);
});
