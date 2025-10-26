// Fichier: public/js/ui/toolbar.js
/**
 * Gère la barre d'outils de dessin Fabric.js,
 * charge dynamiquement les modules d'outils et gère l'état actif.
 */

// Stocke l'outil actuellement actif et ses fonctions de désactivation
let activeTool = null;
let activeToolDeactivate = null;
let activeToolButton = null;

// Cache pour les modules d'outils déjà chargés
const toolModules = {};

/**
 * Initialise la barre d'outils et ses écouteurs.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function setupToolbar(canvas) {
    const toolbar = document.getElementById('fabric-toolbar');
    if (!toolbar) {
        console.error("Toolbar: Élément #fabric-toolbar manquant.");
        return;
    }

    // --- Définition des outils et de leurs modules ---
    // La clé est le data-tool des boutons, la valeur est le chemin vers le module
    const toolMappings = {
        'select': '../tools/selectTool.js', // À créer
        'rect': '../tools/rectangleTool.js', // À créer
        'text': '../tools/textTool.js',     // À créer
        // Ajoutez d'autres outils ici (circle, line, pencil, etc.)
    };

    // Vider le contenu placeholder de la toolbar
    toolbar.innerHTML = '';

    // --- Créer les boutons (ou les récupérer s'ils sont déjà dans le HTML) ---
    // Exemple : Création dynamique des boutons
    Object.keys(toolMappings).forEach(toolName => {
        const button = document.createElement('button');
        button.className = 'btn btn-outline-secondary btn-sm';
        button.dataset.tool = toolName;
        button.title = `Outil ${toolName.charAt(0).toUpperCase() + toolName.slice(1)}`;
        // Icônes Bootstrap (exemples)
        let iconClass = 'bi-cursor-fill'; // Défaut pour select
        if (toolName === 'rect') iconClass = 'bi-square';
        if (toolName === 'text') iconClass = 'bi-fonts';
        // Ajoutez d'autres icônes ici...
        button.innerHTML = `<i class="bi ${iconClass}"></i>`;
        toolbar.appendChild(button);
    });

    // Ajouter un séparateur (optionnel)
     const separator = document.createElement('span');
     separator.className = 'border-start mx-2';
     separator.style.height = '20px';
     toolbar.appendChild(separator);

     // Ajouter un bouton pour supprimer l'objet sélectionné
     const deleteButton = document.createElement('button');
     deleteButton.className = 'btn btn-outline-danger btn-sm';
     deleteButton.id = 'delete-object-btn';
     deleteButton.title = 'Supprimer la sélection';
     deleteButton.innerHTML = '<i class="bi bi-trash-fill"></i>';
     toolbar.appendChild(deleteButton);


    // --- Écouteur principal sur la toolbar (délégation d'événements) ---
    toolbar.addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-tool]');
        const deleteBtn = e.target.closest('#delete-object-btn');

        if (button) {
            const toolName = button.dataset.tool;
            console.log(`Toolbar: Clic sur l'outil '${toolName}'`);

            if (button === activeToolButton) {
                // Cliquer sur le bouton déjà actif pourrait le désactiver (retour à select?)
                // Pour l'instant, on ne fait rien ou on repasse en mode sélection
                 // await activateTool('select', toolbar.querySelector('[data-tool="select"]'), canvas, toolMappings);
                return;
            }

            await activateTool(toolName, button, canvas, toolMappings);

        } else if (deleteBtn) {
             // Logique de suppression d'objet
             const activeObject = canvas.getActiveObject();
             if (activeObject) {
                 if (activeObject.type === 'activeSelection') { // Si c'est un groupe de sélection
                     activeObject.forEachObject(obj => canvas.remove(obj));
                 }
                 canvas.remove(activeObject);
                 canvas.discardActiveObject(); // Désélectionne
                 canvas.requestRenderAll();
                 console.log("Toolbar: Objet(s) supprimé(s).");
             }
        }
    });

    // Activer l'outil de sélection par défaut
    activateTool('select', toolbar.querySelector('[data-tool="select"]'), canvas, toolMappings);

    console.log("Toolbar: Initialisation terminée.");
}


/**
 * Active un outil spécifique.
 * @param {string} toolName - Le nom de l'outil (clé dans toolMappings).
 * @param {HTMLButtonElement} button - Le bouton cliqué.
 * @param {fabric.Canvas} canvas - L'instance du canvas.
 * @param {object} toolMappings - L'objet associant noms d'outils et chemins de modules.
 */
async function activateTool(toolName, button, canvas, toolMappings) {
    // --- Désactiver l'outil précédent ---
    if (activeToolDeactivate) {
        try {
            console.log(`Toolbar: Désactivation de l'outil précédent '${activeTool}'...`);
            await activeToolDeactivate(canvas);
        } catch (error) {
            console.error(`Erreur lors de la désactivation de l'outil ${activeTool}:`, error);
        }
    }
    if (activeToolButton) {
        activeToolButton.classList.remove('active', 'btn-primary'); // Style Bootstrap pour actif
        activeToolButton.classList.add('btn-outline-secondary');
    }

     // --- Réinitialiser l'état ---
     activeTool = null;
     activeToolDeactivate = null;
     activeToolButton = null;
     canvas.isDrawingMode = false; // Désactiver le mode dessin libre par défaut
     canvas.selection = true; // Réactiver la sélection par défaut
     canvas.defaultCursor = 'default';
     canvas.setCursor('default');

    // --- Charger et activer le nouvel outil ---
    const modulePath = toolMappings[toolName];
    if (!modulePath) {
        console.error(`Toolbar: Module non défini pour l'outil '${toolName}'`);
        // Rétablir le mode sélection par sécurité
        const selectButton = document.querySelector('#fabric-toolbar button[data-tool="select"]');
        if (selectButton) await activateTool('select', selectButton, canvas, toolMappings);
        return;
    }

    try {
        console.log(`Toolbar: Chargement dynamique du module '${modulePath}'...`);
        // Charger ou récupérer depuis le cache
        if (!toolModules[toolName]) {
            toolModules[toolName] = await import(modulePath);
        }
        const toolModule = toolModules[toolName];

        if (toolModule && typeof toolModule.activate === 'function') {
            console.log(`Toolbar: Activation de l'outil '${toolName}'...`);
            await toolModule.activate(canvas); // La fonction activate gère le curseur, les écouteurs, etc.

            // Mettre à jour l'état actif
            activeTool = toolName;
            activeToolDeactivate = toolModule.deactivate; // Stocker la fonction de désactivation
            activeToolButton = button;
            button.classList.add('active', 'btn-primary');
            button.classList.remove('btn-outline-secondary');
        } else {
            console.error(`Toolbar: Le module pour '${toolName}' n'exporte pas de fonction 'activate'.`);
             // Rétablir le mode sélection
             const selectButton = document.querySelector('#fabric-toolbar button[data-tool="select"]');
             if (selectButton) await activateTool('select', selectButton, canvas, toolMappings);
        }
    } catch (error) {
        console.error(`Erreur lors du chargement ou de l'activation de l'outil ${toolName}:`, error);
        alert(`Impossible d'activer l'outil '${toolName}'. Erreur: ${error.message}`);
         // Rétablir le mode sélection en cas d'erreur grave
         const selectButton = document.querySelector('#fabric-toolbar button[data-tool="select"]');
         if (selectButton) await activateTool('select', selectButton, canvas, toolMappings);
    }
}
