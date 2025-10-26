// Fichier: public/js/modules/navigationManager.js
/**
 * Gère le zoom et le déplacement (pan) du canvas Fabric.js.
 */

import { MIN_ZOOM, MAX_ZOOM } from './config.js'; // Importer les limites

let canvasInstance = null;
let isPanning = false;
let lastPosX, lastPosY;

// Fonction liée pour le zoom molette
const handleWheelZoom = (opt) => {
    if (!canvasInstance) return;
    const delta = opt.e.deltaY;
    let zoom = canvasInstance.getZoom();
    zoom *= 0.99 ** delta; // Facteur de zoom
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)); // Limiter le zoom

    // Zoomer en gardant le pointeur de la souris comme centre
    canvasInstance.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);

    opt.e.preventDefault();
    opt.e.stopPropagation();
};

// Fonctions liées pour le pan Alt+Clic
const handleMouseDownPan = (opt) => {
    const evt = opt.e;
    if (evt.altKey === true && canvasInstance) {
        isPanning = true;
        canvasInstance.selection = false; // Désactiver sélection
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
        canvasInstance.setCursor('grab');
        canvasInstance.requestRenderAll();
    }
};

const handleMouseMovePan = (opt) => {
    if (isPanning && canvasInstance) {
        const e = opt.e;
        const vpt = canvasInstance.viewportTransform;
        if (vpt) { // Vérifier si viewportTransform est défini
            vpt[4] += e.clientX - lastPosX;
            vpt[5] += e.clientY - lastPosY;
            canvasInstance.requestRenderAll();
            lastPosX = e.clientX;
            lastPosY = e.clientY;
        }
    }
};

const handleMouseUpPan = () => {
    if (isPanning && canvasInstance) {
        // Appliquer la transformation finale pour éviter les sauts potentiels
        canvasInstance.setViewportTransform(canvasInstance.viewportTransform);
        isPanning = false;
        canvasInstance.selection = true; // Réactiver sélection
        canvasInstance.setCursor('default');
        canvasInstance.requestRenderAll();
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
    canvas.on('mouse:wheel', handleWheelZoom);

    // --- Activer Pan (Alt+Clic) ---
    canvas.on('mouse:down', handleMouseDownPan);
    canvas.on('mouse:move', handleMouseMovePan);
    canvas.on('mouse:up', handleMouseUpPan);
    // Gérer le cas où la souris sort du canvas pendant le pan
    canvas.on('mouse:out', handleMouseUpPan); // Utiliser le même handler

    // --- Ajouter des boutons à la toolbar (optionnel) ---
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'd-inline-flex align-items-center gap-1 border-start ps-2 ms-1'; // Styles Bootstrap

    const btnClasses = 'btn btn-outline-secondary btn-sm';
    const actions = [
        { id: 'zoom-in', icon: 'bi-zoom-in', title: 'Zoom avant', action: () => zoomRelative(1.2) },
        { id: 'zoom-out', icon: 'bi-zoom-out', title: 'Zoom arrière', action: () => zoomRelative(0.8) },
        { id: 'zoom-reset', icon: 'bi-aspect-ratio', title: 'Zoom initial (100%)', action: () => zoomAbsolute(1) },
        // { id: 'zoom-fit', icon: 'bi-arrows-fullscreen', title: 'Ajuster au contenu', action: () => zoomToFitContent() }, // Plus complexe
        { id: 'pan-tool', icon: 'bi-arrows-move', title: 'Activer/Désactiver Pan (Main)', action: togglePanMode } // Bouton pour mode Pan actif
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
        if (act.id === 'pan-tool') {
             button.dataset.tool = 'pan'; // Identifier ce bouton comme un outil
        }
        controlsContainer.appendChild(button);
    });

    toolbarElement.appendChild(controlsContainer);

    console.log("NavigationManager: Zoom (molette) et Pan (Alt+Clic) activés.");
}

/**
 * Applique un zoom relatif par rapport au centre du canvas.
 * @param {number} factor - Facteur de zoom (> 1 pour zoom in, < 1 pour zoom out).
 */
function zoomRelative(factor) {
    if (!canvasInstance) return;
    let zoom = canvasInstance.getZoom();
    zoom *= factor;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    zoomAbsolute(zoom);
}

/**
 * Applique un niveau de zoom absolu au centre du canvas.
 * @param {number} zoomLevel - Le niveau de zoom désiré (ex: 1 pour 100%).
 */
function zoomAbsolute(zoomLevel) {
     if (!canvasInstance) return;
     zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel));
     const center = canvasInstance.getCenter();
     canvasInstance.zoomToPoint(new fabric.Point(center.left, center.top), zoomLevel);
}

/**
 * Active/Désactive le mode Pan où cliquer-glisser déplace le canvas.
 * Doit être intégré avec le système d'outils de toolbar.js
 */
function togglePanMode() {
     if (!canvasInstance) return;
     // Cette fonction devra interagir avec activateTool dans toolbar.js
     // pour définir l'état 'pan' actif/inactif.
     // L'implémentation du pan par clic est similaire à Alt+Clic mais sans Alt.
     console.warn("NavigationManager: togglePanMode n'est pas complètement implémenté avec le state manager de la toolbar.");
     // Exemple simple (sans gestion d'état):
     // if (canvasInstance.defaultCursor !== 'grab') {
     //     canvasInstance.defaultCursor = 'grab';
     //     // Ajouter les écouteurs pour pan sans Alt ici...
     // } else {
     //     canvasInstance.defaultCursor = 'default';
     //     // Supprimer les écouteurs de pan sans Alt ici...
     // }
}

// Fonction de désactivation (si nécessaire, ex: supprimer les écouteurs)
export function deactivateNavigation(canvas) {
    if (!canvas) return;
    canvas.off('mouse:wheel', handleWheelZoom);
    canvas.off('mouse:down', handleMouseDownPan);
    canvas.off('mouse:move', handleMouseMovePan);
    canvas.off('mouse:up', handleMouseUpPan);
    canvas.off('mouse:out', handleMouseUpPan); // Nettoyer aussi mouse:out
    console.log("NavigationManager: Écouteurs désactivés.");
}
