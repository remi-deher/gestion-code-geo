/**
 * Point d'entrée principal pour l'éditeur de plan (plan_view.php et plan_create_svg_view.php).
 * Initialise tous les modules nécessaires et gère l'état global.
 * VERSION MISE A JOUR AVEC TOUTES LES NOUVELLES FONCTIONNALITES
 * CORRECTION: Ajout d'une vérification pour activeObject dans handleSelectionChange.
 */
import { initializeCanvas, getCanvasInstance, loadBackgroundImage, loadSvgPlan, resizeCanvas, handleMouseWheel, startPan, handlePanMove, stopPan, snapObjectToGrid, getIsSnapEnabled, toggleGrid, toggleSnap, drawGrid, removeGrid, snapToGrid, updateStrokesWidth, resetZoom as resetCanvasZoom, zoom as zoomCanvas } from './canvas.js';
import { initializeSidebar, fetchAndRenderAvailableCodes, updateCodeCountInSidebar, clearSidebarSelection } from './sidebar.js';
import { initializeGeoTags, createFabricTag, handleGeoTagModified, showToolbar, hideToolbar, getIsDrawingArrowMode, handleArrowEndPoint, cancelArrowDrawing, redrawAllTagsHighlight, addArrowToTag } from './geo-tags.js'; // Assurer import complet
import { initializeDrawingTools, setActiveTool, getCurrentDrawingTool, startDrawing, continueDrawing, stopDrawing, getIsDrawing, groupSelectedObjects, ungroupSelectedObject, copyShape, pasteShape, deleteSelectedShape } from './drawing-tools.js'; // Importer les nouvelles fonctions
import { initializeUI } from './ui.js';
import { savePosition, saveDrawingData, createSvgPlan, updateSvgPlan, saveAsset, listAssets, getAssetData } from '../modules/api.js'; // Importer les nouvelles fonctions API
import { convertPixelsToPercent, showToast } from '../modules/utils.js'; // Importer les utilitaires
import { sizePresets } from '../modules/config.js'; // Importer sizePresets depuis config.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Plan Editor - DOMContentLoaded");

    // --- Récupération des données initiales depuis le JSON embarqué ---
    const planDataElement = document.getElementById('plan-data');
    if (!planDataElement) {
        console.error("Élément #plan-data non trouvé.");
        showToast("Erreur critique : Données de configuration manquantes.", "danger");
        return;
    }
    const planData = JSON.parse(planDataElement.textContent);
    console.log("Données initiales récupérées:", planData);

    window.planData = planData; // Pour accès facile depuis la console si besoin

    const {
        planType,
        currentPlanId,
        currentPlan,
        universColors,
        planUnivers,
        placedGeoCodes,
        initialDrawingData
    } = planData;

    if (!planType || planType === 'unknown') {
         console.error("Type de plan invalide ou manquant.");
         showToast("Erreur critique : Type de plan non défini.", "danger");
         return;
    }

    // --- Initialisation du Canvas ---
    const canvasEl = document.getElementById('plan-canvas');
    if (!canvasEl) {
        console.error("Canvas element #plan-canvas not found!");
        showToast("Erreur critique : Élément canvas manquant.", "danger");
        return;
    }
    // Passe le type de plan à l'initialisation du canvas
    const fabricCanvas = initializeCanvas(canvasEl, planType);
    if (!fabricCanvas) {
         console.error("Échec initialisation canvas Fabric.");
         showToast("Erreur critique : Impossible d'initialiser la zone d'édition.", "danger");
         return;
    }

    // --- Initialisation des Modules ---
    if (planType !== 'svg_creation') {
        initializeSidebar(currentPlanId, planUnivers, universColors, handleCodeSelectedForPlacement);
        initializeGeoTags(fabricCanvas, universColors);
    }
    initializeDrawingTools(fabricCanvas); // Initialise les outils (y compris groupe/texte)
    initializeUI(); // Gère fullscreen, zoom buttons, sidebar toggle

    // --- Ajout des nouveaux éléments UI ---
    // Doit être déclaré avant le bloc try/catch qui utilise pageFormatSelect
    const pageFormatSelect = document.getElementById('page-format-select');
    const saveAssetBtn = document.getElementById('save-asset-btn');
    const assetsListEl = document.getElementById('assets-list');
    const assetsOffcanvasEl = document.getElementById('assetsOffcanvas');
    let pageGuideRect = null; // Référence au guide visuel de page
    const strokeColorInput = document.getElementById('stroke-color'); // Nécessaire pour l'outil texte
    let isGridVisible = document.getElementById('grid-toggle')?.checked || false; // Suivi de l'état de la grille

    // --- Chargement du contenu du plan ---
    const loader = document.getElementById('plan-loader');
    if(loader) loader.style.display = 'block';

    try {
        if (planType === 'svg_creation') {
            console.log("Mode création SVG vierge.");
            // Canvas prêt
        } else if (planType === 'svg' && currentPlan?.nom_fichier) {
            console.log("Chargement du plan SVG...");
            await loadSvgPlan(`uploads/plans/${currentPlan.nom_fichier}`);
             console.log("Plan SVG chargé.");
        } else if (planType === 'image' && currentPlan?.nom_fichier) {
            console.log("Chargement de l'image de fond...");
            const mapImageEl = document.getElementById('map-image');
            await loadBackgroundImage(mapImageEl);
             console.log("Image de fond chargée.");
            if (initialDrawingData) {
                 console.log("Chargement des annotations JSON...");
                await loadJsonAnnotations(initialDrawingData);
                 console.log("Annotations JSON chargées.");
            }
        } else if (planType === 'image' || planType === 'svg') {
             throw new Error("Nom de fichier du plan manquant.");
        }

        // Créer les tags géo APRES avoir chargé le fond
        if (planType !== 'svg_creation' && placedGeoCodes) {
            createInitialGeoTagsFromData(placedGeoCodes);
        }

        // Ajuster la vue initiale
        resizeCanvas(); // Adapte canvas et fond/SVG
        
        // NOUVEAU: Afficher le guide de page initial
        if (pageFormatSelect) updatePageGuide(); 

    } catch (error) { 
        console.error("Erreur lors du chargement du plan:", error);
        showToast(`Erreur chargement plan: ${error.message}`, 'danger');
        const planContainer = document.getElementById('plan-container');
        if(planContainer) planContainer.innerHTML = `<p class="text-danger p-3">Impossible de charger le plan : ${error.message}</p>`;
    } finally {
        if(loader) loader.style.display = 'none';
    }

    // --- Gestion des Événements Canvas Globaux ---
    fabricCanvas.on({
        'mouse:down': handleCanvasMouseDown,
        'mouse:move': handleCanvasMouseMove,
        'mouse:up': handleCanvasMouseUp,
        'mouse:out': handleCanvasMouseOut,
        'mouse:dblclick': handleDoubleClick, // NOUVEAU
        'object:moving': handleObjectMoving,
        'object:modified': handleObjectModified,
        'selection:created': handleSelectionChange,
        'selection:updated': handleSelectionChange,
        'selection:cleared': handleSelectionCleared,
        'before:transform': restrictTagTransform,
        'viewport:transformed': handleViewportTransform // Met à jour grille/traits/guide
    });

    // --- Écouteurs pour les nouvelles fonctionnalités UI ---
    if (pageFormatSelect) pageFormatSelect.addEventListener('change', updatePageGuide);
    if (saveAssetBtn) saveAssetBtn.addEventListener('click', saveSelectionAsAsset);
    if (assetsOffcanvasEl) assetsOffcanvasEl.addEventListener('show.bs.offcanvas', loadAssetsList);
    if (assetsListEl) assetsListEl.addEventListener('click', handleAssetClick);
    document.addEventListener('keydown', handleKeyDown); // Pour Echap, Suppr, Copier/Coller
    
    // Listeners pour grille/snap (déplacés de ui.js si gèrent l'état)
    const gridToggle = document.getElementById('grid-toggle');
    const snapToggle = document.getElementById('snap-toggle');
    if (gridToggle) {
        gridToggle.addEventListener('change', () => {
            isGridVisible = gridToggle.checked;
            toggleGrid(isGridVisible);
        });
        isGridVisible = gridToggle.checked; // État initial
        toggleGrid(isGridVisible); // Afficher au début si coché
    }
    if (snapToggle) {
        snapToggle.addEventListener('change', () => toggleSnap(snapToggle.checked));
        toggleSnap(snapToggle.checked); // État initial
    }


    // --- Variables d'état local (inchangées) ---
    let isPlacementMode = false;
    let codeToPlace = null;
    let placementModeActiveItem = null;
    let highlightedCodeGeo = null; // Suivi du code surligné

    // --- Fonctions de Gestion d'État et d'Interaction (Mises à jour et Nouvelles) ---

    /** Callback pour quand un code est sélectionné dans la sidebar */
    function handleCodeSelectedForPlacement(codeData) {
        cancelDrawingModes(); // Annule dessin forme/flèche/texte
        setActiveTool('select');

        isPlacementMode = true;
        codeToPlace = codeData;

        const planContainer = document.getElementById('plan-container');
        if(planContainer) planContainer.classList.add('placement-mode');
        fabricCanvas.defaultCursor = 'crosshair';
        fabricCanvas.setCursor('crosshair');
        fabricCanvas.discardActiveObject().renderAll();
        hideToolbar();

        placementModeActiveItem = document.querySelector(`#unplaced-list .unplaced-item[data-id="${codeData.id}"]`);
    }

    /** Annule le mode placement de tag */
    function cancelPlacementMode() {
        if (!isPlacementMode) return;
        console.log("Annulation mode placement.");
        isPlacementMode = false;
        codeToPlace = null;
        const planContainer = document.getElementById('plan-container');
        if(planContainer) planContainer.classList.remove('placement-mode');
        const currentTool = getCurrentDrawingTool();
        fabricCanvas.defaultCursor = (currentTool === 'select') ? 'default' : 'crosshair';
        fabricCanvas.setCursor(fabricCanvas.defaultCursor);
        if (placementModeActiveItem) {
            placementModeActiveItem.classList.remove('active');
            placementModeActiveItem = null;
        }
        clearSidebarSelection();
    }

    /** Place un nouveau tag géo sur le canvas après un clic */
     async function placeNewTagOnClick(clickEvent) {
        if (!isPlacementMode || !codeToPlace) return;
        console.log("Placement tag:", codeToPlace.codeGeo);

        const pointer = fabricCanvas.getPointer(clickEvent);
        const { posX, posY } = convertPixelsToPercent(pointer.x, pointer.y, fabricCanvas);

        if (isNaN(posX) || isNaN(posY)) {
            console.error("placeNewTag - Coordonnées invalides (NaN).");
            showToast("Erreur calcul position.", "danger");
            cancelPlacementMode();
            return;
        }

        const newPositionData = {
            id: parseInt(codeToPlace.id, 10),
            plan_id: currentPlanId,
            pos_x: posX,
            pos_y: posY,
            width: sizePresets.medium.width,  // Utiliser la config
            height: sizePresets.medium.height,
            anchor_x: null,
            anchor_y: null
        };

        try {
            const savedData = await savePosition(newPositionData);
            console.log("Position sauvegardée:", savedData);

            const fullCodeData = {
                ...codeToPlace,
                position_id: savedData.position_id,
                plan_id: savedData.plan_id,
                pos_x: savedData.pos_x,
                pos_y: savedData.pos_y,
                width: savedData.width,
                height: savedData.height,
                anchor_x: savedData.anchor_x,
                anchor_y: savedData.anchor_y
            };

            const newTag = createFabricTag(fullCodeData);
            if (newTag) {
                console.log("Tag Fabric créé:", newTag);
                fabricCanvas.setActiveObject(newTag).renderAll();
                showToolbar(newTag);
            } else {
                 console.error("Échec création objet Fabric après sauvegarde API.");
                 showToast("Erreur affichage tag.", "warning");
            }
            updateCodeCountInSidebar(codeToPlace.id, 1);

            // Mettre à jour planData.placedGeoCodes localement si nécessaire
            if(planData.placedGeoCodes) {
                 const existingCodeIndex = planData.placedGeoCodes.findIndex(c => c.id == fullCodeData.id); // Correction: utiliser == ou ===
                 if (existingCodeIndex > -1) {
                     if (!planData.placedGeoCodes[existingCodeIndex].placements) {
                         planData.placedGeoCodes[existingCodeIndex].placements = [];
                     }
                     planData.placedGeoCodes[existingCodeIndex].placements.push(savedData);
                 } else {
                     console.warn("Code géo placé non trouvé dans planData.placedGeoCodes:", fullCodeData.id);
                 }
            }

        } catch (error) {
            console.error("Échec placement tag:", error);
            showToast(`Erreur placement: ${error.message}`, "danger");
        } finally {
            cancelPlacementMode();
        }
    }


    // --- Gestionnaires d'événements Canvas (Mises à jour) ---

    function handleCanvasMouseDown(opt) {
        const { e: evt, target, pointer } = opt;
        if (!pointer) return;

        // Clic droit ou molette ou Alt+Clic -> Panning
        if (evt.altKey || evt.button === 1 || evt.button === 2) {
            startPan(opt);
            return;
        }

        // Clic gauche
        const currentTool = getCurrentDrawingTool();
        if (target && !target.isGridLine && !target.isPageGuide) { // Clic sur un objet
             console.log("Clic sur objet:", target.type);
            if (getIsDrawingArrowMode() && target.customData?.isGeoTag) {
                handleArrowEndPoint(opt);
            } else if (currentTool !== 'select') {
                cancelDrawingModes(); // Annule dessin si on clique sur un objet
            }
            // La sélection est gérée par Fabric et handleSelectionChange
        } else { // Clic sur le fond
             console.log("Clic sur fond canvas.");
            // Ne pas désélectionner si on double-clique pour éditer du texte
            if (opt.e.detail !== 2) { 
                fabricCanvas.discardActiveObject().renderAll();
                hideToolbar();
            }

            if (isPlacementMode) {
                placeNewTagOnClick(evt);
            } else if (getIsDrawingArrowMode()) {
                handleArrowEndPoint(opt);
            } else if (currentTool === 'text') { // NOUVEAU: Outil Texte
                 const textObj = new fabric.IText('Texte ici', {
                     left: pointer.x,
                     top: pointer.y,
                     fontSize: 20 / fabricCanvas.getZoom(),
                     fill: strokeColorInput?.value || '#000000',
                     originX: 'left', originY: 'top',
                     selectable: true, evented: true, hasControls: true, hasBorders: true,
                     baseStrokeWidth: 1 // Juste pour la cohérence, non utilisé visuellement
                 });
                 fabricCanvas.add(textObj);
                 fabricCanvas.setActiveObject(textObj);
                 textObj.enterEditing();
                 textObj.selectAll();
                 console.log("Objet IText ajouté et en mode édition.");
                 // Important: Revenir à l'outil sélection après ajout
                 setActiveTool('select');
            } else if (currentTool !== 'select') { // Outils de forme (rect, line, circle)
                startDrawing(getIsSnapEnabled() ? snapToGrid(pointer.x, pointer.y) : pointer);
            }
        }
    }

    function handleCanvasMouseMove(opt) {
        if (handlePanMove(opt)) return;
        if (getIsDrawing()) {
            const pointer = fabricCanvas.getPointer(opt.e);
            continueDrawing(getIsSnapEnabled() ? snapToGrid(pointer.x, pointer.y) : pointer);
        }
    }

    function handleCanvasMouseUp(opt) {
        stopPan();
        if (getIsDrawing()) {
            stopDrawing();
        }
    }

     function handleCanvasMouseOut(opt) {
        stopPan();
        if (getIsDrawing()) {
            stopDrawing();
        }
     }

     /** NOUVEAU: Gère le double clic pour éditer le texte */
     function handleDoubleClick(options) {
        const target = options.target;
        // Vérifie si c'est un groupe forme+texte OU un IText seul
        if (target && target.type === 'i-text' && target.selectable) { // Texte libre
            enterTextEditing(target, null); // Pas de groupe parent
        } else if (target && target.type === 'group' && !target.customData?.isGeoTag && target._objects?.length === 2 && target._objects[1].type === 'i-text') { // Groupe forme+texte
            const textObject = target._objects[1];
            enterTextEditing(textObject, target); // Passe le groupe parent
        }
     }

     /** Fonction pour entrer en mode édition de texte */
     function enterTextEditing(textObject, parentGroup) {
         if (!textObject.isEditing) {
             // Rendre éditable et sélectionner
             textObject.set({ selectable: true, evented: true });
             if(parentGroup) {
                fabricCanvas.setActiveObject(parentGroup); // Garder le groupe sélectionné visuellement
             } else {
                fabricCanvas.setActiveObject(textObject);
             }
             textObject.enterEditing();
             textObject.selectAll();
             console.log("Entrée en édition de texte");

             // Masquer temporairement la forme pour l'édition dans un groupe
             if(parentGroup) parentGroup._objects[0].set({ visible: false });
             fabricCanvas.renderAll();

             // Gérer la fin de l'édition
             textObject.off('editing:exited'); // Nettoyer anciens listeners
             textObject.on('editing:exited', () => {
                 console.log("Sortie de l'édition de texte");
                 textObject.set({ selectable: false, evented: false }); // Redevenir non sélectionnable seul

                 // Réafficher la forme
                 if(parentGroup) parentGroup._objects[0].set({ visible: true });

                 if (parentGroup) {
                    parentGroup.addWithUpdate(); // Recalculer la taille du groupe
                    parentGroup.setCoords();
                    fabricCanvas.setActiveObject(parentGroup); // Resélectionner le groupe
                 } else {
                     // Si c'était un texte libre, il reste sélectionné
                     fabricCanvas.setActiveObject(textObject);
                 }
                 fabricCanvas.renderAll();
                 // Optionnel : Sauvegarder l'état ici
             });
         }
     }

    function handleObjectMoving(opt) {
        const target = opt.target;
        if (!target || target.isGridLine || target.isPageGuide) return;

        if (getIsSnapEnabled()) {
            snapObjectToGrid(target);
        }
        target.setCoords();

        if (target.customData?.isGeoTag) {
            showToolbar(target);
            if (target.arrowLine) {
                 // La flèche sera mise à jour dans handleGeoTagModified
                 // Pour optimiser, on pourrait le faire ici aussi : addArrowToTag(target);
            }
        }
    }

     function handleObjectModified(opt) {
        const target = opt.target;
        if (!target || target.isGridLine || target.isPageGuide) return;

        if (target.customData?.isGeoTag) {
            handleGeoTagModified(target); // Géré par geo-tags.js
        } else {
             console.log("Objet dessin modifié (non-tag)", target.type);
             // Sauvegarde implicite après modification ? A décommenter si souhaité
             // handleSaveRequest();
        }
    }

    function handleSelectionChange(opt) {
        const selected = opt.selected; // Peut être un tableau d'objets
        // Cas 1: Sélection effacée ou seul un élément non pertinent est sélectionné
        if (!selected || selected.length === 0 || (selected.length === 1 && (selected[0].isGridLine || selected[0].isPageGuide))) {
            handleSelectionCleared();
            return;
        }

        // Cas 2: Sélection unique valide OU Sélection multiple (opt.target est l'objet ActiveSelection)
        const activeObject = selected.length === 1 ? selected[0] : opt.target;

        // **** CORRECTION: Ajout de la vérification ****
        if (!activeObject || typeof activeObject.type === 'undefined') {
            console.warn("handleSelectionChange: activeObject ou son type est indéfini. Opt:", opt);
            handleSelectionCleared(); // Sécurité: considérer comme désélectionné
            return;
        }
        // **** FIN CORRECTION ****

        console.log("Sélection modifiée:", activeObject.type); // Maintenant l'accès est sûr

        const groupBtn = document.getElementById('group-btn');
        const ungroupBtn = document.getElementById('ungroup-btn');

        if (activeObject.type === 'activeSelection') {
             // Sélection multiple
             hideToolbar();
             // Activer Groupe, Désactiver Dégroupe
             if(groupBtn) groupBtn.disabled = false;
             if(ungroupBtn) ungroupBtn.disabled = true;
        } else if (activeObject.customData?.isGeoTag) {
            // Tag géo unique
            showToolbar(activeObject);
            redrawAllTagsHighlight(); // Mettre à jour le surlignage
            // Désactiver Groupe/Dégroupe
            if(groupBtn) groupBtn.disabled = true;
            if(ungroupBtn) ungroupBtn.disabled = true;
        } else if (activeObject.type === 'group' && !activeObject.customData?.isGeoTag) {
             // Groupe de formes unique
             hideToolbar();
             // Désactiver Groupe, Activer Dégroupe
             if(groupBtn) groupBtn.disabled = true;
             if(ungroupBtn) ungroupBtn.disabled = false;
        } else {
            // Forme simple unique (ligne, texte, ou groupe forme+texte initial)
            hideToolbar();
             // Désactiver Groupe/Dégroupe
             if(groupBtn) groupBtn.disabled = true;
             if(ungroupBtn) ungroupBtn.disabled = true;
        }
    }

     function handleSelectionCleared() {
         console.log("Sélection effacée.");
        hideToolbar();
        redrawAllTagsHighlight(); // S'assurer que le highlight est enlevé
         // Désactiver boutons groupe/dégroupe
         const groupBtn = document.getElementById('group-btn');
         const ungroupBtn = document.getElementById('ungroup-btn');
         if(groupBtn) groupBtn.disabled = true;
         if(ungroupBtn) ungroupBtn.disabled = true;
    }

    function restrictTagTransform(e) {
        if (e.target && e.target.customData?.isGeoTag) {
            const t = e.transform;
            t.lockScalingX = true; t.lockScalingY = true; t.lockRotation = true;
        }
    }

    function handleViewportTransform() {
        if (isGridVisible) drawGrid();
        if (pageGuideRect) updatePageGuideStroke(); // NOUVEAU
        updateStrokesWidth(fabricCanvas.getZoom());
    }

    function handleKeyDown(e) {
        const activeObj = fabricCanvas.getActiveObject();
        // Ne pas intercepter si on est dans un input/textarea ou en édition de texte Fabric
        if (e.target.tagName.match(/input|textarea/i) || (activeObj?.isEditing)) return;

        switch (e.key) {
            case 'Escape':
                console.log("Escape pressé.");
                if (isPlacementMode) cancelPlacementMode();
                if (getIsDrawingArrowMode()) cancelArrowDrawing();
                if (getIsDrawing()) stopDrawing();
                if (activeObj) fabricCanvas.discardActiveObject().renderAll();
                if (highlightedCodeGeo) {
                    highlightedCodeGeo = null;
                    redrawAllTagsHighlight();
                }
                e.preventDefault();
                break;
            case 'Delete':
            case 'Backspace':
                if (activeObj) {
                     if (!activeObj.customData?.isGeoTag) { // Ne supprime que les formes/groupes de formes
                         deleteSelectedShape();
                         e.preventDefault();
                     } else {
                         showToast("Utilisez la barre d'outils du tag géo (poubelle) pour le supprimer.", "info");
                     }
                 }
                break;
            // Copier/Coller (Cmd/Ctrl + C/V)
             case 'c':
                 if (e.ctrlKey || e.metaKey) {
                     copyShape();
                     e.preventDefault();
                 }
                 break;
             case 'v':
                 if (e.ctrlKey || e.metaKey) {
                     pasteShape();
                     e.preventDefault();
                 }
                 break;
            // Ajouter ici Ctrl+G pour grouper, Ctrl+Shift+G pour dégrouper si souhaité
        }
    }

    /** Annule les modes de dessin (forme, flèche, texte) et le placement de tag */
    function cancelDrawingModes() {
        if (getIsDrawing()) stopDrawing();
        if (getIsDrawingArrowMode()) cancelArrowDrawing();
        if (isPlacementMode) cancelPlacementMode();
        // Si on était en train de dessiner du texte, setActiveTool('select') le gère déjà
    }

    /** Crée les objets Fabric pour les tags géo initiaux */
    function createInitialGeoTagsFromData(codesData) {
        console.log("Création des tags géo initiaux..."); let tagsCreatedCount = 0;
        codesData.forEach(code => {
            if (code.placements) {
                code.placements.forEach(placement => {
                    if (placement.plan_id == currentPlanId) {
                        const { placements, ...codeInfo } = code;
                        const tagData = { ...codeInfo, ...placement };
                        if(createFabricTag(tagData)) tagsCreatedCount++;
                    }
                });
            }
        });
        console.log(`${tagsCreatedCount} tags initiaux créés.`); fabricCanvas.renderAll();
    }

    /** Charge les annotations JSON sur le canvas */
    function loadJsonAnnotations(jsonData) {
        return new Promise((resolve, reject) => {
            if (!jsonData || typeof jsonData !== 'object') {
                console.warn("loadJsonAnnotations: Données JSON invalides ou vides.");
                resolve(); 
                return; 
            }
            console.log("Chargement annotations JSON...");
            fabricCanvas.loadFromJSON(jsonData, () => {
                console.log("Annotations JSON chargées.");
                fabricCanvas.getObjects().forEach(obj => {
                    // Appliquer les propriétés post-chargement
                    if (!obj.customData?.isGeoTag && !obj.isGridLine && !obj.isPageGuide) {
                        obj.set({
                            selectable: true, evented: true, hasControls: true, hasBorders: true,
                            // Recalculer le strokeWidth basé sur baseStrokeWidth et zoom actuel
                            strokeWidth: obj.baseStrokeWidth ? (obj.baseStrokeWidth / fabricCanvas.getZoom()) : (obj.strokeWidth || 1)
                        });
                        // Si c'est un groupe forme+texte, ajuster aussi le texte interne
                         if (obj.type === 'group' && obj._objects?.length === 2 && obj._objects[1].type === 'i-text') {
                             const shape = obj._objects[0];
                             const text = obj._objects[1];
                             const zoom = fabricCanvas.getZoom();
                             shape.set({ strokeWidth: obj.baseStrokeWidth ? (obj.baseStrokeWidth / zoom) : (shape.strokeWidth || 1) });
                             text.set({
                                 fontSize: (text.fontSize || 16) / zoom,
                                 left: (text.left || 5) / zoom,
                                 top: (text.top || 5) / zoom,
                                 padding: (text.padding || 2) / zoom,
                                 selectable: false, // Non sélectionnable individuellement par défaut
                                 evented: false
                             });
                             obj.addWithUpdate(); // Recalculer le groupe
                         }
                        obj.setCoords();
                    }
                });
                console.log("Objets JSON configurés."); 
                fabricCanvas.renderAll(); 
                resolve();
            }, (o, object) => { 
                // Reviver (peut être utilisé pour des ajustements fins pendant le chargement)
                // console.log("Reviver JSON:", object.type); 
            });
        });
    }

     // --- Sauvegarde spécifique au type de plan ---
     async function handleSaveRequest() {
         console.log("handleSaveRequest - Début, planType:", planType);
         let savePromise;
         let successMessage = "";

         // Filtrer les objets à sauvegarder (ignorer grille et guide page)
         const objectsToSaveFilter = obj => !obj.isGridLine && !obj.isPageGuide;

         if (planType === 'image') {
            const dataToSave = fabricCanvas.toJSON(['customData', 'selectable', 'evented', 'baseStrokeWidth']);
            dataToSave.objects = dataToSave.objects.filter(objectsToSaveFilter);
            console.log(`Sauvegarde annotations JSON: ${dataToSave.objects.length} objets.`);
            savePromise = saveDrawingData(currentPlanId, dataToSave.objects.length > 0 ? dataToSave : null);
            successMessage = "Annotations sauvegardées.";
         } else if (planType === 'svg') {
             // Exporter le SVG en incluant baseStrokeWidth et en excluant grille/guide
             const svgString = fabricCanvas.toSVG(['baseStrokeWidth'], objectsToSaveFilter);
             console.log("Sauvegarde modifications SVG...");
             savePromise = updateSvgPlan(currentPlanId, svgString);
             successMessage = "Modifications SVG sauvegardées.";
         } else if (planType === 'svg_creation') {
             console.log("Sauvegarde nouveau plan SVG...");
             savePromise = handleSaveNewSvgPlan(); // Gère la création et redirection
             successMessage = "Nouveau plan SVG créé ! Redirection..."; // Message temporaire avant redirection
         } else {
              console.error("Type de plan inconnu pour la sauvegarde:", planType);
              showToast("Type de plan inconnu, sauvegarde impossible.", "danger");
              return Promise.reject("Type de plan inconnu."); // Rejeter la promesse
         }

         // Gérer la promesse de sauvegarde
         try {
            await savePromise;
             showToast(successMessage, "success");
         } catch (error) {
             console.error("Erreur lors de la sauvegarde:", error);
             showToast(`Erreur sauvegarde: ${error.message}`, "danger");
             throw error; // Renvoyer l'erreur pour le finally du bouton
         }
     }

      // Ajouter un écouteur au bouton de sauvegarde principal
     const saveButton = document.getElementById('save-drawing-btn') || document.getElementById('save-new-svg-plan-btn');
     if (saveButton) {
         saveButton.addEventListener('click', async (e) => {
             e.preventDefault();
             saveButton.disabled = true;
             saveButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sauvegarde...';
             try {
                 await handleSaveRequest();
             } catch (error) {
                 // Le message d'erreur est déjà affiché par handleSaveRequest
             } finally {
                 saveButton.disabled = false;
                 // Restaurer le texte correct (basé sur le texte initial du bouton)
                 const iconHtml = '<i class="bi bi-save"></i>';
                 if (planType === 'svg_creation') saveButton.innerHTML = `${iconHtml} Enregistrer Nouveau Plan`;
                 else saveButton.innerHTML = `${iconHtml} Sauvegarder`; // Texte générique
             }
         });
     }

     async function handleSaveNewSvgPlan() {
         const newPlanNameInput = document.getElementById('new-plan-name');
         const planName = newPlanNameInput?.value.trim();
         if (!planName) {
             showToast("Veuillez entrer un nom pour le plan.", "warning");
             newPlanNameInput?.focus();
             throw new Error("Nom du plan manquant.");
         }
         // Exclure grille et guide de page
         const svgString = fabricCanvas.toSVG(['baseStrokeWidth'], obj => !obj.isGridLine && !obj.isPageGuide);
         const newPlanId = await createSvgPlan(planName, svgString);
         // Rediriger vers la page d'édition du nouveau plan
         window.location.href = `index.php?action=manageCodes&id=${newPlanId}`;
     }

     // --- NOUVEAU: Gestion Format de Page ---
     /** Dessine ou met à jour le rectangle guide représentant le format de page */
     function updatePageGuide() {
        if (!pageFormatSelect) return;
        const selectedFormat = pageFormatSelect.value;
        console.log("Mise à jour du guide de page:", selectedFormat);

        if (pageGuideRect) {
            fabricCanvas.remove(pageGuideRect);
            pageGuideRect = null;
        }

        if (selectedFormat === 'custom') {
            fabricCanvas.renderAll(); return;
        }

        const ratios = { A4_landscape: 297 / 210, A4_portrait: 210 / 297, A3_landscape: 420 / 297, A3_portrait: 297 / 420 };
        const ratio = ratios[selectedFormat];
        if (!ratio) return;

        // Adapter le rectangle à la taille du canvas en gardant le ratio
        const canvasWidth = fabricCanvas.getWidth() / fabricCanvas.getZoom(); // Dimensions réelles (non zoomées)
        const canvasHeight = fabricCanvas.getHeight() / fabricCanvas.getZoom();
        const canvasRatio = canvasWidth / canvasHeight;
        let guideWidth, guideHeight;

        if (ratio > canvasRatio) { // Plus large que le canvas -> adapter à la largeur
            guideWidth = canvasWidth * 0.95; // Laisser une petite marge
            guideHeight = guideWidth / ratio;
        } else { // Plus haut que le canvas -> adapter à la hauteur
            guideHeight = canvasHeight * 0.95; // Laisser une petite marge
            guideWidth = guideHeight * ratio;
        }

        const zoom = fabricCanvas.getZoom();
        pageGuideRect = new fabric.Rect({
            width: guideWidth, 
            height: guideHeight,
            fill: 'transparent',
            stroke: 'rgba(200, 0, 0, 0.5)', // Rouge semi-transparent
            strokeWidth: 2 / zoom, // Adapter au zoom
            strokeDashArray: [5 / zoom, 5 / zoom],
            selectable: false, evented: false, excludeFromExport: true,
            originX: 'center', originY: 'center',
            isPageGuide: true
        });

        // Positionner au centre du viewport actuel
        const center = fabricCanvas.getCenter();
        const vpt = fabricCanvas.viewportTransform;
        const zoomedCenter = fabric.util.transformPoint(center, fabric.util.invertTransform(vpt));
        pageGuideRect.set({ left: zoomedCenter.x, top: zoomedCenter.y });

        fabricCanvas.add(pageGuideRect);
        pageGuideRect.moveTo(0); // Mettre en arrière-plan
        fabricCanvas.renderAll();
        console.log(`Guide de page ajouté: ${guideWidth.toFixed(0)}x${guideHeight.toFixed(0)} (pixels réels)`);
     }

     /** Met à jour l'épaisseur du trait du guide au zoom */
     function updatePageGuideStroke() {
         if(pageGuideRect) {
             const zoom = fabricCanvas.getZoom();
             pageGuideRect.set({
                strokeWidth: 2 / zoom,
                strokeDashArray: [5 / zoom, 5 / zoom]
             });
             // Le renderAll est déjà déclenché par l'événement viewport:transformed
         }
     }

     // --- NOUVEAU: Gestion Assets ---
     async function saveSelectionAsAsset() {
        const activeObject = fabricCanvas.getActiveObject();
        if (!activeObject || activeObject.isGridLine || activeObject.isPageGuide || activeObject.customData?.isGeoTag) {
            showToast("Sélectionnez une forme ou un groupe (non géo-tag) à sauvegarder.", "warning"); return;
        }
        const assetName = prompt("Nom pour cet asset :");
        if (!assetName || assetName.trim() === '') return;

        const assetData = activeObject.toObject(['baseStrokeWidth']); // Inclure baseStrokeWidth

        try {
            await saveAsset(assetName, assetData);
            showToast(`Asset "${assetName}" sauvegardé !`, 'success');
            loadAssetsList(); // Recharge la liste dans l'offcanvas
        } catch (error) {
            showToast(`Erreur sauvegarde asset: ${error.message}`, "danger");
        }
     }

     async function loadAssetsList() {
        if (!assetsListEl) return;
        assetsListEl.innerHTML = '<p class="text-muted">Chargement...</p>';
        try {
            const assets = await listAssets();
            if (!assets || assets.length === 0) {
                assetsListEl.innerHTML = '<p class="text-muted">Aucun asset.</p>'; return;
            }
            assetsListEl.innerHTML = '';
            assets.forEach(asset => {
                const button = document.createElement('button');
                button.className = 'btn btn-outline-secondary d-block w-100 mb-2 text-start asset-item';
                button.dataset.assetId = asset.id;
                button.innerHTML = `<i class="bi bi-star"></i> ${asset.name}`;
                assetsListEl.appendChild(button);
            });
        } catch (error) {
            assetsListEl.innerHTML = `<p class="text-danger">Erreur: ${error.message}</p>`;
        }
     }

     async function handleAssetClick(event) {
         const assetButton = event.target.closest('.asset-item');
         if (!assetButton?.dataset.assetId) return;
         const assetId = assetButton.dataset.assetId;
         try {
            const assetJsonData = await getAssetData(assetId); // Récupère {id, name, data:{...}}
            if (!assetJsonData || !assetJsonData.data) throw new Error("Données invalides.");

            fabric.util.enlivenObjects([assetJsonData.data], (objects) => {
                if (!objects || objects.length === 0) { showToast("Erreur recréation asset.", "danger"); return; }
                const newObject = objects[0];
                const center = fabricCanvas.getCenter();
                const vpt = fabricCanvas.viewportTransform;
                const zoomedCenter = fabric.util.transformPoint(center, fabric.util.invertTransform(vpt));
                const zoom = fabricCanvas.getZoom();

                newObject.set({
                    left: zoomedCenter.x, top: zoomedCenter.y, originX: 'center', originY: 'center',
                    selectable: true, evented: true
                });
                
                // Ajuster le strokeWidth si baseStrokeWidth est présent
                if (newObject.baseStrokeWidth) {
                     newObject.set({ strokeWidth: newObject.baseStrokeWidth / zoom });
                }
                
                // Si c'est un groupe forme+texte, ajuster le texte interne
                 if (newObject.type === 'group' && newObject._objects?.length === 2 && newObject._objects[1].type === 'i-text') {
                      const shape = newObject._objects[0];
                      const text = newObject._objects[1];
                      shape.set({ strokeWidth: newObject.baseStrokeWidth ? (newObject.baseStrokeWidth / zoom) : (shape.strokeWidth || 1) });
                      text.set({
                         fontSize: (text.fontSize || 16) / zoom,
                         left: (text.left || 5) / zoom,
                         top: (text.top || 5) / zoom,
                         padding: (text.padding || 2) / zoom,
                         selectable: false, 
                         evented: false
                      });
                      newObject.addWithUpdate();
                 }

                fabricCanvas.add(newObject);
                newObject.setCoords();
                fabricCanvas.setActiveObject(newObject).renderAll();
                showToast("Asset ajouté.", "success");
                const offcanvasInstance = bootstrap.Offcanvas.getInstance(assetsOffcanvasEl);
                if(offcanvasInstance) offcanvasInstance.hide();
            }, '');

         } catch (error) { 
             console.error("Erreur chargement asset:", error);
             showToast(`Erreur chargement asset: ${error.message}`, "danger"); 
         }
     }


    console.log("Fin de l'initialisation de main.js");
}); // Fin DOMContentLoaded
