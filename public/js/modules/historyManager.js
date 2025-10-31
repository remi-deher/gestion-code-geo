// Fichier: public/js/modules/historyManager.js
/**
 * Gère l'historique Annuler/Rétablir (Undo/Redo).
 * S'accroche aux événements du canvas pour sauvegarder l'état.
 */

let canvasInstance = null;
let historyStack = []; // Pile Undo
let redoStack = [];    // Pile Redo
let currentState = null; // État actuel pour éviter les sauvegardes en double
let isProcessingHistory = false; // Verrou pour éviter les sauvegardes pendant un undo/redo

const MAX_HISTORY = 50; // Limite le nombre d'états

// Références aux boutons
let undoButton = null;
let redoButton = null;

/**
 * Initialise l'historique et ajoute les boutons à la barre d'outils.
 * @param {HTMLElement} toolbarElement - La barre d'outils.
 * @param {fabric.Canvas} canvas - L'instance du canvas.
 */
export function setupHistoryControls(toolbarElement, canvas) {
    canvasInstance = canvas;
    
    // --- Créer les boutons ---
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'd-inline-flex align-items-center gap-1 border-start ps-2 ms-1';

    undoButton = document.createElement('button');
    undoButton.id = 'undo-btn';
    undoButton.className = 'btn btn-outline-secondary btn-sm';
    undoButton.title = 'Annuler (Ctrl+Z)';
    undoButton.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i>';
    undoButton.disabled = true;
    undoButton.addEventListener('click', undo);
    controlsContainer.appendChild(undoButton);

    redoButton = document.createElement('button');
    redoButton.id = 'redo-btn';
    redoButton.className = 'btn btn-outline-secondary btn-sm';
    redoButton.title = 'Rétablir (Ctrl+Y)';
    redoButton.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    redoButton.disabled = true;
    redoButton.addEventListener('click', redo);
    controlsContainer.appendChild(redoButton);
    
    toolbarElement.appendChild(controlsContainer);

    // --- Écouteurs d'événements ---
    // Sauvegarder l'état initial
    saveState(true); 

    // Écouteurs pour sauvegarder l'état après une modification
    // 'object:modified' est le plus courant (déplacement, redimensionnement)
    canvas.on('object:modified', () => saveState());
    // 'object:added' est important pour les nouveaux objets (texte, formes, paste)
    canvas.on('object:added', () => saveState());
    // 'object:removed' est important pour la suppression
    canvas.on('object:removed', () => saveState());
    
    // Écouteur clavier pour Ctrl+Z / Ctrl+Y
    window.addEventListener('keydown', handleKeyDown);

    console.log("HistoryManager: Initialisé.");
}

/**
 * Sauvegarde l'état actuel du canvas dans la pile d'historique.
 * @param {boolean} force - Forcer la sauvegarde même si l'état semble identique.
 */
function saveState(force = false) {
    if (isProcessingHistory) return; // Ne pas sauvegarder pendant un undo/redo

    const newState = JSON.stringify(canvasInstance.toJSON(['customData', 'isGuide']));

    // Éviter de sauvegarder si l'état n'a pas changé (ex: simple clic)
    if (!force && newState === currentState) {
        return;
    }
    
    // Vider la pile redo car on crée une nouvelle branche d'historique
    redoStack = [];
    
    // Ajouter l'état *précédent* à la pile undo
    if (currentState !== null) {
        historyStack.push(currentState);
    }
    
    // Mettre à jour l'état actuel
    currentState = newState;

    // Limiter la taille de la pile
    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift(); // Retirer l'état le plus ancien
    }

    updateHistoryButtons();
    console.log(`HistoryManager: État sauvegardé. Undo: ${historyStack.length}, Redo: ${redoStack.length}`);
}

/**
 * Action Annuler (Undo).
 */
function undo() {
    if (historyStack.length === 0 || !canvasInstance) return;
    
    isProcessingHistory = true; // Verrouiller
    
    // 1. Sauvegarder l'état actuel (currentState) dans la pile Redo
    if (currentState !== null) {
        redoStack.push(currentState);
    }

    // 2. Récupérer l'état précédent (dernier de la pile Undo)
    const stateToRestore = historyStack.pop();
    
    // 3. Charger cet état
    loadState(stateToRestore);
    
    // 4. Mettre à jour currentState
    currentState = stateToRestore;
    
    console.log(`HistoryManager: Undo. Undo: ${historyStack.length}, Redo: ${redoStack.length}`);
    updateHistoryButtons();
    
    // Libérer le verrou après un court délai pour que le rendu se termine
    setTimeout(() => { isProcessingHistory = false; }, 50);
}

/**
 * Action Rétablir (Redo).
 */
function redo() {
    if (redoStack.length === 0 || !canvasInstance) return;

    isProcessingHistory = true; // Verrouiller
    
    // 1. Sauvegarder l'état actuel (currentState) dans la pile Undo
    if (currentState !== null) {
        historyStack.push(currentState);
    }
    
    // 2. Récupérer l'état suivant (dernier de la pile Redo)
    const stateToRestore = redoStack.pop();
    
    // 3. Charger cet état
    loadState(stateToRestore);
    
    // 4. Mettre à jour currentState
    currentState = stateToRestore;

    console.log(`HistoryManager: Redo. Undo: ${historyStack.length}, Redo: ${redoStack.length}`);
    updateHistoryButtons();
    
    setTimeout(() => { isProcessingHistory = false; }, 50);
}

/**
 * Charge un état JSON sur le canvas.
 * @param {string} jsonState - L'état du canvas au format JSON.
 */
function loadState(jsonState) {
    if (!canvasInstance || jsonState === null) return;
    
    canvasInstance.loadFromJSON(jsonState, () => {
        // Le rappel de loadFromJSON est asynchrone
        canvasInstance.renderAll();
        
        // Assurer que les objets non interactifs (guides) le restent
        canvasInstance.forEachObject(obj => {
            if (obj.isGuide) {
                obj.selectable = false;
                obj.evented = false;
            }
        });
    });
}

/**
 * Gère les raccourcis clavier pour Undo/Redo.
 */
function handleKeyDown(e) {
    // S'assurer qu'on n'est pas en train d'éditer du texte
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
        return; 
    }
    const activeObj = canvasInstance?.getActiveObject();
    if (activeObj && activeObj.isEditing) {
        return;
    }

    // Ctrl+Z (Undo)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
    
    // Ctrl+Y ou Ctrl+Shift+Z (Redo)
    if ( ((e.ctrlKey || e.metaKey) && e.key === 'y') || 
         ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ) {
        e.preventDefault();
        redo();
    }
}

/**
 * Met à jour l'état (activé/désactivé) des boutons Undo/Redo.
 */
function updateHistoryButtons() {
    if (undoButton) {
        undoButton.disabled = (historyStack.length === 0);
    }
    if (redoButton) {
        redoButton.disabled = (redoStack.length === 0);
    }
}
