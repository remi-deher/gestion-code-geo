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
    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let panStart = { x: 0, y: 0 };

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
                const x = (code.pos_x / 100) * canvas.width;
                const y = (code.pos_y / 100) * canvas.height;
                const text = code.code_geo;
                const textMetrics = ctx.measureText(text);
                const tagWidth = textMetrics.width + 12; // Un peu plus de marge
                const tagHeight = 22;

                ctx.fillStyle = universColors[code.univers] || '#7f8c8d';
                ctx.fillRect(x - tagWidth / 2, y - tagHeight / 2, tagWidth, tagHeight);

                ctx.fillStyle = 'white';
                ctx.fillText(text, x, y);
            }
        });
    }

    // --- GESTION DES ÉVÉNEMENTS ---
    function addEventListeners() {
        window.addEventListener('resize', resizeCanvas);
        planSelector.addEventListener('change', (e) => updateDisplayForPlan(e.target.value));
        unplacedList.addEventListener('click', handleUnplacedItemClick);
        searchInput.addEventListener('input', applyFilters);
        
        canvas.addEventListener('mousedown', (e) => {
            if (isPlacementMode) {
                 const coords = getCanvasCoords(e);
                 placeItemAt(coords.x, coords.y);
            } else {
                isPanning = true;
                panStart = { x: e.clientX - panX, y: e.clientY - panY };
                canvas.style.cursor = 'grabbing';
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isPanning) {
                panX = e.clientX - panStart.x;
                panY = e.clientY - panStart.y;
                draw();
            }
        });

        canvas.addEventListener('mouseup', () => {
            isPanning = false;
            canvas.style.cursor = isPlacementMode ? 'crosshair' : 'grab';
        });
        
        canvas.addEventListener('mouseleave', () => {
            isPanning = false;
            canvas.style.cursor = isPlacementMode ? 'crosshair' : 'grab';
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomIntensity = 0.1;
            const direction = e.deltaY > 0 ? -1 : 1;
            const newScale = scale + direction * zoomIntensity;
            
            if(newScale > 0.5 && newScale < 10) {
                 scale = newScale;
                 draw();
            }
        });
    }

    // --- LOGIQUE DE PLACEMENT ---
    function handleUnplacedItemClick(e) {
        const item = e.target.closest('.unplaced-item');
        if (item) {
            enterPlacementMode(item);
        }
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
    
    // --- MISE À JOUR DE L'AFFICHAGE ---
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
        unplacedList.innerHTML = '';
        if (codes.length === 0) {
            unplacedList.innerHTML = '<p class="text-muted small">Aucun code disponible.</p>';
        } else {
            codes.forEach(code => {
                 const item = document.createElement('div');
                 item.className = 'unplaced-item';
                 item.dataset.id = code.id;
                 item.dataset.code = code.code_geo;
                 item.innerHTML = `<span class="item-code" style="color: ${universColors[code.univers] || '#7f8c8d'}">${code.code_geo}</span> <span class="item-libelle">${code.libelle}</span>`;
                 unplacedList.appendChild(item);
            });
        }
        applyFilters();
    }

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        let count = 0;
        document.querySelectorAll('#unplaced-list .unplaced-item').forEach(item => {
            const isVisible = item.dataset.code.toLowerCase().includes(searchTerm);
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
        const x = (mouseX - panX) / scale;
        const y = (mouseY - panY) / scale;
        return { x, y };
    }


    // --- FONCTIONS API ---
    async function savePositionAPI(codeId, x, y) {
        try {
            const response = await fetch('index.php?action=savePosition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: parseInt(codeId),
                    plan_id: parseInt(currentPlanId),
                    x: x,
                    y: y,
                })
            });
            const result = await response.json();
            return result.status === 'success';
        } catch (error) {
            console.error('Erreur API savePosition:', error);
            return false;
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
