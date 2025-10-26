// Fichier: public/js/plan-editor.js
// Fichier principal pour l'éditeur de plan, utilisant des imports dynamiques.

// Importer les fonctions utilitaires nécessaires statiquement car elles sont utilisées tôt
import { showToast, convertPixelsToPercent } from './modules/utils.js';

// Fonction d'initialisation asynchrone pour gérer les imports dynamiques
async function initializeEditor() {
    const loadingIndicator = document.getElementById('loading-indicator');
    const canvasWrapper = document.getElementById('canvas-wrapper');
    const planCanvasElement = document.getElementById('plan-canvas');
    const saveDrawingBtn = document.getElementById('save-drawing-btn');
    const printBtn = document.getElementById('print-plan-btn');
    const exportBtn = document.getElementById('export-plan-btn');
    // Ajoutez ici les sélecteurs pour les autres boutons (sidebar toggle) si nécessaire
    // const sidebarToggleBtn = document.querySelector('[data-bs-target="#sidebarOffcanvas"]');

    if (!canvasWrapper || !planCanvasElement || !loadingIndicator || !saveDrawingBtn || !printBtn || !exportBtn) {
        console.error("Éléments DOM essentiels manquants pour l'éditeur.");
        alert("Erreur critique : Impossible d'initialiser l'interface de l'éditeur.");
        return;
    }

    loadingIndicator.style.display = 'block'; // Afficher le chargement

    try {
        // --- 1. Importer dynamiquement le gestionnaire de Canvas ---
        console.log("Chargement du CanvasManager...");
        const { default: CanvasManager } = await import('./modules/canvasManager.js');

        // --- 2. Initialiser le Canvas ---
        console.log("Initialisation du Canvas...");
        const canvasManager = new CanvasManager(planCanvasElement, canvasWrapper);
        const canvas = canvasManager.initializeCanvas(); // Récupérer l'instance du canvas

        // --- 3. Importer dynamiquement le chargeur de plan ---
        console.log("Chargement du PlanLoader...");
        const { loadPlanBackgroundAndObjects } = await import('./modules/planLoader.js');

        // --- 4. Importer GeoCode Renderer & Sidebar functions ---
        console.log("Chargement GeoCodeRenderer & Sidebar Utils...");
        const { createGeoCodeObject, renderPlacedGeoCodes } = await import('./modules/geoCodeRenderer.js');
        const { getCurrentPlacementData, cancelPlacementMode } = await import('./ui/sidebar.js');

        // --- 5. Charger le plan (fond + objets existants) ---
        console.log("Chargement des données du plan...");
        if (window.planData && window.planData.currentPlan) {
            await loadPlanBackgroundAndObjects(canvas, window.planData.currentPlan);

            // Charger les codes Géo déjà placés
             if (window.planData.placedGeoCodes && window.planData.placedGeoCodes.length > 0) {
                 console.log(`Chargement de ${window.planData.placedGeoCodes.length} codes géo placés...`);
                 // Appel de la fonction importée
                 renderPlacedGeoCodes(canvas, window.planData.placedGeoCodes, window.planData.universColors || {}); // Passer les couleurs
             }

        } else {
            console.error("Données du plan (window.planData.currentPlan) non trouvées.");
            throw new Error("Impossible de charger les informations du plan.");
        }

        // --- 6. Importer dynamiquement et configurer la Sidebar ---
        console.log("Chargement de la Sidebar...");
        const { setupSidebar } = await import('./ui/sidebar.js');
        setupSidebar(canvas); // Passe le canvas

        // --- 7. Importer dynamiquement et configurer la Toolbar ---
        console.log("Chargement de la Toolbar...");
        const { setupToolbar } = await import('./ui/toolbar.js');
        setupToolbar(canvas); // Passe le canvas

        // --- 8. Importer dynamiquement et configurer les actions (Sauvegarde, Export, etc.) ---
        console.log("Chargement des Actions...");
        const { setupEditorActions } = await import('./modules/editorActions.js');
        setupEditorActions(canvas, saveDrawingBtn, printBtn, exportBtn);

        // --- 9. Gérer le placement des codes Géo (Clic & Drop) ---
        setupGeoCodePlacement(canvas, createGeoCodeObject, getCurrentPlacementData, cancelPlacementMode);

        // --- 10. Gérer la sauvegarde/suppression des positions des codes Géo ---
        setupPositionSaving(canvas);


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
        const placementData = getterFn(); // Récupère les données depuis sidebar.js
        if (placementData && !options.target) { // Si en mode placement et clic sur zone vide
            const pointer = canvas.getPointer(options.e);
            console.log("Placement (Clic):", placementData, "à", pointer);

            // Créer l'objet Fabric
            const geoCodeObject = rendererFn(placementData, pointer.x, pointer.y, window.planData.universColors || {});
            canvas.add(geoCodeObject);
            canvas.setActiveObject(geoCodeObject); // Sélectionner le nouvel objet
            canvas.requestRenderAll();

            // Sauvegarder la position initiale
            saveGeoCodePosition(geoCodeObject);

            // Quitter le mode placement
            cancelFn(canvas);
        }
        // L'annulation du placement si clic sur objet existant est gérée dans sidebar.js
    });

    // --- Gestion du Drag and Drop ---
    const canvasWrapper = canvas.wrapperEl; // Utiliser le conteneur du canvas

    // Empêcher le comportement par défaut pour permettre le drop
    canvasWrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        // Vérifier si des données du type attendu sont glissées
        if (e.dataTransfer.types.includes('text/plain')) {
            e.dataTransfer.dropEffect = 'copy';
            canvasWrapper.classList.add('drop-target-active'); // Feedback visuel
        } else {
            e.dataTransfer.dropEffect = 'none';
        }
    });

    canvasWrapper.addEventListener('dragleave', (e) => {
         // Vérifier si on quitte vraiment la zone (pas juste sur un enfant)
         if (e.relatedTarget === null || !canvasWrapper.contains(e.relatedTarget)) {
             canvasWrapper.classList.remove('drop-target-active');
         }
    });

    canvasWrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        canvasWrapper.classList.remove('drop-target-active');
        document.body.classList.remove('dragging-geocode'); // Nettoyer style global

        try {
            const dataString = e.dataTransfer.getData('text/plain');
            const placementData = JSON.parse(dataString);

            if (placementData && placementData.id && placementData.code) {
                 // Obtenir les coordonnées relatives au canvas
                const pointer = canvas.getPointer(e); // Utilise l'événement 'drop'
                console.log("Placement (Drop):", placementData, "à", pointer);

                // Créer l'objet Fabric
                const geoCodeObject = rendererFn(placementData, pointer.x, pointer.y, window.planData.universColors || {});
                canvas.add(geoCodeObject);
                canvas.setActiveObject(geoCodeObject);
                canvas.requestRenderAll();

                // Sauvegarder la position initiale
                saveGeoCodePosition(geoCodeObject);

                // Optionnel: quitter le mode placement s'il était actif par clic
                cancelFn(canvas);

            } else {
                 console.warn("Drop: Données invalides reçues.", dataString);
                 showToast("Impossible de placer cet élément (données invalides).", "warning");
            }
        } catch (error) {
            console.error("Erreur lors du drop:", error);
            showToast("Erreur lors du placement par glisser-déposer.", "danger");
        }
    });

     console.log("Placement GeoCode: Écouteurs Clic et Drop configurés.");
}

/**
 * Configure les écouteurs pour sauvegarder ou supprimer la position d'un code géo.
 * @param {fabric.Canvas} canvas
 */
function setupPositionSaving(canvas) {
    // Sauvegarder après déplacement/redimensionnement
    canvas.on('object:modified', (e) => {
        if (e.target && e.target.customData && e.target.customData.type === 'geoCode') {
            console.log("Position Saving: Objet GeoCode modifié:", e.target.customData.code);
            saveGeoCodePosition(e.target);
        }
        // TODO: Déclencher ici la sauvegarde générale du dessin (pour les objets non-geocode)
        // en appelant la fonction liée au bouton save-drawing-btn ?
        // Ou marquer le plan comme "modifié" pour que l'utilisateur clique sur Enregistrer.
    });

    // Supprimer la position lors de la suppression de l'objet via la touche Suppr ou le bouton
    // Note: L'événement 'object:removed' est déclenché APRES la suppression effective.
    canvas.on('object:removed', (e) => {
         if (e.target && e.target.customData && e.target.customData.type === 'geoCode') {
            console.log("Position Saving: Objet GeoCode supprimé du canvas:", e.target.customData.code);
            removeGeoCodePosition(e.target); // Appel API pour supprimer en BDD
        }
        // TODO: Déclencher la sauvegarde générale du dessin ici aussi ?
    });

     console.log("Position Saving: Écouteurs Modifié/Supprimé configurés.");
}

/**
 * Envoie la position d'un objet GeoCode à l'API pour sauvegarde (ajout ou mise à jour).
 * @param {fabric.Object} geoCodeObject - L'objet Fabric représentant le code géo.
 */
async function saveGeoCodePosition(geoCodeObject) {
    if (!geoCodeObject || !geoCodeObject.customData || geoCodeObject.customData.type !== 'geoCode') {
        return;
    }

    const canvas = geoCodeObject.canvas;
    const planId = window.planData?.currentPlan?.id;
    const apiUrl = window.planData?.placeGeoCodeUrl;
    const geoCodeId = geoCodeObject.customData.geoCodeId;

    if (!canvas || !planId || !apiUrl || !geoCodeId) {
        console.error("Sauvegarde Position: Données manquantes (canvas, planId, apiUrl, geoCodeId).");
        showToast("Erreur interne : impossible de sauvegarder la position.", "danger");
        return;
    }

    // Obtenir les coordonnées du CENTRE de l'objet
    const centerPoint = geoCodeObject.getCenterPoint();
    // Convertir en pourcentage
    const { posX, posY } = convertPixelsToPercent(centerPoint.x, centerPoint.y, canvas);

     if (isNaN(posX) || isNaN(posY)) {
        console.error(`Sauvegarde Position: Conversion en pourcentage échouée pour ${geoCodeObject.customData.code}`);
        showToast("Erreur de calcul de position, sauvegarde annulée.", "warning");
        return;
    }

    const payload = {
        plan_id: planId,
        geo_code_id: geoCodeId,
        pos_x: posX.toFixed(4), // Envoyer avec une précision raisonnable
        pos_y: posY.toFixed(4),
        // TODO: Ajouter width/height si géré (convertis en % de la taille du plan ?)
        // width: (geoCodeObject.getScaledWidth() / (window.originalPlanWidth || canvas.width)) * 100,
        // height: (geoCodeObject.getScaledHeight() / (window.originalPlanHeight || canvas.height)) * 100,
        // properties: {} // Ajouter ici des propriétés de style si nécessaire
    };

    console.log(`Sauvegarde Position: Envoi pour ${geoCodeObject.customData.code}`, payload);
    // Optionnel : Afficher un indicateur de sauvegarde en cours

    try {
        const response = await fetch(apiUrl, {
             method: 'POST',
             headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                // 'X-CSRF-Token': window.planData?.csrfToken || ''
             },
             body: JSON.stringify(payload)
         });

        if (!response.ok) {
            let errorMsg = `Erreur HTTP ${response.status}`;
            try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) {}
            throw new Error(errorMsg);
        }
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || "Erreur retournée par l'API.");
        }

        console.log(`Sauvegarde Position: Succès pour ${geoCodeObject.customData.code}. ID Position BDD: ${result.position_id}`);
        // Mettre à jour l'ID de la position dans l'objet Fabric
        if (result.position_id) {
             geoCodeObject.customData.positionId = result.position_id;
        }
        // showToast(`Position de ${geoCodeObject.customData.code} enregistrée.`, 'success'); // Peut-être trop verbeux

    } catch (error) {
        console.error(`Erreur API lors de la sauvegarde de position pour ${geoCodeObject.customData.code}:`, error);
        showToast(`Erreur sauvegarde position (${geoCodeObject.customData.code}): ${error.message}`, 'danger');
    } finally {
        // Masquer l'indicateur de sauvegarde
    }
}

/**
 * Appelle l'API pour supprimer la position d'un code géo de ce plan.
 * @param {fabric.Object} geoCodeObject - L'objet Fabric qui vient d'être supprimé du canvas.
 */
async function removeGeoCodePosition(geoCodeObject) {
     if (!geoCodeObject || !geoCodeObject.customData || geoCodeObject.customData.type !== 'geoCode') {
        return;
    }
    const planId = window.planData?.currentPlan?.id;
    const apiUrl = window.planData?.removeGeoCodeUrl;
    const geoCodeId = geoCodeObject.customData.geoCodeId;

     if (!planId || !apiUrl || !geoCodeId) {
        console.error("Suppression Position: Données manquantes (planId, apiUrl, geoCodeId).");
        return;
    }
    console.log(`Suppression Position: Envoi pour geoCodeId=${geoCodeId}, planId=${planId}`);
    try {
         const response = await fetch(apiUrl, {
             method: 'POST', // ou 'DELETE'
             headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                // 'X-CSRF-Token': window.planData?.csrfToken || ''
             },
             body: JSON.stringify({ plan_id: planId, geo_code_id: geoCodeId })
         });

         if (!response.ok) {
             let errorMsg = `Erreur HTTP ${response.status}`;
             try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch(e) {}
             throw new Error(errorMsg);
         }
         const result = await response.json();
         if (!result.success) {
             throw new Error(result.error || "Erreur API.");
         }
         console.log(`Suppression Position: Succès pour ${geoCodeObject.customData.code}.`);
         showToast(`'${geoCodeObject.customData.code}' retiré du plan.`, 'info');

         // --- Remettre le code dans la liste des codes disponibles ---
         const availableList = document.getElementById('available-geocodes-list');
         const existingItem = availableList.querySelector(`[data-id="${geoCodeId}"]`);
         if (availableList && !existingItem) { // Vérifier s'il n'y est pas déjà
            // Recréer l'élément de liste
            const listItem = document.createElement('li');
            listItem.className = "list-group-item list-group-item-action available-geocode-item";
            listItem.dataset.id = geoCodeId;
            listItem.dataset.code = geoCodeObject.customData.code;
            listItem.dataset.libelle = geoCodeObject.customData.libelle;
            listItem.dataset.universId = geoCodeObject.customData.universId;
            listItem.style.cursor = 'grab';
            listItem.draggable = true;
            listItem.title = `${geoCodeObject.customData.libelle} (${geoCodeObject.customData.universNom || '?'})`; // Ajouter le nom de l'univers si possible
            listItem.innerHTML = `<small>${geoCodeObject.customData.code}</small>`;
            // Insérer en gardant l'ordre alphabétique ? (plus complexe) ou juste à la fin/début
            availableList.appendChild(listItem); // Ajoute à la fin
            // Trier la liste après ajout ?
         }


    } catch (error) {
         console.error(`Erreur API lors de la suppression de position pour ${geoCodeObject.customData.code}:`, error);
         showToast(`Erreur: La suppression de la position de ${geoCodeObject.customData.code} en base de données a échoué. ${error.message}`, 'danger');
         // Remettre l'objet sur le canvas ? Peut être perturbant.
    }
}


// Lancer l'initialisation une fois le DOM prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEditor);
} else {
    initializeEditor();
}
