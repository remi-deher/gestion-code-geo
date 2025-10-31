// Fichier: public/js/plan-editor.js
// Fichier principal pour l'éditeur de plan, utilisant des imports dynamiques.

import { showToast, convertPixelsToPercent } from './modules/utils.js';
import { placeAssetById } from './modules/assetManager.js';
import { createGeoCodeObject, renderPlacedGeoCodes, GEO_CODE_FONT_SIZE } from './modules/geoCodeRenderer.js';

// Fonction d'initialisation asynchrone pour gérer les imports dynamiques
async function initializeEditor() {
    const loadingIndicator = document.getElementById('loading-indicator');
    const canvasWrapper = document.getElementById('canvas-wrapper'); // <-- Le conteneur principal
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
        const CanvasManager = (await import('./modules/canvasManager.js')).default;
        const { loadPlanBackgroundAndObjects } = await import('./modules/planLoader.js');
        const { createGeoCodeObject, renderPlacedGeoCodes } = await import('./modules/geoCodeRenderer.js');
        
        // --- MODIFICATION 1: Importer getCurrentAssetPlacementData ---
        const { getCurrentPlacementData, cancelPlacementMode, getCurrentAssetPlacementData } = await import('./ui/sidebar.js');
        
        const { setCanvasSizeFromFormat, updatePageGuideBorder } = await import('./modules/guideManager.js');

        // --- 2. Initialiser le Canvas Fabric ---
        console.log("Initialisation du Canvas...");
        const canvasManager = new CanvasManager(planCanvasElement, canvasWrapper);
        const canvas = canvasManager.initializeCanvas();

        // --- 3. Définir la taille du Canvas ---
        console.log("Définition de la taille du canvas...");
        if (window.planData && window.planData.currentPlan) {
            const initialFormat = window.planData.currentPlan.page_format || 'A4-P';
            setCanvasSizeFromFormat(initialFormat, canvas);
            canvasManager.resizeCanvas();
        } else {
             console.error("Données du plan non trouvées. Utilisation A4-P par défaut.");
             setCanvasSizeFromFormat('A4-P', canvas);
             canvasManager.resizeCanvas();
        }


        // --- 4. Charger le contenu du plan ---
        console.log("Chargement du contenu du plan...");
        if (window.planData && window.planData.currentPlan) {
            await loadPlanBackgroundAndObjects(canvas, window.planData.currentPlan);
            
            const drawingDataString = window.planData.currentPlan.drawing_data || '{}';
            let includesGeoCodes = false;
            try { includesGeoCodes = drawingDataString.includes('"type":"geoCode"'); } catch(e){}

            if (window.planData.placedGeoCodes && window.planData.placedGeoCodes.length > 0 && !includesGeoCodes) {
                 console.log(`Chargement séparé de ${window.planData.placedGeoCodes.length} codes géo placés...`);
                 renderPlacedGeoCodes(canvas, window.planData.placedGeoCodes, window.planData.universColors || {});
            }
        }

        // --- 5. Dessiner la bordure du guide ---
        updatePageGuideBorder(canvas);

        // --- 6. Configurer les modules UI et Actions ---
        console.log("Chargement Sidebar, Toolbar, Actions...");
        const { setupSidebar } = await import('./ui/sidebar.js');
        const { setupToolbar } = await import('./ui/toolbar.js');
        const { setupEditorActions } = await import('./modules/editorActions.js');

        await setupSidebar(canvas);
        setupToolbar(canvas);
        setupEditorActions(canvas, saveDrawingBtn, printBtn, exportBtn);

        // --- 7. Gérer le placement des codes Géo et Assets ---
        setupPlacement(canvas, canvasWrapper, createGeoCodeObject, getCurrentPlacementData, cancelPlacementMode, getCurrentAssetPlacementData);

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
 * @param {HTMLElement} canvasWrapper - Le conteneur principal (div#canvas-wrapper)
 * @param {function} geoCodeRendererFn - Fonction pour créer l'objet Fabric GeoCode (le groupe Rect+Texte par défaut).
 * @param {function} geoCodeGetterFn - Fonction pour obtenir les données du code géo à placer.
 * @param {function} geoCodeCancelFn - Fonction pour annuler le mode placement code géo.
 * @param {function} assetGetterFn - Fonction pour obtenir les données de l'asset à placer.
 */
function setupPlacement(canvas, canvasWrapper, geoCodeRendererFn, geoCodeGetterFn, geoCodeCancelFn, assetGetterFn) {

    // --- Placement par Clic (Code Géo UNIQUEMENT) ---
    canvas.on('mouse:down', (options) => {
        const placementData = geoCodeGetterFn(); // Vérifie si on est en mode placement CODE GEO
        const assetPlacementData = assetGetterFn(); // Vérifie si on est en mode placement ASSET

        // Si le mode placement d'asset est actif, on ne fait rien ici.
        // Il sera géré par son propre listener dans assetManager.js
        if (assetPlacementData) {
            console.log("[plan-editor.js mouse:down] Clic détecté, mais mode Asset actif. Ignoré.");
            return;
        }

        // Si le mode placement de code géo est actif (et pas Alt+Clic pour le pan)
        if (placementData && !options.e.altKey) {
            const pointer = canvas.getPointer(options.e);
            const target = options.target;

            // CAS 1: L'utilisateur a cliqué sur un objet texte (IText/Textbox)
            if (target && (target.type === 'i-text' || target.type === 'textbox')) {
                console.log("[plan-editor.js] Placement GeoCode DANS un objet IText.");
                
                target.set({
                    text: placementData.code,
                    // "Taguer" l'objet comme un geo-code
                    customData: {
                        type: 'geoCode',
                        geoCodeId: parseInt(placementData.id, 10),
                        code: placementData.code,
                        libelle: placementData.libelle,
                        universId: placementData.universId,
                        // Préserver l'ID de position s'il en avait déjà un
                        positionId: target.customData?.positionId || null 
                    }
                });
                
                saveGeoCodePosition(target); // Sauvegarde BDD
                geoCodeCancelFn(canvas); // Annule le mode placement
                canvas.setActiveObject(target); // Garder l'objet sélectionné
                canvas.requestRenderAll();

            // [NOUVEAU] CAS 2: Clic sur une FORME (Rect, Circle, Asset, etc.) - On GROUPE
            } else if (target && target.selectable && !target.isGuide && !target.isBackground && target.customData?.type !== 'geoCode') {
                // (On ne peut pas placer un code sur un fond, un guide, ou un code existant)
                console.log("[plan-editor.js] Placement GeoCode SUR une FORME. Création d'un groupe.");

                // 1. Créer le nouvel objet texte pour le code géo
                const newText = new fabric.Textbox(placementData.code, {
                    // Styles par défaut
                    fontSize: GEO_CODE_FONT_SIZE || 14, // Utilise la constante importée
                    fill: '#000000',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    width: target.width * 0.9, // 90% de la largeur de la forme
                    originX: 'center',
                    originY: 'center',
                    splitByGrapheme: true
                });

                // 2. Cloner la forme cible (pour la mettre dans le groupe)
                target.clone((clonedShape) => {
                    // Positionner les objets du groupe par rapport au centre (0,0) du groupe
                    clonedShape.set({ originX: 'center', originY: 'center', left: 0, top: 0 });
                    newText.set({ left: 0, top: 0 }); // Déjà centré

                    // 3. Créer le groupe
                    const newGroup = new fabric.Group([clonedShape, newText], {
                        left: target.left, // Positionner le groupe à l'emplacement de la forme d'origine
                        top: target.top,
                        originX: target.originX, // Garder l'origine de la forme d'origine
                        originY: target.originY,
                        // "Taguer" le groupe entier comme le code géo
                        customData: {
                            type: 'geoCode',
                            geoCodeId: parseInt(placementData.id, 10),
                            code: placementData.code,
                            libelle: placementData.libelle,
                            universId: placementData.universId,
                            positionId: null // C'est un NOUVEAU placement
                        }
                    });

                    // 4. Remplacer l'ancienne forme par le nouveau groupe
                    canvas.remove(target);
                    canvas.add(newGroup);
                    
                    // 5. Sauvegarder, annuler le mode, et sélectionner
                    saveGeoCodePosition(newGroup);
                    geoCodeCancelFn(canvas);
                    canvas.setActiveObject(newGroup);
                    canvas.requestRenderAll();
                });

            // CAS 3: L'utilisateur a cliqué sur un espace vide (Comportement original)
            } else if (!target) {
                console.log("[plan-editor.js mouse:down] Placement Code Géo sur espace vide.");
                // Crée l'objet geo-code (Groupe Rect+Texte par défaut)
                const geoCodeObject = geoCodeRendererFn(placementData, pointer.x, pointer.y, window.planData?.universColors || {});
                
                canvas.add(geoCodeObject); 
                canvas.setActiveObject(geoCodeObject); 
                canvas.requestRenderAll();
                saveGeoCodePosition(geoCodeObject); // Sauvegarde BDD
                geoCodeCancelFn(canvas); // Annule le mode placement
            
            // CAS 4: Clic sur un objet non-gérable (guide, ou un geoCode existant)
            } else if (target) {
                 console.log("[plan-editor.js] Clic sur un objet non-modifiable (guide ou geo-code existant), annulation placement.");
                 geoCodeCancelFn(canvas);
                 // Le clic sélectionnera l'objet (comportement normal)
            }
        }
    });

    // --- Gestion du Drag and Drop (Code Géo ET Asset) ---
    // (Cette partie reste inchangée)
    
    canvasWrapper.addEventListener('dragover', (e) => {
        console.log("[Drag Over] Événement dragover détecté.");
        e.preventDefault();
        if (e.dataTransfer.types.includes('text/plain')) {
            console.log("[Drag Over] Type 'text/plain' détecté.");
            e.dataTransfer.dropEffect = 'copy';
            canvasWrapper.classList.add('drop-target-active');
        } else { e.dataTransfer.dropEffect = 'none'; }
    });

    canvasWrapper.addEventListener('dragleave', (e) => {
        if (!canvasWrapper.contains(e.relatedTarget)) {
            console.log("[Drag Leave] Sortie de la zone wrapper.");
            canvasWrapper.classList.remove('drop-target-active');
        }
    });

    canvasWrapper.addEventListener('drop', async (e) => {
        console.log("[Drop Event] Drop détecté.");
        e.preventDefault();
        canvasWrapper.classList.remove('drop-target-active');
        document.body.classList.remove('dragging-geocode');
        document.body.classList.remove('dragging-asset');
        try {
            const dataString = e.dataTransfer.getData('text/plain');
            console.log("[Drop Event] dataString:", dataString);
            const placementData = JSON.parse(dataString);
            console.log("[Drop Event] placementData:", placementData);

            const pointer = canvas.getPointer(e, true);

            if (placementData && placementData.id && placementData.code) {
                console.log("Drop: Détection Code Géo", placementData);
                const geoCodeObject = geoCodeRendererFn(placementData, pointer.x, pointer.y, window.planData?.universColors || {});
                canvas.add(geoCodeObject); canvas.setActiveObject(geoCodeObject); canvas.requestRenderAll();
                saveGeoCodePosition(geoCodeObject);
                
            } else if (placementData && placementData.id && placementData.name) {
                console.log("Drop: Détection Asset", placementData);
                await placeAssetById(placementData.id, pointer.x, pointer.y, canvas);
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
        if (e.target?.customData?.type === 'geoCode') {
            saveGeoCodePosition(e.target);
        }
    });
    canvas.on('object:removed', (e) => {
        if (e.target?.customData?.type === 'geoCode') {
            removeGeoCodePosition(e.target);
        }
    });
    console.log("Position Saving (GeoCode): Écouteurs Modifié/Supprimé configurés.");
}

/**
 * Envoie la position d'un objet GeoCode à l'API pour sauvegarde (ajout ou mise à jour).
 * @param {fabric.Object} geoCodeObject - L'objet Fabric représentant le code géo.
 */
async function saveGeoCodePosition(geoCodeObject) {
     if (geoCodeObject?.customData?.type !== 'geoCode') return;
    const canvas = geoCodeObject.canvas;
    const planId = window.planData?.currentPlan?.id;
    const apiUrl = window.planData?.placeGeoCodeUrl;
    const geoCodeId = geoCodeObject.customData.geoCodeId;
    
    // MODIFICATION: Récupérer l'ID de position unique (s'il existe) pour différencier INSERT et UPDATE
    const positionId = geoCodeObject.customData.positionId || null; 

    if (!canvas || !planId || !apiUrl || !geoCodeId) {
        showToast("Erreur interne : sauvegarde position impossible.", "danger"); return;
    }
    const centerPoint = geoCodeObject.getCenterPoint();
    const { posX, posY } = convertPixelsToPercent(centerPoint.x, centerPoint.y, canvas);
     if (isNaN(posX) || isNaN(posY)) {
        showToast("Erreur calcul position %, sauvegarde annulée.", "warning"); return;
    }
    
    // MODIFICATION: Ajouter position_id au payload
    const payload = { 
        plan_id: planId, 
        geo_code_id: geoCodeId, 
        pos_x: posX.toFixed(4), 
        pos_y: posY.toFixed(4),
        position_id: positionId // Sera null si nouveau, ou un ID si déplacement
    };

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
        
        // S'assurer que l'objet sur le canvas a maintenant son ID de position unique
        if (result.position_id) geoCodeObject.customData.positionId = result.position_id;
         
         // MODIFICATION: On ne retire plus l'item de la liste
         // const listItem = document.querySelector(`#available-geocodes-list .available-geocode-item[data-id="${geoCodeId}"]`);
         // if(listItem && positionId === null) { // Ne retirer que si c'était un NOUVEAU placement
         //     listItem.remove();
         // }

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
     if (geoCodeObject?.customData?.type !== 'geoCode') return;
    const planId = window.planData?.currentPlan?.id;
    const apiUrl = window.planData?.removeGeoCodeUrl;
    const geoCodeId = geoCodeObject.customData.geoCodeId;
    const positionId = geoCodeObject.customData.positionId;

    if (!planId || !apiUrl || !geoCodeId) { return; }
    
    // MODIFICATION: On a besoin du positionId pour savoir QUEL repère supprimer
    if (!positionId) {
        console.warn("Tentative de suppression d'un GeoCode sans positionId. Suppression BDD annulée.", geoCodeObject.customData);
        // On laisse la suppression du canvas se faire, mais on n'appelle pas l'API
        return;
    }

    console.log(`Suppression Position GeoCode: Envoi pour positionId=${positionId} (geoCodeId=${geoCodeId}, planId=${planId})`);
    try {
         // MODIFICATION: Envoyer l'ID de position unique pour supprimer la bonne instance
         const payload = { plan_id: planId, geo_code_id: geoCodeId, position_id: positionId };
         const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify(payload) });
         if (!response.ok) {
             let errorMsg = `Erreur HTTP ${response.status}`;
             try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch(e){}
             throw new Error(errorMsg);
         }
         const result = await response.json(); if (!result.success) throw new Error(result.error || "Erreur API.");
         console.log(`Suppression Position BDD: Succès pour ${geoCodeObject.customData.code}.`);
         showToast(`'${geoCodeObject.customData.code}' retiré du plan.`, 'info');

         const availableList = document.getElementById('available-geocodes-list');
         const existingItem = availableList?.querySelector(`.available-geocode-item[data-id="${geoCodeId}"]`);
         if (availableList && !existingItem) {
             const listItem = document.createElement('li');
             listItem.className = "list-group-item list-group-item-action available-geocode-item";
             listItem.dataset.id = geoCodeId;
             listItem.dataset.code = geoCodeObject.customData.code;
             const originalCodeData = window.planData?.availableGeoCodes?.find(c => c.id == geoCodeId) || window.planData?.placedGeoCodes?.find(c => c.geo_code_id == geoCodeId);
             listItem.dataset.libelle = originalCodeData?.libelle || '';
             listItem.dataset.universId = originalCodeData?.univers_id || '';
             listItem.style.cursor = 'grab';
             listItem.draggable = true;
             listItem.title = `${listItem.dataset.libelle}`;
             listItem.innerHTML = `<small>${geoCodeObject.customData.code}</small>`;
             availableList.appendChild(listItem);
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
