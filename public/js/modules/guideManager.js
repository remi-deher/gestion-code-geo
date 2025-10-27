// Fichier: public/js/modules/guideManager.js
/**
 * Gère l'affichage de la bordure de guide aux dimensions du canvas
 * et la fonction pour définir la taille du canvas à partir d'un format.
 */
import { PAGE_FORMATS } from './config.js';

const GUIDE_ID = 'page-guide-border'; // Renommé pour clarté
let canvasInstance = null;

/**
 * Crée ou met à jour le rectangle de guide pour correspondre aux dimensions actuelles du canvas.
 * Dessine une bordure simple aux limites du canvas.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function updatePageGuideBorder(canvas) {
    if (!canvas) return;
    canvasInstance = canvas; // Mémoriser l'instance pour getActiveGuide

    const currentGuide = getActiveGuide();
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    // Si le canvas n'a pas de dimensions valides, ne rien faire ou supprimer
    if (canvasWidth <= 0 || canvasHeight <= 0) {
        removePageGuideBorder();
        return;
    }

    // Le guide prend 100% de la taille du canvas, positionné à (0,0)
    const guideLeft = 0;
    const guideTop = 0;
    const guideWidth = canvasWidth;
    const guideHeight = canvasHeight;

    if (currentGuide) {
        // Mettre à jour les propriétés du guide existant
        currentGuide.set({
            left: guideLeft,
            top: guideTop,
            width: guideWidth,
            height: guideHeight
        });
        currentGuide.setCoords(); // Recalculer
    } else {
        // Créer un nouveau guide (bordure)
        const guide = new fabric.Rect({
            id: GUIDE_ID,
            left: guideLeft,
            top: guideTop,
            width: guideWidth,
            height: guideHeight,
            fill: 'transparent', // Pas de remplissage
            stroke: 'rgba(0, 0, 0, 0.3)', // Bordure discrète
            strokeDashArray: [3, 3], // Pointillés
            strokeWidth: 1, // Ligne fine
            selectable: false, // Non interactif
            evented: false,
            hasControls: false,
            hasBorders: false,
            excludeFromExport: true, // Ne pas sauvegarder dans le JSON
            isGuide: true, // Marqueur
            objectCaching: false // Assurer le rendu correct des pointillés
        });
        canvas.add(guide);
        canvas.sendToBack(guide); // Envoyer derrière tous les autres objets
    }

    canvas.requestRenderAll(); // Demander un rendu, ne pas forcer
    console.log(`GuideManager: Bordure de guide mise à jour (${guideWidth.toFixed(0)}x${guideHeight.toFixed(0)}px).`);
}

/**
 * Récupère l'objet guide (bordure) actif sur le canvas.
 * @returns {fabric.Object | null}
 */
export function getActiveGuide() {
    // Utiliser la variable mémorisée canvasInstance
    if (!canvasInstance) return null;
    return canvasInstance.getObjects().find(obj => obj.isGuide === true);
}

/**
 * Supprime le guide (bordure) du canvas.
 */
export function removePageGuideBorder() {
    if (!canvasInstance) return;
    const currentGuide = getActiveGuide();
    if (currentGuide) {
        canvasInstance.remove(currentGuide);
        canvasInstance.requestRenderAll();
        console.log("GuideManager: Bordure de guide supprimée.");
    }
}

/**
 * Définit la taille du canvas en fonction du format de page choisi.
 * @param {string} formatKey - Clé du format (ex: 'A4-P').
 * @param {fabric.Canvas} canvas - L'instance du canvas.
 * @param {object|null} fallbackImage - L'image chargée (si format Custom) pour définir la taille.
 * @returns {boolean} True si la taille a été définie/modifiée, false sinon.
 */
export function setCanvasSizeFromFormat(formatKey, canvas, fallbackImage = null) {
     if (!canvas) return false;
     const format = PAGE_FORMATS[formatKey];

     let newWidth = 0;
     let newHeight = 0;

     if (format && formatKey !== 'Custom' && format.width > 0 && format.height > 0) {
         // Utiliser les dimensions du format prédéfini
         newWidth = format.width;
         newHeight = format.height;
     } else if (formatKey === 'Custom' && fallbackImage && fallbackImage.width > 0 && fallbackImage.height > 0) {
          // Si Custom ET une image de fond existe, prendre la taille de l'image
          newWidth = fallbackImage.width;
          newHeight = fallbackImage.height;
          console.log(`GuideManager: Format 'Custom', taille canvas définie par l'image (${newWidth}x${newHeight}px).`);
     } else {
         // Fallback si format Custom sans image ou format invalide
         console.warn(`GuideManager: Format '${formatKey}' invalide ou Custom sans image fallback. Utilisation taille par défaut 800x600.`);
         newWidth = 800; // Taille par défaut arbitraire
         newHeight = 600;
     }

     if (canvas.getWidth() !== newWidth || canvas.getHeight() !== newHeight) {
         canvas.setWidth(newWidth);
         canvas.setHeight(newHeight);
         canvas.calcOffset(); // Recalculer offset
         console.log(`GuideManager: Taille du canvas définie à ${newWidth}x${newHeight}px pour format '${formatKey}'.`);
         return true; // La taille a changé
     }
     return false; // La taille était déjà correcte
}
