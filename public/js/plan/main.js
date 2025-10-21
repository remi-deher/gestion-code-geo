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
    getIsDrawing
} from './drawing-tools.js';

import {
    initializeUI,
    showLoading, hideLoading
} from './ui.js';

import { showToast } from '../modules/utils.js';

import {
    sizePresets,
    GEO_TEXT_FONT_SIZE,
    GRID_SIZE
} from '../modules/config.js';


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
    console.log("Plan Editor v2 (Correction API Update) - DOMContentLoaded");

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
            if (planType === 'svg') {
                planSvgUrl = baseUrl + phpData.currentPlan.nom_fichier;
            } else if (planType === 'image') {
                planImageUrl = baseUrl + phpData.currentPlan.nom_fichier;
            }
        }

        if (!currentPlanId || !planType) {
            throw new Error("Données PHP essentielles (planId, planType) manquantes.");
        }
        console.log("Données initiales chargées:", phpData);

    } catch (error) {
        console.error("Erreur lors de la récupération des données PHP:", error);
        showToast("Erreur critique: Données initiales non chargées.", 'error');
        return;
    }


    showLoading("Initialisation du plan...");
    try {
        fabricCanvas = initializeCanvas('plan-canvas');
        if (!fabricCanvas) {
            throw new Error("Impossible d'initialiser le canvas Fabric.");
        }
        console.log("Canvas Fabric initialisé dans canvas.js");

        initializeSidebar(fabricCanvas, universColors, currentPlanId, planType, planUnivers);
        console.log("Sidebar (rôle info) initialisée.");

        initializeDrawingTools(fabricCanvas);
        console.log("Outils de dessin initialisés.");

        initializeUI(fabricCanvas);
        console.log("UI (sidebar toggle, fullscreen) initialisée.");

        if (planType === 'svg' && planSvgUrl) {
            await loadSvgPlan(planSvgUrl);
            setCanvasLock(true);
        } else if (planType === 'image' && planImageUrl) {
            await loadPlanImage(planImageUrl);
            setCanvasLock(true);
        } else {
            resizeCanvas();
            showToast("Aucun plan (SVG/Image) n'a été chargé.", 'warning');
        }

        setupEventListeners();

        createInitialGeoElements(initialPlacedGeoCodes, planType);

        await fetchAndClassifyCodes();

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
                if (success) { // Vérifier si la sauvegarde a réussi (retourne true/false)
                    addModalInstance.hide();
                    await fetchAndClassifyCodes();
                }
            });
        }

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

    // --- Événements Souris sur le Canvas ---
    fabricCanvas.on('mouse:down', handleMouseDown);
    fabricCanvas.on('mouse:move', handleMouseMove);
    fabricCanvas.on('mouse:up', handleMouseUp);
    fabricCanvas.on('mouse:out', handleMouseUp);

    // --- Autres événements Canvas ---
    fabricCanvas.on('object:moving', (options) => {
        if (getSnapToGrid()) {
            const snapSize = GRID_SIZE || 10;
            const target = options.target;
            target.set({
                left: Math.round(target.left / snapSize) * snapSize,
                top: Math.round(target.top / snapSize) * snapSize
            });
        }
    });

    fabricCanvas.on('object:modified', (e) => {
        const target = e.target;
        // Ne sauvegarder QUE si c'est un objet géo (pas les dessins)
        if (target && (target.customData?.isGeoTag || target.customData?.isPlacedText)) {
            console.log("Objet Géo modifié (déplacé):", target.customData.codeGeo);
            handleObjectMoved(target);
        }
    });

    fabricCanvas.on('selection:created', (e) => {
        const target = e.selected[0];
        if (target && (target.customData?.isGeoTag || target.customData?.isPlacedText)) {
            handleObjectSelected(target);
        } else {
            handleObjectDeselected(); // Désélectionne sidebar si on sélectionne autre chose
        }
    });
     fabricCanvas.on('selection:updated', (e) => { // Gérer aussi la mise à jour de sélection
        const target = e.selected[0];
        if (target && (target.customData?.isGeoTag || target.customData?.isPlacedText)) {
            handleObjectSelected(target);
        } else {
            handleObjectDeselected();
        }
    });

    fabricCanvas.on('selection:cleared', (e) => {
        handleObjectDeselected();
    });

    fabricCanvas.on('viewport:transformed', () => {
        const zoom = fabricCanvas.getZoom();
        updateGrid(zoom);
        updateStrokesWidth(zoom);
    });


    // Empêcher menu contextuel natif sur le canvas
    fabricCanvas.upperCanvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

    // --- Événements du Document ---
    document.addEventListener('click', () => {
        const contextMenu = document.getElementById('custom-context-menu');
        if (contextMenu) contextMenu.style.display = 'none';
    });

    document.addEventListener('keydown', (e) => {
        // Ignorer si un input est focus
        const isInputFocused = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
        if (isInputFocused) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            const activeObject = fabricCanvas.getActiveObject();
            if (activeObject && (activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText)) {
                e.preventDefault();
                handleDeleteObject(activeObject);
            }
        }
        if (e.key === 'Escape') {
            if (getCurrentDrawingTool() !== 'select') setActiveTool('select');
            fabricCanvas.discardActiveObject().renderAll();
        }
        if (e.key === 'Alt') {
            if (!fabricCanvas.isDragging) { // Éviter de changer si déjà en pan
                fabricCanvas.defaultCursor = 'grab';
                fabricCanvas.hoverCursor = 'grab';
            }
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
         if (e.key === 'Alt') {
            // Ne réinitialiser que si on n'est PAS en train de pan (au cas où)
             if (!fabricCanvas.isDragging) {
                fabricCanvas.defaultCursor = (getCurrentDrawingTool() === 'select') ? 'default' : 'crosshair';
                fabricCanvas.hoverCursor = (getCurrentDrawingTool() === 'select') ? 'move' : 'crosshair';
            }
        }
    });

    // --- Listeners pour les boutons (Zoom, etc.) ---
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => zoomCanvas(1.2));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => zoomCanvas(0.8));
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoom);
}

// --- GESTIONNAIRES D'ÉVÉNEMENTS SOURIS (Pan, Dessin, Placement) ---

function handleMouseDown(options) {
    const evt = options.e;
    const target = options.target;

    if (options.button === 3 || evt.ctrlKey) {
        handleRightClick(options);
        return;
    }

    if (target) {
        if (evt.altKey) { startPan(evt); }
        return;
    }

    const currentTool = getCurrentDrawingTool();

    if (currentTool === 'tag') { handleCanvasClick(options); }
    else if (currentTool !== 'select') { startDrawing(options); }
    else if (evt.altKey || options.button === 2) { startPan(evt); }
    else { handleObjectDeselected(); }
}

function handleMouseMove(options) {
    const evt = options.e;
    if (fabricCanvas.isDragging) { continuePan(evt); }
    else if (getIsDrawing()) { continueDrawing(options); }
}

function handleMouseUp(options) {
    if (fabricCanvas.isDragging) { stopPan(); }
    else if (getIsDrawing()) {
        const drawnObject = stopDrawing(options);
        if (drawnObject) { handleDrawingComplete(drawnObject); }
    }

    const currentTool = getCurrentDrawingTool();
    if (currentTool === 'text' && !getIsDrawing() && options.target == null && options.e.type !== 'mouseout') {
         const textObject = stopDrawing(options);
         if (textObject) { handleDrawingComplete(textObject); }
    }
}

// --- FONCTIONS AIDE AU PAN ---
function startPan(evt) {
    fabricCanvas.isDragging = true;
    fabricCanvas.selection = false;
    fabricCanvas.lastPosX = evt.clientX;
    fabricCanvas.lastPosY = evt.clientY;
    fabricCanvas.defaultCursor = 'grabbing';
    fabricCanvas.hoverCursor = 'grabbing';
    fabricCanvas.requestRenderAll();
}
function continuePan(evt) {
    const vpt = fabricCanvas.viewportTransform;
    vpt[4] += evt.clientX - fabricCanvas.lastPosX;
    vpt[5] += evt.clientY - fabricCanvas.lastPosY;
    fabricCanvas.requestRenderAll();
    fabricCanvas.lastPosX = evt.clientX;
    fabricCanvas.lastPosY = evt.clientY;
}
function stopPan() {
    // Appliquer la transformation finale pour éviter les sauts
    fabricCanvas.setViewportTransform(fabricCanvas.viewportTransform);
    fabricCanvas.isDragging = false;
    fabricCanvas.selection = (getCurrentDrawingTool() === 'select'); // Réactiver si en mode select
    // Réinitialiser les curseurs correctement
    fabricCanvas.defaultCursor = (getCurrentDrawingTool() === 'select') ? 'default' : 'crosshair';
    fabricCanvas.hoverCursor = (getCurrentDrawingTool() === 'select') ? 'move' : 'crosshair';
    fabricCanvas.requestRenderAll();
}


// --- GESTIONNAIRES D'ÉVÉNEMENTS (Canvas) ---

function handleRightClick(options) {
    const contextMenu = document.getElementById('custom-context-menu');
    if (!contextMenu) return;

    contextMenu.querySelectorAll('li').forEach(item => item.style.display = 'none');

    const target = options.target;
    const pointer = fabricCanvas.getPointer(options.e);

    if (target && (target.customData?.isGeoTag || target.customData?.isPlacedText)) {
        fabricCanvas.setActiveObject(target);
        document.getElementById('menu-item-delete').style.display = 'block';
        document.getElementById('menu-item-info').style.display = 'block';
        document.getElementById('menu-action-delete').onclick = () => handleDeleteObject(target);
        document.getElementById('menu-action-info').onclick = () => alert(JSON.stringify(target.customData, null, 2));

    } else if (target && target.isSvgShape && planType === 'svg') {
        document.getElementById('menu-item-place-text').style.display = 'block';
        document.getElementById('menu-action-place-text').onclick = () => {
            const selectedCodeEl = document.querySelector('#dispo-list .list-group-item.active');
            if (selectedCodeEl) {
                const codeData = JSON.parse(selectedCodeEl.dataset.codeData);
                console.log("Placement (Menu Clic Droit) Texte:", codeData.code_geo, "sur SVG:", target.customData.svgId);
                const textObject = placeTextOnSvg(codeData, target); // Passe la target SVG
                if (textObject) { handleObjectPlaced(textObject, codeData.id); }
            } else { showToast("Veuillez sélectionner un code dans la liste 'Disponibles'.", 'info'); }
        };

    } else { // Clic sur le vide
        document.getElementById('menu-item-add-tag').style.display = 'block';
        document.getElementById('menu-item-toggle-grid').style.display = 'block';
        document.getElementById('menu-item-toggle-lock').style.display = 'block';

        document.getElementById('menu-text-toggle-grid').textContent = getSnapToGrid() ? "Désactiver Magnétisme" : "Activer Magnétisme";
        document.getElementById('menu-text-toggle-lock').textContent = getCanvasLock() ? "Déverrouiller le plan" : "Verrouiller le plan";

        document.getElementById('menu-action-add-tag').onclick = () => {
            const selectedCodeEl = document.querySelector('#dispo-list .list-group-item.active');
            if (selectedCodeEl) {
                const codeData = JSON.parse(selectedCodeEl.dataset.codeData);
                console.log("Placement (Menu Clic Droit) Tag:", codeData.code_geo, "en (x,y):", pointer.x, pointer.y);
                const tagObject = placeTagAtPoint(codeData, pointer);
                if (tagObject) { handleObjectPlaced(tagObject, codeData.id, pointer); }
            } else { showToast("Veuillez sélectionner un code dans la liste 'Disponibles'.", 'info'); }
        };
        document.getElementById('menu-action-toggle-grid').onclick = () => {
             const snapToggle = document.getElementById('snap-toggle');
             if(snapToggle) snapToggle.checked = !snapToggle.checked;
             toggleSnapToGrid(); // Met à jour la variable snapToGrid dans canvas.js
        };
        document.getElementById('menu-action-toggle-lock').onclick = () => setCanvasLock(!getCanvasLock());
    }

    contextMenu.style.left = `${options.e.clientX}px`;
    contextMenu.style.top = `${options.e.clientY}px`;
    contextMenu.style.display = 'block';
}

function handleCanvasClick(options) {
    const mode = getCurrentDrawingTool();
    const pointer = fabricCanvas.getPointer(options.e);

    if (mode === 'tag') {
        const selectedCodeEl = document.querySelector('#dispo-list .list-group-item.active');
        if (!selectedCodeEl) {
            showToast("Aucun code disponible sélectionné.", 'warning');
            setActiveTool('select');
            return;
        }
        try { // Ajouter un try...catch pour le JSON.parse
            const codeData = JSON.parse(selectedCodeEl.dataset.codeData);
            console.log("Placement (Clic Gauche) de:", codeData.code_geo, "en (x,y):", pointer.x, pointer.y);
            const tagObject = placeTagAtPoint(codeData, pointer);
            if (tagObject) { handleObjectPlaced(tagObject, codeData.id, pointer); }
        } catch (e) {
            console.error("Erreur parsing codeData:", e, selectedCodeEl.dataset.codeData);
            showToast("Erreur: Impossible de lire les données du code sélectionné.", "danger");
            setActiveTool('select');
        }
    }
}

function handleObjectSelected(target) {
    const positionId = target.customData?.position_id;
    if (!positionId) return;
    document.querySelectorAll('#placed-list .list-group-item').forEach(item => {
        if (item.dataset.positionId == positionId) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

function handleObjectDeselected() {
    document.querySelectorAll('#placed-list .list-group-item.active').forEach(item => {
        item.classList.remove('active');
    });
}

// --- GESTIONNAIRES D'ACTIONS (CRUD) ---

async function handleObjectPlaced(fabricObject, geoCodeId, clickPoint = null) {
    showLoading("Sauvegarde...");
    try {
        const center = clickPoint ? clickPoint : fabricObject.getCenterPoint();
        const { x_percent, y_percent } = convertPixelsToPercent(center.x, center.y, fabricCanvas);

        // *** CORRECTION : S'assurer que 'id' est bien le geoCodeId ***
        const positionData = {
            id: geoCodeId, // PHP attend 'id' pour le geo_code_id
            plan_id: currentPlanId,
            pos_x: x_percent,
            pos_y: y_percent,
            width: fabricObject.customData.isGeoTag ? fabricObject.width * fabricObject.scaleX : null,
            height: fabricObject.customData.isGeoTag ? fabricObject.height * fabricObject.scaleY : null,
            anchor_x: fabricObject.customData.isPlacedText ? fabricObject.customData.anchorSvgId : null,
            anchor_y: null,
            position_id: null // Indique une création
        };

        const savedPosition = await savePosition(positionData); // Appel API locale

        // Mettre à jour l'objet Fabric avec les données retournées (surtout position_id)
        fabricObject.set('customData', {
            ...fabricObject.customData,
            position_id: savedPosition.id, // L'API retourne 'id' pour position_id
            plan_id: savedPosition.plan_id,
            // Confirmer les % réels (au cas où le backend les ajuste)
            pos_x: savedPosition.pos_x,
            pos_y: savedPosition.pos_y,
        });
        // S'assurer que l'ID du code géo est bien dans customData (si ce n'était pas le cas)
        if (!fabricObject.customData.id) {
             fabricObject.customData.id = geoCodeId;
        }

        fabricCanvas.requestRenderAll();
        showToast(`Code "${fabricObject.customData.codeGeo}" placé.`, 'success');
        await fetchAndClassifyCodes();

    } catch (error) {
        console.error("Erreur lors de la sauvegarde de la position:", error);
        showToast(`Échec sauvegarde: ${error.message}`, 'error');
        fabricCanvas.remove(fabricObject);
    } finally {
        hideLoading();
        setActiveTool('select');
    }
}

/**
 * *** FONCTION CORRIGÉE ***
 * Appelé lorsqu'un objet Géo est déplacé sur le canvas.
 */
async function handleObjectMoved(target) {
    showLoading("Mise à jour...");
    try {
        const center = target.getCenterPoint();
        const { x_percent, y_percent } = convertPixelsToPercent(center.x, center.y, fabricCanvas);
        const positionId = target.customData.position_id;
        const geoCodeId = target.customData.id; // Récupérer l'ID du code géo

        if (!positionId || !geoCodeId) {
             console.warn("Objet déplacé sans position_id ou id (geoCodeId), sauvegarde annulée.", target.customData);
             hideLoading(); // Ne pas laisser le loader actif
             return;
        }

        // *** CORRECTION: Inclure 'id' (geoCodeId) pour la validation PHP ***
        const positionData = {
            id: geoCodeId, // PHP attend 'id' pour le geo_code_id
            plan_id: currentPlanId, // Inclure plan_id aussi
            pos_x: x_percent,
            pos_y: y_percent,
            width: target.customData.isGeoTag ? target.width * target.scaleX : null,
            height: target.customData.isGeoTag ? target.height * target.scaleY : null,
            anchor_x: target.customData.anchorSvgId || null,
            anchor_y: null
            // position_id sera ajouté par la fonction savePosition JS
        };

        // Appel API (savePosition JS ajoute position_id pour l'update)
        const updatedPosition = await savePosition(positionData, positionId);

        showToast(`Position de "${target.customData.codeGeo}" mise à jour.`, 'success');

        // Mettre à jour les % dans l'objet fabric
        target.set('customData', {
             ...target.customData,
             pos_x: updatedPosition.pos_x, // Utiliser les valeurs retournées
             pos_y: updatedPosition.pos_y
        });
        target.setCoords(); // Recalculer les contrôles

    } catch (error) {
        console.error("Erreur lors de la mise à jour de la position:", error);
        showToast(`Échec mise à jour: ${error.message}`, 'error');
        // TODO: Revenir à la position précédente ?
    } finally {
        hideLoading();
    }
}

async function handleDeleteObject(target) {
    const positionId = target.customData?.position_id;
    const codeGeo = target.customData?.codeGeo || "inconnu";

    if (!positionId) {
        console.warn("Suppression locale objet sans position_id.");
        fabricCanvas.remove(target);
        fabricCanvas.discardActiveObject().renderAll();
        await fetchAndClassifyCodes();
        return;
    }

    if (!confirm(`Supprimer "${codeGeo}" ?`)) return;

    showLoading("Suppression...");
    try {
        await deletePosition(positionId); // API Locale
        fabricCanvas.remove(target);
        fabricCanvas.discardActiveObject().renderAll();
        showToast(`"${codeGeo}" supprimé.`, 'success');
        await fetchAndClassifyCodes();
    } catch (error) {
        console.error("Erreur suppression:", error);
        showToast(`Échec suppression: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

function handleDrawingComplete(drawnObject) {
    const mode = getCurrentDrawingTool();
    if (['rect', 'circle', 'line', 'text'].includes(mode)) {
        console.log(`Dessin ${mode} terminé.`);
        // Activer la sélection pour l'objet dessiné
        drawnObject.set({ selectable: true, evented: true });
        // Sauvegarder l'état du dessin (si nécessaire)
        // saveDrawingData(); // Fonction API pour sauvegarder JSON des dessins
    }
}


// --- FONCTIONS DE PLACEMENT (Création Fabric) ---

function placeTextOnSvg(codeData, targetSvgShape) {
    let textCoords = { x: 0, y: 0 };
    let anchorId = null;

    if (targetSvgShape && targetSvgShape.getCenterPoint) {
        const center = targetSvgShape.getCenterPoint();
        textCoords.x = center.x;
        textCoords.y = center.y;
        anchorId = targetSvgShape.customData?.svgId;
    }
    else if (codeData.pos_x !== null && codeData.pos_y !== null) {
        const { left, top } = convertPercentToPixels(codeData.pos_x, codeData.pos_y, fabricCanvas);
        textCoords.x = left;
        textCoords.y = top;
    }
    else {
         console.warn("Texte sans ancre ni pos_x/pos_y, placement au centre.");
         const center = fabricCanvas.getVpCenter(); // Centre du viewport
         textCoords.x = center.x;
         textCoords.y = center.y;
    }

    const zoom = fabricCanvas.getZoom();
    const textToShow = codeData.code_geo || 'ERREUR';
    const fontSize = (GEO_TEXT_FONT_SIZE || 16);
    const scaledFontSize = fontSize / zoom;

    const textObject = new fabric.IText(textToShow, {
        left: textCoords.x, top: textCoords.y,
        originX: 'center', originY: 'center',
        fontSize: scaledFontSize,
        fill: '#000000', stroke: '#FFFFFF', paintFirst: 'stroke',
        strokeWidth: (0.5 / zoom),
        baseStrokeWidth: 0.5,
        fontFamily: 'Arial', textAlign: 'center',
        selectable: true, evented: true, hasControls: false, hasBorders: true,
        borderColor: '#007bff', cornerSize: 0, transparentCorners: true,
        lockRotation: true,

        customData: {
            ...codeData,
            codeGeo: codeData.code_geo,
            isPlacedText: true, isGeoTag: false,
            anchorSvgId: anchorId,
            id: parseInt(codeData.id, 10),
            position_id: parseInt(codeData.position_id, 10) || null,
            plan_id: parseInt(codeData.plan_id, 10) || parseInt(currentPlanId, 10)
        }
    });

    fabricCanvas.add(textObject);
    textObject.moveTo(999);
    return textObject;
}

function placeTagAtPoint(codeData, point) {
    if (!point) { console.error("placeTagAtPoint: point manquant."); return null; }
    const universColor = universColors[codeData.univers_nom] || '#6c757d';

    const tagData = {
        ...codeData,
        pos_x_pixels: point.x, pos_y_pixels: point.y,
        width: sizePresets.medium.width,
        height: sizePresets.medium.height,
        position_id: null,
        plan_id: currentPlanId
    };

    // Fallback Rect
    const tagObject = new fabric.Rect({
         width: tagData.width, height: tagData.height,
         fill: universColor, stroke: '#333', strokeWidth: 1, baseStrokeWidth: 1,
         originX: 'center', originY: 'center'
    });
    tagObject.customData = { ...tagData, isGeoTag: true, isPlacedText: false, codeGeo: codeData.code_geo, id: codeData.id };

    if (tagObject) {
        tagObject.set({ left: point.x, top: point.y });
        fabricCanvas.add(tagObject);
        fabricCanvas.setActiveObject(tagObject);
        tagObject.moveTo(999);
    }
    return tagObject;
}



// --- INITIALISATION AU CHARGEMENT DE LA PAGE ---

function createInitialGeoElements(placedGeoCodes, planType) {
    console.log("Création éléments géo initiaux...");
    if (!fabricCanvas || !placedGeoCodes || placedGeoCodes.length === 0) {
        console.warn("createInitialGeoElements: Prérequis non remplis."); return;
    }
    let createdCount = 0;
    placedGeoCodes.forEach(codeInfo => {
        if (codeInfo.placements && Array.isArray(codeInfo.placements)) {
            codeInfo.placements.forEach(placement => {
                if (placement.plan_id != currentPlanId) return;
                const elementData = { ...codeInfo, ...placement, id: codeInfo.id, position_id: placement.position_id };
                delete elementData.placements;
                let createdElement = null;

                if (placement.width === null || placement.width === undefined) { // Texte
                    const targetSvgShape = findSvgShapeByCodeGeo(elementData.anchor_x);
                    if (targetSvgShape || elementData.anchor_x === null) {
                        createdElement = placeTextOnSvg(elementData, targetSvgShape);
                    } else { console.warn(`Ancre SVG "${elementData.anchor_x}" non trouvée pour "${elementData.code_geo}".`); }
                }
                else { // Tag Rect
                    const { left, top } = convertPercentToPixels(elementData.pos_x, elementData.pos_y, fabricCanvas);
                    const tagData = { ...elementData, pos_x_pixels: left, pos_y_pixels: top };
                    const universColor = universColors[elementData.univers_nom] || '#6c757d';
                    createdElement = new fabric.Rect({
                         left: tagData.pos_x_pixels, top: tagData.pos_y_pixels,
                         width: tagData.width, height: tagData.height,
                         fill: universColor, stroke: '#333', strokeWidth: 1, baseStrokeWidth: 1,
                         originX: 'center', originY: 'center'
                    });
                    createdElement.customData = { ...tagData, isGeoTag: true, isPlacedText: false, codeGeo: tagData.code_geo, id: tagData.id };
                    if (createdElement) fabricCanvas.add(createdElement);
                }
                if (createdElement) createdCount++;
            });
        }
    });
    console.log(`${createdCount} éléments géo initiaux créés.`);
    fabricCanvas.requestRenderAll();
}


// --- API LOCALES ---

async function savePosition(positionData, positionId = null) {
    // La fonction ajoute elle-même position_id si fourni
    if (positionId) positionData.position_id = positionId;

    // S'assurer que les clés requises par PHP ('id', 'plan_id', 'pos_x', 'pos_y') sont là
    if (!positionData.id || !positionData.plan_id || positionData.pos_x == null || positionData.pos_y == null) {
        console.error("Données manquantes pour savePosition:", positionData);
        throw new Error("Données locales invalides (id, plan_id, pos_x, pos_y requis)");
    }

    const url = `index.php?action=savePosition`; // Route configurée dans index.php
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(positionData)
    };
    try {
        const response = await fetch(url, options);
        // Vérifier si la réponse est JSON avant de la parser
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const errorText = await response.text();
            console.error('Réponse non-JSON du serveur:', errorText);
            throw new Error(`Erreur serveur (${response.status}), réponse non-JSON.`);
        }
        const data = await response.json();
        if (!response.ok || !data.success) {
            // Utiliser l'erreur du JSON si dispo, sinon message générique
            throw new Error(data.error || `Erreur lors de la sauvegarde (${response.status})`);
        }
        console.log("Position sauvegardée:", data.position);
        // L'API retourne 'id' comme étant le position_id, et 'geo_code_id'
        // Renommer 'id' en 'position_id' pour la cohérence JS ? Non, utilisons la réponse brute.
        // Assurons-nous juste que les clés nécessaires sont là.
        if (!data.position || data.position.id == null) {
             throw new Error("Réponse API invalide, position.id manquant.");
        }
        return data.position; // Contient 'id' (position_id), 'geo_code_id', etc.
    } catch (error) {
        console.error('Erreur API (savePosition):', error);
        throw error;
    }
}

async function deletePosition(positionId) {
    const url = `index.php?action=removePosition`; // Route configurée dans index.php
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ position_id: positionId })
    };
    try {
        const response = await fetch(url, options);
        const contentType = response.headers.get('content-type');
         if (!contentType || !contentType.includes('application/json')) {
             const errorText = await response.text();
             console.error('Réponse non-JSON du serveur (delete):', errorText);
             throw new Error(`Erreur serveur (${response.status}), réponse non-JSON.`);
        }
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || `Erreur lors de la suppression (${response.status})`);
        }
        console.log("Position supprimée:", data);
        return data;
    } catch (error) {
        console.error('Erreur API (deletePosition):', error);
        throw error;
    }
}

async function fetchAvailableCodes(planId) {
    const url = `index.php?action=getAvailableCodesForPlan&plan_id=${planId}`;
    try {
        const response = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
         const contentType = response.headers.get('content-type');
         if (!contentType || !contentType.includes('application/json')) {
              const errorText = await response.text();
              console.error('Réponse non-JSON (fetchAvailable):', errorText);
              throw new Error(`Erreur serveur (${response.status}), réponse non-JSON.`);
         }
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Erreur API');
        return data.codes || [];
    } catch (error) {
        console.error('Erreur API (fetchAvailableCodes):', error);
        showToast(`Erreur chargement codes disponibles: ${error.message}`, 'error');
        return [];
    }
}

async function saveNewGeoCode(codeData) {
    const url = 'index.php?action=addGeoCodeFromPlan';
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(codeData)
    };
    try {
        const response = await fetch(url, options);
        const contentType = response.headers.get('content-type');
         if (!contentType || !contentType.includes('application/json')) {
              const errorText = await response.text();
              console.error('Réponse non-JSON (saveNewGeoCode):', errorText);
              throw new Error(`Erreur serveur (${response.status}), réponse non-JSON.`);
         }
        const data = await response.json();
        if (!response.ok || !data.success) {
            if (data.errors) throw new Error(Object.values(data.errors).join(', '));
            throw new Error(data.error || 'Erreur lors de la création du code');
        }
        console.log("Nouveau code créé:", data.code);
        return data.code;
    } catch (error) {
        console.error('Erreur API (saveNewGeoCode):', error);
        throw error; // Important de propager pour que handleSaveNewCodeInModal le sache
    }
}


// --- UTILITAIRES DE CONVERSION ---

function convertPixelsToPercent(pixelX, pixelY, canvas) {
    const bg = canvas.backgroundImage || canvas.getObjects().find(o => o.isSvgShape); // Essayer image OU premier objet SVG
    if (!bg) {
        console.warn("convertPixelsToPercent: Arrière-plan non trouvé.");
        const viewWidth = canvas.width / (canvas.getZoom() || 1);
        const viewHeight = canvas.height / (canvas.getZoom() || 1);
        const vpt = canvas.viewportTransform;
        const relativeX = (pixelX - vpt[4]) / (canvas.getZoom() || 1);
        const relativeY = (pixelY - vpt[5]) / (canvas.getZoom() || 1);
        return { x_percent: (relativeX / viewWidth) * 100, y_percent: (relativeY / viewHeight) * 100 };
    }
    // Utiliser getBoundingRect pour SVG groupé ou Image
    const bbox = bg.getBoundingRect();
    const bgWidth = bbox.width;
    const bgHeight = bbox.height;
    const bgLeft = bbox.left;
    const bgTop = bbox.top;

    const relativeX = pixelX - bgLeft;
    const relativeY = pixelY - bgTop;
    const x_percent = (relativeX / bgWidth) * 100;
    const y_percent = (relativeY / bgHeight) * 100;
    return { x_percent, y_percent };
}

function convertPercentToPixels(percentX, percentY, canvas) {
    const bg = canvas.backgroundImage || canvas.getObjects().find(o => o.isSvgShape); // Essayer image OU premier objet SVG
     if (!bg) {
        console.warn("convertPercentToPixels: Arrière-plan non trouvé.");
        const viewWidth = canvas.width / (canvas.getZoom() || 1);
        const viewHeight = canvas.height / (canvas.getZoom() || 1);
        const vpt = canvas.viewportTransform;
        const relativeX = (percentX / 100) * viewWidth;
        const relativeY = (percentY / 100) * viewHeight;
        return {
            left: (relativeX * (canvas.getZoom() || 1)) + vpt[4],
            top: (relativeY * (canvas.getZoom() || 1)) + vpt[5]
        };
    }
    const bbox = bg.getBoundingRect();
    const bgWidth = bbox.width;
    const bgHeight = bbox.height;
    const bgLeft = bbox.left;
    const bgTop = bbox.top;

    const relativeX = (percentX / 100) * bgWidth;
    const relativeY = (percentY / 100) * bgHeight;
    const left = bgLeft + relativeX;
    const top = bgTop + relativeY;
    return { left, top };
}
