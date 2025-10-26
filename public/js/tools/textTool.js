// Fichier: public/js/tools/textTool.js
/**
 * Outil Texte (IText) pour Fabric.js
 * Permet d'ajouter du texte éditable en cliquant sur le canvas.
 */

let canvasInstance = null;

// Fonction liée pour l'écouteur d'événements
const mouseDownHandler = (o) => {
    if (!canvasInstance || o.target) return; // Ne rien faire si on clique sur un objet existant

    const pointer = canvasInstance.getPointer(o.e);

    // Créer un objet IText (texte éditable)
    const text = new fabric.IText('Texte ici', {
        left: pointer.x,
        top: pointer.y,
        fontFamily: 'Arial',
        fontSize: 20, // Taille par défaut
        fill: '#000000',
        originX: 'left',
        originY: 'top',
        // Styles supplémentaires si nécessaire
        // padding: 5,
        // hasControls: true,
        // hasBorders: true,
    });

    canvasInstance.add(text);
    canvasInstance.setActiveObject(text); // Rendre le texte actif pour l'édition immédiate
    text.enterEditing(); // Entrer en mode édition
    text.selectAll(); // Sélectionner tout le texte par défaut

    console.log("TextTool: Objet IText ajouté et activé pour édition.");

    // Optionnel : Désactiver l'outil texte immédiatement après l'ajout pour revenir en sélection
    // import('../ui/toolbar.js').then(({ activateTool }) => {
    //     const selectButton = document.querySelector('#fabric-toolbar button[data-tool="select"]');
    //     if (selectButton) activateTool('select', selectButton, canvasInstance, /* Passer toolMappings ici */);
    // });
};

/**
 * Active l'outil Texte.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function activate(canvas) {
    console.log("TextTool: Activation");
    canvasInstance = canvas;
    canvas.isDrawingMode = false;
    canvas.selection = false; // Désactiver la sélection globale pendant ce mode
    canvas.defaultCursor = 'text';
    canvas.setCursor('text');

    // Rendre les objets existants non sélectionnables temporairement
    canvas.forEachObject(obj => {
        obj.selectable = false;
        obj.evented = false;
    });

    // Ajouter l'écouteur pour créer le texte au clic
    canvas.on('mouse:down', mouseDownHandler);
}

/**
 * Désactive l'outil Texte.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function deactivate(canvas) {
    console.log("TextTool: Désactivation");
    // Supprimer l'écouteur
    canvas.off('mouse:down', mouseDownHandler);

    // Sortir du mode édition si un objet texte est actif
    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject.type === 'i-text' && activeObject.isEditing) {
        activeObject.exitEditing();
    }
    // La réactivation de la sélection et le reset du curseur sont gérés par activateTool de toolbar.js

    canvasInstance = null; // Nettoyer la référence
}
