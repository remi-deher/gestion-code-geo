// Fichier: public/js/plan-editor.js
// Fichier principal pour l'éditeur de plan, utilisant des imports dynamiques.

import { showToast, convertPixelsToPercent } from './modules/utils.js';
// NOUVEAU: Importer la fonction de placement d'asset DEPUIS assetManager
import { placeAssetById } from './modules/assetManager.js';

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
        // --- 1. Importer CanvasManager et les modules essentiels ---
        console.log("Chargement CanvasManager et modules...");
        // Utilisation de la syntaxe corrigée pour l'import default dynamique
        const CanvasManager = (await import('./modules/canvasManager.js')).default;
        const { loadPlanBackgroundAndObjects } = await import('./modules/planLoader.js');
        const { createGeoCodeObject, renderPlacedGeoCodes } = await import('./modules/geoCodeRenderer.js'); // Garder pour les codes géo
        const { getCurrentPlacementData, cancelPlacementMode } = await import('./ui/sidebar.js'); // Seulement fonctions geo-code nécessaires ici
        // Importer setCanvasSizeFromFormat et updatePageGuideBorder
        const { setCanvasSizeFromFormat, updatePageGuideBorder } = await import('./modules/guideManager.js');

        // --- 2. Initialiser le Canvas Fabric (sans taille initiale fixe ici) ---
        console.log("Initialisation du Canvas...");
        const canvasManager = new CanvasManager(planCanvasElement, canvasWrapper);
        const canvas = canvasManager.initializeCanvas(); // Crée l'instance Fabric

        // --- 3. Définir la taille du Canvas basé sur le format du plan ---
        console.log("Définition de la taille du canvas...");
        if (window.planData && window.planData.currentPlan) {
            const initialFormat = window.planData.currentPlan.page_format || 'A4-P'; // A4-P par défaut
            // Définit la taille du canvas Fabric
            setCanvasSizeFromFormat(initialFormat, canvas);
            // Ajuste l'offset basé sur la NOUVELLE taille du canvas
            canvasManager.resizeCanvas(); // Important pour que les coords souris soient correctes

        } else {
             console.error("Données du plan non trouvées. Utilisation A4-P par défaut.");
             setCanvasSizeFromFormat('A4-P', canvas);
             canvasManager.resizeCanvas();
        }


        // --- 4. Charger le contenu du plan (Fond et Objets) ---
        // planLoader adaptera le canvas si format='Custom' et image trouvée
        console.log("Chargement du contenu du plan...");
        if (window.planData && window.planData.currentPlan) {
            await loadPlanBackgroundAndObjects(canvas, window.planData.currentPlan);

            // Note: renderPlacedGeoCodes est maintenant appelé DANS loadPlanBackgroundAndObjects
            // ou après si loadJsonData est utilisé pour charger aussi les codes géo
            // Si drawing_data n'inclut PAS les codes géo, il faut les rendre séparément:
            const drawingDataString = window.planData.currentPlan.drawing_data || '{}';
            let includesGeoCodes = false;
            try { includesGeoCodes = drawingDataString.includes('"type":"geoCode"'); } catch(e){}

            if (window.planData.placedGeoCodes && window.planData.placedGeoCodes.length > 0 && !includesGeoCodes) {
                 console.log(`Chargement séparé de ${window.planData.placedGeoCodes.length} codes géo placés...`);
                 renderPlacedGeoCodes(canvas, window.planData.placedGeoCodes, window.planData.universColors || {});
            }
        } // else déjà géré

        // --- 5. Dessiner la bordure du guide ---
        updatePageGuideBorder(canvas); // Dessine la bordure aux dimensions FINALES du canvas

        // --- 6. Configurer les modules UI et Actions ---
        console.log("Chargement Sidebar, Toolbar, Actions...");
        const { setupSidebar } = await import('./ui/sidebar.js');
        const { setupToolbar } = await import('./ui/toolbar.js');
        // setupAssetCreation est maintenant appelé DANS setupToolbar
        const { setupEditorActions } = await import('./modules/editorActions.js');

        await setupSidebar(canvas); // Devenu async à cause du fetch assets
        setupToolbar(canvas); // Initialise tous les contrôles (y compris assetManager via import)
        setupEditorActions(canvas, saveDrawingBtn, printBtn, exportBtn);

        // --- 7. Gérer le placement des codes Géo et Assets ---
        setupPlacement(canvas, createGeoCodeObject, getCurrentPlacementData, cancelPlacementMode);

        // --- 8. Gérer la sauvegarde/suppression des positions des codes Géo ---
        setupPositionSaving(canvas);

        console.log("Éditeur initialisé avec succès.");

    } catch (error) {
        console.error("Erreur lors de l'initialisation de l'éditeur:", error);
        alert(`Une erreur critique est survenue lors du chargement de l'éditeur : ${error.message}. Veuillez rafraîchir la page.`);
        if(canvasWrapper) canvasWrapper.innerHTML = `<div class="alert alert-danger m-3">Erreur critique au chargement: ${error.message}</div>`;
    } finally {
        if(loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Configure les écouteurs pour placer un nouveau code géo ou un asset (clic ou drop).
 * @param {fabric.Canvas} canvas
 * @param {function} geoCodeRendererFn - Fonction pour créer l'objet Fabric GeoCode.
 * @param {function} geoCodeGetterFn - Fonction pour obtenir les données du code géo à placer.
 * @param {function} geoCodeCancelFn - Fonction pour annuler le mode placement code géo.
 */
function setupPlacement(canvas, geoCodeRendererFn, geoCodeGetterFn, geoCodeCancelFn) {
    // NOTE: La logique de placement par CLIC est maintenant dans les modules respectifs:
    // - sidebar.js (pour activer le mode placement)
    // - assetManager.js (handlePlaceAssetClick pour assets)
    // - Ce fichier (ci-dessous pour codes géo)

    // Placement par Clic (Code Géo UNIQUEMENT)
    canvas.on('mouse:down', (options) => {
        const placementData = geoCodeGetterFn(); // Vérifie si on est en mode placement CODE GEO
        if (placementData && !options.target && !options.e.altKey) { // Ne pas placer si Alt (pan) est pressée
            const pointer = canvas.getPointer(options.e);
            const geoCodeObject = geoCodeRendererFn(placementData, pointer.x, pointer.y, window.planData?.universColors || {});
            canvas.add(geoCodeObject); canvas.setActiveObject(geoCodeObject); canvas.requestRenderAll();
            saveGeoCodePosition(geoCodeObject); // Sauvegarde BDD
            geoCodeCancelFn(canvas); // Annule le mode placement dans la sidebar
             // Retirer l'item de la liste des codes dispos
             const listItem = document.querySelector(`#available-geocodes-list .available-geocode-item[data-id="${placementData.id}"]`);
             if(listItem) listItem.remove();
        }
        // Le placement d'asset par clic est géré dans assetManager.js via son propre écouteur
    });

    // Gestion du Drag and Drop (Code Géo ET Asset)
    const canvasWrapper = canvas.wrapperEl;
    canvasWrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        // Vérifier si des données text/plain sont glissées (nos codes ou assets)
        if (e.dataTransfer.types.includes('text/plain')) {
            e.dataTransfer.dropEffect = 'copy';
            canvasWrapper.classList.add('drop-target-active');
        } else { e.dataTransfer.dropEffect = 'none'; }
    });
    canvasWrapper.addEventListener('dragleave', (e) => {
        // Retirer la classe seulement si on quitte VRAIMENT la zone (pas un enfant)
        if (!canvasWrapper.contains(e.relatedTarget)) {
            canvasWrapper.classList.remove('drop-target-active');
        }
    });
    canvasWrapper.addEventListener('drop', async (e) => { // Rendre async pour placeAssetById
        e.preventDefault();
        canvasWrapper.classList.remove('drop-target-active');
        document.body.classList.remove('dragging-geocode');
        document.body.classList.remove('dragging-asset'); // Nettoyer aussi pour asset
        try {
            const dataString = e.dataTransfer.getData('text/plain');
            const placementData = JSON.parse(dataString);

            // Obtenir les coordonnées RELATIVES au canvas (même si scrollé)
            const pointer = canvas.getPointer(e, true); // true = ignoreZoom

            // Vérifier si c'est un Code Géo ou un Asset
            if (placementData && placementData.id && placementData.code) {
                // C'est un Code Géo
                console.log("Drop: Détection Code Géo", placementData);
                const geoCodeObject = geoCodeRendererFn(placementData, pointer.x, pointer.y, window.planData?.universColors || {});
                canvas.add(geoCodeObject); canvas.setActiveObject(geoCodeObject); canvas.requestRenderAll();
                saveGeoCodePosition(geoCodeObject); // Sauvegarder position
                // Pas besoin d'annuler le mode placement, le drag est fini
                // Retirer l'item de la liste sidebar
                const listItem = document.querySelector(`#available-geocodes-list .available-geocode-item[data-id="${placementData.id}"]`);
                if(listItem) listItem.remove();

            } else if (placementData && placementData.id && placementData.name) {
                // C'est un Asset (placé via Drag&Drop)
                console.log("Drop: Détection Asset", placementData);
                await placeAssetById(placementData.id, pointer.x, pointer.y, canvas); // Appeler la fonction de placement d'asset
            } else {
                 showToast("Données de drop invalides.", "warning");
            }
        } catch (error) {
             console.error("Drop Erreur:", error);
             showToast("Erreur lors du drop.", "danger");
        }
    });
    console.log("Placement: Écouteurs Clic (GeoCode) et Drop (GeoCode/Asset) configurés.");
}

/**
 * Configure les écouteurs pour sauvegarder ou supprimer la position d'un code géo.
 * @param {fabric.Canvas} canvas
 */
function setupPositionSaving(canvas) {
    canvas.on('object:modified', (e) => {
        // Sauvegarder uniquement si c'est un code géo qui a été bougé/redimensionné
        if (e.target?.customData?.type === 'geoCode') {
            saveGeoCodePosition(e.target);
        }
        // Pour les assets ou autres objets, la sauvegarde se fait via le bouton "Enregistrer" global (qui sauve tout le drawing_data)
    });
    canvas.on('object:removed', (e) => {
        // Supprimer la position de la BDD uniquement si c'est un code géo
        if (e.target?.customData?.type === 'geoCode') {
            removeGeoCodePosition(e.target);
        }
        // La suppression d'autres objets est gérée par la sauvegarde globale du drawing_data
    });
    console.log("Position Saving (GeoCode): Écouteurs Modifié/Supprimé configurés.");
}

/**
 * Envoie la position d'un objet GeoCode à l'API pour sauvegarde (ajout ou mise à jour).
 * @param {fabric.Object} geoCodeObject - L'objet Fabric représentant le code géo.
 */
async function saveGeoCodePosition(geoCodeObject) {
     if (geoCodeObject?.customData?.type !== 'geoCode') return; // Vérification stricte
    const canvas = geoCodeObject.canvas;
    const planId = window.planData?.currentPlan?.id;
    const apiUrl = window.planData?.placeGeoCodeUrl;
    const geoCodeId = geoCodeObject.customData.geoCodeId;
    if (!canvas || !planId || !apiUrl || !geoCodeId) {
        showToast("Erreur interne : sauvegarde position impossible.", "danger"); return;
    }
    const centerPoint = geoCodeObject.getCenterPoint();
    // Utiliser window.originalPlanWidth/Height qui correspondent maintenant à la taille du canvas/page
    const { posX, posY } = convertPixelsToPercent(centerPoint.x, centerPoint.y, canvas);
     if (isNaN(posX) || isNaN(posY)) {
        showToast("Erreur calcul position %, sauvegarde annulée.", "warning"); return;
    }
    const payload = { plan_id: planId, geo_code_id: geoCodeId, pos_x: posX.toFixed(4), pos_y: posY.toFixed(4) };
    console.log(`Sauvegarde Position GeoCode: Envoi pour ${geoCodeObject.customData.code}`, payload);
    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify(payload) });
        if (!response.ok) {
            let errorMsg = `Erreur HTTP ${response.status}`;
            try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch(e){}
            throw new Error(errorMsg);
        }
        const result = await response.json(); if (!result.success) throw new Error(result.error || "Erreur API.");
        console.log(`Sauvegarde Position GeoCode: Succès pour ${geoCodeObject.customData.code}. ID Position BDD: ${result.position_id}`);
        // Stocker l'ID de la position retourné par l'API dans l'objet Fabric
        if (result.position_id) geoCodeObject.customData.positionId = result.position_id;
         // Retirer l'item de la liste des codes dispos si ce n'est pas déjà fait (placement initial ou drop)
         const listItem = document.querySelector(`#available-geocodes-list .available-geocode-item[data-id="${geoCodeId}"]`);
         if(listItem) listItem.remove();

    } catch (error) {
         console.error(`Erreur API sauvegarde position ${geoCodeObject.customData.code}:`, error);
         showToast(`Erreur sauvegarde position (${geoCodeObject.customData.code}): ${error.message}`, 'danger');
    }
}

/**
 * Appelle l'API pour supprimer la position d'un code géo de ce plan.
 * @param {fabric.Object} geoCodeObject - L'objet Fabric qui vient d'être supprimé du canvas.
 */
async function removeGeoCodePosition(geoCodeObject) {
     if (geoCodeObject?.customData?.type !== 'geoCode') return; // Vérification stricte
    const planId = window.planData?.currentPlan?.id;
    const apiUrl = window.planData?.removeGeoCodeUrl;
    const geoCodeId = geoCodeObject.customData.geoCodeId;
    const positionId = geoCodeObject.customData.positionId; // Récupérer l'ID de position si disponible

    if (!planId || !apiUrl || !geoCodeId) { return; } // Ne rien faire si infos manquantes

    console.log(`Suppression Position GeoCode: Envoi pour geoCodeId=${geoCodeId}, planId=${planId}`);
    try {
         const payload = { plan_id: planId, geo_code_id: geoCodeId };
         // Optionnel: Envoyer positionId si l'API l'utilise pour plus de précision
         // if (positionId) payload.position_id = positionId;

         const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify(payload) });
         if (!response.ok) {
             let errorMsg = `Erreur HTTP ${response.status}`;
             try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch(e){}
             throw new Error(errorMsg);
         }
         const result = await response.json(); if (!result.success) throw new Error(result.error || "Erreur API.");
         console.log(`Suppression Position BDD: Succès pour ${geoCodeObject.customData.code}.`);
         showToast(`'${geoCodeObject.customData.code}' retiré du plan.`, 'info');

         // --- Remettre le code dans la liste des codes disponibles ---
         const availableList = document.getElementById('available-geocodes-list');
         const existingItem = availableList?.querySelector(`.available-geocode-item[data-id="${geoCodeId}"]`);
         if (availableList && !existingItem) { // Vérifier qu'il n'y est pas déjà
             const listItem = document.createElement('li');
             listItem.className = "list-group-item list-group-item-action available-geocode-item";
             listItem.dataset.id = geoCodeId;
             listItem.dataset.code = geoCodeObject.customData.code;
             // Essayer de récupérer le libellé et l'universId depuis window.planData si possible
             const originalCodeData = window.planData?.availableGeoCodes?.find(c => c.id == geoCodeId) || window.planData?.placedGeoCodes?.find(c => c.geo_code_id == geoCodeId);
             listItem.dataset.libelle = originalCodeData?.libelle || '';
             listItem.dataset.universId = originalCodeData?.univers_id || '';
             listItem.style.cursor = 'grab';
             listItem.draggable = true;
             listItem.title = `${listItem.dataset.libelle}`;
             listItem.innerHTML = `<small>${geoCodeObject.customData.code}</small>`;
             availableList.appendChild(listItem);
             // TODO: Trier la liste alphabétiquement après ajout ? (Plus complexe)
         }
    } catch (error) {
         console.error(`Erreur API suppression position ${geoCodeObject.customData.code}:`, error);
         showToast(`Erreur suppression BDD (${geoCodeObject.customData.code}): ${error.message}`, 'danger');
    }
}

// Lancer l'initialisation
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEditor);
} else {
    initializeEditor();
}
