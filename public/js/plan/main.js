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
    // Démarrer Pan si Alt pressé ou clic molette
    if (evt.altKey || options.button === 2) {
        startPan(evt);
        return;
    }
    // Gérer placement flèche
    if (getIsDrawingArrowMode && getIsDrawingArrowMode()) {
        handleArrowEndPoint(options); // Géré par geo-tags.js
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

    // Cas spécial : création de texte (se fait au clic simple, donc au MouseUp sans dessin)
    const currentTool = getCurrentDrawingTool();
    if (currentTool === 'text' && !getIsDrawing() && !options.target && options.e.type !== 'mouseout') {
        const textObject = stopDrawing(options); // stopDrawing gère la création de texte
        if (textObject) {
            handleDrawingComplete(textObject);
        }
    }
}

// ===================================
// === FONCTIONS PAN ===
// ===================================
function startPan(evt) {
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
    fabricCanvas.selection = (getCurrentDrawingTool() === 'select');
    fabricCanvas.defaultCursor = (getCurrentDrawingTool() === 'select') ? 'default' : 'crosshair';
    fabricCanvas.hoverCursor = (getCurrentDrawingTool() === 'select') ? 'move' : 'crosshair';
    fabricCanvas.getObjects().forEach(o => o.set('evented', true)); // Réactiver les événements
    fabricCanvas.requestRenderAll();
}

// ===================================
// === GESTION SÉLECTION ===
// ===================================
function handleSelectionChange(selectedItems) {
    if (!selectedItems || selectedItems.length === 0) {
        handleObjectDeselected();
        updateGroupButtonStates();
        return;
    }
    const activeSelection = fabricCanvas.getActiveObject();
    if (!activeSelection) return;

    if (activeSelection.type === 'activeSelection') {
        // Sélection multiple
        handleObjectDeselected(); // Cache toolbar géo, désélectionne sidebar
    } else {
        // Sélection unique
        const target = activeSelection;
        if (target.customData?.isGeoTag || target.customData?.isPlacedText) {
            // C'est un tag/texte géo
            showToolbar(target);
            handleObjectSelected(target); // Met en surbrillance dans la sidebar
        } else if (!target.isGridLine) {
            // C'est un dessin ou un SVG
            hideToolbar();
            handleObjectDeselected(); // Désélectionne la sidebar
            updateDrawingStyleFromObject(target); // Met à jour les pickers de couleur
        } else {
            hideToolbar(); // C'est la grille
        }
    }
    updateGroupButtonStates(); // Mettre à jour état boutons grouper/dégrouper
}

function handleObjectSelected(target) {
    const positionId = target.customData?.position_id;
    const geoCodeId = target.customData?.id;
    if (!positionId && !geoCodeId) return;

    // Active l'élément dans la liste "Placés"
    document.querySelectorAll('#placed-list .list-group-item').forEach(item => {
        const itemPositionIds = JSON.parse(item.dataset.positionIds || '[]');
        const matchesPosition = positionId && (item.dataset.positionId == positionId || itemPositionIds.includes(positionId));
        const matchesCodeId = item.dataset.id == geoCodeId;

        item.classList.toggle('active', matchesCodeId && (matchesPosition || !positionId));

        if (item.classList.contains('active')) {
            item.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    });
    // Désactive tout élément dans la liste "Disponibles"
    document.querySelectorAll('#dispo-list .list-group-item.active').forEach(el => el.classList.remove('active'));
}

function handleObjectDeselected() {
    // Désactive tout dans les deux listes
    document.querySelectorAll('#placed-list .list-group-item.active, #dispo-list .list-group-item.active').forEach(item => {
        item.classList.remove('active');
    });
    hideToolbar(); // Cache la toolbar flottante
}

// ===================================
// === CRUD GÉO (Placer, Déplacer, Supprimer) ===
// ===================================

async function handleObjectPlaced(fabricObject, geoCodeId, clickPoint) {
    console.log("--- handleObjectPlaced (Placement) ---");
    const {
        pos_x,
        pos_y,
        anchor_x,
        anchor_y,
        width,
        height
    } = getPositionDataFromObject(fabricObject, clickPoint);

    const positionData = {
        id: geoCodeId,
        plan_id: currentPlanId,
        code_geo: fabricObject.customData.code_geo,
        position_id: null,
        pos_x: pos_x,
        pos_y: pos_y,
        width: width,
        height: height,
        anchor_x: anchor_x,
        anchor_y: anchor_y
    };

    console.log("LOG 1 - Envoi des données:", positionData);
    showLoading('Sauvegarde position...');
    try {
        const savedPosition = await savePosition(positionData);
        console.log("LOG 2 - Réponse de savePosition (api.js):", savedPosition);

        if (savedPosition && typeof savedPosition.id !== 'undefined' && savedPosition.id !== null) {
            console.log("LOG 3 - ID de position reçu:", savedPosition.id);
            fabricObject.customData.position_id = parseInt(savedPosition.id, 10);
            fabricObject.customData.pos_x = savedPosition.pos_x;
            fabricObject.customData.pos_y = savedPosition.pos_y;
            fabricObject.customData.width = savedPosition.width;
            fabricObject.customData.height = savedPosition.height;
            fabricObject.customData.anchor_x = savedPosition.anchor_x;
            fabricObject.customData.anchor_y = savedPosition.anchor_y;
            console.log("LOG 6 - customData APRÈS placement et mise à jour:", JSON.parse(JSON.stringify(fabricObject.customData)));

            showToast(`Position ${positionData.code_geo || ''} sauvegardée.`, 'success');
            await fetchAndClassifyCodes(); // Rafraîchit les listes

        } else {
            console.error("LOG 4 - ÉCHEC: La sauvegarde n'a pas retourné d'ID de position valide.", savedPosition);
            fabricCanvas.remove(fabricObject);
            throw new Error("Impossible d'obtenir l'ID de la position sauvegardée.");
        }

    } catch (error) {
        console.error("LOG 5 - Erreur dans le CATCH de handleObjectPlaced:", error);
        showToast(`Échec sauvegarde: ${error.message}`, 'danger');
        if (fabricCanvas.contains(fabricObject)) {
            fabricCanvas.remove(fabricObject);
        }
    } finally {
        hideLoading();
    }
}

async function handleObjectMoved(target) {
    if (!target?.customData?.id) {
        return;
    }
    if (!target.customData.isPlacedText) {
        return;
    }

    const positionId = target.customData.position_id || null;
    const geoCodeId = target.customData.id;

    console.log(`[handleObjectMoved] LOG 7 - Déplacement objet. position_id lu: ${positionId}, geoCodeId: ${geoCodeId}`);

    if (!geoCodeId || !currentPlanId) {
        showToast("Erreur sauvegarde: ID du code ou du plan manquant.", "danger");
        return;
    }

    showLoading("Mise à jour position...");
    try {
        const {
            pos_x,
            pos_y,
            anchor_x,
            anchor_y,
            width,
            height
        } = getPositionDataFromObject(target);

        const positionData = {
            id: parseInt(geoCodeId, 10),
            plan_id: currentPlanId,
            position_id: positionId, // <<< Essentiel pour UPDATE
            pos_x: pos_x,
            pos_y: pos_y,
            width: width,
            height: height,
            anchor_x: anchor_x,
            anchor_y: anchor_y,
            code_geo: target.customData.code_geo
        };

        const updatedPosition = await savePosition(positionData);

        if (updatedPosition && updatedPosition.id) {
            target.customData.position_id = updatedPosition.id;
            target.customData.pos_x = updatedPosition.pos_x;
            target.customData.pos_y = updatedPosition.pos_y;
            showToast(`Position "${target.customData.code_geo}" màj.`, 'success');
            if (positionId === null) {
                await fetchAndClassifyCodes();
            } // Rafraîchit si c'était une création "ratée"
        } else {
            throw new Error("La réponse de l'API (savePosition) est invalide.");
        }

        target.setCoords();
        if (fabricCanvas.getActiveObject() === target) {
            showToolbar(target);
        }

    } catch (error) {
        console.error("[handleObjectMoved] Erreur CATCH:", error);
        showToast(`Échec màj: ${error.message}`, 'danger');
    } finally {
        hideLoading();
    }
}

async function handleDeleteObject(target) {
    console.log("handleDeleteObject appelée avec target:", target);

    if (!target) {
        target = fabricCanvas.getActiveObject();
        console.log("handleDeleteObject: target était null, activeObj trouvé:", target);
        if (!target) return;
    }

    if (target.type === 'activeSelection') {
        console.log("handleDeleteObject: Sélection multiple. Appel de deleteSelectedGeoElement.");
        await deleteSelectedGeoElement();
    } else if (target.customData?.isGeoTag || target.customData?.isPlacedText) {
        console.log("handleDeleteObject: Élément géo unique. Appel de deleteSelectedGeoElement.");
        await deleteSelectedGeoElement();
    } else if (!target.isGridLine && !target.isEditing) {
        console.log("handleDeleteObject: Dessin unique. Appel de deleteSelectedDrawingShape.");
        deleteSelectedDrawingShape();
        triggerAutoSaveDrawing(); // Sauvegarde auto après suppression dessin
    } else {
        console.log("handleDeleteObject: Cible non supprimable.", target);
    }
}

// ===================================
// === GESTION DESSIN (Fin, Sauvegarde) ===
// ===================================
function handleDrawingComplete(drawnObject) {
    if (!drawnObject) return;
    const mode = getCurrentDrawingTool();
    if (['rect', 'circle', 'line', 'text'].includes(mode)) {
        drawnObject.set({
            selectable: true,
            evented: true
        });
        triggerAutoSaveDrawing();
    }
}

function triggerAutoSaveDrawing(forceSave = false) {
    // Ne sauvegarde que si plan image OU si plan SVG_CREATION
    if (planType !== 'image' && planType !== 'svg_creation') return;

    clearTimeout(autoSaveTimeout);

    autoSaveTimeout = setTimeout(async () => {
        if (forceSave) showLoading("Sauvegarde...");
        console.log(`Sauvegarde ${planType === 'image' ? 'auto des annotations' : 'du nouveau plan SVG'}...`);

        const dataToSave = getPlanAsJson(); // Récupère TOUT le canvas (filtré)

        // Si plan image, on n'envoie que les annotations via saveDrawingData
        if (planType === 'image') {
            try {
                // S'assurer qu'on n'envoie pas le backgroundImage dans le JSON des annotations
                if (dataToSave && dataToSave.backgroundImage) delete dataToSave.backgroundImage;
                const objectsPresent = dataToSave && dataToSave.objects && dataToSave.objects.length > 0;
                await saveDrawingData(currentPlanId, objectsPresent ? dataToSave : null); // Envoyer null si vide
                if (forceSave) showToast("Annotations enregistrées.", "success");
            } catch (error) {
                showToast(`Erreur sauvegarde annotations: ${error.message}`, "danger");
            } finally {
                if (forceSave) hideLoading();
            }
        }
        // Si nouveau plan SVG, la sauvegarde se fait via le bouton dédié "Enregistrer Nouveau Plan SVG"
        // qui appelle createSvgPlan. On ne fait rien ici pour l'instant.
        // else if (planType === 'svg_creation') {
        // Optionnel : Sauvegarder l'état temporaire dans localStorage?
        // console.log("Sauvegarde auto pour nouveau SVG (non implémentée)");
        // }
    }, forceSave ? 0 : 2500);
}

// Obsolète
// async function saveModifiedSvgPlan() { ... }

/**
 * Sauvegarde l'état complet du canvas (y compris les groupes) en JSON.
 * Applicable aux plans 'image' et 'svg'.
 * CORRECTION : Vérification API Response + Logs + Gestion Réponse Imbriquée
 */
async function savePlanAsJson() {
    console.log("[savePlanAsJson] Début sauvegarde...");
    if (!currentPlanId) {
        console.error("[savePlanAsJson] Erreur: ID de plan manquant.");
        throw new Error("ID de plan manquant.");
    }
    console.log("[savePlanAsJson] Plan ID:", currentPlanId);

    const planData = getPlanAsJson();
    console.log("[savePlanAsJson] Données JSON brutes obtenues:", planData);

    if (!planData || (!planData.objects || planData.objects.length === 0) && !planData.backgroundImage) {
        console.warn("[savePlanAsJson] Le plan semble vide. Sauvegarde annulée.");
        throw new Error("Le plan est vide, sauvegarde annulée.");
    }

    const planDataString = JSON.stringify(planData);
    console.log("[savePlanAsJson] Données JSON stringifiées (début):", planDataString.substring(0, 200) + "...");

    if (!planDataString || planDataString === '{}') {
        console.error("[savePlanAsJson] Erreur: La chaîne JSON est vide ou invalide après stringify.");
        throw new Error("Erreur interne lors de la préparation des données de sauvegarde.");
    }

    console.log("[savePlanAsJson] Appel de updateSvgPlan API...");
    showLoading("Sauvegarde...");
    try {
        // 'updateSvgPlan' de api.js est appelée ici
        const result = await updateSvgPlan(currentPlanId, planDataString);
        console.log("[savePlanAsJson] Réponse BRUTE de l'API (avant vérif):", result); // Log Brut

        // *** CORRECTION pour gérer la réponse imbriquée potentielle ***
        let apiSuccess = false;
        let apiJsonPath = null;
        let apiErrorMsg = null;

        // Accéder à la réponse réelle, qu'elle soit dans 'result' ou encapsulée dans 'result.success'
        const actualResponse = (result && result.success && typeof result.success === 'object') ? result.success : result;

        // Cas 1: Succès
        if (actualResponse && actualResponse.success === true) {
            console.log("[savePlanAsJson] Réponse réussie (extraction).");
            apiSuccess = true;
            apiJsonPath = actualResponse.json_path;
            apiErrorMsg = actualResponse.error; // Au cas où
        }
        // Cas 2: Échec
        else {
            console.log("[savePlanAsJson] Réponse d'échec ou format inattendu détecté.");
            apiSuccess = false;
            apiJsonPath = null;
            // Essayer de trouver un message d'erreur
            apiErrorMsg = actualResponse?.error || 'Réponse API invalide ou format inconnu.';
        }

        console.log("[savePlanAsJson] Vérification après extraction:");
        console.log("[savePlanAsJson] apiSuccess:", apiSuccess);
        console.log("[savePlanAsJson] apiJsonPath:", apiJsonPath);
        console.log("[savePlanAsJson] typeof apiJsonPath:", typeof apiJsonPath);
        console.log("[savePlanAsJson] apiErrorMsg:", apiErrorMsg);

	// Condition de vérification robuste basée sur les variables extraites
        if (apiSuccess === true && apiJsonPath && typeof apiJsonPath === 'string' && apiJsonPath.trim() !== '') {
            // Succès ! Mettre à jour l'URL locale
            planJsonUrl = apiJsonPath; // Utiliser la valeur extraite
            console.log("[savePlanAsJson] URL JSON mise à jour avec succès:", planJsonUrl);
            showToast("Plan sauvegardé (JSON).", "success");

            // =====================================================================
            // === FIX: RECHARGEMENT IMMÉDIAT POUR ÉVITER LE CRASH DE RENDU ===
            // Nous rechargeons la page pour reconstruire le canevas à partir du JSON stable.
            showLoading("Sauvegarde réussie. Rechargement...");
            
            // Un petit délai pour que le toast de succès soit affiché avant la navigation
            setTimeout(() => {
                window.location.reload(); 
            }, 500);

        } else {
            // Échec ou réponse invalide
            const finalErrorMsg = apiErrorMsg || `Réponse API invalide ou json_path manquant/vide.`;
            console.warn("[savePlanAsJson] Échec de la validation de la réponse API. L'URL locale n'est pas mise à jour.", {
                apiSuccess,
                apiJsonPath,
                apiErrorMsg
            });
            if (apiSuccess !== true) { // Lancer une erreur seulement si success n'était pas true
                throw new Error(`Échec sauvegarde: ${finalErrorMsg}`);
            } else { // Cas: success=true mais json_path invalide
                showToast("Plan sauvegardé, mais réponse serveur incomplète (json_path manquant/invalide).", "warning");
            }
        }
        // *** FIN CORRECTION ***
        return result; // Retourne toujours la réponse BRUTE originale de l'API

    } catch (error) {
        console.error("Erreur dans CATCH savePlanAsJson:", error); // Log erreur catch
        throw error; // Relance l'erreur pour que le .finally se déclenche et l'UI soit notifiée
    } finally {
        hideLoading();
        console.log("[savePlanAsJson] Fin sauvegarde."); // Log fin
    }
}


// ===================================
// === OUTILS DESSIN (Styles, Groupe, Presse-papiers) ===
// ===================================

function updateDrawingStyleFromInput() {
    const strokeColor = document.getElementById('stroke-color-picker')?.value || '#000000';
    const fillColorPicker = document.getElementById('fill-color-picker');
    const fillTransparentBtn = document.getElementById('fill-transparent-btn');
    const isFillActive = fillTransparentBtn ? fillTransparentBtn.classList.contains('active') : false;
    const finalFill = isFillActive ? (fillColorPicker?.value || '#FFFFFF') : 'transparent';
    const strokeWidthInput = document.getElementById('stroke-width');
    const baseWidth = strokeWidthInput ? parseInt(strokeWidthInput.value, 10) : (fabricCanvas.getActiveObject()?.baseStrokeWidth || 2);
    const strokeWidth = baseWidth / fabricCanvas.getZoom();

    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && !(activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText || activeObject.isGridLine)) {
        const updateProps = {
            stroke: strokeColor,
            fill: finalFill,
            strokeWidth: strokeWidth,
            baseStrokeWidth: baseWidth
        };
        if (activeObject.type === 'activeSelection') {
            activeObject.forEachObject(obj => {
                if (!obj.isGridLine && !(obj.customData?.isGeoTag || obj.customData?.isPlacedText)) obj.set(updateProps);
            });
        } else {
            activeObject.set(updateProps);
        }
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
        btn.title = "Remplissage activé (cliquer pour rendre transparent)";
    } else {
        icon.className = 'bi bi-slash-circle';
        fillColorInput.style.display = 'none';
        btn.title = "Fond transparent (cliquer pour activer le remplissage)";
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
        if (fillColorPicker) {
            fillColorPicker.value = fill;
            fillColorPicker.style.display = 'inline-block';
        }
        if (fillTransparentBtn) fillTransparentBtn.classList.add('active');
        if (btnIcon) btnIcon.className = 'bi bi-paint-bucket';
    } else {
        if (fillColorPicker) {
            fillColorPicker.value = '#FFFFFF';
            fillColorPicker.style.display = 'none';
        }
        if (fillTransparentBtn) fillTransparentBtn.classList.remove('active');
        if (btnIcon) btnIcon.className = 'bi bi-slash-circle';
    }
}

function updateGroupButtonStates() {
    const groupBtn = document.getElementById('group-btn');
    const ungroupBtn = document.getElementById('ungroup-btn');
    if (!groupBtn || !ungroupBtn) return;

    const activeObject = fabricCanvas.getActiveObject();
    let canGroup = false,
        canUngroup = false;

    if (activeObject) {
        if (activeObject.type === 'activeSelection') {
            const objects = activeObject.getObjects();
            canGroup = objects.length > 1 && !objects.some(obj => obj.customData?.isGeoTag || obj.customData?.isPlacedText || obj.isGridLine);
        } else if (activeObject.type === 'group' && !(activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText)) {
            canUngroup = true; // OK pour userGroup ou svgPlanGroup
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
    if (!activeObject || activeObject.isGridLine || activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText) {
        showToast("Sélectionnez un ou plusieurs objets DESSINÉS ou SVG.", "warning");
        return;
    }
    if (activeObject.type === 'activeSelection' && activeObject.getObjects().some(obj => obj.isGridLine || obj.customData?.isGeoTag || obj.customData?.isPlacedText)) {
        showToast("La sélection contient des éléments non enregistrables.", "warning");
        return;
    }

    const assetName = prompt("Nom pour cet asset :");
    if (!assetName || assetName.trim() === '') {
        showToast("Nom invalide.", "info");
        return;
    }

    showLoading("Sauvegarde asset...");
    try {
        activeObject.clone(async (cloned) => {
            const assetData = cloned.toObject(['customData', 'baseStrokeWidth']);
            try {
                await saveAsset(assetName.trim(), assetData);
                showToast(`Asset "${assetName.trim()}" enregistré !`, "success");
                if (document.getElementById('assetsOffcanvas')?.classList.contains('show')) {
                    loadAssetsList();
                }
            } catch (apiError) {
                showToast(`Erreur sauvegarde asset: ${apiError.message}`, "danger");
            } finally {
                hideLoading();
            }
        }, ['customData', 'baseStrokeWidth']);
    } catch (cloneError) {
        showToast("Erreur préparation asset.", "danger");
        hideLoading();
    }
}

async function loadAssetsList() {
    const listContainer = document.getElementById('assets-list');
    if (!listContainer) return;
    listContainer.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Chargement...';
    try {
        const assets = await listAssets();
        listContainer.innerHTML = '';
        if (assets.length === 0) {
            listContainer.innerHTML = '<p class="text-muted small">Aucun asset.</p>';
            return;
        }
        assets.forEach(asset => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action asset-item';
            item.dataset.assetId = asset.id;
            item.textContent = asset.name;
            listContainer.appendChild(item);
        });
    } catch (error) {
        listContainer.innerHTML = '<p class="text-danger small">Erreur chargement.</p>';
    }
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
        const assetDataObject = JSON.parse(asset.data);

        fabric.util.enlivenObjects([assetDataObject], (objects) => {
            if (!objects || objects.length === 0) {
                throw new Error("Impossible de recréer.");
            }
            const objectToAdd = objects[0];
            const center = fabricCanvas.getVpCenter();
            objectToAdd.set({
                left: center.x,
                top: center.y,
                originX: 'center',
                originY: 'center',
                selectable: true,
                evented: true
            });
            objectToAdd.customData = {
                ...(assetDataObject.customData || {}),
                isDrawing: true
            };
            objectToAdd.baseStrokeWidth = assetDataObject.baseStrokeWidth || 1;
            const zoom = fabricCanvas.getZoom();
            const newStrokeWidth = (objectToAdd.baseStrokeWidth || 1) / zoom;
            objectToAdd.set('strokeWidth', newStrokeWidth);
            if (objectToAdd.type === 'group') {
                objectToAdd.forEachObject(obj => {
                    const objBaseStroke = obj.baseStrokeWidth || objectToAdd.baseStrokeWidth;
                    obj.set('strokeWidth', objBaseStroke / zoom);
                });
            }
            fabricCanvas.add(objectToAdd);
            fabricCanvas.setActiveObject(objectToAdd);
            objectToAdd.setCoords();
            fabricCanvas.requestRenderAll();
            showToast(`Asset "${asset.name}" ajouté.`, "success");
            bootstrap.Offcanvas.getInstance(document.getElementById('assetsOffcanvas'))?.hide();
            triggerAutoSaveDrawing();
        }, '');
    } catch (error) {
        showToast(`Erreur chargement asset: ${error.message}`, "danger");
    } finally {
        hideLoading();
    }
}

// ===================================
// === UTILITAIRES UI (Boutons) ===
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
    if (btnIcon) {
        btnIcon.className = isLocked ? 'bi bi-lock-fill' : 'bi bi-unlock-fill';
    }
}

// ===================================
// === CRÉATION ÉLÉMENTS INITIAUX ===
// ===================================
function createInitialGeoElements(placedGeoCodes, planType) {
    if (!fabricCanvas || !placedGeoCodes || placedGeoCodes.length === 0) {
        return;
    }
    console.log(`Création de ${placedGeoCodes.length} éléments géo...`);
    const elementsToCreate = [];

    placedGeoCodes.forEach(codeInfo => {
        if (codeInfo.placements && Array.isArray(codeInfo.placements)) {
            codeInfo.placements.forEach(placement => {
                if (placement.plan_id != currentPlanId) return;
                const elementData = {
                    ...codeInfo,
                    ...placement,
                    id: codeInfo.id,
                    position_id: placement.position_id
                };
                delete elementData.placements;

                if (placement.width === null && placement.height === null && planType === 'svg') {
                    const targetSvgShape = findSvgShapeByCodeGeo(elementData.anchor_x); // anchor_x contient l'ID SVG
                    const textObject = placeTextOnSvg(elementData, targetSvgShape);
                    if (textObject) elementsToCreate.push(textObject);
                } else if (elementData.pos_x !== null && elementData.pos_y !== null && planType === 'image') {
                    const {
                        left,
                        top
                    } = convertPercentToPixels(elementData.pos_x, elementData.pos_y, fabricCanvas);
                    if (!isNaN(left) && !isNaN(top)) {
                        const tagObject = placeTagAtPoint(elementData, {
                            x: left,
                            y: top
                        });
                        if (tagObject) elementsToCreate.push(tagObject);
                    } else {
                        console.warn(`Coords invalides pour tag ${elementData.code_geo}`);
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

function placeTextOnSvg(codeData, targetSvgShape, clickPoint = null) {
    let textCoords;
    let anchorId = null;

    if (targetSvgShape?.getCenterPoint) {
        textCoords = targetSvgShape.getCenterPoint();
        anchorId = targetSvgShape.customData?.svgId;
    } else if (clickPoint && !isNaN(clickPoint.x) && !isNaN(clickPoint.y)) {
        textCoords = {
            x: clickPoint.x,
            y: clickPoint.y
        };
    } else if (codeData.pos_x !== null && codeData.pos_y !== null) {
        const {
            left,
            top
        } = convertPercentToPixels(codeData.pos_x, codeData.pos_y, fabricCanvas);
        if (!isNaN(left) && !isNaN(top)) {
            textCoords = {
                x: left,
                y: top
            };
        } else {
            console.error(`Coords % invalides pour ${codeData.code_geo}`);
            return null;
        }
    } else {
        console.error(`Pas de coords pour ${codeData.code_geo}`);
        return null;
    }

    const textObject = new fabric.IText(codeData.code_geo || 'ERR', {
        left: textCoords.x,
        top: textCoords.y,
        originX: 'center',
        originY: 'center',
        fontSize: GEO_TEXT_FONT_SIZE,
        fill: '#000000',
        stroke: '#FFFFFF',
        paintFirst: 'stroke',
        strokeWidth: 0.5,
        baseStrokeWidth: 0.5,
        fontFamily: 'Arial',
        textAlign: 'center',
        fontWeight: 'bold',
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: true,
        borderColor: '#007bff',
        cornerSize: 0,
        transparentCorners: true,
        lockRotation: true,
        customData: {
            ...codeData,
            isPlacedText: true,
            isGeoTag: false,
            anchorSvgId: anchorId,
            id: parseInt(codeData.id, 10),
            position_id: codeData.position_id ? parseInt(codeData.position_id, 10) : null,
            plan_id: parseInt(currentPlanId, 10)
        }
    });
    return textObject;
}

function placeTagAtPoint(codeData, point) {
    if (!point || isNaN(point.x) || isNaN(point.y)) {
        return null;
    }
    const universColor = universColors[codeData.univers_nom] || codeData.univers_color || '#6c757d';
    const tagWidth = codeData.width || sizePresets.medium.width;
    const tagHeight = codeData.height || sizePresets.medium.height;
    const rect = new fabric.Rect({
        width: tagWidth,
        height: tagHeight,
        fill: universColor,
        stroke: '#333',
        strokeWidth: 1,
        baseStrokeWidth: 1,
        originX: 'center',
        originY: 'center'
    });
    const text = new fabric.Text(codeData.code_geo || 'ERR', {
        fontSize: GEO_TAG_FONT_SIZE,
        fill: 'white',
        fontWeight: 'bold',
        fontFamily: 'Arial',
        originX: 'center',
        originY: 'center'
    });
    const group = new fabric.Group([rect, text], {
        left: point.x,
        top: point.y,
        originX: 'center',
        originY: 'center',
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: true,
        borderColor: '#007bff',
        cornerSize: 0,
        transparentCorners: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hoverCursor: 'move',
        customData: {
            ...codeData,
            isGeoTag: true,
            isPlacedText: false,
            id: parseInt(codeData.id, 10),
            position_id: codeData.position_id ? parseInt(codeData.position_id, 10) : null,
            plan_id: parseInt(currentPlanId, 10),
            currentWidth: tagWidth,
            currentHeight: tagHeight,
            anchorXPercent: codeData.anchor_x,
            anchorYPercent: codeData.anchor_y
        }
    });
    return group;
}

// ===================================
// === GESTION CLIC CANVAS (Mode Placement Géo) ===
// ===================================

async function handleCanvasClick(options) {
    const mode = getCurrentDrawingTool();
    if (mode !== 'tag') return;

    const pointer = fabricCanvas.getPointer(options.e);
    const selectedCodeEl = document.querySelector('#dispo-list .list-group-item.active');
    if (!selectedCodeEl) {
        showToast("Aucun code dispo sélectionné.", 'warning');
        setActiveTool('select');
        updateDrawingToolButtons();
        return;
    }

    try {
        const codeData = JSON.parse(selectedCodeEl.dataset.codeData);
        let placedObject = null;
        const targetShape = options.target;

        if (planType === 'svg') {
            if (targetShape?.isSvgShape || targetShape?.group?.isSvgPlanGroup) {
                const shapeToAnchor = targetShape.isSvgShape ? targetShape : targetShape.group;
                placedObject = placeTextOnSvg(codeData, shapeToAnchor);
            } else {
                placedObject = placeTextOnSvg(codeData, null, pointer);
            }
        } else if (planType === 'image') {
            placedObject = placeTagAtPoint(codeData, pointer);
        }

        if (placedObject) {
            fabricCanvas.add(placedObject);
            fabricCanvas.setActiveObject(placedObject);
            placedObject.moveTo(999);
            fabricCanvas.requestRenderAll();
            await handleObjectPlaced(placedObject, codeData.id, pointer);
            setActiveTool('select');
            updateDrawingToolButtons();
            handleObjectDeselected();
        } else {
            showToast("Impossible de créer l'objet.", "warning");
            setActiveTool('select');
            updateDrawingToolButtons();
        }
    } catch (e) {
        console.error("Erreur placement:", e);
        showToast(`Erreur: ${e.message}`, "danger");
        setActiveTool('select');
        updateDrawingToolButtons();
    }
}

// ===================================
// === DÉMARRAGE ===
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Plan Editor v2 (Full + Corrections vFinal + Debug Save) - DOMContentLoaded"); // Version Log

    try {
        const phpDataElement = document.getElementById('plan-data');
        const phpData = phpDataElement ? JSON.parse(phpDataElement.textContent || '{}') : (window.PHP_DATA || {});
        initialPlacedGeoCodes = phpData.placedGeoCodes || [];
        universColors = phpData.universColors || {};
        currentPlanId = phpData.currentPlanId;
        planType = phpData.planType;
        planUnivers = phpData.planUnivers || [];
        planJsonUrl = phpData.planJsonUrl || null; // <<< URL JSON initial

        if (phpData.currentPlan && phpData.currentPlan.nom_fichier) {
            const baseUrl = 'uploads/plans/';
            if (planType === 'svg') {
                planSvgUrl = baseUrl + phpData.currentPlan.nom_fichier;
            } else if (planType === 'image') {
                planImageUrl = baseUrl + phpData.currentPlan.nom_fichier;
            }
        }
        if (!currentPlanId || !planType) {
            throw new Error("Données PHP essentielles manquantes.");
        }
        console.log("Données initiales:", phpData);
    } catch (error) {
        console.error("Erreur PHP data:", error);
        showToast("Erreur critique.", 'error');
        return;
    }

    showLoading("Initialisation...");
    try {
        fabricCanvas = initializeCanvas('plan-canvas');
        if (!fabricCanvas) {
            throw new Error("Init canvas Fabric échouée.");
        }
        console.log("Canvas initialisé.");

        initializeSidebar(fabricCanvas, universColors, currentPlanId, planType, planUnivers);
        initializeDrawingTools(fabricCanvas);
        initializeGeoTags(fabricCanvas, universColors);
        initializeUI(fabricCanvas);

        // --- Chargement du plan (MODIFIÉ pour JSON) ---
        let loadedSuccessfully = false; // Flag pour savoir si on a chargé qqchose

        // PRIORITÉ 1: Charger le JSON s'il existe
        if (planJsonUrl) {
            console.log("Chargement depuis l'état JSON:", planJsonUrl);
            showLoading("Chargement de l'état sauvegardé...");
            try {
                // Utiliser directement planJsonUrl car il devrait être relatif à 'public'
                const fullJsonUrl = planJsonUrl; // Ex: 'uploads/plans_json/plan_14_1761330487.json'
                const response = await fetch(fullJsonUrl + '?t=' + new Date().getTime()); // Ajouter timestamp anti-cache
                if (!response.ok) {
                    throw new Error(`Fetch JSON échoué (${response.status}) pour ${fullJsonUrl}`);
                }
                const jsonData = await response.json();


                await new Promise((resolve, reject) => {
                    fabricCanvas.loadFromJSON(jsonData, () => {
                        fabricCanvas.requestRenderAll();
                        console.log("Canvas chargé depuis JSON.");
                        if (planType === 'svg') {
                            setCanvasLock(true);
                        } // Verrouiller si SVG
                        fabricCanvas.getObjects().forEach(obj => { // Ré-attacher flèches
                            if (obj.customData?.isGeoTag && obj.customData.anchorXPercent !== null) {
                                addArrowToTag(obj);
                            }
                            // Défense Fabric.js: S'assurer que tous les objets ont des coordonnées valides
                            if (obj.setCoords) obj.setCoords();
                        });
                        // Défense Fabric.js: Nettoyer les éventuels objets null/undefined (cause de l'erreur 'reading x')
                        fabricCanvas._objects = fabricCanvas._objects.filter(o => o);
                        resolve();
                    }, (o, object) => { // Reviver
                        // Potentiellement nécessaire de réappliquer baseStrokeWidth ici si non sérialisé par toObject
                        if (object && o && o.baseStrokeWidth !== undefined) {
                            object.baseStrokeWidth = o.baseStrokeWidth;
                        }
                    });
                });
                loadedSuccessfully = true; // Chargement JSON réussi
            } catch (jsonError) {
                console.warn("Erreur chargement JSON:", jsonError, "Retour au chargement du fichier de base.");
                // Ne pas arrêter, continuer pour charger le fichier de base
            } finally {
                hideLoading(); // Cache loading après tentative JSON
            }
        }

        // PRIORITÉ 2: Charger le plan de base (si pas de JSON ou si échec JSON)
        if (!loadedSuccessfully) {
            showLoading("Chargement du plan..."); // Afficher loading si JSON a échoué
            try {
                if (planType === 'svg' && planSvgUrl) {
                    console.log("Chargement du SVG de base.");
                    await loadSvgPlan(planSvgUrl);
                    setCanvasLock(true);
                    createInitialGeoElements(initialPlacedGeoCodes, planType);
                    loadedSuccessfully = true;
                } else if (planType === 'image' && planImageUrl) {
                    console.log("Chargement de l'Image de base.");
                    await loadPlanImage(planImageUrl);
                    createInitialGeoElements(initialPlacedGeoCodes, planType);
                    loadedSuccessfully = true;
                } else if (planType === 'svg_creation') {
                    console.log("Mode création SVG.");
                    resizeCanvas();
                    loadedSuccessfully = true; // C'est un succès (canvas vide)
                }
            } catch (loadError) {
                console.error("Erreur chargement fichier de base:", loadError);
                showToast(`Erreur chargement: ${loadError.message}`, 'error');
                // Laisser le canvas vide
            } finally {
                hideLoading(); // Cache loading après tentative fichier de base
            }
        }

        // Si RIEN n'a été chargé (ni JSON, ni base), afficher message
        if (!loadedSuccessfully && planType !== 'svg_creation') {
            resizeCanvas(); // Assure que le canvas a une taille
            showToast("Aucun plan n'a pu être chargé.", 'warning');
        }

        // --- FIN CHARGEMENT PLAN ---

        setupEventListeners(); // Attacher les listeners

        // Charger listes sidebar (même si plan vide)
        await fetchAndClassifyCodes();

        // Config modale ajout code (inchangé)
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

        updateDrawingToolButtons();
        updateLockButtonState();
        updateGroupButtonStates(); // Màj état initial UI

    } catch (error) {
        console.error("Erreur init:", error);
        showToast(`Erreur: ${error.message}`, 'error');
    } finally {
        if (!fabricCanvas) hideLoading(); /* Ne cache pas si déjà caché */
        resizeCanvas();
        resetZoom();
        console.log("Fin init.");
    }
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
            /* ... magnétisme ... */ }
        const t = options.target;
        if (t?.customData?.isGeoTag || t?.customData?.isPlacedText) showToolbar(t);
    });
    fabricCanvas.on('object:modified', (e) => {
        const t = e.target;
        if (t?.customData?.isGeoTag) handleGeoTagModified(t);
        else if (t?.customData?.isPlacedText) handleObjectMoved(t);
        else if (t && !t.isGridLine) triggerAutoSaveDrawing();
    });
    fabricCanvas.on('selection:created', (e) => {
        handleSelectionChange(e.selected);
    });
    fabricCanvas.on('selection:updated', (e) => {
        handleSelectionChange(e.selected);
    });
    fabricCanvas.on('selection:cleared', (e) => {
        handleObjectDeselected();
        updateGroupButtonStates();
    });
    fabricCanvas.on('viewport:transformed', () => {
        const z = fabricCanvas.getZoom();
        updateGrid(z);
        updateStrokesWidth(z);
        const a = fabricCanvas.getActiveObject();
        if (a?.customData?.isGeoTag || a?.customData?.isPlacedText) showToolbar(a);
    });
    fabricCanvas.upperCanvasEl.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', (e) => {
        const i = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
        const a = fabricCanvas.getActiveObject();
        if (e.key === 'Escape') {
            let h = false;
            if (getIsDrawingArrowMode && getIsDrawingArrowMode()) {
                cancelArrowDrawing();
                h = true;
            }
            if (getIsDrawing()) {
                stopDrawing(null, true);
                h = true;
            }
            if (getCurrentDrawingTool() !== 'select') {
                setActiveTool('select');
                updateDrawingToolButtons();
                h = true;
            }
            if (a) {
                fabricCanvas.discardActiveObject().renderAll();
                handleObjectDeselected();
                h = true;
            }
            if (h) e.preventDefault();
            return;
        }
        if (i) return;
        if (e.ctrlKey || e.metaKey) {
            let h = true;
            switch (e.key.toLowerCase()) {
                case 'c':
                    copyShape();
                    break;
                case 'v':
                    pasteShape();
                    break;
                case 'g':
                    if (a) e.shiftKey ? ungroupSelectedObject() : groupSelectedObjects();
                    break;
                case 'l':
                    if (planType === 'svg') document.getElementById('toggle-lock-svg-btn')?.click();
                    break;
                default:
                    h = false;
                    break;
            }
            if (h) e.preventDefault();
        } else {
            let h = true;
            switch (e.key) {
                case 'Delete':
                case 'Backspace':
                    if (a) handleDeleteObject(a);
                    break;
                case 'v':
                    setActiveTool('select');
                    updateDrawingToolButtons();
                    break;
                case 'r':
                    setActiveTool('rect');
                    updateDrawingToolButtons();
                    break;
                case 'l':
                    setActiveTool('line');
                    updateDrawingToolButtons();
                    break;
                case 'c':
                    setActiveTool('circle');
                    updateDrawingToolButtons();
                    break;
                case 't':
                    setActiveTool('text');
                    updateDrawingToolButtons();
                    break;
                default:
                    h = false;
                    break;
            }
            if (h) e.preventDefault();
        }
        if (e.key === 'Alt') {
            if (!fabricCanvas.isDragging && !(getIsDrawingArrowMode && getIsDrawingArrowMode())) {
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
                fabricCanvas.defaultCursor = (getCurrentDrawingTool() === 'select') ? 'default' : 'crosshair';
                fabricCanvas.hoverCursor = (getCurrentDrawingTool() === 'select') ? 'move' : 'crosshair';
                fabricCanvas.requestRenderAll();
            }
        }
    });
    const zI = document.getElementById('zoom-in-btn'),
        zO = document.getElementById('zoom-out-btn'),
        zR = document.getElementById('zoom-reset-btn');
    const lB = document.getElementById('toggle-lock-svg-btn'),
        sDB = document.getElementById('save-drawing-btn'),
        sNS = document.getElementById('save-new-svg-plan-btn'),
        nPN = document.getElementById('new-plan-name');
    if (zI) zI.addEventListener('click', () => {
        zoomCanvas(1.2);
    });
    if (zO) zO.addEventListener('click', () => {
        zoomCanvas(0.8);
    });
    if (zR) zR.addEventListener('click', resetZoom);
    if (lB) lB.addEventListener('click', () => {
        const c = getCanvasLock();
        setCanvasLock(!c);
        updateLockButtonState();
    });
	if(sDB){ 
        sDB.addEventListener('click', async()=>{ 
            console.log("Clic Save, type:", planType); 
            showLoading("Sauvegarde..."); 
            try { 
                if (planType === 'image' || planType === 'svg') { 
                    console.log("Appel savePlanAsJson()..."); 
                    
                    // L'appel à savePlanAsJson inclut la stabilisation Fabric, mais nous allons forcer le rechargement
                    const saveResult = await savePlanAsJson(); 
                    
                    if (saveResult && saveResult.success === true) {
                        // 2 - Recharger la totalité du plan avec les nouvelles modifications
                        showLoading("Sauvegarde réussie. Rechargement...");
                        window.location.reload(); // Rechargement forcé de la page pour recharger le JSON
                    } else if (saveResult && saveResult.success && saveResult.success.success === true) { 
                         // Cas de la réponse imbriquée (comme vu dans le log: {success: {...}})
                         showLoading("Sauvegarde réussie. Rechargement...");
                         window.location.reload(); // Rechargement forcé de la page
                    } else {
                         // Gérer les cas où savePlanAsJson a géré le toast mais n'a pas lancé d'exception (e.g. timeout)
                         console.warn("SavePlanAsJson a terminé sans succès ou échec clair, pas de rechargement.");
                    }
                } 
            } catch(e){ 
                console.error("Erreur save:", e); 
                showToast(`Erreur: ${e.message}`, "danger"); 
            } finally { 
                hideLoading(); 
            } 
        }); 
    } else console.warn("Btn #save-drawing-btn absent.");
    if (sNS && nPN) {
        sNS.addEventListener('click', async () => {
            const pN = nPN.value.trim();
            const uCB = document.querySelectorAll('#univers-selector-modal input[name="univers_ids[]"]:checked');
            const sUI = Array.from(uCB).map(cb => cb.value);
            if (!pN) {
                showToast("Nom requis.", "warning");
                nPN.focus();
                return;
            }
            if (sUI.length === 0) {
                showToast("Univers requis.", "warning");
                return;
            }
            showLoading("Création...");
            try {
                const sS = fabricCanvas.toSVG(['customData', 'baseStrokeWidth'], o => o.isGridLine ? null : o);
                const nP = await createSvgPlan(pN, sS, sUI);
                showToast(`Plan "${pN}" créé! Redirection...`, "success");
                window.location.href = `index.php?action=manageCodes&id=${nP.plan_id}`;
            } catch (e) {
                console.error("Err créa SVG:", e);
                showToast(`Erreur: ${e.message}`, "danger");
            } finally {
                hideLoading();
            }
        });
    } else if (planType === 'svg_creation') console.warn("Btn #save-new-svg-plan-btn ou input #new-plan-name absent(s).");
    const tB = document.querySelectorAll('#drawing-toolbar .tool-btn');
    tB.forEach(b => b.addEventListener('click', () => {
        setActiveTool(b.dataset.tool);
        updateDrawingToolButtons();
    }));
    const sCP = document.getElementById('stroke-color-picker'),
        fCP = document.getElementById('fill-color-picker'),
        fTB = document.getElementById('fill-transparent-btn');
    const gT = document.getElementById('grid-toggle'),
        sT = document.getElementById('snap-toggle');
    const cB = document.getElementById('copy-btn'),
        pB = document.getElementById('paste-btn'),
        gB = document.getElementById('group-btn'),
        uB = document.getElementById('ungroup-btn');
    if (sCP) sCP.addEventListener('input', updateDrawingStyleFromInput);
    if (fCP) fCP.addEventListener('input', updateDrawingStyleFromInput);
    if (fTB) fTB.addEventListener('click', setTransparentFillAndUpdate);
    if (gT) gT.addEventListener('change', () => updateGrid(fabricCanvas.getZoom()));
    if (sT) sT.addEventListener('change', toggleSnapToGrid);
    if (cB) cB.addEventListener('click', copyShape);
    if (pB) pB.addEventListener('click', pasteShape);
    if (gB) gB.addEventListener('click', groupSelectedObjects);
    if (uB) uB.addEventListener('click', ungroupSelectedObject);
    const sAB = document.getElementById('save-asset-btn'),
        aLC = document.getElementById('assets-list'),
        aOE = document.getElementById('assetsOffcanvas');
    if (sAB) sAB.addEventListener('click', handleSaveAsset);
    if (aOE) aOE.addEventListener('show.bs.offcanvas', loadAssetsList);
    if (aLC) aLC.addEventListener('click', handleAssetClick);
    const dB = document.getElementById('toolbar-delete');
    if (dB) dB.addEventListener('click', () => {
        handleDeleteObject(fabricCanvas.getActiveObject());
    });
    const pFS = document.getElementById('page-format-select');
    if (pFS) pFS.addEventListener('change', () => {
        currentPageSizeFormat = pFS.value;
        drawPageGuides(currentPageSizeFormat);
    });
    console.log("All event listeners attached.");
}
// Fin setupEventListeners


/**
 * Récupère l'état complet du canvas en JSON avec les propriétés personnalisées.
 */
function getPlanAsJson() {
    console.log("[getPlanAsJson] Début récupération données JSON...");
    if (!fabricCanvas) {
        console.error("[getPlanAsJson] Erreur: fabricCanvas non initialisé.");
        return null;
    }
    // Liste exhaustive des propriétés standard ET personnalisées à inclure
    const propertiesToInclude = [
        // Standard Fabric properties
        'type', 'originX', 'originY', 'left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'flipX', 'flipY', 'angle', 'skewX', 'skewY',
        'stroke', 'strokeWidth', 'strokeDashArray', 'strokeLineCap', 'strokeLineJoin', 'strokeMiterLimit',
        'fill', 'opacity', 'selectable', 'evented', 'visible', 'hasControls', 'hasBorders', 'borderColor', 'cornerColor', 'cornerSize', 'transparentCorners',
        'lockMovementX', 'lockMovementY', 'lockRotation', 'lockScalingX', 'lockScalingY', 'lockSkewingX', 'lockSkewingY', 'lockUniScaling',
        // Type-specific properties
        'radius', 'startAngle', 'endAngle', // Circle, Ellipse
        'x1', 'y1', 'x2', 'y2', // Line
        'path', // Path
        'text', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'underline', 'overline', 'linethrough', 'textAlign', 'textBackgroundColor', 'charSpacing', 'lineHeight', // Text, IText
        'src', 'crossOrigin', 'filters', // Image
        'objects', // Group
        // Custom properties ajoutées dans CE projet
        'customData', // Object contenant id, position_id, code_geo, etc.
        'isSvgShape', // Marqueur pour forme issue d'un SVG importé (si dégroupé)
        'isGeoTag', // Marqueur pour groupe représentant un tag image
        'isPlacedText', // Marqueur pour texte représentant un tag SVG
        'isDrawing', // Marqueur générique pour objet dessiné (rect, circle, line, text libre)
        // Remplacé par isDrawingShape, isUserText pour plus de clarté? A voir.
        'isDrawingShape', // Marqueur pour forme dessinée (rect, circle, line, poly)
        'isUserText', // Marqueur pour texte libre ajouté par l'utilisateur
        'isUserGroup', // Marqueur pour groupe créé par l'utilisateur
        'isSvgPlanGroup', // Marqueur pour le groupe principal contenant le SVG importé
        'baseStrokeWidth', // Épaisseur de trait de base (indépendante du zoom)
        'isGridLine', // Marqueur pour lignes de grille (sera filtré)
        'isPageGuide' // Marqueur pour guide de page (sera filtré)
    ];

    try {
        const originalObjects = fabricCanvas.getObjects();
        console.log(`[getPlanAsJson] Objets AVANT filtrage: ${originalObjects.length}`);

        // Filtrer les objets non désirés (grille, guide) AVANT de sérialiser
        const objectsToSave = originalObjects.filter(obj => !obj.isGridLine && !obj.isPageGuide && obj.excludeFromExport !== true);
        console.log(`[getPlanAsJson] Objets APRÈS filtrage: ${objectsToSave.length}`);

        // Créer une copie temporaire du canvas SANS les objets filtrés pour utiliser toObject
        const tempCanvas = new fabric.StaticCanvas(null, {
            enableRetinaScaling: false
        }); // StaticCanvas suffit
        // Ajouter les objets à sauvegarder DANS LE MÊME ORDRE
        objectsToSave.forEach(obj => tempCanvas.add(obj));

        // Ajouter l'image de fond si elle existe (pour plans images)
        if (fabricCanvas.backgroundImage instanceof fabric.Image) {
            tempCanvas.setBackgroundImage(fabricCanvas.backgroundImage, tempCanvas.renderAll.bind(tempCanvas));
        } else {
            // Assurer que backgroundColor est sauvegardé (utile pour svg_creation ?)
            tempCanvas.backgroundColor = fabricCanvas.backgroundColor;
        }


        // Sérialiser le canvas temporaire
        const json_data = tempCanvas.toObject(propertiesToInclude);

        // Nettoyer le canvas temporaire (important pour libérer la mémoire)
        tempCanvas.dispose();

        // Vérification finale (json_data.objects devrait correspondre à objectsToSave)
        if (json_data && json_data.objects && json_data.objects.length !== objectsToSave.length) {
            console.warn(`[getPlanAsJson] Incohérence: ${objectsToSave.length} objets filtrés mais ${json_data.objects.length} objets sérialisés.`);
        } else if (!json_data) {
            console.error("[getPlanAsJson] Erreur: toObject a retourné null ou undefined.");
            return null;
        }

        console.log("[getPlanAsJson] Données JSON finales:", json_data);
        return json_data;
    } catch (error) {
        console.error("[getPlanAsJson] Erreur pendant la sérialisation:", error);
        return null;
    }
}

/**
 * Extrait les données de position pour sauvegarde.
 */
function getPositionDataFromObject(fabricObject, clickPoint = null) {
    if (!fabricObject) {
        console.error("getPositionDataFromObject: fabricObject est null.");
        return {};
    }
    const isText = fabricObject.customData?.isPlacedText;
    let refPoint;
    if (fabricObject.getCenterPoint) {
        refPoint = fabricObject.getCenterPoint();
    } else if (clickPoint) {
        refPoint = clickPoint;
    } else {
        console.error("getPositionDataFromObject: Point ref impossible.");
        refPoint = {
            x: 0,
            y: 0
        };
    }
    const pixelWidth = fabricObject.getScaledWidth ? fabricObject.getScaledWidth() : (fabricObject.width || 0);
    const pixelHeight = fabricObject.getScaledHeight ? fabricObject.getScaledHeight() : (fabricObject.height || 0);
    let data = {
        pos_x: refPoint.x,
        pos_y: refPoint.y,
        anchor_x: null,
        anchor_y: null,
        width: pixelWidth,
        height: pixelHeight
    };

    // Conversion en % SEULEMENT si planType est 'svg'
    if (planType === 'svg') {
        const percentPos = convertPixelsToPercent(refPoint.x, refPoint.y, fabricCanvas);
        data.pos_x = percentPos.posX;
        data.pos_y = percentPos.posY;
        const planWidth = window.originalSvgWidth || fabricCanvas.getWidth();
        const planHeight = window.originalSvgHeight || fabricCanvas.getHeight();
        if (planWidth > 0 && planHeight > 0) {
            data.width = (pixelWidth / planWidth) * 100;
            data.height = (pixelHeight / planHeight) * 100;
        } else {
            console.error("getPositionDataFromObject: Dims plan invalides.");
            data.width = 0;
            data.height = 0;
        }
    } else {
        // Pour les plans images, garder les pixels mais arrondir ?
        data.pos_x = parseFloat(refPoint.x.toFixed(2));
        data.pos_y = parseFloat(refPoint.y.toFixed(2));
        data.width = Math.round(pixelWidth);
        data.height = Math.round(pixelHeight);
    }
    // Anchor SVG (ID de la forme)
    if (planType === 'svg' && fabricObject.customData?.anchorSvgId) {
        data.anchor_x = fabricObject.customData.anchorSvgId;
        data.anchor_y = null; // Stocke l'ID SVG dans anchor_x
        data.width = null;
        data.height = null; // Ne pas sauvegarder w/h si ancré à un SVG
    }
    // Anchor pour flèche (position relative)
    else if (fabricObject.customData?.anchorXPercent !== undefined && fabricObject.customData?.anchorYPercent !== undefined) {
        data.anchor_x = fabricObject.customData.anchorXPercent;
        data.anchor_y = fabricObject.customData.anchorYPercent;
        // Garder w/h pour les tags images
        if (planType !== 'svg') {
            data.width = fabricObject.customData?.currentWidth || pixelWidth;
            data.height = fabricObject.customData?.currentHeight || pixelHeight;
        }
    } else {
        // Pas d'ancre spécifique
        data.anchor_x = null;
        data.anchor_y = null;
        // Garder w/h si tag image
        if (planType !== 'svg' && fabricObject.customData?.isGeoTag) {
            data.width = fabricObject.customData?.currentWidth || pixelWidth;
            data.height = fabricObject.customData?.currentHeight || pixelHeight;
        } else if (planType === 'svg' && fabricObject.customData?.isPlacedText) {
            // Pour texte SVG non ancré, ne pas sauvegarder w/h (implicite par police/texte)
            data.width = null;
            data.height = null;
        }
    }
    return data;
}
