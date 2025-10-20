/**
 * Fonctions utilitaires partagées.
 * VERSION MISE A JOUR: Prend en compte la BBox SVG pour les conversions de coordonnées.
 */
import { getCanvasInstance, getSvgOriginalBBox } from '../plan/canvas.js';

/**
 * Convertit les coordonnées en pourcentage (0-100) en pixels absolus sur le canvas Fabric,
 * en tenant compte de l'origine et de l'échelle du fond (image ou BBox SVG).
 * @param {number} percentX - Coordonnée X en pourcentage (0-100).
 * @param {number} percentY - Coordonnée Y en pourcentage (0-100).
 * @param {fabric.Canvas} fabricCanvas - L'instance du canvas Fabric.
 * @returns {{left: number, top: number}} Coordonnées en pixels (référentiel "monde" non zoomé).
 */
export function convertPercentToPixels(percentX, percentY, fabricCanvas) {
    if (!fabricCanvas) return { left: NaN, top: NaN };

    const bgImage = fabricCanvas.backgroundImage;
    const svgBBox = getSvgOriginalBBox(); // Récupère la BBox calculée au chargement

    let refLeft = 0, refTop = 0, refWidth = 0, refHeight = 0;

    if (bgImage && bgImage.originalWidth > 0 && bgImage.originalHeight > 0) {
        // Cas 1: Image de fond (plan 'image')
        // Référence = dimensions originales de l'image, à l'origine (0,0) du canvas
        refLeft = bgImage.left; // Doit être 0
        refTop = bgImage.top;   // Doit être 0
        refWidth = bgImage.originalWidth;
        refHeight = bgImage.originalHeight;
        // console.log("convertPercentToPixels using bgImage");
    } else if (svgBBox && svgBBox.width > 0 && svgBBox.height > 0) {
        // Cas 2: BBox SVG (plan 'svg')
        // Référence = dimensions et position de la BBox originale
        refLeft = svgBBox.left;
        refTop = svgBBox.top;
        refWidth = svgBBox.width;
        refHeight = svgBBox.height;
        // console.log("convertPercentToPixels using svgBBox");
    } else {
        console.warn("convertPercentToPixels - Référence (Image ou BBox SVG) invalide. Utilisation du canvas.");
        // Fallback: utiliser les dimensions du canvas (moins précis, ne scale pas)
        refWidth = fabricCanvas.getWidth();
        refHeight = fabricCanvas.getHeight();
    }

    if (refWidth === 0 || refHeight === 0) return { left: NaN, top: NaN };

    // Calcule la position en pixels dans le "monde" (référentiel 1:1)
    const worldX = refLeft + (percentX / 100) * refWidth;
    const worldY = refTop + (percentY / 100) * refHeight;
    
    // Note: C'est à l'appelant (ex: création de l'objet Fabric) de gérer le viewportTransform
    // Les objets Fabric sont créés dans le "monde", pas sur "l'écran".
    
    // console.log(`In: ${percentX}%, ${percentY}% -> Out (World): ${worldX}, ${worldY}`);
    return { left: worldX, top: worldY };
}


/**
 * Convertit les coordonnées en pixels absolus (référentiel "monde" non zoomé) en pourcentage (0-100)
 * par rapport au fond (image ou BBox SVG original).
 * @param {number} worldX - Coordonnée X en pixels (référentiel "monde").
 * @param {number} worldY - Coordonnée Y en pixels (référentiel "monde").
 * @param {fabric.Canvas} fabricCanvas - L'instance du canvas Fabric.
 * @returns {{posX: number, posY: number}} Coordonnées en pourcentage.
 */
export function convertPixelsToPercent(worldX, worldY, fabricCanvas) {
     if (!fabricCanvas) return { posX: 0, posY: 0 };

    const bgImage = fabricCanvas.backgroundImage;
    const svgBBox = getSvgOriginalBBox();

    let refLeft = 0, refTop = 0, refWidth = 0, refHeight = 0;

    if (bgImage && bgImage.originalWidth > 0 && bgImage.originalHeight > 0) {
        // Cas 1: Image de fond
        refLeft = bgImage.left;
        refTop = bgImage.top;
        refWidth = bgImage.originalWidth;
        refHeight = bgImage.originalHeight;
        // console.log("convertPixelsToPercent using bgImage");
    } else if (svgBBox && svgBBox.width > 0 && svgBBox.height > 0) {
        // Cas 2: BBox SVG
        refLeft = svgBBox.left;
        refTop = svgBBox.top;
        refWidth = svgBBox.width;
        refHeight = svgBBox.height;
        // console.log("convertPixelsToPercent using svgBBox");
    } else {
        console.warn("convertPixelsToPercent - Référence (Image ou BBox SVG) invalide.");
        refWidth = fabricCanvas.getWidth(); // Fallback peu fiable
        refHeight = fabricCanvas.getHeight();
    }

    if (refWidth === 0 || refHeight === 0) {
        return { posX: 0, posY: 0 };
    }

    // Calcul des coordonnées relatives (en pixels) par rapport à l'origine de la référence
    const relativeX = worldX - refLeft;
    const relativeY = worldY - refTop;

    // Calcul du pourcentage par rapport aux dimensions de la référence
    const posX = Math.max(0, Math.min(100, (relativeX / refWidth) * 100));
    const posY = Math.max(0, Math.min(100, (relativeY / refHeight) * 100));

    // console.log(`In (World): ${worldX}, ${worldY} -> Out: ${posX}%, ${posY}%`);
    return { posX, posY };
}

/**
 * Magnétise une valeur à la grille la plus proche.
 * @param {number} coord - Coordonnée (non zoomée).
 * @param {number} gridSize - Taille de la grille (non zoomée).
 * @returns {number} Coordonnée magnétisée.
 */
export function snapToGridValue(coord, gridSize) {
    if (gridSize <= 0) return coord;
    return Math.round(coord / gridSize) * gridSize;
}

/**
 * Affiche une notification (toast) Bootstrap.
 * @param {string} message - Le message à afficher.
 * @param {string} type - 'success', 'danger', 'warning', 'info' (default: 'info').
 */
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-notification-container');
    if (!container) {
        console.error("Conteneur de toast #toast-notification-container non trouvé.");
        alert(message); // Fallback
        return;
    }

    const toastId = 'toast-' + Date.now();
    let iconHtml = '';
    let headerText = 'Information';
    let headerClass = 'text-muted';

    switch (type) {
        case 'success':
            iconHtml = '<i class="bi bi-check-circle-fill text-success me-2"></i>';
            headerText = 'Succès';
            headerClass = 'text-success';
            break;
        case 'danger':
            iconHtml = '<i class="bi bi-x-octagon-fill text-danger me-2"></i>';
            headerText = 'Erreur';
            headerClass = 'text-danger';
            break;
        case 'warning':
            iconHtml = '<i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>';
            headerText = 'Avertissement';
            headerClass = 'text-warning';
            break;
        case 'info':
        default:
            iconHtml = '<i class="bi bi-info-circle-fill text-info me-2"></i>';
            headerText = 'Info';
            headerClass = 'text-info';
            break;
    }

    const toastHtml = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="5000">
            <div class="toast-header">
                ${iconHtml}
                <strong class="me-auto ${headerClass}">${headerText}</strong>
                <small class="text-muted">À l'instant</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', toastHtml);

    const toastElement = document.getElementById(toastId);
    if (toastElement) {
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
        // Nettoyer le DOM après disparition
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
}
