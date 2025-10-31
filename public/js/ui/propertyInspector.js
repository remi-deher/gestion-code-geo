// Fichier: public/js/ui/propertyInspector.js
/**
 * Gère les inputs pour les propriétés numériques (Épaisseur, Opacité, Angle, Taille).
 */

let canvasInstance = null;
let strokeWidthSlider = null;
let opacitySlider = null;
let angleInput = null;
let widthInput = null;
let heightInput = null;

let currentStrokeWidth = 2; // Valeur par défaut
let currentOpacity = 1;

/**
 * Initialise les contrôles de propriétés.
 * @param {HTMLElement} toolbarElement - La barre d'outils.
 * @param {fabric.Canvas} canvas - L'instance du canvas.
 */
export function setupPropertyInspector(toolbarElement, canvas) {
    canvasInstance = canvas;

    // --- Créer les éléments UI ---
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'd-inline-flex align-items-center gap-2 border-start ps-2 ms-1';

    // 1. Épaisseur du trait (Stroke Width)
    const strokeLabel = document.createElement('label');
    strokeLabel.htmlFor = 'stroke-width-slider';
    strokeLabel.title = 'Épaisseur du trait';
    strokeLabel.className = 'form-label mb-0 small';
    strokeLabel.innerHTML = '<i class="bi bi-border-width"></i>';
    strokeWidthSlider = document.createElement('input');
    strokeWidthSlider.type = 'range';
    strokeWidthSlider.id = 'stroke-width-slider';
    strokeWidthSlider.className = 'form-range';
    strokeWidthSlider.min = 1;
    strokeWidthSlider.max = 50;
    strokeWidthSlider.step = 1;
    strokeWidthSlider.value = currentStrokeWidth;
    strokeWidthSlider.style.width = '100px';
    strokeWidthSlider.title = 'Épaisseur du trait';
    controlsContainer.appendChild(strokeLabel);
    controlsContainer.appendChild(strokeWidthSlider);

    // 2. Opacité
    const opacityLabel = document.createElement('label');
    opacityLabel.htmlFor = 'opacity-slider';
    opacityLabel.title = 'Opacité';
    opacityLabel.className = 'form-label mb-0 small';
    opacityLabel.innerHTML = '<i class="bi bi-front"></i>'; // Icône simple
    opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.id = 'opacity-slider';
    opacitySlider.className = 'form-range';
    opacitySlider.min = 0;
    opacitySlider.max = 1;
    opacitySlider.step = 0.05;
    opacitySlider.value = currentOpacity;
    opacitySlider.style.width = '100px';
    opacitySlider.title = 'Opacité';
    controlsContainer.appendChild(opacityLabel);
    controlsContainer.appendChild(opacitySlider);
    
    // 3. Angle (Rotation)
    const angleLabel = document.createElement('label');
    angleLabel.htmlFor = 'angle-input';
    angleLabel.title = 'Angle';
    angleLabel.className = 'form-label mb-0 small';
    angleLabel.innerHTML = '<i class="bi bi-arrow-repeat"></i>';
    angleInput = document.createElement('input');
    angleInput.type = 'number';
    angleInput.id = 'angle-input';
    angleInput.className = 'form-control form-control-sm';
    angleInput.step = 1;
    angleInput.value = 0;
    angleInput.style.width = '70px';
    angleInput.title = 'Angle (Rotation)';
    controlsContainer.appendChild(angleLabel);
    controlsContainer.appendChild(angleInput);

    // 4. Largeur (Width)
    const widthLabel = document.createElement('label');
    widthLabel.htmlFor = 'width-input';
    widthLabel.title = 'Largeur';
    widthLabel.className = 'form-label mb-0 small';
    widthLabel.innerHTML = 'W:';
    widthInput = document.createElement('input');
    widthInput.type = 'number';
    widthInput.id = 'width-input';
    widthInput.className = 'form-control form-control-sm';
    widthInput.step = 1;
    widthInput.style.width = '70px';
    widthInput.title = 'Largeur';
    controlsContainer.appendChild(widthLabel);
    controlsContainer.appendChild(widthInput);
    
    // 5. Hauteur (Height)
    const heightLabel = document.createElement('label');
    heightLabel.htmlFor = 'height-input';
    heightLabel.title = 'Hauteur';
    heightLabel.className = 'form-label mb-0 small';
    heightLabel.innerHTML = 'H:';
    heightInput = document.createElement('input');
    heightInput.type = 'number';
    heightInput.id = 'height-input';
    heightInput.className = 'form-control form-control-sm';
    heightInput.step = 1;
    heightInput.style.width = '70px';
    heightInput.title = 'Hauteur';
    controlsContainer.appendChild(heightLabel);
    controlsContainer.appendChild(heightInput);

    toolbarElement.appendChild(controlsContainer);

    // --- Écouteurs d'événements ---
    
    // Épaisseur
    strokeWidthSlider.addEventListener('input', (e) => {
        const newWidth = parseInt(e.target.value, 10);
        currentStrokeWidth = newWidth;
        applyPropertyToSelection('strokeWidth', newWidth);
        
        // Mettre à jour la brosse de dessin si active (pour l'outil Crayon)
        if (canvasInstance && canvasInstance.isDrawingMode) {
            canvasInstance.freeDrawingBrush.width = newWidth;
        }
    });

    // Opacité
    opacitySlider.addEventListener('input', (e) => {
        const newOpacity = parseFloat(e.target.value);
        currentOpacity = newOpacity;
        applyPropertyToSelection('opacity', newOpacity);
    });

    // Angle
    angleInput.addEventListener('input', (e) => {
        applyPropertyToSelection('angle', parseInt(e.target.value, 10));
    });

    // Largeur
    widthInput.addEventListener('input', (e) => {
        applyPropertyToSelection('width', parseInt(e.target.value, 10), 'scaleX');
    });

    // Hauteur
    heightInput.addEventListener('input', (e) => {
        applyPropertyToSelection('height', parseInt(e.target.value, 10), 'scaleY');
    });

    // Mettre à jour les inputs quand la sélection change
    canvas.on('selection:created', updateInputsFromSelection);
    canvas.on('selection:updated', updateInputsFromSelection);
    canvas.on('selection:cleared', resetInputsToDefaults);
    // Mettre à jour aussi pendant le redimensionnement/rotation
    canvas.on('object:scaling', updateInputsFromSelection);
    canvas.on('object:rotating', updateInputsFromSelection);
}

/**
 * Applique une propriété (valeur numérique) à la sélection.
 * @param {string} property - La propriété (ex: 'opacity', 'angle').
 * @param {number} value - La nouvelle valeur.
 * @param {string} [scaleProperty=null] - Propriété de scale à reset (ex: 'scaleX').
 */
function applyPropertyToSelection(property, value, scaleProperty = null) {
    if (!canvasInstance) return;
    const activeObject = canvasInstance.getActiveObject();

    if (activeObject) {
        const apply = (obj) => {
            if (scaleProperty) {
                // Si on change W/H, on doit reset le scale pour appliquer la taille
                obj.set(scaleProperty, 1);
            }
            obj.set(property, value);
        };

        if (activeObject.type === 'activeSelection') {
            activeObject.forEachObject(apply);
        } else {
            apply(activeObject);
        }
        
        // Important: redéclenche l'événement pour que l'historique sauvegarde
        if (property !== 'strokeWidth' && property !== 'opacity') {
             canvasInstance.fire('object:modified', { target: activeObject });
        }
        
        canvasInstance.requestRenderAll();
    }
}

/**
 * Met à jour les inputs depuis l'objet sélectionné.
 */
function updateInputsFromSelection(event) {
    const target = event?.target || event?.selected?.[0];
    if (!target) return;

    // Épaisseur (prend la valeur du premier objet)
    strokeWidthSlider.value = target.strokeWidth || currentStrokeWidth;
    
    // Opacité
    opacitySlider.value = target.opacity ?? currentOpacity;
    
    // Angle
    angleInput.value = Math.round(target.angle || 0);
    
    // Taille (en tenant compte du scale)
    widthInput.value = Math.round(target.getScaledWidth());
    heightInput.value = Math.round(target.getScaledHeight());
}

/**
 * Réinitialise les inputs aux valeurs par défaut.
 */
function resetInputsToDefaults() {
    strokeWidthSlider.value = currentStrokeWidth;
    opacitySlider.value = currentOpacity;
    angleInput.value = 0;
    widthInput.value = 0;
    heightInput.value = 0;
}

/**
 * Fonction exportée pour que d'autres modules (comme pencilTool)
 * puissent récupérer l'épaisseur de trait actuelle.
 */
export function getCurrentStrokeWidth() {
    return currentStrokeWidth;
}
