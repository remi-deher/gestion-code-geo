// Fichier: public/js/modules/clipboardManager.js
/**
 * Gère les opérations Copier, Coller pour les objets Fabric.js.
 */

let canvasInstance = null;
let fabricClipboard = null; // Pour stocker l'objet/groupe copié

/**
 * Initialise les fonctions copier/coller.
 * @param {HTMLElement} toolbarElement - Barre d'outils (pour boutons optionnels).
 * @param {fabric.Canvas} canvas - L'instance du canvas.
 */
export function setupClipboard(toolbarElement, canvas) {
    canvasInstance = canvas;

    // --- Optionnel: Ajouter des boutons à la toolbar ---
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'd-inline-flex align-items-center gap-1 border-start ps-2 ms-1';
    const copyBtn = document.createElement('button'); // ... config ...
    copyBtn.id = 'copy-btn'; copyBtn.innerHTML = '<i class="bi bi-clipboard"></i>'; copyBtn.title = 'Copier';
    copyBtn.className = 'btn btn-outline-secondary btn-sm'; copyBtn.disabled = true;
    copyBtn.addEventListener('click', copySelection);
    const pasteBtn = document.createElement('button'); // ... config ...
    pasteBtn.id = 'paste-btn'; pasteBtn.innerHTML = '<i class="bi bi-clipboard-plus"></i>'; pasteBtn.title = 'Coller';
    pasteBtn.className = 'btn btn-outline-secondary btn-sm'; pasteBtn.disabled = true;
    pasteBtn.addEventListener('click', pasteFromClipboard);
    controlsContainer.appendChild(copyBtn);
    controlsContainer.appendChild(pasteBtn);
    toolbarElement.appendChild(controlsContainer);

    // Mettre à jour l'état des boutons
    canvas.on('selection:created', updateClipboardButtonsState);
    canvas.on('selection:updated', updateClipboardButtonsState);
    canvas.on('selection:cleared', updateClipboardButtonsState);

    // --- Raccourcis Clavier ---
    window.addEventListener('keydown', handleKeyDown);

    console.log("ClipboardManager: Initialisé.");
}

/**
 * Gère les raccourcis clavier Ctrl+C, Ctrl+V, Delete/Backspace.
 */
function handleKeyDown(e) {
    if (!canvasInstance) return;

    // S'assurer qu'on n'est pas en train d'éditer du texte
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
        return; // Ne pas interférer avec la saisie
    }
     // Spécifique à Fabric IText
     const activeObj = canvasInstance.getActiveObject();
     if (activeObj && activeObj.isEditing) {
         return;
     }

    // Ctrl+C ou Cmd+C
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copySelection();
    }
    // Ctrl+V ou Cmd+V
    else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteFromClipboard();
    }
    // Delete ou Backspace
    else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
    }
}


/**
 * Copie l'objet/la sélection active dans le presse-papiers interne.
 */
function copySelection() {
    if (!canvasInstance) return;
    const activeObject = canvasInstance.getActiveObject();
    if (!activeObject) return;

    // Cloner l'objet (ou le groupe)
    activeObject.clone((cloned) => {
        fabricClipboard = cloned;
        console.log("ClipboardManager: Objet copié.", fabricClipboard);
        updateClipboardButtonsState(); // Mettre à jour état bouton Coller
    });
}

/**
 * Colle l'objet depuis le presse-papiers interne sur le canvas.
 */
function pasteFromClipboard() {
    if (!fabricClipboard || !canvasInstance) return;

    fabricClipboard.clone((clonedObj) => {
        canvasInstance.discardActiveObject(); // Désélectionner avant de coller

        // Décaler légèrement la copie pour la rendre visible
        clonedObj.set({
            left: clonedObj.left + 10,
            top: clonedObj.top + 10,
            evented: true, // Assurer que l'objet collé est interactif
        });

        if (clonedObj.type === 'activeSelection') {
            // Si on a copié une sélection multiple, la recréer
            clonedObj.canvas = canvasInstance;
            clonedObj.forEachObject((obj) => {
                obj.set('evented', true); // Assurer interactivité
                canvasInstance.add(obj);
            });
            clonedObj.setCoords();
        } else {
            // Objet unique
            clonedObj.set('evented', true);
            canvasInstance.add(clonedObj);
        }

        // Sélectionner l'objet/groupe collé
        canvasInstance.setActiveObject(clonedObj);
        canvasInstance.requestRenderAll();
        console.log("ClipboardManager: Objet collé.", clonedObj);
    });
}

/**
 * Supprime la sélection active.
 */
function deleteSelection() {
     if (!canvasInstance) return;
     const activeObject = canvasInstance.getActiveObject();
     if (activeObject) {
         if (activeObject.type === 'activeSelection') {
             activeObject.forEachObject(obj => canvasInstance.remove(obj));
         }
         canvasInstance.remove(activeObject);
         canvasInstance.discardActiveObject();
         canvasInstance.requestRenderAll();
         console.log("ClipboardManager: Sélection supprimée.");
     }
}

/**
 * Met à jour l'état activé/désactivé des boutons Copier/Coller.
 */
function updateClipboardButtonsState() {
    const copyBtn = document.getElementById('copy-btn');
    const pasteBtn = document.getElementById('paste-btn');
    const deleteBtn = document.getElementById('delete-object-btn'); // Le bouton de la toolbar

    if (copyBtn) {
        copyBtn.disabled = !(canvasInstance && canvasInstance.getActiveObject());
    }
    if (pasteBtn) {
        pasteBtn.disabled = !fabricClipboard; // Actif seulement si qqc est dans le presse-papiers
    }
     if (deleteBtn) { // Mettre à jour aussi le bouton Supprimer de la toolbar
         deleteBtn.disabled = !(canvasInstance && canvasInstance.getActiveObject());
     }
}

// Fonction de désactivation (si nécessaire)
export function deactivateClipboard(canvas) {
    window.removeEventListener('keydown', handleKeyDown);
    fabricClipboard = null; // Vider le presse-papiers
    console.log("ClipboardManager: Désactivé.");
}
