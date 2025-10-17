/**
 * Gestion de la page d'édition et de création des plans avec Fabric.js
 * Gère les tags géo, les annotations sur images, la création SVG et l'édition SVG.
 * Version complète et corrigée avec logs de diagnostic.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Chargé, début de l'initialisation de plan.js"); // NOUVEAU LOG
    const canvasEl = document.getElementById('plan-canvas');
    if (!canvasEl) {
        console.error("Élément Canvas #plan-canvas non trouvé !"); // NOUVEAU LOG
        return;
    }
    const planPageContainer = document.querySelector('.plan-page-container');

    // --- CONSTANTES ---
    const MIN_ZOOM = 0.1;
    const MAX_ZOOM = 10;
    const GRID_SIZE = 20;
    const GEO_TAG_FONT_SIZE = 14;

    // --- ÉLÉMENTS DU DOM ---
    const mapImageEl = document.getElementById('map-image');
    const planContainer = document.getElementById('plan-container');
    const unplacedList = document.getElementById('unplaced-list');
    const tagToolbar = document.getElementById('tag-edit-toolbar');
    const deleteTagBtn = document.getElementById('toolbar-delete');
    const highlightTagBtn = document.getElementById('toolbar-highlight');
    const arrowTagBtn = document.getElementById('toolbar-arrow');
    const sizeBtns = document.querySelectorAll('.size-btn');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const searchInput = document.getElementById('tag-search-input');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const addCodeBtn = document.getElementById('add-code-btn');
    const addCodeModalEl = document.getElementById('add-code-modal');
    const addCodeModal = addCodeModalEl ? new bootstrap.Modal(addCodeModalEl) : null;
    const saveNewCodeBtn = document.getElementById('save-new-code-btn');
    const newUniversIdSelect = document.getElementById('new-univers-id');
    const legendContainer = document.getElementById('legend-container');
    const drawingToolbar = document.getElementById('drawing-toolbar');
    const toolBtns = drawingToolbar?.querySelectorAll('.tool-btn');
    const saveDrawingBtn = document.getElementById('save-drawing-btn');
    const saveNewSvgPlanBtn = document.getElementById('save-new-svg-plan-btn');
    const newPlanNameInput = document.getElementById('new-plan-name');
    const strokeColorInput = document.getElementById('stroke-color');
    const strokeWidthInput = document.getElementById('stroke-width');
    const gridToggle = document.getElementById('grid-toggle');
    const snapToggle = document.getElementById('snap-toggle');
    const copyBtn = document.getElementById('copy-btn');
    const pasteBtn = document.getElementById('paste-btn');
    const deleteShapeBtn = document.getElementById('delete-shape-btn');
    const fillShapeToggle = document.getElementById('fill-shape-toggle');
    const fillColorInput = document.getElementById('fill-color');

    // Vérification des variables globales PHP
    console.log("Vérification des variables globales PHP..."); // NOUVEAU LOG
    console.log("planType:", typeof planType !== 'undefined' ? planType : 'undefined'); // NOUVEAU LOG
    console.log("currentPlanId:", typeof currentPlanId !== 'undefined' ? currentPlanId : 'undefined'); // NOUVEAU LOG
    console.log("currentPlan:", typeof currentPlan !== 'undefined' ? currentPlan : 'undefined'); // NOUVEAU LOG
    console.log("universColors:", typeof universColors !== 'undefined' ? universColors : 'undefined'); // NOUVEAU LOG
    console.log("planUnivers:", typeof planUnivers !== 'undefined' ? planUnivers : 'undefined'); // NOUVEAU LOG
    console.log("placedGeoCodes:", typeof placedGeoCodes !== 'undefined' ? placedGeoCodes : 'undefined'); // NOUVEAU LOG

    if (typeof planType !== 'undefined' && planType !== 'svg_creation') {
        if (typeof currentPlanId === 'undefined' || typeof currentPlan === 'undefined' || typeof universColors === 'undefined' || typeof planUnivers === 'undefined') {
            console.error("Variables globales PHP (currentPlanId, etc.) manquantes.");
            if (planContainer) planContainer.innerHTML = "<p class='text-danger p-3'>Erreur critique: Données de configuration manquantes.</p>";
            return;
        }
        if (typeof placedGeoCodes === 'undefined') {
            console.error("Variable globale PHP 'placedGeoCodes' manquante.");
            if (planContainer) planContainer.innerHTML = "<p class='text-danger p-3'>Erreur critique: Données des codes géo manquantes.</p>";
            return;
        }
    } else if (typeof planType === 'undefined') {
         console.error("La variable globale PHP 'planType' est manquante."); // NOUVEAU LOG
          if (planContainer) planContainer.innerHTML = "<p class='text-danger p-3'>Erreur critique: Type de plan non défini.</p>";
         return;
    }

    console.log("Initialisation du canvas Fabric..."); // NOUVEAU LOG
    const fabricCanvas = new fabric.Canvas(canvasEl, {
        selection: true,
        backgroundColor: '#ffffff',
        stopContextMenu: true,
        fireRightClick: true,
        preserveObjectStacking: true
    });
    console.log("Canvas Fabric initialisé."); // NOUVEAU LOG

    // --- ÉTAT DE L'APPLICATION ---
    let allCodesData = (typeof placedGeoCodes !== 'undefined' && Array.isArray(placedGeoCodes)) ? placedGeoCodes : [];
    let fabricObjects = {};
    let isPlacementMode = false,
        codeToPlace = null;
    let isPanning = false,
        lastPosX, lastPosY;
    let selectedFabricObject = null,
        highlightedCodeGeo = null,
        isDrawingArrowMode = false;
    let currentDrawingTool = 'select',
        isDrawing = false,
        startPoint = null,
        currentShape = null;
    let gridLines = [],
        isGridVisible = false,
        isSnapEnabled = false;
    let fabricClipboard = null;

    const sizePresets = {
        small: {
            width: 60,
            height: 20
        },
        medium: {
            width: 80,
            height: 22
        },
        large: {
            width: 100,
            height: 24
        }
    };

    // --- SÉQUENCE D'INITIALISATION CORRIGÉE ---
    initializePlan();

    async function initializePlan() {
        console.log("Début de initializePlan(), planType:", planType); // NOUVEAU LOG
        if (typeof planType !== 'undefined') document.body.classList.add(`plan-type-${planType}`);
        setupUI();
        try {
            // Étape 1: Charger fond
            if (planType === 'svg_creation') {
                console.log("Configuration pour svg_creation."); // NOUVEAU LOG
                fabricCanvas.setBackgroundColor('#ffffff');
                fabricCanvas.renderAll(); // S'assurer que le fond blanc s'affiche
            } else if (planType === 'svg') {
                console.log("Tentative de chargement du plan SVG."); // NOUVEAU LOG
                await loadSvgPlan(`uploads/plans/${currentPlan.nom_fichier}`);
                console.log("Chargement SVG terminé (ou échoué si erreur avant)."); // NOUVEAU LOG
            } else { // 'image'
                console.log("Tentative de chargement de l'image de fond."); // NOUVEAU LOG
                await loadBackgroundImage();
                console.log("Chargement image de fond terminé."); // NOUVEAU LOG
                if (initialDrawingData) { // Charger annotations JSON
                    console.log("Chargement des données de dessin (annotations JSON)..."); // NOUVEAU LOG
                    fabricCanvas.loadFromJSON(initialDrawingData, () => {
                        console.log("Annotations JSON chargées et rendues."); // NOUVEAU LOG
                        fabricCanvas.renderAll();
                        fabricCanvas.getObjects().forEach(obj => {
                            if (!obj.customData?.isGeoTag) obj.set({
                                selectable: true,
                                evented: true,
                                hasControls: true,
                                hasBorders: true
                            });
                            else fabricCanvas.remove(obj); // Suppression redondante?
                        });
                         console.log("Vérification post-JSON des objets non-tag.");// NOUVEAU LOG
                        fabricCanvas.renderAll();
                    });
                }
            }
            // Étape 2: Afficher codes géo (le fond est prêt)
            if (planType === 'image' || planType === 'svg') {
                 console.log("Préparation de l'affichage des tags géo."); // NOUVEAU LOG
                // La variable `allCodesData` est déjà initialisée avec `placedGeoCodes`
                createInitialGeoTags(); // Utilise allCodesData (déjà formaté)
                await fetchAvailableCodes(); // Charge la sidebar
                updateLegend();
                 console.log("Tags géo et sidebar initialisés."); // NOUVEAU LOG
            }
            // Étape 3: Listeners
            addEventListeners();
            setActiveTool(currentDrawingTool);
            if (gridToggle) {
                isGridVisible = gridToggle.checked;
                if (isGridVisible) drawGrid();
            }
            if (snapToggle) isSnapEnabled = snapToggle.checked;
            if (fillShapeToggle && fillColorInput) fillColorInput.style.display = fillShapeToggle.checked ? 'inline-block' : 'none';
            // Étape 4: Centrage final
             console.log("Appel final à resizeCanvas()."); // NOUVEAU LOG
            resizeCanvas();
            console.log("Initialisation terminée avec succès."); // NOUVEAU LOG
        } catch (error) {
            console.error("Erreur d'initialisation du plan:", error);
            if (planContainer) planContainer.innerHTML = `<p class='text-danger p-3'>Impossible de charger le plan : ${error.message}</p>`;
        }
    }

     function setupUI() {
        console.log("Configuration de l'interface utilisateur (setupUI)..."); // NOUVEAU LOG
        if (drawingToolbar) drawingToolbar.style.display = (planType === 'image' || planType === 'svg' || planType === 'svg_creation') ? 'flex' : 'none';
        if (saveDrawingBtn) {
            if (planType === 'image') {
                saveDrawingBtn.innerHTML = '<i class="bi bi-save"></i> Sauvegarder Annotations';
                saveDrawingBtn.style.display = 'block';
            } else if (planType === 'svg') {
                saveDrawingBtn.innerHTML = '<i class="bi bi-save"></i> Sauvegarder SVG';
                saveDrawingBtn.style.display = 'block';
            } else {
                saveDrawingBtn.style.display = 'none';
            }
        }
        if (saveNewSvgPlanBtn) saveNewSvgPlanBtn.style.display = (planType === 'svg_creation') ? 'block' : 'none';
        if (tagToolbar) tagToolbar.style.display = (planType === 'image' || planType === 'svg') ? 'flex' : 'none';
        const sidebar = document.getElementById('unplaced-codes-sidebar');
        const toggleBtn = document.getElementById('toggle-sidebar-btn');
        const shouldShowSidebar = (planType !== 'svg_creation');
        if (sidebar) sidebar.style.display = shouldShowSidebar ? 'flex' : 'none';
        if (toggleBtn) toggleBtn.style.display = shouldShowSidebar ? 'flex' : 'none';
         console.log("Configuration UI terminée."); // NOUVEAU LOG
    }


    function resizeCanvas() {
        console.log("Début resizeCanvas()."); // NOUVEAU LOG
        if (!planContainer) {
            console.warn("planContainer non trouvé dans resizeCanvas."); // NOUVEAU LOG
            return;
        }
        const containerRect = planContainer.getBoundingClientRect();
        console.log("Dimensions du conteneur:", containerRect.width, "x", containerRect.height); // NOUVEAU LOG
        fabricCanvas.setWidth(containerRect.width);
        fabricCanvas.setHeight(containerRect.height);
        fabricCanvas.calcOffset();
        console.log("Dimensions canvas Fabric mises à jour:", fabricCanvas.getWidth(), "x", fabricCanvas.getHeight()); // NOUVEAU LOG

        if (planType !== 'svg_creation') {
            console.log("Appel resetZoom depuis resizeCanvas."); // NOUVEAU LOG
            resetZoom();
        } else {
            console.log("Mode svg_creation, mise à jour grille si visible."); // NOUVEAU LOG
            if (isGridVisible) drawGrid();
        }
        console.log("Fin resizeCanvas(), rendu du canvas."); // NOUVEAU LOG
        fabricCanvas.renderAll();
    }

    function resetZoom() {
        console.log("Début resetZoom(). planType:", planType); // NOUVEAU LOG
        if (planType === 'svg_creation') {
            console.log("Reset zoom pour svg_creation."); // NOUVEAU LOG
            fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        } else {
            const bg = fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group');
            console.log("Objet de fond trouvé pour resetZoom:", bg); // NOUVEAU LOG
            if (!bg || !bg.width || !bg.height) {
                 console.warn("Arrière-plan (ou ses dimensions) non trouvé dans resetZoom."); // NOUVEAU LOG
                return;
            }
            const canvasWidth = fabricCanvas.getWidth(),
                canvasHeight = fabricCanvas.getHeight();
            const bgActualWidth = bg.width * (bg.scaleX || 1),
                bgActualHeight = bg.height * (bg.scaleY || 1);
            console.log(`Dimensions réelles fond: ${bgActualWidth}x${bgActualHeight}, Canvas: ${canvasWidth}x${canvasHeight}`); // NOUVEAU LOG

            if (bgActualWidth > 0 && bgActualHeight > 0) {
                const scaleToFit = Math.min(canvasWidth / bgActualWidth, canvasHeight / bgActualHeight, 1);
                const panX = (canvasWidth - bgActualWidth * scaleToFit) / 2,
                    panY = (canvasHeight - bgActualHeight * scaleToFit) / 2;
                console.log(`Calculs resetZoom: scaleToFit=${scaleToFit}, panX=${panX}, panY=${panY}`); // NOUVEAU LOG
                fabricCanvas.setViewportTransform([scaleToFit, 0, 0, scaleToFit, panX, panY]);
            } else {
                 console.warn("Dimensions de l'arrière-plan invalides pour le calcul du zoom."); // NOUVEAU LOG
                fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            }
        }
        updateStrokesWidth(fabricCanvas.getZoom());
        if (isGridVisible) drawGrid();
         console.log("Fin resetZoom(), rendu canvas."); // NOUVEAU LOG
        fabricCanvas.renderAll();
    }


    function loadBackgroundImage() {
        console.log("Début loadBackgroundImage()."); // NOUVEAU LOG
        return new Promise((resolve, reject) => {
            if (!mapImageEl) {
                if (planType === 'image') {
                    console.error("Élément #map-image non trouvé."); // NOUVEAU LOG
                    reject(new Error("Élément #map-image non trouvé."));
                } else resolve(); // Pas une erreur si pas type image
                return;
            }
            const imageUrl = mapImageEl.src;
             console.log("URL de l'image:", imageUrl); // NOUVEAU LOG
            if (!imageUrl || (!imageUrl.startsWith('http') && !imageUrl.startsWith('uploads'))) {
                 console.error("URL image invalide:", imageUrl); // NOUVEAU LOG
                reject(new Error("URL image invalide."));
                return;
            }
            fabric.Image.fromURL(imageUrl, (img, isError) => {
                if (isError || !img) {
                    console.error("Chargement image Fabric échoué:", imageUrl); // NOUVEAU LOG
                    reject(new Error("Chargement image Fabric échoué: " + imageUrl));
                    return;
                }
                 console.log("Image Fabric chargée, définition comme arrière-plan."); // NOUVEAU LOG
                fabricCanvas.setBackgroundImage(img, () => {
                     console.log("Image définie comme arrière-plan et rendue."); // NOUVEAU LOG
                    fabricCanvas.renderAll();
                    resolve();
                }, {
                    selectable: false,
                    evented: false,
                    originX: 'left',
                    originY: 'top',
                    crossOrigin: 'anonymous'
                });
            }, {
                crossOrigin: 'anonymous'
            });
        });
    }

    function loadSvgPlan(url) {
        console.log("Début loadSvgPlan(), URL:", url); // NOUVEAU LOG
        return new Promise((resolve, reject) => {
            fabric.loadSVGFromURL(url, (objects, options) => {
                if (!objects) {
                    console.error("Chargement SVG échoué (objets null):", url); // NOUVEAU LOG
                    reject(new Error("Chargement SVG échoué: " + url));
                    return;
                }
                 console.log(`SVG chargé depuis l'URL. ${objects.length} objets trouvés.`); // NOUVEAU LOG

                const svgData = fabric.util.groupSVGElements(objects, options);
                console.log("SVG group dimensions (avant scale):", svgData.width, svgData.height, "Scale:", svgData.scaleX); // LOG EXISTANT
                if (!svgData.width || !svgData.height) {
                     console.warn("Les dimensions du groupe SVG sont nulles ou indéfinies après groupSVGElements."); // NOUVEAU LOG
                     // Tentative de recalcul si possible (simple bounding box)
                     const bounds = svgData.getBoundingRect();
                     svgData.width = bounds.width;
                     svgData.height = bounds.height;
                     console.log("Dimensions recalculées (getBoundingRect):", svgData.width, svgData.height); // NOUVEAU LOG
                }

                fabricCanvas.setBackgroundColor('#ffffff'); // Fond blanc pour SVG
                const canvasWidth = fabricCanvas.getWidth(),
                    canvasHeight = fabricCanvas.getHeight();
                console.log("Canvas dimensions après chargement SVG:", canvasWidth, canvasHeight); // LOG EXISTANT

                if (svgData.width && svgData.height && canvasWidth && canvasHeight) {
                    const padding = 0.9; // Garder une marge
                    const scaleFactor = Math.min((canvasWidth * padding) / svgData.width, (canvasHeight * padding) / svgData.height, 1);
                    console.log("Facteur de scale calculé pour SVG:", scaleFactor); // NOUVEAU LOG
                    svgData.scale(scaleFactor);
                    svgData.set({ // Marquer comme fond SVG pour référence future
                       isSvgBackground: true,
                       selectable: false, // Rendre non sélectionnable par défaut
                       evented: false
                    });
                     console.log("Dimensions du groupe SVG après scale:", svgData.width * scaleFactor, "x", svgData.height * scaleFactor); // NOUVEAU LOG
                } else {
                     console.warn("Impossible de calculer le facteur de scale (dimensions manquantes)."); // NOUVEAU LOG
                }

                console.log("Ajout du groupe SVG au canvas Fabric."); // NOUVEAU LOG
                fabricCanvas.add(svgData);
                svgData.center().setCoords();
                 console.log("Groupe SVG centré."); // NOUVEAU LOG
                // makeSvgGroupEditable(svgData); // Commenté car on le veut non éditable par défaut
                fabricCanvas.renderAll();
                 console.log("Rendu final du canvas après ajout SVG."); // NOUVEAU LOG
                resolve();
            }, (item, object) => {
                 // NOUVEAU LOG: Log de chaque élément SVG lors du chargement
                // console.log("Chargement élément SVG:", item.tagName, "->", object.type);
            }, {
                crossOrigin: 'anonymous'
            });
        });
    }

    // --- Le reste du fichier reste identique ---
    // ... (copier/coller le reste de plan.js à partir d'ici)

    function makeSvgGroupEditable(obj) {
        // ... (code existant)
    }

    function createInitialGeoTags() {
        console.log("Entering createInitialGeoTags. Background/SVG group:", fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group')); // LOG EXISTANT
        fabricObjects = {};
        // Suppression plus prudente : seulement les tags géo existants
        fabricCanvas.getObjects().slice().filter(obj => obj.customData?.isGeoTag).forEach(tag => {
             console.log("Suppression ancien tag géo:", tag.customData.codeGeo); // NOUVEAU LOG
            if (tag.arrowLine) fabricCanvas.remove(tag.arrowLine);
            fabricCanvas.remove(tag);
        });
        let tagsCreated = 0;
        allCodesData.forEach(code => {
            if (code.placements) {
                code.placements.forEach(placement => {
                    if (placement.plan_id == currentPlanId && placement.pos_x !== null) {
                        console.log("Traitement code pour tag:", code.code_geo, "Placement:", placement); // LOG EXISTANT
                        const {
                            placements,
                            ...codeData
                        } = code;
                        createFabricTag({
                            ...codeData,
                            ...placement
                        });
                        tagsCreated++;
                    }
                });
            }
        });
        console.log(`${tagsCreated} tags géo créés.`);
        fabricCanvas.renderAll();
         console.log("Fin createInitialGeoTags."); // NOUVEAU LOG
    }

    function createFabricTag(code) {
        const bg = fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group');
        console.log("createFabricTag - Fond trouvé:", bg); // LOG EXISTANT
        if (!bg || code.pos_x === null || typeof code.pos_x === 'undefined' || typeof code.pos_y === 'undefined') {
            console.warn("createFabricTag - Arrière-plan non trouvé ou pos_x/pos_y manquant/null pour", code.code_geo, "PosX:", code.pos_x, "PosY:", code.pos_y); // LOG MODIFIÉ
            return null;
        }
        // NOUVEAU LOG: Vérifier les valeurs avant conversion
        console.log(`createFabricTag - Avant conversion pixels pour ${code.code_geo}: PosX%=${code.pos_x}, PosY%=${code.pos_y}`);

        const {
            left,
            top
        } = convertPercentToPixels(code.pos_x, code.pos_y);
         // NOUVEAU LOG: Vérifier si left/top sont valides
        if (isNaN(left) || isNaN(top)) {
             console.error(`createFabricTag - Coordonnées calculées invalides (NaN) pour ${code.code_geo}: left=${left}, top=${top}`);
             return null;
        }
        console.log(`Pixels calculés pour ${code.code_geo}: left=${left}, top=${top}`); // LOG EXISTANT

        const bgColor = universColors[code.univers] || '#7f8c8d';
        const codeText = code.code_geo || 'ERR';
        const tagWidth = code.width || sizePresets.medium.width,
            tagHeight = code.height || sizePresets.medium.height;
        const rect = new fabric.Rect({
            width: tagWidth,
            height: tagHeight,
            fill: bgColor,
            stroke: 'black',
            strokeWidth: 1,
            rx: 3,
            ry: 3,
            originX: 'center',
            originY: 'center',
            shadow: 'rgba(0,0,0,0.3) 2px 2px 4px'
        });
        const text = new fabric.Text(codeText, {
            fontSize: GEO_TAG_FONT_SIZE,
            fill: 'white',
            fontWeight: 'bold',
            fontFamily: 'Arial',
            originX: 'center',
            originY: 'center'
        });
         console.log(`createFabricTag - Création groupe Fabric pour ${code.code_geo} à (${left}, ${top})`); // NOUVEAU LOG
        const group = new fabric.Group([rect, text], {
            left,
            top,
            originX: 'center',
            originY: 'center',
            selectable: true,
            evented: true,
            hasControls: false,
            hasBorders: true,
            borderColor: '#007bff',
            cornerSize: 0,
            transparentCorners: true,
            lockRotation: true,
            lockScalingX: true,
            lockScalingY: true,
            hoverCursor: 'move',
            customData: {
                ...code,
                isGeoTag: true,
                currentWidth: tagWidth,
                currentHeight: tagHeight
            }
        });
        if (code.anchor_x !== null && typeof code.anchor_x !== 'undefined' && code.anchor_y !== null && typeof code.anchor_y !== 'undefined') { // Vérification ajoutée
             console.log(`createFabricTag - Ajout flèche pour ${code.code_geo}`); // NOUVEAU LOG
            addArrowToTag(group, code.anchor_x, code.anchor_y);
        }
         console.log(`createFabricTag - Ajout groupe au canvas Fabric: ${code.code_geo}`); // NOUVEAU LOG
        fabricCanvas.add(group);
        fabricObjects[code.position_id] = group;
        group.moveTo(999); // Mettre au premier plan
        updateHighlightEffect(group);
         console.log(`createFabricTag - Tag ${code.code_geo} traité.`); // NOUVEAU LOG
        return group;
    }

    // --- Coller le reste des fonctions de plan.js ici ---
    // setActiveTool, startDrawing, continueDrawing, stopDrawing, drawGrid, removeGrid, ... etc.
    // ... jusqu'à la fin du fichier ...


    function setActiveTool(tool) {
        currentDrawingTool = tool;
        fabricCanvas.isDrawingMode = (tool === 'freehand');
        fabricCanvas.selection = (tool === 'select');
        fabricCanvas.defaultCursor = (tool === 'select') ? 'default' : 'crosshair';
        fabricCanvas.hoverCursor = (tool === 'select') ? 'move' : 'crosshair';
        fabricCanvas.getObjects().forEach(obj => obj.set({
            selectable: (tool === 'select') || (obj.customData?.isGeoTag),
            evented: (tool === 'select') || (obj.customData?.isGeoTag)
        }));
        toolBtns?.forEach(btn => btn.classList.toggle('active', btn.dataset.tool === tool));
        if (fabricCanvas.isDrawingMode) {
            fabricCanvas.freeDrawingBrush.color = strokeColorInput.value;
            fabricCanvas.freeDrawingBrush.width = parseInt(strokeWidthInput.value, 10);
        }
        fabricCanvas.discardActiveObject().renderAll();
    }

    function startDrawing(pointer) {
        isDrawing = true;
        startPoint = pointer;
        const strokeColor = strokeColorInput.value,
            strokeWidth = parseInt(strokeWidthInput.value, 10),
            fillColor = fillShapeToggle.checked ? fillColorInput.value : 'transparent';
        const zoom = fabricCanvas.getZoom();
        const options = {
            stroke: strokeColor,
            strokeWidth: strokeWidth / zoom,
            fill: fillColor,
            selectable: false,
            evented: false,
            baseStrokeWidth: strokeWidth
        };
        switch (currentDrawingTool) {
            case 'line':
                currentShape = new fabric.Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], options);
                break;
            case 'rect':
                currentShape = new fabric.Rect({
                    left: startPoint.x,
                    top: startPoint.y,
                    width: 0,
                    height: 0,
                    ...options
                });
                break;
            case 'circle':
                currentShape = new fabric.Ellipse({
                    left: startPoint.x,
                    top: startPoint.y,
                    rx: 0,
                    ry: 0,
                    originX: 'center',
                    originY: 'center',
                    ...options
                });
                break;
        }
        if (currentShape) fabricCanvas.add(currentShape);
    }

    function continueDrawing(pointer) {
        if (!isDrawing || !currentShape) return;
        let {
            x,
            y
        } = isSnapEnabled ? snapToGrid(pointer.x, pointer.y) : pointer;
        switch (currentDrawingTool) {
            case 'line':
                currentShape.set({
                    x2: x,
                    y2: y
                });
                break;
            case 'rect':
                currentShape.set({
                    left: Math.min(x, startPoint.x),
                    top: Math.min(y, startPoint.y),
                    width: Math.abs(x - startPoint.x),
                    height: Math.abs(y - startPoint.y)
                });
                break;
            case 'circle':
                const rx = Math.hypot(x - startPoint.x, y - startPoint.y) / 2;
                currentShape.set({
                    left: (startPoint.x + x) / 2,
                    top: (startPoint.y + y) / 2,
                    rx,
                    ry: rx
                });
                break;
        }
        fabricCanvas.renderAll();
    }

    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        if (currentShape) currentShape.set({
            selectable: true,
            evented: true
        }).setCoords();
        currentShape = null;
        startPoint = null;
        fabricCanvas.renderAll();
    }

    function drawGrid() {
        removeGrid();
        if (!isGridVisible) return;
        const vpt = fabricCanvas.viewportTransform,
            zoom = vpt[0],
            panX = vpt[4],
            panY = vpt[5];
        const left = -panX / zoom,
            top = -panY / zoom,
            right = (fabricCanvas.width - panX) / zoom,
            bottom = (fabricCanvas.height - panY) / zoom;
        const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE,
            startY = Math.floor(top / GRID_SIZE) * GRID_SIZE;
        for (let x = startX; x < right; x += GRID_SIZE) gridLines.push(new fabric.Line([x, top, x, bottom], {
            stroke: 'rgba(0,0,0,0.1)',
            strokeWidth: 1 / zoom,
            selectable: false,
            evented: false,
            excludeFromExport: true,
            isGridLine: true
        }));
        for (let y = startY; y < bottom; y += GRID_SIZE) gridLines.push(new fabric.Line([left, y, right, y], {
            stroke: 'rgba(0,0,0,0.1)',
            strokeWidth: 1 / zoom,
            selectable: false,
            evented: false,
            excludeFromExport: true,
            isGridLine: true
        }));
        fabricCanvas.add(...gridLines);
        gridLines.forEach(l => l.moveTo(-1));
        fabricCanvas.renderAll();
    }

    function removeGrid() {
        fabricCanvas.remove(...gridLines);
        gridLines = [];
    }

    function toggleGrid() {
        isGridVisible = gridToggle.checked;
        isGridVisible ? drawGrid() : removeGrid();
    }

    function toggleSnap() {
        isSnapEnabled = snapToggle.checked;
    }

    function snapToGrid(x, y) {
        const point = fabric.util.transformPoint({
            x,
            y
        }, fabric.util.invertTransform(fabricCanvas.viewportTransform));
        return fabric.util.transformPoint({
            x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
            y: Math.round(point.y / GRID_SIZE) * GRID_SIZE
        }, fabricCanvas.viewportTransform);
    }

    function copyShape() {
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject && !activeObject.customData?.isGeoTag && !activeObject.isGridLine) {
            activeObject.clone(cloned => {
                fabricClipboard = cloned;
            });
        } else {
            fabricClipboard = null;
        }
    }

    function pasteShape() {
        if (!fabricClipboard) return;
        fabricClipboard.clone(clonedObj => {
            fabricCanvas.discardActiveObject();
            clonedObj.set({
                left: clonedObj.left + 10,
                top: clonedObj.top + 10,
                evented: true,
                selectable: true
            });
            if (clonedObj.type === 'activeSelection') {
                clonedObj.canvas = fabricCanvas;
                clonedObj.forEachObject(obj => fabricCanvas.add(obj));
                clonedObj.setCoords();
            } else {
                fabricCanvas.add(clonedObj);
            }
            fabricClipboard.top += 10;
            fabricClipboard.left += 10;
            fabricCanvas.setActiveObject(clonedObj).renderAll();
        });
    }

    function deleteSelectedShape() {
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject && !activeObject.customData?.isGeoTag && !activeObject.isGridLine) {
            if (activeObject.type === 'activeSelection') activeObject.forEachObject(obj => fabricCanvas.remove(obj));
            else fabricCanvas.remove(activeObject);
            fabricCanvas.discardActiveObject().renderAll();
        } else if (activeObject?.customData?.isGeoTag) {
            alert("Utilisez la barre d'outils du tag géo pour le supprimer.");
        }
    }

    function addEventListeners() {
        console.log("Ajout des écouteurs d'événements..."); // NOUVEAU LOG
        window.addEventListener('resize', resizeCanvas);
        fabricCanvas.on({
            'mouse:wheel': handleMouseWheel,
            'mouse:down': handleMouseDown,
            'mouse:move': handleMouseMove,
            'mouse:up': handleMouseUp,
            'mouse:out': handleMouseOut,
            'object:moving': handleObjectMoving,
            'object:modified': handleObjectModified,
            'selection:created': handleSelection,
            'selection:updated': handleSelection,
            'selection:cleared': handleSelectionCleared,
            'viewport:transformed': () => {
                 console.log("Viewport transformé, mise à jour grille/traits."); // NOUVEAU LOG
                if (isGridVisible) drawGrid();
                updateStrokesWidth(fabricCanvas.getZoom());
            }
        });
        document.addEventListener('keydown', handleKeyDown);
        if (deleteTagBtn) deleteTagBtn.addEventListener('click', deleteSelectedTag);
        if (highlightTagBtn) highlightTagBtn.addEventListener('click', toggleHighlightSelected);
        if (arrowTagBtn) arrowTagBtn.addEventListener('click', startDrawingArrow);
        sizeBtns?.forEach(btn => btn.addEventListener('click', changeSelectedTagSize));
        if (unplacedList) unplacedList.addEventListener('click', handleAvailableCodeClick);
        if (addCodeBtn && addCodeModal) addCodeBtn.addEventListener('click', openAddCodeModal);
        if (saveNewCodeBtn) saveNewCodeBtn.addEventListener('click', handleSaveNewCode);
        if (searchInput) searchInput.addEventListener('input', filterAvailableCodes);
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => zoom(1.2));
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => zoom(0.8));
        if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoom);
        if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
        if (toggleSidebarBtn) toggleSidebarBtn.addEventListener('click', () => planPageContainer?.classList.toggle('sidebar-hidden'));
        toolBtns?.forEach(btn => btn.addEventListener('click', () => setActiveTool(btn.dataset.tool)));
        if (saveDrawingBtn) saveDrawingBtn.addEventListener('click', () => (planType === 'image' ? saveDrawing() : saveModifiedSvgPlan()));
        if (saveNewSvgPlanBtn) saveNewSvgPlanBtn.addEventListener('click', saveNewSvgPlan);
        if (strokeColorInput) strokeColorInput.addEventListener('input', updateDrawingStyle);
        if (strokeWidthInput) strokeWidthInput.addEventListener('input', updateDrawingStyle);
        if (fillShapeToggle) fillShapeToggle.addEventListener('change', () => {
            if (fillColorInput) fillColorInput.style.display = fillShapeToggle.checked ? 'inline-block' : 'none';
            updateDrawingStyle();
        });
        if (fillColorInput) fillColorInput.addEventListener('input', updateDrawingStyle);
        if (gridToggle) gridToggle.addEventListener('change', toggleGrid);
        if (snapToggle) snapToggle.addEventListener('change', toggleSnap);
        if (copyBtn) copyBtn.addEventListener('click', copyShape);
        if (pasteBtn) pasteBtn.addEventListener('click', pasteShape);
        if (deleteShapeBtn) deleteShapeBtn.addEventListener('click', deleteSelectedShape);
         console.log("Écouteurs d'événements ajoutés."); // NOUVEAU LOG
    }


    function handleMouseDown(opt) {
        const {
            e: evt,
            target,
            pointer
        } = opt;
        if (target && !target.isGridLine) {
            if (target.customData?.isGeoTag) {
                selectedFabricObject = target;
                if (isDrawingArrowMode) {
                    handleArrowEndPoint(opt);
                    isDrawingArrowMode = false;
                    return;
                }
            } else if (currentDrawingTool !== 'select') {
                target.set({
                    evented: false
                });
            }
            return;
        }
        selectedFabricObject = null;
        hideToolbar();
        if (currentDrawingTool !== 'select') fabricCanvas.discardActiveObject().renderAll();
        if (isPlacementMode && codeToPlace) {
            placeNewTag(evt);
        } else if (isDrawingArrowMode) {
            handleArrowEndPoint(opt);
            isDrawingArrowMode = false;
        } else if (currentDrawingTool !== 'select' && currentDrawingTool !== 'freehand') {
            startDrawing(isSnapEnabled ? snapToGrid(pointer.x, pointer.y) : pointer);
        } else if (evt.altKey || evt.button === 1) {
            isPanning = true;
            fabricCanvas.defaultCursor = 'grabbing';
            lastPosX = evt.clientX;
            lastPosY = evt.clientY;
        }
    }

    function handleMouseMove({
        e: evt
    }) {
        if (isPanning) {
            fabricCanvas.relativePan(new fabric.Point(evt.clientX - lastPosX, evt.clientY - lastPosY));
            lastPosX = evt.clientX;
            lastPosY = evt.clientY;
        } else if (isDrawing) {
            continueDrawing(fabricCanvas.getPointer(evt));
        }
    }

    function handleMouseUp({
        target
    }) {
        if (isPanning) isPanning = false;
        if (isDrawing) stopDrawing();
        if (target && !target.evented && currentDrawingTool !== 'select' && !target.customData?.isGeoTag && !target.isGridLine) target.set({
            evented: true
        });
        fabricCanvas.defaultCursor = (currentDrawingTool === 'select') ? 'default' : 'crosshair';
    }

    function handleMouseOut() {
        if (isPanning) isPanning = false;
        if (isDrawing) stopDrawing();
        fabricCanvas.defaultCursor = (currentDrawingTool === 'select') ? 'default' : 'crosshair';
    }

    function handleObjectMoving({
        target
    }) {
        if (!isSnapEnabled || !target || target.isGridLine) return;
        target.set({
            left: Math.round(target.left / GRID_SIZE) * GRID_SIZE,
            top: Math.round(target.top / GRID_SIZE) * GRID_SIZE
        }).setCoords();
        if (target.customData?.isGeoTag) {
            showToolbar(target);
            if (target.arrowLine) addArrowToTag(target, target.customData.anchorXPercent, target.customData.anchorYPercent);
        }
    }

    function handleObjectModified({
        target
    }) {
        if (!target || target.isGridLine) return;
        if (target.customData?.isGeoTag) {
            const {
                positionId,
                geoCodeId,
                currentWidth,
                currentHeight,
                anchorXPercent,
                anchorYPercent
            } = target.customData;
            const {
                posX,
                posY
            } = convertPixelsToPercent(target.getCenterPoint().x, target.getCenterPoint().y);
            savePositionAPI({
                id: geoCodeId,
                position_id: positionId,
                plan_id: currentPlanId,
                pos_x: posX,
                pos_y: posY,
                width: currentWidth,
                height: currentHeight,
                anchor_x: anchorXPercent,
                anchor_y: anchorYPercent
            });
            if (target.arrowLine) addArrowToTag(target, anchorXPercent, anchorYPercent);
            showToolbar(target);
        }
    }

    function handleSelection({
        selected
    }) {
        selectedFabricObject = selected[0];
        if (!selectedFabricObject || selectedFabricObject.isGridLine) {
            hideToolbar();
            return;
        }
        if (selectedFabricObject.customData?.isGeoTag) {
            showToolbar(selectedFabricObject);
            redrawAllTagsHighlight();
        } else {
            hideToolbar();
            strokeColorInput.value = selectedFabricObject.stroke || '#000000';
            strokeWidthInput.value = selectedFabricObject.baseStrokeWidth || Math.round(selectedFabricObject.strokeWidth * fabricCanvas.getZoom());
            fillShapeToggle.checked = !!(selectedFabricObject.fill && selectedFabricObject.fill !== 'transparent');
            fillColorInput.value = fillShapeToggle.checked ? (fabric.Color.isColor(selectedFabricObject.fill) ? new fabric.Color(selectedFabricObject.fill).toHex() : '#cccccc') : '#cccccc';
            if (fillColorInput) fillColorInput.style.display = fillShapeToggle.checked ? 'inline-block' : 'none';
        }
    }

    function handleSelectionCleared() {
        hideToolbar();
        selectedFabricObject = null;
        redrawAllTagsHighlight();
    }

    function handleKeyDown(e) {
        const activeObj = fabricCanvas.getActiveObject();
        if (e.key === 'Escape') {
            if (isPlacementMode) cancelPlacementMode();
            if (isDrawingArrowMode) cancelArrowDrawing();
            if (isDrawing) stopDrawing();
            if (activeObj) fabricCanvas.discardActiveObject().renderAll();
            if (highlightedCodeGeo) {
                highlightedCodeGeo = null;
                redrawAllTagsHighlight();
            }
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && activeObj && !activeObj.customData?.isGeoTag) {
            deleteSelectedShape();
            e.preventDefault();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            copyShape();
            e.preventDefault();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            pasteShape();
            e.preventDefault();
        }
    }

    function handleMouseWheel(opt) {
        const delta = opt.e.deltaY,
            zoom = fabricCanvas.getZoom() * (0.999 ** delta);
        fabricCanvas.zoomToPoint({
            x: opt.e.offsetX,
            y: opt.e.offsetY
        }, Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)));
        opt.e.preventDefault();
        opt.e.stopPropagation();
    }

    function updateDrawingStyle() {
        const strokeColor = strokeColorInput.value,
            baseStrokeWidth = parseInt(strokeWidthInput.value, 10),
            fillColor = fillShapeToggle.checked ? fillColorInput.value : 'transparent';
        const activeObject = fabricCanvas.getActiveObject();
        const currentZoom = fabricCanvas.getZoom();
        if (activeObject && !activeObject.customData?.isGeoTag && !activeObject.isGridLine) {
            const updateProps = {
                stroke: strokeColor,
                strokeWidth: baseStrokeWidth / currentZoom,
                fill: fillColor,
                baseStrokeWidth: baseStrokeWidth
            };
            if (activeObject.type === 'activeSelection') activeObject.forEachObject(obj => {
                if (!obj.isGridLine) obj.set(updateProps);
            });
            else activeObject.set(updateProps);
            fabricCanvas.renderAll();
        }
        if (fabricCanvas.isDrawingMode) {
            fabricCanvas.freeDrawingBrush.color = strokeColor;
            fabricCanvas.freeDrawingBrush.width = baseStrokeWidth;
        }
    }
    async function saveDrawing() {
        if (planType !== 'image' || !currentPlanId) return;
        const dataToSave = fabricCanvas.toJSON(['customData', 'selectable', 'evented', 'baseStrokeWidth']);
        dataToSave.objects = dataToSave.objects.filter(obj => !obj.customData?.isGeoTag && !obj.isGridLine);
        try {
            const response = await fetch('index.php?action=saveDrawing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plan_id: currentPlanId,
                    drawing_data: dataToSave.objects.length > 0 ? dataToSave : null
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.status === 'success') alert('Annotations sauvegardées !');
            else throw new Error(result.message || 'Erreur serveur.');
        } catch (error) {
            console.error("Erreur saveDrawing:", error);
            alert(`Erreur sauvegarde: ${error.message}`);
        }
    }
    async function saveNewSvgPlan() {
        if (planType !== 'svg_creation' || !newPlanNameInput) return;
        const planName = newPlanNameInput.value.trim();
        if (!planName) {
            alert("Nom de plan requis.");
            newPlanNameInput.focus();
            return;
        }
        const svgString = fabricCanvas.toSVG(['baseStrokeWidth'], obj => {
            if (obj.isGridLine) return;
            return obj;
        });
        try {
            const response = await fetch('index.php?action=createSvgPlan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nom: planName,
                    svgContent: svgString
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.status === 'success' && result.new_plan_id) {
                alert(`Plan "${planName}" créé !`);
                window.location.href = `index.php?action=manageCodes&id=${result.new_plan_id}`;
            } else throw new Error(result.message || 'Erreur serveur.');
        } catch (error) {
            console.error("Erreur saveNewSvgPlan:", error);
            alert(`Erreur création SVG: ${error.message}`);
        }
    }
    async function saveModifiedSvgPlan() {
        if (planType !== 'svg' || !currentPlanId) return;
        console.log("Début saveModifiedSvgPlan."); // NOUVEAU LOG
        // Exporter seulement les objets qui ne sont PAS des tags géo, lignes de grille, ou le fond SVG lui-même
        const exportableObjects = fabricCanvas.getObjects().filter(obj => !obj.customData?.isGeoTag && !obj.isGridLine && !obj.isSvgBackground);
        console.log(`Nombre d'objets à exporter dans le SVG: ${exportableObjects.length}`); // NOUVEAU LOG

        // Créer un canvas temporaire pour exporter UNIQUEMENT les dessins ajoutés
        const tempCanvas = new fabric.StaticCanvas(null, {
            width: fabricCanvas.width, // Utiliser les dimensions actuelles du canvas
            height: fabricCanvas.height
        });

        // Cloner et ajouter les objets exportables au canvas temporaire
        exportableObjects.forEach(obj => tempCanvas.add(fabric.util.object.clone(obj)));

        // Récupérer le groupe SVG original s'il existe
        const originalSvgGroup = fabricCanvas.getObjects().find(o => o.isSvgBackground);
        if (originalSvgGroup) {
            // Cloner et ajouter le groupe SVG original au canvas temporaire aussi
            // Assurez-vous qu'il est en arrière-plan et non sélectionnable/modifiable pour l'export
            const clonedSvgBg = fabric.util.object.clone(originalSvgGroup);
            clonedSvgBg.set({ selectable: false, evented: false });
            tempCanvas.add(clonedSvgBg);
            clonedSvgBg.moveTo(0); // Mettre en arrière-plan
        } else {
             console.warn("Le groupe SVG original (isSvgBackground) n'a pas été trouvé pour l'export."); // NOUVEAU LOG
        }


        // Exporter le contenu du canvas temporaire en SVG
        const svgString = tempCanvas.toSVG(['baseStrokeWidth']);
        tempCanvas.dispose(); // Libérer la mémoire du canvas temporaire

        console.log("SVG généré pour sauvegarde:", svgString.substring(0, 200) + "..."); // NOUVEAU LOG (début du SVG)


        try {
            const response = await fetch('index.php?action=updateSvgPlan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plan_id: currentPlanId,
                    svgContent: svgString // Envoyer le SVG combiné
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.status === 'success') {
                console.log("Modifications SVG sauvegardées avec succès."); // NOUVEAU LOG
                alert('Modifications SVG sauvegardées !');
            } else throw new Error(result.message || 'Erreur serveur.');
        } catch (error) {
            console.error("Erreur saveModifiedSvgPlan:", error);
            alert(`Erreur sauvegarde SVG: ${error.message}`);
        }
    }


    function convertPercentToPixels(percentX, percentY) {
         // NOUVEAU LOG: Ajout pour voir ce qui arrive ici
         console.log(`convertPercentToPixels - Input: X=${percentX}%, Y=${percentY}%`);
        const bg = fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group');
        if (!bg || !bg.width || !bg.height || bg.width === 0 || bg.height === 0) {
             console.warn("convertPercentToPixels - Arrière-plan ou ses dimensions invalides.", bg); // NOUVEAU LOG
            return {
                left: 0,
                top: 0
            }; // Retourner 0,0 pour éviter NaN
        }
        // Utiliser les dimensions originales de l'objet, pas celles après scaling sur le canvas
        const bgWidth = bg.width * (bg.scaleX || 1);
        const bgHeight = bg.height * (bg.scaleY || 1);

        // NOUVEAU LOG: Vérifier les dimensions utilisées
         console.log(`convertPercentToPixels - Dimensions utilisées: ${bgWidth} x ${bgHeight}`);

         // Calculer les pixels relatifs à l'origine (0,0) de l'objet de fond
         const relativeX = (percentX / 100) * bgWidth;
         const relativeY = (percentY / 100) * bgHeight;

        // Obtenir l'origine de l'objet de fond sur le canvas
         const bgOrigin = bg.getPointByOrigin('left', 'top');

        // Ajouter l'origine pour obtenir les coordonnées globales sur le canvas
         const globalX = bgOrigin.x + relativeX;
         const globalY = bgOrigin.y + relativeY;

        // NOUVEAU LOG: Afficher le résultat
        console.log(`convertPercentToPixels - Output: left=${globalX}, top=${globalY}`);

        return {
            left: globalX,
            top: globalY
        };
    }


    function convertPixelsToPercent(pixelX, pixelY) {
        const bg = fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group');
        if (!bg || !bg.width || !bg.height || bg.width === 0 || bg.height === 0) {
            console.warn("convertPixelsToPercent - Arrière-plan ou dimensions invalides.", bg); // NOUVEAU LOG
            return {
                posX: 0,
                posY: 0
            };
        }
        const bgWidth = bg.width * (bg.scaleX || 1);
        const bgHeight = bg.height * (bg.scaleY || 1);
        const bgOrigin = bg.getPointByOrigin('left', 'top');
        const relativeX = pixelX - bgOrigin.x;
        const relativeY = pixelY - bgOrigin.y;

         const posX = Math.max(0, Math.min(100, (relativeX / bgWidth) * 100));
         const posY = Math.max(0, Math.min(100, (relativeY / bgHeight) * 100));

        // NOUVEAU LOG
         console.log(`convertPixelsToPercent - Input: (${pixelX}, ${pixelY}), Output: (${posX}%, ${posY}%)`);

        return { posX, posY };
    }


    function addArrowToTag(tagGroup, anchorXPercent, anchorYPercent) {
        // NOUVEAU LOG: Vérifier les inputs
        console.log(`addArrowToTag - Tag: ${tagGroup.customData.codeGeo}, Anchor: ${anchorXPercent}%, ${anchorYPercent}%`);

        const bg = fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group');

        if (!bg || anchorXPercent === null || typeof anchorXPercent === 'undefined' || anchorYPercent === null || typeof anchorYPercent === 'undefined') { // Vérification renforcée
             console.warn("addArrowToTag - Arrière-plan ou coordonnées d'ancre invalides/manquantes."); // NOUVEAU LOG
            if (tagGroup.arrowLine) {
                 console.log("addArrowToTag - Suppression flèche existante car ancre invalide."); // NOUVEAU LOG
                fabricCanvas.remove(tagGroup.arrowLine);
                tagGroup.arrowLine = null;
                fabricCanvas.renderAll();
            }
            return;
        }
        const tagCenter = tagGroup.getCenterPoint();
         // Utiliser convertPercentToPixels qui prend maintenant en compte l'origine de l'objet bg
        const anchorGlobal = convertPercentToPixels(anchorXPercent, anchorYPercent);
        // Les coordonnées retournées par convertPercentToPixels SONT DÉJÀ globales au canvas

        if (isNaN(anchorGlobal.left) || isNaN(anchorGlobal.top)) {
             console.error("addArrowToTag - Coordonnées d'ancre globales calculées invalides (NaN)."); // NOUVEAU LOG
             return;
        }

        const currentZoom = fabricCanvas.getZoom();
        const strokeW = 2 / currentZoom; // Recalculer ici
         console.log(`addArrowToTag - Coordonnées: TagCenter=(${tagCenter.x}, ${tagCenter.y}), AnchorGlobal=(${anchorGlobal.left}, ${anchorGlobal.top}), StrokeWidth=${strokeW}`); // NOUVEAU LOG

        if (tagGroup.arrowLine) {
             console.log("addArrowToTag - Mise à jour flèche existante."); // NOUVEAU LOG
            tagGroup.arrowLine.set({
                x1: tagCenter.x,
                y1: tagCenter.y,
                x2: anchorGlobal.left, // Utiliser left/top directement
                y2: anchorGlobal.top,
                strokeWidth: strokeW
            });
        } else {
             console.log("addArrowToTag - Création nouvelle flèche."); // NOUVEAU LOG
            tagGroup.arrowLine = new fabric.Line([tagCenter.x, tagCenter.y, anchorGlobal.left, anchorGlobal.top], {
                stroke: '#34495e',
                strokeWidth: strokeW,
                selectable: false,
                evented: false,
                originX: 'center',
                originY: 'center',
                excludeFromExport: true
            });
            fabricCanvas.add(tagGroup.arrowLine);
        }
        tagGroup.arrowLine.moveTo(fabricCanvas.getObjects().indexOf(tagGroup)); // S'assurer qu'elle est derrière le tag
        fabricCanvas.renderAll();
         console.log("addArrowToTag - Rendu après ajout/màj flèche."); // NOUVEAU LOG
    }


    function startDrawingArrow() {
        if (!selectedFabricObject?.customData?.isGeoTag) return;
        isDrawingArrowMode = true;
        alert("Cliquez sur le plan où la flèche doit pointer (Echap pour annuler).");
        fabricCanvas.defaultCursor = 'crosshair';
        fabricCanvas.discardActiveObject();
        hideToolbar();
    }

    function handleArrowEndPoint(opt) {
        if (!selectedFabricObject?.customData?.isGeoTag || !opt) {
            cancelArrowDrawing();
            return;
        }
        const pointer = fabricCanvas.getPointer(opt.e);
        const {
            posX,
            posY
        } = convertPixelsToPercent(pointer.x, pointer.y);
        selectedFabricObject.customData.anchorXPercent = posX;
        selectedFabricObject.customData.anchorYPercent = posY;
        addArrowToTag(selectedFabricObject, posX, posY);
        const currentPos = convertPixelsToPercent(selectedFabricObject.getCenterPoint().x, selectedFabricObject.getCenterPoint().y);
        const {
            positionId,
            geoCodeId,
            currentWidth,
            currentHeight
        } = selectedFabricObject.customData;
        savePositionAPI({
            id: geoCodeId,
            position_id: positionId,
            plan_id: currentPlanId,
            pos_x: currentPos.posX,
            pos_y: currentPos.posY,
            width: currentWidth,
            height: currentHeight,
            anchor_x: posX,
            anchor_y: posY
        });
        cancelArrowDrawing();
        fabricCanvas.setActiveObject(selectedFabricObject).renderAll();
    }

    function cancelArrowDrawing() {
        isDrawingArrowMode = false;
        fabricCanvas.defaultCursor = (currentDrawingTool === 'select') ? 'default' : 'crosshair';
        if (selectedFabricObject) {
            fabricCanvas.setActiveObject(selectedFabricObject);
            showToolbar(selectedFabricObject);
        }
    }

    function showToolbar(target) {
        if (!tagToolbar || !target?.customData?.isGeoTag) return;
        // Recalcul nécessaire car l'objet peut avoir bougé/zoomé
        fabricCanvas.renderAll(); // S'assurer que les coordonnées sont à jour
        const bound = target.getBoundingRect(); // Obtenir les coordonnées après rendu

        // Positionnement relatif au conteneur du canvas
        const canvasRect = canvasEl.getBoundingClientRect();
        const containerRect = planContainer.getBoundingClientRect();

        // Position absolue de la toolbar dans la page
        const toolbarTop = canvasRect.top + bound.top - tagToolbar.offsetHeight - 5 - containerRect.top; // Relatif au container
        const toolbarLeft = canvasRect.left + bound.left + bound.width / 2 - tagToolbar.offsetWidth / 2 - containerRect.left; // Relatif au container

        tagToolbar.style.left = `${toolbarLeft}px`;
        tagToolbar.style.top = `${toolbarTop}px`;

        tagToolbar.style.opacity = '1';
        tagToolbar.style.pointerEvents = 'auto';
        tagToolbar.classList.add('visible');
    }


    function hideToolbar() {
        if (!tagToolbar) return;
        tagToolbar.style.opacity = '0';
        tagToolbar.style.pointerEvents = 'none';
        tagToolbar.classList.remove('visible');
    }
    async function deleteSelectedTag() {
        if (!selectedFabricObject?.customData?.isGeoTag) return;
        const {
            positionId,
            geoCodeId,
            codeGeo
        } = selectedFabricObject.customData;
        const allInstances = fabricCanvas.getObjects().filter(o => o.customData?.geoCodeId === geoCodeId && o.customData?.isGeoTag); // Ajout filtre isGeoTag
        let performDelete = false,
            deleteAllInstances = false;
        if (allInstances.length > 1) {
            if (confirm(`Voulez-vous supprimer toutes les ${allInstances.length} instances de "${codeGeo}" sur ce plan ?`)) {
                performDelete = true;
                deleteAllInstances = true;
            } else if (confirm(`Supprimer uniquement cette instance de "${codeGeo}" ?`)) {
                performDelete = true;
            }
        } else if (confirm(`Supprimer le tag "${codeGeo}" ?`)) {
            performDelete = true;
        }
        if (!performDelete) return;
        const success = deleteAllInstances ? await removeMultiplePositionsAPI(geoCodeId, currentPlanId) : await removePositionAPI(positionId);
        if (success) {
            (deleteAllInstances ? allInstances : [selectedFabricObject]).forEach(tag => {
                if (tag.arrowLine) fabricCanvas.remove(tag.arrowLine);
                fabricCanvas.remove(tag);
                delete fabricObjects[tag.customData.positionId];
            });
            updateCodeCountInSidebar(geoCodeId, -(deleteAllInstances ? allInstances.length : 1));
            fabricCanvas.discardActiveObject().renderAll();
            hideToolbar();
        } else {
            alert("Erreur lors de la suppression du tag.");
        }
    }
    async function changeSelectedTagSize(event) {
        const size = event.currentTarget.dataset.size;
        if (!selectedFabricObject?.customData?.isGeoTag || !sizePresets[size]) return;
        const preset = sizePresets[size];
        const {
            customData
        } = selectedFabricObject;
        selectedFabricObject.item(0).set({
            width: preset.width,
            height: preset.height
        });
        selectedFabricObject._setupDimensions(); // Recalculer dimensions groupe
        selectedFabricObject.setCoords();
        fabricCanvas.renderAll();
        const {
            posX,
            posY
        } = convertPixelsToPercent(selectedFabricObject.getCenterPoint().x, selectedFabricObject.getCenterPoint().y);
        const positionData = {
            id: customData.geoCodeId,
            position_id: customData.positionId,
            plan_id: currentPlanId,
            pos_x: posX,
            pos_y: posY,
            width: preset.width,
            height: preset.height,
            anchor_x: customData.anchorXPercent,
            anchor_y: customData.anchorYPercent
        };
        const successData = await savePositionAPI(positionData);
        if (successData) {
            customData.currentWidth = preset.width;
            customData.currentHeight = preset.height;
        }
        // Attendre un court instant que le rendu soit fait avant de repositionner la toolbar
        setTimeout(() => showToolbar(selectedFabricObject), 50);
    }


    function toggleHighlightSelected() {
        if (!selectedFabricObject?.customData?.isGeoTag) return;
        highlightedCodeGeo = (highlightedCodeGeo === selectedFabricObject.customData.codeGeo) ? null : selectedFabricObject.customData.codeGeo;
        redrawAllTagsHighlight();
    }

    function redrawAllTagsHighlight() {
        fabricCanvas.getObjects().forEach(updateHighlightEffect);
        fabricCanvas.renderAll();
    }

    function updateHighlightEffect(fabricObj) {
        if (fabricObj.isGridLine || !fabricObj.visible) return; // Ajout vérification visibilité
        const isTag = fabricObj.customData?.isGeoTag;
        const isHighlighted = isTag && highlightedCodeGeo && fabricObj.customData.codeGeo === highlightedCodeGeo;
        const isActiveSelection = fabricCanvas.getActiveObject() === fabricObj;
        const opacity = (highlightedCodeGeo && (!isTag || !isHighlighted)) ? 0.3 : 1.0;
        fabricObj.set({
            opacity
        });
        if (isTag && fabricObj.item && fabricObj.item(0)) { // Vérifier existence item(0)
            const strokeColor = isHighlighted ? '#ffc107' : (isActiveSelection ? '#007bff' : 'black');
            const strokeW = (isHighlighted || isActiveSelection ? 2 : 1) / fabricCanvas.getZoom();
            fabricObj.item(0).set({
                stroke: strokeColor,
                strokeWidth: strokeW
            });
        }
        if (fabricObj.arrowLine) fabricObj.arrowLine.set({
            opacity
        });
    }

    // NOUVEAU LOG: Ajouté pour voir l'état des objets lors du zoom
    function updateStrokesWidth(currentZoom) {
         console.log("updateStrokesWidth - Zoom actuel:", currentZoom); // NOUVEAU LOG
         fabricCanvas.getObjects().forEach(obj => {
            if (obj.baseStrokeWidth) {
                obj.set('strokeWidth', obj.baseStrokeWidth / currentZoom);
            }
             // Mise à jour largeur flèche aussi
            if (obj.customData?.isGeoTag && obj.arrowLine) {
                 obj.arrowLine.set('strokeWidth', 2 / currentZoom);
             }
         });
         // Pas de renderAll ici, sera fait par l'event 'viewport:transformed'
    }


    function zoom(factor) {
        const centerPoint = fabricCanvas.getCenter(); // Obtenir le centre du viewport actuel
        let newZoom = fabricCanvas.getZoom() * factor;
        newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
        console.log(`Zoom: factor=${factor}, newZoom=${newZoom}, center=(${centerPoint.x}, ${centerPoint.y})`); // NOUVEAU LOG
        fabricCanvas.zoomToPoint(new fabric.Point(centerPoint.x, centerPoint.y), newZoom);
    }


    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            planPageContainer?.requestFullscreen().catch(err => alert(`Erreur: ${err.message}`));
        } else {
            document.exitFullscreen();
        }
        setTimeout(resizeCanvas, 300);
    }
    async function fetchAvailableCodes() {
        if (!unplacedList || planType === 'svg_creation') return;
        try {
            const response = await fetch(`index.php?action=getAvailableCodesForPlan&id=${currentPlanId}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            renderAvailableCodes(await response.json());
        } catch (error) {
            console.error("Erreur fetchAvailableCodes:", error);
            if (unplacedList) unplacedList.innerHTML = `<p class="text-danger p-3">Erreur chargement codes.</p>`;
            updateCounter(0);
        }
    }

    function renderAvailableCodes(codes) {
        if (!unplacedList) return;
        unplacedList.innerHTML = '';
        if (!codes || codes.length === 0) {
            unplacedList.innerHTML = `<p class="text-muted small p-3">Aucun code disponible.</p>`;
            updateCounter(0);
            return;
        }
        codes.forEach(code => {
            const item = document.createElement('div');
            item.className = 'unplaced-item list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            Object.assign(item.dataset, {
                id: code.id,
                codeGeo: code.code_geo,
                libelle: code.libelle,
                univers: code.univers,
                search: `${code.code_geo} ${code.libelle} ${code.univers}`.toLowerCase()
            });
            item.style.borderLeft = `5px solid ${universColors[code.univers] || '#ccc'}`;
            item.innerHTML = `<div><strong class="item-code">${code.code_geo}</strong><small class="item-libelle d-block text-muted">${code.libelle}</small></div><span class="badge bg-secondary rounded-pill placement-count">${code.placement_count || 0}</span>`;
            unplacedList.appendChild(item);
        });
        filterAvailableCodes();
    }

    function filterAvailableCodes() {
        if (!searchInput || !unplacedList) return;
        const searchTerm = searchInput.value.toLowerCase();
        let visibleCount = 0;
        document.querySelectorAll('#unplaced-list .unplaced-item').forEach(item => {
            const isVisible = item.dataset.search.includes(searchTerm);
            item.style.display = isVisible ? 'flex' : 'none';
            if (isVisible) visibleCount++;
        });
        updateCounter(visibleCount);
    }

    function updateCounter(count) {
        const el = document.getElementById('unplaced-counter');
        if (el) el.textContent = `${count}`;
    }

    function handleAvailableCodeClick(event) {
        const item = event.target.closest('.unplaced-item');
        if (item && planType !== 'svg_creation') {
            cancelArrowDrawing();
            stopDrawing();
            setActiveTool('select');
            isPlacementMode = true;
            codeToPlace = {
                ...item.dataset
            };
            planContainer?.classList.add('placement-mode');
            fabricCanvas.defaultCursor = 'crosshair';
            fabricCanvas.discardActiveObject();
            hideToolbar();
            document.querySelectorAll('#unplaced-list .unplaced-item.active').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
        }
    }

    function cancelPlacementMode() {
        isPlacementMode = false;
        codeToPlace = null;
        planContainer?.classList.remove('placement-mode');
        fabricCanvas.defaultCursor = (currentDrawingTool === 'select') ? 'default' : 'crosshair';
        document.querySelectorAll('#unplaced-list .unplaced-item.active').forEach(el => el.classList.remove('active'));
    }
    async function placeNewTag(clickEvent) {
        if (!isPlacementMode || !codeToPlace) return;
        const pointer = fabricCanvas.getPointer(clickEvent);
        const {
            posX,
            posY
        } = convertPixelsToPercent(pointer.x, pointer.y);
        const newPositionData = {
            id: codeToPlace.id,
            plan_id: currentPlanId,
            pos_x: posX,
            pos_y: posY,
            width: sizePresets.medium.width,
            height: sizePresets.medium.height
        };
        const savedData = await savePositionAPI(newPositionData);
        if (savedData) {
            const codeInfo = allCodesData.find(c => c.id == codeToPlace.id);
            const fullCodeData = {
                ...(codeInfo || codeToPlace),
                ...savedData
            };
             // NOUVEAU LOG: Vérifier les données avant de créer le tag
            console.log("placeNewTag - Données complètes pour nouveau tag:", fullCodeData);
            const newTag = createFabricTag(fullCodeData);
            if (newTag) fabricCanvas.setActiveObject(newTag).renderAll();
            else console.error("placeNewTag - Échec de la création du tag Fabric."); // NOUVEAU LOG
            updateCodeCountInSidebar(codeToPlace.id, 1);
            const codeIdx = allCodesData.findIndex(c => c.id == codeToPlace.id);
            if (codeIdx > -1) {
                if (!allCodesData[codeIdx].placements) allCodesData[codeIdx].placements = [];
                allCodesData[codeIdx].placements.push(savedData);
            }
        }
        cancelPlacementMode();
    }


    function updateCodeCountInSidebar(geoCodeId, change) {
        const item = unplacedList?.querySelector(`.unplaced-item[data-id="${geoCodeId}"]`);
        const countBadge = item?.querySelector('.placement-count');
        if (countBadge) countBadge.textContent = Math.max(0, parseInt(countBadge.textContent, 10) + change);
    }

    function openAddCodeModal() {
        if (!newUniversIdSelect || !addCodeModal || planType === 'svg_creation') return;
        newUniversIdSelect.innerHTML = '<option value="">Choisir...</option>';
        (planUnivers || []).forEach(u => newUniversIdSelect.add(new Option(u.nom, u.id)));
        document.getElementById('add-code-form')?.reset();
        addCodeModal.show();
    }
    async function handleSaveNewCode() {
        const form = document.getElementById('add-code-form');
        if (!form) return;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        if (!data.code_geo || !data.libelle || !data.univers_id) {
            alert("Champs requis.");
            return;
        }
        try {
            const response = await fetch('index.php?action=addGeoCodeFromPlan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            const newCode = await response.json();
            const universName = planUnivers.find(u => u.id == newCode.univers_id)?.nom || '';
            allCodesData.push({
                ...newCode,
                univers: universName,
                placements: []
            });
            await fetchAvailableCodes();
            addCodeModal.hide();
            const newItem = unplacedList?.querySelector(`.unplaced-item[data-id="${newCode.id}"]`);
            if (newItem) {
                newItem.click();
                alert("Code créé. Cliquez sur le plan pour le placer.");
            }
        } catch (error) {
            console.error('Erreur création code géo:', error);
            alert(`Erreur: ${error.message}`);
        }
    }
    async function savePositionAPI(positionData) {
        try {
            const response = await fetch('index.php?action=savePosition', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(positionData)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            const result = await response.json();
            if (result.status === 'success' && result.position_data) return result.position_data;
            else throw new Error(result.message || 'Erreur serveur.');
        } catch (error) {
            console.error("Erreur savePositionAPI:", error);
            alert(`Erreur sauvegarde: ${error.message}`);
            return null;
        }
    }
    async function removePositionAPI(positionId) {
        try {
            const response = await fetch('index.php?action=removePosition', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: positionId
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return (await response.json()).status === 'success';
        } catch (error) {
            console.error("Erreur removePositionAPI:", error);
            return false;
        }
    }
    async function removeMultiplePositionsAPI(geoCodeId, planId) {
        try {
            const response = await fetch('index.php?action=removeMultiplePositions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    geo_code_id: geoCodeId,
                    plan_id: planId
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return (await response.json()).status === 'success';
        } catch (error) {
            console.error("Erreur removeMultiplePositionsAPI:", error);
            return false;
        }
    }

    function updateLegend() {
        if (!legendContainer) return;
        legendContainer.innerHTML = '';
        const placedUnivers = new Set(fabricCanvas.getObjects().filter(o => o.customData?.isGeoTag).map(o => o.customData.univers));
        if (placedUnivers.size === 0) {
            legendContainer.innerHTML = '<p class="text-muted small">Aucun tag géo placé.</p>';
            return;
        }
        placedUnivers.forEach(universName => {
            const color = universColors[universName] || '#7f8c8d';
            const item = document.createElement('div');
            item.className = 'legend-item d-flex align-items-center mb-1';
            item.innerHTML = `<div class="legend-color-box me-2" style="width: 15px; height: 15px; background-color: ${color}; border: 1px solid #666;"></div><span>${universName}</span>`;
            legendContainer.appendChild(item);
        });
    }
     console.log("Fin du script plan.js."); // NOUVEAU LOG
});
