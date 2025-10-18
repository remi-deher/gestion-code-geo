/**
 * Fonctions utilitaires partagées.
 */

/**
 * Convertit les coordonnées en pourcentage (0-100) en pixels absolus sur le canvas Fabric,
 * en tenant compte de l'origine et de l'échelle de l'image de fond ou du groupe SVG.
 * @param {number} percentX - Coordonnée X en pourcentage.
 * @param {number} percentY - Coordonnée Y en pourcentage.
 * @param {fabric.Canvas} fabricCanvas - L'instance du canvas Fabric.
 * @returns {{left: number, top: number}} Coordonnées en pixels.
 */
export function convertPercentToPixels(percentX, percentY, fabricCanvas) {
    const bg = fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group');
    const originalWidth = bg?.originalWidth || bg?.width;
    const originalHeight = bg?.originalHeight || bg?.height;

    if (!bg || !originalWidth || !originalHeight || originalWidth === 0 || originalHeight === 0) {
        console.warn("convertPercentToPixels - Arrière-plan ou dimensions originales invalides.", bg);
        return { left: NaN, top: NaN };
    }

    const relativeX = (percentX / 100) * originalWidth;
    const relativeY = (percentY / 100) * originalHeight;

    const bgOrigin = bg.getPointByOrigin('left', 'top');
    const bgScaleX = bg.scaleX || 1;
    const bgScaleY = bg.scaleY || 1;

    const globalX = bgOrigin.x + relativeX * bgScaleX;
    const globalY = bgOrigin.y + relativeY * bgScaleY;

    return { left: globalX, top: globalY };
}

/**
 * Convertit les coordonnées en pixels absolus sur le canvas Fabric en pourcentage (0-100)
 * par rapport à l'image de fond ou au groupe SVG original.
 * @param {number} pixelX - Coordonnée X en pixels.
 * @param {number} pixelY - Coordonnée Y en pixels.
 * @param {fabric.Canvas} fabricCanvas - L'instance du canvas Fabric.
 * @returns {{posX: number, posY: number}} Coordonnées en pourcentage.
 */
export function convertPixelsToPercent(pixelX, pixelY, fabricCanvas) {
    const bg = fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group');
    const originalWidth = bg?.originalWidth || bg?.width;
    const originalHeight = bg?.originalHeight || bg?.height;

    if (!bg || !originalWidth || !originalHeight || originalWidth === 0 || originalHeight === 0) {
        console.warn("convertPixelsToPercent - Arrière-plan ou dimensions originales invalides.", bg);
        return { posX: 0, posY: 0 };
    }

    const bgOrigin = bg.getPointByOrigin('left', 'top');
    const bgScaleX = bg.scaleX || 1;
    const bgScaleY = bg.scaleY || 1;

    // Calcul des coordonnées relatives à l'origine du fond SANS son échelle actuelle
    const relativeX = (pixelX - bgOrigin.x) / bgScaleX;
    const relativeY = (pixelY - bgOrigin.y) / bgScaleY;

    // Calcul du pourcentage par rapport aux dimensions ORIGINALES
    const posX = Math.max(0, Math.min(100, (relativeX / originalWidth) * 100));
    const posY = Math.max(0, Math.min(100, (relativeY / originalHeight) * 100));

    return { posX, posY };
}

/**
 * Aligne les coordonnées sur la grille.
 * @param {number} coord - Coordonnée (x ou y).
 * @param {number} gridSize - Taille de la grille.
 * @returns {number} Coordonnée alignée.
 */
export function snapToGridValue(coord, gridSize) {
    return Math.round(coord / gridSize) * gridSize;
}

/**
 * Affiche une notification de type "toast" Bootstrap (si l'élément existe).
 * @param {string} message - Le message à afficher.
 * @param {string} type - 'success', 'danger', 'warning', 'info'.
 */
export function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-notification-container'); // Assurez-vous d'avoir ce conteneur dans votre layout.php
    if (!toastContainer) {
        console.warn("Conteneur de toast non trouvé. Message:", message);
        alert(message); // Fallback
        return;
    }

    const toastId = `toast-${Date.now()}`;
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);

    const toastElement = document.getElementById(toastId);
    if (toastElement) {
        const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
        toast.show();
        toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
    }
}
