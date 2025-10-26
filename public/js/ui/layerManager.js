// Fichier: public/js/ui/layerManager.js
/**
 * Gère les boutons pour changer l'ordre (Z-index) des objets sélectionnés.
 */

let canvasInstance = null;

/**
 * Initialise les boutons de gestion des calques.
 * @param {HTMLElement} toolbarElement - L'élément DOM de la barre d'outils.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function setupLayerControls(toolbarElement, canvas) {
    canvasInstance = canvas;

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'd-inline-flex align-items-center gap-1 border-start ps-2 ms-1'; // Styles Bootstrap

    const btnClasses = 'btn btn-outline-secondary btn-sm';
    const actions = [
        { id: 'bring-forward', icon: 'bi-layer-forward', title: 'Monter', method: 'bringForward' },
        { id: 'send-backward', icon: 'bi-layer-backward', title: 'Descendre', method: 'sendBackwards' },
        { id: 'bring-to-front', icon: 'bi-layers-half', title: 'Premier plan', method: 'bringToFront' },
        { id: 'send-to-back', icon: 'bi-layers-fill', title: 'Arrière-plan', method: 'sendToBack' }
    ];

    actions.forEach(action => {
        const button = document.createElement('button');
        button.id = action.id;
        button.className = btnClasses;
        button.title = action.title;
        button.innerHTML = `<i class="bi ${action.icon}"></i>`;
        button.disabled = true; // Désactivé par défaut
        button.addEventListener('click', () => handleLayerAction(action.method));
        controlsContainer.appendChild(button);
    });

    toolbarElement.appendChild(controlsContainer);

    // Activer/Désactiver les boutons selon la sélection
    canvas.on('selection:created', updateLayerButtonsState);
    canvas.on('selection:updated', updateLayerButtonsState);
    canvas.on('selection:cleared', updateLayerButtonsState);

    console.log("LayerManager: Contrôles initialisés.");
}

/**
 * Gère le clic sur un bouton d'ordre des calques.
 * @param {string} methodName - Le nom de la méthode Fabric à appeler.
 */
function handleLayerAction(methodName) {
    if (!canvasInstance) return;
    const activeObject = canvasInstance.getActiveObject();
    if (activeObject && typeof activeObject[methodName] === 'function') {
        activeObject[methodName]();
        canvasInstance.requestRenderAll();
        console.log(`LayerManager: Action '${methodName}' exécutée.`);
        // Il peut être utile de redéclencher l'événement de sélection pour
        // mettre à jour d'autres états UI qui dépendent de l'ordre
        canvasInstance.fire('selection:updated', { target: activeObject });
    }
}

/**
 * Met à jour l'état activé/désactivé des boutons de calque.
 * @param {object} event - L'événement Fabric ('selection:created', 'selection:updated', 'selection:cleared').
 */
function updateLayerButtonsState(event) {
    const hasSelection = !!(event && (event.target || (event.selected && event.selected.length > 0)));
    const buttons = document.querySelectorAll('#bring-forward, #send-backward, #bring-to-front, #send-to-back');
    buttons.forEach(btn => btn.disabled = !hasSelection);
}
