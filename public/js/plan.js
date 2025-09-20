document.addEventListener('DOMContentLoaded', () => {
    // --- VÉRIFICATION INITIALE ---
    const planPageContainer = document.querySelector('.plan-page-container');
    if (!planPageContainer) {
        return; // Stoppe le script si on n'est pas sur la page du plan
    }

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
    let isDragging = false;
    let isSelecting = false;
    let selectionBox = null;
    let startX, startY;
    let dragStartPositions = new Map();
    let panzoomInstance = null;
    let lastClickTime = 0;
    let draggedItemFromSidebar = null;
    let allCodesData = []; // Variable unique pour stocker tous les codes (placés et non placés)

    // --- INITIALISATION ---
    panzoomInstance = Panzoom(zoomWrapper, {
        maxScale: 10,
        minScale: 0.5,
        excludeClass: 'geo-tag',
        canvas: true
    });
    addEventListeners();
    updateDisplayForPlan(null);

    // --- GESTION DES ÉVÉNEMENTS ---
    function addEventListeners() {
        planContainer.addEventListener('wheel', panzoomInstance.zoomWithWheel, { passive: false });
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
        
        // On charge les codes non placés pour ce plan
        const unplacedCodes = await fetchAvailableCodes(planId);
        // On combine avec les codes déjà placés (passés par PHP)
        allCodesData = [...placedGeoCodes, ...unplacedCodes];
        
        // On affiche les étiquettes déjà placées sur ce plan
        placedGeoCodes.forEach(code => {
            if (code.plan_id == planId) {
                const tag = createPlacedTag(code);
                tag.style.left = `${code.pos_x}%`;
                tag.style.top = `${code.pos_y}%`;
                zoomWrapper.appendChild(tag);
            }
        });
        
        // On remplit la liste des codes à placer
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
            if (searchMatch) {
                item.style.display = 'block';
                unplacedVisibleCount++;
            } else {
                item.style.display = 'none';
            }
        });

        document.querySelectorAll('#zoom-wrapper .geo-tag').forEach(tag => {
            const searchMatch = tag.dataset.code.toLowerCase().includes(searchTerm);
            tag.style.display = searchMatch ? 'flex' : 'none';
        });

        unplacedCounter.textContent = `(${unplacedVisibleCount})`;
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
            panzoomInstance.setOptions({ disablePan: true });
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
                const positionsToSave = Array.from(selectedTags).map(tag => {
                    const newPosition = { id: parseInt(tag.dataset.id), x: parseFloat(tag.style.left), y: parseFloat(tag.style.top) };
                    const code = allCodesData.find(c => c.id == tag.dataset.id);
                    if (code) { code.pos_x = newPosition.x; code.pos_y = newPosition.y; }
                    return newPosition;
                });
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
        panzoomInstance.setOptions({ disablePan: false });
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
            const codeData = allCodesData.find(c => c.id == codeId);
            if (codeData) {
                codeData.pos_x = x;
                codeData.pos_y = y;
                codeData.plan_id = currentPlanId;
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
    
    // --- FONCTIONS DE CRÉATION ET MODIFICATION D'ÉLÉMENTS ---
    function createPlacedTag(code) {
        const tag = document.createElement('div');
        tag.className = 'geo-tag';
        tag.textContent = code.code_geo;
        tag.dataset.id = code.id;
        tag.dataset.univers = code.univers;
        tag.dataset.code = code.code_geo;
        tag.dataset.isPlaced = 'true';
        tag.style.setProperty('--tag-bg-color', universColors[code.univers] || '#7f8c8d');
        tag.style.backgroundColor = 'var(--tag-bg-color)';
        tag.style.color = isColorDark(tag.style.backgroundColor) ? '#FFFFFF' : '#333333';
        const tooltip = document.createElement('span');
        tooltip.className = 'tag-tooltip';
        tooltip.textContent = `${code.libelle} (${code.univers})`;
        tag.appendChild(tooltip);
        return tag;
    }
    
    function createUnplacedItem(code) {
        const item = document.createElement('div');
        item.className = 'unplaced-item';
        item.dataset.id = code.id;
        item.dataset.univers = code.univers;
        item.dataset.code = code.code_geo;
        item.draggable = true;
        item.innerHTML = `<span class="item-code" style="color: ${universColors[code.univers] || '#7f8c8d'}">${code.code_geo}</span><span class="item-libelle">${code.libelle}</span>`;
        return item;
    }

    function showDetailModal(codeId) {
        const codeData = allCodesData.find(c => c.id == codeId);
        if (!codeData) return;
        document.getElementById('modal-code-geo').textContent = codeData.code_geo;
        document.getElementById('modal-libelle').textContent = codeData.libelle;
        document.getElementById('modal-univers').textContent = codeData.univers;
        document.getElementById('modal-commentaire').textContent = codeData.commentaire || 'Aucun';
        document.getElementById('modal-edit-btn').href = `index.php?action=edit&id=${codeId}`;
        const unplaceBtn = document.getElementById('modal-unplace-btn');
        unplaceBtn.onclick = async () => {
            geoCodeModal.hide();
            await unplacePosition(codeId);
        };
        geoCodeModal.show();
    }
    
    // --- FONCTIONS DE SÉLECTION ---
    function toggleTagSelection(tag) {
        tag.classList.toggle('selected');
        selectedTags[selectedTags.has(tag) ? 'delete' : 'add'](tag);
    }
    function clearSelection() {
        selectedTags.forEach(tag => tag.classList.remove('selected'));
        selectedTags.clear();
    }
    function updateSelectionBox(e) {
        const planRect = planContainer.getBoundingClientRect();
        const mouseX = e.clientX - planRect.left;
        const mouseY = e.clientY - planRect.top;
        const boxStartX = startX - planRect.left;
        const boxStartY = startY - planRect.top;
        selectionBox.style.left = `${Math.min(boxStartX, mouseX)}px`;
        selectionBox.style.top = `${Math.min(boxStartY, mouseY)}px`;
        selectionBox.style.width = `${Math.abs(boxStartX - mouseX)}px`;
        selectionBox.style.height = `${Math.abs(boxStartY - mouseY)}px`;
    }
    function selectTagsInBox() {
        if (!selectionBox) return;
        const boxRect = selectionBox.getBoundingClientRect();
        zoomWrapper.querySelectorAll('.geo-tag').forEach(tag => {
            if (tag.style.display === 'none') return;
            const tagRect = tag.getBoundingClientRect();
            if (boxRect.left < tagRect.right && boxRect.right > tagRect.left && boxRect.top < tagRect.bottom && boxRect.bottom > tagRect.top) {
                if (!selectedTags.has(tag)) toggleTagSelection(tag);
            }
        });
    }

    // --- FONCTIONS API & UTILITAIRES ---
    function isColorDark(hexColor) {
        if (!hexColor || !hexColor.startsWith('#')) return false;
        const rgb = parseInt(hexColor.substring(1), 16);
        const [r, g, b] = [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff];
        return (r * 299 + g * 587 + b * 114) / 1000 < 128;
    }
    function flashTags(tags, className) {
        tags.forEach(tag => {
            tag.classList.remove(className);
            void tag.offsetWidth;
            tag.classList.add(className);
            tag.addEventListener('animationend', () => tag.classList.remove(className), { once: true });
        });
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
                const code = allCodesData.find(c => c.id == codeId);
                if (code) {
                    code.plan_id = null; code.pos_x = null; code.pos_y = null;
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
    
    async function fetchAvailableCodes(planId) {
        try {
            const url = `index.php?action=getAvailableCodesForPlan&id=${planId}`;
            const response = await fetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error("Erreur lors de la récupération des codes:", error);
            return [];
        }
    }
});
