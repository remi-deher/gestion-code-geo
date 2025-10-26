// Fichier: public/js/modules/transformManager.js
/**
 * Gère les transformations supplémentaires : Flip (miroir) et rotation précise.
 */

let canvasInstance = null;

/**
 * Initialise les contrôles de transformation.
 * @param {HTMLElement} toolbarElement - La barre d'outils.
 * @param {fabric.Canvas} canvas - L'instance du canvas.
 */
export function setupTransformControls(toolbarElement, canvas) {
    canvasInstance = canvas;

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'd-inline-flex align-items-center gap-1 border-start ps-2 ms-1';

    const flipXBtn = document.createElement('button');
    flipXBtn.id = 'flipX-btn';
    flipXBtn.className = 'btn btn-outline-secondary btn-sm';
    flipXBtn.title = 'Miroir Horizontal';
    flipXBtn.innerHTML = '<i class="bi bi-symmetry-horizontal"></i>';
    flipXBtn.disabled = true;
    flipXBtn.addEventListener('click', () => flipObject('flipX'));
    controlsContainer.appendChild(flipXBtn);

    const flipYBtn = document.createElement('button');
    flipYBtn.id = 'flipY-btn';
    flipYBtn.className = 'btn btn-outline-secondary btn-sm';
    flipYBtn.title = 'Miroir Vertical';
    flipYBtn.innerHTML = '<i class="bi bi-symmetry-vertical"></i>';
    flipYBtn.disabled = true;
    flipYBtn.addEventListener('click', () => flipObject('flipY'));
    controlsContainer.appendChild(flipYBtn);

    // TODO: Ajouter input pour rotation précise

    toolbarElement.appendChild(controlsContainer);

    // Mettre à jour l'état des boutons
    canvas.on('selection:created', updateTransformButtonsState);
    canvas.on('selection:updated', updateTransformButtonsState);
    canvas.on('selection:cleared', updateTransformButtonsState);

    console.log("TransformManager: Contrôles initialisés.");
}

/**
 * Applique un flip horizontal ou vertical à l'objet sélectionné.
 * @param {'flipX' | 'flipY'} direction - La direction du flip.
 */
function flipObject(direction) {
    if (!canvasInstance) return;
    const activeObject = canvasInstance.getActiveObject();
    if (!activeObject) return;

    activeObject.set(direction, !activeObject[direction]); // Basculer la valeur
    canvasInstance.requestRenderAll();
    console.log(`TransformManager: Flip '${direction}' appliqué.`);
}

/**
 * Met à jour l'état activé/désactivé des boutons de transformation.
 */
function updateTransformButtonsState(event) {
    const hasSelection = !!(canvasInstance && canvasInstance.getActiveObject());
    const flipXBtn = document.getElementById('flipX-btn');
    const flipYBtn = document.getElementById('flipY-btn');

    if (flipXBtn) flipXBtn.disabled = !hasSelection;
    if (flipYBtn) flipYBtn.disabled = !hasSelection;
}
