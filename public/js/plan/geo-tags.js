/**
 * Module pour la gestion des tags géo (création, modification, suppression, toolbar, flèches).
 * CORRECTION: Ajout de 'export' pour addArrowToTag et correction customData.codeGeo
 */
import { GEO_TAG_FONT_SIZE, sizePresets } from '../modules/config.js';
import { convertPercentToPixels, convertPixelsToPercent } from '../modules/utils.js';
import { savePosition, removePosition, removeMultiplePositions } from '../modules/api.js';
import { getCanvasInstance } from './canvas.js';
import { updateCodeCountInSidebar } from './sidebar.js'; // Assurez-vous d'exporter cette fonction

let fabricCanvas;
let tagToolbar;
let deleteTagBtn, highlightTagBtn, arrowTagBtn;
let sizeBtns;
let universColors = {}; // Sera défini à l'init

let selectedFabricObject = null; // Le tag géo actuellement sélectionné
let highlightedCodeGeo = null;   // Le code géo dont toutes les instances sont surlignées
let isDrawingArrowMode = false;  // État pour savoir si on place la pointe d'une flèche

/**
 * Initialise le module Geo Tags.
 * @param {fabric.Canvas} canvasInstance - L'instance du canvas Fabric.
 * @param {object} uColors - L'objet des couleurs par univers.
 */
export function initializeGeoTags(canvasInstance, uColors) {
    fabricCanvas = canvasInstance;
    universColors = uColors;

    // Récupérer les éléments de la toolbar
    tagToolbar = document.getElementById('tag-edit-toolbar');
    deleteTagBtn = document.getElementById('toolbar-delete');
    highlightTagBtn = document.getElementById('toolbar-highlight');
    arrowTagBtn = document.getElementById('toolbar-arrow');
    sizeBtns = document.querySelectorAll('.size-btn');

    // Ajouter les écouteurs pour la toolbar
    if (deleteTagBtn) deleteTagBtn.addEventListener('click', deleteSelectedTag);
    if (highlightTagBtn) highlightTagBtn.addEventListener('click', toggleHighlightSelected);
    if (arrowTagBtn) arrowTagBtn.addEventListener('click', startDrawingArrow);
    sizeBtns?.forEach(btn => btn.addEventListener('click', changeSelectedTagSize));

    console.log("Module Geo Tags initialisé.");
}

/**
 * Crée un objet groupe Fabric pour représenter un tag géo.
 * @param {object} codeData - Données complètes du code géo incluant sa position.
 * @returns {fabric.Group | null} Le groupe Fabric créé ou null si erreur.
 */
export function createFabricTag(codeData) {
    if (!fabricCanvas) {
        console.error("createFabricTag: Canvas non initialisé.");
        return null;
    }
    const bg = fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group');

    // Vérification cruciale des données de position
    if (codeData.pos_x === null || typeof codeData.pos_x === 'undefined' ||
        codeData.pos_y === null || typeof codeData.pos_y === 'undefined') {
        console.warn(`createFabricTag: Position (pos_x, pos_y) invalide ou manquante pour ${codeData.code_geo || codeData.codeGeo}. Tag non créé.`);
        return null;
    }
    if (!bg) {
        console.warn("createFabricTag: Image/SVG de fond non trouvé. Tag non créé pour", codeData.code_geo || codeData.codeGeo);
        return null;
    }

    const { left, top } = convertPercentToPixels(codeData.pos_x, codeData.pos_y, fabricCanvas);
    if (isNaN(left) || isNaN(top)) {
        console.error(`createFabricTag: Coordonnées pixels invalides (NaN) pour ${codeData.code_geo || codeData.codeGeo}`);
        return null;
    }

    const bgColor = universColors[codeData.univers] || '#7f8c8d';
    // Accepte code_geo (BDD) ou codeGeo (JS/Dataset)
    const codeText = codeData.code_geo || codeData.codeGeo || 'ERR';
    const tagWidth = codeData.width || sizePresets.medium.width;
    const tagHeight = codeData.height || sizePresets.medium.height;

    const rect = new fabric.Rect({
        width: tagWidth,
        height: tagHeight,
        fill: bgColor,
        stroke: 'black',
        strokeWidth: 1 / fabricCanvas.getZoom(), // Adapter au zoom initial
        rx: 3, ry: 3,
        originX: 'center', originY: 'center',
        shadow: 'rgba(0,0,0,0.3) 2px 2px 4px'
    });

    const text = new fabric.Text(codeText, {
        fontSize: GEO_TAG_FONT_SIZE,
        fill: 'white',
        fontWeight: 'bold',
        fontFamily: 'Arial',
        originX: 'center', originY: 'center'
    });

    // --- CORRECTION CUSTOM DATA ---
    const group = new fabric.Group([rect, text], {
        left: left,
        top: top,
        originX: 'center', originY: 'center',
        selectable: true, evented: true,
        hasControls: false, hasBorders: true, // Afficher bordure de sélection
        borderColor: '#007bff', cornerSize: 0, transparentCorners: true,
        lockRotation: true, lockScalingX: true, lockScalingY: true,
        hoverCursor: 'move',
        customData: {
            ...codeData, // Inclut id, code_geo, libelle, univers, commentaire, position_id, plan_id etc.
            // Assurer la présence de codeGeo (camelCase) pour les fonctions JS ultérieures
            codeGeo: codeData.code_geo || codeData.codeGeo, // Copie depuis l'une ou l'autre source
            isGeoTag: true,
            currentWidth: tagWidth,
            currentHeight: tagHeight,
            anchorXPercent: codeData.anchor_x,
            anchorYPercent: codeData.anchor_y
        }
    });
    // --- FIN CORRECTION ---

    // Ajouter la flèche si les données d'ancre existent
    if (group.customData.anchorXPercent !== null && typeof group.customData.anchorXPercent !== 'undefined' &&
        group.customData.anchorYPercent !== null && typeof group.customData.anchorYPercent !== 'undefined') {
        addArrowToTag(group); // Utilise les données dans customData
    }

    fabricCanvas.add(group);
    group.moveTo(999); // S'assurer que les tags sont au-dessus des dessins
    updateHighlightEffect(group); // Appliquer l'effet de surlignage initial si nécessaire

    return group;
}

/**
 * Ajoute ou met à jour la flèche d'un tag géo.
 * @param {fabric.Group} tagGroup - Le groupe Fabric du tag.
 */
export function addArrowToTag(tagGroup) {
    // Vérifier si tagGroup et customData existent
    if (!tagGroup || !tagGroup.customData) {
        console.warn("addArrowToTag: tagGroup ou customData invalide.");
        return;
    }
    const { anchorXPercent, anchorYPercent } = tagGroup.customData;

    if (anchorXPercent === null || typeof anchorXPercent === 'undefined' || anchorYPercent === null || typeof anchorYPercent === 'undefined') {
        // Si les ancres sont nulles, supprimer la flèche existante
        if (tagGroup.arrowLine) {
            fabricCanvas.remove(tagGroup.arrowLine);
            tagGroup.arrowLine = null;
            fabricCanvas.requestRenderAll();
        }
        return;
    }

    const tagCenter = tagGroup.getCenterPoint();
    const anchorGlobal = convertPercentToPixels(anchorXPercent, anchorYPercent, fabricCanvas);

    if (isNaN(anchorGlobal.left) || isNaN(anchorGlobal.top)) {
        console.error("addArrowToTag - Coordonnées d'ancre globales invalides (NaN).");
        return;
    }

    const currentZoom = fabricCanvas.getZoom();
    const strokeW = 2 / currentZoom;

    if (tagGroup.arrowLine) {
        tagGroup.arrowLine.set({
            x1: tagCenter.x, y1: tagCenter.y,
            x2: anchorGlobal.left, y2: anchorGlobal.top,
            strokeWidth: strokeW
        });
    } else {
        tagGroup.arrowLine = new fabric.Line([tagCenter.x, tagCenter.y, anchorGlobal.left, anchorGlobal.top], {
            stroke: '#34495e', strokeWidth: strokeW,
            selectable: false, evented: false,
            originX: 'center', originY: 'center',
            excludeFromExport: true // Ne pas inclure dans toJSON/toSVG
        });
        fabricCanvas.add(tagGroup.arrowLine);
    }
    // S'assurer que la flèche est juste derrière le tag
    tagGroup.arrowLine.moveTo(fabricCanvas.getObjects().indexOf(tagGroup));
    tagGroup.arrowLine.setCoords();
    fabricCanvas.requestRenderAll();
}


/**
 * Gère la modification (déplacement, redimensionnement implicite via bouton) d'un tag géo.
 * Appelée par l'event 'object:modified' du canvas.
 * @param {fabric.Object} target - L'objet Fabric modifié (le tag géo).
 */
export async function handleGeoTagModified(target) {
    // Vérification renforcée
    if (!target || !target.customData || !target.customData.isGeoTag) {
        console.warn("handleGeoTagModified appelé avec une cible invalide:", target);
        return;
    }

    // Assurer que codeGeo est défini (au cas où la correction createFabricTag n'aurait pas suffi)
    const codeGeo = target.customData.codeGeo || target.customData.code_geo || 'INCONNU';
    console.log("Geo Tag modifié:", codeGeo);

    // Vérifier que les IDs nécessaires sont présents et valides
    const { position_id, id: geoCodeId, currentWidth, currentHeight, anchorXPercent, anchorYPercent, plan_id } = target.customData;
    if (!geoCodeId || !position_id || !plan_id) {
         console.error(`ERREUR: Impossible de sauvegarder la modification du tag ${codeGeo}. Données ID manquantes:`, target.customData);
         showToast(`Erreur: Impossible de sauvegarder les modifications pour ${codeGeo} (données manquantes).`, "danger");
         // Optionnel : Revenir à la position précédente ? Difficile sans état précédent.
         return;
    }

    // Calculer la nouvelle position centrale en pourcentage
    const centerPoint = target.getCenterPoint();
    const { posX, posY } = convertPixelsToPercent(centerPoint.x, centerPoint.y, fabricCanvas);

    const positionData = {
        id: geoCodeId, // ID du code Géo
        position_id: position_id, // ID unique de ce placement
        plan_id: plan_id, // ID du plan
        pos_x: posX,
        pos_y: posY,
        width: currentWidth, // La taille est gérée par les boutons
        height: currentHeight,
        anchor_x: anchorXPercent,
        anchor_y: anchorYPercent
    };

    console.log("Sauvegarde de la position modifiée:", positionData);
    try {
        const savedData = await savePosition(positionData);
        if (savedData) {
            console.log("Position sauvegardée avec succès:", savedData);
            // Mettre à jour les customData si l'ID de position a été créé (ne devrait pas arriver ici)
            // Mettre à jour les pourcentages réels sauvegardés pour être précis
            target.customData.pos_x = savedData.pos_x;
            target.customData.pos_y = savedData.pos_y;
        } else {
            console.error("La sauvegarde de la position a échoué (API n'a pas retourné de données).");
            showToast(`Échec sauvegarde ${codeGeo}.`, "warning");
        }
    } catch (error) {
        console.error("Erreur API lors de la sauvegarde de la position:", error);
        showToast(`Erreur sauvegarde ${codeGeo}: ${error.message}`, "danger");
    }

    // Redessiner la flèche si elle existe ou si des ancres sont définies
    if (target.arrowLine || (anchorXPercent !== null && anchorYPercent !== null)) {
        addArrowToTag(target);
    }
    showToolbar(target); // Réafficher la toolbar au cas où
}


// --- Gestion Toolbar Tag ---

/**
 * Affiche la toolbar d'édition au-dessus du tag sélectionné.
 * @param {fabric.Group} target - Le tag géo sélectionné.
 */
export function showToolbar(target) {
    if (!tagToolbar || !target?.customData?.isGeoTag) {
        hideToolbar();
        return;
    }
    selectedFabricObject = target; // Met à jour la sélection globale

    // Utiliser requestAnimationFrame pour s'assurer que le rendu Fabric est terminé
    fabric.util.requestAnimFrame(() => {
        if (!target || !target.canvas) { // Vérifie si l'objet est toujours sur le canvas
            hideToolbar();
            return;
        }
        const bound = target.getBoundingRect();

        // Calcul position toolbar
        const toolbarTop = bound.top - (tagToolbar.offsetHeight || 40) - 5; // Hauteur approx si offsetHeight=0
        const toolbarLeft = bound.left + bound.width / 2 - (tagToolbar.offsetWidth || 150) / 2;

        // Contraintes pour rester dans le canvas visible
        const canvasRect = fabricCanvas.getElement().getBoundingClientRect();
        const finalLeft = Math.max(0, Math.min(toolbarLeft, canvasRect.width - (tagToolbar.offsetWidth || 150)));
        const finalTop = Math.max(0, Math.min(toolbarTop, canvasRect.height - (tagToolbar.offsetHeight || 40)));

        tagToolbar.style.left = `${finalLeft}px`;
        tagToolbar.style.top = `${finalTop}px`;

        tagToolbar.style.opacity = '1';
        tagToolbar.style.transform = 'translateY(0)';
        tagToolbar.style.pointerEvents = 'auto';
        tagToolbar.classList.add('visible');
    });
}

/** Cache la toolbar d'édition. */
export function hideToolbar() {
    if (tagToolbar) {
        tagToolbar.style.opacity = '0';
        tagToolbar.style.transform = 'translateY(10px)'; // Petit effet de glissement
        tagToolbar.style.pointerEvents = 'none';
        tagToolbar.classList.remove('visible');
    }
    // selectedFabricObject = null; // Ne pas déselectionner ici, géré par les events Fabric
}

/** Supprime le tag géo sélectionné (et éventuellement toutes ses instances). */
async function deleteSelectedTag() {
    if (!selectedFabricObject?.customData?.isGeoTag) return;

    // Vérifier à nouveau la présence des ID nécessaires
    const { position_id, id: geoCodeId, codeGeo, plan_id } = selectedFabricObject.customData;
    if (!geoCodeId || !position_id || !plan_id) {
         console.error(`ERREUR: Impossible de supprimer le tag. Données ID manquantes:`, selectedFabricObject.customData);
         showToast("Erreur: Impossible de supprimer ce tag (données manquantes).", "danger");
         return;
    }

    const allInstances = fabricCanvas.getObjects().filter(o => o.customData?.isGeoTag && o.customData.id === geoCodeId);
    let performDelete = false;
    let deleteAllInstances = false;

    // Demander confirmation
    if (allInstances.length > 1) {
        if (confirm(`Voulez-vous supprimer toutes les ${allInstances.length} instances de "${codeGeo}" sur ce plan ?`)) {
            performDelete = true;
            deleteAllInstances = true;
        } else if (confirm(`Supprimer uniquement cette instance de "${codeGeo}" ?`)) {
            performDelete = true;
        }
    } else if (confirm(`Supprimer le tag "${codeGeo}" ?`)) {
        performDelete = true;
    }

    if (!performDelete) return;

    try {
        const success = deleteAllInstances
            ? await removeMultiplePositions(geoCodeId, plan_id)
            : await removePosition(position_id);

        if (success) {
            console.log(`Suppression réussie (${deleteAllInstances ? 'toutes instances' : 'instance unique'})`);
            // Calculer le delta correct pour le compteur
            const delta = deleteAllInstances ? -allInstances.length : -1;
            // Supprimer les objets Fabric correspondants
            (deleteAllInstances ? allInstances : [selectedFabricObject]).forEach(tag => {
                if (tag.arrowLine) fabricCanvas.remove(tag.arrowLine);
                fabricCanvas.remove(tag);
            });
            updateCodeCountInSidebar(geoCodeId, delta); // Utiliser le delta calculé
            fabricCanvas.discardActiveObject().renderAll(); // Désélectionne et redessine
            hideToolbar();
        } else {
             console.error("L'API a retourné une erreur lors de la suppression.");
            alert("Erreur lors de la suppression du tag (réponse API négative).");
        }
    } catch (error) {
         console.error("Erreur lors de l'appel API de suppression:", error);
        alert(`Erreur lors de la suppression : ${error.message}`);
    }
}

/** Change la taille du tag sélectionné selon un preset ('small', 'medium', 'large'). */
async function changeSelectedTagSize(event) {
    const size = event.currentTarget.dataset.size;
    if (!selectedFabricObject?.customData?.isGeoTag || !sizePresets[size]) return;

    const preset = sizePresets[size];
    const target = selectedFabricObject;
    const { customData } = target;

     // Vérifier les IDs avant de continuer
     if (!customData.id || !customData.position_id || !customData.plan_id) {
        console.error(`ERREUR: Impossible de changer la taille du tag ${customData.codeGeo}. Données ID manquantes:`, customData);
        showToast(`Erreur: Impossible de changer la taille (données manquantes).`, "danger");
        return;
    }

    // Mettre à jour la taille du rectangle dans le groupe
    target.item(0).set({ width: preset.width, height: preset.height });

    // Forcer la mise à jour du groupe pour recalculer ses dimensions et sa position
    target.addWithUpdate(); // Important pour que le groupe s'adapte
    target.setCoords();   // Recalculer les coordonnées de contrôle

    fabricCanvas.renderAll();

    // Sauvegarder la nouvelle taille via l'API
    const { posX, posY } = convertPixelsToPercent(target.getCenterPoint().x, target.getCenterPoint().y, fabricCanvas);
    const positionData = {
        id: customData.id,
        position_id: customData.position_id,
        plan_id: customData.plan_id,
        pos_x: posX,
        pos_y: posY,
        width: preset.width,
        height: preset.height,
        anchor_x: customData.anchorXPercent,
        anchor_y: customData.anchorYPercent
    };

    try {
        const savedData = await savePosition(positionData);
        if (savedData) {
            // Mettre à jour les customData avec les nouvelles tailles
            customData.currentWidth = preset.width;
            customData.currentHeight = preset.height;
            customData.width = preset.width; // Mettre à jour aussi width/height pour cohérence
            customData.height = preset.height;
             console.log("Taille tag mise à jour et sauvegardée:", customData.codeGeo, preset);
        } else {
             console.error("Échec sauvegarde changement taille (API).");
             showToast(`Échec sauvegarde taille ${customData.codeGeo}.`, "warning");
        }
    } catch (error) {
        console.error("Erreur API changement taille:", error);
        showToast(`Erreur sauvegarde taille ${customData.codeGeo}: ${error.message}`, "danger");
    }
    showToolbar(target); // Garder la toolbar visible
}


// --- Gestion Surlignage ---

/** Active/désactive le surlignage de toutes les instances du tag sélectionné. */
function toggleHighlightSelected() {
    if (!selectedFabricObject?.customData?.isGeoTag) return;

    const codeToHighlight = selectedFabricObject.customData.codeGeo;
    if (highlightedCodeGeo === codeToHighlight) {
        highlightedCodeGeo = null; // Désactive le surlignage
        console.log("Surlignage désactivé.");
    } else {
        highlightedCodeGeo = codeToHighlight; // Active pour ce code
        console.log(`Surlignage activé pour: ${highlightedCodeGeo}`);
    }
    redrawAllTagsHighlight(); // Applique l'effet à tous les objets
}

/** Redessine tous les objets pour appliquer/retirer l'effet de surlignage. */
export function redrawAllTagsHighlight() {
    if (!fabricCanvas) return;
    fabricCanvas.getObjects().forEach(updateHighlightEffect);
    fabricCanvas.renderAll();
}

/**
 * Applique l'effet visuel de surlignage (ou d'atténuation) à un objet Fabric.
 * @param {fabric.Object} fabricObj - L'objet à traiter.
 */
function updateHighlightEffect(fabricObj) {
    if (!fabricObj || fabricObj.isGridLine || !fabricObj.visible) return; // Ignore grille et objets invisibles

    const isTag = fabricObj.customData?.isGeoTag;
    const isActiveSelection = fabricCanvas.getActiveObject() === fabricObj;
    let isHighlightedInstance = false;

    if (isTag && highlightedCodeGeo && fabricObj.customData) { // Vérifier customData
        isHighlightedInstance = fabricObj.customData.codeGeo === highlightedCodeGeo;
    }

    // Définir l'opacité
    let opacity = 1.0;
    if (highlightedCodeGeo) { // Si un surlignage est actif
        if (!isTag || !isHighlightedInstance) {
            opacity = 0.3; // Atténue tout ce qui n'est pas le tag surligné
        }
    }
    // Si pas de surlignage actif, tous les objets sont opaques
    fabricObj.set({ opacity });

    // Définir le style de bordure pour les tags géo
    if (isTag && fabricObj.item && fabricObj.item(0)) { // Vérifie que le groupe et son rect existent
        const rect = fabricObj.item(0);
        let strokeColor = 'black';
        let strokeW = 1 / fabricCanvas.getZoom(); // Base stroke width

        if (isActiveSelection) {
            strokeColor = '#007bff'; // Bleu pour la sélection active
            strokeW = 2 / fabricCanvas.getZoom();
        } else if (isHighlightedInstance) {
            strokeColor = '#ffc107'; // Jaune pour les instances surlignées (non actives)
            strokeW = 2 / fabricCanvas.getZoom();
        }

        rect.set({ stroke: strokeColor, strokeWidth: strokeW });
    }

    // Appliquer l'opacité à la flèche si elle existe
    if (fabricObj.arrowLine) {
        fabricObj.arrowLine.set({ opacity });
    }
}


// --- Gestion Flèches ---

/** Passe en mode dessin de flèche pour le tag sélectionné. */
function startDrawingArrow() {
    if (!selectedFabricObject?.customData?.isGeoTag) return;
    isDrawingArrowMode = true;
    alert("Cliquez sur le plan où la flèche doit pointer (ou Echap pour annuler).");
    fabricCanvas.defaultCursor = 'crosshair';
    fabricCanvas.discardActiveObject(); // Désélectionne pour éviter interférence
    hideToolbar();
}

/**
 * Gère le clic pour définir le point d'ancrage de la flèche.
 * Appelée par le 'mouse:down' du canvas quand isDrawingArrowMode est true.
 * @param {object} opt - Options de l'événement Fabric ('target', 'e', 'pointer').
 */
export function handleArrowEndPoint(opt) {
    // Vérifie si on est bien en mode flèche et qu'un tag était sélectionné AVANT ce clic
    if (!isDrawingArrowMode || !selectedFabricObject?.customData?.isGeoTag || !opt?.pointer) {
        cancelArrowDrawing();
        return;
    }

    const target = selectedFabricObject; // Le tag pour lequel on dessine la flèche
    const pointer = opt.pointer; // Coordonnées du clic {x, y}

    // Vérifier les IDs avant de continuer
     if (!target.customData.id || !target.customData.position_id || !target.customData.plan_id) {
        console.error(`ERREUR: Impossible d'ajouter la flèche au tag ${target.customData.codeGeo}. Données ID manquantes:`, target.customData);
        showToast(`Erreur: Impossible d'ajouter la flèche (données manquantes).`, "danger");
        cancelArrowDrawing();
        return;
    }

    // Convertir le point cliqué en pourcentage par rapport au fond
    const { posX, posY } = convertPixelsToPercent(pointer.x, pointer.y, fabricCanvas);

    // Mettre à jour les customData du tag
    target.customData.anchorXPercent = posX;
    target.customData.anchorYPercent = posY;

    // Dessiner/Mettre à jour la flèche visuellement
    addArrowToTag(target);

    // Sauvegarder la nouvelle position de l'ancre via l'API
    // On récupère les autres données du tag pour l'appel API
    const currentPos = convertPixelsToPercent(target.getCenterPoint().x, target.getCenterPoint().y, fabricCanvas);
    const { position_id, id: geoCodeId, currentWidth, currentHeight, plan_id } = target.customData;

    savePosition({
        id: geoCodeId,
        position_id: position_id,
        plan_id: plan_id,
        pos_x: currentPos.posX, // La position du tag n'a pas changé
        pos_y: currentPos.posY,
        width: currentWidth,
        height: currentHeight,
        anchor_x: posX, // Nouvelle ancre X
        anchor_y: posY  // Nouvelle ancre Y
    }).then(savedData => {
         console.log("Ancre de flèche sauvegardée:", savedData);
    }).catch(error => {
        console.error("Erreur sauvegarde ancre flèche:", error);
        showToast(`Erreur sauvegarde ancre: ${error.message}`, "danger");
        // Annuler visuellement l'ajout de la flèche
        target.customData.anchorXPercent = null;
        target.customData.anchorYPercent = null;
        addArrowToTag(target); // Pour supprimer la flèche visuellement
    });

    cancelArrowDrawing(); // Sortir du mode dessin de flèche

    // Resélectionner le tag après un court délai pour que la toolbar s'affiche
    setTimeout(() => {
        if (target && target.canvas) { // Vérifier si toujours sur canvas
            fabricCanvas.setActiveObject(target).renderAll();
            showToolbar(target);
        }
    }, 50);
}

/** Annule le mode dessin de flèche. */
export function cancelArrowDrawing() {
    isDrawingArrowMode = false;
    // Restaurer le curseur par défaut (sera géré par setActiveTool si un outil de dessin est actif)
    if (fabricCanvas) { // S'assurer que le canvas existe
        const currentTool = document.querySelector('.tool-btn.active')?.dataset.tool || 'select';
        fabricCanvas.defaultCursor = (currentTool === 'select') ? 'default' : 'crosshair';
        fabricCanvas.setCursor(fabricCanvas.defaultCursor); // Appliquer immédiatement
    }
}

/**
 * Retourne si le mode dessin de flèche est actif.
 * Utilisé par le gestionnaire mousedown principal.
 * @returns {boolean}
 */
export function getIsDrawingArrowMode() {
    return isDrawingArrowMode;
}
