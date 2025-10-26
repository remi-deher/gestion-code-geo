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
    canvas.selection = true; // IMPORTANT: Activer la sélection d'objets (zone de sélection)
    canvas.defaultCursor = 'default'; // Curseur par défaut
    canvas.setCursor('default'); // Appliquer immédiatement

    // IMPORTANT: Réactiver l'interactivité pour TOUS les objets (sauf les guides/fonds)
    canvas.forEachObject(obj => {
        // Ne pas rendre sélectionnables les éléments marqués comme non interactifs (ex: guide de page, fond SVG/Image)
        if (obj.excludeFromExport || obj.isGuide || obj.isBackground) {
             obj.selectable = false;
             obj.evented = false; // Ne réagit pas aux clics
        } else {
             obj.selectable = true; // Rendre sélectionnable
             obj.evented = true; // Rendre cliquable/interactif
        }
    });

    // S'assurer que les contrôles d'objets sont visibles (si un style les avait cachés)
    // fabric.Object.prototype.hasControls = true; // Peut être trop global, à gérer plus finement si besoin
    // fabric.Object.prototype.hasBorders = true;

    canvas.requestRenderAll(); // Redessiner pour appliquer les changements
}

/**
 * Désactive l'outil de sélection (généralement appelé avant d'activer un autre outil).
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function deactivate(canvas) {
    console.log("SelectTool: Désactivation");
    // IMPORTANT: Désactiver la sélection par zone pour éviter les conflits avec les clics des outils de dessin
    canvas.selection = false;
    canvas.discardActiveObject(); // Désélectionner tout objet actif
    canvas.requestRenderAll();
    // Les autres outils définiront leur propre curseur.
}
