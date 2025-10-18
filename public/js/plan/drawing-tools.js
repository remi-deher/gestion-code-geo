/**
 * Module pour la gestion des outils de dessin (formes, styles, copier/coller).
 */
import { getCanvasInstance, updateStrokesWidth, snapToGrid } from './canvas.js';
import { getIsSnapEnabled } from './canvas.js'; // Pour utiliser la valeur de snap

let fabricCanvas;
let drawingToolbarEl;
let toolBtns;
let strokeColorInput, strokeWidthInput, fillShapeToggle, fillColorInput;
let copyBtn, pasteBtn, deleteShapeBtn;

let currentDrawingTool = 'select'; // Outil actif
let isDrawing = false;             // État: en train de dessiner une forme ?
let startPoint = null;             // Point de départ du dessin
let currentShape = null;           // Forme en cours de dessin
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
    copyBtn?.addEventListener('click', copyShape);
    pasteBtn?.addEventListener('click', pasteShape);
    deleteShapeBtn?.addEventListener('click', deleteSelectedShape);
}

/**
 * Définit l'outil de dessin actif et configure le canvas Fabric en conséquence.
 * @param {string} tool - Le nom de l'outil ('select', 'line', 'rect', 'circle', 'freehand').
 */
export function setActiveTool(tool) {
    if (!fabricCanvas) return;
    currentDrawingTool = tool;

    fabricCanvas.isDrawingMode = (tool === 'freehand'); // Mode dessin libre de Fabric
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
    });

    // Mettre à jour l'état visuel des boutons d'outils
    toolBtns?.forEach(btn => btn.classList.toggle('active', btn.dataset.tool === tool));

    // Configurer le pinceau pour le dessin libre
    if (fabricCanvas.isDrawingMode) {
        fabricCanvas.freeDrawingBrush.color = strokeColorInput?.value || '#000000';
        fabricCanvas.freeDrawingBrush.width = parseInt(strokeWidthInput?.value || '2', 10);
    }

    fabricCanvas.discardActiveObject().renderAll(); // Désélectionner et redessiner
    console.log(`Outil actif: ${tool}`);
}

/** @returns {string} L'outil de dessin actuellement sélectionné. */
export function getCurrentDrawingTool() {
    return currentDrawingTool;
}

/** Démarre le dessin d'une forme (appelé par mouse:down). */
export function startDrawing(pointer) {
    if (currentDrawingTool === 'select' || currentDrawingTool === 'freehand') return;

    isDrawing = true;
    startPoint = pointer; // Coordonnées déjà ajustées pour le snap si besoin
    const strokeColor = strokeColorInput?.value || '#000000';
    const baseStrokeWidth = parseInt(strokeWidthInput?.value || '2', 10);
    const fillColor = fillShapeToggle?.checked ? (fillColorInput?.value || '#cccccc') : 'transparent';
    const zoom = fabricCanvas.getZoom();

    const options = {
        stroke: strokeColor,
        // L'épaisseur initiale doit tenir compte du zoom actuel
        strokeWidth: baseStrokeWidth / zoom,
        fill: fillColor,
        selectable: false, // Non sélectionnable pendant le dessin
        evented: false,
        originX: 'left',
        originY: 'top',
        baseStrokeWidth: baseStrokeWidth // Stocker l'épaisseur de base
    };

    switch (currentDrawingTool) {
        case 'line':
            currentShape = new fabric.Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], options);
            break;
        case 'rect':
            currentShape = new fabric.Rect({ left: startPoint.x, top: startPoint.y, width: 0, height: 0, ...options });
            break;
        case 'circle': // Utiliser Ellipse pour un cercle parfait
            currentShape = new fabric.Ellipse({ left: startPoint.x, top: startPoint.y, rx: 0, ry: 0, ...options });
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

    let { x, y } = pointer; // Coordonnées déjà ajustées pour le snap si besoin

    switch (currentDrawingTool) {
        case 'line':
            currentShape.set({ x2: x, y2: y });
            break;
        case 'rect':
            // Ajuster left/top et width/height pour dessiner dans toutes les directions
            currentShape.set({
                left: Math.min(x, startPoint.x),
                top: Math.min(y, startPoint.y),
                width: Math.abs(x - startPoint.x),
                height: Math.abs(y - startPoint.y)
            });
            break;
        case 'circle':
            // Calculer le rayon basé sur la distance au point de départ
            const dx = x - startPoint.x;
            const dy = y - startPoint.y;
            // Pour un cercle, rx et ry sont égaux à la moitié de la plus grande distance
            const radius = Math.max(Math.abs(dx), Math.abs(dy)) / 2;
            currentShape.set({
                left: startPoint.x + dx / 2, // Le centre se déplace
                top: startPoint.y + dy / 2,
                rx: radius,
                ry: radius,
                originX: 'center', // Centrer l'origine pendant le dessin
                originY: 'center'
            });
            break;
    }
    currentShape.setCoords(); // Mettre à jour les coordonnées de contrôle
    fabricCanvas.renderAll();
}

/** Termine le dessin de la forme (appelé par mouse:up). */
export function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentShape) {
        // Remettre l'origine par défaut pour rect/ellipse après dessin
        if (currentShape.type === 'rect' || currentShape.type === 'ellipse') {
            const { left, top, width, height, rx, ry, originX, originY } = currentShape;
            if (originX === 'center' || originY === 'center') {
                currentShape.set({
                    left: left - (currentShape.type === 'ellipse' ? rx : width / 2),
                    top: top - (currentShape.type === 'ellipse' ? ry : height / 2),
                    originX: 'left',
                    originY: 'top'
                });
            }
        }

        // Rendre la forme sélectionnable
        currentShape.set({ selectable: true, evented: true }).setCoords();

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

    console.log("Update style - Stroke:", strokeColor, "BaseWidth:", baseStrokeWidth, "Fill:", fillColor, "Active:", activeObject);

    // Si un objet (non-tag) est sélectionné, appliquer le style
    if (activeObject && !activeObject.customData?.isGeoTag && !activeObject.isGridLine) {
        const updateProps = {
            stroke: strokeColor,
            strokeWidth: baseStrokeWidth / currentZoom, // Appliquer l'épaisseur ajustée au zoom
            fill: fillColor,
            baseStrokeWidth: baseStrokeWidth // Stocker l'épaisseur de base
        };

        if (activeObject.type === 'activeSelection') { // Si plusieurs objets sont sélectionnés
            activeObject.forEachObject(obj => {
                if (!obj.isGridLine) obj.set(updateProps);
            });
        } else {
            activeObject.set(updateProps);
        }
        fabricCanvas.requestRenderAll();
        console.log("Style appliqué à la sélection.");
    }

    // Mettre à jour le pinceau pour le dessin libre
    if (fabricCanvas.isDrawingMode) {
        fabricCanvas.freeDrawingBrush.color = strokeColor;
        // Pour le dessin libre, Fabric gère l'épaisseur différemment, on utilise la valeur brute
        fabricCanvas.freeDrawingBrush.width = baseStrokeWidth;
        console.log("Style du pinceau mis à jour.");
    }
}

/** Affiche ou cache le sélecteur de couleur de remplissage */
function updateFillColorVisibility() {
    if (fillColorInput && fillShapeToggle) {
        fillColorInput.style.display = fillShapeToggle.checked ? 'inline-block' : 'none';
    }
}

// --- Copier / Coller / Supprimer Formes ---

/** Copie l'objet sélectionné (non-tag) dans le presse-papiers interne. */
function copyShape() {
    const activeObject = fabricCanvas.getActiveObject();
    // Ne copier que les objets de dessin, pas les tags ni la grille
    if (activeObject && !activeObject.customData?.isGeoTag && !activeObject.isGridLine) {
        activeObject.clone(cloned => {
            fabricClipboard = cloned;
            console.log("Objet copié:", fabricClipboard.type);
        });
    } else {
        fabricClipboard = null; // Vide le presse-papiers si rien n'est sélectionné
         console.log("Copie annulée (aucun objet dessin valide sélectionné).");
    }
}

/** Colle l'objet du presse-papiers sur le canvas. */
function pasteShape() {
    if (!fabricClipboard) {
        console.log("Collage annulé (presse-papiers vide).");
        return;
    }
    console.log("Collage de:", fabricClipboard.type);
    fabricClipboard.clone(clonedObj => {
        fabricCanvas.discardActiveObject(); // Désélectionner avant de coller
        clonedObj.set({
            left: clonedObj.left + 10, // Décaler légèrement pour la visibilité
            top: clonedObj.top + 10,
            evented: true,       // Rendre cliquable
            selectable: true,    // Rendre sélectionnable
            // Assurer que baseStrokeWidth est copié s'il existe
            ...(clonedObj.baseStrokeWidth && { baseStrokeWidth: clonedObj.baseStrokeWidth })
        });

        if (clonedObj.type === 'activeSelection') {
            // Si c'était une sélection multiple, ajouter chaque objet individuellement
            clonedObj.canvas = fabricCanvas;
            clonedObj.forEachObject(obj => fabricCanvas.add(obj));
            clonedObj.setCoords(); // Recalculer les coords du groupe collé
        } else {
            fabricCanvas.add(clonedObj); // Ajouter l'objet simple
        }

        // Mettre à jour la position pour le prochain collage
        fabricClipboard.top += 10;
        fabricClipboard.left += 10;

        fabricCanvas.setActiveObject(clonedObj); // Sélectionner l'objet collé
        fabricCanvas.requestRenderAll();
        console.log("Objet collé et sélectionné.");
    });
}

/** Supprime l'objet de dessin sélectionné (pas les tags géo). */
function deleteSelectedShape() {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && !activeObject.customData?.isGeoTag && !activeObject.isGridLine) {
        console.log("Suppression de:", activeObject.type);
        if (activeObject.type === 'activeSelection') {
            // Si c'est une sélection multiple, supprimer chaque objet
            activeObject.forEachObject(obj => fabricCanvas.remove(obj));
        } else {
            fabricCanvas.remove(activeObject); // Supprimer l'objet simple
        }
        fabricCanvas.discardActiveObject().renderAll(); // Désélectionner et redessiner
    } else if (activeObject?.customData?.isGeoTag) {
        alert("Utilisez la barre d'outils du tag géo (icône poubelle) pour le supprimer.");
    } else {
        console.log("Suppression annulée (aucun objet dessin sélectionné).");
    }
}
