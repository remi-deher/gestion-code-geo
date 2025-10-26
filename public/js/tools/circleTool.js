// Fichier: public/js/tools/circleTool.js
/**
 * Outil Cercle/Ellipse pour Fabric.js
 * Dessine un cercle ou une ellipse en cliquant-glissant.
 */
import { getCurrentColors } from '../ui/colorManager.js';

let canvasInstance = null;
let startPoint = null;
let shape = null; // Peut être Circle ou Ellipse

const mouseDownHandler = (o) => {
    if (!canvasInstance) return;
    const pointer = canvasInstance.getPointer(o.e);
    startPoint = { x: pointer.x, y: pointer.y };
    const colors = getCurrentColors();

    // Créer une ellipse initiale
    shape = new fabric.Ellipse({
        left: startPoint.x,
        top: startPoint.y,
        rx: 0,
        ry: 0,
        fill: colors.fill,
        stroke: colors.stroke,
        strokeWidth: colors.strokeWidth,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
    });
    canvasInstance.add(shape);
};

const mouseMoveHandler = (o) => {
    if (!startPoint || !shape || !canvasInstance) return;
    const pointer = canvasInstance.getPointer(o.e);

    const rx = Math.abs(pointer.x - startPoint.x) / 2;
    const ry = Math.abs(pointer.y - startPoint.y) / 2;

    // Si Shift est pressé, dessiner un cercle
    const isCircle = o.e.shiftKey;
    const radius = Math.max(rx, ry);

    shape.set({
        left: startPoint.x, // Le centre reste le point de départ
        top: startPoint.y,
        rx: isCircle ? radius : rx,
        ry: isCircle ? radius : ry,
    });
    canvasInstance.requestRenderAll();
};

const mouseUpHandler = () => {
    if (shape) {
        shape.setCoords();
        shape.selectable = true;
        shape.evented = true;

        if (shape.rx < 3 && shape.ry < 3) {
            canvasInstance.remove(shape);
        } else {
             console.log("CircleTool: Forme créée:", shape);
        }
        canvasInstance.requestRenderAll();
    }
    startPoint = null;
    shape = null;
};

export function activate(canvas) {
    console.log("CircleTool: Activation");
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
    console.log("CircleTool: Désactivation");
    canvas.off('mouse:down', mouseDownHandler);
    canvas.off('mouse:move', mouseMoveHandler);
    canvas.off('mouse:up', mouseUpHandler);
    startPoint = null;
    shape = null;
    canvasInstance = null;
}
