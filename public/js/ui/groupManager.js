// Fichier: public/js/ui/groupManager.js
/**
 * Gère les actions de Groupement et Dégroupement des objets sélectionnés.
 */

let canvasInstance = null;

/**
 * Initialise les boutons Grouper/Dégrouper.
 * @param {HTMLElement} toolbarElement - La barre d'outils.
 * @param {fabric.Canvas} canvas - L'instance du canvas.
 */
export function setupGroupControls(toolbarElement, canvas) {
    canvasInstance = canvas;

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'd-inline-flex align-items-center gap-1 border-start ps-2 ms-1';

    const groupBtn = document.createElement('button');
    groupBtn.id = 'group-btn';
    groupBtn.className = 'btn btn-outline-secondary btn-sm';
    groupBtn.title = 'Grouper la sélection';
    groupBtn.innerHTML = '<i class="bi bi-bounding-box"></i>';
    groupBtn.disabled = true;
    groupBtn.addEventListener('click', groupSelection);
    controlsContainer.appendChild(groupBtn);

    const ungroupBtn = document.createElement('button');
    ungroupBtn.id = 'ungroup-btn';
    ungroupBtn.className = 'btn btn-outline-secondary btn-sm';
    ungroupBtn.title = 'Dégrouper la sélection';
    ungroupBtn.innerHTML = '<i class="bi bi-bounding-box-circles"></i>';
    ungroupBtn.disabled = true;
    ungroupBtn.addEventListener('click', ungroupSelection);
    controlsContainer.appendChild(ungroupBtn);

    toolbarElement.appendChild(controlsContainer);

    // Mettre à jour l'état des boutons selon la sélection
    canvas.on('selection:created', updateGroupButtonsState);
    canvas.on('selection:updated', updateGroupButtonsState);
    canvas.on('selection:cleared', updateGroupButtonsState);

    console.log("GroupManager: Contrôles initialisés.");
}

/**
 * Groupe les objets actuellement sélectionnés.
 */
function groupSelection() {
    if (!canvasInstance || !canvasInstance.getActiveObject()) return;
    const activeSelection = canvasInstance.getActiveObject();

    if (activeSelection.type !== 'activeSelection') return; // Doit être une sélection multiple

    activeSelection.toGroup(); // Convertit la sélection active en groupe
    canvasInstance.requestRenderAll();
    console.log("GroupManager: Sélection groupée.");
}

/**
 * Dégroupe l'objet de groupe actuellement sélectionné.
 */
function ungroupSelection() {
    if (!canvasInstance || !canvasInstance.getActiveObject()) return;
    const activeGroup = canvasInstance.getActiveObject();

    if (activeGroup.type !== 'group') return; // Doit être un groupe

    activeGroup.toActiveSelection(); // Convertit le groupe en sélection active d'objets
    // Alternative: activeGroup.destroy(); canvasInstance.discardActiveObject(); // Détruit juste le groupe
    canvasInstance.requestRenderAll();
    console.log("GroupManager: Groupe dégroupé.");
}

/**
 * Met à jour l'état activé/désactivé des boutons Grouper/Dégrouper.
 */
function updateGroupButtonsState(event) {
    const groupBtn = document.getElementById('group-btn');
    const ungroupBtn = document.getElementById('ungroup-btn');
    if (!groupBtn || !ungroupBtn) return;

    const activeObject = canvasInstance ? canvasInstance.getActiveObject() : null;

    // Activer "Grouper" si plusieurs objets sont sélectionnés
    groupBtn.disabled = !(activeObject && activeObject.type === 'activeSelection');

    // Activer "Dégrouper" si un seul groupe est sélectionné
    ungroupBtn.disabled = !(activeObject && activeObject.type === 'group');
}
