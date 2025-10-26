// Fichier: public/js/tools/rectangleTool.js
/**
 * Outil Rectangle pour Fabric.js
 * Permet de dessiner un rectangle en cliquant-glissant.
 */

let canvasInstance = null;
let startPoint = null;
let rectangle = null;

// Fonctions liées pour les écouteurs d'événements
const mouseDownHandler = (o) => {
    if (!canvasInstance) return;
    const pointer = canvasInstance.getPointer(o.e);
    startPoint = { x: pointer.x, y: pointer.y };

    // Créer un rectangle initial très petit
    rectangle = new fabric.Rect({
        left: startPoint.x,
        top: startPoint.y,
        width: 0,
        height: 0,
        fill: 'transparent', // Remplissage transparent pendant le dessin
        stroke: 'black',     // Bordure noire
        strokeWidth: 2,
        selectable: false, // Non sélectionnable pendant le dessin
        evented: false,
    });
    canvasInstance.add(rectangle);
};

const mouseMoveHandler = (o) => {
    if (!startPoint || !rectangle || !canvasInstance) return;
    const pointer = canvasInstance.getPointer(o.e);

    // Calculer la largeur et la hauteur
    const width = Math.abs(pointer.x - startPoint.x);
    const height = Math.abs(pointer.y - startPoint.y);

    // Ajuster la position left/top si on dessine vers le haut/gauche
    const left = Math.min(pointer.x, startPoint.x);
    const top = Math.min(pointer.y, startPoint.y);

    rectangle.set({ left, top, width, height });
    canvasInstance.requestRenderAll();
};

const mouseUpHandler = () => {
    if (rectangle) {
        // Finaliser le rectangle : le rendre sélectionnable
        rectangle.setCoords(); // Met à jour les contrôles de l'objet
        rectangle.selectable = true;
        rectangle.evented = true;

        // Si le rectangle est trop petit, le supprimer (éviter les points accidentels)
        if (rectangle.width < 5 && rectangle.height < 5) {
            canvasInstance.remove(rectangle);
        } else {
             // Sélectionner le rectangle nouvellement créé (optionnel)
             // canvasInstance.setActiveObject(rectangle);
             console.log("RectangleTool: Rectangle créé:", rectangle);
        }
        canvasInstance.requestRenderAll();
    }
    // Réinitialiser pour le prochain dessin
    startPoint = null;
    rectangle = null;
};

/**
 * Active l'outil Rectangle.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function activate(canvas) {
    console.log("RectangleTool: Activation");
    canvasInstance = canvas;
    canvas.isDrawingMode = false;
    canvas.selection = false; // Désactiver la sélection globale
    canvas.defaultCursor = 'crosshair';
    canvas.setCursor('crosshair');

    // Désactiver la sélection individuelle des objets existants
    canvas.forEachObject(obj => {
        obj.selectable = false;
        obj.evented = false; // Ne pas pouvoir interagir avec eux
    });

    // Ajouter les écouteurs spécifiques à cet outil
    canvas.on('mouse:down', mouseDownHandler);
    canvas.on('mouse:move', mouseMoveHandler);
    canvas.on('mouse:up', mouseUpHandler);
}

/**
 * Désactive l'outil Rectangle.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function deactivate(canvas) {
    console.log("RectangleTool: Désactivation");
    // Supprimer les écouteurs spécifiques à cet outil
    canvas.off('mouse:down', mouseDownHandler);
    canvas.off('mouse:move', mouseMoveHandler);
    canvas.off('mouse:up', mouseUpHandler);

    // Réactiver la sélection et curseur par défaut (sera fait par activateTool de toolbar.js)
    // canvas.selection = true;
    // canvas.defaultCursor = 'default';
    // canvas.setCursor('default');

     // Réactiver l'interactivité des objets (sera fait par selectTool.activate)
    // canvas.forEachObject(obj => {
    //     obj.selectable = true;
    //     obj.evented = true;
    // });

    // Nettoyer les variables d'état
    startPoint = null;
    rectangle = null;
    canvasInstance = null; // Important pour éviter les fuites de mémoire
}
