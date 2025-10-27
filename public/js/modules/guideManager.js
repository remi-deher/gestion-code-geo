// Fichier: public/js/modules/guideManager.js
/**
 * Gère l'affichage, la création et la mise à jour du rectangle de guide de page.
 * Redimensionne le canvas de travail en fonction du format sélectionné.
 */
import { PAGE_FORMATS, CANVAS_OVERSIZE_FACTOR } from './config.js';

const GUIDE_ID = 'page-guide';
let canvasInstance = null;

/**
 * Crée ou met à jour le rectangle de guide sur le canvas, et adapte le canvas pour laisser une marge.
 * @param {string} formatKey - Clé du format (ex: 'A4-P', 'A3-L', 'Custom').
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 * @param {object} [planData=null] - Les données du plan (pour vérification).
 */
export function updatePageGuide(formatKey, canvas, planData = null) {
    if (!canvas) return;
    canvasInstance = canvas;

    const currentGuide = getActiveGuide();
    const format = PAGE_FORMATS[formatKey];

    // --- 1. Gestion du format Custom / Aucun ---
    if (!format || formatKey === 'Custom' || (format.width === 0 && format.height === 0)) {
        if (currentGuide) {
            canvas.remove(currentGuide);
            canvas.renderAll();
            console.log("GuideManager: Guide supprimé (format Custom ou invalide).");
        }
        return;
    }

    // Définir les dimensions cibles du guide
    const guideWidth = format.width;
    const guideHeight = format.height;

    // Dimensions du nouveau Canvas de travail (Guide x Facteur d'agrandissement)
    const newCanvasWidth = Math.round(guideWidth * CANVAS_OVERSIZE_FACTOR);
    const newCanvasHeight = Math.round(guideHeight * CANVAS_OVERSIZE_FACTOR);

    // Position du guide dans le nouveau Canvas (centré)
    const guideLeft = (newCanvasWidth - guideWidth) / 2;
    const guideTop = (newCanvasHeight - guideHeight) / 2;

    // --- 2. Adaptation du CANVAS ---
    if (canvas.getWidth() !== newCanvasWidth || canvas.getHeight() !== newCanvasHeight) {

        const oldWidth = canvas.getWidth();
        const oldHeight = canvas.getHeight();
        const background = canvas.backgroundImage;

        canvas.setWidth(newCanvasWidth);
        canvas.setHeight(newCanvasHeight);
        canvas.calcOffset();

        if (background && background.isBackground) {
            background.set({
                left: guideLeft,
                top: guideTop,
            });
            background.setCoords();
            console.log(`GuideManager: Fond repositionné à (${guideLeft.toFixed(0)}, ${guideTop.toFixed(0)}) après redimensionnement.`);
        }
        console.log(`GuideManager: Canvas de travail redimensionné à (${newCanvasWidth}x${newCanvasHeight}px) pour format '${formatKey}'.`);
    }

    // --- 3. Création / Mise à jour du Guide (le rectangle de bordure) ---
    if (currentGuide) {
        currentGuide.set({
            left: guideLeft,
            top: guideTop,
            width: guideWidth,
            height: guideHeight
        });
        currentGuide.setCoords();
    } else {
        const guide = new fabric.Rect({
            id: GUIDE_ID,
            left: guideLeft,
            top: guideTop,
            width: guideWidth,
            height: guideHeight,
            fill: 'rgba(255, 255, 255, 0.05)',
            stroke: 'rgba(0, 0, 0, 0.5)',
            strokeDashArray: [5, 5],
            strokeWidth: 2,
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
            excludeFromExport: true,
            isGuide: true,
            objectCaching: false
        });
        canvas.add(guide);
        canvas.sendToBack(guide);
    }

    canvas.renderAll();
    console.log(`GuideManager: Guide '${formatKey}' mis à jour/créé et centré.`);
}

/**
 * Récupère l'objet guide actif sur le canvas.
 * @returns {fabric.Object | null}
 */
export function getActiveGuide() {
    if (!canvasInstance) return null;
    return canvasInstance.getObjects().find(obj => obj.isGuide === true);
}

/**
 * Supprime le guide de page du canvas.
 */
export function removePageGuide() {
    if (!canvasInstance) return;
    const currentGuide = getActiveGuide();
    if (currentGuide) {
        canvasInstance.remove(currentGuide);
        canvasInstance.renderAll();
        console.log("GuideManager: Guide supprimé.");
    }
}
