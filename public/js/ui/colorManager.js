// Fichier: public/js/ui/colorManager.js
/**
 * Gère les sélecteurs de couleur pour le remplissage (fill) et la bordure (stroke)
 * et applique les couleurs à l'objet sélectionné ou aux futurs objets.
 */

let currentFillColor = '#ffffff'; // Blanc par défaut
let currentStrokeColor = '#000000'; // Noir par défaut
let currentStrokeWidth = 1; // Épaisseur par défaut

let fillColorPicker = null;
let strokeColorPicker = null;
let strokeWidthSlider = null; // Optionnel : slider pour épaisseur
let canvasInstance = null;

// *** DÉPLACER LA FONCTION ICI ***
/**
 * Réinitialise les color pickers aux valeurs par défaut stockées.
 */
function resetPickersToDefaults() {
    console.log("ColorManager: Réinitialisation des pickers aux valeurs par défaut."); // Log pour vérifier l'appel
    if (fillColorPicker) fillColorPicker.value = currentFillColor;
    if (strokeColorPicker) strokeColorPicker.value = currentStrokeColor;
    // TODO: Réinitialiser aussi strokeWidth si implémenté
}

/**
 * Initialise les contrôles de couleur et les écouteurs.
 * @param {HTMLElement} toolbarElement - L'élément DOM de la barre d'outils où ajouter les contrôles.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function setupColorControls(toolbarElement, canvas) {
    canvasInstance = canvas;

    // --- Créer les éléments UI ---
    // (Le code pour créer fillColorPicker, strokeColorPicker, etc. reste ici et est inchangé)
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'd-inline-flex align-items-center gap-2 border-start ps-2 ms-1'; // Styles Bootstrap
    const fillLabel = document.createElement('label');
    fillLabel.htmlFor = 'fill-color-picker';
    fillLabel.title = 'Couleur de remplissage';
    fillLabel.className = 'form-label mb-0 small';
    fillLabel.innerHTML = '<i class="bi bi-palette-fill"></i>';
    fillColorPicker = document.createElement('input');
    fillColorPicker.type = 'color';
    fillColorPicker.id = 'fill-color-picker';
    fillColorPicker.className = 'form-control form-control-color form-control-sm';
    fillColorPicker.value = currentFillColor;
    fillColorPicker.title = 'Couleur de remplissage';
    const strokeLabel = document.createElement('label');
    strokeLabel.htmlFor = 'stroke-color-picker';
    strokeLabel.title = 'Couleur de bordure';
    strokeLabel.className = 'form-label mb-0 small';
    strokeLabel.innerHTML = '<i class="bi bi-border-style"></i>';
    strokeColorPicker = document.createElement('input');
    strokeColorPicker.type = 'color';
    strokeColorPicker.id = 'stroke-color-picker';
    strokeColorPicker.className = 'form-control form-control-color form-control-sm';
    strokeColorPicker.value = currentStrokeColor;
    strokeColorPicker.title = 'Couleur de bordure';
    controlsContainer.appendChild(fillLabel);
    controlsContainer.appendChild(fillColorPicker);
    controlsContainer.appendChild(strokeLabel);
    controlsContainer.appendChild(strokeColorPicker);
    toolbarElement.appendChild(controlsContainer);


    // --- Écouteurs d'événements ---

    // Changement de couleur de remplissage
    fillColorPicker.addEventListener('input', (e) => {
        currentFillColor = e.target.value;
        applyColorToSelection('fill', currentFillColor);
    });

    // Changement de couleur de bordure
    strokeColorPicker.addEventListener('input', (e) => {
        currentStrokeColor = e.target.value;
        applyColorToSelection('stroke', currentStrokeColor);
    });

    // Mettre à jour les pickers quand la sélection change
    canvas.on('selection:created', updatePickersFromSelection);
    canvas.on('selection:updated', updatePickersFromSelection);
    // L'écouteur ici fonctionnera car resetPickersToDefaults est maintenant dans la portée du module
    canvas.on('selection:cleared', resetPickersToDefaults);

    console.log("ColorManager: Contrôles initialisés.");
}

/**
 * Applique une couleur à la sélection active sur le canvas.
 * @param {'fill' | 'stroke'} property - La propriété à modifier ('fill' ou 'stroke').
 * @param {string} colorValue - La nouvelle couleur.
 */
function applyColorToSelection(property, colorValue) {
    if (!canvasInstance) return;
    const activeObject = canvasInstance.getActiveObject();

    if (activeObject) {
        if (activeObject.type === 'activeSelection') {
            activeObject.forEachObject(obj => {
                if (property === 'fill' && (obj.type === 'line' || (obj.type === 'path' && !obj.fill))) return; // Ne pas remplir lignes/chemins ouverts
                obj.set(property, colorValue);
            });
        } else {
             if (property === 'fill' && (activeObject.type === 'line' || (activeObject.type === 'path' && !activeObject.fill))) return;
             activeObject.set(property, colorValue);
        }
        canvasInstance.requestRenderAll();
        console.log(`ColorManager: '${property}' appliqué: ${colorValue}`);
    } else {
         console.log(`ColorManager: Pas d'objet sélectionné, couleur '${property}' mise par défaut à ${colorValue}`);
    }
}

/**
 * Met à jour les valeurs des color pickers en fonction de l'objet sélectionné.
 * @param {object} event - L'événement Fabric ('selection:created' ou 'selection:updated').
 */
function updatePickersFromSelection(event) {
    const target = event?.target || event?.selected?.[0];
    if (!target || !fillColorPicker || !strokeColorPicker) return;

    let fillValue = target.fill;
    let strokeValue = target.stroke;

    // --- Vérification et conversion pour FILL ---
    let fillColorForPicker = currentFillColor;
    if (typeof fillValue === 'string' && fillValue) {
        try {
            const colorObj = new fabric.Color(fillValue);
            fillColorForPicker = '#' + colorObj.toHex(); // Assurer le format #RRGGBB
        } catch (e) {
             // Ignorer les erreurs de conversion (ex: 'none'), garder la couleur par défaut
        }
    } else if (fillValue) {
        // Remplissage non-string (Gradient/Pattern), utiliser la couleur par défaut
    }
    fillColorPicker.value = fillColorForPicker;

    // --- Vérification et conversion pour STROKE ---
    let strokeColorForPicker = currentStrokeColor;
    if (typeof strokeValue === 'string' && strokeValue) {
         try {
            const colorObj = new fabric.Color(strokeValue);
            strokeColorForPicker = '#' + colorObj.toHex();
        } catch (e) {
            // Ignorer
        }
    } else if (strokeValue) {
        // Bordure non-string, utiliser la couleur par défaut
    }
    strokeColorPicker.value = strokeColorForPicker;

    // TODO: Mettre à jour strokeWidth
}


// La fonction resetPickersToDefaults est maintenant définie plus haut, en dehors de setupColorControls


/**
 * Retourne les couleurs et épaisseurs actuelles (pour les outils de dessin).
 * @returns {{fill: string, stroke: string, strokeWidth: number}}
 */
export function getCurrentColors() {
    return {
        fill: currentFillColor,
        stroke: currentStrokeColor,
        strokeWidth: currentStrokeWidth
    };
}
