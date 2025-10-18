/**
 * Point d'entrée principal pour l'éditeur de plan (plan_view.php et plan_create_svg_view.php).
 * Initialise tous les modules nécessaires et gère l'état global.
 */
import { initializeCanvas, getCanvasInstance, loadBackgroundImage, loadSvgPlan, resizeCanvas, handleMouseWheel, startPan, handlePanMove, stopPan, snapObjectToGrid, getIsSnapEnabled } from './canvas.js';
import { initializeSidebar, fetchAndRenderAvailableCodes, updateCodeCountInSidebar, clearSidebarSelection } from './sidebar.js';
import { initializeGeoTags, createFabricTag, handleGeoTagModified, showToolbar, hideToolbar, getIsDrawingArrowMode, handleArrowEndPoint } from './geo-tags.js';
import { initializeDrawingTools, setActiveTool, getCurrentDrawingTool, startDrawing, continueDrawing, stopDrawing, getIsDrawing } from './drawing-tools.js';
import { initializeUI } from './ui.js';
import { savePosition, saveDrawingData, createSvgPlan, updateSvgPlan } from '../modules/api.js'; // Importer les fonctions API nécessaires
import { convertPixelsToPercent, showToast } from '../modules/utils.js'; // Importer les utilitaires

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Plan Editor - DOMContentLoaded");

    // --- Récupération des données initiales depuis le JSON embarqué ---
    const planDataElement = document.getElementById('plan-data');
    if (!planDataElement) {
        console.error("Élément #plan-data non trouvé. Impossible de récupérer les données initiales.");
        showToast("Erreur critique : Données de configuration manquantes.", "danger");
        return;
    }
    const planData = JSON.parse(planDataElement.textContent);
    console.log("Données initiales récupérées:", planData);

    // Mettre les données dans le scope global si nécessaire (pour compatibilité ou debug)
    // Attention: Préférer passer les données explicitement aux modules
    window.planData = planData; // Pour accès facile depuis la console si besoin

    const {
        planType,
        currentPlanId,
        currentPlan,
        universColors,
        planUnivers,
        placedGeoCodes, // Peut être vide
        initialDrawingData
    } = planData;

    if (!planType || planType === 'unknown') {
         console.error("Type de plan invalide ou manquant dans planData.");
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
    const fabricCanvas = initializeCanvas(canvasEl, planType);
    if (!fabricCanvas) {
         console.error("Échec de l'initialisation du canvas Fabric.");
         showToast("Erreur critique : Impossible d'initialiser la zone d'édition.", "danger");
         return;
    }

    // --- Initialisation des Modules ---
    // Passer l'instance du canvas et les données nécessaires aux modules
    if (planType !== 'svg_creation') {
        initializeSidebar(currentPlanId, planUnivers, universColors, handleCodeSelectedForPlacement);
        initializeGeoTags(fabricCanvas, universColors);
    }
    initializeDrawingTools(fabricCanvas);
    initializeUI(); // Gère fullscreen, zoom buttons, sidebar toggle

    // --- Chargement du contenu du plan ---
    const loader = document.getElementById('plan-loader');
    if(loader) loader.style.display = 'block';

    try {
        if (planType === 'svg_creation') {
            console.log("Mode création SVG vierge.");
            // Canvas déjà prêt (fond blanc)
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
        resizeCanvas(); // Adapte canvas et fond/SVG à la taille du conteneur

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
        'mouse:out': handleCanvasMouseOut, // Gérer la sortie du canvas
        'object:moving': handleObjectMoving,
        'object:modified': handleObjectModified,
        'selection:created': handleSelectionChange,
        'selection:updated': handleSelectionChange,
        'selection:cleared': handleSelectionCleared,
        'before:transform': restrictTagTransform, // Empêcher scale/rotation des tags
        'viewport:transformed': handleViewportTransform // Pour màj grille/traits
    });

    // --- Variables d'état local ---
    let isPlacementMode = false;
    let codeToPlace = null;
    let placementModeActiveItem = null; // Élément DOM de la sidebar sélectionné

    // --- Fonctions de Gestion d'État et d'Interaction ---

    /** Callback pour quand un code est sélectionné dans la sidebar */
    function handleCodeSelectedForPlacement(codeData) {
        cancelDrawingModes(); // Annule dessin de forme ou de flèche
        setActiveTool('select'); // Assure qu'on est en mode sélection/placement

        isPlacementMode = true;
        codeToPlace = codeData;

        // Mise à jour visuelle (curseur + highlight sidebar)
        const planContainer = document.getElementById('plan-container');
        if(planContainer) planContainer.classList.add('placement-mode');
        fabricCanvas.defaultCursor = 'crosshair';
        fabricCanvas.setCursor('crosshair');
        fabricCanvas.discardActiveObject().renderAll(); // Désélectionner tout objet
        hideToolbar(); // Cacher la toolbar d'édition de tag

        // Gérer le style 'active' dans la sidebar (déjà fait dans sidebar.js via le click)
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
        // Restaurer curseur basé sur l'outil actuel (généralement 'select' après un placement)
        const currentTool = getCurrentDrawingTool();
        fabricCanvas.defaultCursor = (currentTool === 'select') ? 'default' : 'crosshair';
        fabricCanvas.setCursor(fabricCanvas.defaultCursor);
        if (placementModeActiveItem) {
            placementModeActiveItem.classList.remove('active');
            placementModeActiveItem = null;
        }
        clearSidebarSelection(); // Appeler la fonction exportée pour être sûr
    }

     /** Place un nouveau tag géo sur le canvas après un clic */
     async function placeNewTagOnClick(clickEvent) {
        if (!isPlacementMode || !codeToPlace) return;
        console.log("Placement tag:", codeToPlace.codeGeo);

        const pointer = fabricCanvas.getPointer(clickEvent);
        const { posX, posY } = convertPixelsToPercent(pointer.x, pointer.y, fabricCanvas);

        if (isNaN(posX) || isNaN(posY)) {
            console.error("placeNewTag - Coordonnées en pourcentage invalides (NaN).");
            showToast("Erreur lors du calcul de la position. Veuillez réessayer.", "danger");
            cancelPlacementMode();
            return;
        }

        // Préparer les données pour l'API
        const newPositionData = {
            id: parseInt(codeToPlace.id, 10),
            plan_id: currentPlanId,
            pos_x: posX,
            pos_y: posY,
            width: sizePresets.medium.width, // Taille par défaut
            height: sizePresets.medium.height,
            anchor_x: null, // Pas d'ancre par défaut
            anchor_y: null
        };

        try {
            const savedData = await savePosition(newPositionData);
            console.log("Position sauvegardée:", savedData);

            // Préparer les données complètes pour créer l'objet Fabric
            const fullCodeData = {
                ...codeToPlace, // Contient id, codeGeo, libelle, univers
                position_id: savedData.position_id, // ID de la position retourné par l'API
                plan_id: savedData.plan_id,
                pos_x: savedData.pos_x, // Pourcentages retournés par l'API
                pos_y: savedData.pos_y,
                width: savedData.width,
                height: savedData.height,
                anchor_x: savedData.anchor_x,
                anchor_y: savedData.anchor_y
            };

            const newTag = createFabricTag(fullCodeData); // Créer l'objet Fabric
            if (newTag) {
                console.log("Tag Fabric créé:", newTag);
                fabricCanvas.setActiveObject(newTag).renderAll(); // Sélectionner le nouveau tag
                showToolbar(newTag); // Afficher sa toolbar
            } else {
                 console.error("Échec création objet Fabric après sauvegarde API.");
                 showToast("Erreur lors de l'affichage du tag. Réessayez.", "warning");
            }

            updateCodeCountInSidebar(codeToPlace.id, 1); // Mettre à jour compteur sidebar

            // Mettre à jour le tableau de données local (si utilisé)
            const codeIdx = planData.placedGeoCodes.findIndex(c => c.id == codeToPlace.id);
            if (codeIdx > -1) {
                 if (!planData.placedGeoCodes[codeIdx].placements) planData.placedGeoCodes[codeIdx].placements = [];
                 planData.placedGeoCodes[codeIdx].placements.push(savedData);
            } else {
                 console.warn("Code non trouvé localement après placement:", codeToPlace.id);
            }

        } catch (error) {
            console.error("Échec placement tag:", error);
            showToast(`Erreur placement: ${error.message}`, "danger");
        } finally {
            cancelPlacementMode(); // Quitter le mode placement
        }
    }


    // --- Gestionnaires d'événements Canvas ---

    function handleCanvasMouseDown(opt) {
        const { e: evt, target, pointer } = opt;
        if (!pointer) return; // Ignore si pas de coordonnées
         // console.log("Canvas Mouse Down - Target:", target?.type, "Button:", evt.button, "Tool:", getCurrentDrawingTool());

        // Clic droit ou molette ou Alt+Clic -> Panning
        if (evt.altKey || evt.button === 1 || evt.button === 2) {
            startPan(opt);
            return;
        }

        // Clic gauche
        if (target && !target.isGridLine) { // Clic sur un objet (tag ou dessin)
             console.log("Clic sur objet:", target.type);
            // Si on est en mode flèche et on clique sur un tag, c'est pour définir l'ancre
            if (getIsDrawingArrowMode() && target.customData?.isGeoTag) {
                handleArrowEndPoint(opt); // Géré par geo-tags.js
            }
            // Si on clique sur un objet alors qu'on voulait dessiner, on annule le dessin potentiel
            if (getCurrentDrawingTool() !== 'select') {
                cancelDrawingModes();
            }
            // La sélection est gérée par Fabric et handleSelectionChange

        } else { // Clic sur le fond du canvas
             console.log("Clic sur fond canvas.");
            fabricCanvas.discardActiveObject().renderAll(); // Désélectionne tout
            hideToolbar();

            if (isPlacementMode) {
                placeNewTagOnClick(evt); // Placer le tag en attente
            } else if (getIsDrawingArrowMode()) {
                handleArrowEndPoint(opt); // Placer la pointe de la flèche
            } else if (getCurrentDrawingTool() !== 'select' && getCurrentDrawingTool() !== 'freehand') {
                // Démarrer le dessin d'une forme
                const canvasPointer = fabricCanvas.getPointer(evt);
                startDrawing(getIsSnapEnabled() ? snapToGrid(canvasPointer.x, canvasPointer.y) : canvasPointer);
            }
        }
    }

    function handleCanvasMouseMove(opt) {
        if (handlePanMove(opt)) return; // Si on panne, on ne fait rien d'autre
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
        // Arrêter le pan ou le dessin si la souris quitte le canvas
        stopPan();
        if (getIsDrawing()) {
            stopDrawing();
        }
    }


    function handleObjectMoving(opt) {
        const target = opt.target;
        if (!target || target.isGridLine) return;

        if (getIsSnapEnabled()) {
            snapObjectToGrid(target);
        }
        target.setCoords(); // Mettre à jour les coordonnées internes

        // Si c'est un tag géo, mettre à jour sa toolbar et sa flèche
        if (target.customData?.isGeoTag) {
            showToolbar(target);
            if (target.arrowLine) {
                addArrowToTag(target); // Met à jour la position de départ de la flèche
            }
        }
    }

     function handleObjectModified(opt) {
        const target = opt.target;
        if (!target || target.isGridLine) return;

        if (target.customData?.isGeoTag) {
            handleGeoTagModified(target); // Délégué au module geo-tags
        } else {
             console.log("Objet dessin modifié (non-tag)");
            // Optionnel: Sauvegarder automatiquement les dessins ?
            // Pour l'instant, nécessite un clic sur "Sauvegarder Annotations/SVG"
        }
    }

    function handleSelectionChange(opt) {
        const selected = opt.selected;
        if (!selected || selected.length === 0 || (selected.length === 1 && selected[0].isGridLine)) {
            handleSelectionCleared();
            return;
        }

        const activeObject = selected[0]; // On gère principalement la sélection unique pour la toolbar
         console.log("Sélection modifiée:", activeObject.type);

        if (activeObject.customData?.isGeoTag) {
            showToolbar(activeObject);
             redrawAllTagsHighlight(); // Appliquer l'effet de surlignage/atténuation
        } else {
            hideToolbar();
             // Optionnel: Mettre à jour les contrôles de style (couleur, épaisseur)
             // avec les propriétés de l'objet sélectionné (géré dans drawing-tools.js)
        }
    }

     function handleSelectionCleared() {
         console.log("Sélection effacée.");
        hideToolbar();
         redrawAllTagsHighlight(); // Retirer tout effet de surlignage/atténuation
    }

    /** Empêche la rotation et le redimensionnement des tags géo */
    function restrictTagTransform(e) {
        if (e.target && e.target.customData?.isGeoTag) {
            const t = e.transform;
            t.lockScalingX = true;
            t.lockScalingY = true;
            t.lockRotation = true;
        }
    }

    /** Appelé quand le viewport (zoom/pan) a changé */
    function handleViewportTransform() {
        if (getIsGridVisible()) drawGrid(); // Redessine la grille adaptée
        updateStrokesWidth(fabricCanvas.getZoom()); // Met à jour l'épaisseur des traits
    }

    /** Annule les modes de dessin (forme, flèche) et le placement de tag */
    function cancelDrawingModes() {
        if (getIsDrawing()) stopDrawing();
        if (getIsDrawingArrowMode()) cancelArrowDrawing(); // Assurez-vous d'avoir cette fonction dans geo-tags
        if (isPlacementMode) cancelPlacementMode();
    }

    /** Crée les objets Fabric pour les tags géo initiaux */
    function createInitialGeoTagsFromData(codesData) {
        console.log("Création des tags géo initiaux...");
        let tagsCreatedCount = 0;
        codesData.forEach(code => {
            if (code.placements) {
                code.placements.forEach(placement => {
                    // Vérifier si le placement concerne le plan actuel
                    if (placement.plan_id == currentPlanId) {
                        // Créer un objet combinant les infos du code et du placement
                        const { placements, ...codeInfo } = code; // Exclure le tableau placements
                        const tagData = { ...codeInfo, ...placement };
                        if(createFabricTag(tagData)) { // createFabricTag vient de geo-tags.js
                             tagsCreatedCount++;
                        }
                    }
                });
            }
        });
        console.log(`${tagsCreatedCount} tags initiaux créés sur le canvas.`);
        fabricCanvas.renderAll();
    }

    /** Charge les annotations JSON sur le canvas */
    function loadJsonAnnotations(jsonData) {
        return new Promise((resolve, reject) => {
            if (!jsonData || typeof jsonData !== 'object') {
                console.log("Aucune donnée d'annotation JSON à charger.");
                return resolve();
            }
             console.log("Chargement des annotations depuis JSON...");
            fabricCanvas.loadFromJSON(jsonData, () => {
                 console.log("Annotations JSON chargées.");
                // Assurer la configuration correcte après chargement
                fabricCanvas.getObjects().forEach(obj => {
                    if (!obj.customData?.isGeoTag && !obj.isGridLine) {
                        obj.set({
                            selectable: true,
                            evented: true,
                            hasControls: true, // Ou false si vous préférez
                            hasBorders: true,
                            // Recalculer strokeWidth basé sur baseStrokeWidth et zoom actuel
                            strokeWidth: obj.baseStrokeWidth ? (obj.baseStrokeWidth / fabricCanvas.getZoom()) : (obj.strokeWidth || 1)
                        });
                        obj.setCoords();
                    }
                });
                 console.log("Objets JSON configurés.");
                fabricCanvas.renderAll();
                resolve();
            }, (o, object) => {
                 // Reviver function (optionnel, pour traiter des types spécifiques si besoin)
                 console.log("Reviver JSON pour objet:", object.type);
            });
        });
    }

     // --- Sauvegarde spécifique au type de plan ---
     async function handleSaveRequest() {
        if (planType === 'image') {
            await saveDrawingData(currentPlanId, fabricCanvas.toJSON(['customData', 'selectable', 'evented', 'baseStrokeWidth']));
            showToast("Annotations sauvegardées.", "success");
        } else if (planType === 'svg') {
            await updateSvgPlan(currentPlanId, fabricCanvas.toSVG(['baseStrokeWidth']));
            showToast("Modifications SVG sauvegardées.", "success");
        } else if (planType === 'svg_creation') {
            await handleSaveNewSvgPlan(); // Gère la création et redirection
        }
     }
      // Ajouter un écouteur au bouton de sauvegarde principal (si existant)
     const saveButton = document.getElementById('save-drawing-btn') || document.getElementById('save-new-svg-plan-btn');
     if (saveButton) {
         saveButton.addEventListener('click', async (e) => {
             e.preventDefault();
             saveButton.disabled = true; // Empêcher double clic
             saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sauvegarde...';
             try {
                 await handleSaveRequest();
             } catch (error) {
                 console.error("Erreur lors de la sauvegarde:", error);
                 showToast(`Erreur sauvegarde: ${error.message}`, "danger");
             } finally {
                 saveButton.disabled = false;
                  // Restaurer le texte correct du bouton
                  if (planType === 'image') saveButton.innerHTML = '<i class="bi bi-save"></i> Sauvegarder Annotations';
                  else if (planType === 'svg') saveButton.innerHTML = '<i class="bi bi-save"></i> Sauvegarder SVG';
                  else if (planType === 'svg_creation') saveButton.innerHTML = '<i class="bi bi-save"></i> Enregistrer Nouveau Plan';
             }
         });
     }

     async function handleSaveNewSvgPlan() {
         const newPlanNameInput = document.getElementById('new-plan-name');
         const planName = newPlanNameInput?.value.trim();
         if (!planName) {
             showToast("Veuillez entrer un nom pour le plan.", "warning");
             newPlanNameInput?.focus();
             throw new Error("Nom du plan manquant."); // Arrête l'exécution pour le finally
         }
         const svgString = fabricCanvas.toSVG(['baseStrokeWidth']);
         const newPlanId = await createSvgPlan(planName, svgString);
         showToast(`Plan "${planName}" créé ! Redirection...`, "success");
         // Rediriger vers la page d'édition du nouveau plan
         window.location.href = `index.php?action=manageCodes&id=${newPlanId}`;
     }


    console.log("Fin de l'initialisation de main.js");
}); // Fin DOMContentLoaded
