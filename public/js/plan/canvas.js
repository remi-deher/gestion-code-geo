/**
 * Module pour la gestion du canvas Fabric.js, incluant initialisation,
 * chargement des plans (SVG/Image), redimensionnement, zoom, grille, verrouillage,
 * et guides de page.
 *
 * MODIFIÉ pour utiliser un CANVAS FIXE (ex: A4/A3) comme référentiel
 * et pour charger le SVG/Image comme un groupe/objet mis à l'échelle.
 * CORRIGÉ : resetZoom n'est plus appelé automatiquement par resize.
 */
import {
    GRID_SIZE
} from '../modules/config.js'; // Importe la taille de la grille
import {
    showToast
} from '../modules/utils.js'; // Importe la fonction pour afficher les notifications

let fabricCanvas = null;
let canvasContainer = null;
let canvasElement = null;
let isLocked = false; // État du verrouillage du plan SVG
let snapToGrid = false; // État du magnétisme

// --- Dimensions des Pages (Référentiel) ---
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
    } // Ne sera plus utilisé pour le canvas
};

// --- Format fixe par défaut ---
let currentCanvasFormat = PAGE_SIZES['A4-L']; // Défaut A4 Paysage

// Variables
let svgObjects = [];
let gridLines = [];
let pageGuideRect = null; // Référence au rectangle de guide de page

// --- Debounce timer for resize ---
let resizeTimeout = null;


/**
 * Initialise le canvas Fabric.js avec une TAILLE FIXE.
 * @param {string} canvasId - L'ID de l'élément <canvas> HTML.
 * @param {string} [initialFormat='A4-L'] - Le format de page initial (clé de PAGE_SIZES).
 * @returns {fabric.Canvas|null} L'instance du canvas ou null en cas d'erreur.
 */
export function initializeCanvas(canvasId, initialFormat = 'A4-L') {
    canvasElement = document.getElementById(canvasId);
    canvasContainer = canvasElement ? canvasElement.parentElement : null;

    if (!canvasElement || !canvasContainer) {
        console.error("Élément canvas ou son conteneur non trouvé.");
        return null;
    }

    currentCanvasFormat = PAGE_SIZES[initialFormat] || PAGE_SIZES['A4-L'];

    try {
        fabricCanvas = new fabric.Canvas(canvasId, {
            width: currentCanvasFormat.width,
            height: currentCanvasFormat.height,
            backgroundColor: '#f8f9fa',
            fireRightClick: true,
            stopContextMenu: true,
            preserveObjectStacking: true
        });

        // Définit le référentiel stable global
        window.originalSvgWidth = currentCanvasFormat.width;
        window.originalSvgHeight = currentCanvasFormat.height;
        window.originalSvgViewBox = currentCanvasFormat.viewBox;

        fabricCanvas.renderAndReset = function() {
            this.requestRenderAll();
            return this;
        };

        // Utilise la fonction handleResize pour écouter le redimensionnement
        window.addEventListener('resize', handleResize);

        // Appel initial du guide seulement
        setTimeout(() => {
            if (fabricCanvas) {
                drawPageGuides(initialFormat);
                fabricCanvas.requestRenderAll();
            }
        }, 100);

        console.log(`Canvas Fabric initialisé. Format: ${initialFormat}, Taille FIXE: ${currentCanvasFormat.width}x${currentCanvasFormat.height}`);
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
 * NE LANCE PLUS resetZoom automatiquement.
 */
function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        console.log("Debounced resize triggered (handleResize).");
        // Appel de la logique de redimensionnement SANS resetZoom automatique
        _performResizeActions(); // Appelons une fonction interne pour la clarté
    }, 250); // Délai debounce
}


/**
 * Logique réelle de redimensionnement (appelée par handleResize).
 * Met à jour l'offset, la grille, l'épaisseur des traits.
 * N'appelle PAS resetZoom.
 */
function _performResizeActions() {
    if (fabricCanvas && canvasContainer) {
        console.log("Executing _performResizeActions...");
        fabricCanvas.calcOffset(); // Recalcule l'offset du canvas par rapport à la page

        // Mettre à jour les éléments visuels dépendants du zoom/viewport
        const currentZoom = fabricCanvas.getZoom();
        updateGrid(currentZoom);
        updateStrokesWidth(currentZoom);
        // On pourrait aussi redessiner les guides ici si nécessaire
        // const currentFormatKey = Object.keys(PAGE_SIZES).find(key => PAGE_SIZES[key] === currentCanvasFormat) || 'A4-L';
        // drawPageGuides(currentFormatKey);

        fabricCanvas.requestRenderAll(); // Appliquer les changements visuels
    } else {
        console.log("_performResizeActions skipped: canvas or container not ready.");
    }
}

// La fonction exportée resizeCanvas appelle maintenant _performResizeActions
// On la garde exportée car elle pourrait être appelée manuellement d'ailleurs.
export function resizeCanvas() {
    _performResizeActions();
}


/**
 * Charge un plan SVG.
 * Centre et redimensionne le SVG pour s'adapter au canvas fixe courant.
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
                    gridLines = [];

                    const currentFormatKey = Object.keys(PAGE_SIZES).find(key => PAGE_SIZES[key] === currentCanvasFormat) || 'A4-L';

                    if (!objects || objects.length === 0) {
                        console.warn("Le SVG chargé est vide ou ne contient pas d'objets reconnus.");
                        updateGrid(fabricCanvas.getZoom());
                        drawPageGuides(currentFormatKey);
                        return resolve();
                    }

                    // Détermination des dimensions SVG
                    const originalSvgWidth = options.width; const originalSvgHeight = options.height;
                    const originalSvgViewBox = options.viewBox || null;
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    objects.forEach(obj => {
                        if (obj && obj.left !== undefined && obj.top !== undefined && obj.width !== undefined && obj.height !== undefined) {
                            // Coordonnées de base de l'objet
                            let left = obj.left || 0;
                            let top = obj.top || 0;
                            let width = obj.width || 0;
                            let height = obj.height || 0;
                            let scaleX = obj.scaleX || 1;
                            let scaleY = obj.scaleY || 1;

                            // FabricJS centre les objets par défaut (originX/Y = 'center') si non spécifié
                            // Pour le calcul de la bbox, il faut considérer cela
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


                    if (!svgWidth || !svgHeight || svgWidth <= 0 || svgHeight <= 0 || !isFinite(svgWidth) || !isFinite(svgHeight)) {
                        console.error("Impossible de déterminer des dimensions valides pour le SVG chargé.", { svgWidth, svgHeight, options });
                        updateGrid(fabricCanvas.getZoom());
                        drawPageGuides(currentFormatKey);
                        return reject(new Error("Dimensions du SVG non reconnues ou invalides."));
                    }

                    // Dimensions du Canvas FIXE
                    const canvasWidth = fabricCanvas.getWidth(); const canvasHeight = fabricCanvas.getHeight();

                    // Calcul pour centrer/fitter le SVG dans le Canvas
                    const padding = 20;
                    const safeCanvasWidth = canvasWidth - padding * 2; const safeCanvasHeight = canvasHeight - padding * 2;
                    const scaleX = safeCanvasWidth > 0 ? safeCanvasWidth / svgWidth : 1; const scaleY = safeCanvasHeight > 0 ? safeCanvasHeight / svgHeight : 1;
                    const scale = Math.min(scaleX, scaleY);
                    const finalSvgWidth = svgWidth * scale; const finalSvgHeight = svgHeight * scale;
                    const left = (canvasWidth - finalSvgWidth) / 2; const top = (canvasHeight - finalSvgHeight) / 2;

                    // Applique les propriétés aux objets
                    objects.forEach(obj => {
                        if (!obj) return;
                        obj.isSvgShape = true;
                        obj.customData = { ...obj.customData, svgId: obj.id || null };
                        obj.set({ selectable: !isLocked, hasControls: !isLocked, hasBorders: !isLocked, lockMovementX: isLocked, lockMovementY: isLocked, evented: true });
                        svgObjects.push(obj);
                    });

                    // Créer un groupe pour le plan
                    const planGroup = new fabric.Group(objects.filter(obj => !!obj), {
                        left: left, top: top, scaleX: scale, scaleY: scale,
                        originX: 'left', originY: 'top',
                        selectable: false, evented: true,
                        isPlanBackground: true,
                        subTargetCheck: true, // Pour la sélection des enfants
                    });

                    fabricCanvas.add(planGroup);
                    planGroup.sendToBack();

                    updateGrid(fabricCanvas.getZoom());
                    drawPageGuides(currentFormatKey);

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
            svgObjects = []; gridLines = [];
            updateGrid(fabricCanvas.getZoom());
            const currentFormatKey = Object.keys(PAGE_SIZES).find(key => PAGE_SIZES[key] === currentCanvasFormat) || 'A4-L';
            drawPageGuides(currentFormatKey);
        }
        return Promise.reject(error);
    }
}


/**
 * Charge une image comme objet centré/redimensionné.
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
                    fabricCanvas.clear(); fabricCanvas.backgroundColor = '#f8f9fa';
                    svgObjects = []; gridLines = [];
                    updateGrid(fabricCanvas.getZoom());
                    const currentFormatKey = Object.keys(PAGE_SIZES).find(key => PAGE_SIZES[key] === currentCanvasFormat) || 'A4-L';
                    drawPageGuides(currentFormatKey);
                }
                return reject(new Error("Erreur chargement image"));
            }
            if (!fabricCanvas) return reject(new Error("Canvas non prêt après chargement image"));

            // Nettoyage
            fabricCanvas.clear(); fabricCanvas.backgroundColor = '#f8f9fa';
            svgObjects = []; gridLines = [];

            const currentFormatKey = Object.keys(PAGE_SIZES).find(key => PAGE_SIZES[key] === currentCanvasFormat) || 'A4-L';

            // Dimensions image
            const imgWidth = img.width; const imgHeight = img.height;
            if (!imgWidth || !imgHeight || imgWidth <= 0 || imgHeight <= 0) {
                 console.error("Dimensions de l'image invalides.", { imgWidth, imgHeight });
                 updateGrid(fabricCanvas.getZoom()); drawPageGuides(currentFormatKey);
                 return reject(new Error("Dimensions de l'image invalides."));
            }

            // Dimensions Canvas
            const canvasWidth = fabricCanvas.getWidth(); const canvasHeight = fabricCanvas.getHeight();

            // Calcul centrer/fitter
            const padding = 20;
            const safeCanvasWidth = canvasWidth - padding * 2; const safeCanvasHeight = canvasHeight - padding * 2;
            const scaleX = safeCanvasWidth > 0 ? safeCanvasWidth / imgWidth : 1; const scaleY = safeCanvasHeight > 0 ? safeCanvasHeight / imgHeight : 1;
            const scale = Math.min(scaleX, scaleY);
            const finalImgWidth = imgWidth * scale; const finalImgHeight = imgHeight * scale;
            const left = (canvasWidth - finalImgWidth) / 2; const top = (canvasHeight - finalImgHeight) / 2;

            img.set({
                left: left, top: top, scaleX: scale, scaleY: scale,
                originX: 'left', originY: 'top',
                selectable: false, evented: false, hasControls: false, hasBorders: false,
                isPlanBackground: true
            });

            fabricCanvas.add(img);
            img.sendToBack();

            updateGrid(fabricCanvas.getZoom());
            drawPageGuides(currentFormatKey);

            fabricCanvas.requestRenderAll();
            console.log(`Image chargée (objet). Dimensions originales: ${imgWidth}x${imgHeight}, Affichée à l'échelle: ${scale.toFixed(3)}`);
            resolve();
        }, { crossOrigin: 'anonymous' });
    });
}


/**
 * Ajuste le zoom et le pan pour afficher le CANVAS FIXE entier.
 * N'est plus appelée automatiquement par handleResize/resizeCanvas.
 * La vérification des dimensions invalides est CONSERVÉE.
 */
export function resetZoom() {
    if (!fabricCanvas || !canvasContainer) {
        console.warn("resetZoom skipped: canvas or container not ready.");
        return;
    }

    const containerWidth = canvasContainer.clientWidth;
    const containerHeight = canvasContainer.clientHeight;
    const padding = 20; // Garde la marge visuelle

    // Dimensions fixes du canvas (la "feuille")
    let canvasWidth = fabricCanvas.getWidth();
    let canvasHeight = fabricCanvas.getHeight();

console.log(`MANUAL ResetZoom - Container: ${containerWidth}x${containerHeight}, Canvas: ${canvasWidth}x${canvasHeight}`); // Log spécifique au clic

    // --- VÉRIFICATION CONSERVÉE ---
    // Si le conteneur est très petit (probablement un état de rendu intermédiaire),
    // ou trop petit pour contenir le canvas même sans padding, on ignore cet appel.
    if (containerWidth <= padding * 2 || containerHeight <= padding * 2 || containerHeight < 100 || containerHeight < canvasHeight * 0.5 ) {
        console.warn(`ResetZoom skipped: Container dimensions (${containerWidth}x${containerHeight}) seem invalid or too small compared to canvas (${canvasWidth}x${canvasHeight}). Assuming transient state.`);
        return; // Ne pas modifier le viewport si les dimensions sont suspectes
    }
    // --- FIN VÉRIFICATION ---

    // Calcul du zoom et du centrage (logique inchangée)
    const scaleX = (containerWidth - padding * 2) / canvasWidth;
    const scaleY = (containerHeight - padding * 2) / canvasHeight;
    const scale = Math.min(scaleX, scaleY);

    // Vérifier si scale est valide avant de l'appliquer
    if (scale <= 0 || !isFinite(scale)) {
        console.warn("ResetZoom: Calculated scale is invalid, applying default viewport.", { scale });
        fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        updateGrid(1); updateStrokesWidth(1);
    } else {
        const panX = (containerWidth - (canvasWidth * scale)) / 2;
        const panY = (containerHeight - (canvasHeight * scale)) / 2;
        fabricCanvas.setViewportTransform([scale, 0, 0, scale, panX, panY]);
	console.log(`MANUAL ResetZoom - Calculated: scale=${scale.toFixed(3)}, panX=${panX.toFixed(1)}, panY=${panY.toFixed(1)}`); // Log les résultats
        updateGrid(scale); updateStrokesWidth(scale);
    }

    fabricCanvas.requestRenderAll();
}


/**
 * Zoom/Dézoom le canvas sur un point donné ou sur le centre.
 */
export function zoomCanvas(factor, point = null) {
    if (!fabricCanvas) return;
    const currentZoom = fabricCanvas.getZoom();
    let newZoom = currentZoom * factor;
    const minZoom = 0.05; const maxZoom = 20;
    newZoom = Math.max(minZoom, Math.min(newZoom, maxZoom));
    if (newZoom === currentZoom) return;
    if (!point) { point = fabricCanvas.getVpCenter(); }
    fabricCanvas.zoomToPoint(point, newZoom);
    updateGrid(newZoom); updateStrokesWidth(newZoom); fabricCanvas.requestRenderAll();
}

/**
 * Verrouille ou déverrouille les éléments SVG du plan.
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


/** Retourne l'état actuel du verrouillage SVG. */
export function getCanvasLock() {
    return isLocked;
}

/** Active/Désactive l'affichage de la grille. */
export function toggleGridDisplay(show) {
    const gridToggleCheckbox = document.getElementById('grid-toggle');
    if(gridToggleCheckbox) gridToggleCheckbox.checked = show;
    updateGrid(fabricCanvas.getZoom());
}

/** Active/Désactive le magnétisme à la grille. */
export function toggleSnapToGrid(snap) {
    if (snap instanceof Event && snap.target && typeof snap.target.checked === 'boolean') { snapToGrid = snap.target.checked; }
    else if (typeof snap === 'boolean') { snapToGrid = snap; }
    else { console.warn("toggleSnapToGrid appelé avec un argument invalide:", snap); }
    console.log("Magnétisme grille:", snapToGrid);
    const snapToggleCheckbox = document.getElementById('snap-toggle');
    if (snapToggleCheckbox) { snapToggleCheckbox.checked = snapToGrid; }
}

/** Retourne l'état actuel du magnétisme. */
export function getSnapToGrid() {
    const snapToggleCheckbox = document.getElementById('snap-toggle');
    if (snapToggleCheckbox) { snapToGrid = snapToggleCheckbox.checked; }
    return snapToGrid;
}

/**
 * Met à jour (recrée) la grille visuelle en fonction du zoom.
 */
export function updateGrid(zoom) {
     if (!fabricCanvas) return;
    gridLines.forEach(line => fabricCanvas.remove(line)); gridLines = [];
    const gridToggleCheckbox = document.getElementById('grid-toggle');
    const showGrid = gridToggleCheckbox ? gridToggleCheckbox.checked : false;
    if (!showGrid) { fabricCanvas.requestRenderAll(); return; }
    const gridSize = GRID_SIZE || 10;
    const width = fabricCanvas.getWidth(); const height = fabricCanvas.getHeight();
    const currentZoom = zoom > 0 ? zoom : 1;
    let apparentGridSizeOnScreen = gridSize * currentZoom; let gridSpacing = gridSize;

    while (apparentGridSizeOnScreen < 15 && gridSpacing < width && gridSpacing < height) { gridSpacing *= 5; apparentGridSizeOnScreen *= 5; }
    while (apparentGridSizeOnScreen > 75 && gridSpacing > 1) { gridSpacing /= 5; apparentGridSizeOnScreen /= 5; if (gridSpacing < 1) gridSpacing = 1; }
    if (gridSpacing <= 0) gridSpacing = gridSize;
    const strokeColor = '#ced4da'; const strokeWidth = Math.max(0.5, 1 / currentZoom);

    for (let x = 0; x <= width; x += gridSpacing) {
        const line = new fabric.Line([x, 0, x, height], { stroke: strokeColor, strokeWidth: strokeWidth, selectable: false, evented: false, excludeFromExport: true, isGridLine: true });
        fabricCanvas.add(line); gridLines.push(line);
    }
    for (let y = 0; y <= height; y += gridSpacing) {
        const line = new fabric.Line([0, y, width, y], { stroke: strokeColor, strokeWidth: strokeWidth, selectable: false, evented: false, excludeFromExport: true, isGridLine: true });
        fabricCanvas.add(line); gridLines.push(line);
    }

    // Ordre Z: Plan -> Guide -> Grille -> Objets
    const planBg = fabricCanvas.getObjects().find(o => o.isPlanBackground);
    if (planBg) planBg.sendToBack();
    if(pageGuideRect) pageGuideRect.bringToFront();
    gridLines.forEach(line => line.bringToFront());


    fabricCanvas.requestRenderAll();
}


/**
 * Met à jour l'épaisseur des traits des objets en fonction du zoom.
 */
export function updateStrokesWidth(zoom) {
    if (!fabricCanvas) return;
    const baseStroke = 0.5;
    const currentZoom = zoom > 0 ? zoom : 1;
    fabricCanvas.getObjects().forEach(obj => {
        function applyStroke(targetObj) {
            if (!targetObj || targetObj.isGridLine || targetObj.isPageGuide || targetObj.type === 'i-text' || targetObj.type === 'text' || !targetObj.stroke) {
                return;
            }
            if (targetObj.baseStrokeWidth === undefined || targetObj.baseStrokeWidth === null) {
                targetObj.baseStrokeWidth = targetObj.strokeWidth > 0 ? targetObj.strokeWidth : baseStroke;
            }
            let newStrokeWidth = Math.max(0.5 / currentZoom, targetObj.baseStrokeWidth / currentZoom);
            targetObj.set('strokeWidth', newStrokeWidth);
        }

        if (obj && obj.type === 'group' && obj.isPlanBackground) {
            obj.forEachObject(applyStroke);
        } else {
            applyStroke(obj);
        }
    });
}


/**
 * Trouve une forme SVG spécifique par son ID SVG.
 */
export function findSvgShapeByCodeGeo(svgId) {
     if (!svgId || !fabricCanvas) return null;
    const planGroup = fabricCanvas.getObjects().find(o => o.isPlanBackground && o.type === 'group');
    if (planGroup) {
        let foundObj = null;
        planGroup.forEachObject(obj => { // Utilise forEachObject pour la sécurité
            if(obj.customData?.svgId === svgId) {
                foundObj = obj;
            }
        });
        return foundObj;
    }
    return null;
}


/**
 * Exporte les dimensions de la "feuille" (le canvas fixe).
 */
export function getOriginalPlanDimensions() {
    if (!fabricCanvas) {
         console.warn("getOriginalPlanDimensions appelé avant initialisation canvas.");
         return { width: currentCanvasFormat.width, height: currentCanvasFormat.height, viewBox: currentCanvasFormat.viewBox };
    }
    const width = fabricCanvas.getWidth(); const height = fabricCanvas.getHeight();
    return { width: width, height: height, viewBox: { x: 0, y: 0, width: width, height: height } };
}

/**
 * Dessine ou met à jour le guide de page.
 */
export function drawPageGuides(format) {
     if (!fabricCanvas) return;

    if (pageGuideRect) { fabricCanvas.remove(pageGuideRect); pageGuideRect = null; }

    const isOriginal = (format === 'Original');
    const formatData = PAGE_SIZES[format];

    if (isOriginal || !formatData || !formatData.viewBox) {
        console.log("drawPageGuides: Pas de guide à dessiner pour le format", format);
        fabricCanvas.requestRenderAll();
        return;
    }

    if (formatData.width !== fabricCanvas.getWidth() || formatData.height !== fabricCanvas.getHeight()) {
        console.warn(`drawPageGuides: Le format demandé (${format}) ne correspond pas à la taille actuelle du canvas (${fabricCanvas.getWidth()}x${fabricCanvas.getHeight()}). Guide non dessiné.`);
        fabricCanvas.requestRenderAll();
        return;
    }

    const viewBox = formatData.viewBox;
    const zoom = fabricCanvas.getZoom();
    const currentZoom = zoom > 0 ? zoom : 1;

    console.log(`Dessin du guide pour ${format}:`, formatData);

    pageGuideRect = new fabric.Rect({
        left: 0, top: 0, width: fabricCanvas.getWidth(), height: fabricCanvas.getHeight(),
        fill: 'transparent', stroke: '#adb5bd', strokeWidth: 1 / currentZoom, baseStrokeWidth: 1,
        strokeDashArray: [5 / currentZoom, 5 / currentZoom],
        selectable: false, evented: false, excludeFromExport: true, isPageGuide: true
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
 * Retourne les dimensions FIXES du canvas (la "feuille").
 */
export function getCanvasDimensions() {
    if (fabricCanvas) {
        return { width: fabricCanvas.getWidth(), height: fabricCanvas.getHeight() };
    }
    console.warn("getCanvasDimensions: Canvas non prêt, retour au format par défaut.");
    return { width: currentCanvasFormat.width, height: currentCanvasFormat.height };
}


/**
 * Change le format (taille) du canvas et met à jour le référentiel global.
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

    console.log(`Changement du format du canvas vers ${newFormatKey}: ${newFormat.width}x${newFormat.height}`);

    fabricCanvas.setWidth(newFormat.width);
    fabricCanvas.setHeight(newFormat.height);

    window.originalSvgWidth = newFormat.width;
    window.originalSvgHeight = newFormat.height;
    window.originalSvgViewBox = newFormat.viewBox;

    drawPageGuides(newFormatKey);

    const planBg = fabricCanvas.getObjects().find(o => o.isPlanBackground);
    if (planBg) {
        let elementWidth, elementHeight;
        if (planBg.type === 'group' && typeof planBg.getBoundingRect === 'function' && planBg.scaleX !== 0 && planBg.scaleY !== 0) {
             // Utilise getCoords pour une meilleure prise en compte des transformations internes ? Non, BBox est mieux.
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
            console.log("Plan existant recentré/redimensionné pour le nouveau format.");
        }
    }

    // Recentrer la vue
    resetZoom(); // Appel direct de la fonction qui contient la logique

    fabricCanvas.requestRenderAll();
}
