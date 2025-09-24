document.addEventListener('DOMContentLoaded', () => {
    const planPageContainer = document.querySelector('.plan-page-container');
    if (!planPageContainer) return;

    // --- ÉLEMENTS DU DOM ---
    const canvas = document.getElementById('plan-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const mapImage = document.getElementById('map-image');
    const planSelector = document.getElementById('plan-selector');
    const unplacedList = document.getElementById('unplaced-list');
    const searchInput = document.getElementById('tag-search-input');
    const unplacedCounter = document.getElementById('unplaced-counter');
    const planContainer = document.getElementById('plan-container');
    const planPlaceholder = document.getElementById('plan-placeholder');
    
    // Éléments de la modale
    const tagActionModal = new bootstrap.Modal(document.getElementById('tag-action-modal'));
    const modalTitle = document.getElementById('tagActionModalLabel');
    const modalAddArrowBtn = document.getElementById('modal-add-arrow-btn');
    const modalDeleteBtn = document.getElementById('modal-delete-btn');

    // --- ÉTAT DE L'APPLICATION ---
    let allCodesData = [...placedGeoCodes];
    let currentPlanId = null;
    let isPlacementMode = false;
    let placementCodeId = null;

    let scale = 1, panX = 0, panY = 0;
    let isPanning = false, isDraggingTag = false, isResizing = false, isDrawingArrow = false;
    let panStart = { x: 0, y: 0 };
    let selectedTagId = null, draggedTagId = null;
    let resizeHandle = null;

    const DEFAULT_TAG_WIDTH = 80;
    const DEFAULT_TAG_HEIGHT = 22;

    function initialize() {
        resizeCanvas();
        addEventListeners();
        updateDisplayForPlan(planSelector.value || null);
    }

    // --- LOGIQUE DE DESSIN ---
    function draw() {
        if (!mapImage.complete || mapImage.naturalWidth === 0) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(scale, scale);
        ctx.drawImage(mapImage, 0, 0, mapImage.naturalWidth, mapImage.naturalHeight);
        drawTags();
        ctx.restore();
    }

    function drawTags() {
        if (!currentPlanId) return;
        allCodesData.forEach(code => {
            if (code.plan_id != currentPlanId || code.pos_x === null) return;
            const tag = getTagDimensions(code);

            if (code.anchor_x != null) {
                drawArrow(tag.x, tag.y, tag.anchor_x_abs, tag.anchor_y_abs);
            }

            ctx.strokeStyle = (code.id === selectedTagId) ? '#007bff' : 'black';
            ctx.lineWidth = (code.id === selectedTagId) ? 2 / scale : 1 / scale;
            ctx.fillStyle = universColors[code.univers] || '#7f8c8d';
            ctx.fillRect(tag.x - tag.width / 2, tag.y - tag.height / 2, tag.width, tag.height);
            ctx.strokeRect(tag.x - tag.width / 2, tag.y - tag.height / 2, tag.width, tag.height);

            ctx.font = `bold ${12 / scale}px Arial`;
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(code.code_geo, tag.x, tag.y);

            if (code.id === selectedTagId) {
                drawResizeHandles(tag);
            }
        });
    }

    function drawArrow(fromX, fromY, toX, toY) {
        const headlen = 10 / scale;
        const angle = Math.atan2(toY - fromY, toX - fromX);
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
        ctx.strokeStyle = '#34495e';
        ctx.lineWidth = 2 / scale;
        ctx.stroke();
    }
    
    function drawResizeHandles(tag) {
        const handleSize = 8 / scale;
        ctx.fillStyle = '#007bff';
        ctx.fillRect(tag.x + tag.width/2 - handleSize/2, tag.y + tag.height/2 - handleSize/2, handleSize, handleSize);
    }

    // --- GESTION DES ÉVÉNEMENTS ---
    function addEventListeners() {
        window.addEventListener('resize', resizeCanvas);
        planSelector.addEventListener('change', (e) => updateDisplayForPlan(e.target.value));
        unplacedList.addEventListener('click', handleUnplacedItemClick);
        searchInput.addEventListener('input', applyFilters);
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseUp);
        canvas.addEventListener('wheel', handleWheel);
        canvas.addEventListener('contextmenu', handleContextMenu);
        
        modalAddArrowBtn.addEventListener('click', () => {
            isDrawingArrow = true;
            draggedTagId = selectedTagId;
            tagActionModal.hide();
            alert("Cliquez sur le plan pour définir la pointe de la flèche.");
        });

        modalDeleteBtn.addEventListener('click', () => {
            if (confirm(`Voulez-vous vraiment supprimer l'étiquette ?`)) {
                removePositionAPI(selectedTagId);
            }
            tagActionModal.hide();
        });
    }
    
    function handleMouseDown(e) {
        // Gère uniquement le clic gauche (bouton 0)
        if (e.button !== 0) return;

        const coords = getCanvasCoords(e);
        if (isPlacementMode) {
            placeItemAt(coords.x, coords.y);
            return;
        }

        const clickedTag = getTagAt(coords.x, coords.y);
        const handle = clickedTag ? getResizeHandleAt(coords.x, coords.y, clickedTag) : null;
        
        selectedTagId = clickedTag ? clickedTag.id : null;

        if (handle) {
            isResizing = true;
            draggedTagId = selectedTagId;
        } else if (clickedTag) {
            isDraggingTag = true;
            draggedTagId = selectedTagId;
        } else {
            isPanning = true;
            panStart = { x: e.clientX - panX, y: e.clientY - panY };
        }
        
        draw();
        updateCursor(coords);
    }

    function handleMouseMove(e) {
        const coords = getCanvasCoords(e);
        
        if (isDraggingTag && draggedTagId) {
            const code = allCodesData.find(c => c.id === draggedTagId);
            code.pos_x = (coords.x / mapImage.naturalWidth) * 100;
            code.pos_y = (coords.y / mapImage.naturalHeight) * 100;
        } else if (isResizing && draggedTagId) {
            const code = allCodesData.find(c => c.id === draggedTagId);
            const tag = getTagDimensions(code);
            code.width = Math.max(20, (coords.x - tag.x + tag.width / 2) * 2);
            code.height = Math.max(15, (coords.y - tag.y + tag.height / 2) * 2);
        } else if (isPanning) {
            panX = e.clientX - panStart.x;
            panY = e.clientY - panStart.y;
        } else if (isDrawingArrow && draggedTagId) {
             const code = allCodesData.find(c => c.id === draggedTagId);
             code.anchor_x = (coords.x / mapImage.naturalWidth) * 100;
             code.anchor_y = (coords.y / mapImage.naturalHeight) * 100;
        } else {
            updateCursor(coords);
        }
        
        draw();
    }
    
    function handleMouseUp(e) {
        if (e.button !== 0) return; // Ne réagit qu'au relâchement du clic gauche
        const code = allCodesData.find(c => c.id === draggedTagId);
        if ((isDraggingTag || isResizing || isDrawingArrow) && code) {
            savePositionAPI(code);
        }
        isPanning = isDraggingTag = isResizing = isDrawingArrow = false;
        draggedTagId = resizeHandle = null;
        updateCursor();
    }

    function handleWheel(e) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const direction = e.deltaY > 0 ? -1 : 1;
        const newScale = scale + direction * zoomIntensity;
        if(newScale > 0.2 && newScale < 10) {
             scale = newScale;
             draw();
        }
    }

    // --- CORRECTION ---
    // Gère le clic droit pour ouvrir la modale et empêcher le menu natif
    function handleContextMenu(e) {
        e.preventDefault();
        const coords = getCanvasCoords(e);
        const clickedTag = getTagAt(coords.x, coords.y);
        if (clickedTag) {
            selectedTagId = clickedTag.id;
            modalTitle.textContent = `Actions pour ${clickedTag.code_geo}`;
            tagActionModal.show();
            draw();
        }
    }
    
    function handleUnplacedItemClick(e) {
        const item = e.target.closest('.unplaced-item');
        if (item) enterPlacementMode(item);
    }

    function enterPlacementMode(item) {
        isPlacementMode = true;
        selectedTagId = null;
        placementCodeId = item.dataset.id;
        document.querySelectorAll('.unplaced-item.placement-active').forEach(el => el.classList.remove('placement-active'));
        item.classList.add('placement-active');
        updateCursor();
        draw();
    }

    function cancelPlacementMode() {
        isPlacementMode = false;
        placementCodeId = null;
        document.querySelector('.unplaced-item.placement-active')?.classList.remove('placement-active');
        updateCursor();
    }

    async function placeItemAt(canvasX, canvasY) {
        if (!isPlacementMode || !placementCodeId) return;
        const newCodeData = {
            id: parseInt(placementCodeId),
            plan_id: parseInt(currentPlanId),
            pos_x: (canvasX / mapImage.naturalWidth) * 100,
            pos_y: (canvasY / mapImage.naturalHeight) * 100,
            width: null, height: null, anchor_x: null, anchor_y: null
        };
        const code = allCodesData.find(c => c.id == placementCodeId);
        if (await savePositionAPI(Object.assign(code, newCodeData))) {
            await fetchAndDisplayUnplacedCodes(currentPlanId);
        }
        cancelPlacementMode();
        draw();
    }
    
    async function updateDisplayForPlan(planId) {
        currentPlanId = planId;
        scale = 1; panX = 0; panY = 0; selectedTagId = null;
        if (!planId) {
            mapImage.src = '';
            planPlaceholder.style.display = 'block';
            canvas.style.display = 'none';
        } else {
            const selectedOption = planSelector.querySelector(`option[value="${planId}"]`);
            mapImage.src = `uploads/plans/${selectedOption.dataset.filename}`;
            planPlaceholder.style.display = 'none';
            canvas.style.display = 'block';
        }
        mapImage.onload = () => resizeCanvas();
        await fetchAndDisplayUnplacedCodes(planId);
        draw();
    }

    function resizeCanvas() {
        const containerRect = planContainer.getBoundingClientRect();
        if (mapImage.naturalWidth > 0) {
            const imageAspectRatio = mapImage.naturalHeight / mapImage.naturalWidth;
            const containerAspectRatio = containerRect.height / containerRect.width;
            if (imageAspectRatio > containerAspectRatio) {
                canvas.height = containerRect.height;
                canvas.width = containerRect.height / imageAspectRatio;
            } else {
                canvas.width = containerRect.width;
                canvas.height = containerRect.width * imageAspectRatio;
            }
        } else {
            canvas.width = containerRect.width;
            canvas.height = containerRect.height;
        }
        draw();
    }
    
    async function fetchAndDisplayUnplacedCodes(planId) {
        const codes = await fetchAvailableCodes(planId);
        unplacedList.innerHTML = codes.length === 0 ? '<p class="text-muted small">Aucun code disponible.</p>' : '';
        codes.forEach(code => {
             const item = document.createElement('div');
             item.className = 'unplaced-item';
             item.dataset.id = code.id;
             item.dataset.code = code.code_geo;
             item.dataset.libelle = code.libelle;
             item.dataset.univers = code.univers;
             item.innerHTML = `<span class="item-code" style="color: ${universColors[code.univers] || '#7f8c8d'}">${code.code_geo}</span> <span class="item-libelle">${code.libelle}</span>`;
             unplacedList.appendChild(item);
        });
        applyFilters();
    }

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        let count = 0;
        document.querySelectorAll('#unplaced-list .unplaced-item').forEach(item => {
            const searchData = `${item.dataset.code} ${item.dataset.libelle}`.toLowerCase();
            const isVisible = searchData.includes(searchTerm);
            item.style.display = isVisible ? 'block' : 'none';
            if (isVisible) count++;
        });
        unplacedCounter.textContent = `(${count})`;
    }

    function getCanvasCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        return { x: (mouseX - panX) / scale, y: (mouseY - panY) / scale };
    }

    function getTagDimensions(code) {
        const textMetrics = ctx.measureText(code.code_geo);
        const calcWidth = textMetrics.width + 16;
        return {
            x: (code.pos_x / 100) * mapImage.naturalWidth,
            y: (code.pos_y / 100) * mapImage.naturalHeight,
            width: code.width || Math.max(DEFAULT_TAG_WIDTH, calcWidth),
            height: code.height || DEFAULT_TAG_HEIGHT,
            anchor_x_abs: (code.anchor_x / 100) * mapImage.naturalWidth,
            anchor_y_abs: (code.anchor_y / 100) * mapImage.naturalHeight
        };
    }

    function getTagAt(x, y) {
        return allCodesData.slice().reverse().find(code => {
            if (code.plan_id != currentPlanId || code.pos_x === null) return false;
            const tag = getTagDimensions(code);
            return x >= tag.x - tag.width / 2 && x <= tag.x + tag.width / 2 &&
                   y >= tag.y - tag.height / 2 && y <= tag.y + tag.height / 2;
        });
    }
    
    function getResizeHandleAt(x, y, code) {
        const tag = getTagDimensions(code);
        const handleSize = 8 / scale;
        if (x >= tag.x + tag.width/2 - handleSize && x <= tag.x + tag.width/2 + handleSize &&
            y >= tag.y + tag.height/2 - handleSize && y <= tag.y + tag.height/2 + handleSize) {
            return 'se'; // Sud-Est
        }
        return null;
    }

    function updateCursor(coords) {
        let newCursor = 'grab';
        if (isPanning || isDraggingTag) newCursor = 'grabbing';
        else if (isResizing) newCursor = 'se-resize';
        else if (isPlacementMode) newCursor = 'crosshair';
        else if(coords) {
            const hoveredTag = getTagAt(coords.x, coords.y);
            if (hoveredTag && selectedTagId === hoveredTag.id) {
                if (getResizeHandleAt(coords.x, coords.y, hoveredTag)) {
                    newCursor = 'se-resize';
                } else {
                    newCursor = 'move';
                }
            } else if (hoveredTag) {
                newCursor = 'pointer';
            }
        }
        canvas.style.cursor = newCursor;
    }
    
    async function savePositionAPI(code) {
        try {
            const response = await fetch('index.php?action=savePosition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: code.id,
                    plan_id: parseInt(currentPlanId),
                    x: code.pos_x,
                    y: code.pos_y,
                    width: code.width,
                    height: code.height,
                    anchor_x: code.anchor_x,
                    anchor_y: code.anchor_y
                })
            });
            return response.ok;
        } catch (error) {
            console.error('Erreur API savePosition:', error);
            return false;
        }
    }

    async function removePositionAPI(codeId) {
        try {
            const response = await fetch('index.php?action=removePosition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(codeId) })
            });
            const result = await response.json();
            if (result.status === 'success') {
                const codeToUpdate = allCodesData.find(c => c.id == codeId);
                if (codeToUpdate) {
                    codeToUpdate.plan_id = null;
                    ['pos_x', 'pos_y', 'width', 'height', 'anchor_x', 'anchor_y'].forEach(prop => codeToUpdate[prop] = null);
                }
                selectedTagId = null;
                await fetchAndDisplayUnplacedCodes(currentPlanId);
                draw();
            }
        } catch (error) {
            console.error('Erreur API removePosition:', error);
        }
    }

    async function fetchAvailableCodes(planId) {
        if (!planId) return [];
        try {
            const response = await fetch(`index.php?action=getAvailableCodesForPlan&id=${planId}`);
            return await response.json();
        } catch (error) {
            console.error("Erreur API fetchAvailableCodes:", error);
            return [];
        }
    }

    initialize();
});
