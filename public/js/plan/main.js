/**
 * Point d'entrée principal pour l'éditeur de plan.
 * VERSION REFACTORISÉE avec clic droit, modale, SVG éditable, Texte vs Étiquette.
 */
import {
    initializeCanvas, getCanvasInstance, loadBackgroundImage, loadSvgPlan, resizeCanvas,
    handleMouseWheel, startPan, handlePanMove, stopPan, snapObjectToGrid, getIsSnapEnabled,
    toggleGrid, toggleSnap, drawGrid, removeGrid, snapToGrid, updateStrokesWidth,
    resetZoom as resetCanvasZoom, zoom as zoomCanvas, toggleSvgLock, isSvgLocked,
    getSvgOriginalBBox // Récupérer la BBox
} from './canvas.js';
import {
    initializeSidebar, updateSidebarLists, updatePlacedCodesList, // Fonctions principales de la sidebar
    fetchAndClassifyCodes, // Fonction pour charger et classer
    populateUniversSelectInModal, // Pour la modale d'ajout
    handleSaveNewCodeInModal // Pour la modale d'ajout
} from './sidebar.js';
import {
    initializeGeoTags, createFabricTag, handleGeoTagModified, showToolbar, hideToolbar,
    getIsDrawingArrowMode, handleArrowEndPoint, cancelArrowDrawing, redrawAllTagsHighlight,
    addArrowToTag, deleteSelectedGeoElement, // Renommée pour gérer Tag ET Texte
    changeSelectedTagSize, toggleHighlightSelected // Ajouté pour les listeners
} from './geo-tags.js';
import {
    initializeDrawingTools, setActiveTool, getCurrentDrawingTool, startDrawing, continueDrawing,
    stopDrawing, getIsDrawing, groupSelectedObjects, ungroupSelectedObject, copyShape,
    pasteShape, deleteSelectedDrawingShape, // Renommée
    setStrokeColor, setFillColor, setTransparentFill // Ajouté pour les listeners
} from './drawing-tools.js';
import { initializeUI } from './ui.js';
import {
    savePosition, saveDrawingData, createSvgPlan, updateSvgPlan,
    fetchAvailableCodes as fetchCodesForModal, // API pour la modale
    saveAsset, listAssets, getAssetData,
    saveNewGeoCode // API pour modale d'ajout
} from '../modules/api.js';
import { convertPixelsToPercent, showToast, convertPercentToPixels } from '../modules/utils.js';
import { PAGE_FORMATS, sizePresets, GEO_TAG_FONT_SIZE } from '../modules/config.js'; // Ajout PAGE_FORMATS

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Plan Editor v2 (Clic Droit) - DOMContentLoaded");

    // --- Récupération des données initiales ---
    const planDataElement = document.getElementById('plan-data');
    if (!planDataElement) {
        console.error("ERREUR: Élément #plan-data non trouvé.");
        showToast("Erreur critique: Données du plan non trouvées.", "danger");
        return;
    }
    const planData = JSON.parse(planDataElement.textContent);
    console.log("Données initiales:", planData);
    window.planData = planData; // Rendre global pour un accès facile (ex: sidebar)

    const { planType, currentPlanId, currentPlan, universColors, planUnivers, placedGeoCodes, initialDrawingData } = planData;
    if (!planType || planType === 'unknown' || !currentPlanId) {
        console.error("ERREUR: Données planType ou currentPlanId manquantes.", planData);
        showToast("Erreur: Données du plan invalides.", "danger");
        return;
    }

    // --- Initialisation Canvas ---
    const canvasEl = document.getElementById('plan-canvas');
    if (!canvasEl) {
        console.error("ERREUR: Élément #plan-canvas non trouvé.");
        showToast("Erreur critique: Canvas non trouvé.", "danger");
        return;
    }
    const fabricCanvas = initializeCanvas(canvasEl, planType);
    if (!fabricCanvas) {
         console.error("ERREUR: Initialisation Fabric.js échouée.");
         showToast("Erreur: Impossible de démarrer l'éditeur.", "danger");
        return;
    }

    // --- Initialisation Modules ---
    initializeSidebar(currentPlanId, planUnivers, universColors);
    initializeGeoTags(fabricCanvas, universColors);
    initializeDrawingTools(fabricCanvas);
    initializeUI(); // Gère sidebar toggle, fullscreen, etc.

    // --- Éléments UI spécifiques à main.js ---
    const codeSelectModalEl = document.getElementById('codeSelectModal');
    const codeSelectModal = codeSelectModalEl ? new bootstrap.Modal(codeSelectModalEl) : null;
    const modalCodeList = document.getElementById('modal-code-list');
    const modalCodeSearch = document.getElementById('modal-code-search');
    const toggleLockSvgBtn = document.getElementById('toggle-lock-svg-btn');
    const pageFormatSelect = document.getElementById('page-format-select');
    let pageGuideRect = null; // Pour guide
    const saveAssetBtn = document.getElementById('save-asset-btn');
    const assetsListEl = document.getElementById('assets-list');
    const assetsOffcanvasEl = document.getElementById('assetsOffcanvas');
    
    // Toolbar dessin
    const toolButtons = document.querySelectorAll('.tool-btn');
    const groupBtn = document.getElementById('group-btn');
    const ungroupBtn = document.getElementById('ungroup-btn');
    const copyBtn = document.getElementById('copy-btn');
    const pasteBtn = document.getElementById('paste-btn');
    const gridToggle = document.getElementById('grid-toggle');
    const snapToggle = document.getElementById('snap-toggle');
    const strokeColorPicker = document.getElementById('stroke-color-picker');
    const fillColorPicker = document.getElementById('fill-color-picker');
    const fillTransparentBtn = document.getElementById('fill-transparent-btn');

    // Modale ajout code
    const addCodeBtn = document.getElementById('add-code-btn');
    const addCodeModalEl = document.getElementById('add-code-modal');
    const addCodeModal = addCodeModalEl ? new bootstrap.Modal(addCodeModalEl) : null;
    const saveNewCodeBtn = document.getElementById('save-new-code-btn');
    const addCodeForm = document.getElementById('add-code-form');
    const universSelectInModal = document.getElementById('new-univers-id');


    let isGridVisible = gridToggle?.checked || false;

    // --- Variables d'état ---
    let contextMenuTarget = null; // Cible du clic droit (forme SVG ou null pour image)
    let contextMenuCoords = null; // Coordonnées du clic droit (par rapport au canvas)

    // --- Chargement Plan ---
    const loader = document.getElementById('plan-loader');
    if(loader) loader.style.display = 'block';
    
    try {
        if (planType === 'svg_creation') {
            console.log("Mode création SVG vierge.");
            // Pas de fond à charger
        }
        else if (planType === 'svg' && currentPlan?.nom_fichier) {
            await loadSvgPlan(`uploads/plans/${currentPlan.nom_fichier}`);
            toggleSvgLock(true); // Verrouiller par défaut
        } else if (planType === 'image' && currentPlan?.nom_fichier) {
            const mapImageEl = document.getElementById('map-image');
            if (!mapImageEl) throw new Error("Élément <img> #map-image non trouvé.");
            await loadBackgroundImage(mapImageEl);
            if (initialDrawingData) {
                console.log("Chargement annotations JSON (pour plan image)...");
                await loadJsonAnnotations(initialDrawingData);
            }
        } else {
            throw new Error("Type de plan non géré ou fichier manquant.");
        }

        // Créer les objets géo (tags/textes) APRES chargement fond/SVG
        createInitialGeoElements(placedGeoCodes);

        resizeCanvas(); // Ajuste canvas et vue initiale
        if (pageFormatSelect) updatePageGuide(); // Guide initial

    } catch (error) {
        console.error("Erreur lors du chargement du plan:", error);
        showToast(`Erreur chargement plan: ${error.message}`, "danger");
    } finally {
        if(loader) loader.style.display = 'none';
    }

    // --- Événements Canvas ---
    fabricCanvas.on({
        'mouse:down': handleCanvasMouseDown,
        'mouse:move': handleCanvasMouseMove,
        'mouse:up': handleCanvasMouseUp,
        'mouse:out': handleCanvasMouseOut,
        'mouse:dblclick': handleDoubleClick,
        'object:moving': handleObjectMoving,
        'object:modified': handleObjectModified,
        'selection:created': handleSelectionChange,
        'selection:updated': handleSelectionChange,
        'selection:cleared': handleSelectionCleared,
        'before:transform': restrictGeoElementTransform, // Appliquer aux tags ET textes
        'viewport:transformed': handleViewportTransform,
        'contextmenu': handleContextMenu // NOUVEAU: Clic Droit
    });

     // --- Écouteurs UI ---
     // Modale Sélection Code
     if (modalCodeSearch) modalCodeSearch.addEventListener('input', filterModalCodeList);
     if (modalCodeList) modalCodeList.addEventListener('click', handleModalCodeSelection);
     // Verrouillage SVG
     if (toggleLockSvgBtn) toggleLockSvgBtn.addEventListener('click', handleToggleLockSvg);
     // Guide Page
     if (pageFormatSelect) pageFormatSelect.addEventListener('change', updatePageGuide);
     // Assets
     if (saveAssetBtn) saveAssetBtn.addEventListener('click', saveSelectionAsAsset);
     if (assetsOffcanvasEl) assetsOffcanvasEl.addEventListener('show.bs.offcanvas', loadAssetsList);
     if (assetsListEl) assetsListEl.addEventListener('click', handleAssetClick);
     // Raccourcis clavier
     document.addEventListener('keydown', handleKeyDown);

    // Toolbar Dessin
    toolButtons.forEach(btn => btn.addEventListener('click', () => setActiveTool(btn.dataset.tool)));
    if (groupBtn) groupBtn.addEventListener('click', groupSelectedObjects);
    if (ungroupBtn) ungroupBtn.addEventListener('click', ungroupSelectedObject);
    if (copyBtn) copyBtn.addEventListener('click', copyShape);
    if (pasteBtn) pasteBtn.addEventListener('click', pasteShape);
    if (gridToggle) gridToggle.addEventListener('change', () => toggleGrid(gridToggle.checked));
    if (snapToggle) snapToggle.addEventListener('change', () => toggleSnap(snapToggle.checked));
    if (strokeColorPicker) strokeColorPicker.addEventListener('input', () => setStrokeColor(strokeColorPicker.value));
    if (fillColorPicker) fillColorPicker.addEventListener('input', () => setFillColor(fillColorPicker.value));
    if (fillTransparentBtn) fillTransparentBtn.addEventListener('click', setTransparentFill);

    // Modale Ajout Code
    if (addCodeBtn) addCodeBtn.addEventListener('click', () => {
        if(addCodeModal) {
            populateUniversSelectInModal(universSelectInModal, planUnivers);
            addCodeModal.show();
        }
    });
    if (saveNewCodeBtn) saveNewCodeBtn.addEventListener('click', async () => {
        await handleSaveNewCodeInModal(addCodeForm, saveNewCodeBtn, saveNewGeoCode);
        if (addCodeModal) addCodeModal.hide();
        await fetchAndClassifyCodes(); // Recharger les listes de la sidebar
    });
     
    // Toolbar Geo-Tags (via délégation car elle est cachée/affichée)
    const tagToolbarEl = document.getElementById('tag-edit-toolbar');
    if (tagToolbarEl) {
        tagToolbarEl.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            
            if (button.id === 'toolbar-highlight') toggleHighlightSelected();
            if (button.id === 'toolbar-arrow') startDrawingArrow(); // Fonction de geo-tags.js
            if (button.id === 'toolbar-delete') deleteSelectedGeoElement();
            if (button.classList.contains('size-btn')) changeSelectedTagSize(e);
        });
    }

    // Init grille/snap
    if(gridToggle) toggleGrid(gridToggle.checked);
    if(snapToggle) toggleSnap(snapToggle.checked);


    // --- Fonctions Principales ---

    /** Gère le Clic Droit sur le Canvas */
    async function handleContextMenu(opt) {
        opt.e.preventDefault(); // Empêche menu navigateur
        console.log("Clic droit détecté.");

        const pointer = fabricCanvas.getPointer(opt.e);
        const target = opt.target; // Objet cliqué (peut être null)

        contextMenuTarget = null;
        contextMenuCoords = { x: pointer.x, y: pointer.y }; // Stocke coords pour placement

        if (planType === 'svg') {
            // Clic sur une forme SVG ? (et non sur un tag/texte déjà placé, ou un dessin)
            if (target && target.isSvgShape) {
                 if (isSvgLocked()) {
                     showToast("Le plan SVG est verrouillé. Déverrouillez-le (Ctrl+L) pour placer un code.", "info");
                     return;
                 }
                 console.log("Clic droit sur forme SVG:", target);
                contextMenuTarget = target; // Stocke la référence de la forme
                await openCodeSelectionModal();
            } else if (!target) {
                // Clic droit dans le vide sur un plan SVG
                 showToast("Clic droit sur une forme du plan SVG pour placer un code.", "info");
            } else {
                 console.log("Clic droit sur un objet non-SVG (tag, dessin...) - ignoré pour placement.");
                 // On pourrait ouvrir un menu contextuel d'édition ici (suppr, copier...)
            }
        } else if (planType === 'image') {
            // Sur une image, on peut placer n'importe où
            console.log("Clic droit sur image à", contextMenuCoords);
            await openCodeSelectionModal(); // Toujours ouvrir pour image
        }
    }

    /** Ouvre et peuple la modale de sélection de code */
    async function openCodeSelectionModal() {
        if (!codeSelectModal || !modalCodeList) {
             console.error("Modale de sélection de code non trouvée.");
             showToast("Erreur: Impossible d'ouvrir la sélection de code.", "danger");
             return;
        }
        modalCodeList.innerHTML = '<p class="text-muted">Chargement...</p>'; // Indicateur
        if (modalCodeSearch) modalCodeSearch.value = ''; // Vider recherche
        codeSelectModal.show();

        try {
            // Utilise l'API pour récupérer les codes DISPONIBLES (non encore placés)
            // Note: fetchCodesForModal est un alias pour fetchAvailableCodes
            const codes = await fetchCodesForModal(currentPlanId);
            populateModalCodeList(codes);
        } catch (error) {
            console.error("Erreur chargement codes pour modale:", error);
            modalCodeList.innerHTML = `<p class="text-danger">Erreur: ${error.message}</p>`;
            showToast(`Erreur chargement codes: ${error.message}`, 'danger');
        }
    }

    /** Remplit la liste dans la modale */
    function populateModalCodeList(codes) {
        if (!modalCodeList) return;
        modalCodeList.innerHTML = '';
        if (!codes || codes.length === 0) {
            modalCodeList.innerHTML = '<p class="text-muted">Aucun code disponible pour ce plan.</p>'; 
            return;
        }

        // Trier les codes pour l'affichage
        codes.sort((a, b) => (a.code_geo || '').localeCompare(b.code_geo || ''));

        codes.forEach(code => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action modal-code-item';
            // Stocker TOUTES les données nécessaires pour le placement
            item.dataset.id = code.id;
            item.dataset.codeGeo = code.code_geo;
            item.dataset.libelle = code.libelle || '';
            item.dataset.univers = code.univers || ''; // Nom de l'univers
            item.dataset.commentaire = code.commentaire || '';
            item.dataset.zone = code.zone || ''; 
            item.dataset.univers_id = code.univers_id; // Stocker ID univers
            item.dataset.search = `${code.code_geo} ${code.libelle || ''} ${code.univers || ''}`.toLowerCase();

            const universColor = universColors[code.univers] || '#adb5bd';
            item.innerHTML = `
                <div class="d-flex w-100 justify-content-between">
                    <div>
                        <strong style="color: ${universColor};">${code.code_geo}</strong>
                        <small class="d-block text-muted">${code.libelle || '<i>(Sans libellé)</i>'}</small>
                    </div>
                    <span class="badge rounded-pill" style="background-color: ${universColor}; color: white;">${code.univers}</span>
                </div>
            `;
            modalCodeList.appendChild(item);
        });
        filterModalCodeList(); // Appliquer le filtre initial (vide)
    }

    /** Filtre la liste des codes dans la modale */
    function filterModalCodeList() {
        if (!modalCodeSearch || !modalCodeList) return;
        const term = modalCodeSearch.value.toLowerCase().trim();
        const items = modalCodeList.querySelectorAll('.modal-code-item');
        items.forEach(item => {
            // Utiliser 'hidden' est plus performant que display:none
            item.classList.toggle('hidden', !(item.dataset.search?.includes(term) ?? true));
        });
    }

    /** Gère la sélection d'un code dans la modale */
    async function handleModalCodeSelection(event) {
        event.preventDefault();
        const selectedItem = event.target.closest('.modal-code-item');
        if (!selectedItem || !contextMenuCoords) return;

        const codeData = { ...selectedItem.dataset }; // Copie les données
        console.log("Code sélectionné dans modale:", codeData.codeGeo);
        codeSelectModal.hide();

        // Convertir les coordonnées du clic en %
        const { posX, posY } = convertPixelsToPercent(contextMenuCoords.x, contextMenuCoords.y, fabricCanvas);
        if (isNaN(posX) || isNaN(posY)) {
            showToast("Erreur: Impossible de calculer la position.", "danger");
            return;
        }

        let newElementData = { // Données communes pour l'API
            id: parseInt(codeData.id, 10), // ID du code Géo
            plan_id: currentPlanId,
            pos_x: posX,
            pos_y: posY,
            width: null, // Sera null pour texte, défini pour étiquette
            height: null,
            anchor_x: null, // Pas d'ancre par défaut
            anchor_y: null
        };

        try {
            let newFabricObject = null;
            if (planType === 'svg' && contextMenuTarget && contextMenuTarget.isSvgShape) {
                // --- Placement Texte sur SVG ---
                console.log("Placement Texte sur SVG.");
                // Pour le texte, on sauvegarde d'abord pour obtenir un position_id
                // On utilise les coordonnées % du clic (centre du texte)
                const savedData = await savePosition(newElementData);
                console.log("Position texte sauvegardée:", savedData);
                
                // Combiner infos du code + infos de position
                const fullTextData = { ...codeData, ...savedData };
                
                newFabricObject = placeTextOnSvg(fullTextData, contextMenuTarget);

            } else if (planType === 'image') {
                // --- Placement Étiquette sur Image ---
                console.log("Placement Étiquette sur Image.");
                newElementData.width = sizePresets.medium.width; // Taille Moyenne par défaut
                newElementData.height = sizePresets.medium.height;
                
                const savedData = await savePosition(newElementData);
                 console.log("Position étiquette sauvegardée:", savedData);
                 
                // Combiner infos du code + infos de position
                const fullTagData = { ...codeData, ...savedData };
                
                newFabricObject = createFabricTag(fullTagData); // createFabricTag vient de geo-tags.js
            }

            if (newFabricObject) {
                fabricCanvas.setActiveObject(newFabricObject).renderAll();
                // Mettre à jour les listes de la sidebar (placé/dispo)
                await fetchAndClassifyCodes();
            } else {
                 console.warn("Aucun objet Fabric n'a été créé pour le placement.");
            }

        } catch (error) {
            console.error("Erreur lors du placement/sauvegarde:", error);
            showToast(`Erreur placement ${codeData.codeGeo}: ${error.message}`, "danger");
        } finally {
            contextMenuTarget = null;
            contextMenuCoords = null;
        }
    }

    /** Crée et positionne un objet texte sur une forme SVG */
    function placeTextOnSvg(codeData, targetSvgShape) {
         if (!targetSvgShape || !targetSvgShape.getCenterPoint) {
             console.error("placeTextOnSvg: targetSvgShape invalide");
             return null;
         }
         // const bbox = targetSvgShape.getBoundingRect();
         const center = targetSvgShape.getCenterPoint(); // Centre de la forme SVG
         const zoom = fabricCanvas.getZoom();
         
         // Utiliser les coordonnées % converties (point du clic) plutôt que le centre de la forme?
         // Non, utilisons le centre de la forme, c'est plus logique.
         // const { left, top } = convertPercentToPixels(codeData.pos_x, codeData.pos_y, fabricCanvas);
         
         const fontSize = (GEO_TAG_FONT_SIZE || 14) / zoom; // Taille de base adaptée au zoom

         const textObject = new fabric.IText(codeData.codeGeo, {
             left: center.x,
             top: center.y,
             originX: 'center', originY: 'center',
             fontSize: fontSize,
             fill: '#000000', // Texte noir
             stroke: '#FFFFFF', // Contour blanc pour lisibilité
             paintFirst: 'stroke', // Dessine le contour d'abord
             strokeWidth: 0.5 / zoom,
             fontFamily: 'Arial',
             textAlign: 'center',
             selectable: true, evented: true, hasControls: false, hasBorders: true,
             borderColor: '#007bff', cornerSize: 0, transparentCorners: true,
             lockRotation: true,
             
             // Stocker TOUTES les données (code + position)
             customData: {
                 ...codeData,
                 isPlacedText: true, // Marqueur spécifique
                 isGeoTag: false, // Pas une étiquette standard
                 id: parseInt(codeData.id, 10), // ID du code géo
                 position_id: parseInt(codeData.position_id, 10), // ID de la position
                 plan_id: parseInt(codeData.plan_id, 10)
             }
         });

         fabricCanvas.add(textObject);
         textObject.moveTo(999); // Mettre au premier plan
         return textObject;
    }


    /** Gère le Clic simple sur le canvas (pan, dessin, sélection) */
    function handleCanvasMouseDown(opt) {
        if (opt.e.button !== 0) return; // Ignorer clic droit/milieu

        const tool = getCurrentDrawingTool();
        const target = opt.target;

        if (opt.e.altKey || opt.e.ctrlKey || fabricCanvas.isDrawingMode) {
            startPan(opt);
            return;
        }

        // Gestion flèche (pour étiquette image)
        if (getIsDrawingArrowMode() && planType === 'image') {
            handleArrowEndPoint(opt);
            return;
        }

        // Démarrer dessin (Rectangle, Ligne, Cercle, Texte libre)
        if (tool !== 'select' && !target) {
            startDrawing(opt);
        } else if (tool === 'select') {
            // Comportement normal de sélection géré par Fabric
            // Cacher la toolbar si on clique dans le vide
            if (!target) {
                hideToolbar();
            }
        }
    }

    function handleCanvasMouseMove(opt) {
        if (getIsDrawing()) {
            continueDrawing(opt);
        } else {
            handlePanMove(opt);
        }
    }

    function handleCanvasMouseUp(opt) {
        if (getIsDrawing()) {
            stopDrawing(opt);
        }
        stopPan();
        
        // Si on vient de créer un objet, on le sauvegarde (uniquement dessins, pas tags)
        const newObject = opt.target;
        if (newObject && newObject.justCreated) {
            console.log("Nouvel objet dessin créé, sauvegarde...");
            delete newObject.justCreated; // Nettoyer le flag
            handleSaveRequest(); // Sauvegarder l'état
        }
    }
    
    function handleCanvasMouseOut(opt) {
        // stopPan(); // Optionnel: arrêter pan si souris sort
    }

    /** Gère double clic (édition texte) */
    function handleDoubleClick(opt) {
        const target = opt.target;
        if (target && (target.type === 'i-text' || target.type === 'textbox')) {
            console.log("Double clic sur texte, passage en édition.");
            target.enterEditing();
        } else if (target && (target.customData?.isGeoTag || target.customData?.isPlacedText)) {
            // Double clic sur un tag ou texte géo -> on ne fait rien (pas d'édition du code géo)
            // On pourrait ouvrir la modale d'info?
            console.log("Double clic sur élément géo, édition bloquée.");
        }
    }

    /** Gère déplacement objet (pour snap) */
    function handleObjectMoving(opt) {
        if (getIsSnapEnabled()) {
            snapObjectToGrid(opt.target);
        }
        
        // Cacher/déplacer la toolbar d'édition de tag
        if (opt.target.customData?.isGeoTag || opt.target.customData?.isPlacedText) {
            showToolbar(opt.target); // Mettre à jour position toolbar
        }
    }

    /** Gère la modification d'objet (déplacement, etc.) */
    async function handleObjectModified(opt) {
        const target = opt.target;
        if (!target || target.isGridLine || target.isPageGuide) return;

        if (target.customData?.isGeoTag) { // Étiquette rectangulaire (sur image)
            console.log("Geo Tag modifié (déplacé):", target.customData);
            await handleGeoTagModified(target); // Délégué au module geo-tags
        } 
        else if (target.customData?.isPlacedText) { // Texte placé (sur SVG)
             console.log("Texte Placé modifié (déplacé):", target.customData);
            const { position_id, id: geoCodeId, plan_id } = target.customData;
             if (!geoCodeId || !position_id || !plan_id) {
                console.error(`ERREUR: Impossible de sauvegarder modif texte ${target.text}. Données ID manquantes:`, target.customData);
                showToast(`Erreur sauvegarde texte ${target.text}.`, "danger"); return;
            }
            // Sauvegarder la nouvelle position du texte (centre)
            const centerPoint = target.getCenterPoint();
            const { posX, posY } = convertPixelsToPercent(centerPoint.x, centerPoint.y, fabricCanvas);
            try {
                const savedData = await savePosition({
                    id: geoCodeId, position_id: position_id, plan_id: plan_id,
                    pos_x: posX, pos_y: posY,
                    width: null, height: null, anchor_x: null, anchor_y: null
                });
                console.log("Nouvelle position texte sauvegardée:", savedData);
                target.customData.pos_x = savedData.pos_x; // Mettre à jour data locale
                target.customData.pos_y = savedData.pos_y;
                showToolbar(target); // Ré-afficher la toolbar à la bonne position
            } catch(error){
                console.error("Erreur API sauvegarde position texte:", error);
                showToast(`Erreur sauvegarde texte ${target.text}: ${error.message}`, "danger");
            }
        }
        else if (target.isSvgShape) {
            console.log("Forme SVG modifiée (si déverrouillée). Sauvegarde...");
            handleSaveRequest(); // Sauvegarder l'état complet du SVG
        }
        else {
            console.log("Objet dessin modifié (non-tag/texte). Sauvegarde...");
             handleSaveRequest(); // Sauvegarder les annotations
        }
    }

    /** Gère le changement de sélection */
    function handleSelectionChange(opt) {
        const selected = opt.selected;
        if (!selected || selected.length === 0 || (selected.length === 1 && (selected[0].isGridLine || selected[0].isPageGuide))) {
            handleSelectionCleared(); return;
        }
        
        // activeObject est soit l'objet unique, soit le groupe de sélection 'activeSelection'
        const activeObject = fabricCanvas.getActiveObject();
        if (!activeObject || typeof activeObject.type === 'undefined') return;

        console.log("Sélection:", activeObject.type, activeObject.customData);
        hideToolbar(); // Cacher toolbar tag par défaut

        const containsSvg = activeObject.type === 'activeSelection' 
            ? activeObject.getObjects().some(obj => obj.isSvgShape) 
            : activeObject.isSvgShape;
            
        const containsGeo = activeObject.type === 'activeSelection'
            ? activeObject.getObjects().some(obj => obj.customData?.isGeoTag || obj.customData?.isPlacedText)
            : (activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText);

        if (activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText) {
            // Sélection unique d'un Tag ou Texte Géo
            showToolbar(activeObject);
            redrawAllTagsHighlight(); // Gérer surlignage
        } else {
             redrawAllTagsHighlight(); // Enlever surlignage si sélection autre chose
        }
        
        // Gérer état boutons Grouper/Dégrouper
        if (groupBtn) {
            // Activer Group si: sélection multiple, ne contient NI Svg NI GeoTag
            groupBtn.disabled = !(activeObject.type === 'activeSelection' && !containsSvg && !containsGeo);
        }
        if (ungroupBtn) {
            // Activer Ungroup si: sélection unique d'un groupe, qui n'est NI Svg NI GeoTag
            ungroupBtn.disabled = !(activeObject.type === 'group' && !containsSvg && !containsGeo);
        }
    }

    /** Gère la désélection */
    function handleSelectionCleared() {
        console.log("Sélection effacée.");
        hideToolbar();
        redrawAllTagsHighlight(); // Enlever surlignage
        if(groupBtn) groupBtn.disabled = true;
        if(ungroupBtn) ungroupBtn.disabled = true;
    }

    /** Restreint la transformation des tags et textes placés */
    function restrictGeoElementTransform(e) {
        if (e.target && (e.target.customData?.isGeoTag || e.target.customData?.isPlacedText)) {
            // Pas de redimensionnement, pas de rotation
            e.transform.lockScalingX = true;
            e.transform.lockScalingY = true;
            e.transform.lockRotation = true;
        }
        // Pour les formes SVG, dépend de l'état verrouillé
         if (e.target && e.target.isSvgShape && isSvgLocked()) {
             // Empêcher toute transformation si verrouillé
             return false; // Annule la transformation
         }
    }

    /** Gère les changements de viewport (zoom/pan) */
    function handleViewportTransform() {
        if (isGridVisible) drawGrid();
        if (pageGuideRect) updatePageGuideStroke();
        updateStrokesWidth(fabricCanvas.getZoom());
        
        // Déplacer la toolbar si elle est visible et que l'objet est toujours sélectionné
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj && (activeObj.customData?.isGeoTag || activeObj.customData?.isPlacedText)) {
             showToolbar(activeObj);
        }
    }

    /** Gère les raccourcis clavier */
    function handleKeyDown(e) {
        const activeObj = fabricCanvas.getActiveObject();
        
        // Ne pas intercepter si on édite du texte (dans un input, textarea, ou IText)
        if (e.target.tagName.match(/input|textarea/i) || activeObj?.isEditing) return;

        // Échapper (annuler dessin, etc.)
        if (e.key === 'Escape') {
            cancelDrawingModes();
            e.preventDefault();
        }
        
        // Supprimer (Delete ou Backspace)
        if (e.key === 'Delete' || e.key === 'Backspace') {
             if (activeObj) {
                 e.preventDefault();
                 if (activeObj.customData?.isGeoTag || activeObj.customData?.isPlacedText) {
                     deleteSelectedGeoElement(); // Utiliser la fonction du module geo-tags
                 } else if (activeObj.isSvgShape) {
                      showToast("Les éléments du plan SVG ne peuvent pas être supprimés (sauf via un éditeur SVG externe).", "info");
                 } else { 
                     deleteSelectedDrawingShape(); // Utiliser fonction drawing-tools
                 }
             }
        }

        // Ctrl/Cmd + C (Copier)
        if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
            copyShape(); e.preventDefault();
        }
        // Ctrl/Cmd + V (Coller)
        if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
            pasteShape(); e.preventDefault();
        }
        // Ctrl/Cmd + G (Grouper)
        if (e.key === 'g' && (e.ctrlKey || e.metaKey)) {
             e.preventDefault();
             if (e.shiftKey) { 
                 if(ungroupBtn && !ungroupBtn.disabled) ungroupSelectedObject(); 
             }
             else { 
                 if(groupBtn && !groupBtn.disabled) groupSelectedObjects(); 
             }
        }
        // Ctrl/Cmd + L (Verrouiller/Déverrouiller SVG)
        if (e.key === 'l' && (e.ctrlKey || e.metaKey) && planType === 'svg') {
             e.preventDefault();
             handleToggleLockSvg(); // Appelle la fonction de bascule
        }

        // Raccourcis Outils
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            switch(e.key.toLowerCase()) {
                case 'v': setActiveTool('select'); e.preventDefault(); break;
                case 'r': setActiveTool('rect'); e.preventDefault(); break;
                case 'l': setActiveTool('line'); e.preventDefault(); break;
                case 'c': setActiveTool('circle'); e.preventDefault(); break;
                case 't': setActiveTool('text'); e.preventDefault(); break;
            }
        }
    }

    /** Annule les modes actifs (dessin, flèche) */
    function cancelDrawingModes() {
        console.log("Modes annulés (Escape).");
        cancelArrowDrawing(); // Annuler flèche
        stopDrawing(null, true); // Annuler dessin en cours (true = cancel)
        setActiveTool('select'); // Repasser en mode sélection
        fabricCanvas.discardActiveObject().renderAll();
    }

    /** Crée les objets Fabric pour les tags/textes initiaux */
    function createInitialGeoElements(codesData) {
        console.log("Création éléments géo initiaux...");
        let elementsCreated = 0;
        if (!codesData || !Array.isArray(codesData)) {
             console.warn("Aucune donnée 'placedGeoCodes' trouvée.");
             return;
        }

        codesData.forEach(code => {
            if (code?.placements && Array.isArray(code.placements)) {
                code.placements.forEach(placement => {
                    // Vérifier que le placement est bien pour CE plan
                    if (placement && placement.plan_id == currentPlanId) {
                        // Combiner les infos du code (libelle, univers...) avec sa position
                        const { placements, ...codeInfo } = code;
                        const elementData = { ...codeInfo, ...placement };

                        if (!elementData.id || !elementData.position_id) {
                            console.error("ERREUR createInitial: ID ou Position_ID manquant!", { codeInfo, placement });
                            return; // Passer au suivant
                        }

                        let createdElement = null;
                        
                        // Cas 1: C'est un TEXTE (sur SVG) - identifié par width/height NULL
                        if (planType === 'svg' && elementData.width === null && elementData.height === null) {
                            console.log("Création Texte initial:", elementData.code_geo);
                             // Simuler une "target" (forme SVG) fictive centrée sur la position % sauvegardée
                             const { left, top } = convertPercentToPixels(elementData.pos_x, elementData.pos_y, fabricCanvas);
                             if(!isNaN(left) && !isNaN(top)) {
                                 const fakeTarget = {
                                     getCenterPoint: () => ({ x: left, y: top })
                                 };
                                 createdElement = placeTextOnSvg(elementData, fakeTarget);
                             } else {
                                  console.error("Coords invalides pour texte initial:", elementData);
                             }

                        }
                        // Cas 2: C'est une ÉTIQUETTE RECTANGULAIRE (sur Image, ou ancien tag sur SVG)
                        else if (elementData.width !== null && elementData.height !== null) {
                            // Ne créer l'étiquette que si on est sur un plan 'image'
                            if (planType === 'image') {
                                console.log("Création Tag initial:", elementData.code_geo);
                                createdElement = createFabricTag(elementData);
                            } else {
                                console.warn(`Tag rectangulaire (${elementData.code_geo}) ignoré sur plan SVG.`, elementData);
                            }
                        }

                        if (createdElement) elementsCreated++;
                        else console.warn("Échec création élément Fabric initial pour:", elementData);
                    }
                });
            }
        });
        console.log(`${elementsCreated} éléments géo initiaux créés.`);
        // Mettre à jour la liste des placés dans la sidebar
        // (Sera fait par fetchAndClassifyCodes au lieu de ça)
        // updatePlacedCodesList(fabricCanvas.getObjects());
        fabricCanvas.renderAll();
    }


    /** Charge les annotations JSON (dessins) - Utilisé pour plan 'image' */
    async function loadJsonAnnotations(jsonData) {
        return new Promise((resolve, reject) => {
             if (!jsonData || !jsonData.objects || jsonData.objects.length === 0) {
                 console.log("Aucune donnée d'annotation (JSON) à charger.");
                 return resolve();
             }
             console.log(`Chargement de ${jsonData.objects.length} objets JSON...`);
             // Exclure les tags géo (qui sont déjà chargés par createInitialGeoElements)
             const objectsToLoad = {
                 objects: jsonData.objects.filter(obj => !obj.customData?.isGeoTag)
             };
             
             fabricCanvas.loadFromJSON(objectsToLoad, () => {
                 console.log("Annotations JSON (dessins) chargées.");
                 // Ré-appliquer baseStrokeWidth et autres propriétés non-JSON
                 fabricCanvas.getObjects().forEach(obj => {
                     if (obj.strokeWidth && !obj.baseStrokeWidth && !obj.customData?.isGeoTag && !obj.isGridLine && !obj.isPageGuide) {
                         obj.baseStrokeWidth = obj.strokeWidth;
                     }
                 });
                 fabricCanvas.renderAll();
                 resolve();
             }, (o, object) => {
                 // Reviver (au cas où)
                 console.log("Reviving object:", object.type);
             });
        });
    }

    // --- Sauvegarde ---
     async function handleSaveRequest() {
        console.log("handleSaveRequest - Début, planType:", planType);
        
        // Mettre le bouton en état "loading"
        const saveButton = document.getElementById('save-drawing-btn') || document.getElementById('save-new-svg-plan-btn');
        let originalButtonText = '';
        if (saveButton) {
            originalButtonText = saveButton.innerHTML;
            saveButton.disabled = true;
            saveButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sauvegarde...`;
        }

        let savePromise;
        let successMessage = "";

        if (planType === 'image') {
            // Sauvegarder seulement les annotations (dessins + textes libres)
            // Les tags géo sont sauvegardés via savePosition lors du déplacement/création
            const dataToSave = fabricCanvas.toJSON(['customData', 'selectable', 'evented', 'baseStrokeWidth']);
            dataToSave.objects = dataToSave.objects.filter(obj => 
                !obj.isGridLine && 
                !obj.isPageGuide && 
                !obj.customData?.isGeoTag // Exclure les tags géo
            );
             console.log(`Sauvegarde annotations JSON (image): ${dataToSave.objects.length} objets (hors tags).`);
            savePromise = saveDrawingData(currentPlanId, dataToSave.objects.length > 0 ? dataToSave : null);
            successMessage = "Annotations sauvegardées.";

        } else if (planType === 'svg') {
             // Exporter le SVG complet: formes SVG natives + dessins + textes libres
             // Exclure les TEXTES GEO (isPlacedText) car ils sont sauvegardés via savePosition
             const svgString = fabricCanvas.toSVG(['baseStrokeWidth', 'customData'], obj => 
                !obj.isGridLine && 
                !obj.isPageGuide &&
                !obj.customData?.isPlacedText // Exclure les textes géo
             );
             console.log("Sauvegarde état SVG (formes + dessins)...");
             savePromise = updateSvgPlan(currentPlanId, svgString);
             successMessage = "État du plan SVG sauvegardé.";

        } else if (planType === 'svg_creation') {
             console.log("Sauvegarde nouveau plan SVG...");
             savePromise = handleSaveNewSvgPlan(); // Gère sa propre redirection
             successMessage = "Nouveau plan SVG créé ! Redirection...";
        } else {
             console.error("Type de plan non reconnu pour la sauvegarde:", planType);
             savePromise = Promise.reject(new Error("Type de plan inconnu"));
        }

        try { 
            await savePromise; 
            showToast(successMessage, "success"); 
        }
        catch (error) { 
            console.error("Erreur sauvegarde:", error); 
            showToast(`Erreur sauvegarde: ${error.message}`, "danger"); 
        }
        finally {
            // Restaurer bouton
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.innerHTML = originalButtonText;
            }
        }
    }
    
     const saveButton = document.getElementById('save-drawing-btn');
     if(saveButton) {
         saveButton.addEventListener('click', handleSaveRequest);
     }
     
     // Gérer la sauvegarde pour le mode création
     const saveNewSvgPlanBtn = document.getElementById('save-new-svg-plan-btn');
     if (saveNewSvgPlanBtn) {
         saveNewSvgPlanBtn.addEventListener('click', async () => {
             const planName = document.getElementById('new-plan-name').value;
             const universIds = Array.from(document.getElementById('new-plan-univers').selectedOptions).map(opt => opt.value);
             if (!planName || universIds.length === 0) {
                 showToast("Veuillez fournir un nom et au moins un univers.", "warning");
                 return;
             }
             await handleSaveRequest(); // Laisse handleSaveRequest gérer la logique
         });
     }

    async function handleSaveNewSvgPlan() {
        const planName = document.getElementById('new-plan-name').value;
        const universIds = Array.from(document.getElementById('new-plan-univers').selectedOptions).map(opt => opt.value);
        
        // Exporter le SVG (dessins uniquement)
        const svgString = fabricCanvas.toSVG(['baseStrokeWidth', 'customData'], obj => 
            !obj.isGridLine && !obj.isPageGuide
        );
        
        try {
            const result = await createSvgPlan(planName, svgString, universIds);
            showToast("Plan SVG créé avec succès !", "success");
            // Rediriger vers la page d'édition du plan nouvellement créé
            setTimeout(() => {
                window.location.href = `index.php?action=editPlan&id=${result.plan_id}`;
            }, 1500);
        } catch (error) {
            console.error("Erreur création plan SVG:", error);
            showToast(`Erreur création: ${error.message}`, "danger");
            throw error; // Propager l'erreur pour que handleSaveRequest la voie
        }
    }

    // --- Gestion Verrouillage SVG ---
    function handleToggleLockSvg() {
        toggleSvgLock(!isSvgLocked()); // Inverse l'état (fonction dans canvas.js)
        updateLockButtonUI(isSvgLocked());
    }

    function updateLockButtonUI(isLocked) {
        if (!toggleLockSvgBtn) return;
        const icon = toggleLockSvgBtn.querySelector('i');
        const text = toggleLockSvgBtn.querySelector('.btn-text');
        if (isLocked) {
            icon.classList.remove('bi-unlock-fill');
            icon.classList.add('bi-lock-fill');
            if(text) text.textContent = "Verrouillé";
            toggleLockSvgBtn.title = "Déverrouiller les éléments du plan (Ctrl+L)";
            toggleLockSvgBtn.classList.add('active'); // Style visuel "actif" = verrouillé
        } else {
            icon.classList.remove('bi-lock-fill');
            icon.classList.add('bi-unlock-fill');
            if(text) text.textContent = "Déverrouillé";
            toggleLockSvgBtn.title = "Verrouiller les éléments du plan (Ctrl+L)";
            toggleLockSvgBtn.classList.remove('active');
        }
    }
     // Appliquer l'état initial du bouton (verrouillé)
     if (planType === 'svg') updateLockButtonUI(true);

     // --- Gestion Format Page Guide ---
     function updatePageGuide() {
        if (!pageFormatSelect) return;
        const format = pageFormatSelect.value;
        
        if (pageGuideRect) {
            fabricCanvas.remove(pageGuideRect);
            pageGuideRect = null;
        }
        if (format === 'none' || !PAGE_FORMATS[format]) return;

        const { width, height } = PAGE_FORMATS[format]; // Dimensions en mm
        const DPI = 72; // Points par pouce
        const MM_PER_INCH = 25.4;
        const PIXELS_PER_MM = DPI / MM_PER_INCH;
        
        const widthPx = width * PIXELS_PER_MM;
        const heightPx = height * PIXELS_PER_MM;

        pageGuideRect = new fabric.Rect({
            width: widthPx,
            height: heightPx,
            fill: 'transparent',
            stroke: 'rgba(255, 0, 0, 0.5)', // Rouge semi-transparent
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            isPageGuide: true,
            left: (fabricCanvas.width / 2) - (widthPx / 2),
            top: (fabricCanvas.height / 2) - (heightPx / 2),
            originX: 'left',
            originY: 'top',
        });
        
        updatePageGuideStroke();
        fabricCanvas.add(pageGuideRect);
        pageGuideRect.moveTo(0); // Mettre en arrière-plan
     }
     
     function updatePageGuideStroke() {
         if (!pageGuideRect) return;
         const zoom = fabricCanvas.getZoom();
         pageGuideRect.set({
             strokeWidth: 1 / zoom // Garder une ligne fine
         });
     }

     // --- Gestion Assets (stockage formes/textes) ---
     async function saveSelectionAsAsset() {
        const activeObj = fabricCanvas.getActiveObject();
        if (!activeObj) {
            showToast("Veuillez sélectionner un ou plusieurs objets (dessins, textes libres) à sauvegarder.", "warning");
            return;
        }
        
        // Ne pas sauvegarder les formes SVG natives, ni les tags géo
        if (activeObj.isSvgShape || activeObj.customData?.isGeoTag || activeObj.customData?.isPlacedText) {
             showToast("Impossible de sauvegarder cet élément comme asset.", "warning"); return;
        }
        if (activeObj.type === 'activeSelection') {
            const containsInvalid = activeObj.getObjects().some(obj => obj.isSvgShape || obj.customData?.isGeoTag || obj.customData?.isPlacedText);
             if (containsInvalid) {
                showToast("La sélection contient des éléments non sauvegardables (plan SVG, tag géo).", "warning"); return;
             }
        }
        
        const assetName = prompt("Nom de l'asset :", "Nouvel Asset");
        if (!assetName) return;
        
        // Exporter l'objet (ou la sélection) en JSON
        const assetData = activeObj.toJSON(['customData', 'baseStrokeWidth']);
        
        try {
            await saveAsset(assetName, assetData);
            showToast(`Asset "${assetName}" sauvegardé !`, "success");
            await loadAssetsList(); // Rafraîchir la liste
        } catch (error) {
            console.error("Erreur sauvegarde asset:", error);
            showToast(`Erreur sauvegarde asset: ${error.message}`, "danger");
        }
     }
     
     async function loadAssetsList() {
         if (!assetsListEl) return;
         assetsListEl.innerHTML = '<p class="text-muted small">Chargement...</p>';
         try {
             const assets = await listAssets();
             assetsListEl.innerHTML = '';
             if (assets.length === 0) {
                 assetsListEl.innerHTML = '<p class="text-muted small">Aucun asset sauvegardé.</p>'; return;
             }
             assets.forEach(asset => {
                 const item = document.createElement('a');
                 item.href = '#';
                 item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center asset-item';
                 item.dataset.id = asset.id;
                 item.textContent = asset.nom;
                 // On pourrait ajouter un bouton de suppression ici
                 assetsListEl.appendChild(item);
             });
         } catch (error) {
             console.error("Erreur chargement assets:", error);
             assetsListEl.innerHTML = `<p class="text-danger small">Erreur: ${error.message}</p>`;
         }
     }
     
     async function handleAssetClick(event) {
         event.preventDefault();
         const assetItem = event.target.closest('.asset-item');
         if (!assetItem) return;
         
         const assetId = assetItem.dataset.id;
         try {
             const asset = await getAssetData(assetId);
             const assetData = JSON.parse(asset.data);
             
             // Utiliser le "reviver" de Fabric pour charger l'objet
             fabric.util.enlivenObjects([assetData], (enlivenedObjects) => {
                 if (!enlivenedObjects || enlivenedObjects.length === 0) {
                     showToast("Erreur: Impossible de charger l'asset.", "danger"); return;
                 }
                 const obj = enlivenedObjects[0];
                 
                 // Positionner au centre de la vue actuelle
                 const center = fabricCanvas.getCenter();
                 const zoom = fabricCanvas.getZoom();
                 obj.set({
                     left: center.left - (obj.width * obj.scaleX / 2),
                     top: center.top - (obj.height * obj.scaleY / 2),
                 });
                 
                 fabricCanvas.add(obj);
                 fabricCanvas.setActiveObject(obj).renderAll();
                 showToast(`Asset "${asset.nom}" ajouté !`, "success");
                 handleSaveRequest(); // Sauvegarder état après ajout
             });
             
         } catch (error) {
            console.error("Erreur chargement données asset:", error);
            showToast(`Erreur chargement asset: ${error.message}`, "danger");
         }
     }

    console.log("Fin initialisation main.js");
});
