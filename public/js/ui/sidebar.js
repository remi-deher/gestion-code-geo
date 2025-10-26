// Fichier: public/js/ui/sidebar.js
/**
 * Gère l'interactivité de la sidebar : filtrage des codes géo,
 * sélection pour placement (clic), et potentiellement drag-and-drop.
 */

// Variable pour suivre l'état du placement (quel code est sélectionné)
let currentPlacementData = null;

/**
 * Initialise les fonctionnalités de la sidebar.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function setupSidebar(canvas) {
    const geocodeSearchInput = document.getElementById('geocode-search');
    const availableGeocodesList = document.getElementById('available-geocodes-list');

    if (!geocodeSearchInput || !availableGeocodesList) {
        console.error("Sidebar: Éléments de recherche ou liste de codes géo manquants.");
        return;
    }

    // --- 1. Filtrage de la liste ---
    geocodeSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const items = availableGeocodesList.querySelectorAll('.available-geocode-item');
        items.forEach(item => {
            const code = item.dataset.code?.toLowerCase() || '';
            const libelle = item.dataset.libelle?.toLowerCase() || '';
            const isVisible = code.includes(searchTerm) || libelle.includes(searchTerm);
            item.style.display = isVisible ? '' : 'none';
        });
    });

    // --- 2. Sélection pour Placement (Clic) ---
    availableGeocodesList.addEventListener('click', (e) => {
        const targetItem = e.target.closest('.available-geocode-item');
        if (!targetItem) return;

        // Désélectionner l'ancien item actif, s'il y en a un
        const currentlyActive = availableGeocodesList.querySelector('.placement-active');
        if (currentlyActive && currentlyActive !== targetItem) {
            currentlyActive.classList.remove('placement-active');
        }

        // Basculer l'état actif de l'item cliqué
        targetItem.classList.toggle('placement-active');

        if (targetItem.classList.contains('placement-active')) {
            // Activer le mode placement
            currentPlacementData = {
                id: targetItem.dataset.id,
                code: targetItem.dataset.code,
                libelle: targetItem.dataset.libelle,
                universId: targetItem.dataset.universId
                // Ajoutez d'autres data-* si nécessaire
            };
            canvas.defaultCursor = 'crosshair'; // Changer le curseur du canvas
            canvas.setCursor('crosshair'); // Appliquer immédiatement
            console.log("Sidebar: Mode placement activé pour", currentPlacementData);
            // Optionnel: Fermer la sidebar après sélection ?
            // const sidebarOffcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('sidebarOffcanvas'));
            // if (sidebarOffcanvas) sidebarOffcanvas.hide();

        } else {
            // Désactiver le mode placement
            cancelPlacementMode(canvas);
        }
    });


    // --- 3. Annuler le placement si on clique ailleurs sur le canvas ---
    // (L'ajout réel de l'objet se fera dans canvasManager ou plan-editor en écoutant 'mouse:down')
    canvas.on('mouse:down', (options) => {
        // Si on clique sur le canvas alors qu'un code est sélectionné pour placement,
        // MAIS qu'on ne clique PAS sur un objet existant (options.target),
        // alors on place le nouvel objet.
        // Si on clique sur un objet existant, on annule le placement.
        if (currentPlacementData && options.target) {
             console.log("Sidebar: Clic sur un objet existant, annulation du mode placement.");
             cancelPlacementMode(canvas);
        }
        // La logique pour *créer* l'objet au clic sera gérée ailleurs (probablement dans plan-editor.js ou canvasManager.js)
        // en vérifiant si currentPlacementData n'est pas null.
    });


    // --- 4. Gestion Drag-and-Drop (Initiation) ---
    // (Le dépôt 'drop' sera géré par le canvas lui-même, probablement dans canvasManager.js)
    availableGeocodesList.addEventListener('dragstart', (e) => {
        const targetItem = e.target.closest('.available-geocode-item');
        if (targetItem) {
            // Stocker les données nécessaires pour le drop
            e.dataTransfer.setData('text/plain', JSON.stringify({
                 id: targetItem.dataset.id,
                 code: targetItem.dataset.code,
                 libelle: targetItem.dataset.libelle,
                 universId: targetItem.dataset.universId
             }));
            e.dataTransfer.effectAllowed = 'copy';
            document.body.classList.add('dragging-geocode'); // Style visuel global
            console.log("Sidebar: Drag start pour", targetItem.dataset.code);
        } else {
            e.preventDefault(); // Empêcher le drag si ce n'est pas un item
        }
    });

    availableGeocodesList.addEventListener('dragend', (e) => {
        document.body.classList.remove('dragging-geocode'); // Nettoyer le style
        console.log("Sidebar: Drag end");
    });


    console.log("Sidebar: Initialisation terminée.");
}


/**
 * Fonction pour annuler le mode placement activé par clic.
 * @param {fabric.Canvas} canvas
 */
export function cancelPlacementMode(canvas) {
    if (!currentPlacementData) return; // Si pas en mode placement, ne rien faire

    const availableGeocodesList = document.getElementById('available-geocodes-list');
    const activeItem = availableGeocodesList?.querySelector('.placement-active');
    if (activeItem) {
        activeItem.classList.remove('placement-active');
    }
    currentPlacementData = null;
    if (canvas) {
         canvas.defaultCursor = 'default';
         canvas.setCursor('default');
    }
    console.log("Sidebar: Mode placement annulé.");
}


/**
 * Récupère les données du code actuellement sélectionné pour placement.
 * Utilisé par d'autres modules pour savoir quoi placer.
 * @returns {object | null} Les données du code ou null.
 */
export function getCurrentPlacementData() {
    return currentPlacementData;
}
