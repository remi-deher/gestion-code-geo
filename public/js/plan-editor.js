// Fichier: public/js/plan-editor.js
// Fichier principal pour l'éditeur de plan, utilisant des imports dynamiques.

import { showToast, convertPixelsToPercent } from './modules/utils.js';

// Fonction d'initialisation asynchrone pour gérer les imports dynamiques
async function initializeEditor() {
    const loadingIndicator = document.getElementById('loading-indicator');
    const canvasWrapper = document.getElementById('canvas-wrapper');
    const planCanvasElement = document.getElementById('plan-canvas');
    const saveDrawingBtn = document.getElementById('save-drawing-btn');
    const printBtn = document.getElementById('print-plan-btn');
    const exportBtn = document.getElementById('export-plan-btn');

    if (!canvasWrapper || !planCanvasElement || !loadingIndicator || !saveDrawingBtn || !printBtn || !exportBtn) {
        console.error("Éléments DOM essentiels manquants pour l'éditeur.");
        alert("Erreur critique : Impossible d'initialiser l'interface de l'éditeur.");
        return;
    }

    loadingIndicator.style.display = 'block';

    try {
        // --- 1. Importer et initialiser CanvasManager ---
        console.log("Chargement du CanvasManager...");
        const { default: CanvasManager } = await import('./modules/canvasManager.js');
        console.log("Initialisation du Canvas...");
        const canvasManager = new CanvasManager(planCanvasElement, canvasWrapper);
        const canvas = canvasManager.initializeCanvas();

        // --- 2. Importer les modules nécessaires ---
        console.log("Chargement PlanLoader, GeoCodeRenderer, Sidebar Utils, GuideManager...");
        const { loadPlanBackgroundAndObjects } = await import('./modules/planLoader.js');
        const { createGeoCodeObject, renderPlacedGeoCodes } = await import('./modules/geoCodeRenderer.js');
        const { getCurrentPlacementData, cancelPlacementMode } = await import('./ui/sidebar.js');
        const { updatePageGuide } = await import('./modules/guideManager.js');

        // --- 3. Charger le plan (Définir taille PUIS charger contenu) ---
        console.log("Chargement des données du plan...");
        if (window.planData && window.planData.currentPlan) {

            // Étape A: Déterminer le format et redimensionner le canvas de travail via le guide
            const initialFormat = window.planData.currentPlan.page_format || 'Custom';
            updatePageGuide(initialFormat, canvas, window.planData.currentPlan); // Redimensionne le canvas et crée le guide

            // Étape B: Charger l'image de fond (si existe) et les objets JSON
            // loadPlanBackgroundAndObjects va maintenant mettre à l'échelle et centrer le fond
            await loadPlanBackgroundAndObjects(canvas, window.planData.currentPlan);

            // Étape C: Charger les codes géo déjà placés (utilisent les dimensions stockées ou %)
            if (window.planData.placedGeoCodes && window.planData.placedGeoCodes.length > 0) {
                console.log(`Chargement de ${window.planData.placedGeoCodes.length} codes géo placés...`);
                renderPlacedGeoCodes(canvas, window.planData.placedGeoCodes, window.planData.universColors || {});
            }

        } else {
            console.error("Données du plan (window.planData.currentPlan) non trouvées.");
            throw new Error("Impossible de charger les informations du plan.");
        }

        // --- 4. Configurer les modules UI et Actions ---
        console.log("Chargement Sidebar, Toolbar, Actions...");
        const { setupSidebar } = await import('./ui/sidebar.js');
        const { setupToolbar } = await import('./ui/toolbar.js');
        const { setupEditorActions } = await import('./modules/editorActions.js');

        setupSidebar(canvas);
        setupToolbar(canvas); // Initialise tous les contrôles de la toolbar
        setupEditorActions(canvas, saveDrawingBtn, printBtn, exportBtn);

        // --- 5. Gérer le placement des codes Géo ---
        setupGeoCodePlacement(canvas, createGeoCodeObject, getCurrentPlacementData, cancelPlacementMode);

        // --- 6. Gérer la sauvegarde/suppression des positions des codes Géo ---
        setupPositionSaving(canvas);

        console.log("Éditeur initialisé avec succès.");

    } catch (error) {
        console.error("Erreur lors de l'initialisation de l'éditeur:", error);
        alert(`Une erreur critique est survenue lors du chargement de l'éditeur : ${error.message}. Veuillez rafraîchir la page.`);
        canvasWrapper.innerHTML = `<div class="alert alert-danger m-3">Erreur critique au chargement: ${error.message}</div>`;
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Configure les écouteurs pour placer un nouveau code géo (clic ou drop).
 * @param {fabric.Canvas} canvas
 * @param {function} rendererFn - Fonction pour créer l'objet Fabric (createGeoCodeObject).
 * @param {function} getterFn - Fonction pour obtenir les données du code à placer (getCurrentPlacementData).
 * @param {function} cancelFn - Fonction pour annuler le mode placement (cancelPlacementMode).
 */
function setupGeoCodePlacement(canvas, rendererFn, getterFn, cancelFn) {
    // Placement par Clic
    canvas.on('mouse:down', (options) => {
        const placementData = getterFn();
        if (placementData && !options.target) {
            const pointer = canvas.getPointer(options.e);
            const geoCodeObject = rendererFn(placementData, pointer.x, pointer.y, window.planData.universColors || {});
            canvas.add(geoCodeObject); canvas.setActiveObject(geoCodeObject); canvas.requestRenderAll();
            saveGeoCodePosition(geoCodeObject); cancelFn(canvas);
        }
    });

    // Gestion du Drag and Drop
    const canvasWrapper = canvas.wrapperEl;
    canvasWrapper.addEventListener('dragover', (e) => { e.preventDefault(); /* ... */ });
    canvasWrapper.addEventListener('dragleave', (e) => { /* ... */ });
    canvasWrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        canvasWrapper.classList.remove('drop-target-active');
        document.body.classList.remove('dragging-geocode');
        try {
            const dataString = e.dataTransfer.getData('text/plain');
            const placementData = JSON.parse(dataString);
            if (placementData && placementData.id && placementData.code) {
                const pointer = canvas.getPointer(e);
                const geoCodeObject = rendererFn(placementData, pointer.x, pointer.y, window.planData.universColors || {});
                canvas.add(geoCodeObject); canvas.setActiveObject(geoCodeObject); canvas.requestRenderAll();
                saveGeoCodePosition(geoCodeObject); cancelFn(canvas);
            } else { showToast("Données de drop invalides.", "warning"); }
        } catch (error) { showToast("Erreur lors du drop.", "danger"); }
    });
    console.log("Placement GeoCode: Écouteurs Clic et Drop configurés.");
}

/**
 * Configure les écouteurs pour sauvegarder ou supprimer la position d'un code géo.
 * @param {fabric.Canvas} canvas
 */
function setupPositionSaving(canvas) {
    canvas.on('object:modified', (e) => { if (e.target?.customData?.type === 'geoCode') saveGeoCodePosition(e.target); });
    canvas.on('object:removed', (e) => { if (e.target?.customData?.type === 'geoCode') removeGeoCodePosition(e.target); });
    console.log("Position Saving: Écouteurs Modifié/Supprimé configurés.");
}

/**
 * Envoie la position d'un objet GeoCode à l'API pour sauvegarde (ajout ou mise à jour).
 * @param {fabric.Object} geoCodeObject - L'objet Fabric représentant le code géo.
 */
async function saveGeoCodePosition(geoCodeObject) {
     if (!geoCodeObject?.customData?.type === 'geoCode') return;
    const canvas = geoCodeObject.canvas;
    const planId = window.planData?.currentPlan?.id;
    const apiUrl = window.planData?.placeGeoCodeUrl;
    const geoCodeId = geoCodeObject.customData.geoCodeId;
    if (!canvas || !planId || !apiUrl || !geoCodeId) {
        showToast("Erreur interne : sauvegarde position impossible.", "danger"); return;
    }
    const centerPoint = geoCodeObject.getCenterPoint();
    // Utiliser window.originalPlanWidth/Height définis par planLoader
    const { posX, posY } = convertPixelsToPercent(centerPoint.x, centerPoint.y, canvas);
     if (isNaN(posX) || isNaN(posY)) {
        showToast("Erreur calcul position %, sauvegarde annulée.", "warning"); return;
    }
    const payload = { plan_id: planId, geo_code_id: geoCodeId, pos_x: posX.toFixed(4), pos_y: posY.toFixed(4) };
    console.log(`Sauvegarde Position: Envoi pour ${geoCodeObject.customData.code}`, payload);
    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        const result = await response.json(); if (!result.success) throw new Error(result.error || "Erreur API.");
        console.log(`Sauvegarde Position: Succès pour ${geoCodeObject.customData.code}. ID Position BDD: ${result.position_id}`);
        if (result.position_id) geoCodeObject.customData.positionId = result.position_id;
    } catch (error) { showToast(`Erreur sauvegarde position (${geoCodeObject.customData.code}): ${error.message}`, 'danger'); }
}

/**
 * Appelle l'API pour supprimer la position d'un code géo de ce plan.
 * @param {fabric.Object} geoCodeObject - L'objet Fabric qui vient d'être supprimé du canvas.
 */
async function removeGeoCodePosition(geoCodeObject) {
     if (!geoCodeObject?.customData?.type === 'geoCode') return;
    const planId = window.planData?.currentPlan?.id;
    const apiUrl = window.planData?.removeGeoCodeUrl;
    const geoCodeId = geoCodeObject.customData.geoCodeId;
    if (!planId || !apiUrl || !geoCodeId) { return; }
    console.log(`Suppression Position: Envoi pour geoCodeId=${geoCodeId}, planId=${planId}`);
    try {
         const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ plan_id: planId, geo_code_id: geoCodeId }) });
         if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
         const result = await response.json(); if (!result.success) throw new Error(result.error || "Erreur API.");
         console.log(`Suppression Position: Succès pour ${geoCodeObject.customData.code}.`);
         showToast(`'${geoCodeObject.customData.code}' retiré du plan.`, 'info');
         // Remettre le code dans la liste des codes disponibles
         const availableList = document.getElementById('available-geocodes-list');
         const existingItem = availableList.querySelector(`[data-id="${geoCodeId}"]`);
         if (availableList && !existingItem) { /* ... recréer l'élément li ... */ }
    } catch (error) { showToast(`Erreur suppression BDD (${geoCodeObject.customData.code}): ${error.message}`, 'danger'); }
}

// Lancer l'initialisation
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEditor);
} else {
    initializeEditor();
}
