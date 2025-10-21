/**
 * Module Canvas
 * Gère l'initialisation de Fabric.js, le chargement du plan (SVG ou Image),
 * le zoom, le redimensionnement, le verrouillage, et les grilles.
 */
// --- IMPORTS ---
import { showToast } from '../modules/utils.js';
import { GRID_SIZE, MIN_ZOOM, MAX_ZOOM } from '../modules/config.js';

// --- VARIABLES MODULE ---
let fabricCanvas = null;
let gridGroup = null; // Groupe d'objets pour la grille
let snapToGrid = false; // État du magnétisme
let isLocked = true; // État du verrouillage du plan (fond)
let svgObjects = []; // Stocke les objets SVG chargés (pour les trouver par ID)
let svgOriginalBBox = null; // Stocke la Bounding Box originale du SVG

// --- EXPORTS ---
export {
    initializeCanvas,
    loadSvgPlan,
    loadPlanImage,
    getCanvasInstance,
    resizeCanvas,
    resetZoom,
    zoomCanvas, // <-- Fonction corrigée et exportée
    setCanvasLock,
    getCanvasLock,
    toggleSnapToGrid,
    getSnapToGrid,
    findSvgShapeByCodeGeo,
    getSvgOriginalBBox,
    updateGrid,
    updateStrokesWidth
};

// --- INITIALISATION ---

/**
 * Initialise l'instance du canvas Fabric.
 * @param {string} canvasId - L'ID de l'élément <canvas>
 * @returns {fabric.Canvas} L'instance du canvas
 */
function initializeCanvas(canvasId) {
    if (fabricCanvas) {
        console.warn("Canvas déjà initialisé.");
        return fabricCanvas;
    }
    try {
        fabricCanvas = new fabric.Canvas(canvasId, {
            backgroundColor: '#f8f9fa',
            selection: true, // Activer la sélection
            hoverCursor: 'default',
            moveCursor: 'default',
            // Améliorations de performance
            renderOnAddRemove: false,
            preserveObjectStacking: true // Important pour le fond et les tags
        });

        // Gestion du zoom avec la molette
        fabricCanvas.on('mouse:wheel', (opt) => {
            const delta = opt.e.deltaY;
            const factor = 0.999 ** delta;
            const point = { x: opt.e.offsetX, y: opt.e.offsetY };
            
            // Appeler la nouvelle fonction de zoom
            zoomCanvas(factor, point);
            
            opt.e.preventDefault();
            opt.e.stopPropagation();
        });

        // *** SUPPRESSION de la gestion du Pan (Alt+Clic) d'ici ***
        // Elle est maintenant gérée dans main.js pour éviter les conflits
        // fabricCanvas.on('mouse:down', (opt) => { ... });
        // fabricCanvas.on('mouse:move', (opt) => { ... });
        // fabricCanvas.on('mouse:up', (opt) => { ... });

        // Redimensionner le canvas lors du changement de taille de la fenêtre
        window.addEventListener('resize', resizeCanvas);
        // Lancer un premier redimensionnement
        resizeCanvas();

        console.log("Canvas Fabric initialisé.");
        return fabricCanvas;

    } catch (error) {
        console.error("Erreur lors de l'initialisation de Fabric:", error);
        showToast("Erreur critique: Impossible de charger le canvas.", 'error');
        return null;
    }
}

/**
 * Retourne l'instance du canvas Fabric.
 * @returns {fabric.Canvas}
 */
function getCanvasInstance() {
    return fabricCanvas;
}

// --- GESTION DU FOND (PLAN) ---

/**
 * Charge un plan au format SVG comme fond du canvas.
 * @param {string} url - URL du fichier SVG
 * @returns {Promise<void>}
 */
function loadSvgPlan(url) {
    return new Promise((resolve, reject) => {
        if (!fabricCanvas) return reject(new Error("Canvas non initialisé."));
        
        console.log(`Chargement du plan SVG (objets individuels) depuis ${url}`);
        fabricCanvas.clear(); 
        svgObjects = []; 
        svgOriginalBBox = null; 

        fabric.loadSVGFromURL(url, (objects, options) => {
            if (!objects || objects.length === 0) {
                console.error("Le SVG est vide ou n'a pas pu être chargé.");
                showToast("Erreur: Le fichier SVG est vide ou invalide.", 'error');
                return reject(new Error("SVG vide ou invalide."));
            }
            console.log(`SVG chargé, ${objects.length} objets trouvés.`);

            const group = new fabric.Group(objects);
            svgOriginalBBox = group.getBoundingRect();
            console.log("Bounding Box SVG Originale:", svgOriginalBBox);

            objects.forEach((obj, index) => {
                const svgId = options.svgUid ? options.svgUid[index]?.id : null; 
                
                obj.set({
                    selectable: false,
                    evented: true, 
                    hoverCursor: 'default',
                    isSvgShape: true, 
                    customData: {
                        svgId: svgId || `shape_${index}` 
                    }
                });

                fabricCanvas.add(obj);
                svgObjects.push(obj); 
            });

            console.log("Objets SVG ajoutés individuellement au canvas.");
            resizeCanvas(); 
            resetZoom(); 
            resolve();

        }, (item, obj) => {
            // "Reviver" 
        }, {
            crossOrigin: 'anonymous' 
        });
    });
}


/**
 * Charge un plan au format Image (PNG/JPG) comme fond du canvas.
 * @param {string} url - URL de l'image
 * @returns {Promise<void>}
 */
function loadPlanImage(url) {
    return new Promise((resolve, reject) => {
        if (!fabricCanvas) return reject(new Error("Canvas non initialisé."));
        
        console.log(`Chargement du plan Image depuis ${url}`);
        fabricCanvas.clear(); 
        svgObjects = []; 
        svgOriginalBBox = null; 

        fabric.Image.fromURL(url, (img) => {
            if (!img) {
                return reject(new Error("Impossible de charger l'image."));
            }
            
            img.set({
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
                isBackgroundImage: true
            });
            
            fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {});

            svgOriginalBBox = img.getBoundingRect();
            console.log("Bounding Box Image (fond):", svgOriginalBBox);

            resizeCanvas();
            resetZoom();
            resolve();

        }, { crossOrigin: 'anonymous' });
    });
}


// --- GESTION AFFICHAGE (Zoom, Resize, Lock) ---

/**
 * Redimensionne le canvas Fabric pour remplir son conteneur.
 */
function resizeCanvas() {
    if (!fabricCanvas) return;
    const container = fabricCanvas.wrapperEl.parentNode;
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight; 
    fabricCanvas.setWidth(width);
    fabricCanvas.setHeight(height);
    fabricCanvas.calcOffset(); 
    fabricCanvas.requestRenderAll(); 
    if (gridGroup && gridGroup.visible) {
        updateGrid(fabricCanvas.getZoom());
    }
}

/**
 * *** FONCTION CORRIGÉE ***
 * Applique un zoom au canvas.
 * @param {number} factor - Le multiplicateur de zoom (ex: 1.2 pour zoomer, 0.8 pour dézoomer)
 * @param {object|null} [point=null] - Le point {x, y} sur lequel zoomer. Si null, zoome au centre.
 */
function zoomCanvas(factor, point = null) {
    if (!fabricCanvas) return;
    
    let zoom = fabricCanvas.getZoom();
    zoom *= factor;
    if (zoom > MAX_ZOOM) zoom = MAX_ZOOM;
    if (zoom < MIN_ZOOM) zoom = MIN_ZOOM;

    let zoomPoint;
    if (point) {
        zoomPoint = new fabric.Point(point.x, point.y);
    } else {
        // *** CORRECTION: Utiliser getVpCenter() pour zoomer au centre du viewport ***
        zoomPoint = fabricCanvas.getVpCenter(); 
    }

    fabricCanvas.zoomToPoint(zoomPoint, zoom);
    
    // Les listeners 'viewport:transformed' dans main.js s'occupent 
    // d'appeler updateGrid et updateStrokesWidth.
}

/**
 * Réinitialise le zoom pour centrer et afficher l'intégralité du plan.
 */
function resetZoom() {
    if (!fabricCanvas) return;

    const bbox = svgOriginalBBox;
    if (!bbox || bbox.width === 0 || bbox.height === 0) {
        console.warn("ResetZoom: Bounding Box du plan non disponible. Centrage simple.");
        fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]); 
        return;
    }

    const canvasWidth = fabricCanvas.width;
    const canvasHeight = fabricCanvas.height;
    const padding = 50; 

    const scaleX = (canvasWidth - padding * 2) / bbox.width;
    const scaleY = (canvasHeight - padding * 2) / bbox.height;
    let zoom = Math.min(scaleX, scaleY); // Utiliser 'let' pour pouvoir le modifier

    if (zoom < MIN_ZOOM) zoom = MIN_ZOOM;
    if (zoom > MAX_ZOOM) zoom = MAX_ZOOM;

    const panX = (canvasWidth - (bbox.width * zoom)) / 2 - (bbox.left * zoom);
    const panY = (canvasHeight - (bbox.height * zoom)) / 2 - (bbox.top * zoom);

    fabricCanvas.setViewportTransform([zoom, 0, 0, zoom, panX, panY]);
    
    fabricCanvas.requestRenderAll();
    console.log("ResetZoom: Viewport ajusté. Scale:", zoom.toFixed(3));
}

/**
 * Met à jour la largeur des bordures (strokes) de tous les objets.
 * @param {number} zoom - Le niveau de zoom actuel.
 */
function updateStrokesWidth(zoom) {
    if (!fabricCanvas) return;

    fabricCanvas.getObjects().forEach(obj => {
        let baseStrokeWidth = 1; 

        if (obj.isGridLine) {
            baseStrokeWidth = obj.isMajorGridLine ? 0.5 : 0.2;
            obj.set('strokeWidth', baseStrokeWidth / zoom); // Appliquer directement
        } 
        // Gérer les tags géo (laissé à geo-tags.js ou main.js si plus complexe)
        else if (obj.customData?.isGeoTag) {
             // Si c'est un simple rect (fallback de main.js)
             if (obj.type === 'rect' && obj.baseStrokeWidth) {
                 obj.set('strokeWidth', obj.baseStrokeWidth / zoom);
             }
        } 
        else if (obj.customData?.isPlacedText) {
            baseStrokeWidth = obj.baseStrokeWidth || 0.5;
            obj.set('strokeWidth', baseStrokeWidth / zoom);
        }
        else if (obj.isArrow) {
             baseStrokeWidth = obj.baseStrokeWidth || 2;
             obj.set('strokeWidth', baseStrokeWidth / zoom);
        }
        // Gérer les objets de dessin (formes, texte libre)
        else if (obj.baseStrokeWidth) {
             obj.set('strokeWidth', obj.baseStrokeWidth / zoom);
        }
    });
}


/**
 * Verrouille ou déverrouille le plan (fond).
 * @param {boolean} lock - true pour verrouiller, false pour déverrouiller.
 */
function setCanvasLock(lock) {
    isLocked = lock;
    console.log(`Verrouillage SVG: ${isLocked}`);
    
    svgObjects.forEach(obj => {
        obj.set({
            selectable: !isLocked,
            evented: true 
        });
    });

    const bgImage = fabricCanvas.backgroundImage;
    if (bgImage) {
        bgImage.set({
            selectable: !isLocked,
            evented: !isLocked
        });
    }
    
    fabricCanvas.requestRenderAll();
}

/**
 * Récupère l'état de verrouillage.
 * @returns {boolean}
 */
function getCanvasLock() {
    return isLocked;
}

// --- GESTION GRILLE & MAGNÉTISME ---

/**
 * Affiche ou masque la grille de magnétisme.
 */
function updateGrid(zoom) {
    if (!fabricCanvas) return;

    if (gridGroup) {
        fabricCanvas.remove(gridGroup);
        gridGroup = null;
    }

    const gridToggle = document.getElementById('grid-toggle');
    const showGrid = gridToggle ? gridToggle.checked : false;

    if (!showGrid) {
        fabricCanvas.requestRenderAll();
        return;
    }

    const gridSize = GRID_SIZE; 
    
    const viewWidth = fabricCanvas.width / zoom;
    const viewHeight = fabricCanvas.height / zoom;
    const vpt = fabricCanvas.viewportTransform;
    const left = -vpt[4] / zoom;
    const top = -vpt[5] / zoom; 

    const lines = [];
    const strokeWidthMinor = 0.2 / zoom;
    const strokeWidthMajor = 0.5 / zoom;
    const strokeColor = '#cccccc';
    
    const startX = Math.floor(left / gridSize) * gridSize;
    const endX = left + viewWidth;
    const startY = Math.floor(top / gridSize) * gridSize;
    const endY = top + viewHeight;

    for (let i = startX; i <= endX; i += gridSize) {
        const isMajor = (Math.round(i) % (gridSize * 5) === 0);
        lines.push(new fabric.Line([i, startY, i, endY], {
            stroke: strokeColor,
            strokeWidth: isMajor ? strokeWidthMajor : strokeWidthMinor,
            selectable: false, evented: false,
            isGridLine: true, isMajorGridLine: isMajor
        }));
    }
    for (let i = startY; i <= endY; i += gridSize) {
         const isMajor = (Math.round(i) % (gridSize * 5) === 0);
        lines.push(new fabric.Line([startX, i, endX, i], {
            stroke: strokeColor,
            strokeWidth: isMajor ? strokeWidthMajor : strokeWidthMinor,
            selectable: false, evented: false,
            isGridLine: true, isMajorGridLine: isMajor
        }));
    }

    gridGroup = new fabric.Group(lines, {
        selectable: false, evented: false,
        originX: 'left', originY: 'top', 
        left: 0, top: 0, 
        visible: true
    });

    fabricCanvas.add(gridGroup);
    gridGroup.moveTo(-1); 
    fabricCanvas.requestRenderAll();
}

/**
 * Active ou désactive le magnétisme à la grille.
 */
function toggleSnapToGrid() {
    const snapToggle = document.getElementById('snap-toggle');
    snapToGrid = snapToggle ? snapToggle.checked : false;
    console.log(`Magnétisme (snapToGrid): ${snapToGrid}`);
}

/**
 * Récupère l'état du magnétisme.
 * @returns {boolean}
 */
function getSnapToGrid() {
    const snapToggle = document.getElementById('snap-toggle');
    snapToGrid = snapToggle ? snapToggle.checked : false;
    return snapToGrid;
}


// --- UTILITAIRES SVG ---

/**
 * Trouve un objet SVG dans le canvas par son ID ('data-code-geo' ou 'id').
 * @param {string} codeGeoId - L'ID (code_geo) à rechercher.
 * @returns {fabric.Object|null} L'objet Fabric trouvé ou null.
 */
function findSvgShapeByCodeGeo(codeGeoId) {
    if (!codeGeoId) return null;
    return svgObjects.find(obj => obj.customData?.svgId === codeGeoId) || null;
}

/**
 * Récupère la Bounding Box (BBox) originale du SVG/Image chargé.
 * @returns {object|null} La BBox { left, top, width, height }
 */
function getSvgOriginalBBox() {
    return svgOriginalBBox;
}
