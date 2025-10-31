// Fichier: public/js/ui/toolbar.js
/**
 * Gère la barre d'outils de dessin Fabric.js,
 * charge dynamiquement les modules d'outils et gère l'état actif.
 * Initialise également les modules UI pour les couleurs, calques, groupes, etc.
 */

// Importer les gestionnaires UI/Modules
import { setupColorControls, getCurrentColors } from './colorManager.js';
import { setupLayerControls } from './layerManager.js';
import { setupGroupControls } from './groupManager.js';
import { setupAlignControls } from './alignManager.js';
import { setupClipboard } from '../modules/clipboardManager.js';
import { setupTransformControls } from '../modules/transformManager.js';
import { setupNavigation, activatePanTool, deactivatePanTool } from '../modules/navigationManager.js';
import { setupSnapping } from '../modules/snapManager.js';
import { setCanvasSizeFromFormat, updatePageGuideBorder } from '../modules/guideManager.js';
import { PAGE_FORMATS } from '../modules/config.js';
import { setupAssetCreation } from '../modules/assetManager.js';
// NOUVEAUX IMPORTS
import { setupHistoryControls } from '../modules/historyManager.js';
import { setupPropertyInspector } from './propertyInspector.js';

// État de l'outil actif
let activeTool = null;
let activeToolDeactivate = null;
let activeToolButton = null;
const toolModules = {}; // Cache

// Définition des outils et de leurs modules
const toolMappings = {
    'select': '../tools/selectTool.js',
    'pan': '../modules/navigationManager.js', // Outil Pan (Main)
    'pencil': '../tools/pencilTool.js',     // NOUVEAU
    'rect': '../tools/rectangleTool.js',
    'circle': '../tools/circleTool.js',
    'line': '../tools/lineTool.js',
    'polygon': '../tools/polygonTool.js',   // NOUVEAU
    'text': '../tools/textTool.js'
};

// Icônes pour les boutons
const toolIcons = {
    'select': 'bi-cursor-fill', 
    'pan': 'bi-arrows-move',
    'pencil': 'bi-pencil-fill',     // NOUVEAU
    'rect': 'bi-square',
    'circle': 'bi-circle',
    'line': 'bi-slash-lg',
    'polygon': 'bi-pentagon',         // NOUVEAU
    'text': 'bi-fonts'
};


/**
 * Initialise la barre d'outils complète.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function setupToolbar(canvas) {
    const toolbar = document.getElementById('fabric-toolbar');
    if (!toolbar) { console.error("Toolbar: Élément #fabric-toolbar manquant."); return; }

    toolbar.innerHTML = '';
    toolbar.className = 'toolbar bg-light border-bottom p-1 d-flex flex-wrap align-items-center gap-1';

    // --- Créer les boutons des outils de dessin/sélection ---
    // Le bouton 'pan' sera ajouté par setupNavigation, on le filtre ici
    Object.keys(toolMappings).forEach(toolName => {
        if (toolName === 'pan') return; 
        
        const button = document.createElement('button');
        button.className = 'btn btn-outline-secondary btn-sm';
        button.dataset.tool = toolName;
        button.title = `Outil ${toolName.charAt(0).toUpperCase() + toolName.slice(1)}`;
        const iconClass = toolIcons[toolName] || 'bi-question-square';
        button.innerHTML = `<i class="bi ${iconClass}"></i>`;
        toolbar.appendChild(button);
    });
    toolbar.appendChild(createSeparator());

    // --- Contrôle du Guide de Page ---
    const guideControlsContainer = document.createElement('div');
    guideControlsContainer.className = 'd-inline-flex align-items-center gap-1';
    const guideLabel = document.createElement('label');
    guideLabel.htmlFor = 'page-format-select'; 
    guideLabel.className = 'form-label mb-0 small'; 
    guideLabel.textContent = 'Format:';
    const select = document.createElement('select');
    select.id = 'page-format-select'; 
    select.className = 'form-select form-select-sm'; 
    select.title = 'Changer le format du plan';
    for (const key in PAGE_FORMATS) {
        const option = document.createElement('option');
        option.value = key; 
        option.textContent = PAGE_FORMATS[key].label || key;
        if (key === (window.planData?.currentPlan?.page_format || 'A4-P')) {
            option.selected = true;
        }
        select.appendChild(option);
    }
    select.addEventListener('change', async (e) => {
        const newFormat = e.target.value;
        console.log(`Toolbar: Changement de format demandé: ${newFormat}`);

        // 1. Redimensionner le canvas Fabric
        if (setCanvasSizeFromFormat(newFormat, canvas, null)) {
            // 2. Mettre à jour la bordure du guide
            updatePageGuideBorder(canvas);
            // 3. Forcer le recalcul de l'offset
             canvas.calcOffset();
             canvas.renderAll(); 
        }

        // 4. Sauvegarder la nouvelle valeur dans la BDD
        const planData = window.planData?.currentPlan || null;
        if (planData && planData.id) {
            try {
                const response = await fetch('index.php?action=apiSavePageFormat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ plan_id: planData.id, page_format: newFormat })
                });
                const result = await response.json();
                if (!result.success) throw new Error(result.error || 'Échec sauvegarde format.');

                console.log(`Toolbar: Format de page sauvegardé: ${newFormat}`);
                window.planData.currentPlan.page_format = newFormat;

            } catch (error) {
                console.error("Erreur sauvegarde format de page:", error);
                alert(`Erreur sauvegarde format: ${error.message}`);
                select.value = planData.page_format || 'A4-P';
            }
        }
    });
    guideControlsContainer.appendChild(guideLabel);
    guideControlsContainer.appendChild(select);
    toolbar.appendChild(guideControlsContainer);

    // --- Initialiser les modules UI restants (Nouvel ordre) ---
    setupHistoryControls(toolbar, canvas);    // NOUVEAU (Undo/Redo)
    setupClipboard(toolbar, canvas);
    toolbar.appendChild(createSeparator());

    setupColorControls(toolbar, canvas);
    setupPropertyInspector(toolbar, canvas); // NOUVEAU (Épaisseur, Opacité, etc.)
    toolbar.appendChild(createSeparator());
    
    setupLayerControls(toolbar, canvas);
    setupGroupControls(toolbar, canvas);
    setupAlignControls(toolbar, canvas);
    setupTransformControls(toolbar, canvas);
    toolbar.appendChild(createSeparator());
    
    setupNavigation(toolbar, canvas);         // Pan (le bouton est créé ici) et Zoom
    setupSnapping(toolbar, canvas);
    toolbar.appendChild(createSeparator());

    setupAssetCreation(toolbar, canvas);

    // --- Écouteur principal sur la toolbar ---
    toolbar.addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-tool]');
        if (button) {
            const toolName = button.dataset.tool;
            console.log(`Toolbar: Clic sur l'outil '${toolName}'`);
            // Si on reclique sur l'outil actif (sauf 'select'), on repasse à 'select'
            if (button === activeToolButton && toolName !== 'select') {
                 const selectButton = toolbar.querySelector('[data-tool="select"]');
                 if (selectButton) await activateTool('select', selectButton, canvas);
                return;
            }
            // Activer le nouvel outil
            if (button !== activeToolButton) {
                await activateTool(toolName, button, canvas);
            }
        }
    });

    // Activer l'outil de sélection par défaut
    const defaultSelectButton = toolbar.querySelector('[data-tool="select"]');
    if (defaultSelectButton) {
        activateTool('select', defaultSelectButton, canvas);
    } else {
        console.error("Toolbar: Bouton Select par défaut non trouvé !");
    }

    console.log("Toolbar: Initialisation complète terminée.");
}

/**
 * Active un outil spécifique (appelé par l'écouteur de la toolbar).
 * @param {string} toolName - Le nom de l'outil.
 * @param {HTMLButtonElement} button - Le bouton cliqué.
 * @param {fabric.Canvas} canvas - L'instance du canvas.
 */
async function activateTool(toolName, button, canvas) {
    // --- Désactiver l'outil précédent ---
    if (activeToolDeactivate) {
        try {
            console.log(`Toolbar: Désactivation de l'outil précédent '${activeTool}'...`);
            await activeToolDeactivate(canvas);
        } catch (error) { console.error(`Erreur désactivation outil ${activeTool}:`, error); }
    }
    if (activeToolButton) {
        activeToolButton.classList.remove('active', 'btn-primary');
        activeToolButton.classList.add('btn-outline-secondary');
    }

    // --- Réinitialiser l'état ---
    activeTool = toolName;
    activeToolDeactivate = null;
    activeToolButton = button;
    canvas.isDrawingMode = false;
    canvas.selection = true; // Sélection active par défaut (sera écrasé par les outils de dessin)
    canvas.defaultCursor = 'default';
    canvas.setCursor('default');

    // --- Charger et activer le nouvel outil ---
    const modulePath = toolMappings[toolName];
    if (!modulePath) { console.error(`Toolbar: Module non défini pour '${toolName}'`); return; }

    try {
        console.log(`Toolbar: Chargement/Activation module '${modulePath}' pour outil '${toolName}'...`);

        // --- CAS SPÉCIAL: Outil Pan ---
        if (toolName === 'pan') {
            await activatePanTool(canvas); // Fonction d'activation dédiée
            activeToolDeactivate = deactivatePanTool; // Fonction de désactivation dédiée
            button.classList.add('active', 'btn-primary');
            button.classList.remove('btn-outline-secondary');
        }
        // --- AUTRES OUTILS ---
        else {
            // Charger le module s'il n'est pas en cache
            if (!toolModules[toolName]) {
                toolModules[toolName] = await import(modulePath);
            }
            const toolModule = toolModules[toolName];

            if (toolModule && typeof toolModule.activate === 'function' && typeof toolModule.deactivate === 'function') {
                await toolModule.activate(canvas); // L'outil gère son état (curseur, selection=false, etc.)
                activeToolDeactivate = toolModule.deactivate;
                button.classList.add('active', 'btn-primary');
                button.classList.remove('btn-outline-secondary');
            } else {
                throw new Error(`Module pour '${toolName}' invalide.`);
            }
        }
    } catch (error) {
        console.error(`Erreur chargement/activation outil ${toolName}:`, error);
        alert(`Erreur activation outil '${toolName}': ${error.message}`);
        // Retour sécurisé à l'outil select
        const selectButton = document.querySelector('#fabric-toolbar button[data-tool="select"]');
        if (selectButton && button !== selectButton) {
             await activateTool('select', selectButton, canvas);
        } else { console.error("Impossible de revenir à l'outil Select !"); }
    }
}

/** Crée un élément séparateur simple */
function createSeparator() {
    const separator = document.createElement('span');
    separator.className = 'border-start';
    separator.style.height = '24px';
    separator.style.marginLeft = '4px';
    separator.style.marginRight = '4px';
    return separator;
}
