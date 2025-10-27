// Fichier: public/js/modules/navigationManager.js
/**
 * Gère le zoom et le déplacement (pan) du canvas Fabric.js.
 */

import { MIN_ZOOM, MAX_ZOOM } from './config.js';

let canvasInstance = null;
let isPanningWithAlt = false; // Pour le pan Alt+Clic
let isPanToolActive = false; // Pour l'outil Pan de la toolbar
let lastPosX, lastPosY;

// --- Zoom Molette (Facteur ajusté) ---
const handleWheelZoom = (opt) => {
    if (!canvasInstance) return;
    const delta = opt.e.deltaY;
    let zoom = canvasInstance.getZoom();
    // Ajuster le facteur pour des pas plus petits (ex: 0.999 ou 0.995 au lieu de 0.99)
    const zoomFactor = 0.995;
    zoom *= zoomFactor ** delta;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

    canvasInstance.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);

    opt.e.preventDefault();
    opt.e.stopPropagation();
};

// --- Logique de Pan (commune aux deux modes) ---
const handleMouseDownPanLogic = (opt) => {
    const evt = opt.e;
    // Condition: Soit l'outil Pan est actif, SOIT la touche Alt est pressée
    if ((isPanToolActive || evt.altKey === true) && canvasInstance) {
        isPanningWithAlt = true; // Utiliser ce flag pour les deux modes
        canvasInstance.selection = false; // Désactiver sélection pendant pan
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
        canvasInstance.setCursor('grab'); // Curseur "main fermée"
        canvasInstance.renderAll(); // Mettre à jour le curseur visuellement
        return true; // Indique que l'événement a été géré
    }
    return false; // Non géré
};

const handleMouseMovePanLogic = (opt) => {
    if (isPanningWithAlt && canvasInstance) {
        const e = opt.e;
        const vpt = canvasInstance.viewportTransform;
        if (vpt) {
            vpt[4] += e.clientX - lastPosX;
            vpt[5] += e.clientY - lastPosY;
            canvasInstance.requestRenderAll(); // Demander un rendu, pas forcer
            lastPosX = e.clientX;
            lastPosY = e.clientY;
        }
    }
};

const handleMouseUpPanLogic = () => {
    if (isPanningWithAlt && canvasInstance) {
        canvasInstance.setViewportTransform(canvasInstance.viewportTransform); // Appliquer transfo finale
        isPanningWithAlt = false;
        // Ne réactiver la sélection QUE si l'outil Pan n'est PAS actif
        if (!isPanToolActive) {
            canvasInstance.selection = true;
        }
        // Le curseur sera géré par l'outil actif (soit 'grab' si pan, soit autre chose)
        canvasInstance.setCursor(canvasInstance.defaultCursor);
        canvasInstance.renderAll();
    }
};

/**
 * Initialise les contrôles de navigation (zoom, pan).
 * @param {HTMLElement} toolbarElement - La barre d'outils pour les boutons.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function setupNavigation(toolbarElement, canvas) {
    canvasInstance = canvas;

    // --- Activer Zoom Molette ---
    // Utiliser l'élément wrapper pour l'écouteur wheel pour une meilleure capture
    const wrapper = canvas.wrapperEl;
    if (wrapper) {
         wrapper.addEventListener('wheel', (e) => {
             // Passer l'événement Fabric simulé à la fonction de gestion
             handleWheelZoom({ e: e });
         }, { passive: false }); // false pour pouvoir appeler preventDefault
    } else {
        canvas.on('mouse:wheel', handleWheelZoom); // Fallback sur le canvas
    }


    // --- Activer Pan (Alt+Clic sera TOUJOURS actif) ---
    // Note: on attache ces écouteurs directement ici, ils ne sont pas liés à l'outil Pan
    canvas.on('mouse:down:before', handleMouseDownPanLogic); // Utiliser :before pour intercepter avant la sélection standard
    canvas.on('mouse:move', handleMouseMovePanLogic);
    canvas.on('mouse:up', handleMouseUpPanLogic);
    canvas.on('mouse:out', handleMouseUpPanLogic); // Gérer sortie du canvas

    // --- Ajouter des boutons à la toolbar ---
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'd-inline-flex align-items-center gap-1 border-start ps-2 ms-1';

    const btnClasses = 'btn btn-outline-secondary btn-sm';
    const actions = [
        { id: 'zoom-in', icon: 'bi-zoom-in', title: 'Zoom avant', action: () => zoomRelative(1.2) },
        { id: 'zoom-out', icon: 'bi-zoom-out', title: 'Zoom arrière', action: () => zoomRelative(0.8) },
        { id: 'zoom-reset', icon: 'bi-aspect-ratio', title: 'Zoom initial (100%)', action: () => zoomAbsolute(1) },
        // L'action du bouton Pan sera gérée par le toolbarManager via data-tool="pan"
        { id: 'pan-tool-btn', icon: 'bi-arrows-move', title: 'Activer/Désactiver Pan (Main)', toolName: 'pan' }
    ];

    actions.forEach(act => {
        const button = document.createElement('button');
        button.id = act.id;
        button.className = btnClasses;
        button.title = act.title;
        button.innerHTML = `<i class="bi ${act.icon}"></i>`;
        if (act.action) {
            button.addEventListener('click', act.action);
        }
        // Marquer le bouton Pan comme un outil pour toolbar.js
        if (act.toolName === 'pan') {
             button.dataset.tool = 'pan';
        }
        controlsContainer.appendChild(button);
    });

    toolbarElement.appendChild(controlsContainer);

    console.log("NavigationManager: Zoom (molette) et Pan (Alt+Clic/Outil) initialisés.");
}

/** Applique un zoom relatif */
function zoomRelative(factor) {
    if (!canvasInstance) return;
    let zoom = canvasInstance.getZoom();
    zoom *= factor;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    zoomAbsolute(zoom);
}

/** Applique un zoom absolu */
function zoomAbsolute(zoomLevel) {
     if (!canvasInstance) return;
     zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel));
     const center = canvasInstance.getCenter();
     canvasInstance.zoomToPoint(new fabric.Point(center.left, center.top), zoomLevel);
}

// --- Fonctions spécifiques pour l'OUTIL Pan (appelées par toolbar.js) ---

/**
 * Active l'outil Pan (cliquer-glisser déplace le canvas).
 * @param {fabric.Canvas} canvas
 */
export function activatePanTool(canvas) {
    if (!canvas) return;
    console.log("NavigationManager: Activation Outil Pan");
    isPanToolActive = true;
    canvas.selection = false; // Désactiver sélection d'objet
    canvas.defaultCursor = 'grab'; // Curseur main
    canvas.setCursor('grab');
    // Rendre les objets non-interactifs pendant le pan
    canvas.forEachObject(obj => obj.evented = false);
    canvas.renderAll(); // Mettre à jour curseur etc.
}

/**
 * Désactive l'outil Pan.
 * @param {fabric.Canvas} canvas
 */
export function deactivatePanTool(canvas) {
    if (!canvas) return;
    console.log("NavigationManager: Désactivation Outil Pan");
    isPanToolActive = false;
    // La réactivation de la sélection et le reset curseur sont gérés par toolbar.js
    // Réactiver l'interactivité des objets (sera fait par l'outil Select)
    // canvas.forEachObject(obj => obj.evented = true);
}

// Fonction de désactivation globale (si nécessaire)
export function deactivateNavigation(canvas) {
    if (!canvas) return;
    const wrapper = canvas.wrapperEl;
    if (wrapper) {
         wrapper.removeEventListener('wheel', handleWheelZoom);
    }
    canvas.off('mouse:wheel', handleWheelZoom);
    canvas.off('mouse:down:before', handleMouseDownPanLogic);
    canvas.off('mouse:move', handleMouseMovePanLogic);
    canvas.off('mouse:up', handleMouseUpPanLogic);
    canvas.off('mouse:out', handleMouseUpPanLogic);
    console.log("NavigationManager: Écouteurs désactivés.");
}
