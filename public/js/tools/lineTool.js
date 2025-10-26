// Fichier: public/js/tools/lineTool.js
/**
 * Outil Ligne pour Fabric.js
 * Dessine une ligne droite en cliquant-glissant.
 * Pourrait être étendu pour Polyline (clics multiples).
 */
import { getCurrentColors } from '../ui/colorManager.js';

let canvasInstance = null;
let startPoint = null;
let line = null;

const mouseDownHandler = (o) => {
    if (!canvasInstance) return;
    const pointer = canvasInstance.getPointer(o.e);
    startPoint = { x: pointer.x, y: pointer.y };
    const colors = getCurrentColors();

    // Créer une ligne avec point de départ et fin identiques
    const points = [startPoint.x, startPoint.y, startPoint.x, startPoint.y];
    line = new fabric.Line(points, {
        stroke: colors.stroke,
        strokeWidth: colors.strokeWidth,
        selectable: false,
        evented: false,
    });
    canvasInstance.add(line);
};

const mouseMoveHandler = (o) => {
    if (!startPoint || !line || !canvasInstance) return;
    const pointer = canvasInstance.getPointer(o.e);

    // Mettre à jour le point final de la ligne
    line.set({ x2: pointer.x, y2: pointer.y });
    canvasInstance.requestRenderAll();
};

const mouseUpHandler = () => {
    if (line) {
        line.setCoords();
        line.selectable = true;
        line.evented = true;

        // Calculer la longueur (simple distance euclidienne)
        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        const length = Math.sqrt(dx*dx + dy*dy);

        if (length < 5) { // Supprimer si trop court
            canvasInstance.remove(line);
        } else {
            console.log("LineTool: Ligne créée:", line);
        }
        canvasInstance.requestRenderAll();
    }
    startPoint = null;
    line = null;
};

export function activate(canvas) {
    console.log("LineTool: Activation");
    canvasInstance = canvas;
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvas.setCursor('crosshair');
    canvas.forEachObject(obj => { obj.selectable = false; obj.evented = false; });

    canvas.on('mouse:down', mouseDownHandler);
    canvas.on('mouse:move', mouseMoveHandler);
    canvas.on('mouse:up', mouseUpHandler);
}

export function deactivate(canvas) {
    console.log("LineTool: Désactivation");
    canvas.off('mouse:down', mouseDownHandler);
    canvas.off('mouse:move', mouseMoveHandler);
    canvas.off('mouse:up', mouseUpHandler);
    startPoint = null;
    line = null;
    canvasInstance = null;
}
