// --- IMPORTS ---
import {
    initializeCanvas, loadSvgPlan, loadPlanImage,
    getCanvasInstance, resizeCanvas,
    resetZoom, setCanvasLock, getCanvasLock,
    findSvgShapeByCodeGeo, toggleSnapToGrid, getSnapToGrid,
    zoomCanvas,
    updateGrid, updateStrokesWidth
} from './canvas.js';

import {
    initializeSidebar,
    fetchAndClassifyCodes,
    populateUniversSelectInModal,
    handleSaveNewCodeInModal,
    handleAvailableCodeClick,
    handlePlacedCodeClick
} from './sidebar.js';

import {
    initializeDrawingTools,
    setActiveTool,
    getCurrentDrawingTool,
    startDrawing,
    continueDrawing,
    stopDrawing,
    getIsDrawing,
    copyShape,
    pasteShape,
    deleteSelectedDrawingShape,
    groupSelectedObjects,
    ungroupSelectedObject
} from './drawing-tools.js';

import {
    initializeUI,
    showLoading, hideLoading
} from './ui.js';

// CORRECTION: Importer initializeGeoTags et ses dépendances
import {
    initializeGeoTags, // <-- AJOUT de l'import
    addArrowToTag,
    showToolbar,
    hideToolbar,
    handleGeoTagModified, // Si utilisé directement par main.js (sinon optionnel)
    getIsDrawingArrowMode, // Si utilisé
    handleArrowEndPoint,   // Si utilisé
    cancelArrowDrawing // <-- AJOUT : nécessaire pour Escape key
    // Importez d'autres fonctions de geo-tags si nécessaire
} from './geo-tags.js';

import {
    showToast,
    convertPixelsToPercent,
    convertPercentToPixels // <-- Assurez-vous que cette fonction est bien importée
} from '../modules/utils.js';

import {
    sizePresets,
    GEO_TEXT_FONT_SIZE,
    GEO_TAG_FONT_SIZE, // <-- Assurez-vous que cette constante est bien importée
    GRID_SIZE
} from '../modules/config.js';

import {
    savePosition,
    removePosition,
    saveNewGeoCode,
    saveAsset,
    getAssetData,
    listAssets,
    saveDrawingData,
    createSvgPlan,
    updateSvgPlan,
    removeMultiplePositions
 } from '../modules/api.js';


// --- INITIALISATION GLOBALE ---

let fabricCanvas;
let currentPlanId;
let planType;
let planImageUrl;
let planSvgUrl;
let initialPlacedGeoCodes;
let universColors;
let planUnivers;

// --- DÉMARRAGE ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Plan Editor v2 (Correction API + geo-tags init) - DOMContentLoaded"); // Log mis à jour

    try {
        const phpDataElement = document.getElementById('plan-data');
        const phpData = phpDataElement ? JSON.parse(phpDataElement.textContent || '{}') : (window.PHP_DATA || {});

        initialPlacedGeoCodes = phpData.placedGeoCodes || [];
        universColors = phpData.universColors || {}; // Récupéré ici
        currentPlanId = phpData.currentPlanId;
        planType = phpData.planType;
        planUnivers = phpData.planUnivers || [];

        if (phpData.currentPlan && phpData.currentPlan.nom_fichier) {
            const baseUrl = 'uploads/plans/';
            if (planType === 'svg') {
                planSvgUrl = baseUrl + phpData.currentPlan.nom_fichier;
            } else if (planType === 'image') {
                planImageUrl = baseUrl + phpData.currentPlan.nom_fichier;
            }
        }

        if (!currentPlanId || !planType) { throw new Error("Données PHP essentielles manquantes."); }
        console.log("Données initiales chargées:", phpData);

    } catch (error) {
        console.error("Erreur lors de la récupération des données PHP:", error);
        showToast("Erreur critique: Données initiales non chargées.", 'error');
        return;
    }


    showLoading("Initialisation du plan...");
    try {
        fabricCanvas = initializeCanvas('plan-canvas');
        if (!fabricCanvas) { throw new Error("Impossible d'initialiser le canvas Fabric."); }
        console.log("Canvas Fabric initialisé dans canvas.js");

        initializeSidebar(fabricCanvas, universColors, currentPlanId, planType, planUnivers);
        console.log("Sidebar (rôle info) initialisée.");

        initializeDrawingTools(fabricCanvas);
        console.log("Outils de dessin initialisés.");

        // CORRECTION: Initialiser geo-tags APRÈS le canvas et AVANT les listeners
        initializeGeoTags(fabricCanvas, universColors); // <-- AJOUT de l'appel
        console.log("GeoTags initialisé.");

        initializeUI(fabricCanvas);
        console.log("UI (sidebar toggle, fullscreen) initialisée.");

        // --- Chargement du plan (SVG/Image) ---
        if (planType === 'svg' && planSvgUrl) {
            await loadSvgPlan(planSvgUrl);
            setCanvasLock(true);
        } else if (planType === 'image' && planImageUrl) {
            await loadPlanImage(planImageUrl);
            // setCanvasLock(true); // Pas de verrouillage pour images pour l'instant
        } else if (planType === 'svg_creation'){
            console.log("Mode création SVG vierge.");
        }
        else {
            resizeCanvas();
            showToast("Aucun plan (SVG/Image) n'a été chargé.", 'warning');
        }

        setupEventListeners(); // Attacher les listeners APRÈS l'init des modules

        // --- Placement éléments initiaux et chargement sidebar ---
        if (planType !== 'svg_creation') {
            createInitialGeoElements(initialPlacedGeoCodes, planType);
            await fetchAndClassifyCodes();
        }

        // --- Configuration modale ajout code ---
	    const universSelectEl = document.getElementById('new-univers-id');
        if (universSelectEl) {
            populateUniversSelectInModal(universSelectEl, planUnivers);
        }
        const saveBtn = document.getElementById('save-new-code-btn');
        const addForm = document.getElementById('add-code-form');
        const addModalEl = document.getElementById('add-code-modal');
        const addModalInstance = addModalEl ? new bootstrap.Modal(addModalEl) : null;
        if (saveBtn && addForm && addModalInstance) {
            saveBtn.addEventListener('click', async () => {
                const success = await handleSaveNewCodeInModal(addForm, saveBtn, saveNewGeoCode);
                if (success) {
                    addModalInstance.hide();
                    await fetchAndClassifyCodes();
                }
            });
        }

        // --- Mise à jour état initial boutons ---
        updateDrawingToolButtons();
        updateLockButtonState();
        updateGroupButtonStates();

    } catch (error) {
        console.error("Erreur majeure lors de l'initialisation:", error);
        showToast(`Erreur d'initialisation: ${error.message}`, 'error');
    } finally {
        hideLoading();
        resizeCanvas();
        resetZoom();
        console.log("Fin initialisation main.js");
    }
});


/**
 * Attache les écouteurs d'événements principaux au canvas et au document.
 */
function setupEventListeners() {
    if (!fabricCanvas) return;
    console.log("Attaching ALL event listeners...");

    // --- Événements Souris sur le Canvas ---
    fabricCanvas.on('mouse:down', handleMouseDown);
    fabricCanvas.on('mouse:move', handleMouseMove);
    fabricCanvas.on('mouse:up', handleMouseUp);

    // --- Autres événements Canvas ---
    fabricCanvas.on('object:moving', (options) => {
        // --- Magnétisme ---
        if (getSnapToGrid()) {
            const snapSize = GRID_SIZE || 10;
            const target = options.target;
            if (target.type !== 'line') {
                target.set({
                    left: Math.round(target.left / snapSize) * snapSize,
                    top: Math.round(target.top / snapSize) * snapSize
                });
                target.setCoords();
            }
        }
        // --- Màj Toolbar ---
        const target = options.target;
        if (target && (target.customData?.isGeoTag || target.customData?.isPlacedText)) {
            showToolbar(target); // Fonction importée de geo-tags.js
        }
    });

    fabricCanvas.on('object:modified', (e) => {
        const target = e.target;
        if (target && (target.customData?.isGeoTag || target.customData?.isPlacedText)) {
            console.log("Object Géo modifié (déplacé):", target.customData.codeGeo);
            // CORRECTION: Appeler handleGeoTagModified si c'est un tag (flèche, etc.)
            if (target.customData.isGeoTag) {
                 handleGeoTagModified(target); // Utilise la fonction dédiée de geo-tags.js
            } else {
                 handleObjectMoved(target); // Fonction générique pour texte/autres
            }
        } else if (target && !target.isGridLine) { // Ne pas sauvegarder modif grille
            console.log("Objet Dessin modifié:", target.type);
            triggerAutoSaveDrawing();
        }
    });

    fabricCanvas.on('selection:created', (e) => { handleSelectionChange(e.selected); });
    fabricCanvas.on('selection:updated', (e) => { handleSelectionChange(e.selected); });
    fabricCanvas.on('selection:cleared', (e) => {
        console.log("Selection cleared");
        handleObjectDeselected(); // Gère sidebar + hideToolbar()
        updateGroupButtonStates();
    });

    fabricCanvas.on('viewport:transformed', () => {
        const zoom = fabricCanvas.getZoom();
        updateGrid(zoom);
        updateStrokesWidth(zoom);
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj && (activeObj.customData?.isGeoTag || activeObj.customData?.isPlacedText)) {
            showToolbar(activeObj); // Màj position toolbar
        }
    });

    fabricCanvas.upperCanvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

    // --- Événements du Document ---
    document.addEventListener('click', () => { /* ... cacher menu contextuel ... */ });

    document.addEventListener('keydown', (e) => {
        const isInputFocused = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
        const activeObject = fabricCanvas.getActiveObject();

        if (e.key === 'Escape') {
            console.log("Escape key pressed");
            // Annuler dessin flèche si actif
            if (getIsDrawingArrowMode && getIsDrawingArrowMode()) {
                 cancelArrowDrawing(); // Importé de geo-tags.js
            }
            // Annuler dessin forme si actif
            if (getIsDrawing()) {
                 console.log("Cancelling drawing (Escape)");
                 stopDrawing(null, true); // Annuler le dessin en cours
            }
            // Revenir en mode select si autre outil actif
             if (getCurrentDrawingTool() !== 'select') {
                 console.log("Switching back to select tool (Escape)");
                 setActiveTool('select');
                 updateDrawingToolButtons();
             }
            // Désélectionner
            fabricCanvas.discardActiveObject().renderAll();
            handleObjectDeselected(); // Gère sidebar + hideToolbar
            e.preventDefault();
        }

        if (isInputFocused) return;

        // --- Raccourcis Ctrl/Cmd ---
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'c': copyShape(); e.preventDefault(); break;
                case 'v': pasteShape(); e.preventDefault(); break;
                case 'g':
                     if (activeObject) {
                        e.shiftKey ? ungroupSelectedObject() : groupSelectedObjects();
                     }
                     e.preventDefault();
                     break;
                 case 'l':
                    if (planType === 'svg') { document.getElementById('toggle-lock-svg-btn')?.click(); }
                    e.preventDefault();
                    break;
            }
        }
        // --- Raccourcis Simples ---
        else {
            switch (e.key) {
                case 'Delete':
                case 'Backspace':
                    if (activeObject) {
                        if (activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText) {
                             handleDeleteObject(activeObject);
                        } else if (!activeObject.isEditing) {
                            deleteSelectedDrawingShape();
                        }
                    }
                    e.preventDefault();
                    break;
                // --- Raccourcis Outils ---
                case 'v': setActiveTool('select'); updateDrawingToolButtons(); break;
                case 'r': setActiveTool('rect'); updateDrawingToolButtons(); break;
                case 'l': setActiveTool('line'); updateDrawingToolButtons(); break;
                case 'c': setActiveTool('circle'); updateDrawingToolButtons(); break;
                case 't': setActiveTool('text'); updateDrawingToolButtons(); break;
            }
        }
        // --- Pan (Alt) ---
        if (e.key === 'Alt') {
            if (!fabricCanvas.isDragging) {
                fabricCanvas.defaultCursor = 'grab';
                fabricCanvas.hoverCursor = 'grab';
                 fabricCanvas.requestRenderAll();
            }
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
         if (e.key === 'Alt') {
             if (!fabricCanvas.isDragging) {
                console.log("Alt key released, resetting cursor");
                fabricCanvas.defaultCursor = (getCurrentDrawingTool() === 'select') ? 'default' : 'crosshair';
                fabricCanvas.hoverCursor = (getCurrentDrawingTool() === 'select') ? 'move' : 'crosshair';
                 fabricCanvas.requestRenderAll();
            }
        }
    });

    // --- Listeners Toolbar Principale ---
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    const lockBtn = document.getElementById('toggle-lock-svg-btn');
    const saveDrawingBtn = document.getElementById('save-drawing-btn');
    const saveNewSvgPlanBtn = document.getElementById('save-new-svg-plan-btn');
    const newPlanNameInput = document.getElementById('new-plan-name');

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => { console.log("Zoom In"); zoomCanvas(1.2); });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { console.log("Zoom Out"); zoomCanvas(0.8); });
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => { console.log("Zoom Reset"); resetZoom(); });
    if (lockBtn) lockBtn.addEventListener('click', () => {
         console.log("Lock Toggle");
         setCanvasLock(!getCanvasLock());
         updateLockButtonState();
    });
    if (saveDrawingBtn) saveDrawingBtn.addEventListener('click', async () => {
         console.log("Save Drawing/SVG");
         showLoading("Sauvegarde...");
         try {
             if (planType === 'image') { await triggerAutoSaveDrawing(true); }
             else if (planType === 'svg') { await saveModifiedSvgPlan(); }
             showToast("Modifications enregistrées.", "success");
         } catch (error) { showToast(`Erreur sauvegarde: ${error.message}`, "danger"); }
         finally { hideLoading(); }
    });
    if (saveNewSvgPlanBtn && newPlanNameInput) saveNewSvgPlanBtn.addEventListener('click', async () => {
         console.log("Save New SVG Plan");
         const planName = newPlanNameInput.value.trim();
         if (!planName) { showToast("Veuillez entrer un nom.", "warning"); return; }
         const universIds = []; // TODO: Récupérer univers
         showLoading("Création...");
         try {
            const svgString = fabricCanvas.toSVG(['customData', 'baseStrokeWidth'], (obj) => obj.isGridLine ? null : obj);
            const result = await createSvgPlan(planName, svgString, universIds);
            if (result.success && result.plan_id) {
                showToast(`Plan "${planName}" créé ! Redirection...`, "success");
                setTimeout(() => { window.location.href = `index.php?action=manageCodes&id=${result.plan_id}`; }, 1500);
            } else { throw new Error("Réponse API invalide."); }
         } catch (error) { showToast(`Erreur: ${error.message}`, "danger"); }
         finally { hideLoading(); }
    });

    // --- Listeners Toolbar Dessin ---
    const toolBtns = document.querySelectorAll('#drawing-toolbar .tool-btn');
    toolBtns.forEach(btn => btn.addEventListener('click', () => {
        setActiveTool(btn.dataset.tool);
        // updateDrawingToolButtons(); // Fait DANS setActiveTool maintenant
    }));
    const strokeColorPicker = document.getElementById('stroke-color-picker');
    const fillColorPicker = document.getElementById('fill-color-picker');
    const fillTransparentBtn = document.getElementById('fill-transparent-btn');
    const gridToggle = document.getElementById('grid-toggle');
    const snapToggle = document.getElementById('snap-toggle');
    const copyBtn = document.getElementById('copy-btn');
    const pasteBtn = document.getElementById('paste-btn');
    const groupBtn = document.getElementById('group-btn');
    const ungroupBtn = document.getElementById('ungroup-btn');

    if (strokeColorPicker) strokeColorPicker.addEventListener('input', updateDrawingStyleFromInput);
    if (fillColorPicker) fillColorPicker.addEventListener('input', updateDrawingStyleFromInput);
    if (fillTransparentBtn) fillTransparentBtn.addEventListener('click', setTransparentFillAndUpdate);
    if(gridToggle) gridToggle.addEventListener('change', () => updateGrid(fabricCanvas.getZoom()));
    if(snapToggle) snapToggle.addEventListener('change', toggleSnapToGrid);
    if (copyBtn) copyBtn.addEventListener('click', copyShape);
    if (pasteBtn) pasteBtn.addEventListener('click', pasteShape);
    if (groupBtn) groupBtn.addEventListener('click', groupSelectedObjects);
    if (ungroupBtn) ungroupBtn.addEventListener('click', ungroupSelectedObject);

    // --- Listeners Assets ---
    const saveAssetBtn = document.getElementById('save-asset-btn');
    const assetsListContainer = document.getElementById('assets-list');
    const assetsOffcanvasEl = document.getElementById('assetsOffcanvas');

    if (saveAssetBtn) saveAssetBtn.addEventListener('click', handleSaveAsset);
    if (assetsOffcanvasEl) assetsOffcanvasEl.addEventListener('show.bs.offcanvas', loadAssetsList);
    if (assetsListContainer) assetsListContainer.addEventListener('click', handleAssetClick);

    // --- Listeners Toolbar Tag (Supprimer uniquement ici) ---
    const deleteBtn = document.getElementById('toolbar-delete');
    if (deleteBtn) deleteBtn.addEventListener('click', () => {
         console.log("Delete Tag Button Clicked");
         const activeObj = fabricCanvas.getActiveObject();
         if (activeObj) { handleDeleteObject(activeObj); }
    });
    // Les autres boutons (highlight, arrow, size) doivent avoir leurs listeners DANS geo-tags.js

    console.log("All event listeners attached.");
}


// --- GESTIONNAIRES ÉVÉNEMENTS SOURIS ---

function handleMouseDown(options) {
    // console.log("Canvas mouse down detected!"); // Trop verbeux
    const evt = options.e;
    const target = options.target;

    // --- Clic Droit / Ctrl+Clic ---
    if (options.button === 3 || evt.ctrlKey) { console.log("Right click"); return; }

    // --- Pan (Alt / Molette) ---
    if (evt.altKey || options.button === 2) { startPan(evt); return; }

    // --- Mode Dessin Flèche ---
    if (getIsDrawingArrowMode && getIsDrawingArrowMode()) {
        console.log("Arrow endpoint click");
        handleArrowEndPoint(options); // Finalise la flèche
        return;
    }

    // --- Clic sur objet existant ---
    if (target && !target.isGridLine) {
        // console.log("Mouse down on object:", target.type);
        if (getCurrentDrawingTool() !== 'select') {
             // console.log("Click on object while drawing - ignoring.");
        }
        return;
    }

    // --- Clic sur fond ---
    // console.log("Mouse down on canvas background.");
    const currentTool = getCurrentDrawingTool();
    if (currentTool === 'tag') { handleCanvasClick(options); } // Placement géo
    else if (currentTool !== 'select') { startDrawing(options); } // Dessin forme
    else { fabricCanvas.discardActiveObject().renderAll(); handleObjectDeselected(); } // Désélection
}

function handleMouseMove(options) {
    if (fabricCanvas.isDragging) { continuePan(options.e); }
    else if (getIsDrawing()) { continueDrawing(options); }
    // Le suivi pour la flèche est géré DANS geo-tags.js
}

function handleMouseUp(options) {
    if (fabricCanvas.isDragging) { stopPan(); }
    else if (getIsDrawing()) {
        const drawnObject = stopDrawing(options);
        if (drawnObject) { handleDrawingComplete(drawnObject); }
    }
    // --- Création Texte (Clic simple) ---
    const currentTool = getCurrentDrawingTool();
    if (currentTool === 'text' && !getIsDrawing() && !options.target && options.e.type !== 'mouseout') {
         const textObject = stopDrawing(options); // Crée le texte
         if (textObject) { handleDrawingComplete(textObject); }
    }
}

// --- FONCTIONS PAN ---
function startPan(evt) {
    if (getIsDrawing() || (getIsDrawingArrowMode && getIsDrawingArrowMode())) return; // Ne pas panner si dessin en cours
    console.log("Start Pan");
    fabricCanvas.isDragging = true;
    fabricCanvas.selection = false;
    fabricCanvas.lastPosX = evt.clientX;
    fabricCanvas.lastPosY = evt.clientY;
    fabricCanvas.defaultCursor = 'grabbing';
    fabricCanvas.hoverCursor = 'grabbing';
    fabricCanvas.getObjects().forEach(o => { if(!o.isGridLine) o.set('evented', false) });
    fabricCanvas.requestRenderAll();
}
function continuePan(evt) {
    if (!fabricCanvas.isDragging) return;
    const vpt = fabricCanvas.viewportTransform;
    vpt[4] += evt.clientX - fabricCanvas.lastPosX;
    vpt[5] += evt.clientY - fabricCanvas.lastPosY;
    fabricCanvas.requestRenderAll();
    fabricCanvas.lastPosX = evt.clientX;
    fabricCanvas.lastPosY = evt.clientY;
}
function stopPan() {
    if (!fabricCanvas.isDragging) return;
    console.log("Stop Pan");
    fabricCanvas.setViewportTransform(fabricCanvas.viewportTransform);
    fabricCanvas.isDragging = false;
    fabricCanvas.selection = (getCurrentDrawingTool() === 'select');
    fabricCanvas.defaultCursor = (getCurrentDrawingTool() === 'select') ? 'default' : 'crosshair';
    fabricCanvas.hoverCursor = (getCurrentDrawingTool() === 'select') ? 'move' : 'crosshair';
    fabricCanvas.getObjects().forEach(o => o.set('evented', true));
    fabricCanvas.requestRenderAll();
}

// --- GESTION SÉLECTION ---

function handleSelectionChange(selectedItems) {
    if (!selectedItems || selectedItems.length === 0) { return; } // Géré par selection:cleared

    const activeSelection = fabricCanvas.getActiveObject();
    // console.log("Selection changed:", activeSelection.type);

    if (activeSelection.type === 'activeSelection') { // Multiple
        handleObjectDeselected(); // Gère sidebar + hideToolbar
        // console.log(`${activeSelection.size()} objects selected`);
    } else { // Simple
        const target = activeSelection;
        if (target.customData?.isGeoTag || target.customData?.isPlacedText) {
            // console.log("Geo element selected:", target.customData.codeGeo);
            showToolbar(target); // Affiche toolbar (depuis geo-tags.js)
            handleObjectSelected(target); // Màj sidebar
        } else if (!target.isGridLine) { // Dessin
            // console.log("Drawing element selected:", target.type);
            hideToolbar(); // Cache toolbar (depuis geo-tags.js)
            handleObjectDeselected(); // Gère sidebar
            updateDrawingStyleFromObject(target); // Màj couleurs
        } else { /* ... ignorer grille ... */ }
    }
    updateGroupButtonStates();
}

function handleObjectSelected(target) {
    const positionId = target.customData?.position_id;
    const geoCodeId = target.customData?.id;
    if (!positionId && !geoCodeId) return;

    // Highlight dans la liste "Placés"
    document.querySelectorAll('#placed-list .list-group-item').forEach(item => {
        const itemPositionIds = JSON.parse(item.dataset.positionIds || '[]');
        const matchesPosition = positionId && (item.dataset.positionId == positionId || itemPositionIds.includes(positionId));
        const matchesCodeId = item.dataset.id == geoCodeId;
        if (matchesCodeId && (matchesPosition || !positionId)) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
     // Désélectionner dans la liste "Disponibles"
     document.querySelectorAll('#dispo-list .list-group-item.active').forEach(el => el.classList.remove('active'));
}

function handleObjectDeselected() {
    document.querySelectorAll('#placed-list .list-group-item.active, #dispo-list .list-group-item.active').forEach(item => {
        item.classList.remove('active');
    });
    hideToolbar(); // Cache la toolbar (depuis geo-tags.js)
}

// --- CRUD GÉO ---

async function handleObjectPlaced(fabricObject, geoCodeId, clickPoint = null) {
    if (!fabricObject || !geoCodeId) { return; }
    showLoading("Sauvegarde position...");
    try {
        const center = clickPoint ? clickPoint : fabricObject.getCenterPoint();
        const { posX, posY } = convertPixelsToPercent(center.x, center.y, fabricCanvas);
        const positionData = {
            id: parseInt(geoCodeId, 10), plan_id: currentPlanId,
            pos_x: posX, pos_y: posY,
            width: fabricObject.customData.isGeoTag ? (fabricObject.width * fabricObject.scaleX) : null,
            height: fabricObject.customData.isGeoTag ? (fabricObject.height * fabricObject.scaleY) : null,
            anchor_x: fabricObject.customData.anchorSvgId || fabricObject.customData.anchorXPercent || null,
            anchor_y: fabricObject.customData.anchorYPercent || null,
            position_id: null
        };
        const savedPosition = await savePosition(positionData);
        fabricObject.set('customData', { ...fabricObject.customData, position_id: savedPosition.id, plan_id: savedPosition.plan_id, pos_x: savedPosition.pos_x, pos_y: savedPosition.pos_y, id: parseInt(geoCodeId, 10) });
        if (fabricObject.customData.isPlacedText && !fabricObject.customData.anchorSvgId) { fabricObject.customData.anchorSvgId = savedPosition.anchor_x; }
        fabricCanvas.requestRenderAll();
        showToast(`Code "${fabricObject.customData.codeGeo}" placé.`, 'success');
        await fetchAndClassifyCodes();
    } catch (error) { showToast(`Échec sauvegarde: ${error.message}`, 'error'); if (fabricObject) fabricCanvas.remove(fabricObject); }
    finally { hideLoading(); setActiveTool('select'); updateDrawingToolButtons(); }
}

async function handleObjectMoved(target) {
    if (!target?.customData?.position_id || !target.customData?.id) { return; }
    // Cette fonction est maintenant pour TEXTE géo, TAGS géo utilisent handleGeoTagModified
    if (!target.customData.isPlacedText) { console.warn("handleObjectMoved pour non-texte", target); }

    showLoading("Mise à jour position...");
    try {
        const center = target.getCenterPoint();
        const { posX, posY } = convertPixelsToPercent(center.x, center.y, fabricCanvas);
        const positionId = target.customData.position_id;
        const geoCodeId = target.customData.id;
        const positionData = {
            id: parseInt(geoCodeId, 10), plan_id: currentPlanId,
            pos_x: posX, pos_y: posY,
            width: null, height: null, // C'est un texte
            anchor_x: target.customData.anchorSvgId || null,
            anchor_y: null
        };
        const updatedPosition = await savePosition(positionData, positionId);
        showToast(`Position de "${target.customData.codeGeo}" mise à jour.`, 'success');
        target.set('customData', { ...target.customData, pos_x: updatedPosition.pos_x, pos_y: updatedPosition.pos_y });
        target.setCoords();
        if (fabricCanvas.getActiveObject() === target) { showToolbar(target); }
    } catch (error) { showToast(`Échec mise à jour: ${error.message}`, 'error'); }
    finally { hideLoading(); }
}

async function handleDeleteObject(target) {
    if (!target || !(target.customData?.isGeoTag || target.customData?.isPlacedText)) { return; }
    const positionId = target.customData?.position_id;
    const codeGeo = target.customData?.codeGeo || "inconnu";
    if (!positionId) {
        console.warn("Suppression locale objet sans position_id.");
        if (target.arrowLine) fabricCanvas.remove(target.arrowLine);
        fabricCanvas.remove(target);
        fabricCanvas.discardActiveObject().renderAll();
        return;
    }
    if (!confirm(`Supprimer "${codeGeo}" du plan ?`)) return;

    showLoading("Suppression...");
    try {
        await removePosition(positionId);
        if (target.arrowLine) fabricCanvas.remove(target.arrowLine);
        fabricCanvas.remove(target);
        fabricCanvas.discardActiveObject().renderAll();
        // hideToolbar(); // Fait par discardActiveObject -> selection:cleared -> handleObjectDeselected
        showToast(`"${codeGeo}" supprimé.`, 'success');
        await fetchAndClassifyCodes();
    } catch (error) { showToast(`Échec suppression: ${error.message}`, 'error'); }
    finally { hideLoading(); }
}

// --- GESTION DESSIN ---
function handleDrawingComplete(drawnObject) {
    if (!drawnObject) return; // Si dessin annulé (trop petit)
    const mode = getCurrentDrawingTool();
    if (['rect', 'circle', 'line', 'text'].includes(mode)) {
        console.log(`Dessin ${mode} terminé.`);
        drawnObject.set({ selectable: true, evented: true });
        triggerAutoSaveDrawing();
    }
}
let saveTimeout;
function triggerAutoSaveDrawing(forceSave = false) {
    if (planType !== 'image') return;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
         console.log("Sauvegarde auto annotations (JSON)...");
         const drawingData = fabricCanvas.toJSON(['customData', 'selectable', 'evented', 'baseStrokeWidth']);
         drawingData.objects = drawingData.objects.filter(obj => !obj.isGridLine && !(obj.customData?.isGeoTag || obj.customData?.isPlacedText));
         try {
             await saveDrawingData(currentPlanId, drawingData.objects.length > 0 ? drawingData : null);
             console.log("Annotations JSON sauvegardées.");
             if (forceSave) showToast("Annotations enregistrées.", "success");
         } catch(error) { showToast(`Erreur sauvegarde annotations: ${error.message}`, "danger"); }
    }, forceSave ? 0 : 1500);
}
async function saveModifiedSvgPlan() {
    if (planType !== 'svg' || !currentPlanId) { throw new Error("Non applicable"); }
    const svgString = fabricCanvas.toSVG(['customData', 'baseStrokeWidth'], obj => obj.isGridLine ? null : obj);
    await updateSvgPlan(currentPlanId, svgString);
    console.log("SVG modifié sauvegardé.");
}

// --- OUTILS DESSIN (Styles, Groupe, Presse-papiers) ---
function updateDrawingStyleFromInput() {
    const strokeColor = document.getElementById('stroke-color-picker')?.value || '#000000';
    const fillColorPicker = document.getElementById('fill-color-picker');
    const fillTransparentBtn = document.getElementById('fill-transparent-btn');
    const isFillTransparent = fillTransparentBtn ? !fillTransparentBtn.classList.contains('active') : true;
    const finalFill = isFillTransparent ? 'transparent' : (fillColorPicker?.value || '#FFFFFF');
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && !(activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText || activeObject.isGridLine)) {
         const updateProps = { stroke: strokeColor, fill: finalFill };
         if (activeObject.type === 'activeSelection') { activeObject.forEachObject(obj => { if (!obj.isGridLine) obj.set(updateProps); }); }
         else { activeObject.set(updateProps); }
         fabricCanvas.requestRenderAll();
         triggerAutoSaveDrawing();
    }
}
function setTransparentFillAndUpdate() {
    const btn = document.getElementById('fill-transparent-btn');
    if (!btn) return;
    btn.classList.toggle('active');
    updateDrawingStyleFromInput();
}
function updateDrawingStyleFromObject(target) {
     if (!target || target.customData?.isGeoTag || target.customData?.isPlacedText || target.isGridLine) return;
     const strokeColorPicker = document.getElementById('stroke-color-picker');
     const fillColorPicker = document.getElementById('fill-color-picker');
     const fillTransparentBtn = document.getElementById('fill-transparent-btn');
     if (strokeColorPicker) strokeColorPicker.value = target.stroke || '#000000';
     const fill = target.fill;
     if (fill && fill !== 'transparent' && typeof fill === 'string') {
         if (fillColorPicker) fillColorPicker.value = fill;
         if (fillTransparentBtn) fillTransparentBtn.classList.add('active');
     } else {
         if (fillColorPicker) fillColorPicker.value = '#FFFFFF';
         if (fillTransparentBtn) fillTransparentBtn.classList.remove('active');
     }
}
function updateGroupButtonStates() {
    const groupBtn = document.getElementById('group-btn');
    const ungroupBtn = document.getElementById('ungroup-btn');
    if (!groupBtn || !ungroupBtn) return;
    const activeObject = fabricCanvas.getActiveObject();
    let canGroup = false, canUngroup = false;
    if (activeObject) {
        if (activeObject.type === 'activeSelection') {
            const objects = activeObject.getObjects();
            canGroup = objects.length > 1 && !objects.some(obj => obj.customData?.isGeoTag || obj.customData?.isPlacedText || obj.isGridLine || obj.isSvgShape);
        } else if (activeObject.type === 'group' && !(activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText || activeObject.isSvgShape)) {
            canUngroup = true;
        }
    }
    groupBtn.disabled = !canGroup;
    ungroupBtn.disabled = !canUngroup;
}

// --- ASSETS ---
async function handleSaveAsset() {
    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject || activeObject.isGridLine || activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText || activeObject.isSvgShape) { showToast("Sélectionnez un ou plusieurs objets DESSINÉS.", "warning"); return; }
     if (activeObject.type === 'activeSelection') {
         if (activeObject.getObjects().some(obj => obj.isGridLine || obj.customData?.isGeoTag || obj.customData?.isPlacedText || obj.isSvgShape)) { showToast("La sélection contient des éléments non enregistrables.", "warning"); return; }
     }
    const assetName = prompt("Nom pour cet asset :");
    if (!assetName || assetName.trim() === '') { showToast("Nom invalide.", "info"); return; }
    showLoading("Sauvegarde asset...");
    try {
        activeObject.clone(async (cloned) => {
             const assetData = cloned.toObject(['customData', 'baseStrokeWidth']);
             try {
                await saveAsset(assetName.trim(), assetData);
                showToast(`Asset "${assetName.trim()}" enregistré !`, "success");
                if (document.getElementById('assetsOffcanvas')?.classList.contains('show')) { loadAssetsList(); }
             } catch (apiError) { showToast(`Erreur sauvegarde asset: ${apiError.message}`, "danger"); }
             finally { hideLoading(); }
        }, ['customData', 'baseStrokeWidth']);
    } catch (cloneError) { showToast("Erreur préparation asset.", "danger"); hideLoading(); }
}
async function loadAssetsList() {
    const listContainer = document.getElementById('assets-list');
    if (!listContainer) return;
    listContainer.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
    try {
        const assets = await listAssets();
        listContainer.innerHTML = '';
        if (assets.length === 0) { listContainer.innerHTML = '<p class="text-muted small">Aucun asset.</p>'; return; }
        assets.forEach(asset => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action asset-item';
            item.dataset.assetId = asset.id; item.textContent = asset.name;
            listContainer.appendChild(item);
        });
    } catch (error) { listContainer.innerHTML = '<p class="text-danger small">Erreur chargement.</p>'; }
}
async function handleAssetClick(event) {
     event.preventDefault();
     const assetItem = event.target.closest('.asset-item');
     if (!assetItem) return;
     const assetId = assetItem.dataset.assetId;
     showLoading("Chargement asset...");
     try {
        const asset = await getAssetData(assetId);
        if (!asset || !asset.data) throw new Error("Données invalides.");
        const assetDataObject = asset.data;
        fabric.util.enlivenObjects([assetDataObject], (objects) => {
            if (!objects || objects.length === 0) { throw new Error("Impossible de recréer l'objet."); }
            const objectToAdd = objects[0];
            const center = fabricCanvas.getVpCenter();
            objectToAdd.set({ left: center.x, top: center.y, originX: 'center', originY: 'center', selectable: true, evented: true });
            objectToAdd.customData = assetDataObject.customData || {};
            objectToAdd.baseStrokeWidth = assetDataObject.baseStrokeWidth || 1;
            const zoom = fabricCanvas.getZoom();
            objectToAdd.set('strokeWidth', (objectToAdd.baseStrokeWidth || 1) / zoom);
            if (objectToAdd.type === 'group') { objectToAdd.forEachObject(obj => { obj.set('strokeWidth', (obj.baseStrokeWidth || 1) / zoom); }); }
            fabricCanvas.add(objectToAdd);
            fabricCanvas.setActiveObject(objectToAdd);
            objectToAdd.setCoords(); fabricCanvas.requestRenderAll();
            showToast(`Asset "${asset.name}" ajouté.`, "success");
            bootstrap.Offcanvas.getInstance(document.getElementById('assetsOffcanvas'))?.hide();
            triggerAutoSaveDrawing();
        }, '');
     } catch (error) { showToast(`Erreur chargement asset: ${error.message}`, "danger"); }
     finally { hideLoading(); }
}

// --- UTILITAIRES ---
function updateDrawingToolButtons() {
    const currentTool = getCurrentDrawingTool();
    document.querySelectorAll('#drawing-toolbar .tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === currentTool);
    });
}
function updateLockButtonState() {
     const lockBtn = document.getElementById('toggle-lock-svg-btn');
     if (!lockBtn) return;
     const isLocked = getCanvasLock();
     lockBtn.classList.toggle('active', isLocked);
     const btnText = lockBtn.querySelector('.btn-text');
     const btnIcon = lockBtn.querySelector('i');
     if (btnText) btnText.textContent = isLocked ? 'Verrouillé' : 'Déverrouillé';
     if (btnIcon) {
         btnIcon.classList.toggle('bi-lock-fill', isLocked);
         btnIcon.classList.toggle('bi-unlock-fill', !isLocked);
     }
}

// --- CRÉATION ÉLÉMENTS INITIAUX ---
function createInitialGeoElements(placedGeoCodes, planType) {
    console.log(`Création de ${placedGeoCodes.length} éléments géo initiaux...`);
    if (!fabricCanvas || !placedGeoCodes || placedGeoCodes.length === 0) { return; }
    let createdCount = 0;
    const elementsToCreate = [];
    placedGeoCodes.forEach(codeInfo => {
        if (codeInfo.placements && Array.isArray(codeInfo.placements)) {
            codeInfo.placements.forEach(placement => {
                if (placement.plan_id != currentPlanId) return;
                const elementData = { ...codeInfo, ...placement, id: codeInfo.id, position_id: placement.id };
                delete elementData.placements;
                if (placement.width === null && placement.height === null) { // Texte (SVG)
                    if (planType === 'svg') {
                        const targetSvgShape = findSvgShapeByCodeGeo(elementData.anchor_x);
                        const textObject = placeTextOnSvg(elementData, targetSvgShape);
                        if (textObject) elementsToCreate.push(textObject);
                    }
                }
                else if (elementData.pos_x !== null && elementData.pos_y !== null) { // Tag (Image)
                     if (planType === 'image') {
                        const { left, top } = convertPercentToPixels(elementData.pos_x, elementData.pos_y, fabricCanvas);
                        if (!isNaN(left) && !isNaN(top)) {
                             const tagObject = placeTagAtPoint(elementData, { x: left, y: top });
                             if (tagObject) elementsToCreate.push(tagObject);
                        } else { console.warn(`Coords invalides pour tag ${elementData.code_geo}`); }
                    }
                }
            });
        }
    });
    elementsToCreate.forEach(el => {
        fabricCanvas.add(el);
        if (el.customData?.isGeoTag && el.customData.anchorXPercent !== null && el.customData.anchorYPercent !== null) {
            addArrowToTag(el);
        }
    });
    console.log(`${elementsToCreate.length} éléments géo initiaux créés sur le canvas.`);
    fabricCanvas.requestRenderAll();
}

function placeTextOnSvg(codeData, targetSvgShape) {
    let textCoords = { x: 0, y: 0 }; let anchorId = null;
    if (targetSvgShape?.getCenterPoint) {
        const center = targetSvgShape.getCenterPoint(); textCoords = { x: center.x, y: center.y };
        anchorId = targetSvgShape.customData?.svgId;
        // console.log(`Placement texte ${codeData.code_geo} sur SVG ${anchorId}`);
    }
    else if (codeData.pos_x !== null && codeData.pos_y !== null) {
        const { left, top } = convertPercentToPixels(codeData.pos_x, codeData.pos_y, fabricCanvas);
        if (!isNaN(left) && !isNaN(top)) { textCoords = { x: left, y: top }; console.log(`Placement texte ${codeData.code_geo} par coords % (fallback)`); }
        else { return null; }
    } else { const center = fabricCanvas.getCenter(); textCoords = { x: center.left, y: center.top }; }
    const textToShow = codeData.code_geo || 'ERREUR'; const fontSize = (GEO_TEXT_FONT_SIZE || 16);
    const textObject = new fabric.IText(textToShow, {
        left: textCoords.x, top: textCoords.y, originX: 'center', originY: 'center', fontSize: fontSize,
        fill: '#000000', stroke: '#FFFFFF', paintFirst: 'stroke', strokeWidth: 0.5, baseStrokeWidth: 0.5,
        fontFamily: 'Arial', textAlign: 'center', fontWeight: 'bold',
        selectable: true, evented: true, hasControls: false, hasBorders: true, borderColor: '#007bff', cornerSize: 0, transparentCorners: true, lockRotation: true,
        customData: { ...codeData, isPlacedText: true, isGeoTag: false, anchorSvgId: anchorId, id: parseInt(codeData.id, 10), position_id: codeData.position_id ? parseInt(codeData.position_id, 10) : null, plan_id: parseInt(currentPlanId, 10) }
    });
    return textObject; // Retourne l'objet pour ajout groupé
}
function placeTagAtPoint(codeData, point) {
    if (!point || isNaN(point.x) || isNaN(point.y)) { return null; }
    const universColor = universColors[codeData.univers_nom] || codeData.univers_color ||'#6c757d';
    const codeText = codeData.code_geo || 'ERR'; const tagWidth = codeData.width || sizePresets.medium.width; const tagHeight = codeData.height || sizePresets.medium.height;
    const rect = new fabric.Rect({ width: tagWidth, height: tagHeight, fill: universColor, stroke: '#333', strokeWidth: 1, baseStrokeWidth: 1, originX: 'center', originY: 'center' });
    const text = new fabric.Text(codeText, { fontSize: GEO_TAG_FONT_SIZE, fill: 'white', fontWeight: 'bold', fontFamily: 'Arial', originX: 'center', originY: 'center' });
    const group = new fabric.Group([rect, text], {
        left: point.x, top: point.y, originX: 'center', originY: 'center', selectable: true, evented: true, hasControls: false, hasBorders: true, borderColor: '#007bff', cornerSize: 0, transparentCorners: true, lockRotation: true, lockScalingX: true, lockScalingY: true, hoverCursor: 'move',
        customData: { ...codeData, isGeoTag: true, isPlacedText: false, id: parseInt(codeData.id, 10), position_id: codeData.position_id ? parseInt(codeData.position_id, 10) : null, plan_id: parseInt(currentPlanId, 10), currentWidth: tagWidth, currentHeight: tagHeight, anchorXPercent: codeData.anchor_x, anchorYPercent: codeData.anchor_y }
    });
    return group; // Retourne l'objet pour ajout groupé
}

// --- GESTION CLIC CANVAS (Mode Placement) ---
function handleCanvasClick(options) {
    const mode = getCurrentDrawingTool(); if (mode !== 'tag') return;
    const pointer = fabricCanvas.getPointer(options.e);
    const selectedCodeEl = document.querySelector('#dispo-list .list-group-item.active');
    if (!selectedCodeEl) { showToast("Aucun code dispo sélectionné.", 'warning'); setActiveTool('select'); updateDrawingToolButtons(); return; }
    try {
        const codeData = JSON.parse(selectedCodeEl.dataset.codeData);
        let placedObject = null;
        if (planType === 'svg') {
            const targetShape = options.target;
            if (targetShape?.isSvgShape) { placedObject = placeTextOnSvg(codeData, targetShape); }
            else { showToast("Cliquez sur une forme SVG.", "info"); return; }
        } else if (planType === 'image') {
            placedObject = placeTagAtPoint(codeData, pointer);
        }
        if (placedObject) {
             fabricCanvas.add(placedObject);
             fabricCanvas.setActiveObject(placedObject);
             placedObject.moveTo(999);
             fabricCanvas.requestRenderAll();
             handleObjectPlaced(placedObject, codeData.id, pointer); // Sauvegarde API
        } else { setActiveTool('select'); updateDrawingToolButtons(); }
    } catch (e) { showToast("Erreur lecture données code.", "danger"); setActiveTool('select'); updateDrawingToolButtons(); }
}
