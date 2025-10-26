// Fichier: public/js/modules/guideManager.js
/**
 * Gère l'affichage, la création et la mise à jour du rectangle de guide de page.
 */
import { PAGE_FORMATS } from './config.js';

const GUIDE_ID = 'page-guide';
let canvasInstance = null;

/**
 * Crée ou met à jour le rectangle de guide sur le canvas.
 * @param {string} formatKey - Clé du format (ex: 'A4P', 'A3L', 'Custom').
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 * @param {boolean} [center=true] - Centrer le guide sur le canvas.
 */
export function updatePageGuide(formatKey, canvas, center = true) {
    if (!canvas) return;
    canvasInstance = canvas;

    const currentGuide = getActiveGuide();
    const format = PAGE_FORMATS[formatKey];

    // Si le format est Custom ou inconnu, supprimer le guide s'il existe
    if (!format || formatKey === 'Custom' || (format.width === 0 && format.height === 0)) {
        if (currentGuide) {
            canvas.remove(currentGuide);
            canvas.renderAll();
        }
        return;
    }

    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    // Déterminer la position
    let left = 0;
    let top = 0;

    if (center) {
        // Centrer le guide sur la zone du plan
        left = canvasWidth / 2 - format.width / 2;
        top = canvasHeight / 2 - format.height / 2;
        // S'assurer que le guide ne sort pas des limites
        left = Math.max(0, left);
        top = Math.max(0, top);
    } else {
        // Aligner en haut à gauche (par défaut)
    }


    if (currentGuide) {
        // Mettre à jour les propriétés du guide existant
        currentGuide.set({
            left: left,
            top: top,
            width: format.width,
            height: format.height
        });
        currentGuide.setCoords(); // Recalculer les contrôles (même s'ils sont désactivés)
    } else {
        // Créer un nouveau guide
        const guide = new fabric.Rect({
            id: GUIDE_ID, // Identifiant unique
            left: left,
            top: top,
            width: format.width,
            height: format.height,
            fill: 'rgba(255, 255, 255, 0.05)', // Très léger remplissage
            stroke: 'rgba(0, 0, 0, 0.5)',
            strokeDashArray: [5, 5], // Bordure en pointillés
            strokeWidth: 2,
            selectable: false, // Non interactif
            evented: false,    // Non cliquable
            hoverCursor: 'default',
            hasControls: false,
            hasBorders: false,
            // Marquer l'objet pour l'exclure des sélections, sauvegardes, et exports
            excludeFromExport: true, 
            isGuide: true,
            objectCaching: false // Toujours dessiner correctement
        });
        canvas.add(guide);
        canvas.sendToBack(guide); // Envoyer derrière tous les objets
    }

    canvas.renderAll();
    console.log(`GuideManager: Guide '${formatKey}' mis à jour/créé.`);
}

/**
 * Récupère l'objet guide actif sur le canvas.
 * @returns {fabric.Object | null}
 */
export function getActiveGuide() {
    if (!canvasInstance) return null;
    // La méthode getObjects().find est le moyen le plus simple d'accéder à un objet par propriété
    return canvasInstance.getObjects().find(obj => obj.id === GUIDE_ID);
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
    }
}
