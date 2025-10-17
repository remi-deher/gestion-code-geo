/**
 * Gestion de la page d'édition des plans avec Fabric.js
 *
 * Ce script gère l'affichage interactif d'un plan, incluant le placement,
 * le déplacement, et la suppression de "tags" (codes géo) sur un canvas HTML5.
 *
 * Prérequis :
 * - La librairie Fabric.js doit être chargée.
 * - Des variables globales PHP doivent être disponibles :
 * - `currentPlanId` : L'ID du plan actuel.
 * - `currentPlan`: L'objet plan actuel (contenant au moins 'id' et 'nom_fichier').
 * - `placedGeoCodes` : Donnée initiale (peut être vide, on chargera via API).
 * - `universColors` : Un objet JSON mappant les noms d'univers à leurs couleurs.
 * - `planUnivers` : Tableau des objets univers associés à ce plan.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Vérifie si on est sur la bonne page en cherchant le conteneur principal et le canvas
    const planPageContainer = document.querySelector('.plan-page-container');
    const canvasEl = document.getElementById('plan-canvas'); // Vérifie aussi le canvas

    if (!planPageContainer || !canvasEl) {
        // console.log("Pas sur la page d'édition de plan ou canvas manquant, script plan.js non exécuté.");
        return; // Sortir si ce n'est pas la page du plan ou si le canvas manque
    }

    // --- CONSTANTES ET VARIABLES GLOBALES ---
    const MIN_ZOOM = 0.1;
    const MAX_ZOOM = 10;
    const FONT_SIZE = 14;
    const TAG_PADDING = 5;

    // --- ÉLÉMENTS DU DOM ---
    const mapImageEl = document.getElementById('map-image');
    const planContainer = document.getElementById('plan-container');
    const unplacedList = document.getElementById('unplaced-list');
    const tagToolbar = document.getElementById('tag-edit-toolbar');
    const deleteTagBtn = document.getElementById('toolbar-delete');
    const highlightTagBtn = document.getElementById('toolbar-highlight');
    const arrowTagBtn = document.getElementById('toolbar-arrow');
    const sizeBtns = document.querySelectorAll('.size-btn');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const searchInput = document.getElementById('tag-search-input');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const addCodeBtn = document.getElementById('add-code-btn');
    const addCodeModalEl = document.getElementById('add-code-modal');
    const addCodeModal = addCodeModalEl ? new bootstrap.Modal(addCodeModalEl) : null;
    const saveNewCodeBtn = document.getElementById('save-new-code-btn');
    const newUniversIdSelect = document.getElementById('new-univers-id');
    const legendContainer = document.getElementById('legend-container'); // Pour la légende

    // Vérification de la présence des éléments essentiels (variables globales)
    if (typeof currentPlanId === 'undefined' || typeof currentPlan === 'undefined' || typeof universColors === 'undefined' || typeof planUnivers === 'undefined') {
        console.error("Variables globales PHP (currentPlanId, currentPlan, universColors, planUnivers) manquantes ou indéfinies.");
        if (planContainer) planContainer.innerHTML = "<p class='text-danger p-3'>Erreur critique : Données de configuration manquantes pour l'éditeur de plan.</p>";
        return;
    }

    // --- INITIALISATION DE FABRIC.JS ---
    const fabricCanvas = new fabric.Canvas(canvasEl, {
        selection: false,
        backgroundColor: '#f8f9fa',
        stopContextMenu: true,
        fireRightClick: true, // Peut être utile pour annuler des actions
    });

    // --- ÉTAT DE L'APPLICATION ---
    let allCodesData = [];
    let fabricObjects = {}; // Map: position_id -> fabric.Group
    let isPlacementMode = false;
    let codeToPlace = null;
    let isPanning = false;
    let lastPosX, lastPosY;
    let selectedFabricObject = null;
    let highlightedCodeGeo = null;
    let isDrawingArrowMode = false;

    const sizePresets = {
        small: { width: 60, height: 20 },
        medium: { width: 80, height: 22 },
        large: { width: 100, height: 24 }
    };

    // --- INITIALISATION ---
    initializePlan();

    async function initializePlan() {
        resizeFabricCanvas();
        try {
            await loadBackgroundImage();
            await fetchAllCodesData();
            createInitialTags();
            addEventListeners();
            await fetchAvailableCodes();
        } catch (error) {
            console.error("Erreur lors de l'initialisation du plan:", error);
            planContainer.innerHTML = `<p class='text-danger p-3'>Impossible de charger le plan ou les données : ${error.message}</p>`;
        }
    }

    // --- GESTION DU CANVAS ET DES OBJETS FABRIC ---

    function resizeFabricCanvas() {
        if (!planContainer) return;
        const containerRect = planContainer.getBoundingClientRect();
        fabricCanvas.setWidth(containerRect.width);
        fabricCanvas.setHeight(containerRect.height);
        fabricCanvas.calcOffset();
        if (fabricCanvas.backgroundImage) {
            resetZoom();
        }
        fabricCanvas.renderAll();
    }

    function loadBackgroundImage() {
        return new Promise((resolve, reject) => {
            const imageUrl = mapImageEl?.src;
            if (!imageUrl || !imageUrl.startsWith('http') && !imageUrl.startsWith('uploads')) { // Vérification plus robuste
                console.warn("URL de l'image du plan invalide:", imageUrl);
                reject(new Error("URL de l'image du plan invalide ou manquante."));
                return;
            }

            console.log("Chargement image:", imageUrl);
            fabric.Image.fromURL(imageUrl, (img, isError) => {
                if (isError || !img) {
                    console.error("Erreur Fabric chargement image:", imageUrl, isError);
                    reject(new Error("Impossible de charger l'image pour Fabric."));
                    return;
                }
                console.log("Image chargée:", img.width, "x", img.height);
                fabricCanvas.setBackgroundImage(img, () => {
                    fabricCanvas.renderAll();
                    resetZoom();
                    console.log("Image de fond définie.");
                    resolve();
                }, {
                    selectable: false, evented: false,
                    originX: 'left', originY: 'top',
                    crossOrigin: 'anonymous' // Tenter d'éviter les pbs de CORS si l'image est locale mais servie différemment
                });
            }, { crossOrigin: 'anonymous' });
        });
    }

    async function fetchAllCodesData() {
        try {
            const response = await fetch('index.php?action=getAllCodesJson');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const rawData = await response.json();

            const groupedData = {};
            rawData.forEach(item => {
                if (!item.id) return; // Ignorer les entrées sans ID de code géo
                if (!groupedData[item.id]) {
                    groupedData[item.id] = {
                        id: item.id, code_geo: item.code_geo, libelle: item.libelle,
                        univers: item.univers, zone: item.zone, commentaire: item.commentaire,
                        placements: []
                    };
                }
                if (item.position_id !== null && item.plan_id !== null) {
                    groupedData[item.id].placements.push({
                        position_id: item.position_id, plan_id: item.plan_id,
                        pos_x: item.pos_x, pos_y: item.pos_y,
                        width: item.width, height: item.height,
                        anchor_x: item.anchor_x, anchor_y: item.anchor_y,
                    });
                }
            });
            allCodesData = Object.values(groupedData);
            console.log("Données codes chargées:", allCodesData.length, "codes");

        } catch (error) {
            console.error("Erreur fetchAllCodesData:", error);
            throw new Error(`Récupération données codes géo échouée (${error.message})`);
        }
    }

    function createInitialTags() {
        fabricObjects = {};
        // Ne pas effacer le fond ! On retire seulement les objets ajoutés précédemment.
        fabricCanvas.remove(...fabricCanvas.getObjects().filter(obj => !obj.isBackgroundImage));

        console.log(`Création tags pour plan ID: ${currentPlanId}`);
        let tagsCreated = 0;
        allCodesData.forEach(code => {
            if (code.placements && Array.isArray(code.placements)) {
                code.placements.forEach(placement => {
                    if (placement.plan_id == currentPlanId && placement.pos_x !== null && placement.pos_y !== null) {
                        createFabricTag({ ...code, ...placement });
                        tagsCreated++;
                    }
                });
            }
        });
        console.log(`${tagsCreated} tags créés.`);
        fabricCanvas.renderAll();
        updateLegend();
    }

    function createFabricTag(code) {
        const bgImage = fabricCanvas.backgroundImage;
        if (!bgImage || code.pos_x === null || code.pos_y === null) return null;

        const bgColor = universColors[code.univers] || '#7f8c8d';
        const codeText = code.code_geo || 'ERR';
        const currentZoom = fabricCanvas.getZoom();

        const tagWidth = code.width || sizePresets.medium.width;
        const tagHeight = code.height || sizePresets.medium.height;

        const rect = new fabric.Rect({
            width: tagWidth, height: tagHeight, fill: bgColor,
            stroke: 'black', strokeWidth: 1 / currentZoom,
            rx: 3, ry: 3, originX: 'center', originY: 'center',
            shadow: 'rgba(0,0,0,0.3) 2px 2px 4px'
        });

        const text = new fabric.Text(codeText, {
            fontSize: FONT_SIZE, fill: 'white', fontWeight: 'bold', fontFamily: 'Arial',
            originX: 'center', originY: 'center',
        });

        const { left, top } = convertPercentToPixels(code.pos_x, code.pos_y);

        const group = new fabric.Group([rect, text], {
            left: left, top: top, originX: 'center', originY: 'center',
            hasControls: false, hasBorders: true, borderColor: '#007bff',
            cornerSize: 0, transparentCorners: true,
            lockRotation: true, lockScalingX: true, lockScalingY: true,
            hoverCursor: 'move',
            customData: {
                positionId: code.position_id, geoCodeId: code.id,
                univers: code.univers, codeGeo: code.code_geo,
                currentWidth: tagWidth, currentHeight: tagHeight,
                anchorXPercent: code.anchor_x, anchorYPercent: code.anchor_y
            }
        });

        if (code.anchor_x !== null && code.anchor_y !== null) {
            addArrowToTag(group, code.anchor_x, code.anchor_y);
        }

        fabricCanvas.add(group);
        fabricObjects[code.position_id] = group;
        updateHighlightEffect(group);
        return group;
    }

    function addArrowToTag(tagGroup, anchorXPercent, anchorYPercent) {
        const bgImage = fabricCanvas.backgroundImage;
        if (!bgImage || anchorXPercent === null || anchorYPercent === null) {
            if (tagGroup.arrowLine) {
                fabricCanvas.remove(tagGroup.arrowLine);
                tagGroup.arrowLine = null;
                fabricCanvas.requestRenderAll();
            }
            return;
        }

        const tagCenter = tagGroup.getCenterPoint();
        const anchorPixels = convertPercentToPixels(anchorXPercent, anchorYPercent);
        const currentZoom = fabricCanvas.getZoom();
        const arrowPoints = [tagCenter.x, tagCenter.y, anchorPixels.left, anchorPixels.top];

        if (tagGroup.arrowLine) {
            // Mettre à jour la ligne existante
            tagGroup.arrowLine.set({
                x1: tagCenter.x, y1: tagCenter.y,
                x2: anchorPixels.left, y2: anchorPixels.top,
                strokeWidth: 2 / currentZoom
            });
        } else {
            // Créer une nouvelle ligne
            tagGroup.arrowLine = new fabric.Line(arrowPoints, {
                stroke: '#34495e', strokeWidth: 2 / currentZoom,
                selectable: false, evented: false,
                originX: 'center', originY: 'center',
            });
            fabricCanvas.add(tagGroup.arrowLine);
        }
        // S'assurer que la flèche est derrière le tag
        tagGroup.arrowLine.moveTo(fabricCanvas.getObjects().indexOf(tagGroup));
        fabricCanvas.requestRenderAll();
    }

    // --- GESTION DES ÉVÉNEMENTS ---

    function addEventListeners() {
        window.addEventListener('resize', resizeFabricCanvas);
        fabricCanvas.on('mouse:wheel', handleMouseWheel);
        fabricCanvas.on('mouse:down', handleMouseDown);
        fabricCanvas.on('mouse:move', handleMouseMove);
        fabricCanvas.on('mouse:up', handleMouseUp);
        fabricCanvas.on('mouse:out', () => { isPanning = false; if (!isPlacementMode && !isDrawingArrowMode) fabricCanvas.defaultCursor = 'default'; });
        fabricCanvas.on('object:modified', handleObjectModified);
        fabricCanvas.on('selection:created', handleSelection);
        fabricCanvas.on('selection:updated', handleSelection);
        fabricCanvas.on('selection:cleared', hideToolbar);

        if (deleteTagBtn) deleteTagBtn.addEventListener('click', deleteSelectedTag);
        if (highlightTagBtn) highlightTagBtn.addEventListener('click', toggleHighlightSelected);
        if (arrowTagBtn) arrowTagBtn.addEventListener('click', startDrawingArrow);
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => zoom(1.2));
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => zoom(0.8));
        if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoom);
        if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
        if (searchInput) searchInput.addEventListener('input', filterAvailableCodes);
        if (toggleSidebarBtn) toggleSidebarBtn.addEventListener('click', () => planPageContainer.classList.toggle('sidebar-hidden'));
        if (addCodeBtn && addCodeModal) addCodeBtn.addEventListener('click', openAddCodeModal);
        if (saveNewCodeBtn) saveNewCodeBtn.addEventListener('click', handleSaveNewCode);
        if (unplacedList) unplacedList.addEventListener('click', handleAvailableCodeClick);

        sizeBtns.forEach(btn => {
            btn.addEventListener('click', changeSelectedTagSize);
        });

        document.addEventListener('keydown', handleKeyDown);
    }

    // --- HANDLERS D'ÉVÉNEMENTS FABRIC ---

    function handleMouseWheel(opt) {
        const delta = opt.e.deltaY;
        let zoomLevel = fabricCanvas.getZoom();
        const zoomFactor = 0.999 ** delta;
        const pointer = fabricCanvas.getPointer(opt.e);

        zoomLevel *= zoomFactor;
        zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel));

        fabricCanvas.zoomToPoint(new fabric.Point(pointer.x, pointer.y), zoomLevel);
        updateStrokesWidth(zoomLevel); // Mettre à jour l'épaisseur des traits

        opt.e.preventDefault();
        opt.e.stopPropagation();
    }


    function handleMouseDown(opt) {
        const evt = opt.e;
        if (opt.target) { // Clic sur un objet (tag)
            selectedFabricObject = opt.target;
            if (isDrawingArrowMode) {
                handleArrowEndPoint(opt); // Termine si on clique sur un tag
                isDrawingArrowMode = false;
            }
            // La sélection est gérée par Fabric -> handleSelection
            return;
        }

        // Clic sur le fond
        selectedFabricObject = null;
        fabricCanvas.discardActiveObject();
        hideToolbar();

        if (isPlacementMode && codeToPlace) {
            placeNewTag(evt);
        } else if (isDrawingArrowMode) {
            handleArrowEndPoint(opt); // Termine si on clique sur le fond
            isDrawingArrowMode = false;
        } else if (evt.altKey) { // Début Pan
            isPanning = true;
            fabricCanvas.defaultCursor = 'grabbing';
            lastPosX = evt.clientX;
            lastPosY = evt.clientY;
        } else {
            fabricCanvas.defaultCursor = 'default';
        }
    }

    function handleMouseMove(opt) {
        if (isPanning) {
            const e = opt.e;
            const delta = new fabric.Point(e.clientX - lastPosX, e.clientY - lastPosY);
            fabricCanvas.relativePan(delta);
            lastPosX = e.clientX;
            lastPosY = e.clientY;
            fabricCanvas.requestRenderAll();
        }
    }

    function handleMouseUp() {
        if (isPanning) {
            isPanning = false;
            if (!isPlacementMode && !isDrawingArrowMode) fabricCanvas.defaultCursor = 'default';
        }
    }

    function handleObjectModified(opt) {
        if (!opt.target || !opt.target.customData) return;
        const movedObject = opt.target;
        const { positionId, geoCodeId } = movedObject.customData;
        const centerPoint = movedObject.getCenterPoint();
        const { posX, posY } = convertPixelsToPercent(centerPoint.x, centerPoint.y);

        const positionData = {
            id: geoCodeId, position_id: positionId, plan_id: currentPlanId,
            pos_x: posX, pos_y: posY,
            width: movedObject.customData.currentWidth,
            height: movedObject.customData.currentHeight,
            anchor_x: movedObject.customData.anchorXPercent,
            anchor_y: movedObject.customData.anchorYPercent
        };

        savePositionAPI(positionData).then(successData => {
            if (successData) {
                 const code = allCodesData.find(c => c.id === geoCodeId);
                 if (code) {
                     const placement = code.placements.find(p => p.position_id === positionId);
                     if (placement) {
                         Object.assign(placement, { pos_x: posX, pos_y: posY }); // Mettre à jour données locales
                     }
                 }
            } else {
                console.error("Échec sauvegarde après déplacement.");
                // TODO: Annuler le déplacement visuel ?
                 // Pour l'instant, on se contente de l'erreur console.
            }
        });

        if (movedObject.arrowLine && movedObject.customData.anchorXPercent !== null) {
            addArrowToTag(movedObject, movedObject.customData.anchorXPercent, movedObject.customData.anchorYPercent); // Recalcule la flèche
        }

        showToolbar(movedObject); // Repositionner la toolbar
    }

    function handleSelection(opt) {
        selectedFabricObject = opt.selected[0];
        if (selectedFabricObject) {
            showToolbar(selectedFabricObject);
            redrawAllTagsHighlight(); // Met à jour l'état visuel (bordure bleue)
        } else {
            hideToolbar();
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Escape') {
            if (isPlacementMode) cancelPlacementMode();
            if (isDrawingArrowMode) cancelArrowDrawing();
            if (fabricCanvas.getActiveObject()) {
                fabricCanvas.discardActiveObject();
                hideToolbar();
                fabricCanvas.renderAll();
            }
            if (highlightedCodeGeo) {
                highlightedCodeGeo = null;
                redrawAllTagsHighlight();
            }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedFabricObject && tagToolbar.classList.contains('visible')) {
                deleteSelectedTag();
            }
        }
    }

    // --- LOGIQUE INTERFACE ---

    function showToolbar(target) {
        if (!tagToolbar) return;
        // Obtenir la boîte englobante absolue (tenant compte du zoom/pan)
        const bound = target.getBoundingRect(true);

        // Positionner au-dessus, centré horizontalement
        tagToolbar.style.left = `${bound.left + bound.width / 2 - tagToolbar.offsetWidth / 2}px`;
        tagToolbar.style.top = `${bound.top - tagToolbar.offsetHeight - 5}px`; // 5px au-dessus
        tagToolbar.style.opacity = '1';
        tagToolbar.style.pointerEvents = 'auto';
        tagToolbar.classList.add('visible');
    }

    function hideToolbar() {
        if (!tagToolbar) return;
        tagToolbar.style.opacity = '0';
        tagToolbar.style.pointerEvents = 'none';
        tagToolbar.classList.remove('visible');
        selectedFabricObject = null;
        redrawAllTagsHighlight(); // Retirer la bordure bleue si désélectionné
    }

    async function deleteSelectedTag() {
        if (!selectedFabricObject || !selectedFabricObject.customData) return;
        const { positionId, geoCodeId } = selectedFabricObject.customData;
        
        // Trouver combien d'instances de ce code sont sur ce plan
         const code = allCodesData.find(c => c.id === geoCodeId);
         const instancesOnThisPlan = code?.placements?.filter(p => p.plan_id == currentPlanId).length || 0;
         let performDelete = false;
         let deleteAllInstances = false;

        if (instancesOnThisPlan > 1) {
            const choice = prompt(
                `${selectedFabricObject.customData.codeGeo} est placé ${instancesOnThisPlan} fois.\n` +
                `Tapez 'cette' pour supprimer cette instance, ou 'tout' pour supprimer toutes les instances sur ce plan.`
            );
             if (choice && choice.toLowerCase() === 'tout') {
                 if (confirm(`Supprimer les ${instancesOnThisPlan} instances de ${selectedFabricObject.customData.codeGeo} ?`)) {
                    performDelete = true;
                    deleteAllInstances = true;
                 }
             } else if (choice && choice.toLowerCase() === 'cette') {
                 if (confirm(`Supprimer cette instance de ${selectedFabricObject.customData.codeGeo} ?`)) {
                     performDelete = true;
                 }
             }
        } else {
             if (confirm(`Supprimer l'étiquette ${selectedFabricObject.customData.codeGeo} ?`)) {
                 performDelete = true;
             }
        }
        
        if (!performDelete) return;

        let success = false;
        if (deleteAllInstances) {
            success = await removeMultiplePositionsAPI(geoCodeId, currentPlanId);
            if (success) {
                 // Supprimer tous les objets Fabric correspondants
                 fabricCanvas.getObjects().forEach(obj => {
                     if (obj.customData && obj.customData.geoCodeId === geoCodeId) {
                         if (obj.arrowLine) fabricCanvas.remove(obj.arrowLine);
                         fabricCanvas.remove(obj);
                         delete fabricObjects[obj.customData.positionId];
                     }
                 });
                 // Mettre à jour allCodesData
                 if(code) code.placements = code.placements.filter(p => p.plan_id != currentPlanId);
                 updateCodeCountInSidebar(geoCodeId, -instancesOnThisPlan);
            }
        } else {
            success = await removePositionAPI(positionId);
            if (success) {
                if (selectedFabricObject.arrowLine) fabricCanvas.remove(selectedFabricObject.arrowLine);
                fabricCanvas.remove(selectedFabricObject);
                delete fabricObjects[positionId];
                 // Mettre à jour allCodesData
                 if (code) {
                      const placementIndex = code.placements.findIndex(p => p.position_id === positionId);
                      if (placementIndex > -1) code.placements.splice(placementIndex, 1);
                 }
                updateCodeCountInSidebar(geoCodeId, -1);
            }
        }

        if (success) {
            fabricCanvas.discardActiveObject();
            fabricCanvas.renderAll();
            hideToolbar();
        } else {
            alert("Erreur lors de la suppression.");
        }
    }

    async function changeSelectedTagSize(event) {
        const size = event.currentTarget.dataset.size;
        if (!selectedFabricObject || !sizePresets[size]) return;

        const preset = sizePresets[size];
        const currentData = selectedFabricObject.customData;

        const rect = selectedFabricObject.item(0);
        const text = selectedFabricObject.item(1); // Pourrait être ajusté si la taille change beaucoup
        rect.set({ width: preset.width, height: preset.height });
        // Recalculer la taille du groupe et le forcer à se redessiner
        selectedFabricObject._setupDimensions();
        selectedFabricObject.setCoords();
        fabricCanvas.renderAll();

        const centerPoint = selectedFabricObject.getCenterPoint();
        const { posX, posY } = convertPixelsToPercent(centerPoint.x, centerPoint.y);
        const positionData = {
            id: currentData.geoCodeId, position_id: currentData.positionId, plan_id: currentPlanId,
            pos_x: posX, pos_y: posY,
            width: preset.width, height: preset.height,
            anchor_x: currentData.anchorXPercent, anchor_y: currentData.anchorYPercent
        };

        const success = await savePositionAPI(positionData);
        if (success) {
            selectedFabricObject.customData.currentWidth = preset.width;
            selectedFabricObject.customData.currentHeight = preset.height;
             // Mettre à jour les données locales
            const code = allCodesData.find(c => c.id === currentData.geoCodeId);
            if(code) {
                const placement = code.placements.find(p => p.position_id === currentData.positionId);
                if(placement) {
                    placement.width = preset.width;
                    placement.height = preset.height;
                }
            }
        } else {
            // Revert visuel ? Pour l'instant on log l'erreur
            console.error("Echec sauvegarde taille.");
        }
        showToolbar(selectedFabricObject); // Repositionner
    }

    function toggleHighlightSelected() {
        if (!selectedFabricObject || !selectedFabricObject.customData) return;
        const codeGeoToHighlight = selectedFabricObject.customData.codeGeo;
        highlightedCodeGeo = (highlightedCodeGeo === codeGeoToHighlight) ? null : codeGeoToHighlight;
        redrawAllTagsHighlight();
    }

    function redrawAllTagsHighlight() {
        fabricCanvas.getObjects().forEach(obj => {
            if (obj.isBackgroundImage) return; // Ne pas affecter le fond
            if (obj.customData) { // C'est un tag géo
                updateHighlightEffect(obj);
            } else if (obj.type === 'line' && fabricCanvas.getObjects().some(tag => tag.arrowLine === obj)) { // C'est une flèche associée
                const correspondingTag = fabricCanvas.getObjects().find(tag => tag.arrowLine === obj);
                if (correspondingTag) {
                     obj.set({ opacity: (highlightedCodeGeo && correspondingTag.customData.codeGeo !== highlightedCodeGeo) ? 0.3 : 1.0 });
                }
            }
        });
        fabricCanvas.renderAll();
    }


    function updateHighlightEffect(fabricObj) {
        if (!fabricObj.customData) return;
        const isHighlighted = highlightedCodeGeo && fabricObj.customData.codeGeo === highlightedCodeGeo;
        const isActiveSelection = fabricCanvas.getActiveObject() === fabricObj;
        const currentZoom = fabricCanvas.getZoom();

        fabricObj.set({
            opacity: (highlightedCodeGeo && !isHighlighted) ? 0.3 : 1.0,
            stroke: isHighlighted ? '#ffc107' : (isActiveSelection ? '#007bff' : 'black'),
            strokeWidth: (isHighlighted || isActiveSelection) ? (2 / currentZoom) : (1 / currentZoom)
        });

        if (fabricObj.item(0)) { // Mettre à jour le stroke du Rect dans le groupe
             fabricObj.item(0).set({
                 stroke: isHighlighted ? '#ffc107' : (isActiveSelection ? '#007bff' : 'black'),
                 strokeWidth: (isHighlighted || isActiveSelection) ? (2 / currentZoom) : (1 / currentZoom)
             });
        }

        if (fabricObj.arrowLine) {
            fabricObj.arrowLine.set({ opacity: fabricObj.opacity });
        }
    }


    function startDrawingArrow() {
        if (!selectedFabricObject) return;
        isDrawingArrowMode = true;
        alert("Cliquez sur le plan où la flèche doit pointer (Echap pour annuler).");
        fabricCanvas.defaultCursor = 'crosshair';
        fabricCanvas.discardActiveObject();
        hideToolbar();
        // L'écouteur est dans handleMouseDown
    }

    function handleArrowEndPoint(opt) {
        if (!selectedFabricObject || !opt) { // Vérifier si un objet était bien sélectionné avant
            cancelArrowDrawing();
            return;
        }

        const pointer = fabricCanvas.getPointer(opt.e);
        const { posX, posY } = convertPixelsToPercent(pointer.x, pointer.y);

        // Mettre à jour customData et visuel
        selectedFabricObject.customData.anchorXPercent = posX;
        selectedFabricObject.customData.anchorYPercent = posY;
        addArrowToTag(selectedFabricObject, posX, posY);

        // Sauvegarde API
        const centerPoint = selectedFabricObject.getCenterPoint();
        const currentPos = convertPixelsToPercent(centerPoint.x, centerPoint.y);
        const positionData = {
            id: selectedFabricObject.customData.geoCodeId,
            position_id: selectedFabricObject.customData.positionId,
            plan_id: currentPlanId,
            pos_x: currentPos.posX, pos_y: currentPos.posY,
            width: selectedFabricObject.customData.currentWidth,
            height: selectedFabricObject.customData.currentHeight,
            anchor_x: posX, anchor_y: posY
        };

        savePositionAPI(positionData).then(success => {
            if (success) {
                 // Mettre à jour données locales
                const code = allCodesData.find(c => c.id === selectedFabricObject.customData.geoCodeId);
                 if (code) {
                     const placement = code.placements.find(p => p.position_id === selectedFabricObject.customData.positionId);
                     if (placement) {
                         placement.anchor_x = posX;
                         placement.anchor_y = posY;
                     }
                 }
            } else {
                console.error("Echec sauvegarde ancre.");
                // Annuler visuel
                selectedFabricObject.customData.anchorXPercent = null;
                selectedFabricObject.customData.anchorYPercent = null;
                addArrowToTag(selectedFabricObject, null, null);
            }
        });

        cancelArrowDrawing(); // Nettoie état et curseur
        fabricCanvas.setActiveObject(selectedFabricObject); // Resélectionner
        fabricCanvas.renderAll();
    }

    function cancelArrowDrawing() {
        isDrawingArrowMode = false;
        fabricCanvas.defaultCursor = 'default';
        if (selectedFabricObject) { // Resélectionner et réafficher toolbar si un objet était sélectionné
            fabricCanvas.setActiveObject(selectedFabricObject);
            showToolbar(selectedFabricObject);
        }
    }


    function zoom(factor) {
        const center = fabricCanvas.getCenter(); // Centre actuel de la vue
        const currentZoom = fabricCanvas.getZoom();
        let newZoom = currentZoom * factor;
        newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
        // Zoom par rapport au centre de la vue
        fabricCanvas.zoomToPoint(new fabric.Point(center.left, center.top), newZoom);
        updateStrokesWidth(newZoom);
        fabricCanvas.requestRenderAll();
    }

    function updateStrokesWidth(zoomLevel) {
        fabricCanvas.getObjects().forEach(obj => {
            if (obj.isBackgroundImage) return;
            const strokeWidthBase = (obj.type === 'line') ? 2 : 1; // Flèches plus épaisses
            const selectedStrokeWidth = 2; // Épaisseur quand sélectionné/highlighté

            if (obj.customData) { // Tag
                const isHighlighted = highlightedCodeGeo && obj.customData.codeGeo === highlightedCodeGeo;
                const isActiveSelection = fabricCanvas.getActiveObject() === obj;
                 const sw = (isHighlighted || isActiveSelection) ? selectedStrokeWidth : strokeWidthBase;
                 obj.item(0)?.set('strokeWidth', sw / zoomLevel); // Rectangle dans le groupe
            }
            if (obj.arrowLine) { // Flèche associée à un tag
                 obj.arrowLine.set('strokeWidth', strokeWidthBase / zoomLevel);
            } else if (obj.type === 'line') { // Flèche (si ajoutée directement)
                 obj.set('strokeWidth', strokeWidthBase / zoomLevel);
            }
        });
    }

    function resetZoom() {
        const bgImage = fabricCanvas.backgroundImage;
        if (!bgImage || !bgImage.width || !bgImage.height) return;

        const canvasWidth = fabricCanvas.getWidth();
        const canvasHeight = fabricCanvas.getHeight();
        const imgWidth = bgImage.width;
        const imgHeight = bgImage.height;

        // Calculer l'échelle pour adapter l'image entière
        const scaleX = canvasWidth / imgWidth;
        const scaleY = canvasHeight / imgHeight;
        const scaleToFit = Math.min(scaleX, scaleY);

        fabricCanvas.setZoom(scaleToFit);

        // Centrer l'image
        const panX = (canvasWidth - imgWidth * scaleToFit) / 2;
        const panY = (canvasHeight - imgHeight * scaleToFit) / 2;
        fabricCanvas.absolutePan({ x: panX, y: panY });

        updateStrokesWidth(scaleToFit);
        fabricCanvas.renderAll();
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            planPageContainer?.requestFullscreen().catch(err => {
                alert(`Erreur Fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
        // Attendre un peu que le changement de taille soit effectif
        setTimeout(resizeFabricCanvas, 300);
    }

    // --- LOGIQUE SIDEBAR ---

    async function fetchAvailableCodes() {
        if (!unplacedList) return;
        try {
            const response = await fetch(`index.php?action=getAvailableCodesForPlan&id=${currentPlanId}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const codes = await response.json();
            renderAvailableCodes(codes);
        } catch (error) {
            console.error("Erreur fetchAvailableCodes:", error);
            unplacedList.innerHTML = `<p class="text-danger p-3">Erreur chargement codes.</p>`;
            updateCounter(0);
        }
    }

    function renderAvailableCodes(codes) {
        if (!unplacedList) return;
        unplacedList.innerHTML = '';
        if (!codes || codes.length === 0) {
            unplacedList.innerHTML = `<p class="text-muted small p-3">Aucun code disponible pour ce plan.</p>`;
            updateCounter(0);
            return;
        }

        codes.forEach(code => {
            const item = document.createElement('div');
            // Classes Bootstrap pour l'apparence
            item.className = 'unplaced-item list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            item.dataset.id = code.id;
            item.dataset.codeGeo = code.code_geo;
            item.dataset.libelle = code.libelle;
            item.dataset.univers = code.univers;
            item.dataset.search = `${code.code_geo} ${code.libelle} ${code.univers}`.toLowerCase();
            item.style.borderLeft = `5px solid ${universColors[code.univers] || '#ccc'}`;
            item.style.cursor = 'pointer';

            item.innerHTML = `
                <div>
                    <strong class="item-code">${code.code_geo}</strong>
                    <small class="item-libelle d-block text-muted">${code.libelle}</small>
                </div>
                <span class="badge bg-secondary rounded-pill placement-count">${code.placement_count}</span>
            `;
            unplacedList.appendChild(item);
        });
        filterAvailableCodes();
    }

    function filterAvailableCodes() {
        if (!searchInput || !unplacedList) return;
        const searchTerm = searchInput.value.toLowerCase();
        let visibleCount = 0;
        document.querySelectorAll('#unplaced-list .unplaced-item').forEach(item => {
            const isVisible = item.dataset.search.includes(searchTerm);
            item.style.display = isVisible ? 'flex' : 'none';
            if (isVisible) visibleCount++;
        });
        updateCounter(visibleCount);
    }

    function updateCounter(count) {
        const counterEl = document.getElementById('unplaced-counter');
        if (counterEl) {
            counterEl.textContent = `${count}`;
        }
    }

    function handleAvailableCodeClick(event) {
        const item = event.target.closest('.unplaced-item');
        if (item) {
            cancelArrowDrawing(); // Annuler si on dessinait une flèche
            isPlacementMode = true;
            codeToPlace = {
                id: item.dataset.id, code_geo: item.dataset.codeGeo,
                libelle: item.dataset.libelle, univers: item.dataset.univers
            };
            planContainer.classList.add('placement-mode');
            fabricCanvas.defaultCursor = 'crosshair';
            fabricCanvas.discardActiveObject();
            hideToolbar();
            document.querySelectorAll('#unplaced-list .unplaced-item.active').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            console.log("Mode placement:", codeToPlace);
        }
    }

    function cancelPlacementMode() {
        isPlacementMode = false;
        codeToPlace = null;
        planContainer.classList.remove('placement-mode');
        fabricCanvas.defaultCursor = 'default';
        document.querySelectorAll('#unplaced-list .unplaced-item.active').forEach(el => el.classList.remove('active'));
        // console.log("Mode placement annulé.");
    }

    async function placeNewTag(clickEvent) {
        if (!isPlacementMode || !codeToPlace) return;

        const pointer = fabricCanvas.getPointer(clickEvent);
        const { posX, posY } = convertPixelsToPercent(pointer.x, pointer.y);

        const newPositionData = {
            id: codeToPlace.id, plan_id: currentPlanId,
            pos_x: posX, pos_y: posY,
            width: sizePresets.medium.width, height: sizePresets.medium.height,
        };

        const savedData = await savePositionAPI(newPositionData);

        if (savedData && savedData.position_id) {
            const fullCodeData = {
                 ...codeToPlace, position_id: savedData.position_id, plan_id: currentPlanId,
                 pos_x: posX, pos_y: posY,
                 width: newPositionData.width, height: newPositionData.height,
                 anchor_x: null, anchor_y: null
            };
            const newTag = createFabricTag(fullCodeData);
            if (newTag) {
                fabricCanvas.setActiveObject(newTag);
                 showToolbar(newTag); // Afficher toolbar après placement
            }
            fabricCanvas.renderAll();
            updateCodeCountInSidebar(codeToPlace.id, 1);

            // MAJ allCodesData
             const code = allCodesData.find(c => c.id === codeToPlace.id);
             if (code) {
                 if (!code.placements) code.placements = [];
                 code.placements.push({
                     position_id: savedData.position_id, plan_id: currentPlanId,
                     pos_x: posX, pos_y: posY, width: newPositionData.width, height: newPositionData.height,
                     anchor_x: null, anchor_y: null
                 });
             }
        } else {
            alert("Erreur lors de l'enregistrement du tag.");
        }
        cancelPlacementMode();
    }

    function updateCodeCountInSidebar(geoCodeId, change) {
        if (!unplacedList) return;
        const item = unplacedList.querySelector(`.unplaced-item[data-id="${geoCodeId}"]`);
        if (item) {
            const countBadge = item.querySelector('.placement-count');
            if (countBadge) {
                let currentCount = parseInt(countBadge.textContent, 10);
                currentCount = Math.max(0, currentCount + change);
                countBadge.textContent = currentCount;
            }
        }
    }

    // --- MODALE "AJOUTER CODE" ---

    function openAddCodeModal() {
        if (!newUniversIdSelect || !addCodeModal) return;
        newUniversIdSelect.innerHTML = '<option value="">Choisir un univers...</option>';
        (planUnivers || []).forEach(u => { // Utiliser planUnivers de PHP
            const option = document.createElement('option');
            option.value = u.id;
            option.textContent = u.nom;
            newUniversIdSelect.appendChild(option);
        });
        document.getElementById('add-code-form')?.reset();
        addCodeModal.show();
    }

    async function handleSaveNewCode() {
        const form = document.getElementById('add-code-form');
        if (!form) return;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.code_geo || !data.libelle || !data.univers_id) {
            alert("Veuillez remplir tous les champs requis.");
            return;
        }

        try {
            const response = await fetch('index.php?action=addGeoCodeFromPlan', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            const newCode = await response.json(); // Doit retourner les infos complètes

            // Ajouter aux données globales
            const newCodeFormatted = {
                id: newCode.id, code_geo: newCode.code_geo, libelle: newCode.libelle,
                univers: newCode.univers, zone: newCode.zone, commentaire: newCode.commentaire,
                placements: []
            };
            allCodesData.push(newCodeFormatted);

            await fetchAvailableCodes(); // Mettre à jour la sidebar

            addCodeModal.hide();
            form.reset();

            // Activer mode placement pour le nouveau code
            const newItemInList = unplacedList?.querySelector(`.unplaced-item[data-id="${newCode.id}"]`);
            if (newItemInList) {
                isPlacementMode = true;
                codeToPlace = newCodeFormatted;
                planContainer.classList.add('placement-mode');
                fabricCanvas.defaultCursor = 'crosshair';
                newItemInList.classList.add('active');
                alert("Nouveau code créé. Cliquez sur le plan pour le placer.");
            }

        } catch (error) {
            console.error('Erreur création code géo:', error);
            alert(`Erreur: ${error.message}`);
        }
    }

    // --- CONVERSIONS COORDONNÉES ---

    function convertPercentToPixels(percentX, percentY) {
        const bgImage = fabricCanvas.backgroundImage;
        if (!bgImage || !bgImage.width || !bgImage.height) return { left: 0, top: 0 };
        return {
            left: (percentX / 100) * bgImage.width,
            top: (percentY / 100) * bgImage.height,
        };
    }

    function convertPixelsToPercent(pixelX, pixelY) {
        const bgImage = fabricCanvas.backgroundImage;
        if (!bgImage || !bgImage.width || !bgImage.height) return { posX: 0, posY: 0 };
        return {
            posX: Math.max(0, Math.min(100, (pixelX / bgImage.width) * 100)),
            posY: Math.max(0, Math.min(100, (pixelY / bgImage.height) * 100)),
        };
    }

    // --- LÉGENDE ---
    function updateLegend() {
        if (!legendContainer) return;
        legendContainer.innerHTML = '';
        const placedUnivers = new Set();
        fabricCanvas.getObjects().forEach(obj => {
            if (obj.customData && obj.customData.univers) {
                placedUnivers.add(obj.customData.univers);
            }
        });

        if (placedUnivers.size === 0) {
            legendContainer.innerHTML = '<p class="text-muted small">Aucun code placé.</p>';
            return;
        }

        placedUnivers.forEach(universName => {
            const color = universColors[universName] || '#7f8c8d';
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item d-flex align-items-center mb-1'; // Style Bootstrap
            legendItem.innerHTML = `
                <div class="legend-color-box me-2" style="width: 15px; height: 15px; background-color: ${color}; border: 1px solid #666;"></div>
                <span>${universName}</span>
            `;
            legendContainer.appendChild(legendItem);
        });
    }

    // --- API CALLS ---

    async function savePositionAPI(positionData) {
        const dataToSend = {
            id: positionData.id, plan_id: positionData.plan_id,
            pos_x: positionData.pos_x, pos_y: positionData.pos_y,
            width: positionData.width, height: positionData.height,
            anchor_x: positionData.anchor_x, anchor_y: positionData.anchor_y,
            position_id: positionData.position_id
        };
        try {
            const response = await fetch('index.php?action=savePosition', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            const result = await response.json();
            if (result.status === 'success') {
                console.log("Position sauvegardée:", dataToSend.position_id || "(nouvelle)");
                // L'API devrait retourner le nouvel ID si création
                return { position_id: dataToSend.position_id || result.new_position_id || null };
            } else {
                throw new Error(result.message || 'Erreur serveur sauvegarde.');
            }
        } catch (error) {
            console.error("Erreur savePositionAPI:", error);
            alert(`Erreur sauvegarde: ${error.message}`);
            return null;
        }
    }

    async function removePositionAPI(positionId) {
        if (!positionId) {
            console.error("Tentative suppression sans ID.");
            return false;
        }
        try {
            const response = await fetch('index.php?action=removePosition', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: positionId }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            const result = await response.json();
            if (result.status === 'success') {
                console.log("Position supprimée:", positionId);
                return true;
            } else {
                throw new Error(result.message || 'Erreur serveur suppression.');
            }
        } catch (error) {
            console.error("Erreur removePositionAPI:", error);
            alert(`Erreur suppression: ${error.message}`);
            return false;
        }
    }
    
     async function removeMultiplePositionsAPI(geoCodeId, planId) {
         if (!geoCodeId || !planId) return false;
         try {
             const response = await fetch('index.php?action=removeMultiplePositions', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ geo_code_id: geoCodeId, plan_id: planId })
             });
             if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`HTTP ${response.status}: ${errorText}`);
             }
             const result = await response.json();
             if (result.status === 'success') {
                 console.log(`Toutes positions pour code ${geoCodeId} supprimées du plan ${planId}`);
                 return true;
             } else {
                 throw new Error(result.message || 'Erreur serveur suppression multiple.');
             }
         } catch (error) {
             console.error("Erreur removeMultiplePositionsAPI:", error);
             alert(`Erreur suppression multiple: ${error.message}`);
             return false;
         }
     }

}); // Fin DOMContentLoaded
