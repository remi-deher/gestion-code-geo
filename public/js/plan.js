document.addEventListener('DOMContentLoaded', () => {
    // --- VÉRIFICATION INITIALE ---
    const planPageContainer = document.querySelector('.plan-page-container');
    if (!planPageContainer) {
        return; 
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
    const searchInput = document.getElementById('tag-search-input');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    const accordionItems = document.querySelectorAll('.accordion-item');
    const tagSizeSelector = document.getElementById('tag-size-selector');
    const planPlaceholder = document.getElementById('plan-placeholder');
    const printModalBtn = document.getElementById('open-print-modal-btn');
    const printPlanModalEl = document.getElementById('printPlanModal');
    const printPlanModal = new bootstrap.Modal(printPlanModalEl);
    const printBrowserBtn = document.getElementById('print-browser-btn');
    const printPdfBtn = document.getElementById('print-pdf-btn');
    const historyList = document.getElementById('history-list'); // NOUVEAU

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
    let allCodesData = [...placedGeoCodes]; 

    // --- INITIALISATION ---
    panzoomInstance = Panzoom(zoomWrapper, {
        maxScale: 10, minScale: 0.5, excludeClass: 'geo-tag', canvas: true
    });
    zoomWrapper.classList.add('tag-size-medium');
    addEventListeners();
    updateDisplayForPlan(null);

    // --- GESTION DES ÉVÉNEMENTS ---
    function addEventListeners() {
        planContainer.addEventListener('wheel', panzoomInstance.zoomWithWheel, { passive: false });
        planSelector.addEventListener('change', (e) => updateDisplayForPlan(e.target.value));
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
        
        printModalBtn.addEventListener('click', () => printPlanModal.show());
        printBrowserBtn.addEventListener('click', handleBrowserPrint);
        printPdfBtn.addEventListener('click', handlePdfExport);

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
    
    async function updateDisplayForPlan(planId) {
        currentPlanId = planId;
        clearSelection();
        fetchAndDisplayHistory(planId); // On charge l'historique
    
        if (!planId) {
            mapImage.style.display = 'none';
            planPlaceholder.style.display = 'block';
            printModalBtn.disabled = true;
            redrawAllElements();
            return;
        }
    
        const selectedOption = planSelector.querySelector(`option[value="${planId}"]`);
        mapImage.src = `uploads/plans/${selectedOption.dataset.filename}`;
        mapImage.style.display = 'block';
        planPlaceholder.style.display = 'none';
        printModalBtn.disabled = false;
        
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

    // ... (les autres fonctions restent identiques jusqu'à la fin du fichier)
    
    // NOUVELLES FONCTIONS POUR L'HISTORIQUE
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
                const formattedDate = `${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR')}`;

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
                    if (confirm('Voulez-vous vraiment restaurer cet état ?')) {
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
                    // Recharger toutes les données pour être sûr de l'état actuel
                    const fullDataResponse = await fetch('index.php?action=getGeoCodes');
                    allCodesData = await fullDataResponse.json();
                    
                    await updateDisplayForPlan(currentPlanId);
                } else {
                    alert('Erreur lors de la restauration.');
                }
            }
        } catch (error) {
            console.error('Erreur de restauration:', error);
        }
    }
    
    // ... (le reste des fonctions de gestion de la vue et des API)

    function redrawAllElements() {
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
        });
    }

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        
        let unplacedVisibleCount = 0;
        document.querySelectorAll('#unplaced-list .unplaced-item').forEach(item => {
            const searchData = `${item.dataset.code} ${item.dataset.libelle}`.toLowerCase();
            const searchMatch = searchData.includes(searchTerm);
            if (searchMatch) {
                item.style.display = 'block';
                unplacedVisibleCount++;
            } else {
                item.style.display = 'none';
            }
        });

        document.querySelectorAll('#zoom-wrapper .geo-tag').forEach(tag => {
            const searchData = `${tag.dataset.code} ${tag.dataset.libelle}`.toLowerCase();
            const searchMatch = searchData.includes(searchTerm);
            tag.style.display = searchMatch ? 'flex' : 'none';
        });

        unplacedCounter.textContent = `(${unplacedVisibleCount})`;
    }

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
                    tag.style.left = `${Math.max(0, Math.min(100, startPos.x + dx))}%`;
                    tag.style.top = `${Math.max(0, Math.min(100, startPos.y + dy))}%`;
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
                const positionsToSave = Array.from(selectedTags).map(tag => ({ id: parseInt(tag.dataset.id), x: parseFloat(tag.style.left), y: parseFloat(tag.style.top) }));
                
                if (await saveMultiplePositionsAPI(positionsToSave)) {
                    positionsToSave.forEach(pos => {
                        const code = allCodesData.find(c => c.id == pos.id);
                        if(code) {
                            code.pos_x = pos.x;
                            code.pos_y = pos.y;
                            code.plan_id = currentPlanId;
                        }
                    });
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
            }
            await redrawAllElements();
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
    
    function toggleTagSelection(tag) {
        if (tag.classList.contains('selected')) {
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

    function flashTags(tags, className) {
        tags.forEach(tag => {
            tag.classList.remove(className);
            void tag.offsetWidth;
            tag.classList.add(className);
            tag.addEventListener('animationend', () => tag.classList.remove(className), { once: true });
        });
    }

    async function unplacePosition(codeId) {
        if (await removePositionAPI(codeId)) {
            const code = allCodesData.find(c => c.id == codeId);
            if (code) {
                code.plan_id = null; 
                code.pos_x = null; 
                code.pos_y = null;
            }
            await redrawAllElements();
        }
    }

    async function removePositionAPI(codeId) {
        try {
            const response = await fetch(`index.php?action=removePosition`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(codeId) })
            });
            if (!response.ok) return false;
            return (await response.json()).status === 'success';
        } catch (error) { console.error('Erreur:', error); return false; }
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
        printPlanModal.hide();

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
        printPlanModal.hide();

        const elementToExport = preparePrintContent(options);
        elementToExport.style.position = 'absolute';
        elementToExport.style.left = '-9999px';
        elementToExport.style.width = '280mm';
        document.body.appendChild(elementToExport);

        const pdfOptions = {
          margin: 10,
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        
        html2pdf().set(pdfOptions).from(elementToExport).save().then(() => {
            if (elementToExport.parentElement) {
                 elementToExport.parentElement.removeChild(elementToExport);
            }
        });
    }
});
