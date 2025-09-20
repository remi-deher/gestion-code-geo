document.addEventListener('DOMContentLoaded', () => {
    const planPageContainer = document.querySelector('.plan-page-container');
    if (!planPageContainer) return;

    // --- ÉLÉMENTS DU DOM ---
    const sidebar = document.getElementById('unplaced-codes-sidebar');
    const zoomWrapper = document.getElementById('zoom-wrapper');
    const unplacedList = document.getElementById('unplaced-list');
    const unplacedCounter = document.getElementById('unplaced-counter');
    const planContainer = document.getElementById('plan-container');
    const modalElement = document.getElementById('geoCodeDetailModal');
    const geoCodeModal = new bootstrap.Modal(modalElement);
    const mapImage = document.getElementById('map-image');
    const planSelector = document.getElementById('plan-selector');
    const printBtn = document.getElementById('print-plan-btn');
    const searchInput = document.getElementById('tag-search-input');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    const accordionItems = document.querySelectorAll('.accordion-item');

    // --- ÉTAT DE L'APPLICATION ---
    let currentPlanId = null;
    let selectedTags = new Set();
    let isDragging = false, isSelecting = false;
    let selectionBox = null;
    let startX, startY;
    let dragStartPositions = new Map();
    let panzoomInstance = null;
    let lastClickTime = 0;
    let draggedItemFromSidebar = null;
    let allCodesForPlan = []; // Stockera les codes placés ET non placés pour le plan actuel

    // --- INITIALISATION ---
    panzoomInstance = Panzoom(zoomWrapper, { maxScale: 10, minScale: 0.5, excludeClass: 'geo-tag', canvas: true });
    planContainer.addEventListener('wheel', panzoomInstance.zoomWithWheel, { passive: false });
    addEventListeners();
    updateDisplayForPlan(null);

    // --- GESTION DES ÉVÉNEMENTS ---
    function addEventListeners() {
        planSelector.addEventListener('change', (e) => updateDisplayForPlan(e.target.value));
        printBtn.addEventListener('click', () => window.print());
        searchInput.addEventListener('input', applyFilters);
        zoomInBtn.addEventListener('click', () => panzoomInstance.zoomIn());
        zoomOutBtn.addEventListener('click', () => panzoomInstance.zoomOut());
        zoomResetBtn.addEventListener('click', () => panzoomInstance.reset());
        accordionItems.forEach(item => {
            item.querySelector('.accordion-header').addEventListener('click', () => item.classList.toggle('open'));
        });
        zoomWrapper.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('dragstart', handleDragStart);
        zoomWrapper.addEventListener('dragover', (e) => e.preventDefault());
        zoomWrapper.addEventListener('drop', handleDropOnPlan);
        sidebar.addEventListener('dragover', (e) => e.preventDefault());
        sidebar.addEventListener('drop', handleDropOnSidebar);
    }
    
    // --- GESTIONNAIRES D'ÉVÉNEMENTS (LOGIQUE DÉTAILLÉE) ---

    function handleMouseDown(e) {
        if (e.button !== 0) return;
        const clickedTag = e.target.closest('.geo-tag');
        startX = e.clientX;
        startY = e.clientY;

        if (clickedTag) {
            e.stopImmediatePropagation();
            isDragging = true;
            if (!selectedTags.has(clickedTag)) {
                if (!e.ctrlKey && !e.metaKey) clearSelection();
                toggleTagSelection(clickedTag);
            }
            dragStartPositions.clear();
            selectedTags.forEach(tag => {
                dragStartPositions.set(tag, { x: parseFloat(tag.style.left), y: parseFloat(tag.style.top) });
            });
            panzoomInstance.pause();
        } else {
            isSelecting = true;
            if (!e.ctrlKey && !e.metaKey) clearSelection();
            selectionBox = document.createElement('div');
            selectionBox.id = 'selection-box';
            planContainer.appendChild(selectionBox);
            updateSelectionBox(e);
        }
    }

    function handleMouseMove(e) {
        if (isDragging) {
            const scale = panzoomInstance.getScale();
            const dx = (e.clientX - startX) / (zoomWrapper.clientWidth * scale) * 100;
            const dy = (e.clientY - startY) / (zoomWrapper.clientHeight * scale) * 100;
            selectedTags.forEach(tag => {
                const startPos = dragStartPositions.get(tag);
                if (startPos) {
                    tag.style.left = `${startPos.x + dx}%`;
                    tag.style.top = `${startPos.y + dy}%`;
                }
            });
        } else if (isSelecting) {
            updateSelectionBox(e);
        }
    }

    async function handleMouseUp(e) {
        const dist = Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2));

        if (isDragging) {
            if (dist > 5) {
                const positionsToSave = Array.from(selectedTags).map(tag => ({
                    id: parseInt(tag.dataset.id),
                    x: parseFloat(tag.style.left),
                    y: parseFloat(tag.style.top)
                }));
                if (await saveMultiplePositionsAPI(positionsToSave)) {
                    flashTags(selectedTags, 'saved');
                }
            } else {
                handleTagClick(e);
            }
        } else if (isSelecting) {
            if (selectionBox) {
                selectTagsInBox();
                planContainer.removeChild(selectionBox);
                selectionBox = null;
            }
        }

        isDragging = false;
        isSelecting = false;
        panzoomInstance.resume();
    }
    
    function handleTagClick(e) {
        const clickedTag = e.target.closest('.geo-tag');
        if (!clickedTag) return;
        const currentTime = new Date().getTime();
        if (currentTime - lastClickTime < 300 && selectedTags.size === 1 && selectedTags.has(clickedTag)) {
            showDetailModal(clickedTag.dataset.id);
        } else {
            if (!e.ctrlKey && !e.metaKey) {
                clearSelection();
                toggleTagSelection(clickedTag);
            } else {
                toggleTagSelection(clickedTag);
            }
        }
        lastClickTime = currentTime;
    }
    
    function handleDragStart(e) {
        const target = e.target.closest('.unplaced-item');
        if (target) {
            draggedItemFromSidebar = target;
            e.dataTransfer.setData('text/plain', target.dataset.id);
        }
    }
    
    async function handleDropOnPlan(e) {
        e.preventDefault();
        const codeId = e.dataTransfer.getData('text/plain');
        if (!draggedItemFromSidebar || !codeId) return;

        const pan = panzoomInstance.getPan();
        const scale = panzoomInstance.getScale();
        const zoomRect = zoomWrapper.getBoundingClientRect();
        
        const x = (e.clientX - zoomRect.left - pan.x) / (zoomRect.width * scale) * 100;
        const y = (e.clientY - zoomRect.top - pan.y) / (zoomRect.height * scale) * 100;
        
        if (await saveMultiplePositionsAPI([{ id: parseInt(codeId), x: x, y: y }])) {
            const codeData = allCodesForPlan.find(c => c.id == codeId);
            if (codeData) {
                codeData.pos_x = x;
                codeData.pos_y = y;
                const newTag = createPlacedTag(codeData);
                newTag.style.left = `${x}%`;
                newTag.style.top = `${y}%`;
                zoomWrapper.appendChild(newTag);
                draggedItemFromSidebar.remove();
                applyFilters();
                flashTags(new Set([newTag]), 'saved');
            }
        }
        draggedItemFromSidebar = null;
    }

    async function handleDropOnSidebar(e) {
        e.preventDefault();
        if (selectedTags.size > 0) {
            const tagsToUnplace = new Set(selectedTags);
            clearSelection();
            for (const tag of tagsToUnplace) {
                await unplacePosition(tag.dataset.id);
            }
        }
    }
    
    function handlePillClick(e) {
        applyFilters();
    }
    
    // --- FONCTIONS DE MISE À JOUR DU DOM ---
    async function updateDisplayForPlan(planId) {
        currentPlanId = planId;
        unplacedList.innerHTML = '';
        zoomWrapper.querySelectorAll('.geo-tag').forEach(tag => tag.remove());
        panzoomInstance.reset();
        clearSelection();

        if (!planId) {
            mapImage.style.display = 'none';
            printBtn.disabled = true;
            unplacedList.innerHTML = '<p class="text-muted small">Veuillez sélectionner un plan pour voir les codes disponibles.</p>';
            applyFilters();
            return;
        }

        const selectedOption = planSelector.querySelector(`option[value="${planId}"]`);
        mapImage.src = `uploads/plans/${selectedOption.dataset.filename}`;
        mapImage.style.display = 'block';
        printBtn.disabled = false;
        
        // Charger les codes pertinents
        const unplacedCodes = await fetchAvailableCodes(planId);
        allCodesForPlan = [...placedGeoCodes, ...unplacedCodes];
        
        // Placer les étiquettes existantes
        placedGeoCodes.forEach(code => {
            if (code.plan_id == planId) {
                const tag = createPlacedTag(code);
                tag.style.left = `${code.pos_x}%`;
                tag.style.top = `${code.pos_y}%`;
                zoomWrapper.appendChild(tag);
            }
        });
        
        // Remplir la liste des codes à placer
        if(unplacedCodes.length === 0){
             unplacedList.innerHTML = '<p class="text-muted small">Aucun code disponible pour ce plan.</p>';
        } else {
            unplacedCodes.forEach(code => {
                unplacedList.appendChild(createUnplacedItem(code));
            });
        }
        
        applyFilters();
    }

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        
        let unplacedVisibleCount = 0;
        document.querySelectorAll('#unplaced-list .unplaced-item').forEach(item => {
            const searchMatch = item.dataset.code.toLowerCase().includes(searchTerm);
            item.style.display = searchMatch ? 'block' : 'none';
            if (searchMatch) unplacedVisibleCount++;
        });

        document.querySelectorAll('#zoom-wrapper .geo-tag').forEach(tag => {
            const searchMatch = tag.dataset.code.toLowerCase().includes(searchTerm);
            tag.style.display = searchMatch ? 'flex' : 'none';
        });

        unplacedCounter.textContent = `(${unplacedVisibleCount})`;
    }
    
    function createPlacedTag(code) { /* ... (inchangé) ... */ }
    function createUnplacedItem(code) { /* ... (inchangé) ... */ }
    function showDetailModal(codeId) { /* ... (inchangé) ... */ }
    function toggleTagSelection(tag) { /* ... (inchangé) ... */ }
    function clearSelection() { /* ... (inchangé) ... */ }
    function updateSelectionBox(e) { /* ... (inchangé) ... */ }
    function selectTagsInBox() { /* ... (inchangé) ... */ }
    function isColorDark(hexColor) { /* ... (inchangé) ... */ }
    function flashTags(tags, className) { /* ... (inchangé) ... */ }
    
    // --- FONCTIONS API ---
    async function fetchAvailableCodes(planId) {
        try {
            const response = await fetch(`index.php?action=getAvailableCodesForPlan&id=${planId}`);
            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error("Erreur lors de la récupération des codes:", error);
            return [];
        }
    }

    async function unplacePosition(codeId) {
        try {
            const response = await fetch(`index.php?action=removePosition`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(codeId) })
            });
            if (!response.ok) return false;
            const result = await response.json();
            if (result.status === 'success') {
                const code = allCodesForPlan.find(c => c.id == codeId);
                if (code) {
                    code.plan_id = null;
                    code.pos_x = null;
                    code.pos_y = null;
                    const tagElement = zoomWrapper.querySelector(`.geo-tag[data-id="${codeId}"]`);
                    if (tagElement) tagElement.remove();
                    unplacedList.appendChild(createUnplacedItem(code));
                    applyFilters();
                }
                return true;
            }
        } catch (error) { console.error('Erreur:', error); }
        return false;
    }

    async function saveMultiplePositionsAPI(positionsToSave) {
        if (!currentPlanId || positionsToSave.length === 0) return false;
        try {
            const response = await fetch('index.php?action=saveMultiplePositions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ positions: positionsToSave, plan_id: parseInt(currentPlanId) })
            });
            if (!response.ok) return false;
            return (await response.json()).status === 'success';
        } catch (error) {
            console.error('Erreur de sauvegarde multiple:', error);
            return false;
        }
    }
});
