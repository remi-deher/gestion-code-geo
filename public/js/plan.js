/**
 * Gestion de la page d'édition et de création des plans avec Fabric.js
 * Gère les tags géo, les annotations sur images, la création SVG et l'édition SVG.
 * Version complète et corrigée avec logs de diagnostic et ordre des fonctions corrigé.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Chargé, début de l'initialisation de plan.js");
    const canvasEl = document.getElementById('plan-canvas');
    if (!canvasEl) {
        console.error("Élément Canvas #plan-canvas non trouvé !");
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
    console.log("Vérification des variables globales PHP...");
    console.log("planType:", typeof planType !== 'undefined' ? planType : 'undefined');
    console.log("currentPlanId:", typeof currentPlanId !== 'undefined' ? currentPlanId : 'undefined');
    console.log("currentPlan:", typeof currentPlan !== 'undefined' ? currentPlan : 'undefined');
    console.log("universColors:", typeof universColors !== 'undefined' ? universColors : 'undefined');
    console.log("planUnivers:", typeof planUnivers !== 'undefined' ? planUnivers : 'undefined');
    console.log("placedGeoCodes:", typeof placedGeoCodes !== 'undefined' ? placedGeoCodes : 'undefined');

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
         console.error("La variable globale PHP 'planType' est manquante.");
          if (planContainer) planContainer.innerHTML = "<p class='text-danger p-3'>Erreur critique: Type de plan non défini.</p>";
         return;
    }

    console.log("Initialisation du canvas Fabric...");
    const fabricCanvas = new fabric.Canvas(canvasEl, {
        selection: true,
        backgroundColor: '#ffffff',
        stopContextMenu: true,
        fireRightClick: true,
        preserveObjectStacking: true
    });
    console.log("Canvas Fabric initialisé.");

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

    // =========================================================================
    // == DÉFINITION DE TOUTES LES FONCTIONS ==
    // =========================================================================

    function updateStrokesWidth(currentZoom) {
         // console.log("updateStrokesWidth - Zoom actuel:", currentZoom);
         fabricCanvas.getObjects().forEach(obj => {
            if (obj.baseStrokeWidth && !obj.customData?.isGeoTag && !obj.isGridLine) {
                obj.set('strokeWidth', obj.baseStrokeWidth / currentZoom);
            }
             else if (obj.customData?.isGeoTag && obj.item && obj.item(0)) {
                 const isActiveSelection = fabricCanvas.getActiveObject() === obj;
                 const isHighlightedInstance = highlightedCodeGeo && obj.customData.codeGeo === highlightedCodeGeo;
                 const baseW = (isActiveSelection || isHighlightedInstance) ? 2 : 1;
                 obj.item(0).set('strokeWidth', baseW / currentZoom);
             }
            if (obj.customData?.isGeoTag && obj.arrowLine) {
                 obj.arrowLine.set('strokeWidth', 2 / currentZoom);
             }
         });
    }

    function removeGrid() {
        fabricCanvas.remove(...gridLines);
        gridLines = [];
        fabricCanvas.renderAll();
    }

    function drawGrid() {
        removeGrid();
        if (!isGridVisible || !fabricCanvas.width || !fabricCanvas.height) return;

        const vpt = fabricCanvas.viewportTransform;
        if (!vpt) return;

        const zoom = vpt[0], panX = vpt[4], panY = vpt[5];
        if (zoom === 0) return;

        const left = fabric.util.invertTransform({ x: 0, y: 0 }, vpt).x;
        const top = fabric.util.invertTransform({ x: 0, y: 0 }, vpt).y;
        const right = fabric.util.invertTransform({ x: fabricCanvas.width, y: 0 }, vpt).x;
        const bottom = fabric.util.invertTransform({ x: 0, y: fabricCanvas.height }, vpt).y;

        const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE;
        const startY = Math.floor(top / GRID_SIZE) * GRID_SIZE;
        const endX = Math.ceil(right / GRID_SIZE) * GRID_SIZE;
        const endY = Math.ceil(bottom / GRID_SIZE) * GRID_SIZE;

        const strokeW = 1 / zoom;

        for (let x = startX; x <= endX; x += GRID_SIZE) {
            gridLines.push(new fabric.Line([x, top, x, bottom], { stroke: 'rgba(0,0,0,0.1)', strokeWidth: strokeW, selectable: false, evented: false, excludeFromExport: true, isGridLine: true }));
        }
        for (let y = startY; y <= endY; y += GRID_SIZE) {
            gridLines.push(new fabric.Line([left, y, right, y], { stroke: 'rgba(0,0,0,0.1)', strokeWidth: strokeW, selectable: false, evented: false, excludeFromExport: true, isGridLine: true }));
        }

        fabricCanvas.add(...gridLines);
        gridLines.forEach(l => l.moveTo(-1));
        fabricCanvas.renderAll();
    }

    function resetZoom() {
        console.log("Début resetZoom(). planType:", planType);
        if (planType === 'svg_creation') {
            console.log("Reset zoom pour svg_creation.");
            fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        } else {
            const bg = fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group');
            console.log("Objet de fond trouvé pour resetZoom:", bg);
            const originalWidth = bg?.originalWidth || bg?.width;
            const originalHeight = bg?.originalHeight || bg?.height;

            if (!bg || !originalWidth || !originalHeight || originalWidth === 0 || originalHeight === 0) {
                 console.warn("Arrière-plan ou ses dimensions originales invalides dans resetZoom.");
                 fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]); // Fallback reset
                 updateStrokesWidth(1);
                 if (isGridVisible) drawGrid();
                 fabricCanvas.renderAll();
                return;
            }

            const canvasWidth = fabricCanvas.getWidth(),
                  canvasHeight = fabricCanvas.getHeight();

            console.log(`Dimensions originales fond: ${originalWidth}x${originalHeight}, Canvas: ${canvasWidth}x${canvasHeight}`);

            const scaleToFit = Math.min(canvasWidth / originalWidth, canvasHeight / originalHeight, 1);
            bg.scale(scaleToFit);
            bg.center();
            bg.setCoords();

            fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

            console.log(`Calculs resetZoom: scale appliqué à l'objet=${scaleToFit}, viewport réinitialisé.`);
        }
        updateStrokesWidth(fabricCanvas.getZoom());
        if (isGridVisible) drawGrid();
         console.log("Fin resetZoom(), rendu canvas.");
        fabricCanvas.renderAll();
    }

    function resizeCanvas() {
        console.log("Début resizeCanvas().");
        if (!planContainer) {
            console.warn("planContainer non trouvé dans resizeCanvas.");
            return;
        }
        const containerRect = planContainer.getBoundingClientRect();
        console.log("Dimensions du conteneur:", containerRect.width, "x", containerRect.height);
        fabricCanvas.setWidth(containerRect.width);
        fabricCanvas.setHeight(containerRect.height);
        fabricCanvas.calcOffset();
        console.log("Dimensions canvas Fabric mises à jour:", fabricCanvas.getWidth(), "x", fabricCanvas.getHeight());

        if (planType !== 'svg_creation') {
            console.log("Appel resetZoom depuis resizeCanvas.");
            resetZoom();
        } else {
            console.log("Mode svg_creation, mise à jour grille si visible.");
            if (isGridVisible) drawGrid();
        }
        console.log("Fin resizeCanvas(), rendu du canvas.");
        fabricCanvas.renderAll();
    }

    async function initializePlan() {
        console.log("Début de initializePlan(), planType:", planType);
        if (typeof planType !== 'undefined') document.body.classList.add(`plan-type-${planType}`);
        setupUI();
        try {
            if (planType === 'svg_creation') {
                console.log("Configuration pour svg_creation.");
                fabricCanvas.setBackgroundColor('#ffffff');
                fabricCanvas.renderAll();
            } else if (planType === 'svg') {
                console.log("Tentative de chargement du plan SVG.");
                await loadSvgPlan(`uploads/plans/${currentPlan.nom_fichier}`);
                console.log("Chargement SVG terminé.");
            } else {
                console.log("Tentative de chargement de l'image de fond.");
                await loadBackgroundImage();
                console.log("Chargement image de fond terminé.");
                if (initialDrawingData) {
                    console.log("Chargement des données de dessin (annotations JSON)...");
                    fabricCanvas.loadFromJSON(initialDrawingData, () => {
                        console.log("Annotations JSON chargées et rendues.");
                        fabricCanvas.renderAll();
                        fabricCanvas.getObjects().forEach(obj => {
                            if (!obj.customData?.isGeoTag) obj.set({
                                selectable: true,
                                evented: true,
                                hasControls: true,
                                hasBorders: true
                            });
                        });
                         console.log("Vérification post-JSON des objets non-tag.");
                        fabricCanvas.renderAll();
                    });
                }
            }
            if (planType === 'image' || planType === 'svg') {
                 console.log("Préparation de l'affichage des tags géo.");
                createInitialGeoTags();
                await fetchAvailableCodes();
                updateLegend();
                 console.log("Tags géo et sidebar initialisés.");
            }
            addEventListeners();
            setActiveTool(currentDrawingTool);
            if (gridToggle) {
                isGridVisible = gridToggle.checked;
                if (isGridVisible) drawGrid();
            }
            if (snapToggle) isSnapEnabled = snapToggle.checked;
            if (fillShapeToggle && fillColorInput) fillColorInput.style.display = fillShapeToggle.checked ? 'inline-block' : 'none';
            
            console.log("Appel final à resizeCanvas().");
            resizeCanvas();
            console.log("Initialisation terminée avec succès.");
        } catch (error) {
            console.error("Erreur d'initialisation du plan:", error);
            if (planContainer) planContainer.innerHTML = `<p class='text-danger p-3'>Impossible de charger le plan : ${error.message}</p>`;
        }
    }

     function setupUI() {
        console.log("Configuration de l'interface utilisateur (setupUI)...");
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
         console.log("Configuration UI terminée.");
    }

    function loadBackgroundImage() {
        console.log("Début loadBackgroundImage().");
        return new Promise((resolve, reject) => {
            if (!mapImageEl) {
                if (planType === 'image') {
                    console.error("Élément #map-image non trouvé.");
                    reject(new Error("Élément #map-image non trouvé."));
                } else resolve();
                return;
            }
            const imageUrl = mapImageEl.src;
             console.log("URL de l'image:", imageUrl);
            if (!imageUrl || (!imageUrl.startsWith('http') && !imageUrl.startsWith('uploads'))) {
                 console.error("URL image invalide:", imageUrl);
                reject(new Error("URL image invalide."));
                return;
            }
            fabric.Image.fromURL(imageUrl, (img, isError) => {
                if (isError || !img) {
                    console.error("Chargement image Fabric échoué:", imageUrl);
                    reject(new Error("Chargement image Fabric échoué: " + imageUrl));
                    return;
                }
                 console.log("Image Fabric chargée, définition comme arrière-plan.");
                fabricCanvas.setBackgroundImage(img, () => {
                     console.log("Image définie comme arrière-plan et rendue.");
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
        console.log("Début loadSvgPlan(), URL:", url);
        return new Promise((resolve, reject) => {
            fabric.loadSVGFromURL(url, (objects, options) => {
                if (!objects) {
                    console.error("Chargement SVG échoué (objets null):", url);
                    reject(new Error("Chargement SVG échoué: " + url));
                    return;
                }
                console.log(`SVG chargé depuis l'URL. ${objects.length} objets trouvés.`);

                const svgData = fabric.util.groupSVGElements(objects, options);

                svgData.originalWidth = svgData.width;
                svgData.originalHeight = svgData.height;
                console.log("SVG group dimensions originales:", svgData.originalWidth, svgData.originalHeight);

                if (!svgData.width || !svgData.height || svgData.width === 0 || svgData.height === 0) {
                     console.warn("Les dimensions du groupe SVG sont nulles ou invalides après groupSVGElements.");
                }

                fabricCanvas.setBackgroundColor('#ffffff');
                console.log("Ajout du groupe SVG au canvas Fabric.");
                fabricCanvas.add(svgData);
                svgData.set({
                   isSvgBackground: true,
                   selectable: false,
                   evented: false
                });

                 console.log("Groupe SVG ajouté, le centrage/scaling sera fait par resize/resetZoom.");
                fabricCanvas.renderAll();
                resolve();
            }, null, {
                crossOrigin: 'anonymous'
            });
        });
    }

    function convertPercentToPixels(percentX, percentY) {
         // console.log(`convertPercentToPixels - Input: X=${percentX}%, Y=${percentY}%`);
        const bg = fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group');
        const originalWidth = bg?.originalWidth || bg?.width;
        const originalHeight = bg?.originalHeight || bg?.height;

        if (!bg || !originalWidth || !originalHeight || originalWidth === 0 || originalHeight === 0) {
             console.warn("convertPercentToPixels - Arrière-plan ou ses dimensions originales invalides.", bg);
            return { left: NaN, top: NaN };
        }
        // console.log(`convertPercentToPixels - Dimensions originales utilisées: ${originalWidth} x ${originalHeight}`);

        const relativeX = (percentX / 100) * originalWidth;
        const relativeY = (percentY / 100) * originalHeight;

        const bgOrigin = bg.getPointByOrigin('left', 'top');
        const bgScaleX = bg.scaleX || 1;
        const bgScaleY = bg.scaleY || 1;

        const globalX = bgOrigin.x + relativeX * bgScaleX;
        const globalY = bgOrigin.y + relativeY * bgScaleY;

        // console.log(`convertPercentToPixels - Output: left=${globalX}, top=${globalY}`);
        return { left: globalX, top: globalY };
    }


    function convertPixelsToPercent(pixelX, pixelY) {
        const bg = fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group');
        const originalWidth = bg?.originalWidth || bg?.width;
        const originalHeight = bg?.originalHeight || bg?.height;

        if (!bg || !originalWidth || !originalHeight || originalWidth === 0 || originalHeight === 0) {
            console.warn("convertPixelsToPercent - Arrière-plan ou dimensions originales invalides.", bg);
            return { posX: 0, posY: 0 };
        }

        const bgOrigin = bg.getPointByOrigin('left', 'top');
        const bgScaleX = bg.scaleX || 1;
        const bgScaleY = bg.scaleY || 1;


        const relativeX = (pixelX - bgOrigin.x) / bgScaleX;
        const relativeY = (pixelY - bgOrigin.y) / bgScaleY;

        const posX = Math.max(0, Math.min(100, (relativeX / originalWidth) * 100));
        const posY = Math.max(0, Math.min(100, (relativeY / originalHeight) * 100));

        // console.log(`convertPixelsToPercent - Input: (${pixelX}, ${pixelY}), Output: (${posX}%, ${posY}%)`);
        return { posX, posY };
    }

    function createInitialGeoTags() {
        console.log("Entering createInitialGeoTags. Background/SVG group:", fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group'));
        fabricObjects = {};
        fabricCanvas.getObjects().slice().filter(obj => obj.customData?.isGeoTag).forEach(tag => {
             console.log("Suppression ancien tag géo:", tag.customData.codeGeo);
            if (tag.arrowLine) fabricCanvas.remove(tag.arrowLine);
            fabricCanvas.remove(tag);
        });
        let tagsCreated = 0;
        allCodesData.forEach(code => {
            if (code.placements) {
                code.placements.forEach(placement => {
                    if (placement.plan_id == currentPlanId && placement.pos_x !== null && typeof placement.pos_x !== 'undefined' && placement.pos_y !== null && typeof placement.pos_y !== 'undefined') {
                        // console.log("Traitement code pour tag:", code.code_geo, "Placement:", placement);
                        const {
                            placements,
                            ...codeData
                        } = code;
                        const fullTagData = { ...codeData, ...placement };
                        // console.log("Données complètes pour createFabricTag:", fullTagData);
                        createFabricTag(fullTagData);
                        tagsCreated++;
                    } else {
                         // console.warn("Placement ignoré (plan_id incorrect ou pos_x/pos_y null/undefined):", code.code_geo, placement);
                    }
                });
            }
        });
        console.log(`${tagsCreated} tags géo créés.`);
        fabricCanvas.renderAll();
         console.log("Fin createInitialGeoTags.");
    }

    function createFabricTag(code) {
        const bg = fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group');
        // console.log("createFabricTag - Fond trouvé:", bg);
        if (!bg || code.pos_x === null || typeof code.pos_x === 'undefined' || code.pos_y === null || typeof code.pos_y === 'undefined') {
            console.warn("createFabricTag - Arrière-plan non trouvé ou pos_x/pos_y manquant/null pour", code.code_geo, "PosX:", code.pos_x, "PosY:", code.pos_y);
            return null;
        }
        // console.log(`createFabricTag - Avant conversion pixels pour ${code.code_geo}: PosX%=${code.pos_x}, PosY%=${code.pos_y}`);

        const {
            left,
            top
        } = convertPercentToPixels(code.pos_x, code.pos_y);
        if (isNaN(left) || isNaN(top)) {
             console.error(`createFabricTag - Coordonnées calculées invalides (NaN) pour ${code.code_geo}: left=${left}, top=${top}`);
             return null;
        }
        // console.log(`Pixels calculés pour ${code.code_geo}: left=${left}, top=${top}`);

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
         // console.log(`createFabricTag - Création groupe Fabric pour ${code.code_geo} à (${left}, ${top})`);
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
                currentHeight: tagHeight,
                anchorXPercent: code.anchor_x,
                anchorYPercent: code.anchor_y
            }
        });

        if (group.customData.anchorXPercent !== null && typeof group.customData.anchorXPercent !== 'undefined' &&
            group.customData.anchorYPercent !== null && typeof group.customData.anchorYPercent !== 'undefined') {
             // console.log(`createFabricTag - Ajout flèche pour ${code.code_geo}`);
            addArrowToTag(group, group.customData.anchorXPercent, group.customData.anchorYPercent);
        }

         // console.log(`createFabricTag - Ajout groupe au canvas Fabric: ${code.code_geo}`);
        fabricCanvas.add(group);
        if (code.position_id) {
            fabricObjects[code.position_id] = group;
        } else {
             console.warn("createFabricTag - position_id manquant pour", code.code_geo);
        }
        group.moveTo(999);
        updateHighlightEffect(group);
         // console.log(`createFabricTag - Tag ${code.code_geo} traité.`);
        return group;
    }


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
                    originX: 'left',
                    originY: 'top',
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
                 const dx = x - startPoint.x;
                 const dy = y - startPoint.y;
                 let radius = Math.hypot(dx, dy) / 2;
                 currentShape.set({
                    left: startPoint.x + dx/2,
                    top: startPoint.y + dy/2,
                    rx: radius,
                    ry: radius,
                    originX: 'center',
                    originY: 'center'
                 });
                break;
        }
        currentShape.setCoords();
        fabricCanvas.renderAll();
    }

    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        if (currentShape) {
            currentShape.set({
                selectable: true,
                evented: true
            }).setCoords();
             if (currentShape.type === 'ellipse' || currentShape.type === 'rect') {
                 currentShape.set({ originX: 'left', originY: 'top'});
                 currentShape.setCoords();
             }
            fabricCanvas.setActiveObject(currentShape);
        }
        currentShape = null;
        startPoint = null;
        fabricCanvas.renderAll();
    }

    function toggleGrid() {
        isGridVisible = gridToggle.checked;
        isGridVisible ? drawGrid() : removeGrid();
    }

    function toggleSnap() {
        isSnapEnabled = snapToggle.checked;
    }

    function snapToGrid(x, y) {
        return {
            x: Math.round(x / GRID_SIZE) * GRID_SIZE,
            y: Math.round(y / GRID_SIZE) * GRID_SIZE
        };
    }


    function copyShape() {
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject && !activeObject.customData?.isGeoTag && !activeObject.isGridLine) {
            activeObject.clone(cloned => {
                fabricClipboard = cloned;
                console.log("Objet copié dans le presse-papier Fabric:", fabricClipboard);
            });
        } else {
            fabricClipboard = null;
             console.log("Aucun objet valide sélectionné pour copier.");
        }
    }

    function pasteShape() {
        if (!fabricClipboard) {
             console.log("Presse-papier Fabric vide, impossible de coller.");
            return;
        }
        console.log("Collage depuis le presse-papier Fabric...");
        fabricClipboard.clone(clonedObj => {
            fabricCanvas.discardActiveObject();
            clonedObj.set({
                left: clonedObj.left + 10,
                top: clonedObj.top + 10,
                evented: true,
                selectable: true,
                ...(clonedObj.baseStrokeWidth && { baseStrokeWidth: clonedObj.baseStrokeWidth })
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
             console.log("Objet collé et sélectionné.");
        });
    }

    function deleteSelectedShape() {
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject && !activeObject.customData?.isGeoTag && !activeObject.isGridLine) {
            console.log("Suppression de l'objet sélectionné:", activeObject.type);
            if (activeObject.type === 'activeSelection') {
                activeObject.forEachObject(obj => fabricCanvas.remove(obj));
            } else {
                fabricCanvas.remove(activeObject);
            }
            fabricCanvas.discardActiveObject().renderAll();
        } else if (activeObject?.customData?.isGeoTag) {
            alert("Utilisez la barre d'outils du tag géo pour le supprimer.");
        } else {
             console.log("Aucun objet dessin sélectionné pour suppression.");
        }
    }


    function addEventListeners() {
        console.log("Ajout des écouteurs d'événements...");
        window.addEventListener('resize', resizeCanvas);
        fabricCanvas.on({
            'mouse:wheel': handleMouseWheel,
            'mouse:down': handleMouseDown,
            'mouse:move': handleMouseMove,
            'mouse:up': handleMouseUp,
            'object:moving': handleObjectMoving,
            'object:modified': handleObjectModified,
            'selection:created': handleSelection,
            'selection:updated': handleSelection,
            'selection:cleared': handleSelectionCleared,
            'before:transform': (e) => {
                if (e.target && e.target.customData?.isGeoTag) {
                     const t = e.transform;
                     t.lockScalingX = true;
                     t.lockScalingY = true;
                     t.lockRotation = true;
                }
            },
            'viewport:transformed': () => {
                 // console.log("Viewport transformé, mise à jour grille/traits.");
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
         console.log("Écouteurs d'événements ajoutés.");
    }


    function handleMouseDown(opt) {
        const { e: evt, target, pointer } = opt;
        if (evt.button === 2) {
             isPanning = false;
             return;
        }

        if (target && !target.isGridLine) {
             // console.log("Mouse down sur objet:", target.type, target.customData);
             if (target.customData?.isGeoTag) {
                selectedFabricObject = target;
                if (isDrawingArrowMode) {
                    handleArrowEndPoint(opt);
                    isDrawingArrowMode = false;
                    return;
                }
                 isPanning = false;
            } else if (currentDrawingTool !== 'select') {
                 isPanning = false;
            }
            return;
        }

        // console.log("Mouse down sur le fond.");
        selectedFabricObject = null;
        hideToolbar();
        if (currentDrawingTool !== 'select') {
             fabricCanvas.discardActiveObject().renderAll();
        }

        if (isPlacementMode && codeToPlace) {
            placeNewTag(evt);
        } else if (isDrawingArrowMode) {
            handleArrowEndPoint(opt);
            isDrawingArrowMode = false;
        } else if (currentDrawingTool !== 'select' && currentDrawingTool !== 'freehand') {
             const canvasPointer = fabricCanvas.getPointer(evt);
             startDrawing(isSnapEnabled ? snapToGrid(canvasPointer.x, canvasPointer.y) : canvasPointer);
        } else if (evt.altKey || evt.button === 1) {
             // console.log("Démarrage Pan");
            isPanning = true;
            fabricCanvas.defaultCursor = 'grabbing';
            fabricCanvas.setCursor('grabbing');
            lastPosX = evt.clientX;
            lastPosY = evt.clientY;
        }
    }


    function handleMouseMove(opt) {
        const evt = opt.e;
        if (isPanning) {
            const delta = new fabric.Point(evt.clientX - lastPosX, evt.clientY - lastPosY);
            fabricCanvas.relativePan(delta);
            lastPosX = evt.clientX;
            lastPosY = evt.clientY;
        } else if (isDrawing) {
             const pointer = fabricCanvas.getPointer(evt);
            continueDrawing(isSnapEnabled ? snapToGrid(pointer.x, pointer.y) : pointer);
        } else {
             const target = fabricCanvas.findTarget(evt);
             if (target && target.selectable && !target.isGridLine) {
                 fabricCanvas.hoverCursor = 'move';
             } else {
                 fabricCanvas.hoverCursor = (currentDrawingTool === 'select') ? 'default' : 'crosshair';
             }
        }
    }


    function handleMouseUp(opt) {
         const target = opt.target;
        // console.log("Mouse Up. Panning:", isPanning, "Drawing:", isDrawing, "Target:", target);
        if (isPanning) {
             // console.log("Fin Pan");
            isPanning = false;
        }
        if (isDrawing) {
            stopDrawing();
        }
        fabricCanvas.defaultCursor = (currentDrawingTool === 'select') ? 'default' : 'crosshair';
        fabricCanvas.setCursor(fabricCanvas.defaultCursor);
    }


    function handleMouseOut(opt) {
         const evt = opt.e;
         const relatedTarget = evt.relatedTarget || evt.toElement;
         if (canvasEl.contains(relatedTarget)) {
             return;
         }

        console.log("Mouse Out. Panning:", isPanning, "Drawing:", isDrawing);
        if (isPanning) {
             console.log("Arrêt Pan (Mouse Out)");
            isPanning = false;
        }
        if (isDrawing) {
             console.log("Arrêt Dessin (Mouse Out)");
            stopDrawing();
        }
        fabricCanvas.defaultCursor = (currentDrawingTool === 'select') ? 'default' : 'crosshair';
        fabricCanvas.setCursor(fabricCanvas.defaultCursor);
    }


     function handleObjectMoving(opt) {
        const target = opt.target;
        if (target.isGridLine) return;

        if (isSnapEnabled) {
            const snappedLeft = Math.round(target.left / GRID_SIZE) * GRID_SIZE;
            const snappedTop = Math.round(target.top / GRID_SIZE) * GRID_SIZE;

             target.set({
                 left: snappedLeft,
                 top: snappedTop
             });
        }
         target.setCoords();

        if (target.customData?.isGeoTag) {
            showToolbar(target);
            if (target.arrowLine) {
                 addArrowToTag(target, target.customData.anchorXPercent, target.customData.anchorYPercent);
            }
        }
    }


    function handleObjectModified(opt) {
        const target = opt.target;
        if (!target || target.isGridLine) return;

        console.log("Object modified:", target.type, target.customData?.codeGeo);

        if (target.customData?.isGeoTag) {
            const { position_id, id: geoCodeId, currentWidth, currentHeight, anchorXPercent, anchorYPercent } = target.customData;
            const { posX, posY } = convertPixelsToPercent(target.getCenterPoint().x, target.getCenterPoint().y);

             console.log("Sauvegarde position tag géo - Données envoyées:", {
                id: geoCodeId,
                 position_id: position_id,
                 plan_id: currentPlanId,
                 pos_x: posX,
                 pos_y: posY,
                 width: currentWidth,
                 height: currentHeight,
                 anchor_x: anchorXPercent,
                 anchor_y: anchorYPercent
            });

            savePositionAPI({
                 id: geoCodeId,
                 position_id: position_id,
                 plan_id: currentPlanId,
                 pos_x: posX,
                 pos_y: posY,
                 width: currentWidth,
                 height: currentHeight,
                 anchor_x: anchorXPercent,
                 anchor_y: anchorYPercent
            });

            if (target.arrowLine) {
                 addArrowToTag(target, anchorXPercent, anchorYPercent);
            }
             showToolbar(target);
        } else {
             console.log("Objet de dessin modifié.");
        }
    }


    function handleSelection(opt) {
         const selected = opt.selected;
        if (!selected || selected.length === 0) {
             handleSelectionCleared();
             return;
         }
        selectedFabricObject = selected[0];
         console.log("Objet sélectionné:", selectedFabricObject.type, selectedFabricObject.customData);

        if (selectedFabricObject.isGridLine) {
             fabricCanvas.discardActiveObject().renderAll();
             hideToolbar();
             return;
         }

        if (selectedFabricObject.customData?.isGeoTag) {
            showToolbar(selectedFabricObject);
            redrawAllTagsHighlight();
        } else {
            hideToolbar();
            strokeColorInput.value = selectedFabricObject.stroke || '#000000';
            strokeWidthInput.value = selectedFabricObject.baseStrokeWidth || Math.round((selectedFabricObject.strokeWidth || 1) * fabricCanvas.getZoom());
            fillShapeToggle.checked = !!(selectedFabricObject.fill && selectedFabricObject.fill !== 'transparent');
            let fillColorValue = '#cccccc';
             if (fillShapeToggle.checked && selectedFabricObject.fill) {
                 try {
                     const fabricColor = new fabric.Color(selectedFabricObject.fill);
                     fillColorValue = fabricColor.toHex();
                 } catch (e) {
                     console.warn("Impossible de convertir la couleur de remplissage en hexa:", selectedFabricObject.fill);
                 }
             }
            fillColorInput.value = fillColorValue;

            if (fillColorInput) fillColorInput.style.display = fillShapeToggle.checked ? 'inline-block' : 'none';
        }
    }


    function handleSelectionCleared() {
         console.log("Sélection effacée.");
        hideToolbar();
        selectedFabricObject = null;
        redrawAllTagsHighlight();
    }


    function handleKeyDown(e) {
        const activeObj = fabricCanvas.getActiveObject();

        if (e.key === 'Escape') {
             console.log("Escape pressé.");
            if (isPlacementMode) cancelPlacementMode();
            if (isDrawingArrowMode) cancelArrowDrawing();
            if (isDrawing) stopDrawing();
            if (activeObj) fabricCanvas.discardActiveObject().renderAll();
            if (highlightedCodeGeo) {
                highlightedCodeGeo = null;
                redrawAllTagsHighlight();
            }
             e.preventDefault();
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && activeObj && !e.target.tagName.match(/input|textarea/i)) {
             if (!activeObj.customData?.isGeoTag) {
                 deleteSelectedShape();
                 e.preventDefault();
             } else {
                  console.log("Tentative de suppression tag géo avec Suppr/Retour Arrière - utiliser la toolbar.");
             }
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'c' && activeObj && !e.target.tagName.match(/input|textarea/i)) {
             copyShape();
             e.preventDefault();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.target.tagName.match(/input|textarea/i)) {
             pasteShape();
             e.preventDefault();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.target.tagName.match(/input|textarea/i)) {
             console.log("Undo (non implémenté)");
             e.preventDefault();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'y' && !e.target.tagName.match(/input|textarea/i)) {
             console.log("Redo (non implémenté)");
             e.preventDefault();
        }
    }


     function handleMouseWheel(opt) {
        const delta = opt.e.deltaY;
        let zoom = fabricCanvas.getZoom();
        zoom *= 0.999 ** delta;

        zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

        fabricCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);

        opt.e.preventDefault();
        opt.e.stopPropagation();
    }


     function updateDrawingStyle() {
        const strokeColor = strokeColorInput.value;
        const baseStrokeWidth = parseInt(strokeWidthInput.value, 10);
        const fillColor = fillShapeToggle.checked ? fillColorInput.value : 'transparent';
        const activeObject = fabricCanvas.getActiveObject();
        const currentZoom = fabricCanvas.getZoom();

        console.log("Mise à jour style - Stroke:", strokeColor, "Width:", baseStrokeWidth, "Fill:", fillColor, "ActiveObj:", activeObject);

        if (activeObject && !activeObject.customData?.isGeoTag && !activeObject.isGridLine) {
             console.log("Application style à l'objet sélectionné.");
            const updateProps = {
                stroke: strokeColor,
                strokeWidth: baseStrokeWidth / currentZoom,
                fill: fillColor,
                baseStrokeWidth: baseStrokeWidth
            };

            if (activeObject.type === 'activeSelection') {
                activeObject.forEachObject(obj => {
                    if (!obj.isGridLine) {
                        obj.set(updateProps);
                    }
                });
            } else {
                activeObject.set(updateProps);
            }
            fabricCanvas.requestRenderAll();
        }

        if (fabricCanvas.isDrawingMode) {
             console.log("Mise à jour du pinceau de dessin libre.");
            fabricCanvas.freeDrawingBrush.color = strokeColor;
            fabricCanvas.freeDrawingBrush.width = baseStrokeWidth;
        }
    }


    async function saveDrawing() {
         console.log("Début saveDrawing (Annotations JSON).");
        if (planType !== 'image' || !currentPlanId) {
             console.warn("saveDrawing annulé: type de plan incorrect ou ID manquant.");
            return;
        }

        const dataToSave = fabricCanvas.toJSON(['customData', 'selectable', 'evented', 'baseStrokeWidth']);
        dataToSave.objects = dataToSave.objects.filter(obj => !obj.customData?.isGeoTag && !obj.isGridLine);

        console.log(`Annotations à sauvegarder: ${dataToSave.objects.length} objets.`);

        try {
            const response = await fetch('index.php?action=saveDrawing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_id: currentPlanId,
                    drawing_data: dataToSave.objects.length > 0 ? dataToSave : null
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            const result = await response.json();
            if (result.status === 'success') {
                 console.log("Annotations sauvegardées avec succès.");
                 alert('Annotations sauvegardées !');
            } else {
                 throw new Error(result.message || 'Erreur serveur.');
            }
        } catch (error) {
            console.error("Erreur saveDrawing:", error);
            alert(`Erreur sauvegarde annotations: ${error.message}`);
        }
    }


     async function saveNewSvgPlan() {
        console.log("Début saveNewSvgPlan.");
        if (planType !== 'svg_creation' || !newPlanNameInput) {
             console.warn("saveNewSvgPlan annulé: pas en mode création ou input nom manquant.");
             return;
        }
        const planName = newPlanNameInput.value.trim();
        if (!planName) {
            alert("Veuillez entrer un nom pour le nouveau plan.");
            newPlanNameInput.focus();
            return;
        }

        console.log("Export SVG depuis Fabric...");
        const svgString = fabricCanvas.toSVG(['baseStrokeWidth'], obj => {
            if (obj.isGridLine) return null;
             return obj;
        });
        console.log("SVG généré (début):", svgString.substring(0, 200) + "...");

        try {
             console.log("Envoi requête createSvgPlan...");
            const response = await fetch('index.php?action=createSvgPlan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nom: planName, svgContent: svgString })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            const result = await response.json();
            if (result.status === 'success' && result.new_plan_id) {
                 console.log("Plan SVG créé avec succès, ID:", result.new_plan_id);
                 alert(`Plan "${planName}" créé ! Redirection vers l'édition...`);
                 window.location.href = `index.php?action=manageCodes&id=${result.new_plan_id}`;
            } else {
                 throw new Error(result.message || 'Erreur serveur.');
            }
        } catch (error) {
            console.error("Erreur saveNewSvgPlan:", error);
            alert(`Erreur création SVG: ${error.message}`);
        }
    }


    async function saveModifiedSvgPlan() {
        console.log("Début saveModifiedSvgPlan.");
        if (planType !== 'svg' || !currentPlanId) {
             console.warn("saveModifiedSvgPlan annulé: type incorrect ou ID manquant.");
            return;
        }

        const originalSvgGroup = fabricCanvas.getObjects().find(o => o.isSvgBackground);
        const addedDrawings = fabricCanvas.getObjects().filter(obj => !obj.customData?.isGeoTag && !obj.isGridLine && !obj.isSvgBackground);

        console.log(`Objets de dessin ajoutés: ${addedDrawings.length}`);

        if (!originalSvgGroup) {
             console.error("Impossible de trouver le groupe SVG original (isSvgBackground) pour la sauvegarde.");
             alert("Erreur critique: impossible de sauvegarder le SVG sans le fond original.");
             return;
        }

        const tempCanvasWidth = originalSvgGroup.originalWidth || originalSvgGroup.width;
        const tempCanvasHeight = originalSvgGroup.originalHeight || originalSvgGroup.height;

        console.log(`Dimensions canvas temporaire pour export SVG: ${tempCanvasWidth} x ${tempCanvasHeight}`);

        if (!tempCanvasWidth || !tempCanvasHeight) {
             console.error("Dimensions originales du SVG non trouvées ou invalides.");
             alert("Erreur: Impossible de déterminer les dimensions originales du SVG pour la sauvegarde.");
             return;
        }

        const tempCanvas = new fabric.StaticCanvas(null, {
            width: tempCanvasWidth,
            height: tempCanvasHeight,
            enableRetinaScaling: false
        });

        const clonedSvgBg = fabric.util.object.clone(originalSvgGroup);
        clonedSvgBg.set({
            scaleX: 1,
            scaleY: 1,
            left: 0,
            top: 0,
            selectable: false,
            evented: false
        });
        tempCanvas.add(clonedSvgBg);
        console.log("Groupe SVG original (non scalé) ajouté au canvas temp.");

        const bgScaleX = originalSvgGroup.scaleX || 1;
        const bgScaleY = originalSvgGroup.scaleY || 1;
        const bgOrigin = originalSvgGroup.getPointByOrigin('left', 'top');

        addedDrawings.forEach(obj => {
            const clonedObj = fabric.util.object.clone(obj);
            const newLeft = (clonedObj.left - bgOrigin.x) / bgScaleX;
            const newTop = (clonedObj.top - bgOrigin.y) / bgScaleY;
            const newScaleX = (clonedObj.scaleX || 1) / bgScaleX;
            const newScaleY = (clonedObj.scaleY || 1) / bgScaleY;
            const newStrokeWidth = clonedObj.baseStrokeWidth || clonedObj.strokeWidth;

            clonedObj.set({
                left: newLeft,
                top: newTop,
                scaleX: newScaleX,
                scaleY: newScaleY,
                strokeWidth: newStrokeWidth,
                selectable: false,
                evented: false
            });
            tempCanvas.add(clonedObj);
        });
        console.log("Dessins ajoutés (coordonnées converties) au canvas temp.");


        const svgString = tempCanvas.toSVG();
        tempCanvas.dispose();

        console.log("SVG final généré (début):", svgString.substring(0, 200) + "...");

        try {
            console.log("Envoi requête updateSvgPlan...");
            const response = await fetch('index.php?action=updateSvgPlan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_id: currentPlanId,
                    svgContent: svgString
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            const result = await response.json();
            if (result.status === 'success') {
                console.log("Modifications SVG sauvegardées avec succès via API.");
                alert('Modifications SVG sauvegardées !');
            } else {
                throw new Error(result.message || 'Erreur serveur.');
            }
        } catch (error) {
            console.error("Erreur saveModifiedSvgPlan API:", error);
            alert(`Erreur sauvegarde SVG: ${error.message}`);
        }
    }

     function addArrowToTag(tagGroup, anchorXPercent, anchorYPercent) {
        // console.log(`addArrowToTag - Tag: ${tagGroup.customData.codeGeo}, Anchor: ${anchorXPercent}%, ${anchorYPercent}%`);

        const bg = fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group');

        if (!bg || anchorXPercent === null || typeof anchorXPercent === 'undefined' || anchorYPercent === null || typeof anchorYPercent === 'undefined') {
             console.warn("addArrowToTag - Arrière-plan ou coordonnées d'ancre invalides/manquantes.");
            if (tagGroup.arrowLine) {
                 console.log("addArrowToTag - Suppression flèche existante car ancre invalide.");
                fabricCanvas.remove(tagGroup.arrowLine);
                tagGroup.arrowLine = null;
                fabricCanvas.renderAll();
            }
            return;
        }
        const tagCenter = tagGroup.getCenterPoint();
        const anchorGlobal = convertPercentToPixels(anchorXPercent, anchorYPercent);

        if (isNaN(anchorGlobal.left) || isNaN(anchorGlobal.top)) {
             console.error("addArrowToTag - Coordonnées d'ancre globales calculées invalides (NaN).");
             return;
        }

        const currentZoom = fabricCanvas.getZoom();
        const strokeW = 2 / currentZoom;
        // console.log(`addArrowToTag - Coordonnées: TagCenter=(${tagCenter.x}, ${tagCenter.y}), AnchorGlobal=(${anchorGlobal.left}, ${anchorGlobal.top}), StrokeWidth=${strokeW}`);

        if (tagGroup.arrowLine) {
            // console.log("addArrowToTag - Mise à jour flèche existante.");
            tagGroup.arrowLine.set({
                x1: tagCenter.x,
                y1: tagCenter.y,
                x2: anchorGlobal.left,
                y2: anchorGlobal.top,
                strokeWidth: strokeW
            });
        } else {
            // console.log("addArrowToTag - Création nouvelle flèche.");
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
        tagGroup.arrowLine.moveTo(fabricCanvas.getObjects().indexOf(tagGroup));
        tagGroup.arrowLine.setCoords();
        fabricCanvas.renderAll();
        // console.log("addArrowToTag - Rendu après ajout/màj flèche.");
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
        const { posX, posY } = convertPixelsToPercent(pointer.x, pointer.y);

        selectedFabricObject.customData.anchorXPercent = posX;
        selectedFabricObject.customData.anchorYPercent = posY;

        addArrowToTag(selectedFabricObject, posX, posY);

        const currentPos = convertPixelsToPercent(selectedFabricObject.getCenterPoint().x, selectedFabricObject.getCenterPoint().y);
        const { position_id, id: geoCodeId, currentWidth, currentHeight } = selectedFabricObject.customData;

        savePositionAPI({
            id: geoCodeId,
            position_id: position_id,
            plan_id: currentPlanId,
            pos_x: currentPos.posX,
            pos_y: currentPos.posY,
            width: currentWidth,
            height: currentHeight,
            anchor_x: posX,
            anchor_y: posY
        });
        cancelArrowDrawing();
        setTimeout(() => {
            if (selectedFabricObject) {
                fabricCanvas.setActiveObject(selectedFabricObject).renderAll();
                 showToolbar(selectedFabricObject);
            }
        }, 50);
    }

    function cancelArrowDrawing() {
        isDrawingArrowMode = false;
        fabricCanvas.defaultCursor = (currentDrawingTool === 'select') ? 'default' : 'crosshair';
    }

     function showToolbar(target) {
        if (!tagToolbar || !target?.customData?.isGeoTag) return;

        fabric.util.requestAnimFrame(() => {
             if (!target || !target.canvas) {
                 hideToolbar();
                 return;
             }
             const bound = target.getBoundingRect();

             if (isNaN(bound.left) || isNaN(bound.top) || isNaN(bound.width) || isNaN(bound.height)) {
                 console.warn("Coordonnées invalides pour afficher la toolbar", bound);
                 hideToolbar();
                 return;
             }

             const toolbarTop = bound.top - tagToolbar.offsetHeight - 5;
             const toolbarLeft = bound.left + bound.width / 2 - tagToolbar.offsetWidth / 2;

             const canvasRect = canvasEl.getBoundingClientRect();
             const finalLeft = Math.max(0, Math.min(toolbarLeft, canvasRect.width - tagToolbar.offsetWidth));
             const finalTop = Math.max(0, Math.min(toolbarTop, canvasRect.height - tagToolbar.offsetHeight));


            tagToolbar.style.left = `${finalLeft}px`;
            tagToolbar.style.top = `${finalTop}px`;

            tagToolbar.style.opacity = '1';
            tagToolbar.style.pointerEvents = 'auto';
            tagToolbar.classList.add('visible');
        });
    }


    function hideToolbar() {
        if (!tagToolbar) return;
        tagToolbar.style.opacity = '0';
        tagToolbar.style.pointerEvents = 'none';
        tagToolbar.classList.remove('visible');
    }

    async function deleteSelectedTag() {
        if (!selectedFabricObject?.customData?.isGeoTag) return;
        const { position_id, id: geoCodeId, codeGeo } = selectedFabricObject.customData;
        const allInstances = fabricCanvas.getObjects().filter(o => o.customData?.isGeoTag && o.customData.id === geoCodeId);
        let performDelete = false, deleteAllInstances = false;

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

        const success = deleteAllInstances
            ? await removeMultiplePositionsAPI(geoCodeId, currentPlanId)
            : await removePositionAPI(position_id);

        if (success) {
            (deleteAllInstances ? allInstances : [selectedFabricObject]).forEach(tag => {
                if (tag.arrowLine) fabricCanvas.remove(tag.arrowLine);
                fabricCanvas.remove(tag);
                if (tag.customData && tag.customData.position_id) {
                     delete fabricObjects[tag.customData.position_id];
                }
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
        const { customData } = selectedFabricObject;

        selectedFabricObject.item(0).set({ width: preset.width, height: preset.height });
        
        // --- CORRECTION ---
        selectedFabricObject.addWithUpdate();
        selectedFabricObject.setCoords();
        // --- FIN CORRECTION ---
        
        fabricCanvas.renderAll();

        const { posX, posY } = convertPixelsToPercent(selectedFabricObject.getCenterPoint().x, selectedFabricObject.getCenterPoint().y);
        const positionData = {
            id: customData.id,
            position_id: customData.position_id,
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
            customData.width = preset.width;
            customData.height = preset.height;
            console.log("Tag size updated and saved:", customData.codeGeo, preset);
        } else {
             console.error("Failed to save tag size change for:", customData.codeGeo);
        }
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
        if (fabricObj.isGridLine || !fabricObj.visible) return;
        const isTag = fabricObj.customData?.isGeoTag;
        const isActiveSelection = fabricCanvas.getActiveObject() === fabricObj;

        let isHighlightedInstance = false;
        if (isTag && highlightedCodeGeo) {
             isHighlightedInstance = fabricObj.customData.codeGeo === highlightedCodeGeo;
        }

        let opacity = 1.0;
        if (highlightedCodeGeo && (!isTag || !isHighlightedInstance)) {
             opacity = 0.3;
        } else if (!highlightedCodeGeo && isTag && !isActiveSelection) {
             opacity = 1.0;
        } else if (!isTag && highlightedCodeGeo){
             opacity = 0.3;
        }
        fabricObj.set({ opacity });

        if (isTag && fabricObj.item && fabricObj.item(0)) {
            const rect = fabricObj.item(0);
            let strokeColor = 'black';
            let strokeW = 1 / fabricCanvas.getZoom();

            if (isActiveSelection) {
                strokeColor = '#007bff';
                strokeW = 2 / fabricCanvas.getZoom();
            } else if (isHighlightedInstance) {
                strokeColor = '#ffc107';
                strokeW = 2 / fabricCanvas.getZoom();
            }

            rect.set({ stroke: strokeColor, strokeWidth: strokeW });
        }

        if (fabricObj.arrowLine) {
            fabricObj.arrowLine.set({ opacity });
        }
    }


    function zoom(factor) {
        const center = fabricCanvas.getCenter();
        let newZoom = fabricCanvas.getZoom() * factor;
        newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
        console.log(`Zoom: factor=${factor}, newZoom=${newZoom}, center=(${center.x}, ${center.y})`);

        fabricCanvas.zoomToPoint(new fabric.Point(center.x, center.y), newZoom);
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
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
             console.log("Codes disponibles récupérés via AJAX.");
            renderAvailableCodes(await response.json());
        } catch (error) {
            console.error("Erreur fetchAvailableCodes:", error);
            if (unplacedList) unplacedList.innerHTML = `<p class="text-danger p-3">Erreur chargement codes disponibles: ${error.message}</p>`;
            updateCounter(0);
        }
    }


    function renderAvailableCodes(codes) {
        if (!unplacedList) return;
        unplacedList.innerHTML = '';
        if (!codes || codes.length === 0) {
            unplacedList.innerHTML = `<p class="text-muted small p-3">Aucun code disponible pour ce plan.</p>`;
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
                search: `${code.code_geo} ${code.libelle || ''} ${code.univers || ''}`.toLowerCase()
            });
            item.style.borderLeft = `5px solid ${universColors[code.univers] || '#ccc'}`;
            item.innerHTML = `
                <div>
                    <strong class="item-code">${code.code_geo}</strong>
                    <small class="item-libelle d-block text-muted">${code.libelle || 'Pas de libellé'}</small>
                </div>
                <span class="badge bg-secondary rounded-pill placement-count">${code.placement_count || 0}</span>
            `;
            unplacedList.appendChild(item);
        });
        filterAvailableCodes();
        console.log(`${codes.length} codes disponibles affichés dans la sidebar.`);
    }


    function filterAvailableCodes() {
        if (!searchInput || !unplacedList) return;
        const searchTerm = searchInput.value.toLowerCase().trim();
        let visibleCount = 0;
        document.querySelectorAll('#unplaced-list .unplaced-item').forEach(item => {
            const isVisible = item.dataset.search ? item.dataset.search.includes(searchTerm) : true;
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
            console.log("Clic sur code dispo:", item.dataset.codeGeo);
            cancelArrowDrawing();
            stopDrawing();
            setActiveTool('select');
            isPlacementMode = true;
            codeToPlace = { ...item.dataset };
            planContainer?.classList.add('placement-mode');
            fabricCanvas.defaultCursor = 'crosshair';
            fabricCanvas.setCursor('crosshair');
            fabricCanvas.discardActiveObject();
            hideToolbar();
            document.querySelectorAll('#unplaced-list .unplaced-item.active').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
        }
    }


    function cancelPlacementMode() {
         console.log("Annulation mode placement.");
        isPlacementMode = false;
        codeToPlace = null;
        planContainer?.classList.remove('placement-mode');
        fabricCanvas.defaultCursor = (currentDrawingTool === 'select') ? 'default' : 'crosshair';
        fabricCanvas.setCursor(fabricCanvas.defaultCursor);
        document.querySelectorAll('#unplaced-list .unplaced-item.active').forEach(el => el.classList.remove('active'));
    }

    async function placeNewTag(clickEvent) {
        if (!isPlacementMode || !codeToPlace) return;
        console.log("Placement nouveau tag pour:", codeToPlace.codeGeo);
        const pointer = fabricCanvas.getPointer(clickEvent);
        const { posX, posY } = convertPixelsToPercent(pointer.x, pointer.y);

        if (isNaN(posX) || isNaN(posY)) {
            console.error("placeNewTag - Coordonnées en pourcentage invalides (NaN).");
            alert("Erreur lors du calcul de la position. Veuillez réessayer.");
            cancelPlacementMode();
            return;
        }

        const newPositionData = {
            id: parseInt(codeToPlace.id, 10),
            plan_id: currentPlanId,
            pos_x: posX,
            pos_y: posY,
            width: sizePresets.medium.width,
            height: sizePresets.medium.height,
            anchor_x: null,
            anchor_y: null
        };

        console.log("Envoi données pour nouveau tag:", newPositionData);
        const savedData = await savePositionAPI(newPositionData);

        if (savedData) {
            console.log("Données de position sauvegardées:", savedData);
            const fullCodeData = {
                ...codeToPlace,
                position_id: savedData.position_id,
                pos_x: savedData.pos_x,
                pos_y: savedData.pos_y,
                width: savedData.width,
                height: savedData.height,
                anchor_x: savedData.anchor_x,
                anchor_y: savedData.anchor_y,
                 geoCodeId: parseInt(codeToPlace.id, 10)
            };
            console.log("Données complètes pour createFabricTag (après sauvegarde):", fullCodeData);
            const newTag = createFabricTag(fullCodeData);
            if (newTag) {
                 console.log("Nouveau tag Fabric créé:", newTag);
                 fabricCanvas.setActiveObject(newTag).renderAll();
                 showToolbar(newTag);
            } else {
                 console.error("placeNewTag - Échec de la création du tag Fabric après sauvegarde.");
            }

            updateCodeCountInSidebar(codeToPlace.id, 1);

            const codeIdx = allCodesData.findIndex(c => c.id == codeToPlace.id);
            if (codeIdx > -1) {
                if (!allCodesData[codeIdx].placements) allCodesData[codeIdx].placements = [];
                allCodesData[codeIdx].placements.push(savedData);
            } else {
                 console.warn("Code non trouvé dans allCodesData après placement:", codeToPlace.id);
            }
        } else {
             console.error("Échec de la sauvegarde de la position via API.");
        }
        cancelPlacementMode();
    }


    function updateCodeCountInSidebar(geoCodeId, change) {
        const item = unplacedList?.querySelector(`.unplaced-item[data-id="${geoCodeId}"]`);
        const countBadge = item?.querySelector('.placement-count');
        if (countBadge) {
             const currentCount = parseInt(countBadge.textContent, 10) || 0;
             countBadge.textContent = Math.max(0, currentCount + change);
        }
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
            alert("Les champs Code Géo, Libellé et Univers sont requis.");
            return;
        }
        console.log("Tentative de sauvegarde nouveau code géo:", data);
        try {
            const response = await fetch('index.php?action=addGeoCodeFromPlan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                 let errorMsg = `HTTP ${response.status}`;
                 try {
                     const errorData = await response.json();
                     errorMsg += `: ${errorData.error || 'Erreur inconnue'}`;
                 } catch (e) { /* Ignorer erreur JSON */ }
                throw new Error(errorMsg);
            }
            const newCode = await response.json();
            console.log("Nouveau code géo reçu:", newCode);

             const universName = planUnivers.find(u => u.id == newCode.univers_id)?.nom || 'Inconnu';

            allCodesData.push({
                ...newCode,
                univers: universName,
                placements: []
            });
            console.log("allCodesData mis à jour:", allCodesData);

            await fetchAvailableCodes();
            addCodeModal.hide();

            const newItem = unplacedList?.querySelector(`.unplaced-item[data-id="${newCode.id}"]`);
            if (newItem) {
                newItem.click();
                 alert("Code créé avec succès. Cliquez maintenant sur le plan pour le placer.");
            } else {
                 console.warn("Impossible de trouver le nouvel élément dans la sidebar après création:", newCode.id);
                 alert("Code créé, mais impossible de le sélectionner automatiquement.");
            }
        } catch (error) {
            console.error('Erreur création code géo:', error);
            alert(`Erreur lors de la création du code: ${error.message}`);
        }
    }


     async function savePositionAPI(positionData) {
        console.log("savePositionAPI - Données envoyées:", positionData);
        positionData.id = parseInt(positionData.id, 10);
        if (positionData.position_id) {
            positionData.position_id = parseInt(positionData.position_id, 10);
        }
        positionData.plan_id = parseInt(positionData.plan_id, 10);

         positionData.pos_x = parseFloat(positionData.pos_x);
         positionData.pos_y = parseFloat(positionData.pos_y);
         if (positionData.anchor_x !== null) positionData.anchor_x = parseFloat(positionData.anchor_x);
         if (positionData.anchor_y !== null) positionData.anchor_y = parseFloat(positionData.anchor_y);
         if (positionData.width !== null) positionData.width = parseInt(positionData.width, 10);
         if (positionData.height !== null) positionData.height = parseInt(positionData.height, 10);


         for (const key in positionData) {
             if (typeof positionData[key] === 'number' && isNaN(positionData[key])) {
                 console.error(`savePositionAPI - Erreur: NaN détecté pour la clé '${key}' avant envoi API.`);
                 alert(`Erreur interne: Impossible de sauvegarder la position (valeur ${key} invalide).`);
                 return null;
             }
         }


        try {
            const response = await fetch('index.php?action=savePosition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(positionData)
            });
             console.log("savePositionAPI - Réponse Status:", response.status);
             const responseText = await response.text();
             console.log("savePositionAPI - Réponse Texte:", responseText.substring(0, 100) + "...");

            if (!response.ok) {
                 let errorMsg = `HTTP ${response.status}`;
                 try {
                     const errorJson = JSON.parse(responseText);
                     errorMsg += `: ${errorJson.message || 'Erreur inconnue'}`;
                 } catch (e) {
                      errorMsg += `: ${responseText}`;
                 }
                 throw new Error(errorMsg);
            }

            const result = JSON.parse(responseText);
            if (result.status === 'success' && result.position_data) {
                 console.log("savePositionAPI - Succès, données retournées:", result.position_data);
                 return result.position_data;
            } else {
                 throw new Error(result.message || 'Erreur serveur inattendue.');
            }
        } catch (error) {
            console.error("Erreur savePositionAPI:", error);
            alert(`Erreur lors de la sauvegarde de la position: ${error.message}`);
            return null;
        }
    }


    async function removePositionAPI(positionId) {
        console.log("removePositionAPI - ID:", positionId);
        try {
            const response = await fetch('index.php?action=removePosition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(positionId, 10) })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            const result = await response.json();
             console.log("removePositionAPI - Résultat:", result);
            return result.status === 'success';
        } catch (error) {
            console.error("Erreur removePositionAPI:", error);
            alert(`Erreur lors de la suppression: ${error.message}`);
            return false;
        }
    }

    async function removeMultiplePositionsAPI(geoCodeId, planId) {
         console.log("removeMultiplePositionsAPI - GeoCodeID:", geoCodeId, "PlanID:", planId);
        try {
            const response = await fetch('index.php?action=removeMultiplePositions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    geo_code_id: parseInt(geoCodeId, 10),
                    plan_id: parseInt(planId, 10)
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            const result = await response.json();
             console.log("removeMultiplePositionsAPI - Résultat:", result);
            return result.status === 'success';
        } catch (error) {
            console.error("Erreur removeMultiplePositionsAPI:", error);
             alert(`Erreur lors de la suppression multiple: ${error.message}`);
            return false;
        }
    }

    function updateLegend() {
        if (!legendContainer) return;
        legendContainer.innerHTML = '';
        const legendUnivers = planUnivers || [];

        if (legendUnivers.length === 0) {
            legendContainer.innerHTML = '<p class="text-muted small">Aucun univers lié à ce plan.</p>';
            return;
        }

        legendUnivers.sort((a,b) => a.nom.localeCompare(b.nom)).forEach(univers => {
            const color = universColors[univers.nom] || '#7f8c8d';
            const item = document.createElement('div');
            item.className = 'legend-item d-flex align-items-center mb-1';
            item.innerHTML = `
                <div class="legend-color-box me-2" style="width: 15px; height: 15px; background-color: ${color}; border: 1px solid #666;"></div>
                <span>${univers.nom}</span>`;
            legendContainer.appendChild(item);
        });
         console.log("Légende mise à jour.");
    }


    // --- SÉQUENCE D'INITIALISATION ---
    initializePlan();


     console.log("Fin du script plan.js (après l'appel à initializePlan).");
});
