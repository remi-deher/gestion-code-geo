// Fichier: public/js/plan-editor.js
// Fichier principal pour l'éditeur de plan, utilisant des imports dynamiques.

// Fonction d'initialisation asynchrone pour gérer les imports dynamiques
async function initializeEditor() {
    const loadingIndicator = document.getElementById('loading-indicator');
    const canvasWrapper = document.getElementById('canvas-wrapper');
    const planCanvasElement = document.getElementById('plan-canvas');
    const saveDrawingBtn = document.getElementById('save-drawing-btn');
    // Ajoutez ici les sélecteurs pour les autres boutons (sidebar, print, export) si nécessaire
    // const sidebarToggleBtn = document.querySelector('[data-bs-target="#sidebarOffcanvas"]');
    // const printBtn = document.getElementById('print-plan-btn');
    // const exportBtn = document.getElementById('export-plan-btn');

    if (!canvasWrapper || !planCanvasElement || !loadingIndicator || !saveDrawingBtn) {
        console.error("Éléments DOM essentiels manquants pour l'éditeur.");
        alert("Erreur critique : Impossible d'initialiser l'interface de l'éditeur.");
        return;
    }

    loadingIndicator.style.display = 'block'; // Afficher le chargement

    try {
        // --- 1. Importer dynamiquement le gestionnaire de Canvas ---
        console.log("Chargement du CanvasManager...");
        const { default: CanvasManager } = await import('./modules/canvasManager.js'); // Assurez-vous que le chemin est correct

        // --- 2. Initialiser le Canvas ---
        console.log("Initialisation du Canvas...");
        const canvasManager = new CanvasManager(planCanvasElement, canvasWrapper);
        canvasManager.initializeCanvas(); // Configure la taille initiale, etc.

        // --- 3. Importer dynamiquement le chargeur de plan ---
        console.log("Chargement du PlanLoader...");
        const { loadPlanBackgroundAndObjects } = await import('./modules/planLoader.js'); // À créer

        // --- 4. Charger le plan (fond + objets existants) ---
        console.log("Chargement des données du plan...");
        // window.planData est injecté par plan_editor_view.php
        if (window.planData && window.planData.currentPlan) {
            await loadPlanBackgroundAndObjects(canvasManager.getCanvas(), window.planData.currentPlan);

            // Charger les codes Géo déjà placés (pourrait être dans planLoader ou ici)
             if (window.planData.placedGeoCodes && window.planData.placedGeoCodes.length > 0) {
                 console.log(`Chargement de ${window.planData.placedGeoCodes.length} codes géo placés...`);
                 // Ici, on importerait dynamiquement le module GeoCodeRenderer et on appellerait une fonction
                 // const { renderPlacedGeoCodes } = await import('./modules/geoCodeRenderer.js'); // À créer
                 // renderPlacedGeoCodes(canvasManager.getCanvas(), window.planData.placedGeoCodes, window.planData.universColors);
                 console.warn("Le rendu des codes géo placés n'est pas encore implémenté.");
             }

        } else {
            console.error("Données du plan (window.planData.currentPlan) non trouvées.");
            throw new Error("Impossible de charger les informations du plan.");
        }

        // --- 5. Importer dynamiquement et configurer la Sidebar ---
        console.log("Chargement de la Sidebar...");
        const { setupSidebar } = await import('./ui/sidebar.js'); // À créer
        setupSidebar(canvasManager.getCanvas());

        // --- 6. Importer dynamiquement et configurer la Toolbar ---
        console.log("Chargement de la Toolbar...");
        const { setupToolbar } = await import('./ui/toolbar.js'); // À créer
        setupToolbar(canvasManager.getCanvas()); // Passe le canvas aux outils

        // --- 7. Importer dynamiquement et configurer les actions (Sauvegarde, Export, etc.) ---
        console.log("Chargement des Actions...");
        const { setupEditorActions } = await import('./modules/editorActions.js'); // À créer
        setupEditorActions(canvasManager.getCanvas(), saveDrawingBtn /*, printBtn, exportBtn */);


        // --- Fin de l'initialisation ---
        console.log("Éditeur initialisé avec succès.");

    } catch (error) {
        console.error("Erreur lors de l'initialisation de l'éditeur:", error);
        alert(`Une erreur critique est survenue lors du chargement de l'éditeur : ${error.message}. Veuillez rafraîchir la page.`);
        // Optionnel : afficher un message d'erreur plus visible dans l'interface
        canvasWrapper.innerHTML = `<div class="alert alert-danger m-3">Erreur critique au chargement: ${error.message}</div>`;
    } finally {
        loadingIndicator.style.display = 'none'; // Masquer le chargement
    }
}

// Lancer l'initialisation une fois le DOM prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEditor);
} else {
    initializeEditor();
}
