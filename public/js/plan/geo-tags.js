/**
 * Module pour la gestion des "éléments géo" :
 * 1. Étiquettes rectangulaires ('isGeoTag') - principalement pour plan 'image'.
 * 2. Textes placés ('isPlacedText') - principalement pour plan 'svg'.
 * Gère aussi la toolbar d'édition, les flèches (pour étiquettes), et le surlignage.
 */
import { getCanvasInstance } from './canvas.js';
import { convertPixelsToPercent, convertPercentToPixels, showToast } from '../modules/utils.js';
import { savePosition, removePosition, removeMultiplePositions } from '../modules/api.js';
import { showLoading, hideLoading } from './ui.js';
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
 * Gère la sauvegarde d'un objet (tag/texte) qui a été modifié (déplacé, redimensionné).
 * @param {fabric.Object} target L'objet fabric qui a été modifié.
 */
export async function handleGeoTagModified(target) {
    if (!target || !target.customData) return;

    // Ne pas sauvegarder si c'est juste une sélection/désélection
    // On ne sauvegarde que si l'objet a VRAIMENT bougé ou changé de taille
    if (target.isMoving === false && target.isScaling === false) {
        // console.log("handleGeoTagModified: Skip save (selection only)");
        return;
    }
    // Réinitialiser les drapeaux
    target.isMoving = false;
    target.isScaling = false;

    // Récupérer les données pour la sauvegarde
    const { pos_x, pos_y, anchor_x, anchor_y, width, height } = getPositionDataFromObject(target, null);
    
    // --- CORRECTION: Utiliser 'code_geo' ---
    const { position_id, id: geoCodeId, plan_id, code_geo } = target.customData;

    if (!geoCodeId || !plan_id) { 
        console.error("handleGeoTagModified: ID manquant (geoCodeId ou plan_id), sauvegarde annulée", target.customData);
        return; 
    }
    
    // --- LOGS DE DÉBOGAGE (MOUVEMENT) ---
    console.log("--- handleGeoTagModified (Déplacement/Redim.) ---");
    if (!position_id) {
        // C'est la conséquence du problème de placement : l'ID est null
        console.warn(`LOG A - Tentative de modification d'un objet SANS position_id (geoCodeId: ${geoCodeId}). L'API va faire un INSERT (doublon) !`);
    } else {
        console.log(`LOG B - Modification d'un objet avec position_id: ${position_id} (geoCodeId: ${geoCodeId}). L'API va faire un UPDATE.`);
    }
    // --- FIN LOGS ---

    const positionData = {
        id: geoCodeId,
        plan_id: plan_id,
        position_id: position_id, // C'est ici que 'null' pose problème
        pos_x: pos_x, 
        pos_y: pos_y,
        width: width, 
        height: height,
        anchor_x: anchor_x, 
        anchor_y: anchor_y
    };
    
    // --- LOGS DE DÉBOGAGE (MOUVEMENT) ---
    console.log("LOG C - Envoi données MàJ:", JSON.parse(JSON.stringify(positionData)));
    // --- FIN LOGS ---

    showLoading('Sauvegarde MàJ...');
    try {
        const savedPosition = await savePosition(positionData);
        
        // --- LOGS DE DÉBOGAGE (MOUVEMENT) ---
        console.log("LOG D - Réponse API MàJ:", savedPosition);
        // --- FIN LOGS ---

        // Mettre à jour les customData avec les valeurs confirmées
        // (surtout si l'objet n'avait pas de position_id avant)
        if (savedPosition && savedPosition.id) {
            if (!target.customData.position_id) {
                console.log(`LOG E - L'objet a reçu un nouvel ID (via INSERT): ${savedPosition.id}`);
                target.customData.position_id = savedPosition.id; // Corrige l'objet pour le futur
            }
            target.customData.pos_x = savedPosition.pos_x;
            target.customData.pos_y = savedPosition.pos_y;
            target.customData.width = savedPosition.width;
            target.customData.height = savedPosition.height;
            target.customData.anchor_x = savedPosition.anchor_x;
            target.customData.anchor_y = savedPosition.anchor_y;
        } else {
             console.error("LOG E - ÉCHEC: La sauvegarde (MàJ) n'a pas retourné d'objet valide.", savedPosition);
        }

        // --- CORRECTION TOAST: Utiliser 'code_geo' ---
        showToast(`Position ${code_geo} mise à jour.`, 'success');
        
        // Rafraîchir les listes
        await fetchAndClassifyCodes();

    } catch (error) {
         // --- LOGS DE DÉBOGAGE (MOUVEMENT) ---
        console.error("LOG F - Erreur CATCH MàJ:", error);
        // --- FIN LOGS ---
        showToast(`Erreur MàJ ${code_geo}: ${error.message}`, 'danger');
    } finally {
        hideLoading();
    }
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
/**
 * Gère la suppression de l'objet sélectionné (tag ou texte).
 */
export async function deleteSelectedGeoElement() {
    // Utilise l'objet stocké globalement (défini par 'handleObjectSelected' dans main.js)
    const target = selectedFabricObject; 

    if (!target || !(target.customData?.isGeoTag || target.customData?.isPlacedText)) {
        console.warn("deleteSelectedGeoElement: No valid geo element selected.");
        return;
    }

    const customData = target.customData;
    const { position_id, id: geoCodeId, code_geo, plan_id } = customData;
    const isTag = customData.isGeoTag;
    const elementType = isTag ? "l'étiquette" : "le texte";

    console.log("deleteSelectedGeoElement - Data for deletion:", { position_id, geoCodeId, plan_id, code_geo });

    // !!! CORRECTION : 'deleteAllInstances' DOIT ÊTRE DÉCLARÉE ICI !!!
    // Récupère l'état de la checkbox (assurez-vous que l'ID HTML est correct)
    const deleteAllCheckbox = document.getElementById('delete-all-instances-checkbox');
    const deleteAllInstances = deleteAllCheckbox ? deleteAllCheckbox.checked : false; // 'false' par défaut si introuvable

    // Logique de vérification des ID
    // Si on ne supprime PAS tout, on a besoin d'un position_id
    // Si on supprime TOUT, on a juste besoin du geoCodeId et du plan_id
    if (!geoCodeId || !plan_id || (!deleteAllInstances && !position_id)) {
        console.error(`ERROR: Cannot delete ${elementType} ${code_geo}. Missing ID data:`, customData);
        showToast(`Erreur suppression ${code_geo}. Données ID manquantes.`, "danger");
        return;
    }

    // Préparer le message de confirmation
    let confirmMsg = `Voulez-vous vraiment supprimer ${elementType} "${code_geo}" ?`;
    if (deleteAllInstances) {
        // Essayer de récupérer le compte (s'il est stocké dans customData)
        const count = customData.count || '?'; 
        confirmMsg = `Voulez-vous vraiment supprimer TOUTES les ${count} instances de "${code_geo}" de ce plan ?`;
    }

    if (!confirm(confirmMsg)) {
        return;
    }

    showLoading('Suppression...');
    try {
        let success;
        // La variable 'deleteAllInstances' est maintenant définie et utilisable
        if (deleteAllInstances) {
            console.log(`Calling API removeMultiplePositions with geoCodeId=${geoCodeId}, planId=${plan_id}`);
            success = await removeMultiplePositions(geoCodeId, plan_id);
        } else {
            console.log(`Calling API removePosition with positionId=${position_id}`);
            success = await removePosition(position_id);
        }

        if (success) {
            // Supprimer les objets du canvas
            if (deleteAllInstances) {
                // Trouver tous les objets avec le même geoCodeId
                const objectsToRemove = fabricCanvas.getObjects().filter(obj =>
                    (obj.customData?.isGeoTag || obj.customData?.isPlacedText) &&
                    obj.customData.id === geoCodeId
                );
                objectsToRemove.forEach(obj => fabricCanvas.remove(obj));
            } else {
                // Supprimer juste la cible
                fabricCanvas.remove(target);
            }
            fabricCanvas.requestRenderAll();

            showToast(`${elementType} "${code_geo}" supprimé(s).`, "success");

            await fetchAndClassifyCodes(); // Rafraîchir la sidebar

            fabricCanvas.discardActiveObject(); // Force la désélection
            hideToolbar(); // Cacher la toolbar après suppression

        } else {
            showToast(`La suppression de ${code_geo} a échoué côté serveur.`, "warning");
        }
    } catch (error) {
        console.error(`API error deleting ${elementType}:`, error);
        showToast(`Erreur suppression ${code_geo}: ${error.message}`, "danger");
    } finally {
        hideLoading();
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
