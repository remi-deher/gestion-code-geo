/**
 * Module pour la gestion des outils de dessin (formes, texte libre),
 * groupement, et presse-papiers.
 */
import { getCanvasInstance, getSnapToGrid } from './canvas.js';
import { showToast } from '../modules/utils.js';
// CORRECTION : Importer GRID_SIZE pour le calcul du magnétisme
import { GRID_SIZE } from '../modules/config.js';

let fabricCanvas;
let currentTool = 'select'; // Outil actif
let isDrawing = false;
let startPoint = null;
let currentObject = null; // Objet en cours de dessin

// Couleurs (lues depuis les inputs dans main.js, mais valeurs par défaut ici)
let currentStrokeColor = '#000000';
let currentFillColor = 'transparent';
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
    
    // Mettre à jour l'état 'active' des boutons (géré par main.js maintenant)
    // document.querySelectorAll('.tool-btn').forEach(btn => {
    //     btn.classList.toggle('active', btn.dataset.tool === tool);
    // });

    if (tool === 'select') {
        fabricCanvas.defaultCursor = 'default';
        fabricCanvas.hoverCursor = 'move';
    } else {
        fabricCanvas.defaultCursor = 'crosshair';
        fabricCanvas.hoverCursor = 'crosshair';
    }
    console.log("Outil actif:", currentTool);
}

/** Retourne l'outil actif */
export function getCurrentDrawingTool() { return currentTool; }

/** Retourne si un dessin est en cours */
export function getIsDrawing() { return isDrawing; }

// --- Les fonctions setStrokeColor, setFillColor, setTransparentFill
// --- ont été retirées car la logique est gérée dans main.js (updateDrawingStyleFromInput)

/**
 * Récupère les options de style actuelles depuis les inputs (via main.js)
 * @returns {object} { stroke, fill, strokeWidth, baseStrokeWidth }
 */
function getCurrentDrawingStyles() {
    const strokeColor = document.getElementById('stroke-color-picker')?.value || '#000000';
    const fillColorPicker = document.getElementById('fill-color-picker');
    const fillTransparentBtn = document.getElementById('fill-transparent-btn');
    
    let fill = 'transparent'; // Par défaut
    if (fillTransparentBtn && fillTransparentBtn.classList.contains('active')) {
         fill = fillColorPicker?.value || '#FFFFFF'; // Utilise la couleur si non-transparent
    }

    // TODO: Gérer l'épaisseur (strokeWidth) si un input est ajouté
    const zoom = fabricCanvas.getZoom();
    const baseWidth = 2; // Mettre ici la valeur lue de l'input d'épaisseur
    const strokeWidth = baseWidth / zoom;

    return {
        stroke: strokeColor,
        fill: fill,
        strokeWidth: strokeWidth,
        baseStrokeWidth: baseWidth
    };
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
    // CORRECTION 1: Utiliser getSnapToGrid() au lieu de getIsSnapEnabled()
    if (getSnapToGrid()) {
        const snapSize = GRID_SIZE || 10;
        // CORRECTION 2: Calculer le magnétisme manuellement (pas de fonction snapToGrid importée)
        startPoint.x = Math.round(startPoint.x / snapSize) * snapSize;
        startPoint.y = Math.round(startPoint.y / snapSize) * snapSize;
    }
    
    const styles = getCurrentDrawingStyles();

    switch (currentTool) {
        case 'rect':
            currentObject = new fabric.Rect({
                left: startPoint.x,
                top: startPoint.y,
                width: 0,
                height: 0,
                fill: styles.fill,
                stroke: styles.stroke,
                strokeWidth: styles.strokeWidth,
                baseStrokeWidth: styles.baseStrokeWidth,
                selectable: false, evented: false
            });
            break;
        case 'circle':
            currentObject = new fabric.Circle({
                left: startPoint.x,
                top: startPoint.y,
                radius: 0,
                fill: styles.fill,
                stroke: styles.stroke,
                strokeWidth: styles.strokeWidth,
                baseStrokeWidth: styles.baseStrokeWidth,
                selectable: false, evented: false
            });
            break;
        case 'line':
            currentObject = new fabric.Line(
                [startPoint.x, startPoint.y, startPoint.x, startPoint.y],
                {
                    fill: 'transparent', // Les lignes n'ont pas de remplissage
                    stroke: styles.stroke,
                    strokeWidth: styles.strokeWidth,
                    baseStrokeWidth: styles.baseStrokeWidth,
                    selectable: false, evented: false
                }
            );
            break;
        case 'text':
            // Le texte est géré différemment (au mouse:up / clic simple)
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
    // CORRECTION 1: Utiliser getSnapToGrid()
    if (getSnapToGrid()) {
        const snapSize = GRID_SIZE || 10;
        // CORRECTION 2: Calculer le magnétisme manuellement
        pointer.x = Math.round(pointer.x / snapSize) * snapSize;
        pointer.y = Math.round(pointer.y / snapSize) * snapSize;
    }
    
    const width = pointer.x - startPoint.x;
    const height = pointer.y - startPoint.y;

    switch (currentTool) {
        case 'rect':
            // Logique simplifiée pour dessiner depuis le point de départ
            currentObject.set({
                left: width > 0 ? startPoint.x : pointer.x,
                top: height > 0 ? startPoint.y : pointer.y,
                width: Math.abs(width),
                height: Math.abs(height)
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
 * @param {object} opt - L'objet événement de Fabric (peut être null si appelé par Escape).
 * @param {boolean} [cancel=false] - True si le dessin est annulé (ex: Escape).
 * @returns {fabric.Object|null} L'objet créé (ou null si annulé).
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
        return null;
    }

    const styles = getCurrentDrawingStyles();
    
    // Cas spécial du Texte Libre (créé au clic simple, pas au drag)
    if (currentTool === 'text' && !isDrawing && startPoint && opt) {
        const zoom = fabricCanvas.getZoom();
        
        const text = new fabric.IText('Texte', {
            left: startPoint.x,
            top: startPoint.y,
            originX: 'left', originY: 'top',
            fontSize: 20, // Taille de base
            fontFamily: 'Arial',
            fill: styles.stroke, // Utiliser la couleur de contour pour le texte
            stroke: '#FFFFFF',
            strokeWidth: 0.5, // Contour de base
            paintFirst: 'stroke',
            baseStrokeWidth: 0.5,
            selectable: true, evented: true,
            customData: { justCreated: true }
        });
        
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        text.enterEditing(); // Entrer en mode édition
        
        // Réinitialiser les points
        isDrawing = false;
        startPoint = null;
        fabricCanvas.renderAll();
        return text; // Retourne l'objet créé
    }
    
    // Cas des formes (rect, circle, line)
    const finalObject = currentObject;
    if (finalObject) {
        // Ne pas sélectionner si le dessin est minuscule (clic simple)
        if ((finalObject.width < 5 && finalObject.height < 5) || (finalObject.type === 'circle' && finalObject.radius < 3) || (finalObject.type === 'line' && finalObject.width === 0 && finalObject.height === 0)) {
             fabricCanvas.remove(finalObject);
             console.log("Dessin annulé (taille trop petite)");
             isDrawing = false;
             currentObject = null;
             startPoint = null;
             return null;
        }

        finalObject.setCoords();
        finalObject.set({ 
            selectable: true, 
            evented: true,
            customData: { justCreated: true }
        });
        
        // Sélectionner le nouvel objet
        fabricCanvas.setActiveObject(finalObject);
    }
    
    isDrawing = false;
    currentObject = null;
    startPoint = null;
    
    fabricCanvas.renderAll();
    return finalObject; // Retourne l'objet créé
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
            // Ne supprime pas les SVG natifs, ni les tags géo
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
        
        // Si c'était une sélection multiple, la désactiver
        if (activeObj.type === 'activeSelection') {
             fabricCanvas.discardActiveObject();
        }
        fabricCanvas.renderAll();
        // Déclencher la sauvegarde auto (gérée par main.js via 'object:modified' ou 'object:removed' si on l'ajoute)
        // Pour l'instant, on peut simuler un 'click' sur le bouton de sauvegarde si besoin
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
    
    const group = activeObj.toGroup();
    group.customData = { isDrawingGroup: true }; // Marqueur pour dégrouper
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
        
        // Positionner au centre du viewport actuel
        const center = fabricCanvas.getVpCenter();

        clonedObj.set({
            left: center.x,
            top: center.y,
            originX: 'center',
            originY: 'center',
            evented: true,
            customData: { ...(clonedObj.customData || {}), justCreated: true }
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
        
        // Mettre à jour la position du clipboard pour le prochain collage (évite de coller au même endroit)
        clipboard.set({
             left: clonedObj.left + 20,
             top: clonedObj.top + 20
        });
        
        fabricCanvas.setActiveObject(clonedObj);
        fabricCanvas.requestRenderAll();
        showToast("Collé !", "info");
    }, ['customData', 'baseStrokeWidth']);
}
