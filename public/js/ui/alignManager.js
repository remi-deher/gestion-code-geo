// Fichier: public/js/ui/alignManager.js
/**
 * Gère les actions d'alignement et de distribution pour les objets sélectionnés.
 * NOTE: L'alignement Fabric est basique. Pour une distribution, il faut du code personnalisé.
 */

let canvasInstance = null;

/**
 * Initialise les boutons d'alignement.
 * @param {HTMLElement} toolbarElement - La barre d'outils.
 * @param {fabric.Canvas} canvas - L'instance du canvas.
 */
export function setupAlignControls(toolbarElement, canvas) {
    canvasInstance = canvas;

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'd-inline-flex align-items-center gap-1 border-start ps-2 ms-1';

    const btnClasses = 'btn btn-outline-secondary btn-sm';
    const actions = [
        // Alignement
        { id: 'align-left', icon: 'bi-align-start', title: 'Aligner à gauche', action: () => alignSelection('left') },
        { id: 'align-center-h', icon: 'bi-align-center', title: 'Centrer horizontalement', action: () => alignSelection('centerH') },
        { id: 'align-right', icon: 'bi-align-end', title: 'Aligner à droite', action: () => alignSelection('right') },
        { id: 'align-top', icon: 'bi-align-top', title: 'Aligner en haut', action: () => alignSelection('top') },
        { id: 'align-center-v', icon: 'bi-distribute-vertical', title: 'Centrer verticalement', action: () => alignSelection('centerV') }, // Icône distribution en attendant mieux
        { id: 'align-bottom', icon: 'bi-align-bottom', title: 'Aligner en bas', action: () => alignSelection('bottom') },
        // TODO: Ajouter Distribution H/V
    ];

    actions.forEach(act => {
        const button = document.createElement('button');
        button.id = act.id;
        button.className = btnClasses;
        button.title = act.title;
        button.innerHTML = `<i class="bi ${act.icon}"></i>`;
        button.disabled = true; // Désactivé par défaut
        button.addEventListener('click', act.action);
        controlsContainer.appendChild(button);
    });

    toolbarElement.appendChild(controlsContainer);

    // Mettre à jour l'état des boutons
    canvas.on('selection:created', updateAlignButtonsState);
    canvas.on('selection:updated', updateAlignButtonsState);
    canvas.on('selection:cleared', updateAlignButtonsState);

    console.log("AlignManager: Contrôles initialisés.");
}

/**
 * Gère l'action d'alignement.
 * @param {string} direction - 'left', 'centerH', 'right', 'top', 'centerV', 'bottom'.
 */
function alignSelection(direction) {
    if (!canvasInstance) return;
    const activeSelection = canvasInstance.getActiveObject();

    // Nécessite une sélection multiple (ActiveSelection)
    if (!activeSelection || activeSelection.type !== 'activeSelection') return;

    console.log(`AlignManager: Alignement '${direction}' demandé.`);

    // Fabric n'a pas de fonctions d'alignement directes, il faut le faire manuellement
    // en se basant sur les coordonnées du groupe de sélection (activeSelection)
    const groupBounds = activeSelection.getBoundingRect();
    const objects = activeSelection.getObjects();

    canvasInstance.discardActiveObject(); // Désélectionner temporairement

    objects.forEach(obj => {
        switch (direction) {
            case 'left':    obj.set({ left: groupBounds.left }); break;
            case 'centerH': obj.set({ left: groupBounds.left + groupBounds.width / 2 - obj.getScaledWidth() / 2 }); break;
            case 'right':   obj.set({ left: groupBounds.left + groupBounds.width - obj.getScaledWidth() }); break;
            case 'top':     obj.set({ top: groupBounds.top }); break;
            case 'centerV': obj.set({ top: groupBounds.top + groupBounds.height / 2 - obj.getScaledHeight() / 2 }); break;
            case 'bottom':  obj.set({ top: groupBounds.top + groupBounds.height - obj.getScaledHeight() }); break;
        }
        obj.setCoords(); // Mettre à jour les coordonnées de contrôle
    });

    // Optionnel : Re-sélectionner les objets
    // const sel = new fabric.ActiveSelection(objects, { canvas: canvasInstance });
    // canvasInstance.setActiveObject(sel);

    canvasInstance.requestRenderAll();
}

/**
 * Met à jour l'état activé/désactivé des boutons d'alignement.
 */
function updateAlignButtonsState(event) {
    const hasMultipleSelection = !!(canvasInstance && canvasInstance.getActiveObject() && canvasInstance.getActiveObject().type === 'activeSelection');
    const buttons = document.querySelectorAll('#align-left, #align-center-h, #align-right, #align-top, #align-center-v, #align-bottom');
    buttons.forEach(btn => btn.disabled = !hasMultipleSelection);
}
