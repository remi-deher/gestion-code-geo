/**
 * Module utilitaire pour les conversions de coordonnées et les notifications.
 * VERSION CORRIGÉE : Utilise les variables globales (window.original...) pour les calculs.
 */

/**
 * Convertit les coordonnées en pourcentage (0-100) en pixels absolus sur le canvas Fabric.
 * @param {number} percentX - Coordonnée X en pourcentage (0-100).
 * @param {number} percentY - Coordonnée Y en pourcentage (0-100).
 * @param {fabric.Canvas} fabricCanvas - L'instance du canvas Fabric.
 * @returns {{left: number, top: number}} Coordonnées en pixels (référentiel "monde" non zoomé).
 */
export function convertPercentToPixels(percentX, percentY, fabricCanvas) {
    if (!fabricCanvas) {
        console.warn("convertPercentToPixels: Canvas non fourni.");
        return { left: NaN, top: NaN };
    }

    // Utilise les dimensions originales stockées dans window par canvas.js
    const planWidth = window.originalSvgWidth || fabricCanvas.getWidth();
    const planHeight = window.originalSvgHeight || fabricCanvas.getHeight();
    const planOffsetX = window.originalSvgViewBox?.x || 0;
    const planOffsetY = window.originalSvgViewBox?.y || 0;

    if (!planWidth || !planHeight || planWidth <= 0 || planHeight <= 0) {
        console.error("Dimensions du plan invalides pour conversion en pixels", { planWidth, planHeight });
        return { left: NaN, top: NaN };
    }

    // Calcule la position en pixels par rapport à l'origine du plan (0,0 dans le viewBox)
    const relativeLeft = (percentX / 100) * planWidth;
    const relativeTop = (percentY / 100) * planHeight;

    // Ajoute l'offset du viewBox pour obtenir les coordonnées absolues sur le canvas
    const left = relativeLeft + planOffsetX;
    const top = relativeTop + planOffsetY;

    return { left, top };
}


/**
 * Convertit les coordonnées en pixels absolus (référentiel "monde") en pourcentage (0-100).
 * @param {number} worldX - Coordonnée X en pixels (référentiel "monde").
 * @param {number} worldY - Coordonnée Y en pixels (référentiel "monde").
 * @param {fabric.Canvas} fabricCanvas - L'instance du canvas Fabric.
 * @returns {{posX: number, posY: number}} Coordonnées en pourcentage.
 */
export function convertPixelsToPercent(worldX, worldY, fabricCanvas) {
     if (!fabricCanvas) {
         console.warn("convertPixelsToPercent: Canvas non fourni.");
         return { posX: 0, posY: 0 };
     }

    // Utilise les dimensions originales stockées dans window par canvas.js
    const planWidth = window.originalSvgWidth || fabricCanvas.getWidth();
    const planHeight = window.originalSvgHeight || fabricCanvas.getHeight();
    const planOffsetX = window.originalSvgViewBox?.x || 0;
    const planOffsetY = window.originalSvgViewBox?.y || 0;

    if (planWidth === 0 || planHeight === 0) {
        console.warn("convertPixelsToPercent - Dimensions de plan invalides.");
        return { posX: 0, posY: 0 };
    }

    // Calcul des coordonnées relatives (en pixels) par rapport à l'origine de la référence
    const relativeX = worldX - planOffsetX;
    const relativeY = worldY - planOffsetY;

    // Calcul du pourcentage par rapport aux dimensions de la référence
    const posX = Math.max(0, Math.min(100, (relativeX / planWidth) * 100));
    const posY = Math.max(0, Math.min(100, (relativeY / planHeight) * 100));

    return { posX, posY };
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
