document.addEventListener('DOMContentLoaded', () => {
    const planPageContainer = document.querySelector('.plan-page-container');
    if (!planPageContainer) return;

    // --- ÉLÉMENTS DU DOM ---
    const canvas = document.getElementById('plan-canvas');
    if (!canvas) {
        console.error("L'élément Canvas avec l'ID 'plan-canvas' est introuvable !");
        return;
    }
    const ctx = canvas.getContext('2d');
    const mapImage = document.getElementById('map-image');
    const planSelector = document.getElementById('plan-selector');
    const unplacedList = document.getElementById('unplaced-list');
    const searchInput = document.getElementById('tag-search-input');
    const unplacedCounter = document.getElementById('unplaced-counter');
    const planContainer = document.getElementById('plan-container');
    const planPlaceholder = document.getElementById('plan-placeholder');

    // --- ÉTAT DE L'APPLICATION ---
    let allCodesData = [...placedGeoCodes];
    let currentPlanId = null;
    let isPlacementMode = false;
    let placementCodeId = null;
    
    // Variables pour le pan, zoom et l'interaction avec les étiquettes
    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let isDraggingTag = false;
    let panStart = { x: 0, y: 0 };
    let selectedTagId = null;
    let draggedTagId = null;

    // --- INITIALISATION ---
    function initialize() {
        resizeCanvas();
        addEventListeners();
        updateDisplayForPlan(planSelector.value || null);
    }

    function resizeCanvas() {
        const containerRect = planContainer.getBoundingClientRect();
        canvas.width = containerRect.width;
        canvas.height = containerRect.height;
        draw();
    }
    
    // --- BOUCLE DE RENDU PRINCIPALE ---
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(scale, scale);

        if (mapImage.complete && mapImage.src) {
            ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
        }

        drawTags();
        ctx.restore();
    }

    function drawTags() {
        if (!currentPlanId) return;

        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        allCodesData.forEach(code => {
            if (code.plan_id == currentPlanId && code.pos_x !== null) {
                const { x, y, width, height } = getTagDimensions(code);

                // Style pour l'étiquette sélectionnée
                if (code.id === selectedTagId) {
                    ctx.strokeStyle = '#007bff';
                    ctx.lineWidth = 2;
                } else {
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 1;
                }
                
                // Dessin du fond et de la bordure
                ctx.fillStyle = universColors[code.univers] || '#7f8c8d';
                ctx.fillRect(x - width / 2, y - height / 2, width, height);
                ctx.strokeRect(x - width / 2, y - height / 2, width, height);


                // Dessin du texte
                ctx.fillStyle = 'white';
                ctx.fillText(code.code_geo, x, y);
            }
        });
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
        canvas.addEventListener('mouseleave', handleMouseUp); // Arrêter le drag si la souris quitte le canvas
        canvas.addEventListener('wheel', handleWheel);
        canvas.addEventListener('contextmenu', handleContextMenu);
    }

    function handleMouseDown(e) {
        if (isPlacementMode) {
             const coords = getCanvasCoords(e);
             placeItemAt(coords.x, coords.y);
             return;
        }

        const coords = getCanvasCoords(e);
        const clickedTag = getTagAt(coords.x, coords.y);
        
        selectedTagId = clickedTag ? clickedTag.id : null;

        if (selectedTagId) {
            isDraggingTag = true;
            draggedTagId = selectedTagId;
        } else {
            isPanning = true;
            panStart = { x: e.clientX - panX, y: e.clientY - panY };
        }
        
        draw();
        canvas.style.cursor = clickedTag ? 'grabbing' : 'grab';
    }

    function handleMouseMove(e) {
        if (isDraggingTag && draggedTagId) {
            const code = allCodesData.find(c => c.id === draggedTagId);
            if (code) {
                const coords = getCanvasCoords(e);
                code.pos_x = (coords.x / canvas.width) * 100;
                code.pos_y = (coords.y / canvas.height) * 100;
                draw();
            }
        } else if (isPanning) {
            panX = e.clientX - panStart.x;
            panY = e.clientY - panStart.y;
            draw();
        }
    }
    
    function handleMouseUp() {
        if (isDraggingTag && draggedTagId) {
            const code = allCodesData.find(c => c.id === draggedTagId);
            if (code) {
                savePositionAPI(code.id, code.pos_x, code.pos_y);
            }
        }
        isPanning = false;
        isDraggingTag = false;
        draggedTagId = null;
        canvas.style.cursor = isPlacementMode ? 'crosshair' : 'grab';
    }

    function handleWheel(e) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const direction = e.deltaY > 0 ? -1 : 1;
        const newScale = scale + direction * zoomIntensity;
        
        if(newScale > 0.5 && newScale < 10) {
             scale = newScale;
             draw();
        }
    }
    
    function handleContextMenu(e) {
        e.preventDefault();
        if (selectedTagId) {
            if (confirm(`Voulez-vous vraiment supprimer l'étiquette ${allCodesData.find(c => c.id === selectedTagId).code_geo} ?`)) {
                removePositionAPI(selectedTagId);
            }
        }
    }


    // --- LOGIQUE DE PLACEMENT ET DE MISE À JOUR ---
    function handleUnplacedItemClick(e) {
        const item = e.target.closest('.unplaced-item');
        if (item) enterPlacementMode(item);
    }

    function enterPlacementMode(item) {
        isPlacementMode = true;
        placementCodeId = item.dataset.id;
        document.querySelectorAll('.unplaced-item.placement-active').forEach(el => el.classList.remove('placement-active'));
        item.classList.add('placement-active');
        canvas.style.cursor = 'crosshair';
    }

    function cancelPlacementMode() {
        isPlacementMode = false;
        placementCodeId = null;
        document.querySelector('.unplaced-item.placement-active')?.classList.remove('placement-active');
        canvas.style.cursor = 'grab';
    }

    async function placeItemAt(canvasX, canvasY) {
        if (!isPlacementMode || !placementCodeId) return;

        const relativeX = (canvasX / canvas.width) * 100;
        const relativeY = (canvasY / canvas.height) * 100;

        if (await savePositionAPI(placementCodeId, relativeX, relativeY)) {
            const codeIndex = allCodesData.findIndex(c => c.id == placementCodeId);
            if(codeIndex > -1) {
                allCodesData[codeIndex].plan_id = parseInt(currentPlanId);
                allCodesData[codeIndex].pos_x = relativeX;
                allCodesData[codeIndex].pos_y = relativeY;
            }
            await fetchAndDisplayUnplacedCodes(currentPlanId);
            draw();
        }
        cancelPlacementMode();
    }
    
    async function updateDisplayForPlan(planId) {
        currentPlanId = planId;
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
        mapImage.onload = () => draw();
        await fetchAndDisplayUnplacedCodes(planId);
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

    // --- HELPERS ---
    function getCanvasCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        return { x: (mouseX - panX) / scale, y: (mouseY - panY) / scale };
    }

    function getTagDimensions(code) {
        const textMetrics = ctx.measureText(code.code_geo);
        return {
            x: (code.pos_x / 100) * canvas.width,
            y: (code.pos_y / 100) * canvas.height,
            width: textMetrics.width + 10,
            height: 20
        };
    }

    function getTagAt(x, y) {
        for (const code of allCodesData) {
            if (code.plan_id == currentPlanId && code.pos_x !== null) {
                const tag = getTagDimensions(code);
                if (x >= tag.x - tag.width / 2 && x <= tag.x + tag.width / 2 &&
                    y >= tag.y - tag.height / 2 && y <= tag.y + tag.height / 2) {
                    return code;
                }
            }
        }
        return null;
    }

    // --- FONCTIONS API ---
    async function savePositionAPI(codeId, x, y) {
        try {
            const response = await fetch('index.php?action=savePosition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(codeId), plan_id: parseInt(currentPlanId), x: x, y: y })
            });
            const result = await response.json();
            return result.status === 'success';
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
                allCodesData.find(c => c.id == codeId).plan_id = null; // Mettre à jour localement
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

    // --- DÉMARRAGE ---
    initialize();
});
