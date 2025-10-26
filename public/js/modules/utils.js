/**
 * Module utilitaire pour les conversions de coordonnées et les notifications.
 * VERSION CORRIGÉE : Utilise les variables globales (window.original...) pour les calculs.
 * VERSION TOAST CORRIGÉE : Cible le conteneur global '.toast-container'.
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

    const relativeLeft = (percentX / 100) * planWidth;
    const relativeTop = (percentY / 100) * planHeight;
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
         return {posX: 0, posY: 0 };
     }

    const planWidth = window.originalSvgWidth || fabricCanvas.getWidth();
    const planHeight = window.originalSvgHeight || fabricCanvas.getHeight();
    const planOffsetX = window.originalSvgViewBox?.x || 0;
    const planOffsetY = window.originalSvgViewBox?.y || 0;

    if (planWidth === 0 || planHeight === 0) {
        console.warn("convertPixelsToPercent - Dimensions de plan invalides.");
        return { posX: 0, posY: 0 };
    }

    const relativeX = worldX - planOffsetX;
    const relativeY = worldY - planOffsetY;
    const posX = Math.max(0, Math.min(100, (relativeX / planWidth) * 100));
    const posY = Math.max(0, Math.min(100, (relativeY / planHeight) * 100));

    return { posX, posY };
}

/**
 * Affiche une notification (toast) Bootstrap dynamique.
 * @param {string} message - Le message à afficher.
 * @param {string} type - 'success', 'danger', 'warning', 'info' (default: 'info').
 */
export function showToast(message, type = 'info') {
    // 1. Cible le conteneur GLOBAL (défini dans layout.php)
    const container = document.querySelector('.toast-container');
    if (!container) {
        console.error("Conteneur de toast '.toast-container' non trouvé.");
        alert(message); // Fallback si le conteneur n'existe pas
        return;
    }

    // Définir la classe et l'icône en fonction du type
    let toastClass = '';
    let icon = '';
    switch (type) {
        case 'success':
            toastClass = 'text-bg-success'; // Fond vert
            icon = '<i class="bi bi-check-circle-fill me-2"></i>';
            break;
        case 'danger':
            toastClass = 'text-bg-danger'; // Fond rouge
            icon = '<i class="bi bi-exclamation-triangle-fill me-2"></i>';
            break;
        case 'warning':
            toastClass = 'text-bg-warning'; // Fond jaune
            icon = '<i class="bi bi-exclamation-triangle-fill me-2"></i>';
            break;
        default:
            toastClass = 'text-bg-info'; // Fond bleu
            icon = '<i class="bi bi-info-circle-fill me-2"></i>';
            break;
    }

    // 3. Créer l'élément toast
    const toastElement = document.createElement('div');
    const toastId = 'toast-' + Date.now();
    toastElement.id = toastId;
    toastElement.className = `toast align-items-center ${toastClass} border-0`;
    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');
    toastElement.setAttribute('data-bs-delay', '5000'); // 5 secondes
    
    toastElement.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${icon} ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    // 4. Ajouter le toast au conteneur
    container.appendChild(toastElement);

    // 5. Initialiser et afficher le toast
    const toast = new bootstrap.Toast(toastElement);
    toast.show();

    // 6. Supprimer l'élément du DOM après sa disparition
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}
