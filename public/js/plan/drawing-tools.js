/**
 * Module pour la gestion des outils de dessin (formes+texte, styles, copier/coller, grouper).
 * VERSION MISE A JOUR AVEC EXPORTS CORRIGÉS
 */
import { getCanvasInstance, updateStrokesWidth, snapToGrid } from './canvas.js';
import { getIsSnapEnabled } from './canvas.js'; // Pour utiliser la valeur de snap
import { showToast } from '../modules/utils.js'; // Pour les notifications

let fabricCanvas;
let drawingToolbarEl;
let toolBtns;
let strokeColorInput, strokeWidthInput, fillShapeToggle, fillColorInput;
let copyBtn, pasteBtn, deleteShapeBtn, groupBtn, ungroupBtn;

let currentDrawingTool = 'select'; // Outil actif
let isDrawing = false;             // État: en train de dessiner une forme ?
let startPoint = null;             // Point de départ du dessin
let currentShape = null;           // Forme en cours de dessin (peut être un groupe)
let fabricClipboard = null;        // Presse-papier pour copier/coller

/**
 * Initialise le module des outils de dessin.
 * @param {fabric.Canvas} canvasInstance - L'instance du canvas Fabric.
 */
export function initializeDrawingTools(canvasInstance) {
    fabricCanvas = canvasInstance;

    drawingToolbarEl = document.getElementById('drawing-toolbar');
    if (!drawingToolbarEl) {
        console.warn("Barre d'outils de dessin non trouvée.");
        return; // Ne pas continuer si la barre n'existe pas
    }

    toolBtns = drawingToolbarEl.querySelectorAll('.tool-btn');
    strokeColorInput = document.getElementById('stroke-color');
    strokeWidthInput = document.getElementById('stroke-width');
    fillShapeToggle = document.getElementById('fill-shape-toggle');
    fillColorInput = document.getElementById('fill-color');
    copyBtn = document.getElementById('copy-btn');
    pasteBtn = document.getElementById('paste-btn');
    deleteShapeBtn = document.getElementById('delete-shape-btn');
    groupBtn = document.getElementById('group-btn');
    ungroupBtn = document.getElementById('ungroup-btn');

    addEventListeners();
    setActiveTool('select'); // Outil par défaut
    updateFillColorVisibility(); // Afficher/cacher couleur remplissage initiale
    console.log("Module Drawing Tools initialisé.");
}

/** Ajoute les écouteurs pour les outils de dessin */
function addEventListeners() {
    toolBtns?.forEach(btn => btn.addEventListener('click', () => setActiveTool(btn.dataset.tool)));
    strokeColorInput?.addEventListener('input', updateDrawingStyle);
    strokeWidthInput?.addEventListener('input', updateDrawingStyle);
    fillShapeToggle?.addEventListener('change', () => {
        updateFillColorVisibility();
        updateDrawingStyle(); // Appliquer le changement de remplissage à la sélection
    });
    fillColorInput?.addEventListener('input', updateDrawingStyle);
    
    // Les boutons appellent maintenant les versions exportées
    copyBtn?.addEventListener('click', copyShape);
    pasteBtn?.addEventListener('click', pasteShape);
    deleteShapeBtn?.addEventListener('click', deleteSelectedShape);
    groupBtn?.addEventListener('click', groupSelectedObjects);
    ungroupBtn?.addEventListener('click', ungroupSelectedObject);
}

/**
 * Définit l'outil de dessin actif et configure le canvas Fabric en conséquence.
 * @param {string} tool - Le nom de l'outil ('select', 'line', 'rect', 'circle', 'text').
 */
export function setActiveTool(tool) {
    if (!fabricCanvas) return;
    currentDrawingTool = tool;

    // Le mode dessin libre n'est plus utilisé ici
    fabricCanvas.isDrawingMode = false;
    fabricCanvas.selection = (tool === 'select'); // Activer/désactiver la sélection multiple

    // Configurer les curseurs
    fabricCanvas.defaultCursor = (tool === 'select') ? 'default' : 'crosshair';
    fabricCanvas.hoverCursor = (tool === 'select') ? 'move' : 'crosshair'; // 'move' pour les objets sélectionnables

    // Configurer la sélectionnabilité des objets existants
    fabricCanvas.getObjects().forEach(obj => {
        // Les tags géo restent toujours sélectionnables/déplaçables
        // Les autres objets ne sont sélectionnables qu'avec l'outil 'select'
        const isSelectable = (tool === 'select') || (obj.customData?.isGeoTag);
        obj.set({
            selectable: isSelectable,
            evented: isSelectable // Permet de recevoir les événements souris
        });
        // Si c'est un groupe forme+texte, rendre le texte interne non sélectionnable individuellement
        if (obj.type === 'group' && obj._objects?.length === 2 && obj._objects[1].type === 'i-text') {
             obj._objects[1].set({ selectable: false, evented: false });
        }
    });

    // Mettre à jour l'état visuel des boutons d'outils
    toolBtns?.forEach(btn => btn.classList.toggle('active', btn.dataset.tool === tool));

    fabricCanvas.discardActiveObject().renderAll(); // Désélectionner et redessiner
    console.log(`Outil actif: ${tool}`);
}

/** @returns {string} L'outil de dessin actuellement sélectionné. */
export function getCurrentDrawingTool() {
    return currentDrawingTool;
}

/** Démarre le dessin d'une forme ou place un texte (appelé par mouse:down). */
export function startDrawing(pointer) {
    if (currentDrawingTool === 'select' || currentDrawingTool === 'text') return; // L'outil texte est géré au clic dans main.js

    isDrawing = true;
    startPoint = pointer; // Coordonnées déjà ajustées pour le snap si besoin
    const strokeColor = strokeColorInput?.value || '#000000';
    const baseStrokeWidth = parseInt(strokeWidthInput?.value || '2', 10);
    const fillColor = fillShapeToggle?.checked ? (fillColorInput?.value || '#cccccc') : 'transparent';
    const zoom = fabricCanvas.getZoom();

    const options = { // Options de style pour la FORME
        stroke: strokeColor,
        strokeWidth: baseStrokeWidth / zoom,
        fill: fillColor,
        selectable: false, // Non sélectionnable pendant le dessin
        evented: false,
        originX: 'left',
        originY: 'top',
        // baseStrokeWidth sera stocké sur le GROUPE
    };

    let shape; // La forme géométrique (Line, Rect, Ellipse...)
    let text;  // L'objet texte éditable (pour Rect et Circle)

    switch (currentDrawingTool) {
        case 'line':
            currentShape = new fabric.Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], {
                 ...options,
                 baseStrokeWidth: baseStrokeWidth // Stocker sur la ligne directement
             });
            break;
        case 'rect':
            shape = new fabric.Rect({
                left: 0, top: 0, width: 0, height: 0,
                originX: 'left', originY: 'top',
                fill: options.fill, stroke: options.stroke, strokeWidth: options.strokeWidth
            });
            text = new fabric.IText('', { // Texte initial vide
                left: 5 / zoom, top: 5 / zoom, // Marge interne ajustée au zoom
                fontSize: 16 / zoom,
                fill: strokeColor, // Couleur du texte = couleur du trait
                originX: 'left', originY: 'top',
                selectable: false, evented: false, // Rendu sélectionnable au double clic
                padding: 2 / zoom
            });
            currentShape = new fabric.Group([shape, text], {
                left: startPoint.x, top: startPoint.y,
                originX: 'left', originY: 'top',
                selectable: false, evented: false,
                baseStrokeWidth: baseStrokeWidth, // Stocker sur le groupe
                subTargetCheck: true // Important pour détecter le double clic sur le texte
            });
            break;
        case 'circle':
            shape = new fabric.Ellipse({
                left: 0, top: 0, rx: 0, ry: 0,
                originX: 'center', originY: 'center', // Centre pour ellipse dans le groupe
                fill: options.fill, stroke: options.stroke, strokeWidth: options.strokeWidth
            });
            text = new fabric.IText('', {
                left: 0, top: 0, // Centré dans le groupe
                fontSize: 16 / zoom,
                fill: strokeColor,
                originX: 'center', originY: 'center',
                textAlign: 'center',
                selectable: false, evented: false,
                padding: 2 / zoom
            });
            currentShape = new fabric.Group([shape, text], {
                left: startPoint.x, top: startPoint.y,
                originX: 'center', originY: 'center', // Groupe centré au point de départ
                selectable: false, evented: false,
                baseStrokeWidth: baseStrokeWidth,
                subTargetCheck: true
            });
            break;
    }

    if (currentShape) {
        fabricCanvas.add(currentShape);
        console.log(`Début dessin: ${currentDrawingTool}`);
    }
}

/** Continue le dessin de la forme (appelé par mouse:move). */
export function continueDrawing(pointer) {
    if (!isDrawing || !currentShape) return;

    let { x, y } = getIsSnapEnabled() ? snapToGrid(pointer.x, pointer.y) : pointer;
    const zoom = fabricCanvas.getZoom();

    if (currentShape.type === 'group' && currentShape._objects?.length === 2) {
        const shape = currentShape._objects[0]; // La forme (Rect ou Ellipse)
        const text = currentShape._objects[1];  // Le texte

        if (shape.type === 'rect') {
            const width = Math.abs(x - startPoint.x);
            const height = Math.abs(y - startPoint.y);
            const newLeft = Math.min(x, startPoint.x);
            const newTop = Math.min(y, startPoint.y);

            currentShape.set({ left: newLeft, top: newTop }); // Position du groupe
            // Taille de la forme DANS le groupe (l'origine est 0,0)
            shape.set({ width: width, height: height });
            // Position/taille du texte DANS le groupe
            text.set({
                 left: 5 / zoom,
                 top: 5 / zoom,
                 width: Math.max(0, width - 10 / zoom), // Largeur max texte avec marges
                 fontSize: 16 / zoom // Garder la taille de police constante pendant le dessin
             });

            currentShape.addWithUpdate(); // Recalcule la taille du groupe

        } else if (shape.type === 'ellipse') {
            const dx = x - startPoint.x;
            const dy = y - startPoint.y;
            // Utiliser la plus grande dimension pour un cercle 'inscrit' dans le rectangle de dessin
            const radius = Math.max(Math.abs(dx), Math.abs(dy)) / 2;
            const groupCenterX = startPoint.x + dx / 2;
            const groupCenterY = startPoint.y + dy / 2;

            currentShape.set({ left: groupCenterX, top: groupCenterY }); // Position du groupe
            shape.set({ rx: radius, ry: radius }); // Taille de l'ellipse DANS le groupe
            text.set({
                width: Math.max(0, radius * 1.6 - 10 / zoom), // Limiter largeur texte
                fontSize: 16 / zoom
             });

            currentShape.addWithUpdate();
        }
    } else if (currentShape.type === 'line') {
        currentShape.set({ x2: x, y2: y });
    }
    currentShape?.setCoords(); // Mettre à jour les coordonnées de contrôle
    fabricCanvas.requestRenderAll(); // Demander un rendu (optimisé par Fabric)
}

/** Termine le dessin de la forme (appelé par mouse:up). */
export function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentShape) {
        // Rendre la forme sélectionnable
        currentShape.set({ selectable: true, evented: true });

        // Ajustements finaux pour les groupes (origines)
        if (currentShape.type === 'group') {
             const shape = currentShape._objects[0];
             // Si c'est un rectangle, son origine dans le groupe doit être left/top
             if (shape.type === 'rect') {
                 currentShape.set({ originX: 'left', originY: 'top' });
                 shape.set({ originX: 'left', originY: 'top' });
                 // Le texte garde son origine left/top avec le padding
                 // currentShape.addWithUpdate(); // Potentiellement pas nécessaire ici
             }
             // Pour l'ellipse, l'origine du groupe et de l'ellipse est déjà 'center'
        }

        currentShape.setCoords(); // Recalculer après tous changements

        console.log(`Fin dessin: ${currentDrawingTool}`);
        fabricCanvas.setActiveObject(currentShape); // Sélectionner la forme créée
        fabricCanvas.renderAll();
    }
    // Réinitialiser les états
    currentShape = null;
    startPoint = null;
}

/** @returns {boolean} Vrai si une forme est en cours de dessin. */
export function getIsDrawing() {
    return isDrawing;
}


/** Met à jour le style (couleur, épaisseur, remplissage) de l'objet sélectionné ou du pinceau. */
function updateDrawingStyle() {
    if (!fabricCanvas) return;
    const strokeColor = strokeColorInput?.value || '#000000';
    const baseStrokeWidth = parseInt(strokeWidthInput?.value || '2', 10);
    const fillColor = fillShapeToggle?.checked ? (fillColorInput?.value || '#cccccc') : 'transparent';
    const activeObject = fabricCanvas.getActiveObject();
    const currentZoom = fabricCanvas.getZoom();

    console.log("Update style - Stroke:", strokeColor, "BaseWidth:", baseStrokeWidth, "Fill:", fillColor, "Active:", activeObject?.type);

    const applyStyleToObject = (obj) => {
        if (!obj || obj.customData?.isGeoTag || obj.isGridLine || obj.isPageGuide) return; // Ignorer tags, grille, guide

        // Stocker la largeur de base
        obj.set('baseStrokeWidth', baseStrokeWidth);

        if (obj.type === 'group' && obj._objects?.length > 1) { // Groupe Forme+Texte
            const shape = obj._objects[0];
            const text = obj._objects[1];
            shape.set({
                stroke: strokeColor,
                strokeWidth: baseStrokeWidth / currentZoom,
                fill: fillColor
            });
            text.set({ fill: strokeColor }); // Mettre à jour couleur texte aussi
            obj.setCoords(); // Important pour les groupes
        } else { // Forme simple (ligne, IText, etc.)
            obj.set({
                stroke: strokeColor,
                strokeWidth: baseStrokeWidth / currentZoom,
                fill: (obj.type === 'i-text' ? strokeColor : fillColor) // Texte utilise 'fill' pour sa couleur principale
            });
             // Si c'est un IText, mettre à jour la couleur du texte
             if (obj.type === 'i-text') {
                 obj.set({ fill: strokeColor });
             }
        }
    };

    if (activeObject) {
        if (activeObject.type === 'activeSelection') { // Si plusieurs objets sont sélectionnés
            activeObject.forEachObject(applyStyleToObject);
        } else {
            applyStyleToObject(activeObject);
        }
        fabricCanvas.requestRenderAll();
        console.log("Style appliqué à la sélection.");
    }
    // Le style du pinceau n'est plus utilisé directement ici
}

/** Affiche ou cache le sélecteur de couleur de remplissage */
function updateFillColorVisibility() {
    if (fillColorInput && fillShapeToggle) {
        fillColorInput.style.display = fillShapeToggle.checked ? 'inline-block' : 'none';
    }
}

// --- Copier / Coller / Supprimer / Grouper ---
// **** CORRECTION: Ajout de 'export' ****

/** Copie l'objet sélectionné (non-tag) dans le presse-papiers interne. */
export function copyShape() {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && !activeObject.customData?.isGeoTag && !activeObject.isGridLine && !activeObject.isPageGuide) {
        activeObject.clone(cloned => {
            fabricClipboard = cloned;
            console.log("Objet copié:", fabricClipboard.type);
            showToast('Objet copié.', 'info');
        }, ['baseStrokeWidth', 'customData']); // Inclure baseStrokeWidth et customData si besoin
    } else {
        fabricClipboard = null;
        console.log("Copie annulée (aucun objet dessin valide sélectionné).");
    }
}

/** Colle l'objet du presse-papiers sur le canvas. */
export function pasteShape() {
    if (!fabricClipboard) {
        console.log("Collage annulé (presse-papiers vide).");
        return;
    }
    console.log("Collage de:", fabricClipboard.type);
    fabricClipboard.clone(clonedObj => {
        fabricCanvas.discardActiveObject(); // Désélectionner avant de coller

        // Position légèrement décalée
        const offset = 10 / fabricCanvas.getZoom();
        clonedObj.set({
            left: clonedObj.left + offset,
            top: clonedObj.top + offset,
            evented: true,       // Rendre cliquable
            selectable: true,    // Rendre sélectionnable
            // Assurer que baseStrokeWidth est copié s'il existe
            ...(clonedObj.baseStrokeWidth && {
                baseStrokeWidth: clonedObj.baseStrokeWidth,
                strokeWidth: clonedObj.baseStrokeWidth / fabricCanvas.getZoom() // Appliquer la bonne épaisseur
            })
        });
        // Si c'est un groupe forme+texte, ajuster aussi le texte interne
        if (clonedObj.type === 'group' && clonedObj._objects?.length === 2 && clonedObj._objects[1].type === 'i-text') {
             const text = clonedObj._objects[1];
             text.set({
                 fontSize: text.fontSize / fabricCanvas.getZoom(), // Ajuster taille police si nécessaire ? Ou stocker fontSize de base ?
                 selectable: false, // Non sélectionnable individuellement par défaut
                 evented: false
             });
        }


        if (clonedObj.type === 'activeSelection') {
            clonedObj.canvas = fabricCanvas;
            clonedObj.forEachObject(obj => fabricCanvas.add(obj));
            clonedObj.setCoords();
        } else {
            fabricCanvas.add(clonedObj);
        }

        // Mettre à jour la position pour le prochain collage
        fabricClipboard.top += offset;
        fabricClipboard.left += offset;

        fabricCanvas.setActiveObject(clonedObj); // Sélectionner l'objet collé
        fabricCanvas.requestRenderAll();
        console.log("Objet collé et sélectionné.");
    }, ['baseStrokeWidth', 'customData']); // Inclure les propriétés personnalisées
}

/** Supprime l'objet de dessin sélectionné (pas les tags géo). */
export function deleteSelectedShape() {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && !activeObject.customData?.isGeoTag && !activeObject.isGridLine && !activeObject.isPageGuide) {
        console.log("Suppression de:", activeObject.type);
        if (activeObject.type === 'activeSelection') {
            activeObject.forEachObject(obj => fabricCanvas.remove(obj));
        } else {
            fabricCanvas.remove(activeObject);
        }
        fabricCanvas.discardActiveObject().renderAll(); // Désélectionner et redessiner
    } else if (activeObject?.customData?.isGeoTag) {
        showToast("Utilisez la barre d'outils du tag géo (icône poubelle) pour le supprimer.", "warning");
    } else {
        console.log("Suppression annulée (aucun objet dessin sélectionné).");
    }
}

/** Groupe les objets actuellement sélectionnés */
export function groupSelectedObjects() {
    const activeSelection = fabricCanvas.getActiveObject();
    if (!activeSelection || activeSelection.type !== 'activeSelection') {
        showToast('Sélectionnez au moins deux formes (non géo-tags) pour les grouper.', 'info');
        return;
    }
    // Filtrer pour exclure les tags géo du groupement
    const objectsToGroup = activeSelection.getObjects().filter(obj => !obj.customData?.isGeoTag && !obj.isGridLine && !obj.isPageGuide);
    if (objectsToGroup.length < 2) {
         showToast('Sélectionnez au moins deux formes (non géo-tags) pour les grouper.', 'info');
         return;
    }

    fabricCanvas.discardActiveObject(); // Désélectionner la sélection multiple

    // Créer une nouvelle sélection active SEULEMENT avec les objets à grouper
    const selectionToGroup = new fabric.ActiveSelection(objectsToGroup, { canvas: fabricCanvas });

    const newGroup = selectionToGroup.toGroup(); // Crée le groupe
    fabricCanvas.remove(...objectsToGroup); // Retire les objets individuels
    fabricCanvas.add(newGroup).setActiveObject(newGroup); // Ajoute et sélectionne le groupe
    fabricCanvas.renderAll();
    console.log('Objets groupés.');
    showToast('Objets groupés.', 'success');
}

/** Dégroupe l'objet actuellement sélectionné s'il s'agit d'un groupe (non géo-tag) */
export function ungroupSelectedObject() {
    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'group' || activeObject.customData?.isGeoTag || activeObject.isPageGuide) {
        showToast('Sélectionnez un groupe (non géo-tag) pour le dégrouper.', 'info');
        return;
    }
    const items = activeObject._objects; // Récupère les objets du groupe
    activeObject._restoreObjectsState(); // Restitue l'état individuel
    fabricCanvas.remove(activeObject); // Supprime le groupe
    items.forEach(item => {
        item.set({ selectable: true, evented: true }); // S'assurer qu'ils sont sélectionnables
        fabricCanvas.add(item);
    }); // Ré-ajoute les objets individuellement

    // Recréer une sélection active avec les objets dégroupés
    const newSelection = new fabric.ActiveSelection(items, { canvas: fabricCanvas });
    fabricCanvas.setActiveObject(newSelection).renderAll();
    console.log('Groupe dégroupé.');
    showToast('Groupe dégroupé.', 'success');
}
