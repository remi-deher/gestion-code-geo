// Fichier: public/js/ui/toolbar.js
/**
 * Gère la barre d'outils de dessin Fabric.js,
 * charge dynamiquement les modules d'outils et gère l'état actif.
 * Initialise également les modules UI pour les couleurs, calques, groupes, etc.
 */

// Importer les gestionnaires UI
import { setupColorControls, getCurrentColors } from './colorManager.js';
import { setupLayerControls } from './layerManager.js';
import { setupGroupControls } from './groupManager.js';
import { setupAlignControls } from './alignManager.js';
import { setupClipboard } from '../modules/clipboardManager.js'; // Note: Déplacé dans modules? À vérifier
import { setupTransformControls } from '../modules/transformManager.js'; // Note: Déplacé dans modules? À vérifier
import { setupNavigation } from '../modules/navigationManager.js'; // Import pour le bouton Pan
import { setupSnapping } from '../modules/snapManager.js'; // Import pour le bouton Snap

// État de l'outil actif
let activeTool = null;
let activeToolDeactivate = null;
let activeToolButton = null;
const toolModules = {}; // Cache

// Définition des outils et de leurs modules
const toolMappings = {
    'select': '../tools/selectTool.js',
    'rect': '../tools/rectangleTool.js',
    'circle': '../tools/circleTool.js', // Ajouté
    'line': '../tools/lineTool.js',     // Ajouté
    'pencil': '../tools/pencilTool.js', // Ajouté
    'text': '../tools/textTool.js',
    'pan': '../modules/navigationManager.js' // L'outil Pan est géré par navigationManager
};

// Icônes pour les boutons
const toolIcons = {
    'select': 'bi-cursor-fill',
    'rect': 'bi-square',
    'circle': 'bi-circle',
    'line': 'bi-slash-lg',
    'pencil': 'bi-pencil-fill',
    'text': 'bi-fonts',
    'pan': 'bi-arrows-move'
};

/**
 * Initialise la barre d'outils complète.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function setupToolbar(canvas) {
    const toolbar = document.getElementById('fabric-toolbar');
    if (!toolbar) {
        console.error("Toolbar: Élément #fabric-toolbar manquant.");
        return;
    }

    // Vider le contenu placeholder
    toolbar.innerHTML = '';
    toolbar.className = 'toolbar bg-light border-bottom p-1 d-flex flex-wrap align-items-center gap-1'; // Classes Bootstrap pour l'affichage

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

    // --- Séparateur ---
    toolbar.appendChild(createSeparator());

    // --- Bouton Supprimer (géré par clipboardManager maintenant) ---
    // Note: Le bouton delete est ajouté par setupClipboard

    // --- Initialiser les modules UI qui ajoutent leurs propres contrôles ---
    setupColorControls(toolbar, canvas);
    setupLayerControls(toolbar, canvas);
    setupGroupControls(toolbar, canvas);
    setupAlignControls(toolbar, canvas);
    setupClipboard(toolbar, canvas); // Ajoute Copier/Coller/Supprimer
    setupTransformControls(toolbar, canvas); // Ajoute Flip H/V
    setupNavigation(toolbar, canvas); // Ajoute Zoom +/-/Reset et le bouton Pan
    setupSnapping(toolbar, canvas); // Ajoute bouton Snap Grille

    // --- Écouteur principal sur la toolbar ---
    toolbar.addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-tool]');
        // La suppression est gérée par l'écouteur dans clipboardManager

        if (button) {
            const toolName = button.dataset.tool;
            console.log(`Toolbar: Clic sur l'outil '${toolName}'`);

            if (button === activeToolButton && toolName !== 'select') {
                // Cliquer sur le bouton déjà actif (sauf select) revient à la sélection
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
            // La fonction deactivate doit gérer la réinitialisation du curseur etc. si besoin
            await activeToolDeactivate(canvas);
        } catch (error) {
            console.error(`Erreur lors de la désactivation de l'outil ${activeTool}:`, error);
        }
    }
    if (activeToolButton) {
        activeToolButton.classList.remove('active', 'btn-primary');
        activeToolButton.classList.add('btn-outline-secondary');
    }

    // --- Réinitialiser l'état ---
    activeTool = toolName; // Mettre à jour même si l'activation échoue, pour référence
    activeToolDeactivate = null;
    activeToolButton = button; // Le bouton cliqué devient le bouton actif

    // --- Charger et activer le nouvel outil ---
    const modulePath = toolMappings[toolName];
    if (!modulePath) {
        console.error(`Toolbar: Module non défini pour l'outil '${toolName}'`);
        // Rétablir le mode sélection par sécurité
        const selectButton = document.querySelector('#fabric-toolbar button[data-tool="select"]');
        if (selectButton) await activateTool('select', selectButton, canvas);
        return;
    }

    try {
        console.log(`Toolbar: Chargement dynamique du module '${modulePath}' pour outil '${toolName}'...`);
        // Charger ou récupérer depuis le cache
        if (!toolModules[toolName]) {
            toolModules[toolName] = await import(modulePath);
        }
        const toolModule = toolModules[toolName];

        // S'assurer que les fonctions activate/deactivate existent
        if (toolModule && typeof toolModule.activate === 'function' && typeof toolModule.deactivate === 'function') {
            console.log(`Toolbar: Activation de l'outil '${toolName}'...`);
            // La fonction activate gère le curseur, les écouteurs, désactive la sélection globale si besoin etc.
            await toolModule.activate(canvas);

            // Mettre à jour l'état de désactivation et le style du bouton
            activeToolDeactivate = toolModule.deactivate;
            button.classList.add('active', 'btn-primary');
            button.classList.remove('btn-outline-secondary');
        } else {
            console.error(`Toolbar: Le module pour '${toolName}' n'exporte pas 'activate' et/ou 'deactivate'.`);
             // Rétablir le mode sélection
             const selectButton = document.querySelector('#fabric-toolbar button[data-tool="select"]');
             if (selectButton) await activateTool('select', selectButton, canvas);
        }
    } catch (error) {
        console.error(`Erreur lors du chargement ou de l'activation de l'outil ${toolName}:`, error);
        alert(`Impossible d'activer l'outil '${toolName}'. Erreur: ${error.message}`);
         // Rétablir le mode sélection en cas d'erreur grave
         const selectButton = document.querySelector('#fabric-toolbar button[data-tool="select"]');
         if (selectButton) await activateTool('select', selectButton, canvas);
    }
}

/** Crée un élément séparateur simple */
function createSeparator() {
    const separator = document.createElement('span');
    separator.className = 'border-start mx-1';
    separator.style.height = '24px'; // Ajuster la hauteur
    return separator;
}

// Exporter activateTool si d'autres modules ont besoin de changer l'outil programmatiquement
// export { activateTool };
