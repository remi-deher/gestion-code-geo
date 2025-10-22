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

// Import pour la gestion des tags/textes géo et leur toolbar
import {
    initializeGeoTags,
    addArrowToTag,
    showToolbar,
    hideToolbar,
    handleGeoTagModified,
    getIsDrawingArrowMode,
    handleArrowEndPoint,
    cancelArrowDrawing
} from './geo-tags.js';

// Import des utilitaires
import {
    showToast,
    convertPixelsToPercent,
    convertPercentToPixels
} from '../modules/utils.js';

// Import de la configuration
import {
    sizePresets,
    GEO_TEXT_FONT_SIZE,
    GEO_TAG_FONT_SIZE,
    GRID_SIZE
} from '../modules/config.js';

// Import des fonctions API
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
    console.log("Plan Editor v2 (Full + Corrections vFinal) - DOMContentLoaded");

    // --- Récupération des données PHP ---
    try {
        const phpDataElement = document.getElementById('plan-data');
        const phpData = phpDataElement ? JSON.parse(phpDataElement.textContent || '{}') : (window.PHP_DATA || {});
        initialPlacedGeoCodes = phpData.placedGeoCodes || [];
        universColors = phpData.universColors || {};
        currentPlanId = phpData.currentPlanId;
        planType = phpData.planType;
        planUnivers = phpData.planUnivers || [];
        if (phpData.currentPlan && phpData.currentPlan.nom_fichier) {
            const baseUrl = 'uploads/plans/';
            if (planType === 'svg') { planSvgUrl = baseUrl + phpData.currentPlan.nom_fichier; }
            else if (planType === 'image') { planImageUrl = baseUrl + phpData.currentPlan.nom_fichier; }
        }
        if (!currentPlanId || !planType) { throw new Error("Données PHP essentielles manquantes."); }
        console.log("Données initiales chargées:", phpData);
    } catch (error) { console.error("Erreur PHP data:", error); showToast("Erreur critique.", 'error'); return; }

    // --- Initialisation des modules ---
    showLoading("Initialisation du plan...");
    try {
        fabricCanvas = initializeCanvas('plan-canvas');
        if (!fabricCanvas) { throw new Error("Init canvas Fabric échouée."); }
        console.log("Canvas initialisé.");

        initializeSidebar(fabricCanvas, universColors, currentPlanId, planType, planUnivers);
        console.log("Sidebar initialisée.");

        initializeDrawingTools(fabricCanvas);
        console.log("Outils dessin initialisés.");

        initializeGeoTags(fabricCanvas, universColors);
        console.log("GeoTags initialisé.");

        initializeUI(fabricCanvas);
        console.log("UI initialisée.");

        // --- Chargement du plan (SVG/Image/Création) ---
        if (planType === 'svg' && planSvgUrl) { await loadSvgPlan(planSvgUrl); setCanvasLock(true); }
        else if (planType === 'image' && planImageUrl) { await loadPlanImage(planImageUrl); }
        else if (planType === 'svg_creation'){ console.log("Mode création SVG."); resizeCanvas(); }
        else { resizeCanvas(); showToast("Aucun plan chargé.", 'warning'); }

        setupEventListeners();

        // --- Placement éléments initiaux & Chargement codes sidebar ---
        if (planType !== 'svg_creation') {
            createInitialGeoElements(initialPlacedGeoCodes, planType);
            await fetchAndClassifyCodes();
        } else {
             await fetchAndClassifyCodes();
        }

        // --- Configuration modale ajout code ---
	    const universSelectEl = document.getElementById('new-univers-id');
        if (universSelectEl) { populateUniversSelectInModal(universSelectEl, planUnivers); }
        const saveBtn = document.getElementById('save-new-code-btn');
        const addForm = document.getElementById('add-code-form');
        const addModalEl = document.getElementById('add-code-modal');
        const addModalInstance = addModalEl ? new bootstrap.Modal(addModalEl) : null;
        if (saveBtn && addForm && addModalInstance) {
            saveBtn.addEventListener('click', async () => {
                const success = await handleSaveNewCodeInModal(addForm, saveBtn, saveNewGeoCode);
                if (success) { addModalInstance.hide(); await fetchAndClassifyCodes(); }
            });
        }

        // --- Mise à jour état initial boutons UI ---
        updateDrawingToolButtons();
        updateLockButtonState();
        updateGroupButtonStates();

    } catch (error) { console.error("Erreur majeure lors de l'initialisation:", error); showToast(`Erreur init: ${error.message}`, 'error'); }
    finally { hideLoading(); resizeCanvas(); resetZoom(); console.log("Fin initialisation main.js"); }
});


/**
 * Attache les écouteurs d'événements principaux au canvas et au document.
 */
function setupEventListeners() {
    if (!fabricCanvas) return;
    console.log("Attaching ALL event listeners...");

    // ===================================
    // === Événements Souris Canvas ===
    // ===================================
    fabricCanvas.on('mouse:down', handleMouseDown);
    fabricCanvas.on('mouse:move', handleMouseMove);
    fabricCanvas.on('mouse:up', handleMouseUp);

    // ===================================
    // === Autres Événements Canvas ===
    // ===================================
    fabricCanvas.on('object:moving', (options) => {
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
        const target = options.target;
        if (target?.customData?.isGeoTag || target?.customData?.isPlacedText) {
             showToolbar(target);
        }
    });

    fabricCanvas.on('object:modified', (e) => {
        const target = e.target;
        if (target?.customData?.isGeoTag || target?.customData?.isPlacedText) {
            if (target.customData.isGeoTag) { handleGeoTagModified(target); }
            else { handleObjectMoved(target); }
        } else if (target && !target.isGridLine) {
            triggerAutoSaveDrawing();
        }
    });

    fabricCanvas.on('selection:created', (e) => { handleSelectionChange(e.selected); });
    fabricCanvas.on('selection:updated', (e) => { handleSelectionChange(e.selected); });
    fabricCanvas.on('selection:cleared', (e) => {
        handleObjectDeselected();
        updateGroupButtonStates();
    });

    fabricCanvas.on('viewport:transformed', () => {
        const zoom = fabricCanvas.getZoom();
        updateGrid(zoom);
        updateStrokesWidth(zoom);
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj?.customData?.isGeoTag || activeObj?.customData?.isPlacedText) {
            showToolbar(activeObj);
        }
    });

    fabricCanvas.upperCanvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

    // ===================================
    // === Événements du Document ===
    // ===================================
    document.addEventListener('keydown', (e) => {
        const isInputFocused = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
        const activeObject = fabricCanvas.getActiveObject();
        if (e.key === 'Escape') {
            let handled = false;
            if (getIsDrawingArrowMode && getIsDrawingArrowMode()) { cancelArrowDrawing(); handled = true; }
            if (getIsDrawing()) { stopDrawing(null, true); handled = true; }
            if (getCurrentDrawingTool() !== 'select') { setActiveTool('select'); updateDrawingToolButtons(); handled = true; }
            if (activeObject) { fabricCanvas.discardActiveObject().renderAll(); handleObjectDeselected(); handled = true; }
            if (handled) e.preventDefault();
            return;
        }
        if (isInputFocused) return;
        if (e.ctrlKey || e.metaKey) {
            let handled = true;
            switch (e.key.toLowerCase()) {
                case 'c': copyShape(); break;
                case 'v': pasteShape(); break;
                case 'g': if (activeObject) { e.shiftKey ? ungroupSelectedObject() : groupSelectedObjects(); } break;
                case 'l': if (planType === 'svg') { document.getElementById('toggle-lock-svg-btn')?.click(); } break;
                default: handled = false; break;
            }
            if (handled) e.preventDefault();
        } else {
            let handled = true;
            switch (e.key) {
                case 'Delete':
                case 'Backspace':
                    if (activeObject) {
                        if (activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText) { handleDeleteObject(activeObject); }
                        else if (!activeObject.isEditing) { deleteSelectedDrawingShape(); }
                    }
                    break;
                case 'v': setActiveTool('select'); updateDrawingToolButtons(); break;
                case 'r': setActiveTool('rect'); updateDrawingToolButtons(); break;
                case 'l': setActiveTool('line'); updateDrawingToolButtons(); break;
                case 'c': setActiveTool('circle'); updateDrawingToolButtons(); break;
                case 't': setActiveTool('text'); updateDrawingToolButtons(); break;
                default: handled = false; break;
            }
            if (handled) e.preventDefault();
        }
        if (e.key === 'Alt') {
            if (!fabricCanvas.isDragging && !(getIsDrawingArrowMode && getIsDrawingArrowMode())) {
                fabricCanvas.defaultCursor = 'grab'; fabricCanvas.hoverCursor = 'grab';
                fabricCanvas.requestRenderAll();
            }
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
         if (e.key === 'Alt') {
             if (!fabricCanvas.isDragging) {
                fabricCanvas.defaultCursor = (getCurrentDrawingTool() === 'select') ? 'default' : 'crosshair';
                fabricCanvas.hoverCursor = (getCurrentDrawingTool() === 'select') ? 'move' : 'crosshair';
                fabricCanvas.requestRenderAll();
            }
        }
    });

    // ===================================
    // === Listeners Boutons Toolbars ===
    // ===================================
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    const lockBtn = document.getElementById('toggle-lock-svg-btn');
    const saveDrawingBtn = document.getElementById('save-drawing-btn');
    const saveNewSvgPlanBtn = document.getElementById('save-new-svg-plan-btn');
    const newPlanNameInput = document.getElementById('new-plan-name');

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => { zoomCanvas(1.2); });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { zoomCanvas(0.8); });
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoom);
    if (lockBtn) lockBtn.addEventListener('click', () => { setCanvasLock(!getCanvasLock()); updateLockButtonState(); });
    if (saveDrawingBtn) saveDrawingBtn.addEventListener('click', async () => { /* ... save plan ... */ });
    if (saveNewSvgPlanBtn && newPlanNameInput) saveNewSvgPlanBtn.addEventListener('click', async () => { /* ... save new svg ... */ });

    const toolBtns = document.querySelectorAll('#drawing-toolbar .tool-btn');
    toolBtns.forEach(btn => btn.addEventListener('click', () => {
        setActiveTool(btn.dataset.tool);
        updateDrawingToolButtons();
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

    const saveAssetBtn = document.getElementById('save-asset-btn');
    const assetsListContainer = document.getElementById('assets-list');
    const assetsOffcanvasEl = document.getElementById('assetsOffcanvas');
    if (saveAssetBtn) saveAssetBtn.addEventListener('click', handleSaveAsset);
    if (assetsOffcanvasEl) assetsOffcanvasEl.addEventListener('show.bs.offcanvas', loadAssetsList);
    if (assetsListContainer) assetsListContainer.addEventListener('click', handleAssetClick);

    const deleteBtn = document.getElementById('toolbar-delete');
    if (deleteBtn) deleteBtn.addEventListener('click', () => {
         const activeObj = fabricCanvas.getActiveObject();
         if (activeObj) { handleDeleteObject(activeObj); }
    });

    console.log("All event listeners attached.");
}

// ===================================
// === GESTIONNAIRES ÉVÉNEMENTS SOURIS ===
// ===================================

function handleMouseDown(options) {
    const evt = options.e;
    if (options.button === 3 || evt.ctrlKey) { return; }
    if (evt.altKey || options.button === 2) { startPan(evt); return; }
    if (getIsDrawingArrowMode && getIsDrawingArrowMode()) { handleArrowEndPoint(options); return; }
    const target = options.target;
    if (target && !target.isGridLine) { return; }
    const currentTool = getCurrentDrawingTool();
    if (currentTool === 'tag') { handleCanvasClick(options); }
    else if (currentTool !== 'select') { startDrawing(options); }
    else { fabricCanvas.discardActiveObject().renderAll(); handleObjectDeselected(); }
}

function handleMouseMove(options) {
    if (fabricCanvas.isDragging) { continuePan(options.e); }
    else if (getIsDrawing()) { continueDrawing(options); }
}

function handleMouseUp(options) {
    if (fabricCanvas.isDragging) { stopPan(); }
    else if (getIsDrawing()) {
        const drawnObject = stopDrawing(options);
        if (drawnObject) { handleDrawingComplete(drawnObject); }
    }
    const currentTool = getCurrentDrawingTool();
    if (currentTool === 'text' && !getIsDrawing() && !options.target && options.e.type !== 'mouseout') {
         const textObject = stopDrawing(options);
         if (textObject) { handleDrawingComplete(textObject); }
    }
}

// ===================================
// === FONCTIONS PAN ===
// ===================================
function startPan(evt) {
    if (getIsDrawing() || (getIsDrawingArrowMode && getIsDrawingArrowMode())) return;
    fabricCanvas.isDragging = true; fabricCanvas.selection = false;
    fabricCanvas.lastPosX = evt.clientX; fabricCanvas.lastPosY = evt.clientY;
    fabricCanvas.defaultCursor = 'grabbing'; fabricCanvas.hoverCursor = 'grabbing';
    fabricCanvas.getObjects().forEach(o => { if(!o.isGridLine) o.set('evented', false) });
    fabricCanvas.requestRenderAll();
}
function continuePan(evt) {
    if (!fabricCanvas.isDragging) return;
    const vpt = fabricCanvas.viewportTransform;
    vpt[4] += evt.clientX - fabricCanvas.lastPosX; vpt[5] += evt.clientY - fabricCanvas.lastPosY;
    fabricCanvas.requestRenderAll();
    fabricCanvas.lastPosX = evt.clientX; fabricCanvas.lastPosY = evt.clientY;
}
function stopPan() {
    if (!fabricCanvas.isDragging) return;
    fabricCanvas.setViewportTransform(fabricCanvas.viewportTransform);
    fabricCanvas.isDragging = false;
    fabricCanvas.selection = (getCurrentDrawingTool() === 'select');
    fabricCanvas.defaultCursor = (getCurrentDrawingTool() === 'select') ? 'default' : 'crosshair';
    fabricCanvas.hoverCursor = (getCurrentDrawingTool() === 'select') ? 'move' : 'crosshair';
    fabricCanvas.getObjects().forEach(o => o.set('evented', true));
    fabricCanvas.requestRenderAll();
}

// ===================================
// === GESTION SÉLECTION ===
// ===================================
function handleSelectionChange(selectedItems) {
    if (!selectedItems || selectedItems.length === 0) { return; }
    const activeSelection = fabricCanvas.getActiveObject();
    if (!activeSelection) return;
    if (activeSelection.type === 'activeSelection') {
        handleObjectDeselected();
    } else {
        const target = activeSelection;
        if (target.customData?.isGeoTag || target.customData?.isPlacedText) { showToolbar(target); handleObjectSelected(target); }
        else if (!target.isGridLine) { hideToolbar(); handleObjectDeselected(); updateDrawingStyleFromObject(target); }
        else { hideToolbar(); }
    }
    updateGroupButtonStates();
}
function handleObjectSelected(target) {
    const positionId = target.customData?.position_id;
    const geoCodeId = target.customData?.id;
    if (!positionId && !geoCodeId) return;
    document.querySelectorAll('#placed-list .list-group-item').forEach(item => {
        const itemPositionIds = JSON.parse(item.dataset.positionIds || '[]');
        const matchesPosition = positionId && (item.dataset.positionId == positionId || itemPositionIds.includes(positionId));
        const matchesCodeId = item.dataset.id == geoCodeId;
        item.classList.toggle('active', matchesCodeId && (matchesPosition || !positionId));
        if (item.classList.contains('active')) {
             item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
    document.querySelectorAll('#dispo-list .list-group-item.active').forEach(el => el.classList.remove('active'));
}
function handleObjectDeselected() {
    document.querySelectorAll('#placed-list .list-group-item.active, #dispo-list .list-group-item.active').forEach(item => {
        item.classList.remove('active');
    });
    hideToolbar();
}

// ===================================
// === CRUD GÉO (Placer, Déplacer, Supprimer) ===
// ===================================
async function handleObjectPlaced(fabricObject, geoCodeId, clickPoint = null) {
    if (!fabricObject || !geoCodeId) { return; }
    showLoading("Sauvegarde position...");
    try {
        const center = clickPoint || fabricObject.getCenterPoint();
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
    if (!target.customData.isPlacedText) { console.warn("handleObjectMoved pour non-texte", target); }
    showLoading("Mise à jour position...");
    try {
        const center = target.getCenterPoint();
        const { posX, posY } = convertPixelsToPercent(center.x, center.y, fabricCanvas);
        const positionId = target.customData.position_id;
        const geoCodeId = target.customData.id;
        const positionData = { id: parseInt(geoCodeId, 10), plan_id: currentPlanId, pos_x: posX, pos_y: posY, width: null, height: null, anchor_x: target.customData.anchorSvgId || null, anchor_y: null };
        const updatedPosition = await savePosition(positionData, positionId);
        showToast(`Position "${target.customData.codeGeo}" màj.`, 'success');
        target.set('customData', { ...target.customData, pos_x: updatedPosition.pos_x, pos_y: updatedPosition.pos_y });
        target.setCoords();
        if (fabricCanvas.getActiveObject() === target) { showToolbar(target); }
    } catch (error) { showToast(`Échec màj: ${error.message}`, 'error'); }
    finally { hideLoading(); }
}
async function handleDeleteObject(target) {
    if (!target || !(target.customData?.isGeoTag || target.customData?.isPlacedText)) { return; }
    const positionId = target.customData?.position_id;
    const codeGeo = target.customData?.codeGeo || "inconnu";
    if (!positionId) {
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
        showToast(`"${codeGeo}" supprimé.`, 'success');
        await fetchAndClassifyCodes();
    } catch (error) { showToast(`Échec suppression: ${error.message}`, 'error'); }
    finally { hideLoading(); }
}

// ===================================
// === GESTION DESSIN (Fin, Sauvegarde) ===
// ===================================
function handleDrawingComplete(drawnObject) {
    if (!drawnObject) return;
    const mode = getCurrentDrawingTool();
    if (['rect', 'circle', 'line', 'text'].includes(mode)) {
        drawnObject.set({ selectable: true, evented: true });
        triggerAutoSaveDrawing();
    }
}
let saveTimeout;
function triggerAutoSaveDrawing(forceSave = false) {
    if (planType !== 'image') return;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
         const drawingData = fabricCanvas.toJSON(['customData', 'selectable', 'evented', 'baseStrokeWidth']);
         drawingData.objects = drawingData.objects.filter(obj => !obj.isGridLine && !(obj.customData?.isGeoTag || obj.customData?.isPlacedText));
         try {
             await saveDrawingData(currentPlanId, drawingData.objects.length > 0 ? drawingData : null);
             if (forceSave) showToast("Annotations enregistrées.", "success");
         } catch(error) { showToast(`Erreur sauvegarde annotations: ${error.message}`, "danger"); }
    }, forceSave ? 0 : 1500);
}
async function saveModifiedSvgPlan() {
    if (planType !== 'svg' || !currentPlanId) { throw new Error("Non applicable"); }
    const svgString = fabricCanvas.toSVG(['customData', 'baseStrokeWidth'], obj => obj.isGridLine ? null : obj);
    await updateSvgPlan(currentPlanId, svgString);
}

// ===================================
// === OUTILS DESSIN (Styles, Groupe, Presse-papiers) ===
// ===================================
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

// ===================================
// === ASSETS ===
// ===================================
async function handleSaveAsset() {
    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject || activeObject.isGridLine || activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText || activeObject.isSvgShape) { showToast("Sélectionnez un ou plusieurs objets DESSINÉS.", "warning"); return; }
    if (activeObject.type === 'activeSelection' && activeObject.getObjects().some(obj => obj.isGridLine || obj.customData?.isGeoTag || obj.customData?.isPlacedText || obj.isSvgShape)) { showToast("La sélection contient des éléments non enregistrables.", "warning"); return; }
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
            item.href = '#'; item.className = 'list-group-item list-group-item-action asset-item';
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
            objectToAdd.customData = { ...(assetDataObject.customData || {}), justCreated: true };
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

// ===================================
// === UTILITAIRES UI ===
// ===================================
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
     if (btnIcon) { btnIcon.className = isLocked ? 'bi bi-lock-fill' : 'bi bi-unlock-fill'; }
}

// ===================================
// === CRÉATION ÉLÉMENTS INITIAUX ===
// ===================================
function createInitialGeoElements(placedGeoCodes, planType) {
    if (!fabricCanvas || !placedGeoCodes || placedGeoCodes.length === 0) { return; }
    console.log(`Création de ${placedGeoCodes.length} éléments géo...`);
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
    console.log(`${elementsToCreate.length} éléments géo créés sur le canvas.`);
    fabricCanvas.requestRenderAll();
}

function placeTextOnSvg(codeData, targetSvgShape) {
    let textCoords; let anchorId = null;
    if (targetSvgShape?.getCenterPoint) {
        textCoords = targetSvgShape.getCenterPoint();
        anchorId = targetSvgShape.customData?.svgId;
    } else if (codeData.pos_x !== null && codeData.pos_y !== null) {
        const { left, top } = convertPercentToPixels(codeData.pos_x, codeData.pos_y, fabricCanvas);
        if (!isNaN(left) && !isNaN(top)) { textCoords = { x: left, y: top }; console.log(`Placement texte ${codeData.code_geo} par fallback %`); }
        else { console.error(`Coords invalides pour ${codeData.code_geo}`); return null; }
    } else { return null; }
    const textObject = new fabric.IText(codeData.code_geo || 'ERR', {
        left: textCoords.x, top: textCoords.y, originX: 'center', originY: 'center', fontSize: GEO_TEXT_FONT_SIZE,
        fill: '#000000', stroke: '#FFFFFF', paintFirst: 'stroke', strokeWidth: 0.5, baseStrokeWidth: 0.5,
        fontFamily: 'Arial', textAlign: 'center', fontWeight: 'bold',
        selectable: true, evented: true, hasControls: false, hasBorders: true, borderColor: '#007bff', cornerSize: 0, transparentCorners: true, lockRotation: true,
        customData: { ...codeData, isPlacedText: true, isGeoTag: false, anchorSvgId: anchorId, id: parseInt(codeData.id, 10), position_id: codeData.position_id ? parseInt(codeData.position_id, 10) : null, plan_id: parseInt(currentPlanId, 10) }
    });
    return textObject;
}
function placeTagAtPoint(codeData, point) {
    if (!point || isNaN(point.x) || isNaN(point.y)) { return null; }
    const universColor = universColors[codeData.univers_nom] || codeData.univers_color ||'#6c757d';
    const tagWidth = codeData.width || sizePresets.medium.width; const tagHeight = codeData.height || sizePresets.medium.height;
    const rect = new fabric.Rect({ width: tagWidth, height: tagHeight, fill: universColor, stroke: '#333', strokeWidth: 1, baseStrokeWidth: 1, originX: 'center', originY: 'center' });
    const text = new fabric.Text(codeData.code_geo || 'ERR', { fontSize: GEO_TAG_FONT_SIZE, fill: 'white', fontWeight: 'bold', fontFamily: 'Arial', originX: 'center', originY: 'center' });
    const group = new fabric.Group([rect, text], {
        left: point.x, top: point.y, originX: 'center', originY: 'center', selectable: true, evented: true, hasControls: false, hasBorders: true, borderColor: '#007bff', cornerSize: 0, transparentCorners: true, lockRotation: true, lockScalingX: true, lockScalingY: true, hoverCursor: 'move',
        customData: { ...codeData, isGeoTag: true, isPlacedText: false, id: parseInt(codeData.id, 10), position_id: codeData.position_id ? parseInt(codeData.position_id, 10) : null, plan_id: parseInt(currentPlanId, 10), currentWidth: tagWidth, currentHeight: tagHeight, anchorXPercent: codeData.anchor_x, anchorYPercent: codeData.anchor_y }
    });
    return group;
}

// ===================================
// === GESTION CLIC CANVAS (Mode Placement Géo) ===
// ===================================
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
             handleObjectPlaced(placedObject, codeData.id, pointer);
        } else { setActiveTool('select'); updateDrawingToolButtons(); }
    } catch (e) { console.error("Erreur parse codeData:", e); showToast("Erreur lecture données code.", "danger"); setActiveTool('select'); updateDrawingToolButtons(); }
}

