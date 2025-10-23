// --- IMPORTS ---
import {
    initializeCanvas, loadSvgPlan, loadPlanImage,
    getCanvasInstance, resizeCanvas,
    resetZoom, setCanvasLock, getCanvasLock,
    findSvgShapeByCodeGeo, toggleSnapToGrid, getSnapToGrid,
    zoomCanvas, getCanvasDimensions,
    updateGrid, updateStrokesWidth,
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
    if (options.button === 3 || evt.ctrlKey) { return; }
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

    // --- CORRECTION : VÉRIFIER LE MODE TAG EN PREMIER ---
    const currentTool = getCurrentDrawingTool();
    if (currentTool === 'tag') {
        // Si on est en mode placement, on laisse handleCanvasClick gérer l'événement
        // qu'on ait cliqué sur un objet (target) ou sur le fond (null)
        handleCanvasClick(options);
        return; // Important: ne rien faire d'autre
    }
    // --- FIN CORRECTION ---

    // Si on n'est PAS en mode tag, continuer la logique normale :
    const target = options.target;
    
    // Si on clique sur un objet existant (et pas la grille)
    if (target && !target.isGridLine) {
        // C'est un clic de sélection normal, on ne fait rien ici
        // (géré par les événements 'selection:created', etc.)
        return;
    }

    // Si on clique sur le fond du canvas
    if (currentTool !== 'select') {
        startDrawing(options); // Démarrer dessin (rect, line, etc.)
    }
    else {
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
        // On pourrait mettre à jour les styles si tous les objets sont des dessins ?
    } else {
        // Sélection unique
        const target = activeSelection;
        if (target.customData?.isGeoTag || target.customData?.isPlacedText) {
            // C'est un tag/texte géo
            showToolbar(target);
            handleObjectSelected(target); // Met en surbrillance dans la sidebar
        }
        else if (!target.isGridLine) {
            // C'est un dessin ou un SVG
            hideToolbar();
            handleObjectDeselected(); // Désélectionne la sidebar
            updateDrawingStyleFromObject(target); // Met à jour les pickers de couleur
        }
        else {
            // C'est la grille (ne devrait pas arriver)
            hideToolbar();
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

        // Doit matcher l'ID du code géo ET (l'ID de position ou l'objet n'a pas d'ID de position)
        item.classList.toggle('active', matchesCodeId && (matchesPosition || !positionId));

        if (item.classList.contains('active')) {
             item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

/**
 * Gère la sauvegarde d'un objet (tag/texte) qui vient d'être placé.
 * @param {fabric.Object} fabricObject L'objet fabric qui a été ajouté/placé.
 * @param {number} geoCodeId L'ID du geo_code (passé depuis le clic ou drop).
 * @param {Object} clickPoint Point (x,y) du clic initial (pour fallback si objet n'a pas de centre).
 */
async function handleObjectPlaced(fabricObject, geoCodeId, clickPoint) {
    console.log("--- handleObjectPlaced (Placement) ---"); // LOG: main.js:322
    const {
        pos_x, pos_y, anchor_x, anchor_y, width, height
    } = getPositionDataFromObject(fabricObject, clickPoint);

    const positionData = {
        id: geoCodeId, // ID du code Géo (table geo_codes)
        plan_id: currentPlanId,
        code_geo: fabricObject.customData.code_geo, // Pour le message toast
        position_id: null, // C'est une NOUVELLE position
        pos_x: pos_x,
        pos_y: pos_y,
        width: width,
        height: height,
        anchor_x: anchor_x,
        anchor_y: anchor_y
    };

    console.log("LOG 1 - Envoi des données:", positionData); // LOG: main.js:324
    showLoading('Sauvegarde position...');
    try {
        const savedPosition = await savePosition(positionData); // Appel API
        console.log("LOG 2 - Réponse de savePosition (api.js):", savedPosition); // LOG: main.js:334

        // Vérifier si la réponse est valide
        if (savedPosition && typeof savedPosition.id !== 'undefined' && savedPosition.id !== null) {
            console.log("LOG 3 - ID de position reçu:", savedPosition.id); // LOG: main.js:342

            // =================================================================
            //
            // >>>>>>>>>>  CORRECTION CRUCIALE CI-DESSOUS  <<<<<<<<<<
            // C'est cette ligne qui stocke l'ID de la BDD dans l'objet
            // sur le canvas. Si elle manque, l'objet n'a pas
            // d'ID, et un déplacement créera un doublon.
            //
            fabricObject.customData.position_id = parseInt(savedPosition.id, 10);
            //
            // Mettre à jour aussi les autres données au cas où (arrondi serveur)
            fabricObject.customData.pos_x = savedPosition.pos_x;
            fabricObject.customData.pos_y = savedPosition.pos_y;
            fabricObject.customData.width = savedPosition.width;
            fabricObject.customData.height = savedPosition.height;
            fabricObject.customData.anchor_x = savedPosition.anchor_x;
            fabricObject.customData.anchor_y = savedPosition.anchor_y;
            //
            // Le log de vérification que nous cherchions :
            console.log("LOG 6 - customData APRÈS placement et mise à jour:", JSON.parse(JSON.stringify(fabricObject.customData)));
            //
            // =================================================================

            showToast(`Position ${positionData.code_geo || ''} sauvegardée.`, 'success');
            await fetchAndClassifyCodes(); // Rafraîchit les listes (déclenche les logs sidebar)

        } else {
            // L'API n'a pas renvoyé d'ID valide
            console.error("LOG 4 - ÉCHEC: La sauvegarde n'a pas retourné d'ID de position valide.", savedPosition);
            fabricCanvas.remove(fabricObject); // Supprimer l'objet du canvas !
            throw new Error("Impossible d'obtenir l'ID de la position sauvegardée.");
        }

    } catch (error) {
        console.error("LOG 5 - Erreur dans le CATCH de handleObjectPlaced:", error);
        showToast(`Échec sauvegarde: ${error.message}`, 'danger');
        // Assurer la suppression même si l'erreur vient d'ailleurs
        if (fabricCanvas.contains(fabricObject)) {
             fabricCanvas.remove(fabricObject);
        }
    } finally {
        hideLoading();
    }
}

/** Appelé lors du déplacement d'un TEXTE géo (plan SVG) */
async function handleObjectMoved(target) {
    if (!target?.customData?.id) { // On a juste besoin de l'ID du code géo pour commencer
        console.warn("handleObjectMoved: Cible ou customData.id manquant.");
        return;
    }
    
    // Cette fonction est pour les textes (isPlacedText).
    if (!target.customData.isPlacedText) {
        console.warn("handleObjectMoved appelé pour un non-texte.", target);
        return;
    }

    // Récupérer les IDs
    const positionId = target.customData.position_id || null; // Peut être null si l'objet a été chargé avec l'ancien bug
    const geoCodeId = target.customData.id;

    // --- LOG 7 (Vérification pour le déplacement) ---
    console.log(`[handleObjectMoved] LOG 7 - Déplacement objet. position_id lu: ${positionId}, geoCodeId: ${geoCodeId}`);

    if (!geoCodeId || !currentPlanId) {
        showToast("Erreur sauvegarde: ID du code ou du plan manquant.", "danger");
        return;
    }

    showLoading("Mise à jour position...");
    try {
        const center = target.getCenterPoint();
        const { posX, posY } = convertPixelsToPercent(center.x, center.y, fabricCanvas);

        // --- CORRECTION ---
        // Le position_id DOIT être DANS l'objet positionData
        const positionData = {
            id: parseInt(geoCodeId, 10),
            plan_id: currentPlanId,
            position_id: positionId, // <-- AJOUTÉ ICI
            pos_x: posX,
            pos_y: posY,
            width: null, 
            height: null,
            anchor_x: target.customData.anchorSvgId || null,
            anchor_y: null,
            code_geo: target.customData.code_geo // Pour le toast
        };
        // --- FIN CORRECTION ---

        // --- CORRECTION ---
        // L'appel API ne prend qu'UN SEUL argument
        const updatedPosition = await savePosition(positionData); 

        // Mettre à jour le customData de l'objet sur le canvas
        if (updatedPosition && updatedPosition.id) {
            target.customData.position_id = updatedPosition.id; // Assure que l'ID est à jour (surtout s'il était null)
            target.customData.pos_x = updatedPosition.pos_x;
            target.customData.pos_y = updatedPosition.pos_y;
            
            showToast(`Position "${target.customData.code_geo}" màj.`, 'success');
            
            // Rafraîchir la sidebar si l'objet vient d'être "fixé" (passant de null à un ID)
            if (positionId === null) {
                await fetchAndClassifyCodes();
            }
        } else {
             throw new Error("La réponse de l'API (savePosition) est invalide.");
        }
        
        target.setCoords();
        if (fabricCanvas.getActiveObject() === target) {
            showToolbar(target); // Garde la toolbar visible
        }

    } catch (error) {
        console.error("[handleObjectMoved] Erreur CATCH:", error);
        showToast(`Échec màj: ${error.message}`, 'danger');
    }
    finally {
        hideLoading();
    }
}

/** Fonction générique appelée par la toolbar ou le clavier pour supprimer */
async function handleDeleteObject(target) {
    console.log("handleDeleteObject appelée avec target:", target); // LOG existant

    if (!target) {
        const activeObj = fabricCanvas.getActiveObject();
        console.log("handleDeleteObject: target était null, activeObj trouvé:", activeObj); // LOG existant
        if (!activeObj) return;
        target = activeObj;
    }

    // --- CORRECTION ICI ---
    // Vérifier D'ABORD si c'est une sélection multiple
    if (target.type === 'activeSelection') {
        console.log("handleDeleteObject: C'est une sélection multiple ('activeSelection'). Appel de deleteSelectedGeoElement."); // NOUVEAU LOG
        // On suppose qu'une sélection multiple contient des éléments géo ou des dessins
        // deleteSelectedGeoElement saura faire le tri interne ou appeler deleteSelectedDrawingShape si besoin.
        await deleteSelectedGeoElement(); // Appel correct pour sélection multiple
    }
    // ENSUITE, vérifier si c'est un élément géo unique
    else if (target.customData?.isGeoTag || target.customData?.isPlacedText) {
        console.log("handleDeleteObject: C'est un élément géo unique. Appel de deleteSelectedGeoElement."); // LOG existant (modifié)
        await deleteSelectedGeoElement(); // Appel correct pour sélection simple géo
    }
    // SINON, vérifier si c'est un dessin unique
    else if (!target.isGridLine && !target.isEditing) {
        console.log("handleDeleteObject: C'est un dessin unique. Appel de deleteSelectedDrawingShape."); // LOG existant (modifié)
        deleteSelectedDrawingShape();
    }
    // Dernier cas : non supprimable
    else {
        console.log("handleDeleteObject: Cible non supprimable (grille, édition texte?).", target); // LOG existant
    }
    // --- FIN CORRECTION ---
}

// ===================================
// === GESTION DESSIN (Fin, Sauvegarde) ===
// ===================================
function handleDrawingComplete(drawnObject) {
    if (!drawnObject) return;
    const mode = getCurrentDrawingTool();
    if (['rect', 'circle', 'line', 'text'].includes(mode)) {
        drawnObject.set({ selectable: true, evented: true });
        triggerAutoSaveDrawing(); // Déclenche l'auto-sauvegarde (si plan image)
    }
}

/** Sauvegarde auto (pour plan image) avec debounce */
function triggerAutoSaveDrawing(forceSave = false) {
    // Ne sauvegarde que les annotations (dessins), pas les plans SVG
    if (planType !== 'image') return;

    clearTimeout(autoSaveTimeout); // Annule le timeout précédent

    autoSaveTimeout = setTimeout(async () => {
         if (forceSave) showLoading("Sauvegarde..."); // Montre un feedback si forcé
         console.log("Sauvegarde auto des annotations...");
         const drawingData = fabricCanvas.toJSON(['customData', 'selectable', 'evented', 'baseStrokeWidth']);
         // Filtre pour ne garder que les objets de dessin
         drawingData.objects = drawingData.objects.filter(obj =>
             !obj.isGridLine &&
             !(obj.customData?.isGeoTag || obj.customData?.isPlacedText) &&
             !obj.isSvgShape // Exclut aussi les formes SVG (même si non applicable pour plan 'image')
         );

         try {
             // Envoie les données (ou null si vide)
             await saveDrawingData(currentPlanId, drawingData.objects.length > 0 ? drawingData : null);
             if (forceSave) {
                 showToast("Annotations enregistrées.", "success");
             }
         } catch(error) {
             showToast(`Erreur sauvegarde annotations: ${error.message}`, "danger");
         } finally {
             if (forceSave) hideLoading(); // Cache le feedback si forcé
         }
    }, forceSave ? 0 : 2500); // 0ms si forcé, 2.5s sinon
}

/** Sauvegarde manuelle (pour plan SVG existant) */
async function saveModifiedSvgPlan() {
    if (planType !== 'svg' || !currentPlanId) { throw new Error("Non applicable"); }

    // Récupérer les dimensions originales si elles ont été stockées
    const viewBox = window.originalSvgViewBox || null; // Utilise 'window' pour variable globale simple
    const width = window.originalSvgWidth || null;
    const height = window.originalSvgHeight || null;

    // Si un format spécifique est choisi (et pas 'Original')
    if (currentPageSizeFormat !== 'Original' && PAGE_SIZES[currentPageSizeFormat]) {
        const selectedSize = PAGE_SIZES[currentPageSizeFormat];
        viewBox = selectedSize.viewBox;
        width = selectedSize.width;
        height = selectedSize.height;
        console.log(`Utilisation du format ${currentPageSizeFormat} pour la sauvegarde.`);
    } else {
        console.log("Utilisation des dimensions originales pour la sauvegarde.");
    }

    const options = {
        suppressPreamble: true, // Pour un SVG plus propre
        viewBox: viewBox,       // Tentative pour inclure le viewBox original
        width: width,           // Tentative pour inclure width original
        height: height          // Tentative pour inclure height original
    };

    // Exporte le canvas en SVG (sauf la grille), en passant les options
    const svgString = fabricCanvas.toSVG(
        ['customData', 'baseStrokeWidth'], // Propriétés à inclure
        obj => obj.isGridLine ? null : obj, // Fonction de filtrage
        options // Ajout des options ici
    );

    console.log("SVG généré avec options:", options); // Débogage
    console.log("SVG Début:", svgString.substring(0, 200)); // Débogage

    // Appel API (inchangé)
    await updateSvgPlan(currentPlanId, svgString);
}

// ===================================
// === OUTILS DESSIN (Styles, Groupe, Presse-papiers) ===
// ===================================

/** Met à jour le style de l'objet sélectionné depuis les pickers */
function updateDrawingStyleFromInput() {
    const strokeColor = document.getElementById('stroke-color-picker')?.value || '#000000';
    const fillColorPicker = document.getElementById('fill-color-picker');
    const fillTransparentBtn = document.getElementById('fill-transparent-btn');

    // 'active' = NON transparent
    const isFillActive = fillTransparentBtn ? fillTransparentBtn.classList.contains('active') : false;
    const finalFill = isFillActive ? (fillColorPicker?.value || '#FFFFFF') : 'transparent';

    // (Optionnel) Mettre à jour l'épaisseur
    const strokeWidthInput = document.getElementById('stroke-width'); // Assurez-vous que cet ID existe
    const baseWidth = strokeWidthInput ? parseInt(strokeWidthInput.value, 10) : (fabricCanvas.getActiveObject()?.baseStrokeWidth || 2);
    const strokeWidth = baseWidth / fabricCanvas.getZoom();


    const activeObject = fabricCanvas.getActiveObject();
    // Appliquer seulement aux objets de dessin ou SVG (pas aux tags géo/grille)
    if (activeObject && !(activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText || activeObject.isGridLine)) {

         const updateProps = {
             stroke: strokeColor,
             fill: finalFill,
             strokeWidth: strokeWidth,
             baseStrokeWidth: baseWidth
         };

         if (activeObject.type === 'activeSelection') {
             activeObject.forEachObject(obj => {
                 if (!obj.isGridLine && !(obj.customData?.isGeoTag || obj.customData?.isPlacedText)) {
                     obj.set(updateProps);
                 }
             });
         }
         else {
            activeObject.set(updateProps);
         }
         fabricCanvas.requestRenderAll();
         triggerAutoSaveDrawing(); // Sauvegarde auto si plan image
    }
}

/** Alterne le bouton de remplissage transparent */
function setTransparentFillAndUpdate() {
    const btn = document.getElementById('fill-transparent-btn');
    const icon = btn?.querySelector('i');
    const fillColorInput = document.getElementById('fill-color-picker');
    if (!btn || !icon || !fillColorInput) return;

    // 'active' signifie que le fond N'EST PAS transparent
    const currentlyActive = btn.classList.contains('active');
    btn.classList.toggle('active', !currentlyActive); // Inverse l'état

    if (!currentlyActive) { // Si on vient de rendre le fond NON transparent
        icon.className = 'bi bi-paint-bucket'; // Icône de pot de peinture
        fillColorInput.style.display = 'inline-block';
        btn.title = "Remplissage activé (cliquer pour rendre transparent)";
    } else { // Si on vient de rendre le fond transparent
        icon.className = 'bi bi-slash-circle'; // Icône barrée
        fillColorInput.style.display = 'none';
        btn.title = "Fond transparent (cliquer pour activer le remplissage)";
    }
    updateDrawingStyleFromInput(); // Appliquer le changement
}

/** Met à jour les pickers depuis le style de l'objet sélectionné */
function updateDrawingStyleFromObject(target) {
     if (!target || target.customData?.isGeoTag || target.customData?.isPlacedText || target.isGridLine) return;

     const strokeColorPicker = document.getElementById('stroke-color-picker');
     const fillColorPicker = document.getElementById('fill-color-picker');
     const fillTransparentBtn = document.getElementById('fill-transparent-btn');
     const strokeWidthInput = document.getElementById('stroke-width'); // Assurez-vous que cet ID existe
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
             fillColorPicker.value = '#FFFFFF'; // Reset
             fillColorPicker.style.display = 'none';
         }
         if (fillTransparentBtn) fillTransparentBtn.classList.remove('active');
         if (btnIcon) btnIcon.className = 'bi bi-slash-circle';
     }
}

/** Met à jour l'état des boutons Grouper/Dégrouper (CORRIGÉ) */
function updateGroupButtonStates() {
    const groupBtn = document.getElementById('group-btn');
    const ungroupBtn = document.getElementById('ungroup-btn');
    if (!groupBtn || !ungroupBtn) return;

    const activeObject = fabricCanvas.getActiveObject();
    let canGroup = false, canUngroup = false;

    if (activeObject) {
        if (activeObject.type === 'activeSelection') {
            const objects = activeObject.getObjects();
            // --- CORRECTION (pour autoriser groupement SVG) ---
            // Autorise le groupement tant qu'il n'y a pas de tag géo ou de grille
            // La vérification obj.isSvgShape a été retirée.
            canGroup = objects.length > 1 && !objects.some(obj => obj.customData?.isGeoTag || obj.customData?.isPlacedText || obj.isGridLine);
        } else if (activeObject.type === 'group' && !(activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText)) {
            // Autorise de dégrouper tout groupe qui n'est pas un tag géo
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
    // Vérification : objet sélectionné, pas grille, pas tag géo
    if (!activeObject || activeObject.isGridLine || activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText) {
        showToast("Sélectionnez un ou plusieurs objets DESSINÉS ou SVG.", "warning"); return;
    }
    // Vérification sélection multiple
    if (activeObject.type === 'activeSelection' && activeObject.getObjects().some(obj => obj.isGridLine || obj.customData?.isGeoTag || obj.customData?.isPlacedText)) {
        showToast("La sélection contient des éléments non enregistrables (tags géo, grille).", "warning"); return;
    }

    const assetName = prompt("Nom pour cet asset :");
    if (!assetName || assetName.trim() === '') {
        showToast("Nom invalide.", "info"); return;
    }

    showLoading("Sauvegarde asset...");
    try {
        // Clone l'objet/sélection
        activeObject.clone(async (cloned) => {
             // Convertit le clone en objet JSON
             const assetData = cloned.toObject(['customData', 'baseStrokeWidth']);
             try {
                // Envoie à l'API
                await saveAsset(assetName.trim(), assetData);
                showToast(`Asset "${assetName.trim()}" enregistré !`, "success");
                // Rafraîchit la liste si elle est ouverte
                if (document.getElementById('assetsOffcanvas')?.classList.contains('show')) {
                    loadAssetsList();
                }
             } catch (apiError) { showToast(`Erreur sauvegarde asset: ${apiError.message}`, "danger"); }
             finally { hideLoading(); }
        }, ['customData', 'baseStrokeWidth']); // Propriétés à cloner
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
        const assets = await listAssets(); // Appel API
        listContainer.innerHTML = ''; // Nettoie
        if (assets.length === 0) {
            listContainer.innerHTML = '<p class="text-muted small">Aucun asset.</p>'; return;
        }
        // Crée les liens
        assets.forEach(asset => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action asset-item';
            item.dataset.assetId = asset.id;
            item.textContent = asset.name;
            listContainer.appendChild(item);
        });
    } catch (error) {
        listContainer.innerHTML = '<p class="text-danger small">Erreur chargement des assets.</p>';
    }
}

async function handleAssetClick(event) {
     event.preventDefault();
     const assetItem = event.target.closest('.asset-item');
     if (!assetItem) return;

     const assetId = assetItem.dataset.assetId;
     showLoading("Chargement asset...");
     try {
        const asset = await getAssetData(assetId); // Appel API
        if (!asset || !asset.data) throw new Error("Données d'asset invalides.");

        const assetDataObject = asset.data; // Données JSON de l'objet Fabric

        // Recrée l'objet Fabric depuis les données JSON
        fabric.util.enlivenObjects([assetDataObject], (objects) => {
            if (!objects || objects.length === 0) { throw new Error("Impossible de recréer l'objet."); }
            const objectToAdd = objects[0];

            const center = fabricCanvas.getVpCenter(); // Centre de la vue
            objectToAdd.set({
                left: center.x,
                top: center.y,
                originX: 'center',
                originY: 'center',
                selectable: true,
                evented: true
            });
            objectToAdd.customData = { ...(assetDataObject.customData || {}), isDrawing: true }; // Marque comme dessin
            objectToAdd.baseStrokeWidth = assetDataObject.baseStrokeWidth || 1;

            // Applique le strokeWidth en fonction du zoom actuel
            const zoom = fabricCanvas.getZoom();
            const newStrokeWidth = (objectToAdd.baseStrokeWidth || 1) / zoom;
            objectToAdd.set('strokeWidth', newStrokeWidth);
            // Si c'est un groupe, applique aux enfants aussi
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
            // Ferme l'offcanvas
            bootstrap.Offcanvas.getInstance(document.getElementById('assetsOffcanvas'))?.hide();
            triggerAutoSaveDrawing(); // Sauvegarde auto (plan image)

        }, ''); // Namespace vide
     } catch (error) {
        showToast(`Erreur chargement asset: ${error.message}`, "danger");
     }
     finally {
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
        // codeInfo = données du géo_code (id, code_geo, univers...)
        if (codeInfo.placements && Array.isArray(codeInfo.placements)) {
            // placements = array des positions (pos_x, pos_y, plan_id, id de position...)
            codeInfo.placements.forEach(placement => {
                // Ne placer que ceux de ce plan
                if (placement.plan_id != currentPlanId) return;

                // Fusionne les infos du code et de son placement
		const elementData = { ...codeInfo, ...placement, id: codeInfo.id, position_id: placement.position_id };
                delete elementData.placements; // Nettoyage

                // Cas 1: Texte sur plan SVG (pas de width/height)
                if (placement.width === null && placement.height === null) {
                    if (planType === 'svg') {
                        // Tente de trouver la forme SVG ancrée
                        const targetSvgShape = findSvgShapeByCodeGeo(elementData.anchor_x);
                        const textObject = placeTextOnSvg(elementData, targetSvgShape);
                        if (textObject) elementsToCreate.push(textObject);
                    }
                }
                // Cas 2: Tag sur plan Image (avec pos_x/pos_y)
                else if (elementData.pos_x !== null && elementData.pos_y !== null) {
                     if (planType === 'image') {
                        // Convertit % en pixels
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

    // Ajoute tous les objets créés au canvas
    elementsToCreate.forEach(el => {
        fabricCanvas.add(el);
        // Si c'est un tag avec une ancre, dessine la flèche
        if (el.customData?.isGeoTag && el.customData.anchorXPercent !== null && el.customData.anchorYPercent !== null) {
            addArrowToTag(el); // Géré par geo-tags.js
        }
    });
    console.log(`${elementsToCreate.length} éléments géo créés sur le canvas.`);
    fabricCanvas.requestRenderAll();
}

/** Crée un objet Texte pour plan SVG */
// Ajout du paramètre optionnel 'clickPoint'
function placeTextOnSvg(codeData, targetSvgShape, clickPoint = null) {
    let textCoords;
    let anchorId = null; // ID de la forme SVG

    // Priorité : Ancrage à la forme SVG si fournie
    if (targetSvgShape?.getCenterPoint) {
        textCoords = targetSvgShape.getCenterPoint();
        anchorId = targetSvgShape.customData?.svgId; // L'ID SVG de la forme
    }
    // Sinon, utiliser le point de clic s'il est fourni
    else if (clickPoint && !isNaN(clickPoint.x) && !isNaN(clickPoint.y)) {
        textCoords = { x: clickPoint.x, y: clickPoint.y };
        console.log(`Placement texte ${codeData.code_geo} au point de clic`);
    }
    // Fallback (si ni forme ni clic, devrait être rare maintenant)
    else if (codeData.pos_x !== null && codeData.pos_y !== null) {
        const { left, top } = convertPercentToPixels(codeData.pos_x, codeData.pos_y, fabricCanvas);
        if (!isNaN(left) && !isNaN(top)) {
            textCoords = { x: left, y: top };
            console.warn(`Placement texte ${codeData.code_geo} par fallback % (pas de forme/clic)`);
        }
        else { console.error(`Coords invalides pour ${codeData.code_geo}`); return null; }
    } else {
        // Pas de coordonnées
        console.error(`Impossible de déterminer les coords pour ${codeData.code_geo}`);
        return null;
    }

    // Création de l'objet texte (inchangé)
    const textObject = new fabric.IText(codeData.code_geo || 'ERR', {
        left: textCoords.x, top: textCoords.y,
        originX: 'center', originY: 'center',
        fontSize: GEO_TEXT_FONT_SIZE, // Assurez-vous que cette constante est définie
        fill: '#000000', stroke: '#FFFFFF', paintFirst: 'stroke',
        strokeWidth: 0.5, baseStrokeWidth: 0.5,
        fontFamily: 'Arial', textAlign: 'center', fontWeight: 'bold',
        selectable: true, evented: true,
        hasControls: false, hasBorders: true, borderColor: '#007bff',
        cornerSize: 0, transparentCorners: true, lockRotation: true,
        customData: {
            ...codeData,
            isPlacedText: true, isGeoTag: false,
            anchorSvgId: anchorId, // ID de la forme SVG (ou null si placé au clic)
            id: parseInt(codeData.id, 10), // ID du GéoCode
            position_id: codeData.position_id ? parseInt(codeData.position_id, 10) : null, // ID de la Position
            plan_id: parseInt(currentPlanId, 10)
        }
    });
    return textObject;
}

/** Crée un objet Tag (Groupe) pour plan Image */
function placeTagAtPoint(codeData, point) {
    if (!point || isNaN(point.x) || isNaN(point.y)) { return null; }

    const universColor = universColors[codeData.univers_nom] || codeData.univers_color ||'#6c757d';
    const tagWidth = codeData.width || sizePresets.medium.width;
    const tagHeight = codeData.height || sizePresets.medium.height;

    const rect = new fabric.Rect({
        width: tagWidth, height: tagHeight,
        fill: universColor, stroke: '#333',
        strokeWidth: 1, baseStrokeWidth: 1,
        originX: 'center', originY: 'center'
    });
    const text = new fabric.Text(codeData.code_geo || 'ERR', {
        fontSize: GEO_TAG_FONT_SIZE,
        fill: 'white', fontWeight: 'bold',
        fontFamily: 'Arial',
        originX: 'center', originY: 'center'
    });

    const group = new fabric.Group([rect, text], {
        left: point.x, top: point.y,
        originX: 'center', originY: 'center',
        selectable: true, evented: true,
        hasControls: false, hasBorders: true, borderColor: '#007bff',
        cornerSize: 0, transparentCorners: true, lockRotation: true,
        lockScalingX: true, lockScalingY: true, // Tags ont taille fixe (S,M,L)
        hoverCursor: 'move',
        customData: {
            ...codeData,
            isGeoTag: true, isPlacedText: false,
            id: parseInt(codeData.id, 10), // ID du GéoCode
            position_id: codeData.position_id ? parseInt(codeData.position_id, 10) : null, // ID de la Position
            plan_id: parseInt(currentPlanId, 10),
            currentWidth: tagWidth, currentHeight: tagHeight,
            anchorXPercent: codeData.anchor_x, // % ancre flèche
            anchorYPercent: codeData.anchor_y  // % ancre flèche
        }
    });
    return group;
}

// ===================================
// === GESTION CLIC CANVAS (Mode Placement Géo) ===
// ===================================

/** Gère le clic sur le canvas en mode 'tag' (placement) */
async function handleCanvasClick(options) {
    const mode = getCurrentDrawingTool();
    if (mode !== 'tag') return; // Sécurité

    const pointer = fabricCanvas.getPointer(options.e); // Coordonnées du clic
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
        const targetShape = options.target; // L'objet cliqué (peut être null)

        // --- CORRECTION LOGIQUE SVG ---
        if (planType === 'svg') {
            // Cas 1: Clic sur une forme SVG existante -> Ancrer le texte à la forme
            if (targetShape?.isSvgShape) {
                console.log("Placement sur forme SVG:", targetShape.customData?.svgId || targetShape);
                placedObject = placeTextOnSvg(codeData, targetShape); // Utilise le centre de la forme
            }
            // Cas 2: Clic sur le fond ou sur une forme DESSINÉE -> Placer au point cliqué
            else {
                console.log("Placement SVG au point cliqué (pas sur forme SVG de base).");
                // On appelle placeTextOnSvg SANS targetShape.
                // Il utilisera les coordonnées du clic (via pointer) comme fallback.
                // Note: placeTextOnSvg doit être capable de gérer targetSvgShape = null
                 placedObject = placeTextOnSvg(codeData, null, pointer); // Ajout de 'pointer'
            }
        // --- FIN CORRECTION LOGIQUE SVG ---

        } else if (planType === 'image') {
            // Place le tag au point cliqué
            placedObject = placeTagAtPoint(codeData, pointer);
        }

        if (placedObject) {
             fabricCanvas.add(placedObject);
             fabricCanvas.setActiveObject(placedObject);
             placedObject.moveTo(999); // Au premier plan
             fabricCanvas.requestRenderAll();
             // Sauvegarde la position (handleObjectPlaced utilise le centre de l'objet ou le point de clic)
             await handleObjectPlaced(placedObject, codeData.id, pointer); // Passe le point de clic
             // Après placement réussi, repasse en mode sélection
             setActiveTool('select');
             updateDrawingToolButtons();
             handleObjectDeselected(); // Désélectionne dans la sidebar
        } else {
             // Si échec création objet
             showToast("Impossible de créer l'objet à placer.", "warning");
             setActiveTool('select');
             updateDrawingToolButtons();
        }
    } catch (e) {
        console.error("Erreur lors du placement:", e);
        showToast(`Erreur placement: ${e.message}`, "danger");
        setActiveTool('select'); // Revenir à l'outil sélection en cas d'erreur
        updateDrawingToolButtons();
    }
    // Note: Le retour en mode 'select' est maintenant géré dans le 'if (placedObject)' et le 'catch'
}

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
        if (planType === 'svg' && planSvgUrl) {
            await loadSvgPlan(planSvgUrl);
            setCanvasLock(true); // Verrouiller par défaut
        }
        else if (planType === 'image' && planImageUrl) {
            await loadPlanImage(planImageUrl);
            // Pas de verrouillage pour les plans images
        }
        else if (planType === 'svg_creation'){
            console.log("Mode création SVG.");
            resizeCanvas(); // Ajuste taille canvas vide
        }
        else {
            // Cas par défaut (ex: plan sans fichier)
            resizeCanvas();
            showToast("Aucun plan chargé.", 'warning');
        }

        // --- MISE EN PLACE DES ÉCOUTEURS ---
        // (Appelé APRÈS que les fonctions handlers soient définies)
        setupEventListeners();

	const pageFormatSelect = document.getElementById('page-format-select');
	if (pageFormatSelect) {
    	pageFormatSelect.addEventListener('change', () => {
        	currentPageSizeFormat = pageFormatSelect.value;
        	console.log("Format de page sélectionné:", currentPageSizeFormat);
        	// Optionnel : Redessiner des guides visuels sur le canvas ?
         	drawPageGuides(currentPageSizeFormat);
    	});
}

        // --- Placement éléments initiaux & Chargement codes sidebar ---
        if (planType !== 'svg_creation') {
            // Place les tags/textes géo existants
            createInitialGeoElements(initialPlacedGeoCodes, planType);
            // Charge les listes "Dispo" et "Placés"
            await fetchAndClassifyCodes();
        } else {
             // Charge juste les codes "Dispo" (pour les assets ?)
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
                if (success) {
                    addModalInstance.hide();
                    await fetchAndClassifyCodes(); // Rafraîchit les listes
                }
            });
        }

        // --- Mise à jour état initial boutons UI ---
        updateDrawingToolButtons();
        updateLockButtonState();
        updateGroupButtonStates();

    } catch (error) {
        console.error("Erreur majeure lors de l'initialisation:", error);
        showToast(`Erreur init: ${error.message}`, 'error');
    }
    finally {
        hideLoading();
        resizeCanvas();
        resetZoom();
        console.log("Fin initialisation main.js");
    }
});


/**
 * Attache les écouteurs d'événements principaux au canvas et au document.
 * (Appelée une fois que les fonctions handlers sont définies)
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
        // Magnétisme
        if (getSnapToGrid()) {
            const snapSize = GRID_SIZE || 10;
            const target = options.target;
            if (target.type !== 'line') { // Lignes gérées différemment
                target.set({
                    left: Math.round(target.left / snapSize) * snapSize,
                    top: Math.round(target.top / snapSize) * snapSize
                });
                target.setCoords();
            }
        }
        // Afficher la toolbar flottante si on déplace un élément géo
        const target = options.target;
        if (target?.customData?.isGeoTag || target?.customData?.isPlacedText) {
             showToolbar(target);
        }
    });

    // Événement après modification (déplacement, redimensionnement)
    fabricCanvas.on('object:modified', (e) => {
        const target = e.target;
        if (target?.customData?.isGeoTag) {
            // Tag géo (Plan Image)
            handleGeoTagModified(target); // Géré par geo-tags.js (sauvegarde taille/pos/ancre)
        }
        else if (target?.customData?.isPlacedText) {
            // Texte géo (Plan SVG)
            handleObjectMoved(target); // Géré par main.js (sauvegarde pos)
        }
        else if (target && !target.isGridLine) {
            // Objet de dessin (Rect, Ligne, Cercle, Texte, SVG déverrouillé)
            triggerAutoSaveDrawing(); // Sauvegarde auto (plan image)
            // (Pour SVG, la sauvegarde est manuelle via le bouton)
        }
    });

    // Événements de sélection
    fabricCanvas.on('selection:created', (e) => { handleSelectionChange(e.selected); });
    fabricCanvas.on('selection:updated', (e) => { handleSelectionChange(e.selected); });
    fabricCanvas.on('selection:cleared', (e) => {
        handleObjectDeselected(); // Nettoie UI
        updateGroupButtonStates(); // Met à jour boutons groupe
    });

    // Zoom / Pan
    fabricCanvas.on('viewport:transformed', () => {
        const zoom = fabricCanvas.getZoom();
        updateGrid(zoom); // Met à jour la grille visuelle
        updateStrokesWidth(zoom); // Met à jour épaisseur des traits
        // Réaffiche la toolbar si un objet géo est actif
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj?.customData?.isGeoTag || activeObj?.customData?.isPlacedText) {
            showToolbar(activeObj);
        }
    });

    // Empêcher menu contextuel
    fabricCanvas.upperCanvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

    // ===================================
    // === Événements du Document (Clavier) ===
    // ===================================
    document.addEventListener('keydown', (e) => {
        // Ignorer si un input est focus
        const isInputFocused = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
        const activeObject = fabricCanvas.getActiveObject();

        // Touche Échap
        if (e.key === 'Escape') {
            let handled = false;
            // Annuler dessin flèche
            if (getIsDrawingArrowMode && getIsDrawingArrowMode()) { cancelArrowDrawing(); handled = true; }
            // Annuler dessin forme
            if (getIsDrawing()) { stopDrawing(null, true); handled = true; } // true = cancel
            // Revenir à l'outil sélection
            if (getCurrentDrawingTool() !== 'select') { setActiveTool('select'); updateDrawingToolButtons(); handled = true; }
            // Désélectionner
            if (activeObject) { fabricCanvas.discardActiveObject().renderAll(); handleObjectDeselected(); handled = true; }

            if (handled) e.preventDefault();
            return;
        }

        // Si input focus, ne pas prendre les raccourcis (sauf Échap)
        if (isInputFocused) return;

        // Raccourcis avec Ctrl (ou Cmd sur Mac)
        if (e.ctrlKey || e.metaKey) {
            let handled = true;
            switch (e.key.toLowerCase()) {
                case 'c': copyShape(); break;
                case 'v': pasteShape(); break;
                case 'g': // Grouper / Dégrouper (Shift+G)
                    if (activeObject) { e.shiftKey ? ungroupSelectedObject() : groupSelectedObjects(); }
                    break;
                case 'l': // Verrouiller (seulement plan SVG)
                    if (planType === 'svg') { document.getElementById('toggle-lock-svg-btn')?.click(); }
                    break;
                // case 's': // Raccourci Sauvegarde (optionnel)
                //     document.getElementById('save-drawing-btn')?.click();
                //     break;
                default: handled = false; break;
            }
            if (handled) e.preventDefault();
        }
        // Raccourcis sans Ctrl
        else {
            let handled = true;
            switch (e.key) {
                // Touches Suppr / Backspace
                case 'Delete':
                case 'Backspace':
                    if (activeObject) {
                        // Appelle le handler générique de suppression
                        console.log("Touche Suppr pressée, objet actif:", activeObject);
			handleDeleteObject(activeObject);
                    }
                    break;
                // Raccourcis outils
                case 'v': setActiveTool('select'); updateDrawingToolButtons(); break;
                case 'r': setActiveTool('rect'); updateDrawingToolButtons(); break;
                case 'l': setActiveTool('line'); updateDrawingToolButtons(); break;
                case 'c': setActiveTool('circle'); updateDrawingToolButtons(); break;
                case 't': setActiveTool('text'); updateDrawingToolButtons(); break;
                default: handled = false; break;
            }
            if (handled) e.preventDefault();
        }

        // Maintenir Alt pour Panner
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
         // Relâcher Alt
         if (e.key === 'Alt') {
             if (!fabricCanvas.isDragging) { // Si on n'est pas en train de panner (stopPan gère sinon)
                fabricCanvas.defaultCursor = (getCurrentDrawingTool() === 'select') ? 'default' : 'crosshair';
                fabricCanvas.hoverCursor = (getCurrentDrawingTool() === 'select') ? 'move' : 'crosshair';
                fabricCanvas.requestRenderAll();
            }
        }
    });

    // ===================================
    // === Listeners Boutons Toolbars ===
    // ===================================

    // --- Toolbar Principale (Zoom, Lock, Save) ---
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    const lockBtn = document.getElementById('toggle-lock-svg-btn');
    const saveDrawingBtn = document.getElementById('save-drawing-btn'); // Bouton Sauvegarder
    const saveNewSvgPlanBtn = document.getElementById('save-new-svg-plan-btn'); // Bouton Nouveau Plan SVG
    const newPlanNameInput = document.getElementById('new-plan-name'); // Input Nom Nouveau Plan

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => { zoomCanvas(1.2); });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { zoomCanvas(0.8); });
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoom);
    if (lockBtn) lockBtn.addEventListener('click', () => { setCanvasLock(!getCanvasLock()); updateLockButtonState(); });

    // --- LOGIQUE SAUVEGARDE (Corrigée) ---
    if (saveDrawingBtn) {
        saveDrawingBtn.addEventListener('click', async () => {
            console.log("Clic sur 'Sauvegarder', planType:", planType);
            showLoading("Sauvegarde...");
            try {
                if (planType === 'image') {
                    // Sauvegarde annotations JSON pour un plan image
                    console.log("Appel triggerAutoSaveDrawing(true) pour plan image...");
                    await triggerAutoSaveDrawing(true); // Force la sauvegarde et attend
                    // Le toast est déjà géré dans triggerAutoSaveDrawing si forceSave=true
                } else if (planType === 'svg') {
                    // Sauvegarde du SVG modifié (plan SVG existant)
                    console.log("Appel saveModifiedSvgPlan() pour plan SVG existant...");
                    await saveModifiedSvgPlan(); // Sauvegarde le SVG modifié
                    showToast("Plan SVG mis à jour.", "success");
                } else {
                    console.warn("Type de plan non géré pour ce bouton:", planType);
                    showToast("Action de sauvegarde non applicable pour ce type de plan.", "warning");
                }
            } catch (error) {
                console.error("Erreur bouton sauvegarde:", error);
                showToast(`Erreur sauvegarde: ${error.message}`, "danger");
            } finally {
                hideLoading();
            }
        });
    } else {
         console.warn("Bouton #save-drawing-btn non trouvé.");
    }

    if (saveNewSvgPlanBtn && newPlanNameInput) {
        saveNewSvgPlanBtn.addEventListener('click', async () => {
             console.log("Clic sur 'Enregistrer Nouveau Plan SVG'");
             const planName = newPlanNameInput.value.trim();

             // !! IMPORTANT : Récupérer les univers sélectionnés (via modale ?) !!
             // Ce sélecteur est un EXEMPLE, adaptez-le à votre HTML
             const universCheckboxes = document.querySelectorAll('#univers-selector-modal input[name="univers_ids[]"]:checked');
             const selectedUniversIds = Array.from(universCheckboxes).map(cb => cb.value);

             if (!planName) {
                 showToast("Veuillez entrer un nom pour le nouveau plan.", "warning");
                 newPlanNameInput.focus();
                 return;
             }
             if (selectedUniversIds.length === 0) {
                  showToast("Veuillez sélectionner au moins un univers pour le nouveau plan.", "warning");
                  // Potentiellement ouvrir la modale de sélection ici
                  // ex: bootstrap.Modal.getOrCreateInstance(document.getElementById('univers-selector-modal')).show();
                  return;
             }

             showLoading("Création du plan SVG...");
             try {
                 // Exporte le canvas en SVG (sauf la grille)
                 const svgString = fabricCanvas.toSVG(['customData', 'baseStrokeWidth'], obj => obj.isGridLine ? null : obj);
                 console.log("SVG généré pour création (début):", svgString.substring(0, 150) + "...");
                 // Appelle l'API
                 const newPlan = await createSvgPlan(planName, svgString, selectedUniversIds);
                 showToast(`Plan "${planName}" créé ! Redirection...`, "success");
                 // Redirige vers la page de gestion du nouveau plan
                 window.location.href = `index.php?action=manageCodes&id=${newPlan.plan_id}`;
             } catch (error) {
                 console.error("Erreur création SVG:", error);
                 showToast(`Erreur création SVG: ${error.message}`, "danger");
             } finally {
                 hideLoading();
             }
        });
    } else {
         // Affiche un avertissement seulement si on est en mode création
         if(planType === 'svg_creation') console.warn("Bouton #save-new-svg-plan-btn ou input #new-plan-name non trouvé(s).");
    }
    // --- FIN LOGIQUE SAUVEGARDE ---


    // --- Toolbar Dessin (Outils) ---
    const toolBtns = document.querySelectorAll('#drawing-toolbar .tool-btn');
    toolBtns.forEach(btn => btn.addEventListener('click', () => {
        setActiveTool(btn.dataset.tool);
        updateDrawingToolButtons();
    }));

    // --- Toolbar Dessin (Styles, Actions) ---
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

    // --- Offcanvas Assets ---
    const saveAssetBtn = document.getElementById('save-asset-btn');
    const assetsListContainer = document.getElementById('assets-list');
    const assetsOffcanvasEl = document.getElementById('assetsOffcanvas');
    if (saveAssetBtn) saveAssetBtn.addEventListener('click', handleSaveAsset);
    if (assetsOffcanvasEl) assetsOffcanvasEl.addEventListener('show.bs.offcanvas', loadAssetsList);
    if (assetsListContainer) assetsListContainer.addEventListener('click', handleAssetClick);

    // --- Toolbar Flottante (Géo) ---
    const deleteBtn = document.getElementById('toolbar-delete');
    if (deleteBtn) deleteBtn.addEventListener('click', () => {
         // Appelle le handler générique
         handleDeleteObject(fabricCanvas.getActiveObject());
    });
    // Les autres boutons (flèche, taille, surbrillance) sont gérés dans geo-tags.js

    console.log("All event listeners attached.");
}

/**
 * Extrait les données de position pertinentes d'un objet Fabric pour la sauvegarde.
 * Calcule les positions relatives (en %) pour le type 'svg'
 * Calcule les positions absolues (en px) pour le type 'image'
 * @param {fabric.Object} fabricObject L'objet dont on veut les coordonnées.
 * @param {Object} [clickPoint=null] Point (x,y) du clic initial (utilisé en fallback si l'objet n'a pas de centre).
 * @returns {Object} Un objet { pos_x, pos_y, anchor_x, anchor_y, width, height }
 */
function getPositionDataFromObject(fabricObject, clickPoint = null) {
    const isText = fabricObject.customData?.isPlacedText;

    // 1. Déterminer le point de référence (x, y) en PIXELS
    let refPoint;
    if (fabricObject.getCenterPoint()) {
        // Cas 1: Tag (image) ou Texte (svg) placé librement.
        // On utilise le centre de l'objet comme point de référence.
        refPoint = fabricObject.getCenterPoint();
    } else if (clickPoint) {
        // Cas 2: Fallback (clic initial, ex: lors de la création)
        refPoint = clickPoint;
    } else {
        console.error("getPositionDataFromObject: Impossible de déterminer le point de référence.");
        refPoint = { x: 0, y: 0 }; // Fallback ultime
    }

    // 2. Obtenir les dimensions en PIXELS
    const pixelWidth = fabricObject.getScaledWidth();
    const pixelHeight = fabricObject.getScaledHeight();

    // 3. Préparer le retour de données (par défaut en pixels)
    let data = {
        pos_x: refPoint.x,
        pos_y: refPoint.y,
        anchor_x: null, // Simplifié pour l'instant
        anchor_y: null,
        width: pixelWidth,
        height: pixelHeight
    };

    // 4. Convertir les coordonnées si planType est 'svg'
    // 'planType' et 'fabricCanvas' sont des variables globales de main.js
    if (planType === 'svg') {
        
        // --- Conversion de la Position (X, Y) ---
        // On utilise VOTRE fonction de utils.js en lui passant le canvas global
        const percentPos = convertPixelsToPercent(refPoint.x, refPoint.y, fabricCanvas); 
        data.pos_x = percentPos.posX;
        data.pos_y = percentPos.posY;

        // --- Conversion des Dimensions (Width, Height) ---
        // Votre fonction ne gère pas les dimensions, on le fait manuellement
        // en utilisant les mêmes variables globales qu'elle (window.originalSvgWidth)
        const planWidth = window.originalSvgWidth || fabricCanvas.getWidth();
        const planHeight = window.originalSvgHeight || fabricCanvas.getHeight();

        if (planWidth > 0 && planHeight > 0) {
            data.width = (pixelWidth / planWidth) * 100;
            data.height = (pixelHeight / planHeight) * 100;
        } else {
            console.error("getPositionDataFromObject: Dimensions du plan (window.originalSvgWidth) non valides. Sauvegarde des dimensions en 0.");
            data.width = 0;
            data.height = 0;
        }

        // Gestion de l'ancre (si on la réintroduit plus tard)
        if (isText && fabricObject.customData?.anchor_x != null) {
             // ... logique d'ancre ...
        }

    } 
    // Pour 'image', on laisse en pixels (rien à faire, les valeurs de 'data' sont déjà en pixels)

    return data;
}
