// Fichier: public/js/tools/selectTool.js
/**
 * Outil de Sélection pour Fabric.js
 * Réactive le comportement de sélection standard.
 */

/**
 * Active l'outil de sélection.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function activate(canvas) {
    console.log("SelectTool: Activation");
    canvas.isDrawingMode = false; // Désactiver tout mode de dessin libre
    canvas.selection = true; // Activer la sélection d'objets (zone de sélection)
    canvas.defaultCursor = 'default'; // Curseur par défaut
    canvas.setCursor('default');

    // S'assurer que les objets sont sélectionnables (Fabric le fait par défaut, mais au cas où)
    canvas.forEachObject(obj => {
        // Ne pas rendre le fond sélectionnable s'il a été ajouté comme objet
        if (obj.isBackground) {
             obj.selectable = false;
             obj.evented = false;
        } else {
             obj.selectable = true;
             obj.evented = true; // Permet de cliquer sur l'objet
        }
    });

    // Optionnel : Désactiver le dessin de groupe lors de la sélection (drag pour déplacer)
    // canvas.selectionKey = 'shiftKey'; // Activer la sélection multiple seulement avec Shift

    canvas.requestRenderAll(); // Redessiner si nécessaire
}

/**
 * Désactive l'outil de sélection (généralement appelé avant d'activer un autre outil).
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function deactivate(canvas) {
    console.log("SelectTool: Désactivation");
    // Généralement, il n'y a rien de spécifique à désactiver pour l'outil
    // de sélection de base, car les autres outils écraseront son comportement.
    // On pourrait par exemple supprimer des écouteurs spécifiques ajoutés dans activate()
    // si on en avait mis.
    canvas.selection = false; // Désactiver la sélection par zone pour éviter conflits
    canvas.discardActiveObject(); // Désélectionner tout objet actif
    canvas.requestRenderAll();
}

// Optionnel: Exporter d'autres fonctions si cet outil avait des options spécifiques
// export function setSelectOptions(options) { ... }
