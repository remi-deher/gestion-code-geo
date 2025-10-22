/**
 * Module pour la gestion du canvas Fabric.js, incluant initialisation,
 * chargement des plans (SVG/Image), redimensionnement, zoom, grille, verrouillage,
 * et guides de page.
 */
import { GRID_SIZE } from '../modules/config.js'; // Importe la taille de la grille
import { showToast } from '../modules/utils.js'; // Importe la fonction pour afficher les notifications

let fabricCanvas = null;
let canvasContainer = null;
let canvasElement = null;
let isLocked = false; // État du verrouillage du plan SVG
// L'état de la grille est lu depuis la checkbox
let snapToGrid = false; // État du magnétisme

// --- Dimensions des Pages ---
const PAGE_SIZES = {
    'A4-P': { width: 595, height: 842, viewBox: { x: 0, y: 0, width: 595, height: 842 } },
    'A4-L': { width: 842, height: 595, viewBox: { x: 0, y: 0, width: 842, height: 595 } },
    'A3-P': { width: 842, height: 1191, viewBox: { x: 0, y: 0, width: 842, height: 1191 } },
    'A3-L': { width: 1191, height: 842, viewBox: { x: 0, y: 0, width: 1191, height: 842 } },
    'Original': { width: null, height: null, viewBox: null }
};

// Variables globales pour stocker les dimensions du SVG chargé
let originalSvgWidth = null;
let originalSvgHeight = null;
let originalSvgViewBox = null; // Format attendu: { x: number, y: number, width: number, height: number }
let svgBoundingBox = null; // Bounding box calculée des objets (fallback)

// Références
let svgObjects = [];
let gridLines = [];
let pageGuideRect = null; // Référence au rectangle de guide de page

/**
 * Initialise le canvas Fabric.js.
 * @param {string} canvasId - L'ID de l'élément <canvas> HTML.
 * @returns {fabric.Canvas|null} L'instance du canvas ou null en cas d'erreur.
 */
export function initializeCanvas(canvasId) {
    canvasElement = document.getElementById(canvasId);
    canvasContainer = canvasElement ? canvasElement.parentElement : null;

    if (!canvasElement || !canvasContainer) {
        console.error("Élément canvas ou son conteneur non trouvé.");
        return null;
    }

    try {
        fabricCanvas = new fabric.Canvas(canvasId, {
            width: canvasContainer.clientWidth,
            height: canvasContainer.clientHeight,
            backgroundColor: '#f8f9fa', // Couleur de fond légère
            fireRightClick: true, // Permet de détecter le clic droit
            stopContextMenu: true, // Empêche le menu contextuel natif sur le canvas
            preserveObjectStacking: true // Important pour garder l'ordre des calques
        });

        // Optimisations
        fabricCanvas.renderAndReset = function() {
            this.requestRenderAll();
            return this;
        };

        // Redimensionne le canvas lorsque la fenêtre change de taille
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas(); // Appel initial

        console.log("Canvas Fabric initialisé.");
        return fabricCanvas;

    } catch (error) {
        console.error("Erreur lors de l'initialisation de Fabric.js:", error);
        return null;
    }
}

/** Retourne l'instance du canvas Fabric. */
export function getCanvasInstance() {
    return fabricCanvas;
}

/**
 * Redimensionne le canvas pour remplir son conteneur.
 */
export function resizeCanvas() {
    if (fabricCanvas && canvasContainer) {
        fabricCanvas.setWidth(canvasContainer.clientWidth);
        fabricCanvas.setHeight(canvasContainer.clientHeight);
        fabricCanvas.calcOffset(); // Recalcule la position du canvas sur la page
        fabricCanvas.renderAll(); // Redessine le canvas
        updateGrid(fabricCanvas.getZoom()); // Redessine la grille à la nouvelle taille
    }
}

/**
 * Charge un plan SVG depuis une URL et l'affiche sur le canvas.
 * Les objets SVG sont ajoutés individuellement.
 * @param {string} svgUrl - L'URL du fichier SVG.
 * @returns {Promise<void>}
 */
export async function loadSvgPlan(svgUrl) {
    if (!fabricCanvas) return Promise.reject(new Error("Canvas non initialisé"));
    console.log(`Chargement du plan SVG (objets individuels) depuis ${svgUrl}`);

    try {
        const response = await fetch(svgUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const svgString = await response.text();

        return new Promise((resolve, reject) => {
            fabric.loadSVGFromString(svgString, (objects, options) => {
                if (!fabricCanvas) return reject(new Error("Canvas non prêt après chargement SVG"));
                fabricCanvas.clear(); // Nettoie avant d'ajouter
                svgObjects = []; // Réinitialise la liste des objets SVG

                // --- Stockage des dimensions lues ---
                originalSvgWidth = options.width;
                originalSvgHeight = options.height;
                // Fabric.js parse le viewBox en { x, y, width, height }
                originalSvgViewBox = options.viewBox || null;
                // Stocke sur window pour accès facile depuis main.js
                window.originalSvgWidth = originalSvgWidth;
                window.originalSvgHeight = originalSvgHeight;
                window.originalSvgViewBox = originalSvgViewBox;
                console.log("SVG chargé. Dimensions lues:", { width: originalSvgWidth, height: originalSvgHeight, viewBox: originalSvgViewBox });
                // --- Fin Stockage ---

                // Calcule la bounding box une fois si besoin (fallback pour zoom)
                const tempGroup = fabric.util.groupSVGElements(objects, options);
                svgBoundingBox = tempGroup.getBoundingRect();
                console.log("Bounding Box SVG calculée:", svgBoundingBox);

                // Ajoute les objets SVG au canvas individuellement
                objects.forEach(obj => {
                    obj.isSvgShape = true;
                    obj.customData = { ...obj.customData, svgId: obj.id || null };
                    obj.set({
                        selectable: false,
                        evented: true,
                        hasControls: false,
                        hasBorders: false,
                        lockMovementX: true,
                        lockMovementY: true
                    });
                    fabricCanvas.add(obj);
                    svgObjects.push(obj);
                });

                updateGrid(fabricCanvas.getZoom());
                fabricCanvas.requestRenderAll();
                resetZoom();
                console.log(`${svgObjects.length} objets SVG ajoutés individuellement au canvas.`);
                resolve();
            });
        });

    } catch (error) {
        console.error("Erreur lors du chargement ou parsing SVG:", error);
        showToast(`Erreur chargement plan: ${error.message}`, 'danger');
        resizeCanvas();
        return Promise.reject(error);
    }
}


/**
 * Charge une image de fond sur le canvas.
 * @param {string} imageUrl - L'URL de l'image.
 * @returns {Promise<void>}
 */
export async function loadPlanImage(imageUrl) {
    if (!fabricCanvas) return Promise.reject(new Error("Canvas non initialisé"));
    console.log(`Chargement de l'image de fond depuis ${imageUrl}`);

    return new Promise((resolve, reject) => {
        fabric.Image.fromURL(imageUrl, (img) => {
            if (!fabricCanvas) return reject(new Error("Canvas non prêt après chargement image"));
            fabricCanvas.clear();
            svgObjects = [];

            // Stockage des dimensions lues
            originalSvgWidth = img.width;
            originalSvgHeight = img.height;
            originalSvgViewBox = { x: 0, y: 0, width: img.width, height: img.height }; // Simule un viewBox
            window.originalSvgWidth = originalSvgWidth;
            window.originalSvgHeight = originalSvgHeight;
            window.originalSvgViewBox = originalSvgViewBox;
            svgBoundingBox = { left: 0, top: 0, width: img.width, height: img.height };
            console.log("Image chargée. Dimensions:", { width: originalSvgWidth, height: originalSvgHeight });

            img.set({
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
                hasControls: false,
                hasBorders: false
            });

            fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {});

            updateGrid(fabricCanvas.getZoom());
            resetZoom();
            resolve();
        }, { crossOrigin: 'anonymous' });
    });
}


/**
 * Ajuste le zoom et le pan pour afficher le plan entier.
 * MODIFIÉ pour aligner en haut à gauche avec padding, au lieu de centrer.
 */
export function resetZoom() {
    if (!fabricCanvas || !canvasContainer) return;

    const containerWidth = canvasContainer.clientWidth;
    const containerHeight = canvasContainer.clientHeight;

    // --- CORRECTION : Ajout d'un padding pour l'alignement ---
    const padding = 20; // Espace (en pixels) entre le bord du canvas et le plan

    let planWidth = containerWidth;  // Fallback
    let planHeight = containerHeight; // Fallback
    let planOffsetX = 0; // Décalage X du viewBox/BBox
    let planOffsetY = 0; // Décalage Y du viewBox/BBox

    // Priorité au viewBox si disponible et valide
    if (originalSvgViewBox && originalSvgViewBox.width > 0 && originalSvgViewBox.height > 0) {
        planWidth = originalSvgViewBox.width;
        planHeight = originalSvgViewBox.height;
        planOffsetX = originalSvgViewBox.x || 0;
        planOffsetY = originalSvgViewBox.y || 0;
        console.log(`ResetZoom: Utilisation des dimensions du viewBox: ${planWidth}x${planHeight} (offset: ${planOffsetX},${planOffsetY})`);
    }
    // Sinon, utiliser width/height si disponibles
    else if (originalSvgWidth > 0 && originalSvgHeight > 0) {
        planWidth = originalSvgWidth;
        planHeight = originalSvgHeight;
        console.log(`ResetZoom: Utilisation des dimensions width/height: ${planWidth}x${planHeight}`);
    }
    // En dernier recours, utiliser la bounding box calculée
    else if (svgBoundingBox && svgBoundingBox.width > 0 && svgBoundingBox.height > 0) {
        planWidth = svgBoundingBox.width;
        planHeight = svgBoundingBox.height;
        planOffsetX = svgBoundingBox.left; // Utilise le coin haut/gauche de la BBox comme offset
        planOffsetY = svgBoundingBox.top;
        console.warn(`ResetZoom: Utilisation de la bounding box calculée: ${planWidth}x${planHeight} (offset: ${planOffsetX},${planOffsetY})`);
    } else {
        console.warn("ResetZoom: Aucune dimension de plan valide trouvée, utilisation des dimensions du conteneur.");
    }

    // Calcul du scale pour faire rentrer le plan dans le conteneur (en comptant le padding)
    const scaleX = (containerWidth - padding * 2) / planWidth;
    const scaleY = (containerHeight - padding * 2) / planHeight;
    const scale = Math.min(scaleX, scaleY);

    // --- CORRECTION : Calcul du Pan (vpt[4] et vpt[5]) ---
    // On veut que le point (planOffsetX, planOffsetY) du plan
    // se retrouve au point (padding, padding) de l'écran.
    // L'équation est : (point_plan_X * scale) + panX = point_ecran_X
    // Donc : (planOffsetX * scale) + vpt[4] = padding
    // vpt[4] = padding - (planOffsetX * scale)

    const panX = padding - (planOffsetX * scale);
    const panY = padding - (planOffsetY * scale);

    fabricCanvas.setViewportTransform([scale, 0, 0, scale, panX, panY]);
    // --- FIN CORRECTION ---

    console.log(`ResetZoom: Viewport ajusté. Scale: ${scale.toFixed(3)}, Pan: (${panX.toFixed(1)}, ${panY.toFixed(1)})`);

    // Met à jour grille et traits
    updateGrid(scale);
    updateStrokesWidth(scale);
    fabricCanvas.requestRenderAll();
}

/**
 * Zoom/Dézoom le canvas sur un point donné ou sur le centre.
 * @param {number} factor - Facteur de zoom (> 1 pour zoomer, < 1 pour dézoomer).
 * @param {fabric.Point} [point] - Point sur lequel zoomer (par défaut: centre de la vue).
 */
export function zoomCanvas(factor, point = null) {
    if (!fabricCanvas) return;
    const currentZoom = fabricCanvas.getZoom();
    let newZoom = currentZoom * factor;

    // Limites de zoom (optionnel)
    const minZoom = 0.05;
    const maxZoom = 20;
    if (newZoom < minZoom) newZoom = minZoom;
    if (newZoom > maxZoom) newZoom = maxZoom;

    if (newZoom === currentZoom) return; // Pas de changement

    // Si aucun point n'est spécifié, zoome sur le centre de la vue actuelle
    if (!point) {
        point = fabricCanvas.getVpCenter();
    }

    fabricCanvas.zoomToPoint(point, newZoom);
    // Les événements viewport:transformed gèrent la mise à jour de la grille/traits
}


/**
 * Verrouille ou déverrouille les éléments SVG du plan.
 * @param {boolean} lock - True pour verrouiller, false pour déverrouiller.
 */
export function setCanvasLock(lock) {
    isLocked = lock;
    console.log("Verrouillage SVG:", isLocked);
    svgObjects.forEach(obj => {
        obj.set({
            selectable: !isLocked,
            lockMovementX: isLocked,
            lockMovementY: isLocked,
            hasControls: !isLocked,
            hasBorders: !isLocked,
            evented: true,
        });
    });

    if (isLocked) {
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj && activeObj.isSvgShape) {
            fabricCanvas.discardActiveObject();
        }
    }
    fabricCanvas.requestRenderAll();
}

/** Retourne l'état actuel du verrouillage SVG. */
export function getCanvasLock() {
    return isLocked;
}

/** Active/Désactive l'affichage de la grille (via updateGrid). */
export function toggleGridDisplay(show) {
    const gridToggleCheckbox = document.getElementById('grid-toggle');
    if(gridToggleCheckbox) gridToggleCheckbox.checked = show;
    updateGrid(fabricCanvas.getZoom()); // Appelle la mise à jour
}

/** Active/Désactive le magnétisme à la grille. */
export function toggleSnapToGrid(snap) {
    // Si l'argument 'snap' est un événement, lire la valeur de la checkbox
    if (snap instanceof Event && snap.target) {
        snapToGrid = snap.target.checked;
    } else if (typeof snap === 'boolean') { // Sinon, utiliser la valeur booléenne passée
        snapToGrid = snap;
    }
    console.log("Magnétisme grille:", snapToGrid);
    // Mettre à jour l'état de la checkbox si elle existe
    const snapToggleCheckbox = document.getElementById('snap-toggle');
    if (snapToggleCheckbox) {
        snapToggleCheckbox.checked = snapToGrid;
    }
}

/** Retourne l'état actuel du magnétisme. */
export function getSnapToGrid() {
    // Lit l'état actuel de la checkbox si elle existe, sinon utilise la variable
    const snapToggleCheckbox = document.getElementById('snap-toggle');
    if (snapToggleCheckbox) {
        snapToGrid = snapToggleCheckbox.checked;
    }
    return snapToGrid;
}

/**
 * Met à jour (recrée) la grille visuelle en fonction du zoom.
 * @param {number} zoom - Le niveau de zoom actuel.
 */
export function updateGrid(zoom) {
    if (!fabricCanvas || !canvasContainer) return;

    // Supprime les anciennes lignes
    gridLines.forEach(line => fabricCanvas.remove(line));
    gridLines = [];

    // --- CORRECTION : Lire l'état de la checkbox ---
    const gridToggleCheckbox = document.getElementById('grid-toggle');
    // Lit l'état actuel de la case. Si elle n'existe pas, 'false' par défaut.
    const showGrid = gridToggleCheckbox ? gridToggleCheckbox.checked : false;
    // --- FIN CORRECTION ---

    // Ne rien dessiner si la case est décochée
    if (!showGrid) {
        fabricCanvas.requestRenderAll();
        return;
    }

    const gridSize = GRID_SIZE || 10;
    const width = fabricCanvas.getWidth();
    const height = fabricCanvas.getHeight();

    let apparentGridSize = gridSize * zoom;
    let gridSpacing = gridSize;

    // Ajuste l'espacement pour garder la grille lisible
    while (apparentGridSize < 15 && gridSpacing < 10000) {
        gridSpacing *= 5;
        apparentGridSize *= 5;
    }
     while (apparentGridSize > 75 && gridSpacing > 1) {
        gridSpacing /= 5;
        apparentGridSize /= 5;
    }

    const strokeColor = '#ced4da';
    const strokeWidth = 1 / zoom;

    const vpt = fabricCanvas.viewportTransform;
    const panX = vpt[4];
    const panY = vpt[5];

    // Limites visibles du canvas
    const startX = -panX / zoom;
    const startY = -panY / zoom;
    const endX = startX + width / zoom;
    const endY = startY + height / zoom;

    const firstGridX = Math.ceil(startX / gridSpacing) * gridSpacing;
    const firstGridY = Math.ceil(startY / gridSpacing) * gridSpacing;

    for (let x = firstGridX; x <= endX; x += gridSpacing) {
        const line = new fabric.Line([x, startY, x, endY], {
            stroke: strokeColor, strokeWidth: strokeWidth,
            selectable: false, evented: false,
            isGridLine: true, visible: true
        });
        fabricCanvas.add(line);
        gridLines.push(line);
    }
    for (let y = firstGridY; y <= endY; y += gridSpacing) {
        const line = new fabric.Line([startX, y, endX, y], {
            stroke: strokeColor, strokeWidth: strokeWidth,
            selectable: false, evented: false,
            isGridLine: true, visible: true
        });
        fabricCanvas.add(line);
        gridLines.push(line);
    }

    gridLines.forEach(line => line.sendToBack());
    fabricCanvas.requestRenderAll();
}


/**
 * Met à jour l'épaisseur des traits des objets en fonction du zoom.
 * @param {number} zoom - Le niveau de zoom actuel.
 */
export function updateStrokesWidth(zoom) {
    if (!fabricCanvas) return;
    fabricCanvas.getObjects().forEach(obj => {
        if (obj.baseStrokeWidth && obj.type !== 'i-text' && obj.type !== 'text' && !obj.isGridLine) {
            obj.set('strokeWidth', obj.baseStrokeWidth / zoom);
        }
    });
}

/**
 * Trouve une forme SVG spécifique par son ID SVG.
 * @param {string} svgId - L'ID de l'élément SVG recherché.
 * @returns {fabric.Object|null} L'objet Fabric correspondant ou null.
 */
export function findSvgShapeByCodeGeo(svgId) {
    if (!svgId) return null;
    return svgObjects.find(obj => obj.customData?.svgId === svgId) || null;
}

/**
 * Exporte les dimensions originales du plan (viewBox ou width/height).
 * Utilisé par main.js pour la sauvegarde SVG.
 * @returns {object} { width, height, viewBox }
 */
export function getOriginalPlanDimensions() {
     return {
         width: originalSvgWidth,
         height: originalSvgHeight,
         viewBox: originalSvgViewBox
     };
}

/**
 * Dessine un rectangle en pointillés représentant le format de page sélectionné.
 * @param {string} format - La clé du format (ex: 'A4_Portrait') depuis PAGE_SIZES.
 */
export function drawPageGuides(format) {
    if (!fabricCanvas) return;
    
    // --- Logs de débogage ---
    // console.log(`--- Début drawPageGuides ---`);
    // console.log(`Format reçu: "${format}" (Type: ${typeof format})`);
    // console.log(`PAGE_SIZES est défini:`, typeof PAGE_SIZES !== 'undefined');
    // console.log(`Clés de PAGE_SIZES:`, Object.keys(PAGE_SIZES));
    // console.log(`Tentative d'accès PAGE_SIZES["${format}"]:`, PAGE_SIZES[format]);
    // --- Fin Logs ---

    // Supprime l'ancien guide s'il existe
    if (pageGuideRect) {
        fabricCanvas.remove(pageGuideRect);
        pageGuideRect = null;
    }

    const isOriginal = (format === 'Original');
    const formatData = PAGE_SIZES[format]; 
    const hasValidFormatData = !!formatData;
    const hasViewBox = hasValidFormatData && !!formatData.viewBox;

    // Condition décomposée
    if (isOriginal || !hasValidFormatData || !hasViewBox) {
        fabricCanvas.requestRenderAll();
        // console.log("Guides de page désactivés (Original ou format invalide).");
        return; // <= C'est ici que ça sortait si les clés ne correspondaient pas
    }

    // --- LE CODE DE DESSIN EST ATTEINT ---
    const sizeInfo = PAGE_SIZES[format];
    const viewBox = sizeInfo.viewBox;
    const zoom = fabricCanvas.getZoom();

    console.log(`Dessin du guide pour ${format}:`, sizeInfo); // <= Ce log devrait maintenant apparaître

    // Style de production (discret)
    pageGuideRect = new fabric.Rect({
        left: viewBox.x,
        top: viewBox.y,
        width: viewBox.width,
        height: viewBox.height,
        fill: 'transparent',
        stroke: '#adb5bd', // Gris
        strokeWidth: 1 / zoom,
        baseStrokeWidth: 1,
        strokeDashArray: [5 / zoom, 5 / zoom], // Pointillés
        selectable: false,
        evented: false,
        isPageGuide: true
    });

    fabricCanvas.add(pageGuideRect);
    console.log("Guide ajouté au canvas:", pageGuideRect);

    // Envoie le guide à l'arrière-plan (juste au-dessus du fond, mais derrière les objets)
    pageGuideRect.sendToBack();

    fabricCanvas.requestRenderAll();
    console.log("Rendu demandé après ajout/mise à jour du guide.");
}
