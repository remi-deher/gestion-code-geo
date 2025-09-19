document.addEventListener('DOMContentLoaded', () => {
    // --- Récupération des éléments du DOM ---
    const planContainer = document.getElementById('plan-container');
    const zoomWrapper = document.getElementById('zoom-wrapper'); // Le nouvel élément à zoomer
    const unplacedList = document.getElementById('unplaced-list');
    const mapImage = document.getElementById('map-image');
    const planSelector = document.getElementById('plan-selector');
    const printBtn = document.getElementById('print-plan-btn');
    const placeholder = document.getElementById('plan-placeholder');
    
    // Filtres
    const searchInput = document.getElementById('tag-search-input');
    const universFiltersCheckboxes = document.querySelectorAll('#univers-filter-options input[type="checkbox"]');

    // NOUVEAU : Éléments pour le zoom
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');

    // Initialisation de Panzoom (il sera activé quand un plan est chargé)
    const panzoom = Panzoom(zoomWrapper, {
        maxScale: 5,
        minScale: 0.5,
        // Exclut les étiquettes du "pan" pour permettre le drag-and-drop
        excludeClass: 'geo-tag' 
    });
    // On désactive le zoom à la molette par défaut pour ne pas gêner le scroll
    planContainer.addEventListener('wheel', panzoom.zoomWithWheel, { passive: false });


    let currentPlanId = null;

    // --- FONCTIONS ---
    
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const checkedUnivers = Array.from(universFiltersCheckboxes)
            .filter(cb => cb.checked && cb.value !== 'all')
            .map(cb => cb.value);

        document.querySelectorAll('.geo-tag').forEach(tag => {
            const tagCode = tag.textContent.toLowerCase();
            const tagUnivers = tag.dataset.univers;
            const searchMatch = tagCode.includes(searchTerm);
            const universMatch = checkedUnivers.includes(tagUnivers);
            tag.style.display = (searchMatch && universMatch) ? 'flex' : 'none'; // Utilise flex pour centrer le texte
        });
    }

    function createTag(code) {
        const tag = document.createElement('div');
        tag.className = 'geo-tag';
        tag.textContent = code.code_geo;
        tag.dataset.id = code.id;
        tag.dataset.univers = code.univers;
        tag.draggable = true;
        
        // Applique un style au lieu de le mettre inline
        tag.style.setProperty('--tag-bg-color', universColors[code.univers] || '#7f8c8d');

        const tooltip = document.createElement('span');
        tooltip.className = 'tag-tooltip';
        tooltip.textContent = `${code.libelle} (${code.univers})` || 'Pas de libellé';
        tag.appendChild(tooltip);

        return tag;
    }

    function updateDisplayForPlan(planId) {
        currentPlanId = planId;
        
        unplacedList.innerHTML = '';
        zoomWrapper.querySelectorAll('.geo-tag').forEach(tag => tag.remove());
        panzoom.reset(); // Réinitialise le zoom/pan

        if (!planId) {
            mapImage.style.display = 'none';
            placeholder.style.display = 'block';
            printBtn.disabled = true;
            applyFilters();
            return;
        }

        const selectedOption = planSelector.querySelector(`option[value="${planId}"]`);
        mapImage.src = `uploads/plans/${selectedOption.dataset.filename}`;
        mapImage.style.display = 'block';
        placeholder.style.display = 'none';
        printBtn.disabled = false;
        
        const placedCodesIds = new Set();
        geoCodesData.forEach(code => {
            if (code.plan_id == planId && code.pos_x != null && code.pos_y != null) {
                const tag = createTag(code);
                tag.style.left = `${code.pos_x}%`;
                tag.style.top = `${code.pos_y}%`;
                zoomWrapper.appendChild(tag); // Ajoute l'étiquette au wrapper zoomable
                placedCodesIds.add(code.id.toString());
            }
        });
        
        geoCodesData.forEach(code => {
            if (!placedCodesIds.has(code.id.toString()) && code.plan_id != planId) {
                 unplacedList.appendChild(createTag(code));
            }
        });
        
        applyFilters();
    }

    async function savePosition(id, x, y) {
        // ... (cette fonction reste inchangée)
        if (!currentPlanId) return;
        try {
            const response = await fetch('index.php?action=savePosition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(id), plan_id: parseInt(currentPlanId), x: Math.round(x), y: Math.round(y) })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const code = geoCodesData.find(c => c.id == id);
            if(code) { code.plan_id = currentPlanId; code.pos_x = x; code.pos_y = y; }
        } catch (error) { console.error('Erreur lors de la sauvegarde de la position :', error); }
    }

    // --- GESTION DES ÉVÉNEMENTS ---
    planSelector.addEventListener('change', (e) => updateDisplayForPlan(e.target.value));
    printBtn.addEventListener('click', () => window.print());
    searchInput.addEventListener('input', applyFilters);
    universFiltersCheckboxes.forEach(checkbox => checkbox.addEventListener('change', (event) => { /* ... (logique de filtrage inchangée) ... */
            const allCheckbox = document.querySelector('#univers-filter-options input[value="all"]');
            if (event.target.value === 'all') { universFiltersCheckboxes.forEach(cb => cb.checked = event.target.checked);
            } else {
                if (!event.target.checked) { allCheckbox.checked = false; }
                else { const allOthersChecked = Array.from(universFiltersCheckboxes).filter(cb => cb.value !== 'all').every(cb => cb.checked); allCheckbox.checked = allOthersChecked; }
            }
            applyFilters();
        }));
    
    // NOUVEAU : Connexion des boutons de zoom à l'API Panzoom
    zoomInBtn.addEventListener('click', () => panzoom.zoomIn());
    zoomOutBtn.addEventListener('click', () => panzoom.zoomOut());
    zoomResetBtn.addEventListener('click', () => panzoom.reset());

    // --- LOGIQUE DE DRAG & DROP (légèrement modifiée) ---
    let draggedTag = null;
    document.addEventListener('dragstart', (e) => { /* ... (inchangé) ... */
        if (e.target.classList.contains('geo-tag')) {
            draggedTag = e.target;
            setTimeout(() => { if (draggedTag) draggedTag.style.opacity = '0.5'; }, 0);
        }
    });
    document.addEventListener('dragend', () => { /* ... (inchangé) ... */
        if (draggedTag) { draggedTag.style.opacity = '1'; draggedTag = null; }
    });

    // On écoute maintenant le drop sur le wrapper et non plus le container
    zoomWrapper.addEventListener('dragover', (e) => { e.preventDefault(); });
    zoomWrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedTag && currentPlanId) {
            // Calcule la position relative au wrapper qui est zoomé
            const zoomRect = zoomWrapper.getBoundingClientRect();
            let x = ((e.clientX - zoomRect.left) / zoomRect.width) * 100;
            let y = ((e.clientY - zoomRect.top) / zoomRect.height) * 100;
            
            x = Math.max(0, Math.min(100, x));
            y = Math.max(0, Math.min(100, y));

            draggedTag.style.left = `${x}%`;
            draggedTag.style.top = `${y}%`;

            if (draggedTag.parentElement !== zoomWrapper) {
                 zoomWrapper.appendChild(draggedTag);
            }
            
            savePosition(draggedTag.dataset.id, x, y);
        }
    });

    updateDisplayForPlan(null); // Initialisation
});
