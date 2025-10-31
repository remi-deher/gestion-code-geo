// Fichier: public/js/tools/pencilTool.js
/**
 * Outil Crayon (Dessin à main levée) pour Fabric.js
 * Utilise le mode isDrawingMode de Fabric.
 */
import { getCurrentColors } from '../ui/colorManager.js';
import { getCurrentStrokeWidth } from '../ui/propertyInspector.js'; // Importer depuis le nouveau module

let canvasInstance = null;

/**
 * Active l'outil Crayon.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function activate(canvas) {
    console.log("PencilTool: Activation");
    canvasInstance = canvas;
    
    // Récupérer les propriétés actuelles
    const colors = getCurrentColors();
    const strokeWidth = getCurrentStrokeWidth(); // Récupérer l'épaisseur

    // Configurer la brosse
    const brush = new fabric.PencilBrush(canvas);
    brush.color = colors.stroke;     // Le crayon utilise la couleur de "bordure"
    brush.width = strokeWidth;
    
    // Appliquer la brosse et activer le mode dessin
    canvas.freeDrawingBrush = brush;
    canvas.isDrawingMode = true;
    canvas.selection = false; // Désactiver la sélection
    canvas.defaultCursor = 'crosshair';
    canvas.setCursor('crosshair');

    // Désactiver l'interaction avec les objets existants
    canvas.forEachObject(obj => {
        obj.selectable = false;
        obj.evented = false;
    });
}

/**
 * Désactive l'outil Crayon.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function deactivate(canvas) {
    console.log("PencilTool: Désactivation");
    canvas.isDrawingMode = false;
    canvasInstance = null;
    // La réactivation de la sélection et le curseur par défaut
    // seront gérés par le 'selectTool' via 'toolbar.js'.
}
