// Ajout de logs pour le débogage. Vous pouvez les supprimer une fois le problème résolu.
console.log('--- plan.js chargé ---');

document.addEventListener('DOMContentLoaded', () => {
    const planPageContainer = document.querySelector('.plan-page-container');
    if (!planPageContainer) {
        console.log('Conteneur de la page de plan non trouvé, script arrêté.');
        return;
    }
    console.log('Initialisation du script de la page du plan.');


    // --- ÉLÉMENTS DU DOM ---
    const sidebar = document.getElementById('unplaced-codes-sidebar');
    const zoomWrapper = document.getElementById('zoom-wrapper');
    const unplacedList = document.getElementById('unplaced-list');
    const unplacedCounter = document.getElementById('unplaced-counter');
    const planContainer = document.getElementById('plan-container');
    const mapImage = document.getElementById('map-image');
    const planSelector = document.getElementById('plan-selector');
    const searchInput = document.getElementById('tag-search-input');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    const accordionItems = document.querySelectorAll('.accordion-item');
    const tagSizeSelector = document.getElementById('tag-size-selector');
    const planPlaceholder = document.getElementById('plan-placeholder');
    const printModalBtn = document.getElementById('open-print-modal-btn');
    const printBrowserBtn = document.getElementById('print-browser-btn');
    const printPdfBtn = document.getElementById('print-pdf-btn');
    const historyList = document.getElementById('history-list');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const touchToolbar = document.getElementById('touch-controls-toolbar');
    const multiSelectToggle = document.getElementById('multi-select-toggle');
    const placementBanner = document.getElementById('placement-mode-banner');
    const placementCodeLabel = document.getElementById('placement-code-label');
    const cancelPlacementBtn = document.getElementById('cancel-placement-btn');
    const contextMenu = document.getElementById('tag-context-menu');

    // --- Initialisation des Modales (AVEC VÉRIFICATION) ---
    const modalElement = document.getElementById('geoCodeDetailModal');
    let geoCodeModal = modalElement ? new bootstrap.Modal(modalElement) : null;
    const printPlanModalEl = document.getElementById('printPlanModal');
    let printPlanModal = printPlanModalEl ? new bootstrap.Modal(printPlanModalEl) : null;
    
    // --- ÉTAT DE L'APPLICATION ---
    let currentPlanId = null;
    let selectedTags = new Set();
    let isDragging = false;
    let isResizing = false;
    let isSelecting = false;
    let selectionBox = null;
    let startCoords = { x: 0, y: 0 };
    let dragStartPositions = new Map();
    let resizeStartInfo = {};
    let panzoomInstance = null;
    let draggedItemFromSidebar = null;
    let allCodesData = [...placedGeoCodes];
    let isMultiSelectMode = false;
    let isPlacementMode = false;
    let placementCodeId = null;
    let longPressTimer = null;
    let isTouchMovingTag = false;
    let lastClickTime = 0;
    let lines = []; 
    let isDrawingLine = false;
    let lineStartElement = null;

    // --- INITIALISATION ---
    panzoomInstance = Panzoom(zoomWrapper, { maxScale: 10, minScale: 0.5, excludeClass: 'geo-tag', canvas: true });
    zoomWrapper.classList.add('tag-size-medium');
    addEventListeners();
    updateDisplayForPlan(null);

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---
    function addEventListeners() {
        console.log('Ajout des écouteurs d\'événements principaux.');
        planContainer.addEventListener('wheel', panzoomInstance.zoomWithWheel, { passive: false });
        planSelector.addEventListener('change', (e) => updateDisplayForPlan(e.target.value));
        searchInput.addEventListener('input', applyFilters);
        zoomInBtn.addEventListener('click', () => panzoomInstance.zoomIn());
        zoomOutBtn.addEventListener('click', () => panzoomInstance.zoomOut());
        zoomResetBtn.addEventListener('click', () => panzoomInstance.reset());
        accordionItems.forEach(item => {
            item.querySelector('.accordion-header').addEventListener('click', () => item.classList.toggle('open'));
        });
        toggleSidebarBtn.addEventListener('click', () => planPageContainer.classList.toggle('sidebar-hidden'));
        zoomWrapper.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('dragstart', handleDragStart);
        zoomWrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
        zoomWrapper.addEventListener('touchmove', handleTouchMove, { passive: false });
        zoomWrapper.addEventListener('touchend', handleTouchEnd);
        unplacedList.addEventListener('click', handleUnplacedItemClick);
        cancelPlacementBtn.addEventListener('click', cancelPlacementMode);
        multiSelectToggle.addEventListener('click', toggleMultiSelectMode);
        printModalBtn.addEventListener('click', () => { if(printPlanModal) printPlanModal.show(); });
        printBrowserBtn.addEventListener('click', handleBrowserPrint);
        printPdfBtn.addEventListener('click', handlePdfExport);
        zoomWrapper.addEventListener('dragover', (e) => e.preventDefault());
        zoomWrapper.addEventListener('drop', handleDropOnPlan);
        sidebar.addEventListener('dragover', (e) => e.preventDefault());
        sidebar.addEventListener('drop', handleDropOnSidebar);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                console.log('Touche Échap pressée. Annulation des modes en cours.');
                cancelLineDrawing();
                cancelPlacementMode();
            }
        });

        if (modalElement) {
            modalElement.addEventListener('hide.bs.modal', function () {
                const focusedElement = document.activeElement;
                if (modalElement.contains(focusedElement)) {
                    focusedElement.blur();
                }
            });
        }
        if (printPlanModalEl) {
            printPlanModalEl.addEventListener('hide.bs.modal', function () {
                const focusedElement = document.activeElement;
                if (printPlanModalEl.contains(focusedElement)) {
                    focusedElement.blur();
                }
            });
        }

        if (tagSizeSelector) {
            tagSizeSelector.addEventListener('click', (e) => {
                const button = e.target.closest('button');
                if (!button || button.classList.contains('active')) return;
                const size = button.dataset.size;
                tagSizeSelector.querySelector('.active')?.classList.remove('active');
                button.classList.add('active');
                zoomWrapper.classList.remove('tag-size-small', 'tag-size-medium', 'tag-size-large');
                zoomWrapper.classList.add(`tag-size-${size}`);
            });
        }
    }

    // --- LOGIQUE D'INTERACTION SOURIS ---
    function handleMouseDown(e) {
        console.log('handleMouseDown -> Clic souris détecté sur le plan.');
        if (e.button !== 0) return; // Uniquement le clic gauche
        
        // CORRECTION : Gérer le mode placement pour la souris
        if (isPlacementMode) {
            console.log('Mode placement actif. Tentative de placement de l\'élément.');
            placeItemAt(e.clientX, e.clientY);
            return; // On arrête le traitement ici pour ne pas déclencher d'autres actions
        }

        const target = e.target;
        startCoords = { x: e.clientX, y: e.clientY };

        if (target.classList.contains('resize-handle')) {
            console.log('Début du redimensionnement.');
            isResizing = true;
            // ... (le reste du code de redimensionnement)
        } else if (target.closest('.geo-tag')) {
            console.log('Début du glisser-déposer d\'une étiquette.');
            isDragging = true;
             // ... (le reste du code de drag)
        } else {
            console.log('Début de la sélection par zone.');
            isSelecting = true;
            // ... (le reste du code de sélection)
        }
    }
    
    // Le reste des fonctions handleMouseMove, handleMouseUp, etc. reste identique

    // --- LOGIQUE DES MODES ET ACTIONS ---
    function handleUnplacedItemClick(e) {
        const item = e.target.closest('.unplaced-item');
        if (item && !isPlacementMode) {
            console.log(`Clic sur l'élément à placer: ${item.dataset.code}`);
            enterPlacementMode(item);
        }
    }

    function enterPlacementMode(item) {
        console.log(`Entrée en mode placement pour le code ID: ${item.dataset.id}`);
        isPlacementMode = true;
        placementCodeId = item.dataset.id;
        document.querySelectorAll('.unplaced-item.placement-active').forEach(el => el.classList.remove('placement-active'));
        item.classList.add('placement-active');
        placementCodeLabel.textContent = item.dataset.code;
        placementBanner.style.display = 'flex';
        planPageContainer.classList.add('placement-mode-active'); // Pour changer le curseur par ex.
    }

    function cancelPlacementMode() {
        if (isPlacementMode) {
            console.log('Annulation du mode placement.');
            isPlacementMode = false;
            placementCodeId = null;
            document.querySelector('.unplaced-item.placement-active')?.classList.remove('placement-active');
            placementBanner.style.display = 'none';
            planPageContainer.classList.remove('placement-mode-active');
        }
    }
    
    async function placeItemAt(x, y) {
        if (!isPlacementMode || !placementCodeId) {
            console.log('placeItemAt appelé mais les conditions ne sont pas remplies.');
            return;
        }
        
        console.log(`Placement demandé pour l'ID ${placementCodeId} aux coordonnées client (${x}, ${y})`);
        const coords = getRelativeCoords(x, y);
        console.log('Coordonnées relatives calculées:', coords);

        if (await saveMultiplePositionsAPI([{ id: parseInt(placementCodeId), x: coords.x, y: coords.y }])) {
            console.log('Position sauvegardée avec succès via API.');
            await reloadAllDataAndRedraw();
            fetchAndDisplayHistory(currentPlanId);
        } else {
            console.error('Échec de la sauvegarde de la position via API.');
        }
        cancelPlacementMode();
    }

    function startTouchMove() {
        isTouchMovingTag = true;
        selectedTags.forEach(tag => {
            tag.classList.add('is-moving');
            dragStartPositions.set(tag, { x: parseFloat(tag.style.left), y: parseFloat(tag.style.top) });
        });
        panzoomInstance.setOptions({ disablePan: true });
    }

    async function stopTouchMove() {
        isTouchMovingTag = false;
        const positionsToSave = [];
        selectedTags.forEach(tag => {
            tag.classList.remove('is-moving');
            positionsToSave.push({ id: parseInt(tag.dataset.id), x: parseFloat(tag.style.left), y: parseFloat(tag.style.top) });
        });
        if (await saveMultiplePositionsAPI(positionsToSave)) {
            flashTags(selectedTags, 'saved');
            fetchAndDisplayHistory(currentPlanId);
        }
        panzoomInstance.setOptions({ disablePan: false });
    }

    function toggleMultiSelectMode() {
        isMultiSelectMode = !isMultiSelectMode;
        multiSelectToggle.classList.toggle('active', isMultiSelectMode);
        if (!isMultiSelectMode) {
            clearSelection();
        }
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
            }
            toggleTagSelection(clickedTag);
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
        
        const coords = getRelativeCoords(e.clientX, e.clientY);
        
        if (await saveMultiplePositionsAPI([{ id: parseInt(codeId), x: coords.x, y: coords.y }])) {
            await reloadAllDataAndRedraw();
            fetchAndDisplayHistory(currentPlanId);
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
            fetchAndDisplayHistory(currentPlanId);
        }
    }
    
    async function reloadAllDataAndRedraw() {
        console.log('Rechargement de toutes les données...');
        const dataResponse = await fetch('index.php?action=getAllCodesJson');
        const newGeoCodes = await dataResponse.json();
        allCodesData = [...newGeoCodes];
        placedGeoCodes = newGeoCodes;
        await updateDisplayForPlan(currentPlanId);
    }

    async function updateDisplayForPlan(planId) {
        console.log(`Mise à jour de l'affichage pour le plan ID: ${planId}`);
        currentPlanId = planId;
        clearSelection();
        cancelPlacementMode();
        if (isTouchMovingTag) stopTouchMove();
        
        fetchAndDisplayHistory(planId);
    
        if (!planId) {
            mapImage.style.display = 'none';
            planPlaceholder.style.display = 'block';
            printModalBtn.disabled = true;
            touchToolbar.style.display = 'none';
            redrawAllElements();
            return;
        }
    
        const selectedOption = planSelector.querySelector(`option[value="${planId}"]`);
        mapImage.src = `uploads/plans/${selectedOption.dataset.filename}`;
        mapImage.style.display = 'block';
        planPlaceholder.style.display = 'none';
        printModalBtn.disabled = false;
        touchToolbar.style.display = 'flex';
        
        const unplacedCodes = await fetchAvailableCodes(planId);
        const placedIds = new Set(allCodesData.filter(c => c.plan_id).map(c => c.id));
        unplacedCodes.forEach(code => {
            if (!placedIds.has(code.id)) {
                const existingIndex = allCodesData.findIndex(c => c.id === code.id);
                if (existingIndex > -1) {
                    allCodesData[existingIndex] = { ...allCodesData[existingIndex], ...code, plan_id: null, pos_x: null, pos_y: null };
                } else {
                    allCodesData.push(code);
                }
            }
        });
    
        redrawAllElements();
    }
    
    function redrawAllElements() {
        console.log('Redessin de tous les éléments (étiquettes et liste).');
        unplacedList.innerHTML = '';
        zoomWrapper.querySelectorAll('.geo-tag').forEach(tag => tag.remove());
        
        if (!currentPlanId) {
            unplacedList.innerHTML = '<p class="text-muted small">Veuillez sélectionner un plan pour commencer.</p>';
            applyFilters();
            return;
        }
        
        allCodesData.forEach(code => {
            if (code.plan_id == currentPlanId) {
                const tag = createPlacedTag(code);
                tag.style.left = `${code.pos_x}%`;
                tag.style.top = `${code.pos_y}%`;
                zoomWrapper.appendChild(tag);
            }
        });
        
        fetchAvailableCodes(currentPlanId).then(codes => {
            unplacedList.innerHTML = '';
            if (codes.length === 0) {
                unplacedList.innerHTML = '<p class="text-muted small">Aucun code disponible pour ce plan.</p>';
            } else {
                codes.forEach(code => unplacedList.appendChild(createUnplacedItem(code)));
            }
            applyFilters();
            drawAllLines(); // Appel pour dessiner les flèches
        });
    }

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        let unplacedVisibleCount = 0;
        document.querySelectorAll('#unplaced-list .unplaced-item').forEach(item => {
            const searchData = `${item.dataset.code} ${item.dataset.libelle}`.toLowerCase();
            const searchMatch = searchData.includes(searchTerm);
            item.style.display = searchMatch ? 'block' : 'none';
            if (searchMatch) unplacedVisibleCount++;
        });
        document.querySelectorAll('#zoom-wrapper .geo-tag').forEach(tag => {
            const searchData = `${tag.dataset.code} ${tag.dataset.libelle}`.toLowerCase();
            const searchMatch = searchData.includes(searchTerm);
            tag.style.display = searchMatch ? 'flex' : 'none';
        });
        unplacedCounter.textContent = `(${unplacedVisibleCount})`;
    }

    function createPlacedTag(code) {
        const tag = document.createElement('div');
        tag.className = 'geo-tag';
        tag.textContent = code.code_geo;
        tag.dataset.id = code.id;
        tag.dataset.univers = code.univers;
        tag.dataset.code = code.code_geo;
        tag.dataset.libelle = code.libelle;
        tag.style.setProperty('--tag-bg-color', universColors[code.univers] || '#7f8c8d');
        tag.style.backgroundColor = 'var(--tag-bg-color)';
        if (code.width && code.height) {
            tag.style.width = `${code.width}px`;
            tag.style.height = `${code.height}px`;
        }
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        tag.appendChild(resizeHandle);
        return tag;
    }
    
    function createUnplacedItem(code) {
        const item = document.createElement('div');
        item.className = 'unplaced-item';
        item.dataset.id = code.id;
        item.dataset.univers = code.univers;
        item.dataset.code = code.code_geo;
        item.dataset.libelle = code.libelle;
        item.draggable = true;
        item.innerHTML = `<span class="item-code" style="color: ${universColors[code.univers] || '#7f8c8d'}">${code.code_geo}</span><span class="item-libelle">${code.libelle}</span>`;
        return item;
    }

    function showDetailModal(codeId) {
        if (!geoCodeModal) return;
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
            fetchAndDisplayHistory(currentPlanId);
        };
        geoCodeModal.show();
    }
    
    function showContextMenu(tag, x, y) {
        hideContextMenu();
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        const codeId = tag.dataset.id;
        document.getElementById('ctx-details').onclick = () => { hideContextMenu(); showDetailModal(codeId); };
        document.getElementById('ctx-remove').onclick = async () => {
            hideContextMenu();
            if(confirm('Retirer cette étiquette du plan ?')) {
                await unplacePosition(codeId);
                fetchAndDisplayHistory(currentPlanId);
            }
        };
        document.getElementById('ctx-move').onclick = () => { hideContextMenu(); startTouchMove(); };
        document.getElementById('ctx-link').onclick = () => { hideContextMenu(); startLineDrawing(tag); };
        setTimeout(() => document.addEventListener('click', hideContextMenu, { once: true }), 10);
    }

    function hideContextMenu() { contextMenu.style.display = 'none'; }
    
    function toggleTagSelection(tag) {
        if (selectedTags.has(tag)) {
            tag.classList.remove('selected');
            selectedTags.delete(tag);
        } else {
            tag.classList.add('selected');
            selectedTags.add(tag);
        }
    }

    function clearSelection() {
        selectedTags.forEach(tag => tag.classList.remove('selected'));
        selectedTags.clear();
    }

    function updateSelectionBox(e) {
        const planRect = planContainer.getBoundingClientRect();
        const mouseX = e.clientX - planRect.left;
        const mouseY = e.clientY - planRect.top;
        const boxStartX = startCoords.x - planRect.left;
        const boxStartY = startCoords.y - planRect.top;
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

    function flashTags(tags, className) {
        tags.forEach(tag => {
            tag.classList.remove(className); void tag.offsetWidth;
            tag.classList.add(className);
            tag.addEventListener('animationend', () => tag.classList.remove(className), { once: true });
        });
    }
    
    async function unplacePosition(codeId) {
        if (await removePositionAPI(codeId)) {
            await reloadAllDataAndRedraw();
        }
    }

    // --- Fonctions API ---
    async function removePositionAPI(codeId) {
        console.log(`API: Tentative de retrait du code ID: ${codeId}`);
        try {
            const response = await fetch(`index.php?action=removePosition`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(codeId) })
            });
            const result = await response.json();
            console.log('API - Réponse de removePosition:', result);
            if (!response.ok) return false;
            return result.status === 'success';
        } catch (error) { console.error('Erreur API removePosition:', error); return false; }
    }

    async function saveMultiplePositionsAPI(positionsToSave) {
        if (!currentPlanId || positionsToSave.length === 0) return false;
        console.log(`API: Sauvegarde de ${positionsToSave.length} position(s) pour le plan ID: ${currentPlanId}`, positionsToSave);
        try {
            const response = await fetch('index.php?action=saveMultiplePositions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ positions: positionsToSave, plan_id: parseInt(currentPlanId) })
            });
            const result = await response.json();
            console.log('API - Réponse de saveMultiplePositions:', result);
            if (!response.ok) return false;
            return result.status === 'success';
        } catch (error) {
            console.error('Erreur API saveMultiplePositions:', error);
            return false;
        }
    }
    
    async function fetchAvailableCodes(planId) {
        console.log(`API: Récupération des codes disponibles pour le plan ID: ${planId}`);
        try {
            const url = `index.php?action=getAvailableCodesForPlan&id=${planId}`;
            const response = await fetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            console.log(`API: ${data.length} codes disponibles reçus.`);
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error("Erreur API fetchAvailableCodes:", error);
            return [];
        }
    }
    
    async function fetchAndDisplayHistory(planId) {
        if (!planId) {
            historyList.innerHTML = '<p class="text-muted small">Sélectionnez un plan pour voir les dernières modifications.</p>';
            return;
        }
    
        try {
            const response = await fetch(`index.php?action=getHistory&id=${planId}`);
            const historyData = await response.json();
    
            historyList.innerHTML = '';
            if (historyData.length === 0) {
                historyList.innerHTML = '<p class="text-muted small">Aucun historique pour ce plan.</p>';
                return;
            }
    
            historyData.forEach(entry => {
                const item = document.createElement('div');
                item.className = 'history-item';
                
                const actionIcons = {
                    placed: '<i class="bi bi-geo-alt-fill text-success action-icon"></i>',
                    moved: '<i class="bi bi-arrows-move text-primary action-icon"></i>',
                    removed: '<i class="bi bi-x-circle-fill text-danger action-icon"></i>'
                };
                
                const date = new Date(entry.action_timestamp);
                const formattedDate = `${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

                item.innerHTML = `
                    <div class="action-info">
                        ${actionIcons[entry.action_type] || ''}
                        <div>
                            <span class="action-code">${entry.code_geo}</span>
                            <span class="action-time">${formattedDate}</span>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-outline-secondary restore-btn" data-history-id="${entry.id}" title="Restaurer cet état">
                        <i class="bi bi-arrow-counterclockwise"></i>
                    </button>
                `;
                
                item.querySelector('.restore-btn').addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.historyId;
                    if (confirm('Voulez-vous vraiment restaurer cet état ? L\'action actuelle sera enregistrée dans l\'historique.')) {
                        handleRestoreClick(id);
                    }
                });

                historyList.appendChild(item);
            });
        } catch (error) {
            console.error("Erreur lors de la récupération de l'historique:", error);
            historyList.innerHTML = '<p class="text-danger small">Erreur de chargement.</p>';
        }
    }

    async function handleRestoreClick(historyId) {
        try {
            const response = await fetch('index.php?action=restorePosition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(historyId) })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    await reloadAllDataAndRedraw();
                } else {
                    alert('Erreur lors de la restauration : ' + (result.message || ''));
                }
            }
        } catch (error) {
            console.error('Erreur de restauration:', error);
            alert('Une erreur réseau est survenue.');
        }
    }

    // --- Fonctions d'impression ---
    function getPrintOptions() {
        return {
            title: document.getElementById('print-title').value.trim(),
            includeLegend: document.getElementById('print-legend-check').checked,
            onlyFiltered: document.getElementById('print-filter-check').checked,
        };
    }

    function preparePrintContent(options) {
        const printContainer = document.createElement('div');
        if (options.title) {
            const header = document.createElement('div');
            header.className = 'print-header-container no-print';
            header.innerHTML = `<h1>${options.title}</h1><p>Généré le ${new Date().toLocaleDateString('fr-FR')}</p>`;
            printContainer.appendChild(header);
        }
        const planToPrint = zoomWrapper.cloneNode(true);
        planToPrint.style.transform = 'none';
        planToPrint.style.cursor = 'default';
        planToPrint.style.width = '100%'; 
        planToPrint.style.height = 'auto';
        if (options.onlyFiltered) {
            zoomWrapper.querySelectorAll('.geo-tag').forEach((originalTag, index) => {
                if (originalTag.style.display === 'none') {
                    planToPrint.querySelectorAll('.geo-tag')[index].classList.add('print-hidden');
                }
            });
        }
        printContainer.appendChild(planToPrint);
        if (options.includeLegend) {
            const legendContainer = document.createElement('div');
            legendContainer.className = 'print-legend-container';
            legendContainer.innerHTML = '<h2>Légende</h2>';
            const legendContent = document.getElementById('legend-content');
            if (legendContent) {
                legendContainer.appendChild(legendContent.cloneNode(true));
            }
            printContainer.appendChild(legendContainer);
        }
        return printContainer;
    }

    function handleBrowserPrint() {
        const options = getPrintOptions();
        if(printPlanModal) printPlanModal.hide();
        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'absolute';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
        const frameDoc = printFrame.contentWindow.document;
        frameDoc.open();
        frameDoc.write('<!DOCTYPE html><html><head><title>Impression du Plan</title>');
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            frameDoc.head.appendChild(link.cloneNode(true));
        });
        frameDoc.write('</head><body></body></html>');
        frameDoc.close();
        const printContent = preparePrintContent(options);
        frameDoc.body.appendChild(printContent);
        setTimeout(() => {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            setTimeout(() => document.body.removeChild(printFrame), 500);
        }, 500);
    }

    function handlePdfExport() {
        const options = getPrintOptions();
        const filename = (options.title || 'plan').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
        if(printPlanModal) printPlanModal.hide();
        const elementToExport = preparePrintContent(options);
        elementToExport.style.position = 'absolute';
        elementToExport.style.left = '-9999px';
        elementToExport.style.width = '280mm';
        document.body.appendChild(elementToExport);
        const pdfOptions = {
          margin: 10,
          filename: filename
