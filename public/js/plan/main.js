// --- IMPORTS ---
import {
    initializeCanvas, loadSvgPlan, loadPlanImage,
    getCanvasInstance, resizeCanvas,
    resetZoom, setCanvasLock, getCanvasLock,
    findSvgShapeByCodeGeo, toggleSnapToGrid, getSnapToGrid,
    zoomCanvas,
    updateGrid, updateStrokesWidth
} from './canvas.js';

import {
    initializeSidebar,
    fetchAndClassifyCodes,
    populateUniversSelectInModal,
    handleSaveNewCodeInModal,
    handleAvailableCodeClick,
    handlePlacedCodeClick
} from './sidebar.js';

import {
    initializeDrawingTools,
    setActiveTool,
    getCurrentDrawingTool,
    startDrawing,
    continueDrawing,
    stopDrawing,
    getIsDrawing,
    // Import clipboard and delete functions
    copyShape,
    pasteShape,
    deleteSelectedDrawingShape,
    groupSelectedObjects,
    ungroupSelectedObject
} from './drawing-tools.js';

import {
    initializeUI,
    showLoading, hideLoading
} from './ui.js';

// NOUVEL IMPORT (pour la barre d'outils des tags géo)
import {
    addArrowToTag,
    showToolbar,
    hideToolbar
    // Importez d'autres fonctions de geo-tags si nécessaire
    // toggleHighlightSelected,
    // startDrawingArrow,
    // changeSelectedTagSize
} from './geo-tags.js';

// IMPORT CORRIGÉ (ajout de convertPercentToPixels)
import {
    showToast,
    convertPixelsToPercent,
    convertPercentToPixels // <-- CORRECTION : Ajout de cette fonction
} from '../modules/utils.js';

// IMPORT CORRIGÉ (ajout de GEO_TAG_FONT_SIZE)
import {
    sizePresets,
    GEO_TEXT_FONT_SIZE,
    GEO_TAG_FONT_SIZE, // <-- CORRECTION : Ajout de cette constante
    GRID_SIZE
} from '../modules/config.js';

// --- API Imports ---
import {
    savePosition,
    removePosition, // Utilise removePosition (corrigé de l'étape précédente)
    saveNewGeoCode,
    saveAsset,
    getAssetData,
    listAssets,
    saveDrawingData,
    createSvgPlan,
    updateSvgPlan,
    removeMultiplePositions
 } from '../modules/api.js';


// --- INITIALISATION GLOBALE ---

let fabricCanvas;
let currentPlanId;
let planType;
let planImageUrl;
let planSvgUrl;
let initialPlacedGeoCodes;
let universColors;
let planUnivers;

// --- DÉMARRAGE ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Plan Editor v2 (Correction API Update + Debug Logs) - DOMContentLoaded");

    try {
        const phpDataElement = document.getElementById('plan-data');
        const phpData = phpDataElement ? JSON.parse(phpDataElement.textContent || '{}') : (window.PHP_DATA || {});

        initialPlacedGeoCodes = phpData.placedGeoCodes || [];
        universColors = phpData.universColors || {};
        currentPlanId = phpData.currentPlanId;
        planType = phpData.planType;
        planUnivers = phpData.planUnivers || [];

        if (phpData.currentPlan && phpData.currentPlan.nom_fichier) {
            const baseUrl = 'uploads/plans/';
            if (planType === 'svg') {
                planSvgUrl = baseUrl + phpData.currentPlan.nom_fichier;
            } else if (planType === 'image') {
                planImageUrl = baseUrl + phpData.currentPlan.nom_fichier;
            }
        }

        if (!currentPlanId || !planType) {
            throw new Error("Données PHP essentielles (planId, planType) manquantes.");
        }
        console.log("Données initiales chargées:", phpData);

    } catch (error) {
        console.error("Erreur lors de la récupération des données PHP:", error);
        showToast("Erreur critique: Données initiales non chargées.", 'error');
        return;
    }


    showLoading("Initialisation du plan...");
    try {
        fabricCanvas = initializeCanvas('plan-canvas');
        if (!fabricCanvas) {
            throw new Error("Impossible d'initialiser le canvas Fabric.");
        }
        console.log("Canvas Fabric initialisé dans canvas.js");

        initializeSidebar(fabricCanvas, universColors, currentPlanId, planType, planUnivers);
        console.log("Sidebar (rôle info) initialisée.");

        initializeDrawingTools(fabricCanvas);
        console.log("Outils de dessin initialisés.");

        initializeUI(fabricCanvas);
        console.log("UI (sidebar toggle, fullscreen) initialisée.");

        if (planType === 'svg' && planSvgUrl) {
            await loadSvgPlan(planSvgUrl);
            setCanvasLock(true); // Verrouiller par défaut au chargement
        } else if (planType === 'image' && planImageUrl) {
            await loadPlanImage(planImageUrl);
            // setCanvasLock(true); // Pas de verrouillage pour les images pour l'instant
        } else if (planType === 'svg_creation'){
            console.log("Mode création SVG vierge.");
            // Canvas est prêt, pas besoin de charger de fond
        }
        else {
            resizeCanvas(); // Assure que le canvas prend la bonne taille même vide
            showToast("Aucun plan (SVG/Image) n'a été chargé.", 'warning');
        }

        setupEventListeners(); // Attacher les listeners APRÈS l'init des modules

        // Placer les éléments initiaux SEULEMENT si ce n'est pas une création
        if (planType !== 'svg_creation') {
            createInitialGeoElements(initialPlacedGeoCodes, planType); // <--- L'ERREUR SE PRODUISAIT ICI
            await fetchAndClassifyCodes(); // Charger la sidebar
        }

        // Configurer la modale d'ajout de code
	    const universSelectEl = document.getElementById('new-univers-id');
        if (universSelectEl) {
            populateUniversSelectInModal(universSelectEl, planUnivers);
        }

        const saveBtn = document.getElementById('save-new-code-btn');
        const addForm = document.getElementById('add-code-form');
        const addModalEl = document.getElementById('add-code-modal');
        const addModalInstance = addModalEl ? new bootstrap.Modal(addModalEl) : null;

        if (saveBtn && addForm && addModalInstance) {
            saveBtn.addEventListener('click', async () => {
                const success = await handleSaveNewCodeInModal(addForm, saveBtn, saveNewGeoCode); // Pass saveNewGeoCode from api.js
                if (success) { // Vérifier si la sauvegarde a réussi
                    addModalInstance.hide();
                    await fetchAndClassifyCodes(); // Rafraîchir la sidebar
                }
            });
        }

        // S'assurer que les boutons sont dans l'état initial correct
        updateDrawingToolButtons();
        updateLockButtonState();
        updateGroupButtonStates();


    } catch (error) {
        console.error("Erreur majeure lors de l'initialisation:", error);
        showToast(`Erreur d'initialisation: ${error.message}`, 'error');
    } finally {
        hideLoading();
        // S'assurer que resize/resetZoom sont appelés après le chargement potentiel du plan
        resizeCanvas();
        resetZoom();
        console.log("Fin initialisation main.js");
    }
});


/**
 * Attache les écouteurs d'événements principaux au canvas et au document.
 */
function setupEventListeners() {
    if (!fabricCanvas) return;
    console.log("Attaching ALL event listeners..."); // Log global pour cette fonction

    // --- Événements Souris sur le Canvas ---
    fabricCanvas.on('mouse:down', handleMouseDown);
    fabricCanvas.on('mouse:move', handleMouseMove);
    fabricCanvas.on('mouse:up', handleMouseUp);
    // Gérer 'mouse:out' peut être délicat avec le pan, on le laisse de côté pour l'instant
    // fabricCanvas.on('mouse:out', handleMouseUp);

    // --- Autres événements Canvas ---
    fabricCanvas.on('object:moving', (options) => {
        if (getSnapToGrid()) {
            const snapSize = GRID_SIZE || 10;
            const target = options.target;
            // Ne pas magnétiser les lignes pendant le déplacement (comportement étrange)
            if (target.type !== 'line') {
                target.set({
                    left: Math.round(target.left / snapSize) * snapSize,
                    top: Math.round(target.top / snapSize) * snapSize
                });
                target.setCoords(); // Mettre à jour les coordonnées internes
            }
        }
         // Mettre à jour la toolbar pendant le déplacement pour qu'elle suive
        const target = options.target;
        if (target && (target.customData?.isGeoTag || target.customData?.isPlacedText)) {
            showToolbar(target); // Peut causer des saccades, à tester
        }
    });

    fabricCanvas.on('object:modified', (e) => {
        const target = e.target;
        // Ne sauvegarder QUE si c'est un objet géo (pas les dessins)
        if (target && (target.customData?.isGeoTag || target.customData?.isPlacedText)) {
            console.log("Object Géo modifié (déplacé):", target.customData.codeGeo);
            handleObjectMoved(target);
        } else if (target) {
            console.log("Objet Dessin modifié:", target.type);
            // Déclencher la sauvegarde auto pour les dessins ?
            triggerAutoSaveDrawing();
        }
    });

    fabricCanvas.on('selection:created', (e) => {
        handleSelectionChange(e.selected);
    });
     fabricCanvas.on('selection:updated', (e) => { // Gérer aussi la mise à jour de sélection
        handleSelectionChange(e.selected);
    });

    fabricCanvas.on('selection:cleared', (e) => {
        console.log("Selection cleared");
        handleObjectDeselected(); // Gère la sidebar
        updateGroupButtonStates(); // Met à jour état boutons Grouper/Dégrouper
        hideToolbar(); // Cacher la toolbar quand rien n'est sélectionné
    });

    // Mettre à jour grille/traits après zoom/pan
    fabricCanvas.on('viewport:transformed', () => {
        const zoom = fabricCanvas.getZoom();
        updateGrid(zoom);
        updateStrokesWidth(zoom);
        // Mettre à jour la position de la toolbar si elle est visible
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj && (activeObj.customData?.isGeoTag || activeObj.customData?.isPlacedText)) {
            showToolbar(activeObj);
        }
    });


    // Empêcher menu contextuel natif sur le canvas
    fabricCanvas.upperCanvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

    // --- Événements du Document (Clavier, etc.) ---
    document.addEventListener('click', () => {
        // Cacher menu contextuel s'il existe
        // const contextMenu = document.getElementById('custom-context-menu');
        // if (contextMenu) contextMenu.style.display = 'none';
    });

    document.addEventListener('keydown', (e) => {
        const isInputFocused = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
        const activeObject = fabricCanvas.getActiveObject();

        if (e.key === 'Escape') {
            console.log("Escape key pressed");
            if (getIsDrawing()) {
                 console.log("Cancelling drawing");
                 stopDrawing(null, true); // Annuler le dessin en cours
            }
             if (getCurrentDrawingTool() !== 'select') {
                 console.log("Switching back to select tool");
                 setActiveTool('select');
                 updateDrawingToolButtons(); // Mettre à jour l'UI des boutons
             }
            fabricCanvas.discardActiveObject().renderAll();
            handleObjectDeselected(); // Assure la désélection dans la sidebar
            hideToolbar(); // Cacher la toolbar
            e.preventDefault(); // Empêche d'autres actions (ex: fermer plein écran)
        }

        // Ne pas traiter les raccourcis si un input est focus
        if (isInputFocused) return;

        // Raccourcis avec Ctrl ou Cmd (Mac)
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'c': // Copier
                    console.log("Ctrl+C detected");
                    if (activeObject) copyShape(); // Fonction de drawing-tools.js
                    e.preventDefault();
                    break;
                case 'v': // Coller
                    console.log("Ctrl+V detected");
                    pasteShape(); // Fonction de drawing-tools.js
                    e.preventDefault();
                    break;
                 case 'g': // Grouper / Dégrouper
                     console.log("Ctrl+G detected");
                     if (activeObject) {
                        if (e.shiftKey) { // Ctrl+Shift+G = Dégrouper
                            console.log("Ungroup action triggered");
                            ungroupSelectedObject(); // Fonction de drawing-tools.js
                        } else { // Ctrl+G = Grouper
                            console.log("Group action triggered");
                            groupSelectedObjects(); // Fonction de drawing-tools.js
                        }
                     }
                     e.preventDefault();
                     break;
                 case 'l': // Verrouiller/Déverrouiller plan SVG
                    console.log("Ctrl+L detected");
                    if (planType === 'svg') {
                         const lockBtn = document.getElementById('toggle-lock-svg-btn');
                         lockBtn?.click(); // Simule le clic sur le bouton
                    }
                    e.preventDefault();
                    break;
                // Ajouter d'autres raccourcis (Undo/Redo, etc.) ici si nécessaire
            }
        }
        // Raccourcis sans Ctrl/Cmd
        else {
            switch (e.key) {
                case 'Delete':
                case 'Backspace':
                     console.log("Delete/Backspace detected");
                    if (activeObject) {
                        if (activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText) {
                            handleDeleteObject(activeObject); // Supprime code géo
                        } else if (!activeObject.isEditing) { // Ne pas supprimer si en édition de texte
                            deleteSelectedDrawingShape(); // Supprime forme dessinée
                        }
                    }
                    e.preventDefault();
                    break;
                // Raccourcis pour changer d'outil
                case 'v': setActiveTool('select'); updateDrawingToolButtons(); break;
                case 'r': setActiveTool('rect'); updateDrawingToolButtons(); break;
                case 'l': setActiveTool('line'); updateDrawingToolButtons(); break;
                case 'c': setActiveTool('circle'); updateDrawingToolButtons(); break;
                case 't': setActiveTool('text'); updateDrawingToolButtons(); break;
            }
        }

        // Gérer Alt pour le Pan (maintenu enfoncé)
        if (e.key === 'Alt') {
            if (!fabricCanvas.isDragging) { // Éviter de changer si déjà en pan
                fabricCanvas.defaultCursor = 'grab';
                fabricCanvas.hoverCursor = 'grab';
                 fabricCanvas.requestRenderAll(); // Met à jour le curseur visuellement
            }
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
         if (e.key === 'Alt') {
            // Ne réinitialiser que si on n'est PAS en train de pan (au cas où stopPan n'aurait pas été appelé)
             if (!fabricCanvas.isDragging) {
                console.log("Alt key released, resetting cursor");
                fabricCanvas.defaultCursor = (getCurrentDrawingTool() === 'select') ? 'default' : 'crosshair';
                fabricCanvas.hoverCursor = (getCurrentDrawingTool() === 'select') ? 'move' : 'crosshair';
                 fabricCanvas.requestRenderAll(); // Met à jour le curseur visuellement
            }
        }
    });

    // --- Listeners pour les boutons de la Toolbar Principale ---

    // Zoom
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => {
        console.log("Zoom In Button Clicked!");
        zoomCanvas(1.2);
    });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
        console.log("Zoom Out Button Clicked!");
        zoomCanvas(0.8);
    });
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => {
        console.log("Zoom Reset Button Clicked!");
        resetZoom();
    });

    // Verrouillage SVG
    const lockBtn = document.getElementById('toggle-lock-svg-btn');
    if (lockBtn) {
        lockBtn.addEventListener('click', () => {
             console.log("Lock Button Clicked!");
             const isCurrentlyLocked = getCanvasLock();
             setCanvasLock(!isCurrentlyLocked);
             updateLockButtonState(); // Met à jour le texte/icône
        });
    }

    // Sauvegarde Dessin/SVG
    const saveDrawingBtn = document.getElementById('save-drawing-btn');
    if (saveDrawingBtn) {
         saveDrawingBtn.addEventListener('click', async () => {
             console.log("Save Drawing/SVG Button Clicked!");
             showLoading("Sauvegarde...");
             try {
                 if (planType === 'image') {
                    await triggerAutoSaveDrawing(true); // Force sauvegarde immédiate
                 } else if (planType === 'svg') {
                     await saveModifiedSvgPlan(); // Fonction API pour sauvegarder SVG complet
                 }
                 showToast("Modifications enregistrées.", "success");
             } catch (error) {
                  console.error("Erreur sauvegarde dessin/SVG:", error);
                  showToast(`Erreur sauvegarde: ${error.message}`, "danger");
             } finally {
                 hideLoading();
             }
         });
    }
     // Sauvegarde Nouveau Plan SVG (Mode Création)
     const saveNewSvgPlanBtn = document.getElementById('save-new-svg-plan-btn');
     const newPlanNameInput = document.getElementById('new-plan-name');
     if (saveNewSvgPlanBtn && newPlanNameInput) {
          saveNewSvgPlanBtn.addEventListener('click', async () => {
               console.log("Save New SVG Plan Button Clicked!");
               const planName = newPlanNameInput.value.trim();
               if (!planName) {
                   showToast("Veuillez entrer un nom pour le plan.", "warning");
                   return;
               }

               // TODO: Ajouter sélection des univers pour la création
               const universIds = []; // Mettre ici les IDs des univers sélectionnés (depuis une modale ?)

               showLoading("Création du plan SVG...");
               try {
                  // Exclure la grille de l'export
                  const svgString = fabricCanvas.toSVG(['customData', 'baseStrokeWidth'], (obj) => {
                      if (obj.isGridLine) return null; // Ne pas inclure la grille
                      return obj;
                  });

                  const result = await createSvgPlan(planName, svgString, universIds); // Appel API
                  if (result.success && result.plan_id) {
                      showToast(`Plan "${planName}" créé avec succès ! Redirection...`, "success");
                      // Attendre un peu avant de rediriger pour que le toast soit visible
                      setTimeout(() => {
                           window.location.href = `index.php?action=manageCodes&id=${result.plan_id}`;
                      }, 1500);
                  } else {
                      // L'API devrait avoir levé une erreur si !result.success
                      throw new Error("La création du plan a échoué (réponse API invalide).");
                  }
               } catch (error) {
                   console.error("Erreur création SVG:", error);
                   showToast(`Erreur: ${error.message}`, "danger");
               } finally {
                   hideLoading();
               }
          });
     }

    // --- Listeners pour la Toolbar de Dessin ---
    const toolBtns = document.querySelectorAll('#drawing-toolbar .tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.tool;
            console.log(`Tool Button Clicked: ${tool}`);
            setActiveTool(tool);
            // Pas besoin d'appeler updateDrawingToolButtons ici car setActiveTool le fait déjà
        });
    });

    // Options de dessin (Couleur, Épaisseur, Remplissage)
    const strokeColorPicker = document.getElementById('stroke-color-picker');
    const fillColorPicker = document.getElementById('fill-color-picker');
    const fillTransparentBtn = document.getElementById('fill-transparent-btn');

    if (strokeColorPicker) strokeColorPicker.addEventListener('input', updateDrawingStyleFromInput);
    if (fillColorPicker) fillColorPicker.addEventListener('input', updateDrawingStyleFromInput);
    if (fillTransparentBtn) fillTransparentBtn.addEventListener('click', setTransparentFillAndUpdate);

    // Grille et Magnétisme
     const gridToggle = document.getElementById('grid-toggle');
     const snapToggle = document.getElementById('snap-toggle');
     if(gridToggle) gridToggle.addEventListener('change', () => updateGrid(fabricCanvas.getZoom()));
     if(snapToggle) snapToggle.addEventListener('change', toggleSnapToGrid);

    // Presse-papiers et Groupement
    const copyBtn = document.getElementById('copy-btn');
    const pasteBtn = document.getElementById('paste-btn');
    const groupBtn = document.getElementById('group-btn');
    const ungroupBtn = document.getElementById('ungroup-btn');

    if (copyBtn) copyBtn.addEventListener('click', () => { console.log("Copy Button Clicked"); copyShape(); });
    if (pasteBtn) pasteBtn.addEventListener('click', () => { console.log("Paste Button Clicked"); pasteShape(); });
    if (groupBtn) groupBtn.addEventListener('click', () => { console.log("Group Button Clicked"); groupSelectedObjects(); });
    if (ungroupBtn) ungroupBtn.addEventListener('click', () => { console.log("Ungroup Button Clicked"); ungroupSelectedObject(); });


    // Assets (ouverture offcanvas gérée par Bootstrap via data-bs-toggle)
    const saveAssetBtn = document.getElementById('save-asset-btn');
    const assetsListContainer = document.getElementById('assets-list');
    const assetsOffcanvasEl = document.getElementById('assetsOffcanvas');

    if (saveAssetBtn) {
        saveAssetBtn.addEventListener('click', handleSaveAsset);
    }
    // Charger la liste des assets quand l'offcanvas s'ouvre
    if (assetsOffcanvasEl) {
        assetsOffcanvasEl.addEventListener('show.bs.offcanvas', loadAssetsList);
    }
    // Gérer le clic sur un asset dans la liste
    if (assetsListContainer) {
         assetsListContainer.addEventListener('click', handleAssetClick);
    }

    // --- Listeners pour la Toolbar d'Édition de Tag (gérée par geo-tags.js) ---
    // On attache juste le bouton Supprimer qui appelle notre fonction locale
    const deleteBtn = document.getElementById('toolbar-delete');
    if (deleteBtn) deleteBtn.addEventListener('click', () => {
         console.log("Delete Tag Button Clicked");
         const activeObj = fabricCanvas.getActiveObject();
         if (activeObj) {
            handleDeleteObject(activeObj); // Appelle la fonction de suppression
         }
    });
    // Les autres boutons (highlight, arrow, size) sont gérés dans geo-tags.js


    console.log("All event listeners attached.");
}


// --- GESTIONNAIRES D'ÉVÉNEMENTS SOURIS (Pan, Dessin, Placement) ---

function handleMouseDown(options) {
    console.log("Canvas mouse down detected!");
    const evt = options.e;
    const target = options.target;
    const pointer = fabricCanvas.getPointer(evt);

    if (options.button === 3 || evt.ctrlKey) { // Clic droit ou Ctrl+Clic
        // handleRightClick(options); // Menu contextuel (désactivé pour l'instant)
        console.log("Right click detected");
        return;
    }

    // Gérer le Pan avec Alt+Clic ou Clic molette (button 2)
    if (evt.altKey || options.button === 2) {
        console.log("Starting pan");
        startPan(evt);
        return; // Important: ne pas traiter d'autres actions si on Pan
    }

    // Si on clique sur un objet existant
    if (target && !target.isGridLine) { // Ignorer clic sur grille
        console.log("Mouse down on object:", target.type);
        // La sélection est gérée par les événements 'selection:*' de Fabric
        // On ne fait rien de spécial ici pour le clic gauche sur un objet,
        // sauf si on est en mode dessin (pour ne pas démarrer un nouveau dessin)
        if (getCurrentDrawingTool() !== 'select') {
             console.log("Click on object while in drawing mode - ignoring.");
             // Empêche de démarrer un nouveau dessin si on clique sur un objet existant
             // Mais permet la sélection si on revient en mode 'select'
        }
        return;
    }

    // Clic sur le fond du canvas
    console.log("Mouse down on canvas background.");
    const currentTool = getCurrentDrawingTool();

    if (currentTool === 'tag') { // Mode placement de tag/texte géo (activé via sidebar)
        console.log("Handling canvas click for geo element placement");
        handleCanvasClick(options); // Gère le placement
    }
    else if (currentTool !== 'select') { // Outil de dessin actif (rect, line, etc.)
        console.log("Starting drawing with tool:", currentTool);
        startDrawing(options); // Géré par drawing-tools.js
    }
    else {
        // Clic gauche en mode select sur le fond -> Désélectionner
        console.log("Deselecting objects (click on background)");
        fabricCanvas.discardActiveObject().renderAll();
        handleObjectDeselected(); // Assure que la sidebar est désélectionnée
        hideToolbar(); // Cacher la toolbar
    }
}


function handleMouseMove(options) {
    const evt = options.e;
    if (fabricCanvas.isDragging) { // Si on est en train de "Pan"
        // console.log("Continuing pan"); // Peut être très verbeux
        continuePan(evt);
    }
    else if (getIsDrawing()) { // Si on est en train de dessiner une forme
        // console.log("Continuing drawing"); // Peut être très verbeux
        continueDrawing(options);
    }
    // Pas d'action spéciale au survol pour l'instant
}

function handleMouseUp(options) {
    if (fabricCanvas.isDragging) { // Si on terminait un "Pan"
        console.log("Stopping pan");
        stopPan();
    }
    else if (getIsDrawing()) { // Si on terminait un dessin
        console.log("Stopping drawing");
        const drawnObject = stopDrawing(options); // Récupère l'objet dessiné
        if (drawnObject) {
            console.log("Drawing complete, object:", drawnObject.type);
            handleDrawingComplete(drawnObject); // Traite l'objet finalisé
        }
    }

    // Gestion spéciale pour l'outil texte qui se crée au mouseUp (clic simple)
    const currentTool = getCurrentDrawingTool();
    // Conditions : outil texte, PAS en train de dessiner (car startDrawing met isDrawing=false pour texte),
    // PAS sur un objet, PAS un mouseout (évite création texte en quittant canvas)
    if (currentTool === 'text' && !getIsDrawing() && !options.target && options.e.type !== 'mouseout') {
         console.log("Creating text object on mouse up");
         const textObject = stopDrawing(options); // stopDrawing gère la création de texte dans drawing-tools.js
         if (textObject) {
             console.log("Text object created");
             handleDrawingComplete(textObject);
         }
    }
}


// --- FONCTIONS AIDE AU PAN ---
function startPan(evt) {
    if (getIsDrawing()) return; // Ne pas panner si on dessine
    fabricCanvas.isDragging = true;
    fabricCanvas.selection = false; // Désactive sélection pendant pan
    fabricCanvas.lastPosX = evt.clientX;
    fabricCanvas.lastPosY = evt.clientY;
    fabricCanvas.defaultCursor = 'grabbing';
    fabricCanvas.hoverCursor = 'grabbing';
     // Désactiver evented pour les objets pendant le pan pour éviter sélection accidentelle
     fabricCanvas.getObjects().forEach(o => { if(!o.isGridLine) o.set('evented', false) });
    fabricCanvas.requestRenderAll();
}
function continuePan(evt) {
    if (!fabricCanvas.isDragging) return;
    const vpt = fabricCanvas.viewportTransform;
    vpt[4] += evt.clientX - fabricCanvas.lastPosX;
    vpt[5] += evt.clientY - fabricCanvas.lastPosY;
    fabricCanvas.requestRenderAll();
    fabricCanvas.lastPosX = evt.clientX;
    fabricCanvas.lastPosY = evt.clientY;
}
function stopPan() {
    if (!fabricCanvas.isDragging) return;
    fabricCanvas.setViewportTransform(fabricCanvas.viewportTransform);
    fabricCanvas.isDragging = false;
    fabricCanvas.selection = (getCurrentDrawingTool() === 'select'); // Réactiver si en mode select
    fabricCanvas.defaultCursor = (getCurrentDrawingTool() === 'select') ? 'default' : 'crosshair';
    fabricCanvas.hoverCursor = (getCurrentDrawingTool() === 'select') ? 'move' : 'crosshair';
     // Réactiver evented pour les objets
     fabricCanvas.getObjects().forEach(o => o.set('evented', true));
    fabricCanvas.requestRenderAll();
}


// --- GESTIONNAIRES D'ÉVÉNEMENTS (Canvas - Sélection, Modification) ---

// Gère selection:created et selection:updated
function handleSelectionChange(selectedItems) {
    if (!selectedItems || selectedItems.length === 0) {
        console.log("Selection cleared or empty");
        hideToolbar(); // Cacher toolbar quand rien n'est sélectionné
        handleObjectDeselected();
        updateGroupButtonStates();
        return;
    }

    const activeSelection = fabricCanvas.getActiveObject();
    console.log("Selection changed:", activeSelection.type);

    if (activeSelection.type === 'activeSelection') { // Sélection multiple
        handleObjectDeselected(); // Désélectionner sidebar
        hideToolbar(); // Cacher toolbar tag/texte géo
        // updateDrawingStyleFromObject(activeSelection._objects[0]); // Optionnel: màj couleurs
        console.log(`${activeSelection.size()} objects selected`);
    }
    else { // Sélection simple
        const target = activeSelection;
        if (target.customData?.isGeoTag || target.customData?.isPlacedText) {
            console.log("Geo element selected:", target.customData.codeGeo);
            showToolbar(target); // Afficher toolbar géo
            handleObjectSelected(target); // Met à jour sidebar
        } else if (!target.isGridLine){ // Objet dessin sélectionné (et pas grille)
            console.log("Drawing element selected:", target.type);
            hideToolbar(); // Cacher toolbar géo
            handleObjectDeselected(); // Désélectionne sidebar
            updateDrawingStyleFromObject(target); // Met à jour les couleurs/épaisseur
        } else { // Grille sélectionnée (ne devrait pas arriver avec evented: false)
             fabricCanvas.discardActiveObject().renderAll();
             hideToolbar();
        }
    }
    updateGroupButtonStates(); // Met à jour état boutons Grouper/Dégrouper
}


function handleObjectSelected(target) {
    const positionId = target.customData?.position_id;
    if (!positionId && !target.customData?.id) return; // Besoin d'au moins l'ID du code

    const geoCodeId = target.customData.id;

    // Highlight dans la liste "Placés"
    document.querySelectorAll('#placed-list .list-group-item').forEach(item => {
        // Un objet texte peut correspondre à plusieurs positions s'il est sur un SVG
        const itemPositionIds = JSON.parse(item.dataset.positionIds || '[]');
        const matchesPosition = positionId && (item.dataset.positionId == positionId || itemPositionIds.includes(positionId));
        const matchesCodeId = item.dataset.id == geoCodeId;

        // Active si l'ID du code correspond ET (soit l'ID de position correspond, soit on n'a pas d'ID de position mais c'est le bon code)
        if (matchesCodeId && (matchesPosition || !positionId)) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
     // Désélectionner dans la liste "Disponibles"
     document.querySelectorAll('#dispo-list .list-group-item.active').forEach(el => el.classList.remove('active'));
}

function handleObjectDeselected() {
    // Retirer highlight des listes "Placés" et "Disponibles"
    document.querySelectorAll('#placed-list .list-group-item.active').forEach(item => {
        item.classList.remove('active');
    });
     document.querySelectorAll('#dispo-list .list-group-item.active').forEach(el => el.classList.remove('active'));
     // Cacher la toolbar (au cas où selection:cleared n'aurait pas été appelé)
     hideToolbar();
}

// --- GESTIONNAIRES D'ACTIONS (CRUD Géo) ---

// Appelée après placement manuel (clic) ou via menu
async function handleObjectPlaced(fabricObject, geoCodeId, clickPoint = null) {
    if (!fabricObject || !geoCodeId) {
        console.error("handleObjectPlaced: Objet Fabric ou geoCodeId manquant.");
        return;
    }
    showLoading("Sauvegarde position...");
    try {
        const center = clickPoint ? clickPoint : fabricObject.getCenterPoint();
        const { posX, posY } = convertPixelsToPercent(center.x, center.y, fabricCanvas);

        const positionData = {
            id: parseInt(geoCodeId, 10), // ID du code géo
            plan_id: currentPlanId,
            pos_x: posX,
            pos_y: posY,
            // Pour tag: utilise taille fixe ; Pour texte: width/height sont null
            width: fabricObject.customData.isGeoTag ? (fabricObject.width * fabricObject.scaleX) : null,
            height: fabricObject.customData.isGeoTag ? (fabricObject.height * fabricObject.scaleY) : null,
            // Pour texte: ancre SVG ; Pour tag: ancre flèche (peut être null)
            anchor_x: fabricObject.customData.anchorSvgId || fabricObject.customData.anchorXPercent || null,
            anchor_y: fabricObject.customData.anchorYPercent || null,
            position_id: null // Indique une création
        };

        const savedPosition = await savePosition(positionData); // Appel API (modules/api.js)

        // Mettre à jour l'objet Fabric avec le position_id retourné
        fabricObject.set('customData', {
            ...fabricObject.customData,
            position_id: savedPosition.id, // L'API renvoie 'id' pour la position
            plan_id: savedPosition.plan_id,
            // Mettre à jour les % avec la valeur retournée (au cas où)
            pos_x: savedPosition.pos_x,
            pos_y: savedPosition.pos_y,
            // Assurer que l'ID du code géo est bien là
             id: parseInt(geoCodeId, 10)
        });
        // Si c'est un texte SVG, s'assurer que l'ancre est bien stockée
        if (fabricObject.customData.isPlacedText && !fabricObject.customData.anchorSvgId) {
             fabricObject.customData.anchorSvgId = savedPosition.anchor_x;
        }

        fabricCanvas.requestRenderAll();
        showToast(`Code "${fabricObject.customData.codeGeo}" placé.`, 'success');
        await fetchAndClassifyCodes(); // Met à jour les listes de la sidebar

    } catch (error) {
        console.error("Erreur lors de la sauvegarde de la position:", error);
        showToast(`Échec sauvegarde: ${error.message}`, 'error');
        if (fabricObject) fabricCanvas.remove(fabricObject); // Supprimer l'objet du canvas si sauvegarde échoue
    } finally {
        hideLoading();
        setActiveTool('select'); // Repasse en mode sélection après placement
        updateDrawingToolButtons(); // Met à jour l'UI des boutons
    }
}


/** Appelé lorsqu'un objet Géo est déplacé sur le canvas (via object:modified). */
async function handleObjectMoved(target) {
    if (!target?.customData?.position_id || !target.customData?.id) {
        console.warn("Objet déplacé sans position_id ou id (geoCodeId), sauvegarde annulée.", target.customData);
        return; // Ne pas sauvegarder si les ID manquent
    }
    showLoading("Mise à jour position...");
    try {
        const center = target.getCenterPoint();
        const { posX, posY } = convertPixelsToPercent(center.x, center.y, fabricCanvas);
        const positionId = target.customData.position_id;
        const geoCodeId = target.customData.id;

        const positionData = {
            id: parseInt(geoCodeId, 10), // PHP attend 'id' pour le geo_code_id
            plan_id: currentPlanId,
            pos_x: posX,
            pos_y: posY,
            width: target.customData.isGeoTag ? (target.width * target.scaleX) : null,
            height: target.customData.isGeoTag ? (target.height * target.scaleY) : null,
            anchor_x: target.customData.anchorSvgId || target.customData.anchorXPercent || null,
            anchor_y: target.customData.anchorYPercent || null
            // position_id sera ajouté par la fonction savePosition JS
        };

        // Appel API (savePosition JS ajoute position_id pour l'update)
        const updatedPosition = await savePosition(positionData, positionId); // modules/api.js

        showToast(`Position de "${target.customData.codeGeo}" mise à jour.`, 'success');

        // Mettre à jour les % dans l'objet fabric
        target.set('customData', {
             ...target.customData,
             pos_x: updatedPosition.pos_x, // Utiliser les valeurs retournées
             pos_y: updatedPosition.pos_y
        });
        target.setCoords();
        // Mettre à jour la toolbar si elle est visible pour cet objet
        if (fabricCanvas.getActiveObject() === target) {
             showToolbar(target);
        }

    } catch (error) {
        console.error("Erreur lors de la mise à jour de la position:", error);
        showToast(`Échec mise à jour: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function handleDeleteObject(target) {
    if (!target || !(target.customData?.isGeoTag || target.customData?.isPlacedText)) {
        console.warn("handleDeleteObject: target n'est pas un élément géo valide.");
        return;
    }

    const positionId = target.customData?.position_id;
    const codeGeo = target.customData?.codeGeo || "inconnu";

    if (!positionId) {
        console.warn("Tentative de suppression locale objet sans position_id (probablement juste dessiné/placé sans sauvegarde).");
        fabricCanvas.remove(target);
        fabricCanvas.discardActiveObject().renderAll();
        hideToolbar();
        // Pas besoin de rafraîchir sidebar si ce n'était pas un code placé via BDD
        return;
    }

    if (!confirm(`Supprimer "${codeGeo}" du plan ?`)) return;

    showLoading("Suppression...");
    try {
        await removePosition(positionId); // API via modules/api.js
        fabricCanvas.remove(target);
        fabricCanvas.discardActiveObject().renderAll();
        hideToolbar();
        showToast(`"${codeGeo}" supprimé du plan.`, 'success');
        await fetchAndClassifyCodes(); // Met à jour la sidebar
    } catch (error) {
        console.error("Erreur suppression:", error);
        showToast(`Échec suppression: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// --- GESTION DES DESSINS ---

function handleDrawingComplete(drawnObject) {
    const mode = getCurrentDrawingTool();
    if (['rect', 'circle', 'line', 'text'].includes(mode)) {
        console.log(`Dessin ${mode} terminé.`);
        // Activer la sélection pour l'objet dessiné
        drawnObject.set({ selectable: true, evented: true });
        // Sauvegarder l'état du dessin (si nécessaire et si type image)
        triggerAutoSaveDrawing(); // Sauvegarde auto si type image, sinon ne fait rien
    }
}


// Fonction pour sauvegarder les annotations JSON (plan type 'image')
// Peut être appelée après chaque modif ou sur clic bouton
let saveTimeout;
function triggerAutoSaveDrawing(forceSave = false) {
    if (planType !== 'image') return; // Sauvegarde JSON seulement pour les images

    clearTimeout(saveTimeout);
    const delay = forceSave ? 0 : 1500; // Pas de délai si forcé

    saveTimeout = setTimeout(async () => {
         console.log("Sauvegarde des annotations (JSON)...");
         const drawingData = fabricCanvas.toJSON(['customData', 'selectable', 'evented', 'baseStrokeWidth']);
         // Exclure les tags géo et les lignes de grille de la sauvegarde JSON
         drawingData.objects = drawingData.objects.filter(obj =>
             !obj.isGridLine &&
             !(obj.customData?.isGeoTag || obj.customData?.isPlacedText)
         );
         try {
             await saveDrawingData(currentPlanId, drawingData.objects.length > 0 ? drawingData : null);
             console.log("Annotations JSON sauvegardées via API.");
             if (forceSave) showToast("Annotations enregistrées.", "success");
         } catch(error) {
             console.error("Erreur sauvegarde annotations:", error);
             showToast(`Erreur sauvegarde annotations: ${error.message}`, "danger");
         }
    }, delay);
}


// Fonction pour sauvegarder le SVG modifié (plan type 'svg')
// Appelée sur clic bouton 'Sauvegarder SVG'
async function saveModifiedSvgPlan() {
    console.log("Début saveModifiedSvgPlan.");
    if (planType !== 'svg' || !currentPlanId) {
         console.warn("saveModifiedSvgPlan annulé: type incorrect ou ID manquant.");
         throw new Error("Sauvegarde SVG non applicable pour ce type de plan.");
    }

    // Récupérer tous les objets (y compris les formes SVG natives et les dessins ajoutés)
    // Exclure les tags/textes géo et la grille
    const objectsToExport = fabricCanvas.getObjects().filter(obj =>
        !obj.isGridLine &&
        !(obj.customData?.isGeoTag || obj.customData?.isPlacedText)
    );

    console.log(`Export SVG de ${objectsToExport.length} objets.`);

    // Fabric gère l'export SVG de tous les objets présents
    const svgString = fabricCanvas.toSVG(['customData', 'baseStrokeWidth']);

    console.log("SVG final généré (début):", svgString.substring(0, 200) + "...");

    // Appel API via api.js
    await updateSvgPlan(currentPlanId, svgString);
    console.log("Modifications SVG envoyées à l'API.");
}


// --- GESTION DES OUTILS DE DESSIN (Couleurs, Styles, Groupe, Presse-papiers) ---

function updateDrawingStyleFromInput() {
    const strokeColor = document.getElementById('stroke-color-picker')?.value || '#000000';
    const fillColor = document.getElementById('fill-color-picker')?.value || '#FFFFFF';
    const fillTransparentBtn = document.getElementById('fill-transparent-btn');
    const isFillTransparent = fillTransparentBtn ? !fillTransparentBtn.classList.contains('active') : true;

    const finalFill = isFillTransparent ? 'transparent' : fillColor;

    // Mise à jour de l'objet sélectionné (si c'est un dessin)
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && !(activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText || activeObject.isGridLine)) {
         console.log(`Updating style for selected ${activeObject.type}: stroke=${strokeColor}, fill=${finalFill}`);
         const updateProps = {
             stroke: strokeColor,
             fill: finalFill,
             // L'épaisseur (strokeWidth) n'est pas modifiée ici, seulement via son input dédié
         };

         if (activeObject.type === 'activeSelection') {
             activeObject.forEachObject(obj => { if (!obj.isGridLine) obj.set(updateProps); });
         } else {
             activeObject.set(updateProps);
         }
         fabricCanvas.requestRenderAll();
         triggerAutoSaveDrawing(); // Sauvegarde auto si type image
    } else {
         console.log("UpdateDrawingStyle: No drawing object selected.");
    }

    // Mettre à jour les valeurs par défaut pour les prochains dessins
    // via les fonctions dédiées dans drawing-tools.js
    // setStrokeColor(strokeColor); // Déjà fait implicitement car drawing-tools lit les inputs
    // setFillColor(finalFill);
}

// Gère le clic sur le bouton "Fond transparent"
function setTransparentFillAndUpdate() {
    const btn = document.getElementById('fill-transparent-btn');
    if (!btn) return;
    // Inverse l'état actif (visuel)
    btn.classList.toggle('active');
    console.log("Transparent Fill button toggled. Active:", btn.classList.contains('active'));
    // Met à jour le style (prend en compte le nouvel état)
    updateDrawingStyleFromInput();
}

// Met à jour les pickers de couleur quand un objet dessin est sélectionné
function updateDrawingStyleFromObject(target) {
     if (!target || target.customData?.isGeoTag || target.customData?.isPlacedText || target.isGridLine) return;
     console.log("Updating color pickers from selected object:", target.type);

     const strokeColorPicker = document.getElementById('stroke-color-picker');
     const fillColorPicker = document.getElementById('fill-color-picker');
     const fillTransparentBtn = document.getElementById('fill-transparent-btn');

     if (strokeColorPicker) strokeColorPicker.value = target.stroke || '#000000';

     const fill = target.fill;
     if (fill && fill !== 'transparent' && typeof fill === 'string') {
         if (fillColorPicker) fillColorPicker.value = fill;
         if (fillTransparentBtn) fillTransparentBtn.classList.add('active'); // Non-transparent
         console.log("Fill set to:", fill);
     } else {
         if (fillColorPicker) fillColorPicker.value = '#FFFFFF'; // Reset picker
         if (fillTransparentBtn) fillTransparentBtn.classList.remove('active'); // Transparent
         console.log("Fill set to transparent");
     }
}

// Met à jour l'état activé/désactivé des boutons Grouper/Dégrouper
function updateGroupButtonStates() {
    const groupBtn = document.getElementById('group-btn');
    const ungroupBtn = document.getElementById('ungroup-btn');
    if (!groupBtn || !ungroupBtn) return;

    const activeObject = fabricCanvas.getActiveObject();
    let canGroup = false;
    let canUngroup = false;

    if (activeObject) {
        if (activeObject.type === 'activeSelection') {
            // Peut grouper si sélection multiple (>1) et aucun objet n'est géo/grille/SVG natif
            const objects = activeObject.getObjects();
            canGroup = objects.length > 1 && !objects.some(obj =>
                obj.customData?.isGeoTag || obj.customData?.isPlacedText || obj.isGridLine || obj.isSvgShape
            );
        } else if (activeObject.type === 'group' && !(activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText || activeObject.isSvgShape)) {
            // Peut dégrouper si c'est un groupe de dessin
            canUngroup = true;
        }
    }

    groupBtn.disabled = !canGroup;
    ungroupBtn.disabled = !canUngroup;
    // console.log(`Group buttons updated: canGroup=${canGroup}, canUngroup=${canUngroup}`);
}

// --- GESTION DES ASSETS ---

async function handleSaveAsset() {
    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject || activeObject.isGridLine || activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText || activeObject.isSvgShape) {
        showToast("Veuillez sélectionner un ou plusieurs objets DESSINÉS à enregistrer comme asset.", "warning");
        return;
    }
    // Vérifier si la sélection multiple contient des éléments non autorisés
     if (activeObject.type === 'activeSelection') {
         const containsInvalid = activeObject.getObjects().some(obj => obj.isGridLine || obj.customData?.isGeoTag || obj.customData?.isPlacedText || obj.isSvgShape);
         if (containsInvalid) {
             showToast("La sélection contient des éléments non enregistrables (tags géo, grille, SVG natif).", "warning");
             return;
         }
     }

    const assetName = prompt("Entrez un nom pour cet asset :");
    if (!assetName || assetName.trim() === '') {
        showToast("Nom d'asset invalide.", "info");
        return;
    }

    showLoading("Sauvegarde de l'asset...");
    try {
        // Cloner l'objet/groupe pour ne pas modifier l'original
        activeObject.clone(async (cloned) => {
             // Exporter le clone en objet JSON (plus simple que toJSON)
             // Inclure nos propriétés custom (baseStrokeWidth, etc.)
             const assetData = cloned.toObject(['customData', 'baseStrokeWidth']);

             try {
                await saveAsset(assetName.trim(), assetData); // Appel API via api.js
                showToast(`Asset "${assetName.trim()}" enregistré !`, "success");
                // Optionnel: rafraîchir la liste dans l'offcanvas s'il est ouvert
                if (document.getElementById('assetsOffcanvas')?.classList.contains('show')) {
                    loadAssetsList();
                }
             } catch (apiError) {
                  console.error("Erreur API sauvegarde asset:", apiError);
                  showToast(`Erreur sauvegarde asset: ${apiError.message}`, "danger");
             } finally {
                 hideLoading();
             }
        }, ['customData', 'baseStrokeWidth']); // Propriétés à inclure dans le clone

    } catch (cloneError) {
        console.error("Erreur clonage pour asset:", cloneError);
        showToast("Erreur lors de la préparation de l'asset.", "danger");
        hideLoading();
    }
}


async function loadAssetsList() {
    const listContainer = document.getElementById('assets-list');
    if (!listContainer) return;
    listContainer.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div>';

    try {
        const assets = await listAssets(); // Appel API via api.js
        if (assets.length === 0) {
            listContainer.innerHTML = '<p class="text-muted small">Aucun asset enregistré.</p>';
            return;
        }
        listContainer.innerHTML = ''; // Vider avant d'ajouter
        assets.forEach(asset => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action asset-item d-flex justify-content-between align-items-center'; // Added flex for delete button
            item.dataset.assetId = asset.id;
            item.textContent = asset.name;
            // TODO: Ajouter bouton suppression
            // const deleteBtn = document.createElement('button'); ... item.appendChild(deleteBtn);
            listContainer.appendChild(item);
        });
    } catch (error) {
        console.error("Erreur chargement assets:", error);
        listContainer.innerHTML = '<p class="text-danger small">Erreur chargement.</p>';
        showToast(`Erreur chargement assets: ${error.message}`, "danger");
    }
}

async function handleAssetClick(event) {
     event.preventDefault();
     const assetItem = event.target.closest('.asset-item');
     if (!assetItem) return;

     const assetId = assetItem.dataset.assetId;
     console.log("Loading asset:", assetId);
     showLoading("Chargement de l'asset...");

     try {
        const asset = await getAssetData(assetId); // Appel API via api.js
        if (!asset || !asset.data) throw new Error("Données d'asset invalides.");

        // Les données sont déjà un objet JS car api.js parse le JSON
        const assetDataObject = asset.data;

        // Charger l'objet depuis les données objet
        fabric.util.enlivenObjects([assetDataObject], (objects) => {
            if (!objects || objects.length === 0) {
                 throw new Error("Impossible de recréer l'objet depuis les données.");
            }
            const objectToAdd = objects[0];

             // Positionner au centre du viewport actuel
            const center = fabricCanvas.getVpCenter();
            objectToAdd.set({
                 left: center.x,
                 top: center.y,
                 originX: 'center',
                 originY: 'center',
                 selectable: true,
                 evented: true,
                 justCreated: true // Flag pour sauvegarde si plan image
             });

            // S'assurer que les propriétés custom sont bien là
             objectToAdd.customData = assetDataObject.customData || {};
             objectToAdd.baseStrokeWidth = assetDataObject.baseStrokeWidth || 1;
             // Adapter strokeWidth au zoom actuel
             const zoom = fabricCanvas.getZoom();
             objectToAdd.set('strokeWidth', (objectToAdd.baseStrokeWidth || 1) / zoom);
             // Si c'est un groupe, appliquer aux enfants aussi
             if (objectToAdd.type === 'group') {
                 objectToAdd.forEachObject(obj => {
                     obj.set('strokeWidth', (obj.baseStrokeWidth || 1) / zoom);
                 });
             }

            fabricCanvas.add(objectToAdd);
            fabricCanvas.setActiveObject(objectToAdd); // Sélectionner l'objet ajouté
            objectToAdd.setCoords();
            fabricCanvas.requestRenderAll();
            showToast(`Asset "${asset.name}" ajouté.`, "success");

            // Fermer l'offcanvas
            const offcanvasInstance = bootstrap.Offcanvas.getInstance(document.getElementById('assetsOffcanvas'));
            offcanvasInstance?.hide();

            // Déclencher sauvegarde auto si type image
            triggerAutoSaveDrawing();

        }, ''); // Namespace vide

     } catch (error) {
         console.error("Erreur chargement asset:", error);
         showToast(`Erreur chargement asset: ${error.message}`, "danger");
     } finally {
         hideLoading();
     }
}

// --- Fonctions utilitaires ---

// Met à jour l'état visuel des boutons d'outils
function updateDrawingToolButtons() {
    const currentTool = getCurrentDrawingTool();
    document.querySelectorAll('#drawing-toolbar .tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === currentTool);
    });
}

// Met à jour l'état visuel du bouton de verrouillage
function updateLockButtonState() {
     const lockBtn = document.getElementById('toggle-lock-svg-btn');
     if (!lockBtn) return;
     const isLocked = getCanvasLock();
     lockBtn.classList.toggle('active', isLocked);
     const btnText = lockBtn.querySelector('.btn-text');
     const btnIcon = lockBtn.querySelector('i');
     if (btnText) btnText.textContent = isLocked ? 'Verrouillé' : 'Déverrouillé';
     if (btnIcon) {
         btnIcon.classList.toggle('bi-lock-fill', isLocked);
         btnIcon.classList.toggle('bi-unlock-fill', !isLocked);
     }
}

// --- Initial Geo Elements ---
// (Utilise les fonctions de placement génériques)

function createInitialGeoElements(placedGeoCodes, planType) {
    console.log("Création éléments géo initiaux...");
    if (!fabricCanvas || !placedGeoCodes || placedGeoCodes.length === 0) {
        console.warn("createInitialGeoElements: Prérequis non remplis."); return;
    }
    let createdCount = 0;
    const elementsToCreate = [];

    placedGeoCodes.forEach(codeInfo => {
        if (codeInfo.placements && Array.isArray(codeInfo.placements)) {
            codeInfo.placements.forEach(placement => {
                // Filtrer par plan ID
                if (placement.plan_id != currentPlanId) return;

                // Combiner infos code + infos placement
                // Utiliser placement.id comme position_id, et codeInfo.id comme geoCodeId
                const elementData = {
                     ...codeInfo, // Contient id (geoCodeId), code_geo, libelle, univers_nom etc.
                     ...placement, // Contient plan_id, pos_x, pos_y, width, height, anchor_x, anchor_y
                     position_id: placement.id // Assurer que position_id est l'ID de la table geo_positions
                 };
                delete elementData.placements; // Nettoyer

                // Déterminer si c'est un Texte (pas de width/height) ou un Tag (avec width/height)
                 // Critère: width ET height sont null/undefined -> Texte
                if (placement.width === null && placement.height === null) { // Texte
                    if (planType === 'svg') {
                        // Chercher la forme SVG d'ancrage par son ID (stocké dans anchor_x pour les textes SVG)
                        // Note: findSvgShapeByCodeGeo utilise customData.svgId, donc anchor_x doit correspondre
                        const targetSvgShape = findSvgShapeByCodeGeo(elementData.anchor_x);
                        const textObject = placeTextOnSvg(elementData, targetSvgShape);
                        if (textObject) elementsToCreate.push(textObject);
                    } else {
                         console.warn(`Texte géo (ID ${elementData.id}) trouvé pour un plan image, ignoré.`);
                    }
                }
                else if (elementData.pos_x !== null && elementData.pos_y !== null) { // Tag Rectangulaire avec position
                     if (planType === 'image') {
                        // Calculer la position pixel depuis le pourcentage
                        const { left, top } = convertPercentToPixels(elementData.pos_x, elementData.pos_y, fabricCanvas);
                        if (!isNaN(left) && !isNaN(top)) {
                             const tagObject = placeTagAtPoint(elementData, { x: left, y: top });
                             if (tagObject) {
                                 elementsToCreate.push(tagObject);
                                 // L'ajout de flèche sera fait après l'ajout au canvas
                             }
                        } else { console.warn(`Coordonnées pixels invalides pour tag ${elementData.code_geo}`); }
                    } else {
                         console.warn(`Tag rectangulaire (ID ${elementData.id}) trouvé pour un plan SVG, ignoré.`);
                    }
                } else {
                     console.warn(`Élément géo (ID ${elementData.id}) sans type identifiable ou sans position (pos_x/y), ignoré.`);
                }
            });
        }
    });

    // Ajouter tous les éléments créés
    elementsToCreate.forEach(el => {
        fabricCanvas.add(el); // Ajoute au canvas
        // Ajouter la flèche si nécessaire APRES ajout au canvas
        if (el.customData?.isGeoTag && el.customData.anchorXPercent !== null && el.customData.anchorYPercent !== null) {
            addArrowToTag(el); // Appelle la fonction importée de geo-tags.js
        }
    });


    console.log(`${elementsToCreate.length} éléments géo initiaux créés sur le canvas.`);
    fabricCanvas.requestRenderAll();
}

/**
 * Place un objet Texte Géo sur une forme SVG ou à des coordonnées.
 * @param {object} codeData - Données complètes du code et de sa position.
 * @param {fabric.Object|null} targetSvgShape - La forme SVG d'ancrage (si trouvée).
 * @returns {fabric.IText|null} L'objet texte créé ou null.
 */
function placeTextOnSvg(codeData, targetSvgShape) {
    let textCoords = { x: 0, y: 0 };
    let anchorId = null;

    if (targetSvgShape && targetSvgShape.getCenterPoint) {
        // Positionner au centre de la forme SVG d'ancrage
        const center = targetSvgShape.getCenterPoint();
        textCoords.x = center.x;
        textCoords.y = center.y;
        anchorId = targetSvgShape.customData?.svgId; // Utiliser l'ID de la forme comme ancre
        console.log(`Placement texte ${codeData.code_geo} sur SVG ${anchorId}`);
    }
    else if (codeData.pos_x !== null && codeData.pos_y !== null) {
         // Fallback: utiliser les coordonnées en % si pas d'ancre SVG trouvée
        const { left, top } = convertPercentToPixels(codeData.pos_x, codeData.pos_y, fabricCanvas); // <--- L'APPEL QUI ÉCHOUAIT
        if (!isNaN(left) && !isNaN(top)) {
            textCoords.x = left;
            textCoords.y = top;
            console.log(`Placement texte ${codeData.code_geo} par coords % (fallback)`);
        } else {
            console.error(`Coordonnées invalides pour fallback texte ${codeData.code_geo}`);
            return null; // Impossible de placer
        }
    }
    else {
         console.warn(`Texte ${codeData.code_geo} sans ancre SVG ni coords %, placement au centre canvas.`);
         const center = fabricCanvas.getCenter(); // Centre du canvas actuel (pas idéal mais fallback)
         textCoords.x = center.left;
         textCoords.y = center.top;
    }

    const textToShow = codeData.code_geo || 'ERREUR';
    const fontSize = (GEO_TEXT_FONT_SIZE || 16);

    const textObject = new fabric.IText(textToShow, {
        left: textCoords.x, top: textCoords.y,
        originX: 'center', originY: 'center',
        fontSize: fontSize, // Utiliser la taille de base
        fill: '#000000', // Noir
        stroke: '#FFFFFF', // Contour blanc
        paintFirst: 'stroke', // Dessiner contour d'abord
        strokeWidth: 0.5, // Épaisseur de base (sera adaptée au zoom par updateStrokesWidth)
        baseStrokeWidth: 0.5, // Stocker épaisseur de base
        fontFamily: 'Arial', textAlign: 'center', fontWeight: 'bold',
        selectable: true, evented: true, hasControls: false, hasBorders: true,
        borderColor: '#007bff', // Bordure bleue pour sélection
        cornerSize: 0, transparentCorners: true,
        lockRotation: true,
        // lockScalingX: true,
        // lockScalingY: true,

        // Données perso importantes
        customData: {
            ...codeData, // Inclut id, code_geo, libelle, univers_nom, etc.
            isPlacedText: true, isGeoTag: false,
            anchorSvgId: anchorId, // ID de la forme SVG si ancré
            // Assurer que les IDs sont des nombres
            id: parseInt(codeData.id, 10),
            position_id: codeData.position_id ? parseInt(codeData.position_id, 10) : null,
            plan_id: parseInt(currentPlanId, 10)
        }
    });

    // Ne pas ajouter au canvas ici, retourner l'objet pour ajout groupé
    // fabricCanvas.add(textObject);
    // textObject.moveTo(999);
    return textObject;
}

/**
 * Place un Tag Géo (rectangle + texte) à un point donné.
 * @param {object} codeData - Données complètes du code et de sa position (peut inclure pos_x_pixels).
 * @param {object} point - {x, y} coordonnées pixels (référentiel monde).
 * @returns {fabric.Group|null} L'objet groupe créé ou null.
 */
function placeTagAtPoint(codeData, point) {
    if (!point || isNaN(point.x) || isNaN(point.y)) {
        console.error("placeTagAtPoint: point invalide.", point);
        return null;
    }

    const universColor = universColors[codeData.univers_nom] || codeData.univers_color ||'#6c757d'; // Utilise univers_color si dispo
    const codeText = codeData.code_geo || 'ERR';
    const tagWidth = codeData.width || sizePresets.medium.width;
    const tagHeight = codeData.height || sizePresets.medium.height;

    const rect = new fabric.Rect({
        width: tagWidth,
        height: tagHeight,
        fill: universColor,
        stroke: '#333',
        strokeWidth: 1, // Épaisseur de base
        baseStrokeWidth: 1, // Stocker base
        originX: 'center',
        originY: 'center',
    });

    const text = new fabric.Text(codeText, {
        fontSize: GEO_TAG_FONT_SIZE, // Taille de base (vient de config.js)
        fill: 'white',
        fontWeight: 'bold',
        fontFamily: 'Arial',
        originX: 'center',
        originY: 'center'
    });

    const group = new fabric.Group([rect, text], {
        left: point.x, top: point.y,
        originX: 'center', originY: 'center',
        selectable: true, evented: true, hasControls: false, hasBorders: true,
        borderColor: '#007bff', cornerSize: 0, transparentCorners: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hoverCursor: 'move',

        // Données perso
        customData: {
             ...codeData,
             isGeoTag: true, isPlacedText: false,
             id: parseInt(codeData.id, 10),
             position_id: codeData.position_id ? parseInt(codeData.position_id, 10) : null,
             plan_id: parseInt(currentPlanId, 10),
             currentWidth: tagWidth,
             currentHeight: tagHeight,
             anchorXPercent: codeData.anchor_x,
             anchorYPercent: codeData.anchor_y
        }
    });

    // Ne pas ajouter au canvas ici, retourner l'objet pour ajout groupé
    // fabricCanvas.add(group);
    // fabricCanvas.setActiveObject(group);
    // group.moveTo(999);
    return group;
}

// Fonction pour gérer le clic sur le canvas en mode placement ('tag')
function handleCanvasClick(options) {
    const mode = getCurrentDrawingTool(); // Doit être 'tag'
    const pointer = fabricCanvas.getPointer(options.e);

    if (mode === 'tag') {
        const selectedCodeEl = document.querySelector('#dispo-list .list-group-item.active');
        if (!selectedCodeEl) {
            showToast("Aucun code disponible sélectionné.", 'warning');
            setActiveTool('select'); // Repasse en mode select
            updateDrawingToolButtons();
            return;
        }
        try {
            const codeData = JSON.parse(selectedCodeEl.dataset.codeData);
            console.log("Placement (Clic Gauche) de:", codeData.code_geo, "en (x,y):", pointer.x, pointer.y);

            let placedObject = null;
            if (planType === 'svg') {
                // Pour SVG, on cherche une forme sous le clic pour ancrer le texte
                const targetShape = options.target; // Fabric donne l'objet cliqué
                if (targetShape && targetShape.isSvgShape) {
                     console.log("Placing text on SVG shape:", targetShape.customData.svgId);
                     placedObject = placeTextOnSvg(codeData, targetShape);
                     if (placedObject) fabricCanvas.add(placedObject); // Ajoute au canvas
                } else {
                     showToast("Cliquez sur une forme du plan SVG pour y placer le texte.", "info");
                     // Ne pas désactiver le mode placement
                     return;
                }
            } else if (planType === 'image') {
                // Pour Image, on place un tag rectangulaire au point cliqué
                placedObject = placeTagAtPoint(codeData, pointer);
                if (placedObject) fabricCanvas.add(placedObject); // Ajoute au canvas
            }

            if (placedObject) {
                 fabricCanvas.setActiveObject(placedObject); // Sélectionne le nouvel objet
                 placedObject.moveTo(999); // Met au premier plan
                 fabricCanvas.requestRenderAll();
                // La fonction handleObjectPlaced gère la sauvegarde API et la mise à jour sidebar
                handleObjectPlaced(placedObject, codeData.id, pointer);
            } else {
                 // Si aucun objet n'a été créé (ex: clic hors SVG en mode SVG)
                 setActiveTool('select'); // Repasse en mode select
                 updateDrawingToolButtons();
            }

        } catch (e) {
            console.error("Erreur parsing codeData:", e, selectedCodeEl.dataset.codeData);
            showToast("Erreur: Impossible de lire les données du code sélectionné.", "danger");
            setActiveTool('select');
            updateDrawingToolButtons();
        }
    }
}
