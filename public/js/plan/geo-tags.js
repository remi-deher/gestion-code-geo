/**
 * Module pour la gestion des "éléments géo" :
 * 1. Étiquettes rectangulaires ('isGeoTag') - principalement pour plan 'image'.
 * 2. Textes placés ('isPlacedText') - principalement pour plan 'svg'.
 * Gère aussi la toolbar d'édition, les flèches (pour étiquettes), et le surlignage.
 */
import { getCanvasInstance } from './canvas.js';
import { convertPixelsToPercent, convertPercentToPixels, showToast } from '../modules/utils.js';
import { savePosition, removePosition, removeMultiplePositions } from '../modules/api.js';
import { sizePresets, GEO_TAG_FONT_SIZE } from '../modules/config.js';
import { fetchAndClassifyCodes } from './sidebar.js'; // Importer pour rafraîchir

let fabricCanvas;
let universColors = {};
let selectedFabricObject = null; // L'objet géo (tag ou texte) actuellement sélectionné
let highlightedCodeGeo = null; // Le code géo à surligner
let isDrawingArrowMode = false;
let currentArrowLine = null;

// Éléments DOM de la Toolbar
let tagToolbar;
let highlightTagBtn;
let arrowTagBtn;
let sizeBtnGroup;
let deleteTagBtn;

/**
 * Initialise le module.
 * @param {fabric.Canvas} canvasInstance - L'instance du canvas.
 * * @param {Object} uColors - Mapping des couleurs d'univers.
 */
export function initializeGeoTags(canvasInstance, uColors) {
    fabricCanvas = canvasInstance;
    universColors = uColors;

    // Récupérer les éléments de la toolbar
    tagToolbar = document.getElementById('tag-edit-toolbar');
    highlightTagBtn = document.getElementById('toolbar-highlight');
    arrowTagBtn = document.getElementById('toolbar-arrow');
    sizeBtnGroup = document.getElementById('toolbar-size-group');
    deleteTagBtn = document.getElementById('toolbar-delete');

    if (!tagToolbar) {
        console.warn("Toolbar d'édition de tag (#tag-edit-toolbar) non trouvée.");
    }
}

/**
 * Crée un objet groupe Fabric pour une ÉTIQUETTE GÉO RECTANGULAIRE (utilisé pour plan type 'image').
 * @param {object} codeData - Données complètes du code géo incluant sa position (pos_x, pos_y, width, height, position_id...).
 * @returns {fabric.Group | null} Le groupe Fabric créé ou null si erreur.
 */
export function createFabricTag(codeData) {
    if (!fabricCanvas) {
        console.error("createFabricTag: Canvas non initialisé.");
        return null;
    }
    
    // S'assurer que le fond (image) est là pour la conversion
    const bg = fabricCanvas.backgroundImage;
    if (!bg && !getSvgOriginalBBox()) {
        console.warn("createFabricTag: Aucune référence (Image ou BBox) pour la conversion de position.");
        return null;
    }

    if (codeData.pos_x === null || codeData.pos_y === null || codeData.width === null || codeData.height === null) {
        console.error("createFabricTag: Données de position (x, y, w, h) manquantes.", codeData);
        return null;
    }
    
    const { left, top } = convertPercentToPixels(codeData.pos_x, codeData.pos_y, fabricCanvas);
    if (isNaN(left) || isNaN(top)) {
        console.error("createFabricTag: Conversion en pixels échouée.", codeData);
        return null;
    }

    const universColor = universColors[codeData.univers] || '#adb5bd';
    const codeGeo = codeData.code_geo || codeData.codeGeo || 'ERR';

    const rect = new fabric.Rect({
        width: codeData.width,
        height: codeData.height,
        fill: universColor,
        stroke: 'black',
        strokeWidth: 1, // Sera adapté au zoom par updateStrokesWidth
        baseStrokeWidth: 1, // Stocker la largeur de base
        originX: 'center',
        originY: 'center'
    });

    const text = new fabric.Text(codeGeo, {
        fontSize: GEO_TAG_FONT_SIZE || 14,
        fill: 'white',
        originX: 'center',
        originY: 'center',
        fontFamily: 'Arial',
        fontWeight: 'bold'
    });

    const group = new fabric.Group([rect, text], {
        left: left,
        top: top,
        originX: 'center',
        originY: 'center',
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: true,
        borderColor: '#007bff',
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        // Stocker TOUTES les données (code + position)
        customData: {
            ...codeData,
            codeGeo: codeGeo, // Assurer la cohérence du nom
            isGeoTag: true, // Marqueur pour ÉTIQUETTE RECTANGULAIRE
            isPlacedText: false,
            id: parseInt(codeData.id, 10),
            position_id: parseInt(codeData.position_id, 10),
            plan_id: parseInt(codeData.plan_id, 10),
            currentWidth: codeData.width, // Stocker la taille
            currentHeight: codeData.height,
            anchorXPercent: codeData.anchor_x, // Stocker l'ancre
            anchorYPercent: codeData.anchor_y
        }
    });

    // Ajouter flèche SEULEMENT si c'est une étiquette et ancre définie
    if (group.customData.anchorXPercent !== null && group.customData.anchorYPercent !== null) {
        addArrowToTag(group);
    }

    fabricCanvas.add(group);
    group.moveTo(999); // Mettre au premier plan
    updateHighlightEffect(group); // Appliquer highlight initial
    return group;
}

/**
 * Ajoute ou met à jour la flèche d'une ÉTIQUETTE GÉO (pas pour texte simple).
 * @param {fabric.Group} tagGroup - L'objet étiquette (doit être isGeoTag).
 */
export function addArrowToTag(tagGroup) {
    // Ne rien faire si ce n'est pas un tag rectangulaire
    if (!tagGroup?.customData?.isGeoTag) {
        if (tagGroup?.arrowLine) { // Nettoyer si la flèche existe par erreur
            fabricCanvas.remove(tagGroup.arrowLine);
            tagGroup.arrowLine = null;
        }
        return;
    }
    
    // Supprimer l'ancienne flèche si elle existe
    if (tagGroup.arrowLine) {
        fabricCanvas.remove(tagGroup.arrowLine);
        tagGroup.arrowLine = null;
    }

    const { anchorXPercent, anchorYPercent } = tagGroup.customData;
    if (anchorXPercent === null || anchorYPercent === null) {
        fabricCanvas.requestRenderAll();
        return; // Pas d'ancre, pas de flèche
    }

    const tagCenter = tagGroup.getCenterPoint();
    const anchorGlobal = convertPercentToPixels(anchorXPercent, anchorYPercent, fabricCanvas);
    if (isNaN(anchorGlobal.left) || isNaN(anchorGlobal.top)) {
        console.error("addArrowToTag: Coords d'ancre invalides.", tagGroup.customData);
        return;
    }
    
    const zoom = fabricCanvas.getZoom();
    const baseStrokeWidth = 2;

    tagGroup.arrowLine = new fabric.Line(
        [tagCenter.x, tagCenter.y, anchorGlobal.left, anchorGlobal.top],
        {
            stroke: 'rgba(0, 0, 0, 0.7)',
            strokeWidth: baseStrokeWidth / zoom,
            baseStrokeWidth: baseStrokeWidth, // Stocker base
            selectable: false,
            evented: false,
            originX: 'center',
            originY: 'center',
            isArrow: true
        }
    );

    fabricCanvas.add(tagGroup.arrowLine);
    tagGroup.arrowLine.moveTo(998); // Juste en dessous du tag
    fabricCanvas.requestRenderAll();
}

/**
 * Gère la modification (déplacement) d'une ÉTIQUETTE GÉO (appelé depuis main.js).
 * @param {fabric.Group} target - L'étiquette (isGeoTag) qui a été modifiée.
 */
export async function handleGeoTagModified(target) {
     if (!target?.customData?.isGeoTag) return; // Ne traite que les vrais tags

     const { position_id, id: geoCodeId, currentWidth, currentHeight, anchorXPercent, anchorYPercent, plan_id, codeGeo } = target.customData;
     
     if (!geoCodeId || !position_id || !plan_id) {
        console.error(`ERREUR: Impossible de sauvegarder modif tag ${codeGeo}. Données ID manquantes:`, target.customData);
        showToast(`Erreur sauvegarde tag ${codeGeo}.`, "danger"); return;
    }
     
     const centerPoint = target.getCenterPoint();
     const { posX, posY } = convertPixelsToPercent(centerPoint.x, centerPoint.y, fabricCanvas);
     
     const positionData = {
         id: geoCodeId,
         position_id: position_id,
         plan_id: plan_id,
         pos_x: posX,
         pos_y: posY,
         width: currentWidth, // Conserver la taille
         height: currentHeight,
         anchor_x: anchorXPercent, // Conserver l'ancre
         anchor_y: anchorYPercent
     };
     
     try {
        const savedData = await savePosition(positionData);
        console.log("Nouvelle position étiquette sauvegardée:", savedData);
        // Mettre à jour les données locales
        target.customData.pos_x = savedData.pos_x;
        target.customData.pos_y = savedData.pos_y;
     } catch(error) {
        console.error("Erreur API sauvegarde position tag:", error);
        showToast(`Erreur sauvegarde tag ${codeGeo}: ${error.message}`, "danger");
     }

     // Redessiner la flèche si elle existe
     if (target.arrowLine || (anchorXPercent !== null && anchorYPercent !== null)) {
        addArrowToTag(target);
     }
     
     showToolbar(target); // Réafficher toolbar à la bonne position
}


// --- Gestion Toolbar ---

/**
 * Affiche la toolbar d'édition à côté de l'élément géo sélectionné.
 * @param {fabric.Object} target - L'objet (Tag ou Texte) sélectionné.
 */
export function showToolbar(target) {
    if (!tagToolbar || !(target?.customData?.isGeoTag || target?.customData?.isPlacedText)) {
        hideToolbar();
        return;
    }
    selectedFabricObject = target;

    // Adapter la toolbar selon le type (Tag vs Texte)
    const isTag = target.customData.isGeoTag; // Est-ce une étiquette rectangulaire ?
    const isText = target.customData.isPlacedText; // Est-ce un texte géo ?

    // Cacher/afficher boutons spécifiques
    if(arrowTagBtn) arrowTagBtn.style.display = isTag ? 'inline-flex' : 'none';
    if(sizeBtnGroup) sizeBtnGroup.style.display = isTag ? 'inline-flex' : 'none';
    
    // Mettre à jour l'état des boutons de taille (pour les tags)
    if (isTag && sizeBtnGroup) {
         sizeBtnGroup.querySelectorAll('.size-btn').forEach(btn => {
             btn.classList.remove('active');
             const preset = sizePresets[btn.dataset.size];
             if (preset && preset.width === target.customData.currentWidth) {
                 btn.classList.add('active');
             }
         });
    }

    // Positionner la toolbar
    const BoundingRect = target.getBoundingRect();
    const zoom = fabricCanvas.getZoom();
    const vpt = fabricCanvas.viewportTransform;
    const panX = vpt[4];
    const panY = vpt[5];

    // Coordonnées à l'écran
    const screenLeft = BoundingRect.left * zoom + panX;
    const screenTop = BoundingRect.top * zoom + panY;
    const screenHeight = BoundingRect.height * zoom;

    const canvasContainerRect = fabricCanvas.wrapperEl.getBoundingClientRect();
    
    // Positionner à droite et au milieu de l'objet
    tagToolbar.style.left = `${screenLeft + (BoundingRect.width * zoom) + 10}px`;
    tagToolbar.style.top = `${screenTop + (screenHeight / 2) - (tagToolbar.offsetHeight / 2)}px`;
    tagToolbar.classList.add('visible');
    
    // S'assurer qu'elle ne sort pas du canvas
    if (tagToolbar.offsetLeft + tagToolbar.offsetWidth > canvasContainerRect.width - 10) {
        tagToolbar.style.left = `${screenLeft - tagToolbar.offsetWidth - 10}px`;
    }
}

/** Cache la toolbar d'édition */
export function hideToolbar() {
    if (tagToolbar) {
        tagToolbar.classList.remove('visible');
    }
    selectedFabricObject = null;
    cancelArrowDrawing(); // Annuler dessin de flèche si on désélectionne
}

/**
 * Supprime l'élément géo sélectionné (Tag OU Texte).
 * Appelée depuis main.js (raccourci clavier) ou la toolbar.
 */
export async function deleteSelectedGeoElement() {
    const target = selectedFabricObject; // Utiliser l'objet stocké
    
    if (!target || !(target.customData?.isGeoTag || target.customData?.isPlacedText)) {
        console.warn("deleteSelectedGeoElement: Aucun élément géo valide n'est sélectionné.");
        return;
    }

    const customData = target.customData;
    const { position_id, id: geoCodeId, codeGeo, plan_id } = customData;
    const isTag = customData.isGeoTag;
    const elementType = isTag ? "l'étiquette" : "le texte";

    console.log("deleteSelectedGeoElement - Données pour suppression:", { position_id, geoCodeId, plan_id });

    if (!geoCodeId || !position_id || !plan_id) {
        console.error(`ERREUR: Impossible de supprimer ${elementType} ${codeGeo}. Données ID manquantes:`, customData);
        showToast(`Erreur suppression ${codeGeo}.`, "danger"); 
        return;
    }

    const allInstances = fabricCanvas.getObjects().filter(o => 
        o.customData && 
        (o.customData.isGeoTag || o.customData.isPlacedText) &&
        o.customData.id === geoCodeId
    );
    
    let performDelete = false;
    let deleteAllInstances = false;

    // Demande confirmation
    if (allInstances.length > 1) {
        // Optionnel: proposer de tout supprimer (on garde simple pour l'instant)
        if (confirm(`Voulez-vous supprimer ${elementType} "${codeGeo}" ?\n(Il y a ${allInstances.length} instances au total sur ce plan).`)) {
            performDelete = true;
            // Pourrait ajouter logique pour 'deleteAllInstances' ici si besoin
        }
    } else if (confirm(`Supprimer ${elementType} "${codeGeo}" ?`)) {
        performDelete = true;
    }

    if (!performDelete) return;

    try {
        let success;
        if (deleteAllInstances) {
            console.log(`Appel API removeMultiplePositions avec geoCodeId=${geoCodeId}, planId=${plan_id}`);
	    success = await removeMultiplePositions(geoCodeId, plan_id);
        } else {
	    console.log(`Appel API removePosition avec positionId=${position_id}`);
            success = await removePosition(position_id);
        }

        if (success) {
            // Supprimer les objets du canvas
            const elementsToRemove = deleteAllInstances ? allInstances : [target];
            elementsToRemove.forEach(element => {
                if (element.arrowLine) fabricCanvas.remove(element.arrowLine); // Pour les tags
                fabricCanvas.remove(element);
            });
            
            showToast(`${elementType} "${codeGeo}" supprimé(e).`, "success");
            
            // Rafraîchir les listes de la sidebar
            await fetchAndClassifyCodes();
            
            fabricCanvas.discardActiveObject().renderAll();
            hideToolbar();
        } else {
            showToast(`La suppression de ${codeGeo} a échoué côté serveur.`, "warning");
        }
    } catch (error) {
        console.error(`Erreur API suppression ${elementType}:`, error);
        showToast(`Erreur suppression ${codeGeo}: ${error.message}`, "danger");
    }
}

/**
 * Change la taille d'une ÉTIQUETTE GÉO (pas pour texte simple).
 * Appelée par le listener de la toolbar dans main.js.
 * @param {Event} event - L'événement de clic sur le bouton de taille.
 */
export async function changeSelectedTagSize(event) {
    const size = event.currentTarget.dataset.size;
    // Ne rien faire si ce n'est pas un tag rectangulaire
    if (!selectedFabricObject?.customData?.isGeoTag || !sizePresets[size]) return;
    
    const target = selectedFabricObject;
    const preset = sizePresets[size];
    
    const { position_id, id: geoCodeId, anchorXPercent, anchorYPercent, plan_id, codeGeo } = target.customData;
    if (!geoCodeId || !position_id || !plan_id) { /* ... gestion erreur ID ... */ return; }

    // Mettre à jour l'objet Fabric
    target.item(0).set({ width: preset.width, height: preset.height }); // item(0) est le Rect
    target.addWithUpdate(); // Recalcule le groupe
    target.setCoords();
    fabricCanvas.renderAll();
    
    // Mettre à jour les données customData
    target.customData.currentWidth = preset.width;
    target.customData.currentHeight = preset.height;
    
    // Recalculer le % de position (le centre n'a pas bougé)
    const centerPoint = target.getCenterPoint();
    const { posX, posY } = convertPixelsToPercent(centerPoint.x, centerPoint.y, fabricCanvas);

    const positionData = {
        id: geoCodeId, position_id: position_id, plan_id: plan_id,
        pos_x: posX, pos_y: posY,
        width: preset.width, // Nouvelle taille
        height: preset.height,
        anchor_x: anchorXPercent, anchor_y: anchorYPercent // Garder l'ancre
    };
    
    try {
        const savedData = await savePosition(positionData);
        target.customData.pos_x = savedData.pos_x;
        target.customData.pos_y = savedData.pos_y;
        console.log("Taille étiquette sauvegardée:", savedData);
        showToast(`Taille de ${codeGeo} modifiée.`, "info");
    } catch(error) {
        console.error("Erreur API sauvegarde taille étiquette:", error);
        showToast(`Erreur sauvegarde ${codeGeo}: ${error.message}`, "danger");
    }

    showToolbar(target); // Ré-afficher pour mettre à jour état 'active' des boutons
}


// --- Surlignage (Highlight) ---

/**
 * Bascule le surlignage pour le code géo de l'objet sélectionné.
 * Appelée par le listener de la toolbar dans main.js.
 */
export function toggleHighlightSelected() {
    if (!selectedFabricObject?.customData) return; // Tag ou Texte
    
    const codeToHighlight = selectedFabricObject.customData.codeGeo;
    // Si on clique sur le même, on annule le surlignage
    highlightedCodeGeo = (highlightedCodeGeo === codeToHighlight) ? null : codeToHighlight;
    
    redrawAllTagsHighlight();
}

/** Redessine tous les objets pour appliquer/retirer le surlignage */
export function redrawAllTagsHighlight() {
    if (!fabricCanvas) return;
    fabricCanvas.getObjects().forEach(obj => {
        updateHighlightEffect(obj);
    });
    fabricCanvas.requestRenderAll();
}

/**
 * Applique l'effet de surlignage (ou d'atténuation) à un objet.
 * @param {fabric.Object} fabricObj - L'objet à évaluer.
 */
function updateHighlightEffect(fabricObj) {
    if (!fabricObj || fabricObj.isGridLine || !fabricObj.visible) return;

    const isGeoElement = fabricObj.customData?.isGeoTag || fabricObj.customData?.isPlacedText;
    const isActiveSelection = fabricCanvas.getActiveObject() === fabricObj;
    let isHighlightedInstance = false;

    // Vérifier si c'est une instance à surligner
    if (isGeoElement && highlightedCodeGeo && fabricObj.customData) {
        isHighlightedInstance = fabricObj.customData.codeGeo === highlightedCodeGeo;
    }

    let opacity = 1.0;
    // Atténuer si un surlignage est actif ET que cet objet n'est pas concerné
    if (highlightedCodeGeo && (!isGeoElement || !isHighlightedInstance)) {
        opacity = 0.3;
    }
    fabricObj.set({ opacity });

    // Gérer la bordure/fond pour l'élément lui-même
    if (isGeoElement) {
        const rect = fabricObj.customData.isGeoTag ? fabricObj.item(0) : null; // Rectangle pour tag
        const text = fabricObj.customData.isPlacedText ? fabricObj : null;     // Objet texte

        // Reset style
        if (rect) rect.set({ stroke: 'black', strokeWidth: rect.baseStrokeWidth / fabricCanvas.getZoom() });
        if (text) text.set({ backgroundColor: '' }); // Enlever fond

        if (isActiveSelection) {
            // La bordure de sélection standard de Fabric s'applique
        } else if (isHighlightedInstance) {
             // Surligner
             if (rect) {
                 rect.set({ stroke: '#ffc107', strokeWidth: 2 / fabricCanvas.getZoom() });
             }
             if (text) {
                 text.set({ backgroundColor: 'rgba(255, 193, 7, 0.5)' }); // Fond jaune léger
             }
        }
    }

    // Gérer la flèche associée (pour les tags)
    if (fabricObj.arrowLine) {
        fabricObj.arrowLine.set({ opacity });
    }
}


// --- Gestion Flèches (uniquement pour tags image) ---

/** Démarre le mode dessin de flèche */
export function startDrawingArrow() {
    // Ne démarrer que si c'est une étiquette rectangulaire
    if (!selectedFabricObject?.customData?.isGeoTag) {
        showToast("Les flèches ne sont disponibles que pour les étiquettes rectangulaires.", "info");
        return;
    }
    isDrawingArrowMode = true;
    fabricCanvas.defaultCursor = 'crosshair';
    fabricCanvas.selection = false;
    showToast("Mode flèche: Cliquez sur le plan pour définir la cible de la flèche.", "info");
    
    // Créer une ligne temporaire
    cancelArrowDrawing(); // Nettoyer au cas où
    const tagCenter = selectedFabricObject.getCenterPoint();
    currentArrowLine = new fabric.Line(
        [tagCenter.x, tagCenter.y, tagCenter.x, tagCenter.y],
        {
            stroke: 'rgba(0,0,0,0.3)',
            strokeWidth: 2 / fabricCanvas.getZoom(),
            strokeDashArray: [5, 5],
            selectable: false, evented: false
        }
    );
    fabricCanvas.add(currentArrowLine);
    
    // Suivre la souris (temporairement géré ici, pourrait être dans main.js)
    fabricCanvas.on('mouse:move', handleArrowMove);
}

/** Suit la souris pendant le dessin de flèche */
function handleArrowMove(opt) {
    if (!isDrawingArrowMode || !currentArrowLine) return;
    const pointer = fabricCanvas.getPointer(opt.e);
    currentArrowLine.set({ x2: pointer.x, y2: pointer.y });
    fabricCanvas.requestRenderAll();
}

/**
 * Termine le dessin de flèche et sauvegarde l'ancre.
 * Appelée par main.js lors d'un clic en mode 'isDrawingArrowMode'.
 * @param {object} opt - L'option d'événement mousedown de Fabric.
 */
export async function handleArrowEndPoint(opt) {
    if (!isDrawingArrowMode || !selectedFabricObject?.customData?.isGeoTag || !opt?.pointer) {
        cancelArrowDrawing();
        return;
    }
    
    const target = selectedFabricObject;
    const pointer = fabricCanvas.getPointer(opt.e);
    
    // Convertir le point d'ancre en %
    const { posX: anchorX, posY: anchorY } = convertPixelsToPercent(pointer.x, pointer.y, fabricCanvas);
    
    // Mettre à jour les customData du tag
    target.customData.anchorXPercent = anchorX;
    target.customData.anchorYPercent = anchorY;

    // Mettre à jour la flèche (la vraie)
    addArrowToTag(target);
    
    // Sauvegarder la position (qui inclut maintenant l'ancre)
    const { position_id, id: geoCodeId, currentWidth, currentHeight, pos_x, pos_y, plan_id, codeGeo } = target.customData;
    if (!geoCodeId || !position_id || !plan_id) { /* ... gestion erreur ID ... */ return; }

    const positionData = {
        id: geoCodeId, position_id: position_id, plan_id: plan_id,
        pos_x: pos_x, pos_y: pos_y, // Position du tag (n'a pas changé)
        width: currentWidth, height: currentHeight,
        anchor_x: anchorX, anchor_y: anchorY // Nouvelle ancre
    };
    
    try {
        await savePosition(positionData);
        showToast(`Flèche pour ${codeGeo} sauvegardée.`, "success");
    } catch(error) {
        console.error("Erreur API sauvegarde ancre:", error);
        showToast(`Erreur sauvegarde flèche: ${error.message}`, "danger");
    }
    
    cancelArrowDrawing();
    fabricCanvas.setActiveObject(target).renderAll(); // Resélectionner le tag
}

/** Annule le mode dessin de flèche */
export function cancelArrowDrawing() {
    if (currentArrowLine) {
        fabricCanvas.remove(currentArrowLine);
        currentArrowLine = null;
    }
    fabricCanvas.off('mouse:move', handleArrowMove);
    isDrawingArrowMode = false;
    fabricCanvas.defaultCursor = 'default';
    fabricCanvas.selection = true;
}

/** Retourne l'état du mode dessin de flèche */
export function getIsDrawingArrowMode() {
    return isDrawingArrowMode;
}
