/**
 * Module pour la gestion du canvas Fabric.js, incluant initialisation,
 * chargement des plans (SVG/Image), redimensionnement, zoom, grille, verrouillage,
 * et guides de page.
 *
 * ARCHITECTURE CORRIGÉE (2024-05-27) :
 * 1. Le canvas Fabric (physique) remplit son conteneur (#plan-container) et a une TAILLE DYNAMIQUE.
 * 2. Le "monde" ou "contenu" a une TAILLE LOGIQUE FIXE (ex: A4, A3) définie par 'currentCanvasFormat'.
 * 3. resetZoom() centre le "contenu logique" (le guide A4/A3) à l'intérieur du "canvas physique" (le conteneur).
 */
import {
    GRID_SIZE
} from '../modules/config.js'; // Importe la taille de la grille
import {
    showToast
} from '../modules/utils.js'; // Importe la fonction pour afficher les notifications

let fabricCanvas = null;
let canvasContainer = null; // C'est #plan-container
let canvasElement = null;
let isLocked = false; // État du verrouillage du plan SVG
let snapToGrid = false; // État du magnétisme

// --- Dimensions des Pages (Référentiel LOGIQUE) ---
export const PAGE_SIZES = {
    'A4-P': {
        width: 595,
        height: 842,
        viewBox: {
            x: 0,
            y: 0,
            width: 595,
            height: 842
        }
    },
    'A4-L': {
        width: 842,
        height: 595,
        viewBox: {
            x: 0,
            y: 0,
            width: 842,
            height: 595
        }
    },
    'A3-P': {
        width: 842,
        height: 1191,
        viewBox: {
            x: 0,
            y: 0,
            width: 842,
            height: 1191
        }
    },
    'A3-L': {
        width: 1191,
        height: 842,
        viewBox: {
            x: 0,
            y: 0,
            width: 1191,
            height: 842
        }
    },
    'Original': {
        width: null,
        height: null,
        viewBox: null
    }
};

// --- Format logique par défaut ---
let currentCanvasFormat = PAGE_SIZES['A4-L'];

// Variables
let svgObjects = []; // Obsolète si on utilise le groupe, mais gardé pour référence
let gridLines = [];
let pageGuideRect = null; // Référence au rectangle de guide de page

// --- Debounce timer for resize ---
let resizeTimeout = null;


/**
 * Initialise le canvas Fabric.js pour qu'il REMPLISSE son conteneur.
 * @param {string} canvasId - L'ID de l'élément <canvas> HTML.
 * @param {string} [initialFormat='A4-L'] - Le format de page LOGIQUE initial (clé de PAGE_SIZES).
 * @returns {fabric.Canvas|null} L'instance du canvas ou null en cas d'erreur.
 */
export function initializeCanvas(canvasId, initialFormat = 'A4-L') {
    canvasElement = document.getElementById(canvasId);
    // MODIFIÉ : canvasContainer est le parent, #plan-container
    canvasContainer = canvasElement ? canvasElement.parentElement : null;

    if (!canvasElement || !canvasContainer) {
        console.error("Élément canvas ou son conteneur non trouvé.");
        return null;
    }

    currentCanvasFormat = PAGE_SIZES[initialFormat] || PAGE_SIZES['A4-L'];

    // NOUVEAU: Obtenir la taille du conteneur pour dimensionner le canvas
    const containerRect = canvasContainer.getBoundingClientRect();

    try {
        fabricCanvas = new fabric.Canvas(canvasId, {
            width: containerRect.width > 0 ? containerRect.width : 800,  // <-- DYNAMIQUE
            height: containerRect.height > 0 ? containerRect.height : 600, // <-- DYNAMIQUE
            backgroundColor: '#f8f9fa',
            fireRightClick: true,
            stopContextMenu: true,
            preserveObjectStacking: true
        });

        fabricCanvas.renderAndReset = function() {
            this.requestRenderAll();
            return this;
        };

        // Définit le référentiel logique global (la "feuille")
        window.originalSvgWidth = currentCanvasFormat.width;
        window.originalSvgHeight = currentCanvasFormat.height;
        window.originalSvgViewBox = currentCanvasFormat.viewBox;

        window.addEventListener('resize', handleResize);

        // Pas d'appel à drawPageGuides ici, resetZoom s'en chargera
        console.log(`Canvas Fabric initialisé (Dynamique: ${containerRect.width}x${containerRect.height}). Format logique: ${initialFormat}`);
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
 * Gère l'événement resize de la fenêtre avec un debounce.
 */
function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        console.log("Debounced resize triggered (handleResize).");
        _performResizeActions();
    }, 250); // Délai debounce
}


/**
 * Logique réelle de redimensionnement (appelée par handleResize).
 * Met à jour la taille du canvas Fabric et recentre le contenu.
 */
function _performResizeActions() {
    if (fabricCanvas && canvasContainer) {
        console.log("Executing _performResizeActions...");

        // NOUVEAU: Redimensionner le canvas Fabric pour remplir le conteneur
        const containerRect = canvasContainer.getBoundingClientRect();
        if (containerRect.width > 0 && containerRect.height > 0) {
            fabricCanvas.setWidth(containerRect.width);
            fabricCanvas.setHeight(containerRect.height);
        } else {
            console.warn("_performResizeActions: Container size is zero, skipping resize.");
            return;
        }

        // MAINTENANT on appelle resetZoom pour recentrer le contenu (le guide)
        // dans le canvas redimensionné.
        resetZoom(); // <-- APPEL ESSENTIEL

        fabricCanvas.calcOffset(); // Recalcule l'offset après redimensionnement
        fabricCanvas.requestRenderAll();
    } else {
        console.log("_performResizeActions skipped: canvas or container not ready.");
    }
}

/**
 * Fonction exportée pour déclencher manuellement un redimensionnement/recentrage.
 */
export function resizeCanvas() {
    _performResizeActions();
}


/**
 * Charge un plan SVG.
 * Centre et redimensionne le SVG pour s'adapter au FORMAT LOGIQUE courant (ex: A4).
 * @param {string} svgUrl - L'URL du fichier SVG.
 * @returns {Promise<void>}
 */
export async function loadSvgPlan(svgUrl) {
    if (!fabricCanvas) return Promise.reject(new Error("Canvas non initialisé"));
    console.log(`Chargement du plan SVG (en tant que groupe) depuis ${svgUrl}`);

    try {
        const response = await fetch(svgUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const svgString = await response.text();

        return new Promise((resolve, reject) => {
            fabric.loadSVGFromString(svgString, (objects, options) => {
                    if (!fabricCanvas) return reject(new Error("Canvas non prêt après chargement SVG"));

                    // Nettoyage
                    fabricCanvas.clear();
                    fabricCanvas.backgroundColor = '#f8f9fa';
                    svgObjects = [];
                    gridLines = []; // Grille sera recréée par resetZoom
                    pageGuideRect = null; // Guide sera recréé par resetZoom

                    if (!objects || objects.length === 0) {
                        console.warn("Le SVG chargé est vide ou ne contient pas d'objets reconnus.");
                        return resolve();
                    }

                    // Détermination des dimensions SVG (logique inchangée)
                    // ... (calcul de minX, minY, maxX, maxY) ...
                    // ... (calcul de svgWidth, svgHeight) ...
                    
                    // --- Logique de dimensionnement SVG (INCHANGÉE MAIS CRUCIALE) ---
                    // Cette logique calcule la taille du SVG chargé
                    const originalSvgWidth = options.width;
                    const originalSvgHeight = options.height;
                    const originalSvgViewBox = options.viewBox || null;
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    objects.forEach(obj => {
                        if (obj && obj.left !== undefined && obj.top !== undefined && obj.width !== undefined && obj.height !== undefined) {
                            let left = obj.left || 0;
                            let top = obj.top || 0;
                            let width = obj.width || 0;
                            let height = obj.height || 0;
                            let scaleX = obj.scaleX || 1;
                            let scaleY = obj.scaleY || 1;
                            let originX = obj.originX || 'left';
                            let originY = obj.originY || 'top';
                            let objLeft = left - (originX === 'center' ? (width * scaleX / 2) : (originX === 'right' ? width * scaleX : 0));
                            let objTop = top - (originY === 'center' ? (height * scaleY / 2) : (originY === 'bottom' ? height * scaleY : 0));
                            let objRight = objLeft + width * scaleX;
                            let objBottom = objTop + height * scaleY;
                            minX = Math.min(minX, objLeft);
                            minY = Math.min(minY, objTop);
                            maxX = Math.max(maxX, objRight);
                            maxY = Math.max(maxY, objBottom);
                        }
                    });
                    const calculatedWidth = (maxX > minX && isFinite(minX) && isFinite(maxX)) ? maxX - minX : options.width;
                    const calculatedHeight = (maxY > minY && isFinite(minY) && isFinite(maxY)) ? maxY - minY : options.height;
                    const svgWidth = originalSvgViewBox?.width || originalSvgWidth || calculatedWidth;
                    const svgHeight = originalSvgViewBox?.height || originalSvgHeight || calculatedHeight;
                    // --- Fin Logique dimensionnement SVG ---


                    if (!svgWidth || !svgHeight || svgWidth <= 0 || svgHeight <= 0 || !isFinite(svgWidth) || !isFinite(svgHeight)) {
                        console.error("Impossible de déterminer des dimensions valides pour le SVG chargé.", { svgWidth, svgHeight, options });
                        return reject(new Error("Dimensions du SVG non reconnues ou invalides."));
                    }

                    // Dimensions du Canvas LOGIQUE (la "feuille" A4/A3)
                    const canvasWidth = currentCanvasFormat.width;
                    const canvasHeight = currentCanvasFormat.height;

                    // Calcul pour centrer/fitter le SVG dans le Canvas LOGIQUE (A4/A3)
                    const padding = 20;
                    const safeCanvasWidth = canvasWidth - padding * 2;
                    const safeCanvasHeight = canvasHeight - padding * 2;
                    const scaleX = safeCanvasWidth > 0 ? safeCanvasWidth / svgWidth : 1;
                    const scaleY = safeCanvasHeight > 0 ? safeCanvasHeight / svgHeight : 1;
                    const scale = Math.min(scaleX, scaleY);
                    const finalSvgWidth = svgWidth * scale;
                    const finalSvgHeight = svgHeight * scale;
                    // Positionnement par rapport au MONDE LOGIQUE (0,0)
                    const left = (canvasWidth - finalSvgWidth) / 2;
                    const top = (canvasHeight - finalSvgHeight) / 2;

                    // Applique les propriétés aux objets
                    objects.forEach(obj => {
                        if (!obj) return;
                        obj.isSvgShape = true;
                        obj.customData = { ...obj.customData, svgId: obj.id || null };
                        obj.set({ selectable: !isLocked, hasControls: !isLocked, hasBorders: !isLocked, lockMovementX: isLocked, lockMovementY: isLocked, evented: true });
                        svgObjects.push(obj); // (svgObjects n'est plus vraiment utilisé, mais on le garde)
                    });

                    // Créer un groupe pour le plan
                    const planGroup = new fabric.Group(objects.filter(obj => !!obj), {
                        left: left,
                        top: top,
                        scaleX: scale,
                        scaleY: scale,
                        originX: 'left',
                        originY: 'top',
                        selectable: false,
                        evented: true,
                        isPlanBackground: true,
                        subTargetCheck: true, // Pour la sélection des enfants
                    });

                    fabricCanvas.add(planGroup);
                    planGroup.sendToBack(); // Le guide et la grille passeront devant lors du resetZoom

                    // MODIFIÉ: Ne pas appeler updateGrid/drawPageGuides ici.
                    // resetZoom() le fera.
                    fabricCanvas.requestRenderAll();
                    console.log(`${svgObjects.length} objets SVG ajoutés (groupés) au canvas.`);
                    resolve();
                },
                null, { crossOrigin: 'anonymous' }
            );
        });

    } catch (error) {
        console.error("Erreur lors du chargement ou parsing SVG:", error);
        showToast(`Erreur chargement plan: ${error.message}`, 'danger');
        if (fabricCanvas) {
            fabricCanvas.clear();
            fabricCanvas.backgroundColor = '#f8f9fa';
            svgObjects = [];
            gridLines = [];
        }
        return Promise.reject(error);
    }
}


/**
 * Charge une image comme objet centré/redimensionné dans le MONDE LOGIQUE.
 * @param {string} imageUrl - L'URL de l'image.
 * @returns {Promise<void>}
 */
export async function loadPlanImage(imageUrl) {
    if (!fabricCanvas) return Promise.reject(new Error("Canvas non initialisé"));
    console.log(`Chargement de l'image (objet) depuis ${imageUrl}`);

    return new Promise((resolve, reject) => {
        fabric.Image.fromURL(imageUrl, (img, isError) => {
            if (isError || !img) {
                console.error("Erreur lors du chargement de l'image depuis l'URL:", imageUrl);
                showToast("Erreur chargement image", 'danger');
                if (fabricCanvas) {
                    fabricCanvas.clear();
                    fabricCanvas.backgroundColor = '#f8f9fa';
                    svgObjects = [];
                    gridLines = [];
                }
                return reject(new Error("Erreur chargement image"));
            }
            if (!fabricCanvas) return reject(new Error("Canvas non prêt après chargement image"));

            // Nettoyage
            fabricCanvas.clear();
            fabricCanvas.backgroundColor = '#f8f9fa';
            svgObjects = [];
            gridLines = [];
            pageGuideRect = null;

            // Dimensions image
            const imgWidth = img.width;
            const imgHeight = img.height;
            if (!imgWidth || !imgHeight || imgWidth <= 0 || imgHeight <= 0) {
                console.error("Dimensions de l'image invalides.", { imgWidth, imgHeight });
                return reject(new Error("Dimensions de l'image invalides."));
            }

            // Dimensions Canvas LOGIQUE (A4/A3)
            const canvasWidth = currentCanvasFormat.width;
            const canvasHeight = currentCanvasFormat.height;

            // Calcul centrer/fitter dans le MONDE LOGIQUE
            const padding = 20;
            const safeCanvasWidth = canvasWidth - padding * 2;
            const safeCanvasHeight = canvasHeight - padding * 2;
            const scaleX = safeCanvasWidth > 0 ? safeCanvasWidth / imgWidth : 1;
            const scaleY = safeCanvasHeight > 0 ? safeCanvasHeight / imgHeight : 1;
            const scale = Math.min(scaleX, scaleY);
            const finalImgWidth = imgWidth * scale;
            const finalImgHeight = imgHeight * scale;
            const left = (canvasWidth - finalImgWidth) / 2;
            const top = (canvasHeight - finalImgHeight) / 2;

            img.set({
                left: left,
                top: top,
                scaleX: scale,
                scaleY: scale,
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
                hasControls: false,
                hasBorders: false,
                isPlanBackground: true
            });

            fabricCanvas.add(img);
            img.sendToBack();

            // MODIFIÉ: Ne pas appeler updateGrid/drawPageGuides ici.
            // resetZoom() le fera.
            fabricCanvas.requestRenderAll();
            console.log(`Image chargée (objet). Dimensions originales: ${imgWidth}x${imgHeight}, Affichée à l'échelle: ${scale.toFixed(3)}`);
            resolve();
        }, { crossOrigin: 'anonymous' });
    });
}


/**
 * Ajuste le zoom/pan pour afficher le CONTENU LOGIQUE (ex: A4) entier,
 * centré dans le CANVAS PHYSIQUE (qui remplit le conteneur).
 */
export function resetZoom() {
    if (!fabricCanvas || !canvasContainer) {
        console.warn("resetZoom skipped: canvas or container not ready.");
        return;
    }

    // Dimensions du CANVAS PHYSIQUE (remplit le conteneur)
    const containerWidth = fabricCanvas.getWidth();
    const containerHeight = fabricCanvas.getHeight();
    const padding = 20; // Marge visuelle autour du contenu

    // Dimensions du CONTENU LOGIQUE (la "feuille" A4/A3)
    let contentWidth = currentCanvasFormat.width;
    let contentHeight = currentCanvasFormat.height;

    if (!contentWidth || !contentHeight) {
        console.warn("resetZoom skipped: Invalid logical content dimensions.");
        // Assurons-nous que le guide est retiré s'il n'est pas valide
        if (pageGuideRect) {
            fabricCanvas.remove(pageGuideRect);
            pageGuideRect = null;
        }
        return;
    }

    console.log(`ResetZoom - Canvas(Container): ${containerWidth}x${containerHeight}, Content(Guide): ${contentWidth}x${contentHeight}`);

    // Vérification des dimensions (pour éviter division par zéro)
    if (containerWidth <= padding * 2 || containerHeight <= padding * 2 || contentWidth <= 0 || contentHeight <= 0) {
        console.warn(`ResetZoom skipped: Container or content dimensions invalid.`);
        fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]); // Reset simple
    } else {
        // Calcul du zoom
        const scaleX = (containerWidth - padding * 2) / contentWidth;
        const scaleY = (containerHeight - padding * 2) / contentHeight;
        const scale = Math.min(scaleX, scaleY);

        if (scale <= 0 || !isFinite(scale)) {
            console.warn("ResetZoom: Calculated scale is invalid, applying default viewport.", { scale });
            fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        } else {
            // Calcul du pan (décalage) pour centrer le contenu
            const panX = (containerWidth - (contentWidth * scale)) / 2;
            const panY = (containerHeight - (contentHeight * scale)) / 2;

            // Appliquer la transformation
            fabricCanvas.setViewportTransform([scale, 0, 0, scale, panX, panY]);
            console.log(`ResetZoom: Viewport adjusted. Scale: ${scale.toFixed(3)}, Pan: (${panX.toFixed(1)}, ${panY.toFixed(1)})`);
        }
    }

    // Mettre à jour les éléments visuels après le changement de viewport
    const finalZoom = fabricCanvas.getZoom();
    updateGrid(finalZoom); // La grille dépend du zoom et du format logique
    updateStrokesWidth(finalZoom); // L'épaisseur des traits dépend du zoom
    
    // Redessine le guide avec le bon zoom
    const currentFormatKey = Object.keys(PAGE_SIZES).find(key => PAGE_SIZES[key] === currentCanvasFormat) || 'A4-L';
    drawPageGuides(currentFormatKey);

    fabricCanvas.requestRenderAll();
}


/**
 * Zoom/Dézoom le canvas sur un point donné ou sur le centre.
 */
export function zoomCanvas(factor, point = null) {
    if (!fabricCanvas) return;
    const currentZoom = fabricCanvas.getZoom();
    let newZoom = currentZoom * factor;
    
    // TODO: Le zoom min devrait être relatif au zoom de 'resetZoom'
    const minZoom = 0.05;
    const maxZoom = 20;
    
    newZoom = Math.max(minZoom, Math.min(newZoom, maxZoom));
    if (newZoom === currentZoom) return;
    
    if (!point) {
        point = fabricCanvas.getVpCenter();
    }
    
    fabricCanvas.zoomToPoint(point, newZoom);
    
    // Mettre à jour les éléments visuels
    updateGrid(newZoom);
    updateStrokesWidth(newZoom);
    
    const currentFormatKey = Object.keys(PAGE_SIZES).find(key => PAGE_SIZES[key] === currentCanvasFormat) || 'A4-L';
    drawPageGuides(currentFormatKey); // Redessine le guide avec le bon zoom

    fabricCanvas.requestRenderAll();
}

/**
 * Verrouille ou déverrouille les éléments SVG du plan.
 * (Fonction inchangée, elle agit sur les objets, pas sur le viewport)
 */
export function setCanvasLock(lock) {
    isLocked = lock;
    console.log("Verrouillage SVG:", isLocked);
    const planGroup = fabricCanvas.getObjects().find(o => o.isPlanBackground);

    if (planGroup && planGroup.type === 'group') {
        console.log(`setCanvasLock: Application des propriétés (selectable=${!isLocked}) aux ${planGroup.size()} objets du groupe.`);
        planGroup._objects.forEach(obj => {
            if (obj && typeof obj.set === 'function') {
                obj.set({
                    selectable: !isLocked,
                    lockMovementX: isLocked,
                    lockMovementY: isLocked,
                    hasControls: !isLocked,
                    hasBorders: !isLocked,
                    evented: true
                });
                obj.setCoords();
            } else {
                console.warn("Objet non valide trouvé dans planGroup._objects:", obj);
            }
        });
        planGroup.setCoords();
    } else if (planGroup && planGroup.type === 'image') {
        planGroup.set({ selectable: false, evented: false });
    } else {
        console.log("setCanvasLock: Aucun groupe de plan trouvé à (dé)verrouiller.");
    }

    if (isLocked) {
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj && planGroup && planGroup.type === 'group' && planGroup.contains(activeObj, true)) {
            console.log("Désélection de l'objet actif car verrouillage.");
            fabricCanvas.discardActiveObject();
        }
    }
    fabricCanvas.requestRenderAll();
}


/** Retourne l'état actuel du verrouillage SVG. (Inchangé) */
export function getCanvasLock() {
    return isLocked;
}

/** Active/Désactive l'affichage de la grille. (Inchangé) */
export function toggleGridDisplay(show) {
    const gridToggleCheckbox = document.getElementById('grid-toggle');
    if (gridToggleCheckbox) gridToggleCheckbox.checked = show;
    updateGrid(fabricCanvas.getZoom());
}

/** Active/Désactive le magnétisme à la grille. (Inchangé) */
export function toggleSnapToGrid(snap) {
    if (snap instanceof Event && snap.target && typeof snap.target.checked === 'boolean') {
        snapToGrid = snap.target.checked;
    } else if (typeof snap === 'boolean') {
        snapToGrid = snap;
    } else {
        console.warn("toggleSnapToGrid appelé avec un argument invalide:", snap);
    }
    console.log("Magnétisme grille:", snapToGrid);
    const snapToggleCheckbox = document.getElementById('snap-toggle');
    if (snapToggleCheckbox) {
        snapToggleCheckbox.checked = snapToGrid;
    }
}

/** Retourne l'état actuel du magnétisme. (Inchangé) */
export function getSnapToGrid() {
    const snapToggleCheckbox = document.getElementById('snap-toggle');
    if (snapToggleCheckbox) {
        snapToGrid = snapToggleCheckbox.checked;
    }
    return snapToGrid;
}

/**
 * Met à jour (recrée) la grille visuelle en fonction du zoom.
 * La grille est dessinée dans le système de coordonnées LOGIQUE (A4/A3).
 */
export function updateGrid(zoom) {
    if (!fabricCanvas) return;
    gridLines.forEach(line => fabricCanvas.remove(line));
    gridLines = [];
    
    const gridToggleCheckbox = document.getElementById('grid-toggle');
    const showGrid = gridToggleCheckbox ? gridToggleCheckbox.checked : false;
    if (!showGrid) {
        fabricCanvas.requestRenderAll();
        return;
    }
    
    const gridSize = GRID_SIZE || 10;
    
    // MODIFIÉ : La grille couvre le monde logique, pas le canvas physique
    const width = currentCanvasFormat.width;
    const height = currentCanvasFormat.height;
    
    if (!width || !height) return; // Pas de format logique, pas de grille

    const currentZoom = zoom > 0 ? zoom : 1;
    let apparentGridSizeOnScreen = gridSize * currentZoom;
    let gridSpacing = gridSize;

    // Ajustement de la densité de la grille (logique inchangée)
    while (apparentGridSizeOnScreen < 15 && gridSpacing < width && gridSpacing < height) {
        gridSpacing *= 5;
        apparentGridSizeOnScreen *= 5;
    }
    while (apparentGridSizeOnScreen > 75 && gridSpacing > 1) {
        gridSpacing /= 5;
        apparentGridSizeOnScreen /= 5;
        if (gridSpacing < 1) gridSpacing = 1;
    }
    if (gridSpacing <= 0) gridSpacing = gridSize;
    
    const strokeColor = '#ced4da';
    // L'épaisseur est gérée par updateStrokesWidth

    for (let x = 0; x <= width; x += gridSpacing) {
        const line = new fabric.Line([x, 0, x, height], {
            stroke: strokeColor,
            selectable: false,
            evented: false,
            excludeFromExport: true,
            isGridLine: true,
            baseStrokeWidth: 1 // Épaisseur de base pour updateStrokesWidth
        });
        fabricCanvas.add(line);
        gridLines.push(line);
    }
    for (let y = 0; y <= height; y += gridSpacing) {
        const line = new fabric.Line([0, y, width, y], {
            stroke: strokeColor,
            selectable: false,
            evented: false,
            excludeFromExport: true,
            isGridLine: true,
            baseStrokeWidth: 1 // Épaisseur de base pour updateStrokesWidth
        });
        fabricCanvas.add(line);
        gridLines.push(line);
    }

    // Ordre Z: Plan -> Guide -> Grille -> Objets
    const planBg = fabricCanvas.getObjects().find(o => o.isPlanBackground);
    if (planBg) planBg.sendToBack();
    if (pageGuideRect) pageGuideRect.bringToFront();
    gridLines.forEach(line => line.bringToFront());

    // Appliquer l'épaisseur des traits à la nouvelle grille
    updateStrokesWidth(currentZoom);
    fabricCanvas.requestRenderAll();
}


/**
 * Met à jour l'épaisseur des traits des objets en fonction du zoom.
 * Gère maintenant aussi la grille et le guide de page.
 */
export function updateStrokesWidth(zoom) {
    if (!fabricCanvas) return;
    const baseStroke = 0.5;
    const currentZoom = zoom > 0 ? zoom : 1;

    fabricCanvas.getObjects().forEach(obj => {
        function applyStroke(targetObj) {
            if (!targetObj || targetObj.type === 'i-text' || targetObj.type === 'text' || !targetObj.stroke) {
                return;
            }

            // NOUVEAU: Gérer le guide et la grille
            if (targetObj.isPageGuide) {
                targetObj.set({
                    'strokeWidth': 1 / currentZoom,
                    'strokeDashArray': [5 / currentZoom, 5 / currentZoom]
                });
                return;
            }
            if (targetObj.isGridLine) {
                targetObj.set('strokeWidth', Math.max(0.5, 1 / currentZoom));
                return;
            }
            // Fin modif

            if (targetObj.baseStrokeWidth === undefined || targetObj.baseStrokeWidth === null) {
                targetObj.baseStrokeWidth = targetObj.strokeWidth > 0 ? targetObj.strokeWidth : baseStroke;
            }
            let newStrokeWidth = Math.max(0.5 / currentZoom, targetObj.baseStrokeWidth / currentZoom);
            targetObj.set('strokeWidth', newStrokeWidth);
        }

        if (obj && obj.type === 'group' && obj.isPlanBackground) {
            // Appliquer aux enfants du groupe SVG
            obj.forEachObject(applyStroke);
        } else {
            // Appliquer à l'objet (étiquette, forme dessinée, etc.)
            applyStroke(obj);
        }
    });
}


/**
 * Trouve une forme SVG spécifique par son ID SVG.
 * (Fonction inchangée, elle agit sur les objets, pas sur le viewport)
 */
export function findSvgShapeByCodeGeo(svgId) {
    if (!svgId || !fabricCanvas) return null;
    const planGroup = fabricCanvas.getObjects().find(o => o.isPlanBackground && o.type === 'group');
    if (planGroup) {
        let foundObj = null;
        planGroup.forEachObject(obj => { // Utilise forEachObject pour la sécurité
            if (obj.customData?.svgId === svgId) {
                foundObj = obj;
            }
        });
        return foundObj;
    }
    return null;
}


/**
 * Exporte les dimensions de la "feuille" (le canvas LOGIQUE).
 */
export function getOriginalPlanDimensions() {
    if (!currentCanvasFormat) {
        console.warn("getOriginalPlanDimensions appelé avant initialisation.");
        return { width: 842, height: 595, viewBox: { x:0, y:0, width: 842, height: 595 } };
    }
    return {
        width: currentCanvasFormat.width,
        height: currentCanvasFormat.height,
        viewBox: currentCanvasFormat.viewBox
    };
}

/**
 * Dessine ou met à jour le guide de page.
 */
export function drawPageGuides(format) {
    if (!fabricCanvas) return;

    if (pageGuideRect) {
        fabricCanvas.remove(pageGuideRect);
        pageGuideRect = null;
    }

    const isOriginal = (format === 'Original');
    const formatData = PAGE_SIZES[format];

    if (isOriginal || !formatData || !formatData.viewBox) {
        console.log("drawPageGuides: Pas de guide à dessiner pour le format", format);
        fabricCanvas.requestRenderAll();
        return;
    }

    // MODIFIÉ: On ne vérifie plus la taille du canvas, on dessine le format logique
    const zoom = fabricCanvas.getZoom();
    const currentZoom = zoom > 0 ? zoom : 1;

    console.log(`Dessin du guide pour ${format}:`, formatData);

    pageGuideRect = new fabric.Rect({
        left: 0, // Positionné à 0,0 du MONDE LOGIQUE
        top: 0,
        width: formatData.width,  // <-- MODIFIÉ : Taille logique
        height: formatData.height, // <-- MODIFIÉ : Taille logique
        fill: 'transparent',
        stroke: '#adb5bd',
        strokeWidth: 1 / currentZoom, // Géré aussi par updateStrokesWidth
        baseStrokeWidth: 1,
        strokeDashArray: [5 / currentZoom, 5 / currentZoom],
        selectable: false,
        evented: false,
        excludeFromExport: true,
        isPageGuide: true
    });

    fabricCanvas.add(pageGuideRect);
    console.log("Guide ajouté au canvas:", pageGuideRect);

    // Ordre Z: Plan -> Guide -> Grille -> Objets
    const planBg = fabricCanvas.getObjects().find(o => o.isPlanBackground);
    if (planBg) planBg.sendToBack();
    pageGuideRect.bringToFront();
    gridLines.forEach(line => line.bringToFront());


    fabricCanvas.requestRenderAll();
    console.log("Rendu demandé après ajout/mise à jour du guide.");
}


/**
 * Retourne les dimensions PHYSIQUES du canvas (la taille du conteneur).
 */
export function getCanvasDimensions() {
    if (fabricCanvas) {
        return { width: fabricCanvas.getWidth(), height: fabricCanvas.getHeight() };
    }
    console.warn("getCanvasDimensions: Canvas non prêt, retour 0x0.");
    return { width: 0, height: 0 };
}


/**
 * Change le format (taille) LOGIQUE du canvas et met à jour le référentiel global.
 * @param {string} newFormatKey - La clé du nouveau format (ex: 'A3-L').
 */
export function setCanvasFormat(newFormatKey) {
    if (!fabricCanvas || !PAGE_SIZES[newFormatKey]) {
        console.error("Impossible de changer le format du canvas. Canvas non prêt ou format invalide:", newFormatKey);
        return;
    }

    const newFormat = PAGE_SIZES[newFormatKey];

    if (newFormat === currentCanvasFormat) {
        console.log(`Format du canvas déjà ${newFormatKey}. Aucun changement.`);
        return;
    }

    currentCanvasFormat = newFormat;

    console.log(`Changement du format logique vers ${newFormatKey}: ${newFormat.width}x${newFormat.height}`);

    // MODIFIÉ: On ne change PAS la taille du canvas Fabric physique
    // fabricCanvas.setWidth(newFormat.width);
    // fabricCanvas.setHeight(newFormat.height);

    window.originalSvgWidth = newFormat.width;
    window.originalSvgHeight = newFormat.height;
    window.originalSvgViewBox = newFormat.viewBox;

    drawPageGuides(newFormatKey); // Redessine le guide pour le nouveau format

    const planBg = fabricCanvas.getObjects().find(o => o.isPlanBackground);
    if (planBg) {
        // Cette logique recalcule l'échelle du plan pour s'adapter
        // au NOUVEAU format logique (ex: A3). Elle est correcte.
        let elementWidth, elementHeight;
        if (planBg.type === 'group' && typeof planBg.getBoundingRect === 'function' && planBg.scaleX !== 0 && planBg.scaleY !== 0) {
            const currentBounds = planBg.getBoundingRect();
            elementWidth = currentBounds.width / planBg.scaleX;
            elementHeight = currentBounds.height / planBg.scaleY;
        } else if (planBg.type === 'image' && typeof planBg.getOriginalSize === 'function') {
            const originalSize = planBg.getOriginalSize();
            elementWidth = originalSize.width;
            elementHeight = originalSize.height;
        } else {
            console.warn("Impossible de déterminer les dimensions originales du plan pour le recentrage.");
            elementWidth = null;
            elementHeight = null;
        }

        if (elementWidth && elementHeight) {
            const padding = 20;
            const safeCanvasWidth = newFormat.width - padding * 2;
            const safeCanvasHeight = newFormat.height - padding * 2;
            const scaleX = safeCanvasWidth > 0 ? safeCanvasWidth / elementWidth : 1;
            const scaleY = safeCanvasHeight > 0 ? safeCanvasHeight / elementHeight : 1;
            const newScale = Math.min(scaleX, scaleY);
            const finalElementWidth = elementWidth * newScale;
            const finalElementHeight = elementHeight * newScale;
            const newLeft = (newFormat.width - finalElementWidth) / 2;
            const newTop = (newFormat.height - finalElementHeight) / 2;

            planBg.set({ left: newLeft, top: newTop, scaleX: newScale, scaleY: newScale });
            planBg.setCoords();
            console.log("Plan existant recentré/redimensionné pour le nouveau format logique.");
        }
    }

    // Recentrer la vue pour afficher le nouveau format logique
    resetZoom(); // Appel direct de la fonction qui contient la logique

    fabricCanvas.requestRenderAll();
}
