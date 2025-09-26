document.addEventListener('DOMContentLoaded', () => {
    const planPageContainer = document.querySelector('.plan-page-container');
    if (!planPageContainer) return;

    // --- ÉLEMENTS DU DOM ---
    const canvas = document.getElementById('plan-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const mapImage = document.getElementById('map-image');
    const planContainer = document.getElementById('plan-container');
    const planLoader = document.getElementById('plan-loader');
    const planPlaceholder = document.getElementById('plan-placeholder');
    
    // Éléments optionnels
    const planSelector = document.getElementById('plan-selector');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const unplacedList = document.getElementById('unplaced-list');
    const searchInput = document.getElementById('tag-search-input');
    const unplacedCounter = document.getElementById('unplaced-counter');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const tagToolbar = document.getElementById('tag-edit-toolbar');
    const printBtn = document.getElementById('print-plan-btn');
    const addCodeBtn = document.getElementById('add-code-btn');
    const addCodeModal = new bootstrap.Modal(document.getElementById('add-code-modal'));
    const saveNewCodeBtn = document.getElementById('save-new-code-btn');
    const newUniversIdSelect = document.getElementById('new-univers-id');

    // --- ÉTAT DE L'APPLICATION ---
    let allCodesData = [...placedGeoCodes];
    let isPlacementMode = false;
    let placementCodeId = null;

    let scale = 1, panX = 0, panY = 0;
    let isPanning = false, isDraggingTag = false, isResizing = false, isDrawingArrow = false;
    let panStart = { x: 0, y: 0 };
    let selectedTagId = null, draggedTagId = null;

    let longPressTimer;
    let touchMoved = false;
    let initialPinchDistance = null;

    const DEFAULT_TAG_WIDTH = 80;
    const DEFAULT_TAG_HEIGHT = 22;

    function initialize() {
        resizeCanvas();
        addEventListeners();
        updateDisplayForPlan();
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

    // Logique de positionnement de la barre d'outils
    if (tagToolbar && selectedTagId) {
        const code = allCodesData.find(c => c.id === selectedTagId);
        if (code) {
            const tag = getTagDimensions(code);
            // Calcule la position X (centrée horizontalement sur l'étiquette)
            const toolbarX = (tag.x * scale + panX) - tagToolbar.offsetWidth / 2;
            // Calcule la position Y (au-dessus de l'étiquette avec une marge de 10px)
            const toolbarY = (tag.y * scale + panY) - (tag.height / 2 * scale) - tagToolbar.offsetHeight - 10;
            
            tagToolbar.style.left = `${toolbarX}px`;
            tagToolbar.style.top = `${toolbarY}px`;
            tagToolbar.classList.add('visible'); // Utilise la classe pour une transition CSS fluide
        }
    } else if (tagToolbar) {
        tagToolbar.classList.remove('visible'); // Cache la barre d'outils avec une transition
    }
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

    function drawArrow(fromX, fromY, toX, toY, targetCtx = ctx) {
        const scaleFactor = (targetCtx === ctx) ? scale : 1;
        const headlen = 10 / scaleFactor;
        const angle = Math.atan2(toY - fromY, toX - fromX);
        targetCtx.beginPath();
        targetCtx.moveTo(fromX, fromY);
        targetCtx.lineTo(toX, toY);
        targetCtx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
        targetCtx.moveTo(toX, toY);
        targetCtx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
        targetCtx.strokeStyle = '#34495e';
        targetCtx.lineWidth = 2 / scaleFactor;
        targetCtx.stroke();
    }
    
    function drawResizeHandles(tag) {
        const handleSize = 8 / scale;
        ctx.fillStyle = '#007bff';
        ctx.fillRect(tag.x + tag.width/2 - handleSize/2, tag.y + tag.height/2 - handleSize/2, handleSize, handleSize);
    }

    function addEventListeners() {
        window.addEventListener('resize', resizeCanvas);
        
        if (unplacedList) unplacedList.addEventListener('click', handleUnplacedItemClick);
        if (searchInput) searchInput.addEventListener('input', applyFilters);
        
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseUp);
        canvas.addEventListener('wheel', handleWheel, { passive: false });

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd);
        
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => zoom(1.2));
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => zoom(0.8));
        if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetView);
        if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullScreen);
        if (toggleSidebarBtn) toggleSidebarBtn.addEventListener('click', () => planPageContainer.classList.toggle('sidebar-hidden'));
        
        if (printBtn) {
            const printModal = new bootstrap.Modal(document.getElementById('print-options-modal'));
            printBtn.addEventListener('click', () => printModal.show());
        }

        if (tagToolbar) {
            document.getElementById('toolbar-arrow').addEventListener('click', () => {
                isDrawingArrow = true;
                draggedTagId = selectedTagId;
                alert("Touchez le plan pour définir la pointe de la flèche.");
            });

            document.getElementById('toolbar-resize').addEventListener('click', () => {
                isResizing = true;
                draggedTagId = selectedTagId;
                alert("Faites glisser depuis le coin inférieur droit de l'étiquette pour la redimensionner.");
            });

            document.getElementById('toolbar-delete').addEventListener('click', () => {
                if (confirm(`Voulez-vous vraiment supprimer l'étiquette ?`)) {
                    removePositionAPI(selectedTagId);
                }
            });
        }
        
        if (addCodeBtn) {
            addCodeBtn.addEventListener('click', () => {
                // Populate univers select
                newUniversIdSelect.innerHTML = '';
                planUnivers.forEach(u => {
                    const option = document.createElement('option');
                    option.value = u.id;
                    option.textContent = u.nom;
                    newUniversIdSelect.appendChild(option);
                });
                addCodeModal.show();
            });
        }
        
        if (saveNewCodeBtn) {
            saveNewCodeBtn.addEventListener('click', async () => {
                const form = document.getElementById('add-code-form');
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                
                const response = await fetch('index.php?action=addGeoCodeFromPlan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    const newCode = await response.json();
                    allCodesData.push(newCode);
                    await fetchAndDisplayUnplacedCodes(currentPlanId);
                    addCodeModal.hide();
                    form.reset();
                } else {
                    alert('Erreur lors de la création du code géo.');
                }
            });
        }
    }
    
    function zoom(factor) {
        const newScale = scale * factor;
        if (newScale > 0.2 && newScale < 10) {
            scale = newScale;
            draw();
        }
    }

    function resetView() {
        scale = 1;
        panX = 0;
        panY = 0;
        draw();
    }
    
    function getCanvasCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;
        return { x: (mouseX - panX) / scale, y: (mouseY - panY) / scale, clientX, clientY };
    }

    function handleMouseDown(e) {
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
            touchMoved = false;
            longPressTimer = setTimeout(() => {
                if (!touchMoved) {
                    isDraggingTag = false;
                }
            }, 500);
        } else {
            isPanning = true;
            panStart = { x: e.clientX - panX, y: e.clientY - panY };
        }
        draw();
        updateCursor(coords);
    }

    function handleMouseMove(e) {
        touchMoved = true;
        clearTimeout(longPressTimer);
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
    
    function handleMouseUp() {
        clearTimeout(longPressTimer);
        const code = allCodesData.find(c => c.id === draggedTagId);
        if ((isDraggingTag || isResizing || isDrawingArrow) && code) {
            savePositionAPI(code);
        }
        isPanning = isDraggingTag = isResizing = isDrawingArrow = false;
        draggedTagId = null;
        updateCursor();
    }

    function handleWheel(e) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const direction = e.deltaY > 0 ? -1 : 1;
        zoom(1 + direction * zoomIntensity);
    }
        
    function handleUnplacedItemClick(e) {
        const item = e.target.closest('.unplaced-item');
        if (item) enterPlacementMode(item);
    }
    
    function handleTouchStart(e) {
        if (e.touches.length === 1) {
            e.preventDefault();
            handleMouseDown({ button: 0, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
        } else if (e.touches.length === 2) {
            e.preventDefault();
            isPanning = false; 
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
        }
    }
    
    function handleTouchMove(e) {
        if (e.touches.length === 1) {
            e.preventDefault();
            handleMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
        } else if (e.touches.length === 2 && initialPinchDistance) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const currentPinchDistance = Math.sqrt(dx * dx + dy * dy);
            const zoomFactor = currentPinchDistance / initialPinchDistance;
            const newScale = scale * zoomFactor;
            if(newScale > 0.2 && newScale < 10) {
                scale = newScale;
                draw();
            }
            initialPinchDistance = currentPinchDistance;
        }
    }
    
    function handleTouchEnd() {
        handleMouseUp();
        initialPinchDistance = null;
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
    
    async function updateDisplayForPlan() {
        if (!currentPlanId) {
             if (planPlaceholder) planPlaceholder.style.display = 'block';
             canvas.style.display = 'none';
             if (planLoader) planLoader.style.display = 'none';
             return;
        }
        
        resetView();
        selectedTagId = null;

        if (planPlaceholder) planPlaceholder.style.display = 'none';
        canvas.style.display = 'block';
        if (planLoader) planLoader.style.display = 'block';
        
        mapImage.src = `uploads/plans/${currentPlan.nom_fichier}`;
        
        mapImage.onload = () => {
            if (planLoader) planLoader.style.display = 'none';
            resizeCanvas();
            updateLegend();
            populatePrintModalFilters();
            draw();
        };
        await fetchAndDisplayUnplacedCodes(currentPlanId);
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
        if (!unplacedList) return;
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
        if (!searchInput) return;
        const searchTerm = searchInput.value.toLowerCase();
        let count = 0;
        document.querySelectorAll('#unplaced-list .unplaced-item').forEach(item => {
            const searchData = `${item.dataset.code} ${item.dataset.libelle}`.toLowerCase();
            const isVisible = searchData.includes(searchTerm);
            item.style.display = isVisible ? 'block' : 'none';
            if (isVisible) count++;
        });
        if (unplacedCounter) unplacedCounter.textContent = `(${count})`;
    }

    function getTagDimensions(code) {
        const textMetrics = ctx.measureText(code.code_geo);
        const calcWidth = textMetrics.width + 16;
        return {
            x: (code.pos_x / 100) * mapImage.naturalWidth,
            y: (code.pos_y / 100) * mapImage.naturalHeight,
            width: code.width || Math.max(80, calcWidth),
            height: code.height || 22,
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
            return 'se';
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

    function updateLegend() {
        const legendContainer = document.getElementById('legend-container');
        if (!legendContainer) return;
        legendContainer.innerHTML = '';
        const placedUnivers = new Set(allCodesData.filter(c => c.plan_id == currentPlanId && c.univers).map(c => c.univers));
        placedUnivers.forEach(universName => {
            const color = universColors[universName] || '#7f8c8d';
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = `<div class="legend-color-box" style="background-color: ${color};"></div><span>${universName}</span>`;
            legendContainer.appendChild(legendItem);
        });
    }

    function populatePrintModalFilters() {
        const printUniversFilterContainer = document.getElementById('print-univers-filter');
        if (!printUniversFilterContainer) return;
        printUniversFilterContainer.innerHTML = '';
        const placedUnivers = new Set(allCodesData.filter(c => c.plan_id == currentPlanId && c.univers).map(c => c.univers));
        placedUnivers.forEach(universName => {
            const filterItem = document.createElement('div');
            filterItem.className = 'form-check';
            filterItem.innerHTML = `
                <input class="form-check-input" type="checkbox" value="${universName}" id="print-filter-${universName.replace(/\s+/g, '')}" checked>
                <label class="form-check-label" for="print-filter-${universName.replace(/\s+/g, '')}">
                    ${universName}
                </label>`;
            printUniversFilterContainer.appendChild(filterItem);
        });
    }

    function toggleFullScreen() {
        if (!document.fullscreenElement) {
            planPageContainer.requestFullscreen().catch(err => {
                alert(`Erreur lors du passage en plein écran : ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    initialize();
});
