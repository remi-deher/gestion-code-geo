// --- IMPORTS ---
import {
    initializeCanvas,
    loadSvgPlan,
    loadPlanImage,
    getCanvasInstance,
    resizeCanvas,
    resetZoom,
    setCanvasLock,
    getCanvasLock,
    findSvgShapeByCodeGeo,
    toggleSnapToGrid,
    getSnapToGrid,
    zoomCanvas,
    getCanvasDimensions,
    updateGrid,
    updateStrokesWidth,
    drawPageGuides
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
    // updateGroupButtonStates est DÉJÀ défini dans main.js, donc on ne l'importe pas
} from './drawing-tools.js';

import {
    initializeUI,
    showLoading,
    hideLoading
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
    cancelArrowDrawing,
    deleteSelectedGeoElement // Assurez-vous d'importer la fonction de suppression
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
    deleteAsset,
    saveDrawingData,
    createSvgPlan,
    updateSvgPlan, // <<<< Utilisé pour la sauvegarde JSON
    removeMultiplePositions
} from '../modules/api.js';


// --- INITIALISATION GLOBALE ---

let fabricCanvas;
let currentPlanId;
let planType;
let planImageUrl;
let planSvgUrl;
let planJsonUrl; // <<< Pour charger l'état JSON
let initialPlacedGeoCodes;
let universColors;
let planUnivers;
let autoSaveTimeout; // Pour la sauvegarde automatique
let currentPageSizeFormat = 'Original';

// --- SUPPRIMÉ : Variables pour le placement d'asset ---
// let assetToPlace = null;
// let isAssetPlacementMode = false;


// ===================================
// === DÉFINITION DES GESTIONNAIRES & FONCTIONS ===
// ===================================

// ===================================
// === GESTIONNAIRES ÉVÉNEMENTS SOURIS ===
// ===================================

function handleMouseDown(options) {
    const evt = options.e;
    // Ignorer clic droit ou Ctrl+clic
    if (options.button === 3 || evt.ctrlKey) {
        return;
    }

    // --- SUPPRIMÉ : Logique de Placement d'Asset ---

    // Démarrer Pan si Alt pressé ou clic molette
    if (evt.altKey || options.button === 2) {
        startPan(evt);
        return;
    }
    // Gérer placement flèche
    if (getIsDrawingArrowMode && getIsDrawingArrowMode()) {
        handleArrowEndPoint(options);
        return;
    }

    const currentTool = getCurrentDrawingTool();
    if (currentTool === 'tag') {
        handleCanvasClick(options);
        return;
    }

    const target = options.target;

    // Si on clique sur un objet existant (et pas la grille)
    if (target && !target.isGridLine) {
        return; // Clic de sélection normal
    }

    // Si on clique sur le fond du canvas
    if (currentTool !== 'select') {
        startDrawing(options); // Démarrer dessin (rect, line, etc.)
    } else {
        // Outil sélection + clic sur fond = désélection
        fabricCanvas.discardActiveObject().renderAll();
        handleObjectDeselected();
    }
}

function handleMouseMove(options) {
    // Continuer le Pan
    if (fabricCanvas.isDragging) {
        continuePan(options.e);
    }
    // Continuer le dessin
    else if (getIsDrawing()) {
        continueDrawing(options); // Géré par drawing-tools.js
    }
}

function handleMouseUp(options) {
    // Arrêter le Pan
    if (fabricCanvas.isDragging) {
        stopPan();
    }
    // Arrêter le dessin de forme
    else if (getIsDrawing()) {
        const drawnObject = stopDrawing(options); // Géré par drawing-tools.js
        if (drawnObject) {
            handleDrawingComplete(drawnObject);
        }
    }

    // Cas spécial : création de texte
    const currentTool = getCurrentDrawingTool();
    if (currentTool === 'text' && !getIsDrawing() && (!options.target || options.target.isGridLine || options.target.isPageGuide) && options.e.type !== 'mouseout') {
        const textObject = stopDrawing(options);
        if (textObject) {
            handleDrawingComplete(textObject);
        }
    }
}

// ===================================
// === FONCTIONS PAN ===
// ===================================
function startPan(evt) {
    // Ne pas panner si dessin ou flèche en cours
    if (getIsDrawing() || (getIsDrawingArrowMode && getIsDrawingArrowMode())) return;
    fabricCanvas.isDragging = true;
    fabricCanvas.selection = false;
    fabricCanvas.lastPosX = evt.clientX;
    fabricCanvas.lastPosY = evt.clientY;
    fabricCanvas.defaultCursor = 'grabbing';
    fabricCanvas.hoverCursor = 'grabbing';
    fabricCanvas.getObjects().forEach(o => {
        if (!o.isGridLine) o.set('evented', false)
    });
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
    fabricCanvas.setViewportTransform(fabricCanvas.viewportTransform);
    fabricCanvas.isDragging = false;
    // Restaurer curseur/sélection en fonction de l'outil ACTUEL
    const currentTool = getCurrentDrawingTool();
    const isSelectTool = (currentTool === 'select');
    fabricCanvas.selection = isSelectTool;
    fabricCanvas.defaultCursor = isSelectTool ? 'default' : 'crosshair';
    fabricCanvas.hoverCursor = isSelectTool ? 'move' : 'crosshair';
    fabricCanvas.getObjects().forEach(o => o.set('evented', true));
    fabricCanvas.requestRenderAll();
}

// ===================================
// === GESTION SÉLECTION ===
// ===================================
// (Fonctions handleSelectionChange, handleObjectSelected, handleObjectDeselected INCHANGÉES)
function handleSelectionChange(selectedItems) {
    if (!selectedItems || selectedItems.length === 0) {
        handleObjectDeselected();
        updateGroupButtonStates();
        return;
    }
    const activeSelection = fabricCanvas.getActiveObject();
    if (!activeSelection) return;

    if (activeSelection.type === 'activeSelection') {
        handleObjectDeselected();
    } else {
        const target = activeSelection;
        if (target.customData?.isGeoTag || target.customData?.isPlacedText) {
            showToolbar(target);
            handleObjectSelected(target);
        } else if (!target.isGridLine) {
            hideToolbar();
            handleObjectDeselected();
            updateDrawingStyleFromObject(target);
        } else {
            hideToolbar();
        }
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
// (Fonctions handleObjectPlaced, handleObjectMoved, handleDeleteObject INCHANGÉES)
async function handleObjectPlaced(fabricObject, geoCodeId, clickPoint) {
    console.log("--- handleObjectPlaced (Placement) ---");
    const { pos_x, pos_y, anchor_x, anchor_y, width, height } = getPositionDataFromObject(fabricObject, clickPoint);
    const positionData = { id: geoCodeId, plan_id: currentPlanId, code_geo: fabricObject.customData.code_geo, position_id: null, pos_x, pos_y, width, height, anchor_x, anchor_y };
    console.log("LOG 1 - Envoi:", positionData);
    showLoading('Sauvegarde position...');
    try {
        const savedPosition = await savePosition(positionData);
        console.log("LOG 2 - Réponse:", savedPosition);
        if (savedPosition && typeof savedPosition.id !== 'undefined' && savedPosition.id !== null) {
            console.log("LOG 3 - ID reçu:", savedPosition.id);
            fabricObject.customData.position_id = parseInt(savedPosition.id, 10);
            fabricObject.customData.pos_x = savedPosition.pos_x;
            fabricObject.customData.pos_y = savedPosition.pos_y;
            fabricObject.customData.width = savedPosition.width;
            fabricObject.customData.height = savedPosition.height;
            fabricObject.customData.anchor_x = savedPosition.anchor_x;
            fabricObject.customData.anchor_y = savedPosition.anchor_y;
            console.log("LOG 6 - customData màj:", JSON.parse(JSON.stringify(fabricObject.customData)));
            showToast(`Position ${positionData.code_geo || ''} sauvegardée.`, 'success');
            await fetchAndClassifyCodes();
        } else {
            console.error("LOG 4 - ÉCHEC ID:", savedPosition);
            fabricCanvas.remove(fabricObject);
            throw new Error("ID position invalide.");
        }
    } catch (error) {
        console.error("LOG 5 - Erreur CATCH:", error);
        showToast(`Échec sauvegarde: ${error.message}`, 'danger');
        if (fabricCanvas.contains(fabricObject)) fabricCanvas.remove(fabricObject);
    } finally {
        hideLoading();
    }
}

async function handleObjectMoved(target) {
    if (!target?.customData?.id || !target.customData.isPlacedText) return;
    const positionId = target.customData.position_id || null;
    const geoCodeId = target.customData.id;
    console.log(`[handleObjectMoved] LOG 7 - Déplacement. position_id: ${positionId}, geoCodeId: ${geoCodeId}`);
    if (!geoCodeId || !currentPlanId) { showToast("Erreur sauvegarde: ID manquant.", "danger"); return; }
    showLoading("Mise à jour position...");
    try {
        const { pos_x, pos_y, anchor_x, anchor_y, width, height } = getPositionDataFromObject(target);
        const positionData = { id: parseInt(geoCodeId, 10), plan_id: currentPlanId, position_id: positionId, pos_x, pos_y, width, height, anchor_x, anchor_y, code_geo: target.customData.code_geo };
        const updatedPosition = await savePosition(positionData);
        if (updatedPosition && updatedPosition.id) {
            target.customData.position_id = updatedPosition.id;
            target.customData.pos_x = updatedPosition.pos_x;
            target.customData.pos_y = updatedPosition.pos_y;
            showToast(`Position "${target.customData.code_geo}" màj.`, 'success');
            if (positionId === null) await fetchAndClassifyCodes();
        } else { throw new Error("Réponse API invalide."); }
        target.setCoords();
        if (fabricCanvas.getActiveObject() === target) showToolbar(target);
    } catch (error) {
        console.error("[handleObjectMoved] Erreur CATCH:", error);
        showToast(`Échec màj: ${error.message}`, 'danger');
    } finally {
        hideLoading();
    }
}

async function handleDeleteObject(target) {
    console.log("handleDeleteObject target:", target);
    if (!target) target = fabricCanvas.getActiveObject();
    if (!target) return;
    if (target.type === 'activeSelection') {
        console.log("handleDeleteObject: Multi-sélection.");
        await deleteSelectedGeoElement(); // Gère geo + dessin
    } else if (target.customData?.isGeoTag || target.customData?.isPlacedText) {
        console.log("handleDeleteObject: Géo unique.");
        await deleteSelectedGeoElement();
    } else if (!target.isGridLine && !target.isEditing) {
        console.log("handleDeleteObject: Dessin unique.");
        deleteSelectedDrawingShape();
        triggerAutoSaveDrawing();
    } else {
        console.log("handleDeleteObject: Non supprimable.", target);
    }
}
// ===================================
// === GESTION DESSIN (Fin, Sauvegarde) ===
// ===================================
// (Fonctions handleDrawingComplete, triggerAutoSaveDrawing, savePlanAsJson INCHANGÉES)
function handleDrawingComplete(drawnObject) {
    if (!drawnObject) return;
    const mode = getCurrentDrawingTool();
    if (['rect', 'circle', 'line', 'text'].includes(mode)) {
        drawnObject.set({ selectable: true, evented: true });
        triggerAutoSaveDrawing();
    }
}

function triggerAutoSaveDrawing(forceSave = false) {
    if (planType !== 'image' && planType !== 'svg_creation') return;
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
        if (forceSave) showLoading("Sauvegarde...");
        console.log(`Sauvegarde ${planType === 'image' ? 'auto annotations' : 'nouveau SVG'}...`);
        const dataToSave = getPlanAsJson();
        if (planType === 'image') {
            try {
                if (dataToSave?.backgroundImage) delete dataToSave.backgroundImage;
                const objectsPresent = dataToSave?.objects?.length > 0;
                await saveDrawingData(currentPlanId, objectsPresent ? dataToSave : null);
                if (forceSave) showToast("Annotations enregistrées.", "success");
            } catch (error) {
                showToast(`Erreur sauvegarde annotations: ${error.message}`, "danger");
            } finally {
                if (forceSave) hideLoading();
            }
        }
    }, forceSave ? 0 : 2500);
}

async function savePlanAsJson() {
    console.log("[savePlanAsJson] Début...");
    if (!currentPlanId) throw new Error("ID plan manquant.");
    const planData = getPlanAsJson();
    if (!planData || (!planData.objects?.length && !planData.backgroundImage)) throw new Error("Plan vide.");
    const planDataString = JSON.stringify(planData);
    if (!planDataString || planDataString === '{}') throw new Error("Erreur prépa données.");
    console.log("[savePlanAsJson] Appel API...");
    showLoading("Sauvegarde...");
    try {
        const result = await updateSvgPlan(currentPlanId, planDataString);
        console.log("[savePlanAsJson] Réponse API:", result);
        const actualResponse = (result?.success && typeof result.success === 'object') ? result.success : result;
        const apiSuccess = actualResponse?.success === true;
        const apiJsonPath = actualResponse?.json_path;
        const apiErrorMsg = actualResponse?.error;
        console.log("[savePlanAsJson] Vérif:", { apiSuccess, apiJsonPath, apiErrorMsg });
        if (apiSuccess && apiJsonPath && typeof apiJsonPath === 'string' && apiJsonPath.trim()) {
            planJsonUrl = apiJsonPath;
            console.log("[savePlanAsJson] URL màj:", planJsonUrl);
            showToast("Plan sauvegardé (JSON).", "success");
            showLoading("Rechargement...");
            setTimeout(() => window.location.reload(), 500);
        } else {
            const finalErrorMsg = apiErrorMsg || `Réponse invalide ou json_path manquant.`;
            console.warn("[savePlanAsJson] Échec validation:", { apiSuccess, apiJsonPath, apiErrorMsg });
            if (!apiSuccess) throw new Error(`Échec: ${finalErrorMsg}`);
            else showToast("Sauvegarde OK, mais réponse serveur incomplète.", "warning");
        }
        return result;
    } catch (error) {
        console.error("Erreur CATCH savePlanAsJson:", error);
        throw error;
    } finally {
        hideLoading();
        console.log("[savePlanAsJson] Fin.");
    }
}
// ===================================
// === OUTILS DESSIN (Styles, Groupe, Presse-papiers) ===
// ===================================
// (Fonctions updateDrawingStyleFromInput, setTransparentFillAndUpdate, updateDrawingStyleFromObject, updateGroupButtonStates INCHANGÉES)
function updateDrawingStyleFromInput() {
    const strokeColor = document.getElementById('stroke-color-picker')?.value || '#000000';
    const fillColorPicker = document.getElementById('fill-color-picker');
    const fillTransparentBtn = document.getElementById('fill-transparent-btn');
    const isFillActive = fillTransparentBtn?.classList.contains('active');
    const finalFill = isFillActive ? (fillColorPicker?.value || '#FFFFFF') : 'transparent';
    const strokeWidthInput = document.getElementById('stroke-width');
    const baseWidth = strokeWidthInput ? parseInt(strokeWidthInput.value, 10) : (fabricCanvas.getActiveObject()?.baseStrokeWidth || 2);
    const strokeWidth = baseWidth / fabricCanvas.getZoom();
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && !(activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText || activeObject.isGridLine)) {
        const updateProps = { stroke: strokeColor, fill: finalFill, strokeWidth, baseStrokeWidth: baseWidth };
        if (activeObject.type === 'activeSelection') {
            activeObject.forEachObject(obj => {
                if (!obj.isGridLine && !(obj.customData?.isGeoTag || obj.customData?.isPlacedText)) obj.set(updateProps);
            });
        } else { activeObject.set(updateProps); }
        fabricCanvas.requestRenderAll();
        triggerAutoSaveDrawing();
    }
}

function setTransparentFillAndUpdate() {
    const btn = document.getElementById('fill-transparent-btn');
    const icon = btn?.querySelector('i');
    const fillColorInput = document.getElementById('fill-color-picker');
    if (!btn || !icon || !fillColorInput) return;
    const currentlyActive = btn.classList.contains('active');
    btn.classList.toggle('active', !currentlyActive);
    if (!currentlyActive) {
        icon.className = 'bi bi-paint-bucket';
        fillColorInput.style.display = 'inline-block';
        btn.title = "Remplissage activé";
    } else {
        icon.className = 'bi bi-slash-circle';
        fillColorInput.style.display = 'none';
        btn.title = "Fond transparent";
    }
    updateDrawingStyleFromInput();
}

function updateDrawingStyleFromObject(target) {
    if (!target || target.customData?.isGeoTag || target.customData?.isPlacedText || target.isGridLine) return;
    const strokeColorPicker = document.getElementById('stroke-color-picker');
    const fillColorPicker = document.getElementById('fill-color-picker');
    const fillTransparentBtn = document.getElementById('fill-transparent-btn');
    const strokeWidthInput = document.getElementById('stroke-width');
    const btnIcon = fillTransparentBtn?.querySelector('i');
    if (strokeColorPicker) strokeColorPicker.value = target.stroke || '#000000';
    if (strokeWidthInput) strokeWidthInput.value = target.baseStrokeWidth || 2;
    const fill = target.fill;
    if (fill && fill !== 'transparent' && typeof fill === 'string') {
        if (fillColorPicker) { fillColorPicker.value = fill; fillColorPicker.style.display = 'inline-block'; }
        if (fillTransparentBtn) fillTransparentBtn.classList.add('active');
        if (btnIcon) btnIcon.className = 'bi bi-paint-bucket';
    } else {
        if (fillColorPicker) { fillColorPicker.value = '#FFFFFF'; fillColorPicker.style.display = 'none'; }
        if (fillTransparentBtn) fillTransparentBtn.classList.remove('active');
        if (btnIcon) btnIcon.className = 'bi bi-slash-circle';
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
            canGroup = objects.length > 1 && !objects.some(obj => obj.customData?.isGeoTag || obj.customData?.isPlacedText || obj.isGridLine);
        } else if (activeObject.type === 'group' && !(activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText)) {
            canUngroup = true;
        }
    }
    groupBtn.disabled = !canGroup;
    ungroupBtn.disabled = !canUngroup;
}
// ===================================
// === ASSETS ===
// ===================================
// (Fonction handleSaveAsset INCHANGÉE)
async function handleSaveAsset() {
    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject || activeObject.isGridLine || activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText) { showToast("Sélectionnez objets DESSINÉS/SVG.", "warning"); return; }
    if (activeObject.type === 'activeSelection' && activeObject.getObjects().some(obj => obj.isGridLine || obj.customData?.isGeoTag || obj.customData?.isPlacedText)) { showToast("Sélection contient non enregistrables.", "warning"); return; }
    const assetName = prompt("Nom asset:");
    if (!assetName?.trim()) { showToast("Nom invalide.", "info"); return; }
    showLoading("Sauvegarde asset...");
    try {
        activeObject.clone(async (cloned) => {
            const assetData = cloned.toObject(['customData', 'baseStrokeWidth']);
            try {
                await saveAsset(assetName.trim(), assetData);
                showToast(`Asset "${assetName.trim()}" enregistré!`, "success");
                if (document.getElementById('assetsOffcanvas')?.classList.contains('show')) loadAssetsList();
            } catch (apiError) { showToast(`Erreur: ${apiError.message}`, "danger"); } finally { hideLoading(); }
        }, ['customData', 'baseStrokeWidth']);
    } catch (cloneError) { showToast("Erreur prépa asset.", "danger"); hideLoading(); }
}

/**
 * Charge et affiche la liste des assets dans l'offcanvas.
 * Ajoute également les écouteurs pour charger et supprimer les assets.
 */
async function loadAssetsList() {
    const listContainer = document.getElementById('assets-list');
    if (!listContainer) {
        console.error("Élément #assets-list non trouvé.");
        return;
    }
    listContainer.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Chargement...</span></div> Chargement...';

    try {
        const assets = await listAssets(); // Appel API
        listContainer.innerHTML = ''; // Vide la liste

        if (!assets || assets.length === 0) {
            listContainer.innerHTML = '<p class="text-muted small">Aucun asset sauvegardé.</p>';
            return;
        }

        assets.forEach(asset => {
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';

            const assetLink = document.createElement('a');
            assetLink.href = '#';
            assetLink.className = 'asset-item flex-grow-1 text-decoration-none text-dark me-2';
            assetLink.dataset.assetId = asset.id;
            assetLink.textContent = asset.name;
            assetLink.title = `Charger "${asset.name}"`; // Tooltip

            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn btn-sm btn-outline-danger delete-asset-btn flex-shrink-0'; // flex-shrink-0 évite que le bouton rétrécisse
            deleteButton.dataset.assetId = asset.id;
            deleteButton.dataset.assetName = asset.name;
            deleteButton.title = `Supprimer "${asset.name}"`;
            deleteButton.innerHTML = '<i class="bi bi-trash"></i>';
            // Ajouter les attributs ARIA pour l'accessibilité
            deleteButton.setAttribute('aria-label', `Supprimer l'asset ${asset.name}`);


            item.appendChild(assetLink);
            item.appendChild(deleteButton);
            listContainer.appendChild(item);
        });

        // Attacher les écouteurs d'événements (délégués) une seule fois
        if (!listContainer.dataset.eventListenersAttached) {
            listContainer.addEventListener('click', handleAssetListClick);
            listContainer.dataset.eventListenersAttached = 'true';
        }

    } catch (error) {
        console.error("Erreur lors du chargement de la liste des assets:", error);
        listContainer.innerHTML = `<p class="text-danger small">Erreur lors du chargement: ${error.message}</p>`;
    }
}

/**
 * Gestionnaire d'événements délégué pour la liste des assets.
 * Gère le clic sur un lien d'asset (pour le charger) ou sur un bouton de suppression.
 * @param {Event} event
 */
async function handleAssetListClick(event) {
    const assetLink = event.target.closest('.asset-item');
    const deleteButton = event.target.closest('.delete-asset-btn');

    if (deleteButton) {
        // Clic sur le bouton Supprimer
        event.preventDefault();
        event.stopPropagation();
        handleDeleteAssetClick(deleteButton); // Appelle la fonction de suppression
    } else if (assetLink) {
        // Clic sur le lien pour charger l'asset
        event.preventDefault();
        handleAssetClick(assetLink); // Appelle la fonction de chargement (existante)
    }
}

/**
 * Gère le chargement d'un asset (fonction existante, potentiellement à déplacer si besoin).
 * @param {HTMLElement} assetLinkElement - L'élément <a> cliqué.
 */
async function handleAssetClick(assetLinkElement) {
    // Votre code existant pour handleAssetClick (avec la logique double enliven) va ici...
    // Assurez-vous qu'il utilise assetLinkElement.dataset.assetId
    const assetId = assetLinkElement.dataset.assetId;
    if (!assetId) return;

    console.log(`Chargement de l'asset ID: ${assetId}`);
    showLoading("Chargement de l'asset...");

    try {
        const asset = await getAssetData(assetId); // API call
        if (!asset || !asset.data) throw new Error("Données d'asset invalides reçues.");

        let assetDataObjectInitial;
        try {
            assetDataObjectInitial = JSON.parse(asset.data);
            console.log(`[ASSET ${assetId}] Données JSON brutes:`, JSON.parse(JSON.stringify(assetDataObjectInitial)));
        } catch (e) {
            throw new Error("Format de données d'asset corrompu.");
        }

        const fabricCanvas = getCanvasInstance(); // Obtenir l'instance du canvas
        if (!fabricCanvas) throw new Error("Instance du canvas non disponible.");

        // --- Logique Double Enliven ---
        await new Promise((resolveOuter, rejectOuter) => {
            fabric.util.enlivenObjects([assetDataObjectInitial], (tempObjects) => {
                if (!tempObjects || tempObjects.length === 0) return rejectOuter(new Error("Impossible de recréer l'objet (passe 1)."));
                const tempObject = tempObjects[0];
                const objectDataClean = tempObject.toObject(['customData', 'baseStrokeWidth']);
                objectDataClean.left = 0; objectDataClean.top = 0; objectDataClean.originX = 'left'; objectDataClean.originY = 'top';

                fabric.util.enlivenObjects([objectDataClean], (finalObjects) => {
                    if (!finalObjects || finalObjects.length === 0) return rejectOuter(new Error("Impossible de recréer l'objet final (passe 2)."));
                    const objectToAdd = finalObjects[0];
                    objectToAdd.name = asset.name;
                    objectToAdd.customData = { ...(objectDataClean.customData || {}), isDrawing: true };
                    objectToAdd.baseStrokeWidth = objectDataClean.baseStrokeWidth || 1;
                    const zoom = fabricCanvas.getZoom();
                    const applyStrokeWidth = (obj) => {
                         const baseStroke = obj.baseStrokeWidth || 1;
                         if (obj.strokeWidth !== undefined && obj.strokeWidth !== null && baseStroke > 0 && obj.stroke) {
                             obj.set('strokeWidth', Math.max(0.5 / zoom, baseStroke / zoom));
                         } else if (!obj.stroke) { obj.set('strokeWidth', 0); }
                    };
                    if (objectToAdd.type === 'group') { objectToAdd.forEachObject(applyStrokeWidth); if (objectToAdd.stroke) applyStrokeWidth(objectToAdd); }
                    else { applyStrokeWidth(objectToAdd); }
                    objectToAdd.set({ selectable: true, evented: true });

                    fabricCanvas.add(objectToAdd);
                    fabricCanvas.setActiveObject(objectToAdd);
                    objectToAdd.setCoords();
                    fabricCanvas.requestRenderAll();
                    // triggerAutoSaveDrawing(); // Déclencher la sauvegarde si nécessaire
                    showToast(`Asset "${objectToAdd.name || 'Sans nom'}" ajouté à (0,0).`, "success");

                    // Fermer l'offcanvas
                    const offcanvasEl = document.getElementById('assetsOffcanvas');
                    const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvasEl);
                    if (offcanvasInstance) offcanvasInstance.hide();

                    resolveOuter();
                }, ''); // Namespace vide pour enlivenObjects (passe 2)
            }, ''); // Namespace vide pour enlivenObjects (passe 1)
        }); // Fin Promise externe

    } catch (error) {
        console.error(`Erreur lors du chargement de l'asset ${assetId}:`, error);
        showToast(`Erreur chargement asset: ${error.message}`, 'danger');
    } finally {
        hideLoading();
    }
}

/**
 * Gestionnaire pour le clic sur le bouton de suppression d'un asset (déjà défini ci-dessus).
 * @param {HTMLElement} deleteButton - Le bouton cliqué.
 */
async function handleDeleteAssetClick(deleteButton) {
    // La logique est maintenant dans handleAssetListClick pour utiliser la délégation,
    // mais on garde cette fonction séparée pour la clarté si appelée directement ailleurs.
    const assetId = deleteButton.dataset.assetId;
    const assetName = deleteButton.dataset.assetName || 'cet asset';

    if (!assetId) {
        console.warn("handleDeleteAssetClick: ID d'asset manquant sur le bouton.");
        return;
    }

    if (!confirm(`Voulez-vous vraiment supprimer l'asset "${assetName}" ? Cette action est irréversible.`)) {
        return;
    }

    showLoading('Suppression de l\'asset...');
    try {
        await deleteAsset(assetId); // Appel API
        showToast(`Asset "${assetName}" supprimé avec succès.`, 'success');
        loadAssetsList(); // Recharge la liste pour refléter la suppression
    } catch (error) {
        console.error(`Erreur lors de la suppression de l'asset ${assetId}:`, error);
        showToast(`Erreur lors de la suppression: ${error.message}`, 'danger');
    } finally {
        hideLoading();
    }
}

// ===================================
// === UTILITAIRES UI (Boutons) ===
// ===================================
// --- MODIFIÉ : Suppression de isAssetPlacementMode ---
function updateDrawingToolButtons() {
    const currentTool = getCurrentDrawingTool();
    const isSelect = (currentTool === 'select'); // Simplifié

    document.querySelectorAll('#drawing-toolbar .tool-btn').forEach(btn => {
        const isActive = (btn.dataset.tool === currentTool); // Simplifié
        btn.classList.toggle('active', isActive);
    });

    fabricCanvas.defaultCursor = isSelect ? 'default' : 'crosshair'; // Simplifié
    fabricCanvas.hoverCursor = isSelect ? 'move' : 'crosshair'; // Simplifié
    fabricCanvas.selection = isSelect; // Simplifié

    // Mettre evented à true seulement si select Tool est actif
    // Sauf pour les tags géo qui restent toujours cliquables pour la toolbar
    const eventedStatus = isSelect;
    fabricCanvas.getObjects().forEach(obj => {
         if (!obj.isGridLine && !obj.isPageGuide) {
             if (obj.customData?.isGeoTag || obj.customData?.isPlacedText) {
                 obj.set({ selectable: isSelect, evented: true }); // Tags toujours evented
             } else {
                 obj.set({ selectable: isSelect, evented: eventedStatus }); // Dessins evented seulement si select
             }
         }
    });
}
// --- FIN MODIFICATION ---


function updateLockButtonState() {
    const lockBtn = document.getElementById('toggle-lock-svg-btn');
    if (!lockBtn) return;
    const isLocked = getCanvasLock();
    lockBtn.classList.toggle('active', isLocked);
    const btnText = lockBtn.querySelector('.btn-text');
    const btnIcon = lockBtn.querySelector('i');
    if (btnText) btnText.textContent = isLocked ? 'Verrouillé' : 'Déverrouillé';
    if (btnIcon) btnIcon.className = isLocked ? 'bi bi-lock-fill' : 'bi bi-unlock-fill';
}

// ===================================
// === CRÉATION ÉLÉMENTS INITIAUX ===
// ===================================
// (Fonctions createInitialGeoElements, placeTextOnSvg, placeTagAtPoint INCHANGÉES)
function createInitialGeoElements(placedGeoCodes, planType) {
    if (!fabricCanvas || !placedGeoCodes?.length) return;
    console.log(`Création ${placedGeoCodes.length} éléments géo...`);
    const elementsToCreate = [];
    placedGeoCodes.forEach(codeInfo => {
        codeInfo.placements?.forEach(placement => {
            if (placement.plan_id != currentPlanId) return;
            const elementData = { ...codeInfo, ...placement, id: codeInfo.id, position_id: placement.position_id };
            delete elementData.placements;
            if (placement.width === null && placement.height === null && planType === 'svg') {
                const targetSvgShape = findSvgShapeByCodeGeo(elementData.anchor_x);
                const textObject = placeTextOnSvg(elementData, targetSvgShape);
                if (textObject) elementsToCreate.push(textObject);
            } else if (elementData.pos_x !== null && elementData.pos_y !== null && planType === 'image') {
                const { left, top } = convertPercentToPixels(elementData.pos_x, elementData.pos_y, fabricCanvas);
                if (!isNaN(left) && !isNaN(top)) {
                    const tagObject = placeTagAtPoint(elementData, { x: left, y: top });
                    if (tagObject) elementsToCreate.push(tagObject);
                } else console.warn(`Coords invalides tag ${elementData.code_geo}`);
            }
        });
    });
    elementsToCreate.forEach(el => {
        fabricCanvas.add(el);
        if (el.customData?.isGeoTag && el.customData.anchorXPercent !== null) addArrowToTag(el);
    });
    console.log(`${elementsToCreate.length} éléments créés.`);
    fabricCanvas.requestRenderAll();
}

function placeTextOnSvg(codeData, targetSvgShape, clickPoint = null) {
    let textCoords, anchorId = null;
    if (targetSvgShape?.getCenterPoint) {
        textCoords = targetSvgShape.getCenterPoint();
        anchorId = targetSvgShape.customData?.svgId;
    } else if (clickPoint && !isNaN(clickPoint.x)) {
        textCoords = { x: clickPoint.x, y: clickPoint.y };
    } else if (codeData.pos_x !== null) {
        const { left, top } = convertPercentToPixels(codeData.pos_x, codeData.pos_y, fabricCanvas);
        if (!isNaN(left)) textCoords = { x: left, y: top };
        else { console.error(`Coords % invalides ${codeData.code_geo}`); return null; }
    } else { console.error(`Pas de coords ${codeData.code_geo}`); return null; }
    const textObject = new fabric.IText(codeData.code_geo || 'ERR', {
        left: textCoords.x, top: textCoords.y, originX: 'center', originY: 'center', fontSize: GEO_TEXT_FONT_SIZE, fill: '#000', stroke: '#FFF', paintFirst: 'stroke', strokeWidth: 0.5, baseStrokeWidth: 0.5, fontFamily: 'Arial', textAlign: 'center', fontWeight: 'bold', selectable: true, evented: true, hasControls: false, hasBorders: true, borderColor: '#007bff', cornerSize: 0, transparentCorners: true, lockRotation: true,
        customData: { ...codeData, isPlacedText: true, isGeoTag: false, anchorSvgId: anchorId, id: parseInt(codeData.id), position_id: codeData.position_id ? parseInt(codeData.position_id) : null, plan_id: parseInt(currentPlanId) }
    });
    return textObject;
}

function placeTagAtPoint(codeData, point) {
    if (!point || isNaN(point.x)) return null;
    const universColor = universColors[codeData.univers_nom] || codeData.univers_color || '#6c757d';
    const tagWidth = codeData.width || sizePresets.medium.width;
    const tagHeight = codeData.height || sizePresets.medium.height;
    const rect = new fabric.Rect({ width: tagWidth, height: tagHeight, fill: universColor, stroke: '#333', strokeWidth: 1, baseStrokeWidth: 1, originX: 'center', originY: 'center' });
    const text = new fabric.Text(codeData.code_geo || 'ERR', { fontSize: GEO_TAG_FONT_SIZE, fill: 'white', fontWeight: 'bold', fontFamily: 'Arial', originX: 'center', originY: 'center' });
    const group = new fabric.Group([rect, text], {
        left: point.x, top: point.y, originX: 'center', originY: 'center', selectable: true, evented: true, hasControls: false, hasBorders: true, borderColor: '#007bff', cornerSize: 0, transparentCorners: true, lockRotation: true, lockScalingX: true, lockScalingY: true, hoverCursor: 'move',
        customData: { ...codeData, isGeoTag: true, isPlacedText: false, id: parseInt(codeData.id), position_id: codeData.position_id ? parseInt(codeData.position_id) : null, plan_id: parseInt(currentPlanId), currentWidth: tagWidth, currentHeight: tagHeight, anchorXPercent: codeData.anchor_x, anchorYPercent: codeData.anchor_y }
    });
    return group;
}
// ===================================
// === GESTION CLIC CANVAS (Mode Placement Géo) ===
// ===================================
// (Fonction handleCanvasClick INCHANGÉE)
async function handleCanvasClick(options) {
    const mode = getCurrentDrawingTool();
    if (mode !== 'tag') return;
    const pointer = fabricCanvas.getPointer(options.e);
    const selectedCodeEl = document.querySelector('#dispo-list .list-group-item.active');
    if (!selectedCodeEl) { showToast("Aucun code dispo.", 'warning'); setActiveTool('select'); updateDrawingToolButtons(); return; }
    try {
        const codeData = JSON.parse(selectedCodeEl.dataset.codeData);
        let placedObject = null;
        const targetShape = options.target;
        const pointInCanvas = fabric.util.transformPoint(pointer, fabricCanvas.viewportTransform ? fabric.util.invertTransform(fabricCanvas.viewportTransform) : [1,0,0,1,0,0]);
        if (planType === 'svg') {
            const shapeToAnchor = (targetShape?.isSvgShape || targetShape?.group?.isSvgPlanGroup) ? (targetShape.isSvgShape ? targetShape : targetShape.group) : null;
            placedObject = placeTextOnSvg(codeData, shapeToAnchor, shapeToAnchor ? null : pointInCanvas);
        } else if (planType === 'image') {
            placedObject = placeTagAtPoint(codeData, pointInCanvas);
        }
        if (placedObject) {
            fabricCanvas.add(placedObject);
            fabricCanvas.setActiveObject(placedObject);
            placedObject.moveTo(999);
            fabricCanvas.requestRenderAll();
            await handleObjectPlaced(placedObject, codeData.id, pointInCanvas);
            setActiveTool('select');
            updateDrawingToolButtons();
            handleObjectDeselected();
        } else { showToast("Impossible créer objet.", "warning"); setActiveTool('select'); updateDrawingToolButtons(); }
    } catch (e) { console.error("Erreur placement:", e); showToast(`Erreur: ${e.message}`, "danger"); setActiveTool('select'); updateDrawingToolButtons(); }
}

// ===================================
// === DÉMARRAGE ===
// ===================================
// (Fonction DOMContentLoaded INCHANGÉE)
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Plan Editor v2 - DOMContentLoaded");
    try {
        const phpDataElement = document.getElementById('plan-data');
        const phpData = phpDataElement ? JSON.parse(phpDataElement.textContent || '{}') : (window.PHP_DATA || {});
        initialPlacedGeoCodes = phpData.placedGeoCodes || [];
        universColors = phpData.universColors || {};
        currentPlanId = phpData.currentPlanId;
        planType = phpData.planType;
        planUnivers = phpData.planUnivers || [];
        planJsonUrl = (phpData.currentPlan?.json_path) ? phpData.currentPlan.json_path : (phpData.planJsonUrl || null);
        if (phpData.currentPlan?.nom_fichier) {
            const baseUrl = 'uploads/plans/';
            if (planType === 'svg') planSvgUrl = baseUrl + phpData.currentPlan.nom_fichier;
            else if (planType === 'image') planImageUrl = baseUrl + phpData.currentPlan.nom_fichier;
        }
        if (!currentPlanId && planType !== 'svg_creation') throw new Error("ID Plan manquant.");
        if (!planType) throw new Error("Type Plan manquant.");
        console.log("Données init:", { currentPlanId, planType, planJsonUrl, planSvgUrl, planImageUrl });
    } catch (error) { console.error("Erreur PHP data:", error); showToast("Erreur critique init.", 'error'); return; }
    showLoading("Initialisation...");
    try {
        fabricCanvas = initializeCanvas('plan-canvas');
        if (!fabricCanvas) throw new Error("Init canvas Fabric échouée.");
        initializeSidebar(fabricCanvas, universColors, currentPlanId, planType, planUnivers);
        initializeDrawingTools(fabricCanvas);
        initializeGeoTags(fabricCanvas, universColors);
        initializeUI(fabricCanvas);
        let loadedSuccessfully = false;
        if (planJsonUrl && (planType === 'svg' || planType === 'image')) {
            console.log("Tentative chargement JSON:", planJsonUrl);
            showLoading("Chargement état sauvegardé...");
            try {
                const fullJsonUrl = planJsonUrl + '?t=' + new Date().getTime();
                const response = await fetch(fullJsonUrl);
                if (!response.ok) throw new Error(`Fetch JSON échoué (${response.status})`);
                const jsonData = await response.json();
                await new Promise((resolve) => {
                    fabricCanvas.clear();
                    fabricCanvas.loadFromJSON(jsonData, () => {
                        fabricCanvas.requestRenderAll();
                        console.log("Canvas chargé depuis JSON.");
                        createInitialGeoElements(initialPlacedGeoCodes, planType);
                        fabricCanvas.getObjects().forEach(obj => { if (obj.customData?.isGeoTag && obj.customData.anchorXPercent !== null) addArrowToTag(obj); });
                        if (planType === 'svg') setCanvasLock(true);
                        resolve();
                    });
                });
                loadedSuccessfully = true;
                console.log("Chargement JSON RÉUSSI.");
            } catch (jsonError) { console.warn("Erreur chargement JSON:", jsonError, "-> Fallback."); }
        } else console.log("Pas JSON ou type incompatible, chargement base.");
        if (!loadedSuccessfully && planType !== 'svg_creation') {
            console.log("Chargement fichier base...");
            showLoading("Chargement plan base...");
            try {
                if (planType === 'svg' && planSvgUrl) { await loadSvgPlan(planSvgUrl); setCanvasLock(true); createInitialGeoElements(initialPlacedGeoCodes, planType); loadedSuccessfully = true; }
                else if (planType === 'image' && planImageUrl) { await loadPlanImage(planImageUrl); createInitialGeoElements(initialPlacedGeoCodes, planType); loadedSuccessfully = true; }
            } catch (loadError) { console.error("Erreur chargement base:", loadError); showToast(`Erreur chargement: ${loadError.message}`, 'error'); }
        } else if (planType === 'svg_creation') { console.log("Mode création SVG."); loadedSuccessfully = true; }
        else if (loadedSuccessfully) console.log("Chargement JSON OK, skip base.");
        if (!loadedSuccessfully) { resizeCanvas(); showToast("Aucun plan chargé.", 'warning'); }
        setupEventListeners();
        await fetchAndClassifyCodes();
        const universSelectEl = document.getElementById('new-univers-id');
        if (universSelectEl) populateUniversSelectInModal(universSelectEl, planUnivers);
        const saveBtn = document.getElementById('save-new-code-btn'), addForm = document.getElementById('add-code-form'), addModalEl = document.getElementById('add-code-modal');
        const addModalInstance = addModalEl ? new bootstrap.Modal(addModalEl) : null;
        if (saveBtn && addForm && addModalInstance) {
            saveBtn.addEventListener('click', async () => {
                const success = await handleSaveNewCodeInModal(addForm, saveBtn, saveNewGeoCode);
                if (success) { addModalInstance.hide(); await fetchAndClassifyCodes(); }
            });
        }
        updateDrawingToolButtons();
        updateLockButtonState();
        updateGroupButtonStates();
    } catch (error) { console.error("Erreur majeure init:", error); showToast(`Erreur: ${error.message}`, 'error'); } finally { hideLoading(); resizeCanvas(); resetZoom(); console.log("Fin init."); }
});


/**
 * Attache les écouteurs d'événements principaux.
 */
function setupEventListeners() {
    if (!fabricCanvas) return;
    console.log("Attaching ALL event listeners...");
    fabricCanvas.on('mouse:down', handleMouseDown);
    fabricCanvas.on('mouse:move', handleMouseMove);
    fabricCanvas.on('mouse:up', handleMouseUp);
    fabricCanvas.on('object:moving', (options) => {
        if (getSnapToGrid()) {
            const target = options.target, gridSize = GRID_SIZE || 10;
            target.set({ left: Math.round(target.left / gridSize) * gridSize, top: Math.round(target.top / gridSize) * gridSize }).setCoords();
        }
        const t = options.target;
        if (t?.customData?.isGeoTag || t?.customData?.isPlacedText) showToolbar(t);
    });
    fabricCanvas.on('object:modified', (e) => {
        const t = e.target;
        if (t?.customData?.isGeoTag) handleGeoTagModified(t);
        else if (t?.customData?.isPlacedText) handleObjectMoved(t);
        else if (t && !t.isGridLine) triggerAutoSaveDrawing();
    });
    fabricCanvas.on('selection:created', (e) => handleSelectionChange(e.selected));
    fabricCanvas.on('selection:updated', (e) => handleSelectionChange(e.selected));
    fabricCanvas.on('selection:cleared', () => { handleObjectDeselected(); updateGroupButtonStates(); });
    fabricCanvas.on('viewport:transformed', () => {
        const z = fabricCanvas.getZoom(); updateGrid(z); updateStrokesWidth(z); drawPageGuides(currentPageSizeFormat);
        const a = fabricCanvas.getActiveObject(); if (a?.customData?.isGeoTag || a?.customData?.isPlacedText) showToolbar(a);
    });
    fabricCanvas.upperCanvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
        const i = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName), a = fabricCanvas.getActiveObject();
        if (e.key === 'Escape') {
            let h = false;
            // --- SUPPRIMÉ : Annuler placement asset ---
            // if (isAssetPlacementMode) { ... }
            if (getIsDrawingArrowMode?.()) { cancelArrowDrawing(); h = true; }
            if (getIsDrawing()) { stopDrawing(null, true); h = true; }
            if (getCurrentDrawingTool() !== 'select') { setActiveTool('select'); updateDrawingToolButtons(); h = true; } // Simplifié
            if (a) { fabricCanvas.discardActiveObject().renderAll(); handleObjectDeselected(); h = true; }
            if (h) e.preventDefault(); return;
        }
        if (i) return;
        if (e.ctrlKey || e.metaKey) {
            let h = true;
            switch (e.key.toLowerCase()) {
                case 'c': copyShape(); break; case 'v': pasteShape(); break;
                case 'g': if (a) e.shiftKey ? ungroupSelectedObject() : groupSelectedObjects(); break;
                case 'l': if (planType === 'svg') document.getElementById('toggle-lock-svg-btn')?.click(); break;
                default: h = false; break;
            }
            if (h) e.preventDefault();
        } else {
            let h = true;
            // --- SIMPLIFIÉ : Raccourcis outils toujours actifs ---
            switch (e.key) {
                case 'Delete': case 'Backspace': if (a) handleDeleteObject(a); break;
                case 'v': setActiveTool('select'); updateDrawingToolButtons(); break; case 'r': setActiveTool('rect'); updateDrawingToolButtons(); break;
                case 'l': setActiveTool('line'); updateDrawingToolButtons(); break; case 'c': setActiveTool('circle'); updateDrawingToolButtons(); break;
                case 't': setActiveTool('text'); updateDrawingToolButtons(); break;
                default: h = false; break;
            }
            // --- FIN SIMPLIFICATION ---
            if (h) e.preventDefault();
        }
        if (e.key === 'Alt') { if (!fabricCanvas.isDragging && !getIsDrawingArrowMode?.()) { fabricCanvas.defaultCursor = 'grab'; fabricCanvas.hoverCursor = 'grab'; fabricCanvas.requestRenderAll(); } e.preventDefault(); }
    });
    document.addEventListener('keyup', (e) => { if (e.key === 'Alt') { if (!fabricCanvas.isDragging) updateDrawingToolButtons(); } });

    // --- JQuery Listeners (Assurez-vous que JQuery est chargé) ---
    const zI = $('#zoom-in-btn'), zO = $('#zoom-out-btn'), zR = $('#zoom-reset-btn');
    const lB = $('#toggle-lock-svg-btn'), sDB = $('#save-drawing-btn'), sNS = $('#save-new-svg-plan-btn'), nPN = $('#new-plan-name');
    const tB = $('#drawing-toolbar .tool-btn');
    const sCP = $('#stroke-color-picker'), fCP = $('#fill-color-picker'), fTB = $('#fill-transparent-btn'), sWI = $('#stroke-width');
    const gT = $('#grid-toggle'), sT = $('#snap-toggle');
    const cB = $('#copy-btn'), pB = $('#paste-btn'), gB = $('#group-btn'), uB = $('#ungroup-btn');
    const sAB = $('#save-asset-btn'), aLC = $('#assets-list'), aOE = $('#assetsOffcanvas');
    const dB = $('#toolbar-delete');
    const pFS = $('#page-format-select');

    zI.on('click', () => zoomCanvas(1.2)); zO.on('click', () => zoomCanvas(0.8)); zR.on('click', resetZoom);
    if (lB.length) lB.on('click', () => { const c = getCanvasLock(); setCanvasLock(!c); updateLockButtonState(); });
    if (sDB.length) sDB.on('click', async () => { console.log("Clic Save, type:", planType); showLoading("Sauvegarde..."); try { if (planType === 'image' || planType === 'svg') { const r = await savePlanAsJson(); if (r?.success === true || r?.success?.success === true) { showLoading("Rechargement..."); window.location.reload(); } } } catch (e) { console.error("Erreur save:", e); showToast(`Erreur: ${e.message}`, "danger"); } finally { hideLoading(); } }); else console.warn("Btn #save-drawing-btn absent.");
    if (sNS.length && nPN.length) { sNS.on('click', async () => { const pN = nPN.val().trim(); const uCB = $('#univers-selector-modal input[name="univers_ids[]"]:checked'); const sUI = uCB.map((i, el) => $(el).val()).get(); if (!pN) { showToast("Nom requis.", "warning"); nPN.focus(); return; } if (sUI.length === 0) { showToast("Univers requis.", "warning"); return; } showLoading("Création..."); try { const sS = fabricCanvas.toSVG(['customData', 'baseStrokeWidth'], o => o.isGridLine ? null : o); const nP = await createSvgPlan(pN, sS, sUI); showToast(`Plan "${pN}" créé! Redirection...`, "success"); window.location.href = `index.php?action=manageCodes&id=${nP.plan_id}`; } catch (e) { console.error("Err créa SVG:", e); showToast(`Erreur: ${e.message}`, "danger"); } finally { hideLoading(); } }); } else if (planType === 'svg_creation') console.warn("UI sauvegarde nouveau SVG manquants.");
    tB.on('click', function() { /* SIMPLIFIÉ : Plus de check isAssetPlacementMode */ setActiveTool($(this).data('tool')); updateDrawingToolButtons(); });
    if (sWI.length) sWI.on('input', updateDrawingStyleFromInput);
    if (sCP.length) sCP.on('input', updateDrawingStyleFromInput);
    if (fCP.length) fCP.on('input', updateDrawingStyleFromInput);
    if (fTB.length) fTB.on('click', setTransparentFillAndUpdate);
    if (gT.length) gT.on('change', () => updateGrid(fabricCanvas.getZoom()));
    if (sT.length) sT.on('change', toggleSnapToGrid);
    if (cB.length) cB.on('click', copyShape);
    if (pB.length) pB.on('click', pasteShape);
    if (gB.length) gB.on('click', groupSelectedObjects);
    if (uB.length) uB.on('click', ungroupSelectedObject);
    if (sAB.length) sAB.on('click', handleSaveAsset);
    if (aOE.length) aOE.on('show.bs.offcanvas', loadAssetsList);
    if (aLC.length) aLC.on('click', '.asset-item', handleAssetClick); // Délégué
    if (dB.length) dB.on('click', () => handleDeleteObject(fabricCanvas.getActiveObject()));
    if (pFS.length) pFS.on('change', () => { currentPageSizeFormat = pFS.val(); drawPageGuides(currentPageSizeFormat); });
    console.log("jQuery listeners attachés.");
}
// Fin setupEventListeners


/**
 * Récupère l'état complet du canvas en JSON avec les propriétés personnalisées.
 */
// (Fonction getPlanAsJson INCHANGÉE)
function getPlanAsJson() {
    console.log("[getPlanAsJson] Début...");
    if (!fabricCanvas) { console.error("[getPlanAsJson] Erreur: canvas non init."); return null; }
    const props = [ 'type', 'originX', 'originY', 'left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'flipX', 'flipY', 'angle', 'skewX', 'skewY', 'stroke', 'strokeWidth', 'strokeDashArray', 'strokeLineCap', 'strokeLineJoin', 'strokeMiterLimit', 'fill', 'opacity', 'selectable', 'evented', 'visible', 'hasControls', 'hasBorders', 'borderColor', 'cornerColor', 'cornerSize', 'transparentCorners', 'lockMovementX', 'lockMovementY', 'lockRotation', 'lockScalingX', 'lockScalingY', 'lockSkewingX', 'lockSkewingY', 'lockUniScaling', 'radius', 'startAngle', 'endAngle', 'x1', 'y1', 'x2', 'y2', 'path', 'text', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'underline', 'overline', 'linethrough', 'textAlign', 'textBackgroundColor', 'charSpacing', 'lineHeight', 'src', 'crossOrigin', 'filters', 'objects', 'customData', 'isSvgShape', 'isGeoTag', 'isPlacedText', 'isDrawing', 'isDrawingShape', 'isUserText', 'isUserGroup', 'isSvgPlanGroup', 'baseStrokeWidth', 'isGridLine', 'isPageGuide' ];
    try {
        const objs = fabricCanvas.getObjects().filter(o => !o.isGridLine && !o.isPageGuide && o.excludeFromExport !== true);
        console.log(`[getPlanAsJson] Objets filtrés: ${objs.length}`);
        const tempCanvas = new fabric.StaticCanvas(null, { enableRetinaScaling: false });
        objs.forEach(o => tempCanvas.add(o));
        if (fabricCanvas.backgroundImage instanceof fabric.Image) tempCanvas.setBackgroundImage(fabricCanvas.backgroundImage, tempCanvas.renderAll.bind(tempCanvas));
        else tempCanvas.backgroundColor = fabricCanvas.backgroundColor;
        const json_data = tempCanvas.toObject(props);
        tempCanvas.dispose();
        if (!json_data) { console.error("[getPlanAsJson] Erreur: toObject a retourné null."); return null; }
        console.log(`[getPlanAsJson] Objets sérialisés: ${json_data.objects?.length || 0}`);
        return json_data;
    } catch (e) { console.error("[getPlanAsJson] Erreur sérialisation:", e); return null; }
}


/**
 * Extrait les données de position pour sauvegarde.
 */
// (Fonction getPositionDataFromObject INCHANGÉE)
function getPositionDataFromObject(fabricObject, clickPoint = null) {
    if (!fabricObject) { console.error("getPositionData: obj null."); return {}; }
    const isText = fabricObject.customData?.isPlacedText, isTag = fabricObject.customData?.isGeoTag;
    let refPoint = fabricObject.getCenterPoint ? fabricObject.getCenterPoint() : (clickPoint || { x: 0, y: 0 });
    const pixelWidth = fabricObject.getScaledWidth ? fabricObject.getScaledWidth() : (fabricObject.width || 0);
    const pixelHeight = fabricObject.getScaledHeight ? fabricObject.getScaledHeight() : (fabricObject.height || 0);
    let data = { pos_x: refPoint.x, pos_y: refPoint.y, anchor_x: null, anchor_y: null, width: pixelWidth, height: pixelHeight };
    if (planType === 'svg') {
        const { posX, posY } = convertPixelsToPercent(refPoint.x, refPoint.y, fabricCanvas);
        data.pos_x = posX; data.pos_y = posY;
        const pW = window.originalSvgWidth || fabricCanvas.getWidth(), pH = window.originalSvgHeight || fabricCanvas.getHeight();
        if (pW > 0 && pH > 0) { data.width = (pixelWidth / pW) * 100; data.height = (pixelHeight / pH) * 100; }
        else { console.error("getPositionData: Dims plan invalides."); data.width = 0; data.height = 0; }
    } else { data.pos_x = parseFloat(refPoint.x.toFixed(2)); data.pos_y = parseFloat(refPoint.y.toFixed(2)); data.width = Math.round(pixelWidth); data.height = Math.round(pixelHeight); }
    if (planType === 'svg' && fabricObject.customData?.anchorSvgId) { data.anchor_x = fabricObject.customData.anchorSvgId; data.anchor_y = null; data.width = null; data.height = null; }
    else if (fabricObject.customData?.anchorXPercent !== undefined && fabricObject.customData?.anchorYPercent !== undefined) { data.anchor_x = fabricObject.customData.anchorXPercent; data.anchor_y = fabricObject.customData.anchorYPercent; if (planType !== 'svg') { data.width = fabricObject.customData?.currentWidth || pixelWidth; data.height = fabricObject.customData?.currentHeight || pixelHeight; } }
    else { data.anchor_x = null; data.anchor_y = null; if (planType !== 'svg' && isTag) { data.width = fabricObject.customData?.currentWidth || pixelWidth; data.height = fabricObject.customData?.currentHeight || pixelHeight; } else if (planType === 'svg' && isText) { data.width = null; data.height = null; } }
    return data;
}

