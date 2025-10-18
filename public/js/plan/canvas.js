/**
 * Module pour la gestion du canvas Fabric.js, du fond, du zoom/pan et de la grille.
 */
import { MIN_ZOOM, MAX_ZOOM, GRID_SIZE } from '../modules/config.js';
import { snapToGridValue, convertPixelsToPercent } from '../modules/utils.js';

let fabricCanvas;
let isPanning = false;
let lastPosX, lastPosY;
let gridLines = [];
let isGridVisible = false;
let isSnapEnabled = false;
let planType = 'unknown'; // Sera défini lors de l'initialisation

/**
 * Initialise le canvas Fabric.js.
 * @param {HTMLCanvasElement} canvasEl - L'élément canvas HTML.
 * @param {string} pType - Le type de plan ('image', 'svg', 'svg_creation').
 * @returns {fabric.Canvas} L'instance du canvas Fabric.
 */
export function initializeCanvas(canvasEl, pType) {
    planType = pType;
    fabricCanvas = new fabric.Canvas(canvasEl, {
        selection: true,
        backgroundColor: '#ffffff', // Fond par défaut, peut être écrasé par SVG/image
        stopContextMenu: true, // Désactive le menu contextuel sur le canvas
        fireRightClick: true,  // Permet de détecter le clic droit si besoin
        preserveObjectStacking: true // Important pour garder les tags au-dessus
    });
    console.log("Canvas Fabric initialisé dans canvas.js");
    return fabricCanvas;
}

/**
 * Retourne l'instance du canvas Fabric.
 * @returns {fabric.Canvas|null}
 */
export function getCanvasInstance() {
    return fabricCanvas;
}

/**
 * Charge l'image de fond sur le canvas.
 * @param {HTMLImageElement} mapImageEl - L'élément <img> source.
 * @returns {Promise<void>}
 */
export function loadBackgroundImage(mapImageEl) {
    console.log("Chargement de l'image de fond...");
    return new Promise((resolve, reject) => {
        if (!mapImageEl?.src) {
             console.error("Élément image ou src manquant pour le fond.");
            return reject(new Error("Élément image source manquant ou invalide."));
        }
        const imageUrl = mapImageEl.src;
         console.log("URL image:", imageUrl);
        fabric.Image.fromURL(imageUrl, (img, isError) => {
            if (isError || !img) {
                 console.error("Échec du chargement de l'image par Fabric:", imageUrl);
                return reject(new Error(`Impossible de charger l'image: ${imageUrl}`));
            }
            console.log("Image chargée par Fabric, dimensions:", img.width, "x", img.height);
            img.set({
                selectable: false,
                evented: false,
                originX: 'left',
                originY: 'top',
                // Stocker les dimensions originales pour les calculs de pourcentage
                originalWidth: img.width,
                originalHeight: img.height
            });
            fabricCanvas.setBackgroundImage(img, () => {
                console.log("Image définie comme arrière-plan et rendue.");
                fabricCanvas.renderAll();
                resolve();
            }, { crossOrigin: 'anonymous' }); // Nécessaire si l'image vient d'un autre domaine
        }, { crossOrigin: 'anonymous' });
    });
}

/**
 * Charge un plan SVG comme objet groupé sur le canvas.
 * @param {string} url - URL du fichier SVG.
 * @returns {Promise<void>}
 */
export function loadSvgPlan(url) {
    console.log("Chargement du plan SVG depuis", url);
    return new Promise((resolve, reject) => {
        fabric.loadSVGFromURL(url, (objects, options) => {
            if (!objects) {
                 console.error("Échec du chargement SVG (objets null):", url);
                return reject(new Error("Impossible de charger le SVG: " + url));
            }
             console.log(`SVG chargé, ${objects.length} objets trouvés.`);
            const svgData = fabric.util.groupSVGElements(objects, options);

            svgData.set({
                isSvgBackground: true, // Marqueur pour l'identifier plus tard
                selectable: false,
                evented: false,
                originX: 'left', // Assurer une origine cohérente
                originY: 'top'
            });

            // Stocker les dimensions originales avant tout scaling initial
            svgData.originalWidth = svgData.width;
            svgData.originalHeight = svgData.height;
            console.log("Dimensions originales SVG:", svgData.originalWidth, "x", svgData.originalHeight);

            fabricCanvas.add(svgData);
            // Le centrage et le scale initial seront faits par resetZoom/resizeCanvas
             console.log("Groupe SVG ajouté au canvas.");
            fabricCanvas.renderAll();
            resolve();
        }, null, { crossOrigin: 'anonymous' }); // Nécessaire si le SVG vient d'un autre domaine
    });
}

/**
 * Redimensionne le canvas Fabric pour remplir son conteneur et réinitialise le zoom/pan.
 */
export function resizeCanvas() {
    const planContainer = document.getElementById('plan-container');
    if (!planContainer || !fabricCanvas) return;

    const containerRect = planContainer.getBoundingClientRect();
    fabricCanvas.setWidth(containerRect.width);
    fabricCanvas.setHeight(containerRect.height);
    fabricCanvas.calcOffset();
     console.log("Canvas redimensionné:", containerRect.width, "x", containerRect.height);

    if (planType !== 'svg_creation') {
        resetZoom(); // Réinitialise le zoom pour adapter le fond
    } else {
        if (isGridVisible) drawGrid(); // Redessine juste la grille si création SVG
        fabricCanvas.renderAll();
    }
}

/**
 * Réinitialise le zoom et la position du plan pour qu'il s'adapte au mieux au canvas.
 */
export function resetZoom() {
    if (planType === 'svg_creation' || !fabricCanvas) {
        fabricCanvas?.setViewportTransform([1, 0, 0, 1, 0, 0]);
         if (isGridVisible) drawGrid();
         fabricCanvas?.renderAll();
        return;
    }

    const bg = fabricCanvas.backgroundImage || fabricCanvas.getObjects().find(o => o.isSvgBackground || o.type === 'group');
    const originalWidth = bg?.originalWidth || bg?.width;
    const originalHeight = bg?.originalHeight || bg?.height;

    if (!bg || !originalWidth || !originalHeight || originalWidth === 0 || originalHeight === 0) {
        console.warn("ResetZoom: Fond ou dimensions originales invalides.", bg);
        fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]); // Fallback
         if (isGridVisible) drawGrid();
         fabricCanvas.renderAll();
        return;
    }

    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();

    // Calculer l'échelle pour adapter le fond au canvas
    const scale = Math.min(canvasWidth / originalWidth, canvasHeight / originalHeight);

    // Réinitialiser le viewport (pas de zoom ni de pan global)
    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    // Appliquer l'échelle au fond et le centrer DANS le viewport réinitialisé
    bg.scale(scale);
    bg.set({
        left: (canvasWidth - originalWidth * scale) / 2,
        top: (canvasHeight - originalHeight * scale) / 2
    });
    bg.setCoords(); // Important après modification manuelle des propriétés

    console.log(`ResetZoom: Fond scalé à ${scale.toFixed(2)}, positionné à (${bg.left.toFixed(0)}, ${bg.top.toFixed(0)})`);

    updateStrokesWidth(1); // Mettre à jour l'épaisseur des traits pour un zoom de 1
    if (isGridVisible) drawGrid();
    fabricCanvas.renderAll();
}


/**
 * Applique un facteur de zoom centré sur un point.
 * @param {number} factor - Facteur de zoom (ex: 1.2 pour zoomer, 0.8 pour dézoomer).
 * @param {fabric.Point} [point] - Le point autour duquel zoomer (centre par défaut).
 */
export function zoom(factor, point) {
    if (!fabricCanvas) return;
    let newZoom = fabricCanvas.getZoom() * factor;
    newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

    const center = point || fabricCanvas.getCenter();
    const fabricPoint = new fabric.Point(center.x, center.y);

    fabricCanvas.zoomToPoint(fabricPoint, newZoom);
     console.log(`Zoom appliqué: ${newZoom.toFixed(2)}`);
}

/**
 * Gère l'événement de la molette pour le zoom.
 * @param {object} opt - Options de l'événement Fabric.
 */
export function handleMouseWheel(opt) {
    const delta = opt.e.deltaY;
    const factor = 0.999 ** delta; // Facteur de zoom basé sur le delta
    zoom(factor, { x: opt.e.offsetX, y: opt.e.offsetY });
    opt.e.preventDefault();
    opt.e.stopPropagation();
}

/**
 * Initialise le panning (déplacement) du canvas.
 * @param {object} opt - Options de l'événement Fabric.
 */
export function startPan(opt) {
    if (opt.e.altKey || opt.e.button === 1) { // Alt+Clic ou Clic molette
        isPanning = true;
        fabricCanvas.defaultCursor = 'grabbing';
        fabricCanvas.setCursor('grabbing');
        lastPosX = opt.e.clientX;
        lastPosY = opt.e.clientY;
        console.log("Démarrage Pan");
        return true; // Indique qu'on a démarré le pan
    }
    return false;
}

/**
 * Continue le panning du canvas.
 * @param {object} opt - Options de l'événement Fabric.
 */
export function handlePanMove(opt) {
    if (isPanning) {
        const delta = new fabric.Point(opt.e.clientX - lastPosX, opt.e.clientY - lastPosY);
        fabricCanvas.relativePan(delta);
        lastPosX = opt.e.clientX;
        lastPosY = opt.e.clientY;
        return true; // Indique qu'on a panné
    }
    return false;
}

/**
 * Termine le panning du canvas.
 */
export function stopPan() {
    if (isPanning) {
        isPanning = false;
        // Restaurer le curseur par défaut (sera défini par setActiveTool)
        fabricCanvas.defaultCursor = fabricCanvas.isDrawingMode ? 'crosshair' : 'default';
        fabricCanvas.setCursor(fabricCanvas.defaultCursor);
         console.log("Fin Pan");
        return true; // Indique qu'on a stoppé le pan
    }
    return false;
}

/**
 * Met à jour l'épaisseur des traits des objets en fonction du zoom.
 * Ignore les tags géo et les lignes de grille pour le calcul de base.
 * Applique un style spécifique aux tags et flèches.
 * @param {number} currentZoom - Le niveau de zoom actuel du canvas.
 */
export function updateStrokesWidth(currentZoom) {
    if (!fabricCanvas) return;
    fabricCanvas.getObjects().forEach(obj => {
        // Objets de dessin normaux
        if (obj.baseStrokeWidth && !obj.customData?.isGeoTag && !obj.isGridLine) {
            obj.set('strokeWidth', obj.baseStrokeWidth / currentZoom);
        }
        // Tags Géo (rectangle intérieur)
        else if (obj.customData?.isGeoTag && obj.item && obj.item(0)) {
            const isActiveSelection = fabricCanvas.getActiveObject() === obj;
            const isHighlighted = obj.opacity < 1 && obj.opacity > 0; // Utilise l'opacité pour détecter le surlignage
            const baseW = (isActiveSelection || isHighlighted) ? 2 : 1;
            obj.item(0).set('strokeWidth', baseW / currentZoom);
        }
        // Flèches des tags géo
        if (obj.customData?.isGeoTag && obj.arrowLine) {
            obj.arrowLine.set('strokeWidth', 2 / currentZoom);
        }
    });
}

// --- Gestion de la Grille et du Magnétisme ---

/** Dessine la grille sur le canvas */
export function drawGrid() {
    removeGrid(); // Nettoie d'abord l'ancienne grille
    if (!isGridVisible || !fabricCanvas || !fabricCanvas.width || !fabricCanvas.height) return;

    const vpt = fabricCanvas.viewportTransform;
    if (!vpt) return; // viewportTransform peut être null initialement

    const zoom = vpt[0];
    if (zoom === 0) return; // Évite division par zéro

    // Calcul des limites visibles dans le système de coordonnées du canvas (non zoomé)
    const topLeft = fabric.util.invertTransform({ x: 0, y: 0 }, vpt);
    const bottomRight = fabric.util.invertTransform({ x: fabricCanvas.width, y: fabricCanvas.height }, vpt);

    const left = topLeft.x;
    const top = topLeft.y;
    const right = bottomRight.x;
    const bottom = bottomRight.y;

    // Détermine les points de départ et de fin pour dessiner les lignes
    const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(top / GRID_SIZE) * GRID_SIZE;
    const endX = Math.ceil(right / GRID_SIZE) * GRID_SIZE;
    const endY = Math.ceil(bottom / GRID_SIZE) * GRID_SIZE;

    const strokeW = 1 / zoom; // Épaisseur de ligne adaptée au zoom

    for (let x = startX; x <= endX; x += GRID_SIZE) {
        gridLines.push(new fabric.Line([x, top, x, bottom], {
            stroke: 'rgba(0,0,0,0.1)',
            strokeWidth: strokeW,
            selectable: false,
            evented: false,
            excludeFromExport: true, // Ne pas inclure dans toSVG/toJSON
            isGridLine: true // Marqueur pour identification facile
        }));
    }
    for (let y = startY; y <= endY; y += GRID_SIZE) {
        gridLines.push(new fabric.Line([left, y, right, y], {
            stroke: 'rgba(0,0,0,0.1)',
            strokeWidth: strokeW,
            selectable: false,
            evented: false,
            excludeFromExport: true,
            isGridLine: true
        }));
    }

    fabricCanvas.add(...gridLines);
    gridLines.forEach(l => l.moveTo(-1)); // Met les lignes de grille en arrière-plan
    // Note: Ne pas appeler renderAll ici, sera fait par la fonction appelante (zoom, resize, etc.)
}

/** Supprime toutes les lignes de la grille du canvas */
export function removeGrid() {
    if (fabricCanvas && gridLines.length > 0) {
        fabricCanvas.remove(...gridLines);
        gridLines = [];
    }
}

/** Active ou désactive la visibilité de la grille */
export function toggleGrid(isVisible) {
    isGridVisible = isVisible;
    if (isGridVisible) {
        drawGrid();
    } else {
        removeGrid();
    }
    fabricCanvas?.renderAll();
}

/** Active ou désactive le magnétisme à la grille */
export function toggleSnap(isEnabled) {
    isSnapEnabled = isEnabled;
}

/** Retourne si le magnétisme est activé */
export function getIsSnapEnabled() {
    return isSnapEnabled;
}

/**
 * Aligne un point sur la grille la plus proche.
 * @param {number} x Coordonnée X.
 * @param {number} y Coordonnée Y.
 * @returns {{x: number, y: number}} Coordonnées alignées.
 */
export function snapToGrid(x, y) {
    return {
        x: snapToGridValue(x, GRID_SIZE),
        y: snapToGridValue(y, GRID_SIZE)
    };
}

/**
 * Aligne un objet Fabric sur la grille.
 * @param {fabric.Object} target L'objet à aligner.
 */
export function snapObjectToGrid(target) {
    if (!target) return;
    target.set({
        left: snapToGridValue(target.left, GRID_SIZE),
        top: snapToGridValue(target.top, GRID_SIZE)
    });
}
