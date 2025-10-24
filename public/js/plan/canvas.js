/**
 * Module pour la gestion du canvas Fabric.js, incluant initialisation,
 * chargement des plans (SVG/Image), redimensionnement, zoom, grille, verrouillage,
 * et guides de page.
 *
 * ARCHITECTURE CORRIGÉE (2024-05-27) :
 * 1. Le canvas Fabric (physique) remplit son conteneur (#plan-container) et a une TAILLE DYNAMIQUE.
 * 2. Le "monde" ou "contenu" a une TAILLE LOGIQUE FIXE (ex: A4, A3) définie par 'currentCanvasFormat'.
 * 3. resetZoom() centre le "contenu logique" (le guide A4/A3) à l'intérieur du "canvas physique" (le conteneur).
 * VERSION MODIFIÉE (Z-INDEX + Groupe SVG) :
 * - Charge les SVG comme un groupe unique par défaut (isSvgPlanGroup).
 * - Ce groupe reste au premier plan, interactif (si déverrouillé).
 * - Le guide et la grille sont TOUJOURS envoyés en arrière-plan.
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
let isLocked = true; // État du verrouillage du plan SVG (verrouillé par défaut)
let snapToGrid = false; // État du magnétisme
let planType = 'image'; // Suivre le type de plan chargé ('image' ou 'svg')

// --- Dimensions des Pages (Référentiel LOGIQUE) ---
export const PAGE_SIZES = {
    'A4-P': { width: 595, height: 842, viewBox: { x: 0, y: 0, width: 595, height: 842 } },
    'A4-L': { width: 842, height: 595, viewBox: { x: 0, y: 0, width: 842, height: 595 } },
    'A3-P': { width: 842, height: 1191, viewBox: { x: 0, y: 0, width: 842, height: 1191 } },
    'A3-L': { width: 1191, height: 842, viewBox: { x: 0, y: 0, width: 1191, height: 842 } },
    'Original': { width: null, height: null, viewBox: null }
};

// --- Format logique par défaut ---
let currentCanvasFormat = PAGE_SIZES['A4-L'];

// Variables
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
    canvasContainer = canvasElement ? canvasElement.parentElement : null;

    if (!canvasElement || !canvasContainer) {
        console.error("Élément canvas ou son conteneur non trouvé.");
        return null;
    }

    currentCanvasFormat = PAGE_SIZES[initialFormat] || PAGE_SIZES['A4-L'];
    const containerRect = canvasContainer.getBoundingClientRect();

    try {
        fabricCanvas = new fabric.Canvas(canvasId, {
            width: containerRect.width > 0 ? containerRect.width : 800,
            height: containerRect.height > 0 ? containerRect.height : 600,
            backgroundColor: '#ffffff',
            fireRightClick: true,
            stopContextMenu: true,
            preserveObjectStacking: true // Important pour le Z-index
        });

        fabricCanvas.renderAndReset = function() { this.requestRenderAll(); return this; };

        window.originalSvgWidth = currentCanvasFormat.width;
        window.originalSvgHeight = currentCanvasFormat.height;
        window.originalSvgViewBox = currentCanvasFormat.viewBox;

        window.addEventListener('resize', handleResize);

        console.log(`Canvas Fabric initialisé (Dynamique: ${containerRect.width}x${containerRect.height}). Format logique: ${initialFormat}`);
        return fabricCanvas;

    } catch (error) {
        console.error("Erreur lors de l'initialisation de Fabric.js:", error);
        return null;
    }
}

/** Retourne l'instance du canvas Fabric. */
export function getCanvasInstance() { return fabricCanvas; }

/** Gère l'événement resize de la fenêtre avec un debounce. */
function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        console.log("Debounced resize triggered (handleResize).");
        _performResizeActions();
    }, 250);
}

/** Logique réelle de redimensionnement */
function _performResizeActions() {
    if (fabricCanvas && canvasContainer) {
        console.log("Executing _performResizeActions...");
        const containerRect = canvasContainer.getBoundingClientRect();
        if (containerRect.width > 0 && containerRect.height > 0) {
            fabricCanvas.setWidth(containerRect.width);
            fabricCanvas.setHeight(containerRect.height);
        } else {
            console.warn("_performResizeActions: Container size is zero, skipping resize.");
            return;
        }
        resetZoom();
        fabricCanvas.calcOffset();
        fabricCanvas.requestRenderAll();
    } else {
        console.log("_performResizeActions skipped: canvas or container not ready.");
    }
}

/** Fonction exportée pour déclencher manuellement un redimensionnement/recentrage. */
export function resizeCanvas() { _performResizeActions(); }

/**
 * Charge un plan SVG.
 * MODIFIÉ : Regroupe les objets SVG importés par défaut, mais les garde interactifs et au premier plan.
 * @param {string} svgUrl - L'URL du fichier SVG.
 * @returns {Promise<void>}
 */
export async function loadSvgPlan(svgUrl) {
    if (!fabricCanvas) return Promise.reject(new Error("Canvas non initialisé"));
    console.log(`Chargement du plan SVG (groupé par défaut) depuis ${svgUrl}`);
    planType = 'svg'; // Définit le type de plan
    // svgPlanGroup est défini lors de l'ajout au canvas

    try {
        const response = await fetch(svgUrl);
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
        const svgString = await response.text();

        return new Promise((resolve, reject) => {
            fabric.loadSVGFromString(svgString, (objects, options) => {
                if (!fabricCanvas) return reject(new Error("Canvas non prêt après chargement SVG"));

                // Nettoyage
                fabricCanvas.clear();
                fabricCanvas.backgroundColor = '#f8f9fa';
                gridLines = [];
                pageGuideRect = null;

                if (!objects || objects.length === 0) {
                    console.warn("Le SVG chargé est vide ou ne contient pas d'objets reconnus.");
                    resetZoom(); // Important pour dessiner guide/grille même si vide
                    return resolve();
                }

                // --- Détermination des dimensions SVG (inchangée) ---
                const originalSvgWidth = options.width;
                const originalSvgHeight = options.height;
                const originalSvgViewBox = options.viewBox || null;
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                objects.forEach(obj => {
                    if (obj && obj.left !== undefined && obj.top !== undefined && obj.width !== undefined && obj.height !== undefined) {
                        let left = obj.left || 0; let top = obj.top || 0; let width = obj.width || 0; let height = obj.height || 0;
                        let scaleX = obj.scaleX || 1; let scaleY = obj.scaleY || 1; let originX = obj.originX || 'left'; let originY = obj.originY || 'top';
                        let objLeft = left - (originX === 'center' ? (width * scaleX / 2) : (originX === 'right' ? width * scaleX : 0));
                        let objTop = top - (originY === 'center' ? (height * scaleY / 2) : (originY === 'bottom' ? height * scaleY : 0));
                        let objRight = objLeft + width * scaleX; let objBottom = objTop + height * scaleY;
                        minX = Math.min(minX, objLeft); minY = Math.min(minY, objTop); maxX = Math.max(maxX, objRight); maxY = Math.max(maxY, objBottom);
                    }
                });
                const calculatedWidth = (maxX > minX && isFinite(minX) && isFinite(maxX)) ? maxX - minX : options.width;
                const calculatedHeight = (maxY > minY && isFinite(minY) && isFinite(maxY)) ? maxY - minY : options.height;
                const svgWidth = originalSvgViewBox?.width || originalSvgWidth || calculatedWidth;
                const svgHeight = originalSvgViewBox?.height || originalSvgHeight || calculatedHeight;
                // --- Fin Logique dimensionnement SVG ---

                if (!svgWidth || !svgHeight || svgWidth <= 0 || svgHeight <= 0 || !isFinite(svgWidth) || !isFinite(svgHeight)) {
                    console.error("Impossible de déterminer des dimensions valides pour le SVG chargé.", { svgWidth, svgHeight, options });
                    resetZoom(); // Important
                    return reject(new Error("Dimensions du SVG non reconnues ou invalides."));
                }

                const canvasWidth = currentCanvasFormat.width; const canvasHeight = currentCanvasFormat.height;
                const padding = 20; const safeCanvasWidth = canvasWidth - padding * 2; const safeCanvasHeight = canvasHeight - padding * 2;
                const scaleX = safeCanvasWidth > 0 ? safeCanvasWidth / svgWidth : 1; const scaleY = safeCanvasHeight > 0 ? safeCanvasHeight / svgHeight : 1;
                const scale = Math.min(scaleX, scaleY);
                const finalSvgWidth = svgWidth * scale; const finalSvgHeight = svgHeight * scale;
                const left = (canvasWidth - finalSvgWidth) / 2; const top = (canvasHeight - finalSvgHeight) / 2;

                // --- MODIFICATION : REGROUPER LES OBJETS ---
                // Appliquer les propriétés aux enfants AVANT de grouper
                objects.forEach(obj => {
                    if (!obj) return;
                    obj.isSvgShape = true; // Marqueur important
                    obj.customData = { ...obj.customData, svgId: obj.id || null };
                    // Les propriétés de sélection/verrouillage seront gérées par le groupe
                    obj.set({ evented: true }); // Garder evented pour l'ancrage des textes
                });

                // Créer le groupe principal pour le plan SVG
                const svgPlanGroup = new fabric.Group(objects.filter(obj => !!obj), {
                    left: left,
                    top: top,
                    scaleX: scale,
                    scaleY: scale,
                    originX: 'left',
                    originY: 'top',
                    selectable: !isLocked,    // Sélectionnable si déverrouillé
                    evented: true,           // Pour recevoir les clics
                    hasControls: !isLocked,   // Contrôles si déverrouillé
                    hasBorders: !isLocked,    // Bordure si déverrouillé
                    lockMovementX: isLocked, // Verrouillé par défaut
                    lockMovementY: isLocked, // Verrouillé par défaut
                    isSvgPlanGroup: true,    // Marqueur pour ce groupe spécial
                    customData: { isSvgPlanGroup: true }, // Pour la sauvegarde/vérification
                    subTargetCheck: true,    // Permet de sélectionner les enfants
                    // PAS de isPlanBackground: true
                });

                fabricCanvas.add(svgPlanGroup);
                // *** IMPORTANT : PAS de sendToBack() ici ***
                // Le groupe reste au premier plan (devant la grille/guide)
                // --- FIN MODIFICATION ---


                resetZoom(); // Dessinera guide/grille DERRIERE le groupe SVG

                fabricCanvas.requestRenderAll();
                console.log(`${objects.length} objets SVG ajoutés (groupés par défaut) au canvas.`);
                resolve();
            }, null, { crossOrigin: 'anonymous' });
        });
    } catch (error) {
        console.error("Erreur lors du chargement ou parsing SVG:", error);
        showToast(`Erreur chargement plan: ${error.message}`, 'danger');
        if (fabricCanvas) {
            fabricCanvas.clear();
            fabricCanvas.backgroundColor = '#f8f9fa';
            gridLines = [];
        }
        resetZoom(); // Essayer de dessiner guide/grille même en cas d'erreur
        return Promise.reject(error);
    }
}

/**
 * Charge une image comme objet centré/redimensionné dans le MONDE LOGIQUE.
 * ENVOIE L'IMAGE EN ARRIERE PLAN.
 * @param {string} imageUrl - L'URL de l'image.
 * @returns {Promise<void>}
 */
export async function loadPlanImage(imageUrl) {
    if (!fabricCanvas) return Promise.reject(new Error("Canvas non initialisé"));
    console.log(`Chargement de l'image (en fond) depuis ${imageUrl}`);
    planType = 'image'; // Définit le type de plan

    return new Promise((resolve, reject) => {
        fabric.Image.fromURL(imageUrl, (img, isError) => {
            if (isError || !img) {
                console.error("Erreur lors du chargement de l'image depuis l'URL:", imageUrl);
                showToast("Erreur chargement image", 'danger');
                if (fabricCanvas) { fabricCanvas.clear(); fabricCanvas.backgroundColor = '#f8f9fa'; gridLines = []; }
                resetZoom(); // Essayer de dessiner guide/grille
                return reject(new Error("Erreur chargement image"));
            }
            if (!fabricCanvas) return reject(new Error("Canvas non prêt après chargement image"));

            fabricCanvas.clear(); fabricCanvas.backgroundColor = '#f8f9fa'; gridLines = []; pageGuideRect = null;

            const imgWidth = img.width; const imgHeight = img.height;
            if (!imgWidth || !imgHeight || imgWidth <= 0 || imgHeight <= 0) {
                console.error("Dimensions de l'image invalides.", { imgWidth, imgHeight });
                resetZoom(); // Essayer de dessiner guide/grille
                return reject(new Error("Dimensions de l'image invalides."));
            }

            const canvasWidth = currentCanvasFormat.width; const canvasHeight = currentCanvasFormat.height;
            const padding = 20; const safeCanvasWidth = canvasWidth - padding * 2; const safeCanvasHeight = canvasHeight - padding * 2;
            const scaleX = safeCanvasWidth > 0 ? safeCanvasWidth / imgWidth : 1; const scaleY = safeCanvasHeight > 0 ? safeCanvasHeight / imgHeight : 1;
            const scale = Math.min(scaleX, scaleY);
            const finalImgWidth = imgWidth * scale; const finalImgHeight = imgHeight * scale;
            const left = (canvasWidth - finalImgWidth) / 2; const top = (canvasHeight - finalImgHeight) / 2;

            img.set({
                left: left, top: top, scaleX: scale, scaleY: scale,
                originX: 'left', originY: 'top',
                selectable: false, evented: false, hasControls: false, hasBorders: false,
                isPlanBackground: true // Marqueur pour le fond
            });

            fabricCanvas.add(img);
            img.sendToBack(); // *** IMPORTANT : L'image va tout derrière ***

            resetZoom(); // Dessinera guide/grille devant l'image

            fabricCanvas.requestRenderAll();
            console.log(`Image chargée (fond). Dimensions originales: ${imgWidth}x${imgHeight}, Affichée à l'échelle: ${scale.toFixed(3)}`);
            resolve();
        }, { crossOrigin: 'anonymous' });
    });
}

/**
 * Ajuste le zoom/pan pour afficher le CONTENU LOGIQUE entier, centré.
 * DESSINE LE GUIDE ET LA GRILLE DERRIÈRE LES AUTRES OBJETS.
 */
export function resetZoom() {
    if (!fabricCanvas || !canvasContainer) { /* ... garde de sécurité ... */ return; }

    const containerWidth = fabricCanvas.getWidth(); const containerHeight = fabricCanvas.getHeight(); const padding = 20;
    let contentWidth = currentCanvasFormat.width; let contentHeight = currentCanvasFormat.height;

    if (!contentWidth || !contentHeight) {
        if (pageGuideRect) { fabricCanvas.remove(pageGuideRect); pageGuideRect = null; }
        // Toujours essayer de dessiner la grille si possible (même sans guide)
        updateGrid(fabricCanvas.getZoom());
        console.warn("resetZoom: Invalid logical content dimensions, grid updated if possible.");
        return;
    }

    console.log(`ResetZoom - Canvas(Container): ${containerWidth}x${containerHeight}, Content(Guide): ${contentWidth}x${contentHeight}`);

    if (containerWidth <= padding * 2 || containerHeight <= padding * 2 || contentWidth <= 0 || contentHeight <= 0) {
        fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    } else {
        const scaleX = (containerWidth - padding * 2) / contentWidth; const scaleY = (containerHeight - padding * 2) / contentHeight;
        const scale = Math.min(scaleX, scaleY);
        if (scale <= 0 || !isFinite(scale)) {
            fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        } else {
            const panX = (containerWidth - (contentWidth * scale)) / 2; const panY = (containerHeight - (contentHeight * scale)) / 2;
            fabricCanvas.setViewportTransform([scale, 0, 0, scale, panX, panY]);
            console.log(`ResetZoom: Viewport adjusted. Scale: ${scale.toFixed(3)}, Pan: (${panX.toFixed(1)}, ${panY.toFixed(1)})`);
        }
    }

    // --- MISE A JOUR VISUELLE (ORDRE IMPORTANT) ---
    const finalZoom = fabricCanvas.getZoom();
    const currentFormatKey = Object.keys(PAGE_SIZES).find(key => PAGE_SIZES[key] === currentCanvasFormat) || 'A4-L';

    // 1. Dessine guide (s'envoie en arrière-plan)
    drawPageGuides(currentFormatKey);
    // 2. Dessine grille (s'envoie en arrière-plan, au-dessus du guide)
    updateGrid(finalZoom);
    // 3. Met à jour l'épaisseur de TOUS les objets (y compris guide/grille/SVG)
    updateStrokesWidth(finalZoom);

    fabricCanvas.requestRenderAll();
}

/** Zoom/Dézoom le canvas */
export function zoomCanvas(factor, point = null) {
    if (!fabricCanvas) return;
    const currentZoom = fabricCanvas.getZoom();
    let newZoom = currentZoom * factor;
    const minZoom = 0.05; const maxZoom = 20;
    newZoom = Math.max(minZoom, Math.min(newZoom, maxZoom));
    if (newZoom === currentZoom) return;
    if (!point) { point = fabricCanvas.getVpCenter(); }
    fabricCanvas.zoomToPoint(point, newZoom);

    // --- MISE A JOUR VISUELLE (ORDRE IMPORTANT) ---
    const currentFormatKey = Object.keys(PAGE_SIZES).find(key => PAGE_SIZES[key] === currentCanvasFormat) || 'A4-L';
    // 1. Dessine guide
    drawPageGuides(currentFormatKey);
    // 2. Dessine grille
    updateGrid(newZoom);
    // 3. Met à jour l'épaisseur
    updateStrokesWidth(newZoom);

    fabricCanvas.requestRenderAll();
}

/**
 * Verrouille ou déverrouille le groupe SVG principal (si planType === 'svg').
 * MODIFIÉ : Cible le groupe `isSvgPlanGroup` ou les formes `isSvgShape` si dégroupé.
 */
export function setCanvasLock(lock) {
    isLocked = lock;
    console.log("Verrouillage SVG:", isLocked);
    
    // Cherche le groupe principal *actuellement* sur le canvas
    const mainSvgGroup = fabricCanvas.getObjects().find(o => o.isSvgPlanGroup || o.customData?.isSvgPlanGroup);

    if (mainSvgGroup) {
        // Le groupe principal existe, appliquer le verrouillage à ce groupe
        console.log(`setCanvasLock: Application au groupe SVG principal.`);
        mainSvgGroup.set({
            selectable: !isLocked,
            lockMovementX: isLocked,
            lockMovementY: isLocked,
            hasControls: !isLocked,
            hasBorders: !isLocked,
        });
        mainSvgGroup.setCoords();

        // Si on verrouille, désélectionner le groupe s'il est actif
        if (isLocked && fabricCanvas.getActiveObject() === mainSvgGroup) {
            fabricCanvas.discardActiveObject();
        }
    } else if (planType === 'svg') {
        // Plan SVG, mais le groupe principal n'existe plus (il a été dégroupé)
        // Appliquer le verrouillage à toutes les formes SVG individuelles
        console.log(`setCanvasLock: Application aux ${fabricCanvas.getObjects().filter(o => o.isSvgShape).length} formes SVG individuelles.`);
        let selectionDiscarded = false;
        fabricCanvas.getObjects().forEach(obj => {
            if (obj?.isSvgShape) {
                obj.set({
                    selectable: !isLocked,
                    lockMovementX: isLocked,
                    lockMovementY: isLocked,
                    hasControls: !isLocked,
                    hasBorders: !isLocked,
                    evented: true // Garder evented pour l'ancrage
                });
                obj.setCoords();
            }
        });

        // Si on verrouille, désélectionner une sélection active de formes SVG
        const activeObj = fabricCanvas.getActiveObject();
        if (isLocked && activeObj && activeObj.type === 'activeSelection' && activeObj.getObjects().some(o => o.isSvgShape)) {
            console.log("Désélection de la sélection active de formes SVG.");
            fabricCanvas.discardActiveObject();
        }
    } else if (planType === 'image') {
        // Pour les plans images, le fond est toujours non sélectionnable, rien à faire
        console.log("setCanvasLock: Non applicable pour plan image.");
    }
    
    fabricCanvas.requestRenderAll();
}

/** Retourne l'état actuel du verrouillage SVG */
export function getCanvasLock() { return isLocked; }

/** Active/Désactive l'affichage de la grille */
export function toggleGridDisplay(show) {
    const gridToggleCheckbox = document.getElementById('grid-toggle');
    if (gridToggleCheckbox) gridToggleCheckbox.checked = show;
    updateGrid(fabricCanvas.getZoom());
}

/** Active/Désactive le magnétisme à la grille */
export function toggleSnapToGrid(snap) {
    if (snap instanceof Event && snap.target && typeof snap.target.checked === 'boolean') { snapToGrid = snap.target.checked; }
    else if (typeof snap === 'boolean') { snapToGrid = snap; }
    else { console.warn("toggleSnapToGrid appelé avec un argument invalide:", snap); }
    console.log("Magnétisme grille:", snapToGrid);
    const snapToggleCheckbox = document.getElementById('snap-toggle');
    if (snapToggleCheckbox) { snapToggleCheckbox.checked = snapToGrid; }
}

/** Retourne l'état actuel du magnétisme */
export function getSnapToGrid() {
    const snapToggleCheckbox = document.getElementById('snap-toggle');
    if (snapToggleCheckbox) { snapToGrid = snapToggleCheckbox.checked; }
    return snapToGrid;
}

/**
 * Met à jour (recrée) la grille visuelle.
 * MODIFIÉ : ENVOIE LA GRILLE EN ARRIÈRE PLAN, mais devant le guide et le fond image.
 */
export function updateGrid(zoom) {
    if (!fabricCanvas) return;
    gridLines.forEach(line => fabricCanvas.remove(line));
    gridLines = [];

    const gridToggleCheckbox = document.getElementById('grid-toggle');
    const showGrid = gridToggleCheckbox ? gridToggleCheckbox.checked : false;
    if (!showGrid) { fabricCanvas.requestRenderAll(); return; }

    const gridSize = GRID_SIZE || 10;
    const width = currentCanvasFormat.width; const height = currentCanvasFormat.height;
    if (!width || !height) return;

    const currentZoom = zoom > 0 ? zoom : 1;
    let apparentGridSizeOnScreen = gridSize * currentZoom; let gridSpacing = gridSize;
    while (apparentGridSizeOnScreen < 15 && gridSpacing < width && gridSpacing < height) { gridSpacing *= 5; apparentGridSizeOnScreen *= 5; }
    while (apparentGridSizeOnScreen > 75 && gridSpacing > 1) { gridSpacing /= 5; apparentGridSizeOnScreen /= 5; if (gridSpacing < 1) gridSpacing = 1; }
    if (gridSpacing <= 0) gridSpacing = gridSize;

    const strokeColor = '#ced4da';

    for (let x = 0; x <= width; x += gridSpacing) {
        const line = new fabric.Line([x, 0, x, height], { stroke: strokeColor, selectable: false, evented: false, excludeFromExport: true, isGridLine: true, baseStrokeWidth: 1 });
        fabricCanvas.add(line);
        gridLines.push(line); // Garder la référence
    }
    for (let y = 0; y <= height; y += gridSpacing) {
        const line = new fabric.Line([0, y, width, y], { stroke: strokeColor, selectable: false, evented: false, excludeFromExport: true, isGridLine: true, baseStrokeWidth: 1 });
        fabricCanvas.add(line);
        gridLines.push(line); // Garder la référence
    }

    // --- Ajustement Z-Index (Robuste) ---
    const planBg = fabricCanvas.getObjects().find(o => o.isPlanBackground); // Image de fond

    // 1. Envoyer le fond image tout derrière (si existe)
    if (planBg) { planBg.sendToBack(); }
    
    // 2. Envoyer le guide juste au-dessus du fond (ou tout derrière si pas de fond)
    if (pageGuideRect) {
        pageGuideRect.sendToBack();
        if (planBg) { pageGuideRect.bringForward(); }
    }
    
    // 3. Envoyer la grille juste au-dessus du guide
    gridLines.forEach(line => {
        line.sendToBack();
        if (pageGuideRect) { line.bringForward(); }
        if (planBg) { line.bringForward(); }
    });
    // Le groupe SVG et les autres objets (tags, dessins) restent au-dessus.

    updateStrokesWidth(currentZoom); // Appliquer l'épaisseur
    fabricCanvas.requestRenderAll();
}


/** Met à jour l'épaisseur des traits des objets */
export function updateStrokesWidth(zoom) {
    if (!fabricCanvas) return;
    const baseStroke = 0.5;
    const currentZoom = zoom > 0 ? zoom : 1;
    if (!isFinite(currentZoom) || currentZoom <= 0) {
        console.warn("updateStrokesWidth: zoom invalide", zoom);
        return;
    }

    fabricCanvas.getObjects().forEach(obj => {
        function applyStroke(targetObj) {
            if (!targetObj || targetObj.type === 'i-text' || targetObj.type === 'text' || !targetObj.stroke) { return; }
            
            // Cas spécifique pour le guide de page
            if (targetObj.isPageGuide) {
                targetObj.set({
                    'strokeWidth': 1 / currentZoom,
                    'strokeDashArray': [5 / currentZoom, 5 / currentZoom]
                });
                return;
            }
            // Cas spécifique pour la grille
            if (targetObj.isGridLine) {
                targetObj.set('strokeWidth', Math.max(0.5, 1 / currentZoom));
                return;
            }
            
            // Cas général pour les autres objets (dessins, SVG)
            // Si baseStrokeWidth n'est pas défini, on l'initialise
            if (targetObj.baseStrokeWidth === undefined || targetObj.baseStrokeWidth === null) {
                targetObj.baseStrokeWidth = targetObj.strokeWidth > 0 ? targetObj.strokeWidth : baseStroke;
            }
            
            // Calcule la nouvelle épaisseur basée sur le zoom, avec un minimum visuel
            let newStrokeWidth = Math.max(0.5 / currentZoom, targetObj.baseStrokeWidth / currentZoom);
            
            // Gérer les cas où le calcul donne NaN ou Infinity
            if (!isFinite(newStrokeWidth)) {
                 newStrokeWidth = 1 / currentZoom;
            }

            targetObj.set('strokeWidth', newStrokeWidth);
        }
        
        applyStroke(obj); // Appliquer à l'objet lui-même (ou groupe)
        
        // Si c'est un groupe (dessin groupé ou plan SVG), appliquer aussi aux enfants
        if (obj && obj.type === 'group' && obj._objects) {
             obj.forEachObject(applyStroke);
        }
    });
}


/**
 * Trouve une forme SVG spécifique par son ID SVG.
 * MODIFIÉ : Cherche dans le groupe SVG principal, ou dans tout le canvas s'il est dégroupé.
 */
export function findSvgShapeByCodeGeo(svgId) {
    if (!svgId || !fabricCanvas) return null;
    
    // Cherche le groupe principal *actuellement* sur le canvas
    const mainSvgGroup = fabricCanvas.getObjects().find(o => o.isSvgPlanGroup || o.customData?.isSvgPlanGroup);

    if (mainSvgGroup) {
        // Le groupe existe, chercher à l'intérieur
        return mainSvgGroup.getObjects().find(obj => obj.isSvgShape && obj.customData?.svgId === svgId) || null;
    } else {
        // Le groupe n'existe pas (dégroupé), chercher dans tous les objets
        return fabricCanvas.getObjects().find(obj => obj.isSvgShape && obj.customData?.svgId === svgId) || null;
    }
}

/** Exporte les dimensions de la "feuille" (le canvas LOGIQUE) */
export function getOriginalPlanDimensions() {
    if (!currentCanvasFormat) { return { width: 842, height: 595, viewBox: { x:0, y:0, width: 842, height: 595 } }; }
    return { width: currentCanvasFormat.width, height: currentCanvasFormat.height, viewBox: currentCanvasFormat.viewBox };
}

/**
 * Dessine ou met à jour le guide de page.
 * MODIFIÉ : ENVOIE LE GUIDE EN ARRIÈRE PLAN, mais devant le fond image.
 */
export function drawPageGuides(format) {
    if (!fabricCanvas) return;

    // Supprimer l'ancien guide s'il existe
    if (pageGuideRect) {
        fabricCanvas.remove(pageGuideRect);
        pageGuideRect = null;
    }

    const isOriginal = (format === 'Original');
    const formatData = PAGE_SIZES[format];

    // Si format "Original" ou format non trouvé, ne rien dessiner
    if (isOriginal || !formatData || !formatData.viewBox) {
        console.log("drawPageGuides: Pas de guide à dessiner pour le format", format);
        fabricCanvas.requestRenderAll();
        return;
    }

    const zoom = fabricCanvas.getZoom();
    const currentZoom = zoom > 0 ? zoom : 1;
    console.log(`Dessin du guide pour ${format}:`, formatData);

    pageGuideRect = new fabric.Rect({
        left: 0, top: 0, width: formatData.width, height: formatData.height,
        fill: 'transparent', stroke: '#adb5bd', // Couleur du trait du guide
        strokeWidth: 1 / currentZoom, baseStrokeWidth: 1,
        strokeDashArray: [5 / currentZoom, 5 / currentZoom],
        selectable: false, evented: false, excludeFromExport: true, isPageGuide: true
    });

    fabricCanvas.add(pageGuideRect);

    // --- Ajustement Z-Index (Robuste) ---
    const planBg = fabricCanvas.getObjects().find(o => o.isPlanBackground); // Image de fond
    
    pageGuideRect.sendToBack(); // Envoyer derrière
    
    if (planBg) {
        planBg.sendToBack();      // S'assurer que l'image est tout derrière
        pageGuideRect.bringForward(); // Mettre le guide juste au-dessus de l'image
    }
    // La grille (si dessinée ensuite par updateGrid) viendra se placer au-dessus du guide

    fabricCanvas.requestRenderAll();
    console.log("Guide ajouté/MAJ et placé derrière les objets interactifs.");
}

/** Retourne les dimensions PHYSIQUES du canvas */
export function getCanvasDimensions() {
    if (fabricCanvas) { return { width: fabricCanvas.getWidth(), height: fabricCanvas.getHeight() }; }
    return { width: 0, height: 0 };
}

/** Change le format LOGIQUE du canvas */
export function setCanvasFormat(newFormatKey) {
    if (!fabricCanvas || !PAGE_SIZES[newFormatKey]) { return; }
    const newFormat = PAGE_SIZES[newFormatKey];
    if (newFormat === currentCanvasFormat) { return; }
    currentCanvasFormat = newFormat;
    console.log(`Changement du format logique vers ${newFormatKey}: ${newFormat.width}x${newFormat.height}`);
    window.originalSvgWidth = newFormat.width; window.originalSvgHeight = newFormat.height; window.originalSvgViewBox = newFormat.viewBox;

    // --- RECENTRAGE DU PLAN EXISTANT (Image ou SVG) ---
    // Trouver le fond (image) ou le groupe SVG principal
    const planElements = fabricCanvas.getObjects().filter(o => o.isPlanBackground || o.isSvgPlanGroup || o.customData?.isSvgPlanGroup);
    
    let planGroupToResize = null;
    if (planElements.length === 1) {
         planGroupToResize = planElements[0];
    } else if (planElements.length > 1) {
         // Cas étrange (ex: image + groupe SVG ?), on ne redimensionne que le groupe SVG
         planGroupToResize = fabricCanvas.getObjects().find(o => o.isSvgPlanGroup || o.customData?.isSvgPlanGroup);
    } else if (planType === 'svg') {
         // Plan SVG dégroupé ? On groupe temporairement les formes SVG pour les redimensionner
         const svgShapes = fabricCanvas.getObjects().filter(o => o.isSvgShape);
         if(svgShapes.length > 0) {
              planGroupToResize = new fabric.Group(svgShapes, { excludeFromExport: true });
              // Ne pas ajouter ce groupe temporaire au canvas, juste l'utiliser pour les calculs
         }
    }

    if (planGroupToResize) {
        console.log("Recentrage/Redimensionnement du plan existant pour le nouveau format.");
        
        // Utiliser getBoundingRect pour obtenir les dimensions actuelles
        const currentBounds = planGroupToResize.getBoundingRect();
        const currentWidth = currentBounds.width;
        const currentHeight = currentBounds.height;
        const currentCenterX = currentBounds.left + currentWidth / 2;
        const currentCenterY = currentBounds.top + currentHeight / 2;

        if (currentWidth > 0 && currentHeight > 0) {
            const padding = 20;
            const safeCanvasWidth = newFormat.width - padding * 2;
            const safeCanvasHeight = newFormat.height - padding * 2;
            
            const scaleX = safeCanvasWidth > 0 ? safeCanvasWidth / currentWidth : 1;
            const scaleY = safeCanvasHeight > 0 ? safeCanvasHeight / currentHeight : 1;
            const newScale = Math.min(scaleX, scaleY); // Garder les proportions
            
            const newCenterX = newFormat.width / 2;
            const newCenterY = newFormat.height / 2;

            // Appliquer la nouvelle échelle et la nouvelle position
            // Si c'est un groupe temporaire, on doit le faire sur les objets enfants
            if (planGroupToResize.excludeFromExport) { // C'est notre groupe temporaire
                 planGroupToResize.getObjects().forEach(obj => {
                      const objRelLeft = obj.left - currentCenterX;
                      const objRelTop = obj.top - currentCenterY;

                      obj.scaleX *= newScale;
                      obj.scaleY *= newScale;
                      obj.left = newCenterX + (objRelLeft * newScale);
                      obj.top = newCenterY + (objRelTop * newScale);
                      obj.setCoords();
                 });
                 planGroupToResize.destroy(); // Détruire le groupe temporaire
            } else {
                 // C'est le groupe SVG principal ou l'image
                 planGroupToResize.scaleX *= newScale;
                 planGroupToResize.scaleY *= newScale;
                 planGroupToResize.left = newCenterX - (currentWidth * newScale / 2) + (planGroupToResize.left - currentBounds.left) * newScale;
                 planGroupToResize.top = newCenterY - (currentHeight * newScale / 2) + (planGroupToResize.top - currentBounds.top) * newScale;
                 planGroupToResize.setCoords();
            }
            console.log("Plan existant recentré.");
        }
    }
    // --- FIN RECENTRAGE ---

    resetZoom(); // Applique le nouveau format et redessine guide/grille derrière
    fabricCanvas.requestRenderAll();
}
