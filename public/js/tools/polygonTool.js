// Fichier: public/js/tools/polygonTool.js
/**
 * Outil Polygone pour Fabric.js
 * Permet de dessiner un polygone point par point.
 * - Clic: Ajoute un point
 * - Double-clic ou 'Enter': Termine le polygone
 * - 'Escape': Annule le dessin
 */
import { getCurrentColors } from '../ui/colorManager.js';

let canvasInstance = null;
let currentPoints = [];
let previewLine = null;
let isDrawing = false;

// --- Gestionnaires d'événements ---

const mouseDownHandler = (o) => {
    if (!canvasInstance || !o.pointer) return;
    const pointer = o.pointer;

    // Sur le premier clic, démarrer le dessin
    if (!isDrawing) {
        isDrawing = true;
        currentPoints = [pointer, pointer]; // Démarrer avec deux points pour la ligne
        const colors = getCurrentColors();

        // Crée la ligne de prévisualisation
        previewLine = new fabric.Line(
            [pointer.x, pointer.y, pointer.x, pointer.y], 
            {
                stroke: colors.stroke,
                strokeWidth: 2,
                strokeDashArray: [3, 3],
                selectable: false, evented: false
            }
        );
        canvasInstance.add(previewLine);
    } else {
        // Clics suivants: ajouter un point
        currentPoints.push(pointer);
    }
};

const mouseMoveHandler = (o) => {
    if (!isDrawing || !previewLine || !o.pointer) return;
    const pointer = o.pointer;

    // Mettre à jour le dernier point (qui suit la souris)
    currentPoints[currentPoints.length - 1] = pointer;

    // Mettre à jour la prévisualisation (soit un Polyline, soit une simple ligne)
    // Pour un polygone complet, on met à jour la ligne du dernier point au curseur
    const lastFixedPoint = currentPoints[currentPoints.length - 2];
    previewLine.set({ x1: lastFixedPoint.x, y1: lastFixedPoint.y, x2: pointer.x, y2: pointer.y });
    
    // On pourrait aussi dessiner tout le polygone en prévisualisation
    // (plus complexe, mais plus visuel)
    
    canvasInstance.requestRenderAll();
};

// Terminer le dessin
const finishDrawing = () => {
    if (!isDrawing || currentPoints.length < 3) {
        cancelDrawing(); // Pas assez de points
        return;
    }
    isDrawing = false;
    
    // Retirer le dernier point (qui est la position de la souris)
    currentPoints.pop();
    
    const colors = getCurrentColors();
    
    // Créer le polygone final
    const polygon = new fabric.Polygon(currentPoints, {
        fill: colors.fill,
        stroke: colors.stroke,
        strokeWidth: 2, // Utiliser l'épaisseur du propertyInspector ?
        selectable: true,
        evented: true,
        objectCaching: false
    });

    canvasInstance.remove(previewLine); // Retirer la ligne de prévisualisation
    canvasInstance.add(polygon);
    canvasInstance.setActiveObject(polygon);
    canvasInstance.requestRenderAll();

    // Nettoyer
    currentPoints = [];
    previewLine = null;

    // IMPORTANT: Déclencher un événement pour l'historique (Undo/Redo)
    canvasInstance.fire('object:added', { target: polygon });
};

// Annuler le dessin
const cancelDrawing = () => {
    if (!isDrawing) return;
    isDrawing = false;
    if (previewLine) canvasInstance.remove(previewLine);
    currentPoints = [];
    previewLine = null;
    canvasInstance.requestRenderAll();
    console.log("PolygonTool: Dessin annulé.");
};

// Gérer les touches clavier
const keyDownHandler = (e) => {
    if (e.key === 'Enter') {
        finishDrawing();
    } else if (e.key === 'Escape') {
        cancelDrawing();
    }
};

// --- Fonctions d'activation/désactivation ---

export function activate(canvas) {
    console.log("PolygonTool: Activation");
    canvasInstance = canvas;
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvas.setCursor('crosshair');
    canvas.forEachObject(obj => { obj.selectable = false; obj.evented = false; });

    // Ajouter les écouteurs
    canvas.on('mouse:down', mouseDownHandler);
    canvas.on('mouse:move', mouseMoveHandler);
    // Écouteur pour terminer au double-clic
    canvas.on('mouse:dblclick', finishDrawing);
    // Écouteur pour les touches (Enter/Escape)
    window.addEventListener('keydown', keyDownHandler);
}

export function deactivate(canvas) {
    console.log("PolygonTool: Désactivation");
    cancelDrawing(); // S'assurer que tout dessin en cours est annulé
    
    // Retirer les écouteurs
    canvas.off('mouse:down', mouseDownHandler);
    canvas.off('mouse:move', mouseMoveHandler);
    canvas.off('mouse:dblclick', finishDrawing);
    window.removeEventListener('keydown', keyDownHandler);
    
    canvasInstance = null;
}
