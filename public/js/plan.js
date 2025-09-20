document.addEventListener('DOMContentLoaded', () => {
    // --- Récupération des éléments du DOM ---
    const sidebar = document.getElementById('unplaced-codes-sidebar');
    const zoomWrapper = document.getElementById('zoom-wrapper');
    const unplacedList = document.getElementById('unplaced-list');
    const unplacedCounter = document.getElementById('unplaced-counter');
    const mapImage = document.getElementById('map-image');
    const planSelector = document.getElementById('plan-selector');
    const printBtn = document.getElementById('print-plan-btn');
    const searchInput = document.getElementById('tag-search-input');
    const universFiltersCheckboxes = document.querySelectorAll('#univers-filter-options input[type="checkbox"]');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    const accordionItems = document.querySelectorAll('.accordion-item');

    // Initialisation de Panzoom
    const panzoom = Panzoom(zoomWrapper, { maxScale: 5, minScale: 0.5, excludeClass: 'geo-tag' });
    zoomWrapper.parentElement.addEventListener('wheel', panzoom.zoomWithWheel, { passive: false });

    let currentPlanId = null;

    // --- FONCTIONS ---
    
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const checkedUnivers = Array.from(universFiltersCheckboxes)
            .filter(cb => cb.checked && cb.value !== 'all')
            .map(cb => cb.value);

        let unplacedVisibleCount = 0;
        
        // Filtre la liste des codes à placer
        document.querySelectorAll('#unplaced-list .unplaced-item').forEach(item => {
            const itemCode = item.dataset.code.toLowerCase();
            const itemUnivers = item.dataset.univers;
            const searchMatch = itemCode.includes(searchTerm);
            const universMatch = checkedUnivers.includes(itemUnivers);
            
            if (searchMatch && universMatch) {
                item.style.display = 'block';
                unplacedVisibleCount++;
            } else {
                item.style.display = 'none';
            }
        });

        // Filtre les étiquettes sur le plan
        document.querySelectorAll('#zoom-wrapper .geo-tag').forEach(tag => {
            const tagCode = tag.dataset.code.toLowerCase();
            const tagUnivers = tag.dataset.univers;
            const searchMatch = tagCode.includes(searchTerm);
            const universMatch = checkedUnivers.includes(tagUnivers);
            tag.style.display = (searchMatch && universMatch) ? 'flex' : 'none';
        });

        unplacedCounter.textContent = `(${unplacedVisibleCount})`;
    }

    /**
     * Crée une étiquette sur le plan
     */
    function createPlacedTag(code) {
        const tag = document.createElement('div');
        tag.className = 'geo-tag';
        tag.textContent = code.code_geo;
        tag.dataset.id = code.id;
        tag.dataset.univers = code.univers;
        tag.dataset.code = code.code_geo;
        tag.dataset.isPlaced = 'true'; // Marqueur pour savoir qu'elle vient du plan
        tag.draggable = true;
        tag.style.backgroundColor = universColors[code.univers] || '#7f8c8d';
        tag.style.color = isColorDark(tag.style.backgroundColor) ? '#FFFFFF' : '#333333';
        
        const tooltip = document.createElement('span');
        tooltip.className = 'tag-tooltip';
        tooltip.textContent = `${code.libelle} (${code.univers})`;
        tag.appendChild(tooltip);
        return tag;
    }

    /**
     * Crée un élément dans la liste des codes à placer
     */
    function createUnplacedItem(code) {
        const item = document.createElement('div');
        item.className = 'unplaced-item';
        item.dataset.id = code.id;
        item.dataset.univers = code.univers;
        item.dataset.code = code.code_geo;
        item.draggable = true;
        item.innerHTML = `
            <span class="item-code" style="color: ${universColors[code.univers] || '#7f8c8d'}">${code.code_geo}</span>
            <span class="item-libelle">${code.libelle}</span>
        `;
        return item;
    }

    function isColorDark(hexColor) {
        if (!hexColor.startsWith('#')) return false; // Gestion simple d'erreur
        const rgb = parseInt(hexColor.substring(1), 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = (rgb >> 0) & 0xff;
        return (r * 299 + g * 587 + b * 114) / 1000 < 128;
    }

    function updateDisplayForPlan(planId) {
        currentPlanId = planId;
        unplacedList.innerHTML = '';
        zoomWrapper.querySelectorAll('.geo-tag').forEach(tag => tag.remove());
        panzoom.reset();

        if (!planId) {
            mapImage.style.display = 'none';
            printBtn.disabled = true;
        } else {
            const selectedOption = planSelector.querySelector(`option[value="${planId}"]`);
            mapImage.src = `uploads/plans/${selectedOption.dataset.filename}`;
            mapImage.style.display = 'block';
            printBtn.disabled = false;
        }

        const placedCodesIds = new Set();
        geoCodesData.forEach(code => {
            if (code.plan_id == planId && code.pos_x != null) {
                const tag = createPlacedTag(code);
                tag.style.left = `${code.pos_x}%`;
                tag.style.top = `${code.pos_y}%`;
                zoomWrapper.appendChild(tag);
                placedCodesIds.add(code.id.toString());
            }
        });
        
        geoCodesData.forEach(code => {
            if (!placedCodesIds.has(code.id.toString())) {
                unplacedList.appendChild(createUnplacedItem(code));
            }
        });
        
        applyFilters();
    }

    async function savePosition(id, x, y) {
        if (!currentPlanId) return false;
        try {
            const response = await fetch('index.php?action=savePosition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(id), plan_id: parseInt(currentPlanId), x: Math.round(x), y: Math.round(y) })
            });
            if (!response.ok) return false;
            const result = await response.json();
            if (result.status === 'success') {
                const code = geoCodesData.find(c => c.id == id);
                if(code) { code.plan_id = currentPlanId; code.pos_x = x; code.pos_y = y; }
                return true;
            }
        } catch (error) { console.error('Erreur:', error); }
        return false;
    }

    async function unplacePosition(id) {
        try {
            const response = await fetch('index.php?action=removePosition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(id) })
            });
            if (!response.ok) return false;
            const result = await response.json();
            if (result.status === 'success') {
                const code = geoCodesData.find(c => c.id == id);
                if(code) { code.plan_id = null; code.pos_x = null; code.pos_y = null; }
                return true;
            }
        } catch (error) { console.error('Erreur:', error); }
        return false;
    }

    // --- GESTION DES ÉVÉNEMENTS ---
    planSelector.addEventListener('change', (e) => updateDisplayForPlan(e.target.value));
    printBtn.addEventListener('click', () => window.print());
    searchInput.addEventListener('input', applyFilters);
    universFiltersCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (event) => {
            const allCheckbox = document.querySelector('#univers-filter-options input[value="all"]');
            if (event.target.value === 'all') {
                universFiltersCheckboxes.forEach(cb => cb.checked = event.target.checked);
            } else {
                if (!event.target.checked) {
                    allCheckbox.checked = false;
                } else {
                    const allOthersChecked = Array.from(universFiltersCheckboxes)
                        .filter(cb => cb.value !== 'all')
                        .every(cb => cb.checked);
                    allCheckbox.checked = allOthersChecked;
                }
            }
            applyFilters();
        });
    });

    zoomInBtn.addEventListener('click', () => panzoom.zoomIn());
    zoomOutBtn.addEventListener('click', () => panzoom.zoomOut());
    zoomResetBtn.addEventListener('click', () => panzoom.reset());
    accordionItems.forEach(item => {
        item.querySelector('.accordion-header').addEventListener('click', () => {
            item.classList.toggle('open');
        });
    });

    // --- LOGIQUE DE DRAG & DROP ---
    let draggedElement = null;
    document.addEventListener('dragstart', (e) => {
        // On s'assure de prendre le parent si on clique sur un span à l'intérieur
        const target = e.target.closest('.geo-tag, .unplaced-item');
        if (target) {
            draggedElement = target;
            setTimeout(() => { if (draggedElement) draggedElement.style.opacity = '0.5'; }, 0);
        }
    });

    document.addEventListener('dragend', () => {
        if (draggedElement) {
            draggedElement.style.opacity = '1';
            draggedElement = null;
        }
    });

    // Drop sur le plan
    zoomWrapper.addEventListener('dragover', (e) => e.preventDefault());
    zoomWrapper.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (!draggedElement || !currentPlanId) return;

        const codeId = draggedElement.dataset.id;
        const codeData = geoCodesData.find(c => c.id == codeId);
        
        const zoomRect = zoomWrapper.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((e.clientX - zoomRect.left) / zoomRect.width) * 100));
        const y = Math.max(0, Math.min(100, ((e.clientY - zoomRect.top) / zoomRect.height) * 100));

        const success = await savePosition(codeId, x, y);
        if (success) {
            if (!draggedElement.dataset.isPlaced) { // Vient de la liste
                const newTag = createPlacedTag(codeData);
                newTag.style.left = `${x}%`;
                newTag.style.top = `${y}%`;
                zoomWrapper.appendChild(newTag);
                draggedElement.remove();
            } else { // Déjà sur le plan
                draggedElement.style.left = `${x}%`;
                draggedElement.style.top = `${y}%`;
            }
            applyFilters();
        }
    });

    // Drop sur la sidebar
    sidebar.addEventListener('dragover', (e) => e.preventDefault());
    sidebar.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (!draggedElement || !draggedElement.dataset.isPlaced) return; // Doit venir du plan

        const codeId = draggedElement.dataset.id;
        const success = await unplacePosition(codeId);
        if(success) {
            const codeData = geoCodesData.find(c => c.id == codeId);
            unplacedList.appendChild(createUnplacedItem(codeData));
            draggedElement.remove();
            applyFilters();
        }
    });

    updateDisplayForPlan(null); // Initialisation
});
