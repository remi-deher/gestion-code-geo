/**
 * Module pour la gestion des outils de dessin (formes, texte libre),
 * groupement, et presse-papiers.
 */
import { getCanvasInstance, getSnapToGrid } from './canvas.js';
import { showToast } from '../modules/utils.js';

let fabricCanvas;
let currentTool = 'select'; // Outil actif
let isDrawing = false;
let startPoint = null;
let currentObject = null; // Objet en cours de dessin

// Couleurs
let currentStrokeColor = '#000000';
let currentFillColor = 'rgba(255, 255, 255, 0.0)'; // Transparent par défaut
let baseStrokeWidth = 2; // Épaisseur de base

// Presse-papiers
let clipboard = null;

/**
 * Initialise le module des outils de dessin.
 * @param {fabric.Canvas} canvasInstance - L'instance du canvas.
 */
export function initializeDrawingTools(canvasInstance) {
    fabricCanvas = canvasInstance;
    console.log("Outils de dessin initialisés.");
}

/**
 * Définit l'outil de dessin actif.
 * @param {string} tool - Nom de l'outil ('select', 'rect', 'line', 'circle', 'text').
 */
export function setActiveTool(tool) {
    currentTool = tool;
    fabricCanvas.isDrawingMode = false; // On gère le dessin manuellement
    fabricCanvas.selection = (tool === 'select');
    
    // Mettre à jour l'état 'active' des boutons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    if (tool === 'select') {
        fabricCanvas.defaultCursor = 'default';
    } else {
        fabricCanvas.defaultCursor = 'crosshair';
    }
    console.log("Outil actif:", currentTool);
}

/** Retourne l'outil actif */
export function getCurrentDrawingTool() { return currentTool; }

/** Retourne si un dessin est en cours */
export function getIsDrawing() { return isDrawing; }

/** Définit la couleur de contour */
export function setStrokeColor(color) {
    currentStrokeColor = color;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj && !activeObj.isSvgShape && !activeObj.customData?.isGeoTag && !activeObj.customData?.isPlacedText) {
        activeObj.set('stroke', color);
        fabricCanvas.renderAll();
    }
}

/** Définit la couleur de remplissage */
export function setFillColor(color) {
    currentFillColor = color;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj && !activeObj.isSvgShape && !activeObj.customData?.isGeoTag && !activeObj.customData?.isPlacedText) {
        activeObj.set('fill', color);
        fabricCanvas.renderAll();
    }
}

/** Définit le remplissage transparent */
export function setTransparentFill() {
    currentFillColor = 'rgba(255, 255, 255, 0.0)';
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj && !activeObj.isSvgShape && !activeObj.customData?.isGeoTag && !activeObj.customData?.isPlacedText) {
        activeObj.set('fill', currentFillColor);
        fabricCanvas.renderAll();
    }
}

/**
 * Démarre le dessin lors d'un 'mouse:down' sur le canvas.
 * @param {object} opt - L'objet événement de Fabric.
 */
export function startDrawing(opt) {
    if (currentTool === 'select' || isDrawing) return;
    
    isDrawing = true;
    startPoint = fabricCanvas.getPointer(opt.e);
    
    // Magnétisme
    if (getIsSnapEnabled()) {
        const zoom = fabricCanvas.getZoom();
        const vpt = fabricCanvas.viewportTransform;
        startPoint.x = snapToGrid(startPoint.x, vpt[4], zoom);
        startPoint.y = snapToGrid(startPoint.y, vpt[5], zoom);
    }
    
    const zoom = fabricCanvas.getZoom();
    const strokeWidth = baseStrokeWidth / zoom; // Adapter au zoom

    switch (currentTool) {
        case 'rect':
            currentObject = new fabric.Rect({
                left: startPoint.x,
                top: startPoint.y,
                width: 0,
                height: 0,
                fill: currentFillColor,
                stroke: currentStrokeColor,
                strokeWidth: strokeWidth,
                baseStrokeWidth: baseStrokeWidth, // Stocker base
                selectable: false, evented: false // Non sélectionnable pendant dessin
            });
            break;
        case 'circle':
            currentObject = new fabric.Circle({
                left: startPoint.x,
                top: startPoint.y,
                radius: 0,
                fill: currentFillColor,
                stroke: currentStrokeColor,
                strokeWidth: strokeWidth,
                baseStrokeWidth: baseStrokeWidth,
                selectable: false, evented: false
            });
            break;
        case 'line':
            currentObject = new fabric.Line(
                [startPoint.x, startPoint.y, startPoint.x, startPoint.y],
                {
                    stroke: currentStrokeColor,
                    strokeWidth: strokeWidth,
                    baseStrokeWidth: baseStrokeWidth,
                    selectable: false, evented: false
                }
            );
            break;
        case 'text':
            // Le texte est géré différemment (au mouse:up)
            isDrawing = false; // Pas de 'drag' pour le texte
            break;
        default:
            isDrawing = false;
            break;
    }

    if (currentObject) {
        fabricCanvas.add(currentObject);
    }
}

/**
 * Continue le dessin lors d'un 'mouse:move'.
 * @param {object} opt - L'objet événement de Fabric.
 */
export function continueDrawing(opt) {
    if (!isDrawing || !currentObject) return;

    let pointer = fabricCanvas.getPointer(opt.e);
    
    // Magnétisme
    if (getIsSnapEnabled()) {
        const zoom = fabricCanvas.getZoom();
        const vpt = fabricCanvas.viewportTransform;
        pointer.x = snapToGrid(pointer.x, vpt[4], zoom);
        pointer.y = snapToGrid(pointer.y, vpt[5], zoom);
    }
    
    const width = pointer.x - startPoint.x;
    const height = pointer.y - startPoint.y;

    switch (currentTool) {
        case 'rect':
            currentObject.set({
                width: Math.abs(width),
                height: Math.abs(height),
                originX: width < 0 ? 'right' : 'left',
                originY: height < 0 ? 'top' : 'left' // Erreur ici, devrait être 'bottom' ?
            });
            // Correction origine
            currentObject.set({
                left: width < 0 ? pointer.x : startPoint.x,
                top: height < 0 ? pointer.y : startPoint.y,
                width: Math.abs(width),
                height: Math.abs(height),
                originX: 'left',
                originY: 'top'
            });
            break;
        case 'circle':
            const radius = Math.sqrt(width * width + height * height) / 2;
            currentObject.set({
                radius: radius,
                originX: 'center',
                originY: 'center',
                left: startPoint.x + width / 2,
                top: startPoint.y + height / 2
            });
            break;
        case 'line':
            currentObject.set({ x2: pointer.x, y2: pointer.y });
            break;
    }
    
    fabricCanvas.renderAll();
}

/**
 * Termine le dessin lors d'un 'mouse:up'.
 * @param {object} opt - L'objet événement de Fabric.
 * @param {boolean} [cancel=false] - True si le dessin est annulé (ex: Escape).
 */
export function stopDrawing(opt, cancel = false) {
    if (cancel) {
        if (currentObject) {
            fabricCanvas.remove(currentObject);
        }
        isDrawing = false;
        currentObject = null;
        startPoint = null;
        fabricCanvas.renderAll();
        return;
    }

    // Cas spécial du Texte Libre (créé au clic)
    if (currentTool === 'text' && !isDrawing && startPoint) {
        const zoom = fabricCanvas.getZoom();
        const strokeWidth = baseStrokeWidth / zoom;
        
        const text = new fabric.IText('Texte', {
            left: startPoint.x,
            top: startPoint.y,
            originX: 'left', originY: 'top',
            fontSize: 20 / zoom, // Adapter au zoom
            fontFamily: 'Arial',
            fill: currentStrokeColor, // Utiliser la couleur de contour pour le texte
            stroke: '#FFFFFF',
            strokeWidth: 0.2 / zoom,
            paintFirst: 'stroke',
            selectable: true, evented: true,
            justCreated: true // Flag pour sauvegarde auto
        });
        
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        text.enterEditing(); // Entrer en mode édition
        
        currentObject = text; // Pour la sauvegarde
    }
    
    if (currentObject) {
        currentObject.setCoords();
        currentObject.set({ 
            selectable: true, 
            evented: true,
            justCreated: true // Flag pour sauvegarde auto dans main.js
        });
        
        // Sélectionner le nouvel objet
        fabricCanvas.setActiveObject(currentObject);
    }
    
    isDrawing = false;
    currentObject = null;
    startPoint = null;
    
    // Ne pas repasser en mode 'select' automatiquement
    // setActiveTool('select'); 
    
    fabricCanvas.renderAll();
}

// --- Fonctions de Manipulation ---

/**
 * Supprime les objets de dessin sélectionnés.
 * Ne supprime pas les formes SVG, ni les tags/textes géo.
 */
export function deleteSelectedDrawingShape() {
    const activeObj = fabricCanvas.getActiveObject();
    if (!activeObj) return;

    // Filtrer pour ne supprimer que les objets "dessin"
    const objectsToDelete = [];
    if (activeObj.type === 'activeSelection') {
        activeObj.getObjects().forEach(obj => {
            if (!obj.isSvgShape && !obj.customData?.isGeoTag && !obj.customData?.isPlacedText) {
                objectsToDelete.push(obj);
            }
        });
    } else if (!activeObj.isSvgShape && !activeObj.customData?.isGeoTag && !activeObj.customData?.isPlacedText) {
        objectsToDelete.push(activeObj);
    }

    if (objectsToDelete.length === 0) {
        showToast("Seuls les objets dessinés (formes, textes libres) peuvent être supprimés.", "info");
        return;
    }
    
    if (confirm(`Supprimer ${objectsToDelete.length} objet(s) dessiné(s) ?`)) {
        objectsToDelete.forEach(obj => {
            fabricCanvas.remove(obj);
        });
        
        if (activeObj.type === 'activeSelection') {
             fabricCanvas.discardActiveObject();
        }
        fabricCanvas.renderAll();
        // Déclencher la sauvegarde (gérée par main.js)
        document.getElementById('save-drawing-btn')?.click(); // Simule clic sauvegarde
    }
}

/** Groupe les objets sélectionnés */
export function groupSelectedObjects() {
    const activeObj = fabricCanvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'activeSelection') return;
    
    // Vérification (normalement déjà faite dans main.js via état 'disabled')
    const containsInvalid = activeObj.getObjects().some(obj => obj.isSvgShape || obj.customData?.isGeoTag || obj.customData?.isPlacedText);
    if (containsInvalid) {
         showToast("Impossible de grouper : la sélection contient des éléments du plan ou des tags géo.", "warning");
         return;
    }
    
    activeObj.toGroup();
    fabricCanvas.requestRenderAll();
}

/** Dégroupe l'objet sélectionné */
export function ungroupSelectedObject() {
    const activeObj = fabricCanvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'group') return;

    // Vérification
    if (activeObj.isSvgShape || activeObj.customData?.isGeoTag || activeObj.customData?.isPlacedText) {
         showToast("Cet objet ne peut pas être dégroupé.", "warning");
         return;
    }
    
    activeObj.toActiveSelection();
    fabricCanvas.requestRenderAll();
}

// --- Presse-papiers ---

/** Copie l'objet/la sélection active */
export function copyShape() {
    const activeObj = fabricCanvas.getActiveObject();
    if (!activeObj) return;
    
    // Filtrer les objets non copiables (SVG natifs, tags géo)
    if (activeObj.isSvgShape || activeObj.customData?.isGeoTag || activeObj.customData?.isPlacedText) {
         showToast("Cet élément ne peut pas être copié.", "info");
         clipboard = null;
         return;
    }
     if (activeObj.type === 'activeSelection') {
         const containsInvalid = activeObj.getObjects().some(obj => obj.isSvgShape || obj.customData?.isGeoTag || obj.customData?.isPlacedText);
         if (containsInvalid) {
             showToast("La sélection contient des éléments non copiables.", "warning");
             clipboard = null;
             return;
         }
     }

    // Cloner l'objet
    activeObj.clone(cloned => {
        clipboard = cloned;
        showToast("Copié !", "info");
    }, ['customData', 'baseStrokeWidth']); // Inclure nos propriétés custom
}

/** Colle l'objet/la sélection depuis le presse-papiers */
export function pasteShape() {
    if (!clipboard) {
         showToast("Presse-papiers vide.", "info");
        return;
    }

    clipboard.clone(clonedObj => {
        fabricCanvas.discardActiveObject(); // Désélectionner
        
        // Décaler légèrement pour voir le nouvel objet
        clonedObj.set({
            left: clonedObj.left + 20,
            top: clonedObj.top + 20,
            evented: true,
            justCreated: true // Pour sauvegarde
        });
        
        if (clonedObj.type === 'activeSelection') {
            // Si c'est un groupe qui a été copié
            clonedObj.canvas = fabricCanvas;
            clonedObj.forEachObject(obj => {
                fabricCanvas.add(obj);
            });
            clonedObj.setCoords();
        } else {
            // Objet simple
            fabricCanvas.add(clonedObj);
        }
        
        clipboard.set({ // Préparer le prochain collage
             left: clonedObj.left,
             top: clonedObj.top
        });
        
        fabricCanvas.setActiveObject(clonedObj);
        fabricCanvas.requestRenderAll();
        showToast("Collé !", "info");
    }, ['customData', 'baseStrokeWidth']);
}
