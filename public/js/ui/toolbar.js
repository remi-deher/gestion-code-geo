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
// Importer Navigation Manager pour le bouton Pan ET ses fonctions d'activation/désactivation dédiées
import { setupNavigation, activatePanTool, deactivatePanTool } from '../modules/navigationManager.js';
import { setupSnapping } from '../modules/snapManager.js';
import { updatePageGuide } from '../modules/guideManager.js';
import { PAGE_FORMATS } from '../modules/config.js';

// État de l'outil actif
let activeTool = null;
let activeToolDeactivate = null;
let activeToolButton = null;
const toolModules = {}; // Cache

// Définition des outils et de leurs modules
const toolMappings = {
    'select': '../tools/selectTool.js',
    'rect': '../tools/rectangleTool.js',
    'circle': '../tools/circleTool.js',
    'line': '../tools/lineTool.js',
    'pencil': '../tools/pencilTool.js',
    'text': '../tools/textTool.js',
    'pan': '../modules/navigationManager.js' // Chemin symbolique, utilisé pour le cas spécial
};

// Icônes pour les boutons
const toolIcons = {
    'select': 'bi-cursor-fill', 'rect': 'bi-square', 'circle': 'bi-circle',
    'line': 'bi-slash-lg', 'pencil': 'bi-pencil-fill', 'text': 'bi-fonts',
    'pan': 'bi-arrows-move'
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
    Object.keys(toolMappings).forEach(toolName => {
        // Le bouton Pan est créé par setupNavigation, on le saute ici
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
    // ... (code inchangé pour le sélecteur de guide) ...
    const guideControlsContainer = document.createElement('div');
    guideControlsContainer.className = 'd-inline-flex align-items-center gap-1';
    const guideLabel = document.createElement('label');
    guideLabel.htmlFor = 'page-format-select'; guideLabel.className = 'form-label mb-0 small'; guideLabel.textContent = 'Guide:';
    const select = document.createElement('select');
    select.id = 'page-format-select'; select.className = 'form-select form-select-sm'; select.title = 'Sélectionner le format du guide';
    for (const key in PAGE_FORMATS) { /* ... remplir options ... */
        const option = document.createElement('option');
        option.value = key; option.textContent = PAGE_FORMATS[key].label || key;
        if (key === (window.planData?.currentPlan?.page_format || 'Custom')) { option.selected = true; }
        select.appendChild(option);
    }
    select.addEventListener('change', (e) => { /* ... appel API sauvegarde format ... */
        const planData = window.planData?.currentPlan || null;
        updatePageGuide(e.target.value, canvas, planData);
        // Sauvegarde API (omise pour concision)
    });
    guideControlsContainer.appendChild(guideLabel);
    guideControlsContainer.appendChild(select);
    toolbar.appendChild(guideControlsContainer);

    // --- Initialiser les modules UI restants ---
    setupColorControls(toolbar, canvas);
    setupLayerControls(toolbar, canvas);
    setupGroupControls(toolbar, canvas);
    setupAlignControls(toolbar, canvas);
    setupClipboard(toolbar, canvas);
    setupTransformControls(toolbar, canvas);
    setupNavigation(toolbar, canvas); // Initialise Zoom/Pan(Alt) ET crée le bouton Pan
    setupSnapping(toolbar, canvas);

    // --- Écouteur principal sur la toolbar ---
    toolbar.addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-tool]');
        if (button) {
            const toolName = button.dataset.tool;
            console.log(`Toolbar: Clic sur l'outil '${toolName}'`);
            if (button === activeToolButton && toolName !== 'select') {
                 const selectButton = toolbar.querySelector('[data-tool="select"]');
                 if (selectButton) await activateTool('select', selectButton, canvas);
                return;
            }
            if (button !== activeToolButton) {
                await activateTool(toolName, button, canvas);
            }
        }
    });

    // Activer l'outil de sélection par défaut
    const defaultSelectButton = toolbar.querySelector('[data-tool="select"]');
    if (defaultSelectButton) activateTool('select', defaultSelectButton, canvas);
    else console.error("Toolbar: Bouton Select par défaut non trouvé !");

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
            await activeToolDeactivate(canvas); // La fonction deactivate doit être propre
        } catch (error) { console.error(`Erreur désactivation outil ${activeTool}:`, error); }
    }
    if (activeToolButton) {
        activeToolButton.classList.remove('active', 'btn-primary');
        activeToolButton.classList.add('btn-outline-secondary');
    }

    // --- Réinitialiser l'état avant d'activer le nouveau ---
    activeTool = toolName;
    activeToolDeactivate = null;
    activeToolButton = button;
    // Réinitialisations générales (peuvent être surchargées par activate de l'outil)
    canvas.isDrawingMode = false;
    canvas.selection = true; // Par défaut, la sélection est active (sauf si outil Pan ou dessin)
    canvas.defaultCursor = 'default';
    canvas.setCursor('default');

    // --- Charger et activer le nouvel outil ---
    const modulePath = toolMappings[toolName];
    if (!modulePath) { console.error(`Toolbar: Module non défini pour '${toolName}'`); return; }

    try {
        console.log(`Toolbar: Chargement/Activation module '${modulePath}' pour outil '${toolName}'...`);

        // --- CAS SPÉCIAL: Outil Pan ---
        if (toolName === 'pan') {
            await activatePanTool(canvas); // Appeler la fonction dédiée importée
            activeToolDeactivate = deactivatePanTool; // Utiliser la fonction de désactivation dédiée
            button.classList.add('active', 'btn-primary');
            button.classList.remove('btn-outline-secondary');
        }
        // --- AUTRES OUTILS ---
        else {
            if (!toolModules[toolName]) toolModules[toolName] = await import(modulePath);
            const toolModule = toolModules[toolName];

            if (toolModule && typeof toolModule.activate === 'function' && typeof toolModule.deactivate === 'function') {
                await toolModule.activate(canvas); // L'outil gère son état (curseur, selection=false, etc.)
                activeToolDeactivate = toolModule.deactivate;
                button.classList.add('active', 'btn-primary');
                button.classList.remove('btn-outline-secondary');
            } else {
                throw new Error(`Module pour '${toolName}' invalide (manque activate/deactivate).`);
            }
        }
    } catch (error) {
        console.error(`Erreur chargement/activation outil ${toolName}:`, error);
        alert(`Erreur activation outil '${toolName}': ${error.message}`);
        // Retour sécurisé à l'outil select
        const selectButton = document.querySelector('#fabric-toolbar button[data-tool="select"]');
        if (selectButton && button !== selectButton) {
            // S'assurer que le bouton select existe et n'est pas le bouton défaillant
             await activateTool('select', selectButton, canvas);
        } else {
             // Si même select échoue, situation critique
             console.error("Impossible de revenir à l'outil Select !");
        }
    }
}

/** Crée un élément séparateur simple */
function createSeparator() {
    const separator = document.createElement('span');
    separator.className = 'border-start mx-1';
    separator.style.height = '24px';
    return separator;
}
