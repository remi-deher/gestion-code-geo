/**
 * Module pour la gestion du canvas Fabric.js, incluant initialisation,
 * chargement des plans (SVG/Image), redimensionnement, zoom, grille, verrouillage,
 * et guides de page.
 *
 * MODIFIÉ pour utiliser un CANVAS FIXE (ex: A4/A3) comme référentiel
 * et pour charger le SVG/Image comme un groupe/objet mis à l'échelle.
 */
import { GRID_SIZE } from '../modules/config.js'; // Importe la taille de la grille
import { showToast } from '../modules/utils.js'; // Importe la fonction pour afficher les notifications

let fabricCanvas = null;
let canvasContainer = null;
let canvasElement = null;
let isLocked = false; // État du verrouillage du plan SVG
let snapToGrid = false; // État du magnétisme

// --- Dimensions des Pages (Référentiel) ---
const PAGE_SIZES = {
    'A4-P': { width: 595, height: 842, viewBox: { x: 0, y: 0, width: 595, height: 842 } },
    'A4-L': { width: 842, height: 595, viewBox: { x: 0, y: 0, width: 842, height: 595 } },
    'A3-P': { width: 842, height: 1191, viewBox: { x: 0, y: 0, width: 842, height: 1191 } },
    'A3-L': { width: 1191, height: 842, viewBox: { x: 0, y: 0, width: 1191, height: 842 } },
    'Original': { width: null, height: null, viewBox: null } // Ne sera plus utilisé pour le canvas
};

// --- Format fixe par défaut ---
const DEFAULT_FORMAT = PAGE_SIZES['A4-L'];

// Variables
let svgObjects = [];
let gridLines = [];
let pageGuideRect = null; // Référence au rectangle de guide de page


/**
 * Initialise le canvas Fabric.js avec une TAILLE FIXE.
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
            // --- MODIFIÉ : Utilisation de dimensions fixes par défaut ---
            width: DEFAULT_FORMAT.width,
            height: DEFAULT_FORMAT.height,
            // --- FIN MODIF ---
            backgroundColor: '#f8f9fa',
            fireRightClick: true,
            stopContextMenu: true,
            preserveObjectStacking: true
        });
        
        // --- AJOUT : Définir le référentiel stable global ---
        // Ces variables sont utilisées par utils.js pour les calculs en %
        window.originalSvgWidth = DEFAULT_FORMAT.width;
        window.originalSvgHeight = DEFAULT_FORMAT.height;
        window.originalSvgViewBox = DEFAULT_FORMAT.viewBox;
        // --- FIN AJOUT ---

        // Optimisations
        fabricCanvas.renderAndReset = function() {
            this.requestRenderAll();
            return this;
        };

        // Redimensionne le *viewport* (zoom) lorsque la fenêtre change
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas(); // Appel initial pour centrer/zoomer

        console.log(`Canvas Fabric initialisé. Taille FIXE: ${DEFAULT_FORMAT.width}x${DEFAULT_FORMAT.height}`);
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
 * MODIFIÉ : Ne redimensionne PLUS le canvas, ajuste seulement le viewport (zoom/pan).
 */
export function resizeCanvas() {
    if (fabricCanvas && canvasContainer) {
        // --- SUPPRIMÉ ---
        // fabricCanvas.setWidth(canvasContainer.clientWidth);
        // fabricCanvas.setHeight(canvasContainer.clientHeight);
        // --- FIN SUPPRIMÉ ---
        
        fabricCanvas.calcOffset(); // Recalcule la position du canvas sur la page
        
        // --- AJOUT ---
        // Ajuste le zoom pour 'fitter' le canvas fixe dans le conteneur
        resetZoom(); 
        // --- FIN AJOUT ---
        
        updateGrid(fabricCanvas.getZoom()); // Redessine la grille
        // fabricCanvas.renderAll(); // resetZoom() s'en charge
    }
}

/**
 * Charge un plan SVG.
 * MODIFIÉ : Charge le SVG comme un groupe, le centre et le redimensionne
 * pour s'adapter au canvas fixe (A4/A3...).
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
                fabricCanvas.clear();
                svgObjects = [];

                // --- Dimensions du SVG chargé ---
                const originalSvgWidth = options.width;
                const originalSvgHeight = options.height;
                const originalSvgViewBox = options.viewBox || null;
                const tempGroup = fabric.util.groupSVGElements(objects, options);
                const svgBoundingBox = tempGroup.getBoundingRect();

                const svgWidth = originalSvgViewBox?.width || originalSvgWidth || svgBoundingBox.width;
                const svgHeight = originalSvgViewBox?.height || originalSvgHeight || svgBoundingBox.height;

                if (!svgWidth || !svgHeight) {
                     console.error("Impossible de déterminer les dimensions du SVG chargé.", options);
                     return reject(new Error("Dimensions du SVG non reconnues."));
                }
                
                // --- Dimensions du Canvas FIXE (notre "feuille") ---
                const canvasWidth = fabricCanvas.getWidth(); // (ex: 842)
                const canvasHeight = fabricCanvas.getHeight(); // (ex: 595)

                // --- Calcul pour centrer/fitter le SVG dans le Canvas ---
                const padding = 20; // Marge visuelle
                const scaleX = (canvasWidth - padding * 2) / svgWidth;
                const scaleY = (canvasHeight - padding * 2) / svgHeight;
                const scale = Math.min(scaleX, scaleY); // "Fit"
                const left = (canvasWidth - (svgWidth * scale)) / 2;
                const top = (canvasHeight - (svgHeight * scale)) / 2;

                // Applique les propriétés (non sélectionnable, etc.) aux objets
                objects.forEach(obj => {
                    obj.isSvgShape = true;
                    obj.customData = { ...obj.customData, svgId: obj.id || null };
                    obj.set({
                        selectable: !isLocked, // Modifiable si non verrouillé
                        evented: true,
                        hasControls: !isLocked,
                        hasBorders: !isLocked,
                        lockMovementX: isLocked,
                        lockMovementY: isLocked
                    });
                    svgObjects.push(obj); // Garde la référence
                });

                // Créer un groupe pour le plan
                const planGroup = new fabric.Group(objects, {
                    left: left,
                    top: top,
                    scaleX: scale,
                    scaleY: scale,
                    originX: 'left',
                    originY: 'top',
                    // Le groupe lui-même n'est pas sélectionnable
                    selectable: false,
                    // Mais il laisse passer les clics vers ses enfants (les formes SVG)
                    evented: true, 
                    isPlanBackground: true // Marqueur personnalisé
                });
                
                fabricCanvas.add(planGroup);
                planGroup.sendToBack(); // Mettre le plan en arrière-plan
                // --- FIN MODIF ---

                updateGrid(fabricCanvas.getZoom());
                fabricCanvas.requestRenderAll();
                resetZoom(); // Centre la vue sur le canvas fixe
                console.log(`${svgObjects.length} objets SVG ajoutés (groupés) au canvas.`);
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
 * Charge une image de fond.
 * MODIFIÉ : Charge l'image comme un objet (pas un fond) et la centre/redimensionne
 * pour s'adapter au canvas fixe.
 * @param {string} imageUrl - L'URL de l'image.
 * @returns {Promise<void>}
 */
export async function loadPlanImage(imageUrl) {
    if (!fabricCanvas) return Promise.reject(new Error("Canvas non initialisé"));
    console.log(`Chargement de l'image (objet) depuis ${imageUrl}`);

    return new Promise((resolve, reject) => {
        fabric.Image.fromURL(imageUrl, (img) => {
            if (!fabricCanvas) return reject(new Error("Canvas non prêt après chargement image"));
            fabricCanvas.clear();
            svgObjects = [];

            // --- Dimensions de l'image chargée ---
            const imgWidth = img.width;
            const imgHeight = img.height;

            // --- Dimensions du Canvas FIXE (notre "feuille") ---
            const canvasWidth = fabricCanvas.getWidth();
            const canvasHeight = fabricCanvas.getHeight();

            // --- Calcul pour centrer/fitter l'Image dans le Canvas ---
            const padding = 20; // Marge visuelle
            const scaleX = (canvasWidth - padding * 2) / imgWidth;
            const scaleY = (canvasHeight - padding * 2) / imgHeight;
            const scale = Math.min(scaleX, scaleY);
            const left = (canvasWidth - (imgWidth * scale)) / 2;
            const top = (canvasHeight - (imgHeight * scale)) / 2;
            
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
                isPlanBackground: true // Marqueur
            });

            // --- SUPPRIMÉ ---
            // fabricCanvas.setBackgroundImage(img, ...);
            // --- FIN SUPPRIMÉ ---
            
            // --- AJOUT ---
            fabricCanvas.add(img);
            img.sendToBack();
            // --- FIN AJOUT ---

            updateGrid(fabricCanvas.getZoom());
            fabricCanvas.requestRenderAll();
            resetZoom();
            console.log(`Image chargée (objet). Dimensions: ${imgWidth}x${imgHeight}`);
            resolve();
        }, { crossOrigin: 'anonymous' });
    });
}


/**
 * MODIFIÉ : Ajuste le zoom et le pan pour afficher le CANVAS FIXE entier
 * (et non plus le SVG).
 */
export function resetZoom() {
    if (!fabricCanvas || !canvasContainer) return;

    const containerWidth = canvasContainer.clientWidth;
    const containerHeight = canvasContainer.clientHeight;
    const padding = 20; // Espace (en pixels) entre le bord du conteneur et le canvas

    // --- MODIFIÉ : Utiliser les dimensions du canvas fixe ---
    let planWidth = fabricCanvas.getWidth(); // ex: 842
    let planHeight = fabricCanvas.getHeight(); // ex: 595
    let planOffsetX = 0; // Le canvas fixe commence à 0
    let planOffsetY = 0; // Le canvas fixe commence à 0
    
    console.log(`ResetZoom: Utilisation des dimensions du canvas fixe: ${planWidth}x${planHeight}`);
    // --- FIN MODIF ---

    // Calcul du scale pour faire rentrer le canvas fixe dans le conteneur
    const scaleX = (containerWidth - padding * 2) / planWidth;
    const scaleY = (containerHeight - padding * 2) / planHeight;
    const scale = Math.min(scaleX, scaleY);

    // Calcul du Pan pour centrer le canvas fixe
    const panX = (containerWidth - (planWidth * scale)) / 2;
    const panY = (containerHeight - (planHeight * scale)) / 2;

    fabricCanvas.setViewportTransform([scale, 0, 0, scale, panX, panY]);

    console.log(`ResetZoom: Viewport ajusté. Scale: ${scale.toFixed(3)}, Pan: (${panX.toFixed(1)}, ${panY.toFixed(1)})`);

    updateGrid(scale);
    updateStrokesWidth(scale);
    fabricCanvas.requestRenderAll();
}

/**
 * Zoom/Dézoom le canvas sur un point donné ou sur le centre.
 * (Fonction inchangée)
 */
export function zoomCanvas(factor, point = null) {
    if (!fabricCanvas) return;
    const currentZoom = fabricCanvas.getZoom();
    let newZoom = currentZoom * factor;

    const minZoom = 0.05;
    const maxZoom = 20;
    if (newZoom < minZoom) newZoom = minZoom;
    if (newZoom > maxZoom) newZoom = maxZoom;

    if (newZoom === currentZoom) return;

    if (!point) {
        point = fabricCanvas.getVpCenter();
    }

    fabricCanvas.zoomToPoint(point, newZoom);
}


/**
 * Verrouille ou déverrouille les éléments SVG du plan.
 * (Fonction inchangée)
 */
export function setCanvasLock(lock) {
    isLocked = lock;
    console.log("Verrouillage SVG:", isLocked);
    
    // Cible les objets dans le groupe 'isPlanBackground'
    const planGroup = fabricCanvas.getObjects().find(o => o.isPlanBackground);
    
    if (planGroup && planGroup.type === 'group') {
        planGroup.getObjects().forEach(obj => {
             obj.set({
                selectable: !isLocked,
                lockMovementX: isLocked,
                lockMovementY: isLocked,
                hasControls: !isLocked,
                hasBorders: !isLocked,
                evented: true,
            });
        });
    } else if (planGroup) {
        // Gère le cas d'une image (qui n'est pas un groupe)
         planGroup.set({
            selectable: false, // Une image de fond ne doit jamais être sélectionnable
            evented: false,
        });
    }

    if (isLocked) {
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj && activeObj.isSvgShape) {
            fabricCanvas.discardActiveObject();
        }
    }
    fabricCanvas.requestRenderAll();
}

/** Retourne l'état actuel du verrouillage SVG. (Fonction inchangée) */
export function getCanvasLock() {
    return isLocked;
}

/** Active/Désactive l'affichage de la grille. (Fonction inchangée) */
export function toggleGridDisplay(show) {
    const gridToggleCheckbox = document.getElementById('grid-toggle');
    if(gridToggleCheckbox) gridToggleCheckbox.checked = show;
    updateGrid(fabricCanvas.getZoom());
}

/** Active/Désactive le magnétisme à la grille. (Fonction inchangée) */
export function toggleSnapToGrid(snap) {
    if (snap instanceof Event && snap.target) {
        snapToGrid = snap.target.checked;
    } else if (typeof snap === 'boolean') {
        snapToGrid = snap;
    }
    console.log("Magnétisme grille:", snapToGrid);
    const snapToggleCheckbox = document.getElementById('snap-toggle');
    if (snapToggleCheckbox) {
        snapToggleCheckbox.checked = snapToGrid;
    }
}

/** Retourne l'état actuel du magnétisme. (Fonction inchangée) */
export function getSnapToGrid() {
    const snapToggleCheckbox = document.getElementById('snap-toggle');
    if (snapToggleCheckbox) {
        snapToGrid = snapToggleCheckbox.checked;
    }
    return snapToGrid;
}

/**
 * Met à jour (recrée) la grille visuelle en fonction du zoom.
 * (Fonction inchangée)
 */
export function updateGrid(zoom) {
    if (!fabricCanvas || !canvasContainer) return;

    gridLines.forEach(line => fabricCanvas.remove(line));
    gridLines = [];

    const gridToggleCheckbox = document.getElementById('grid-toggle');
    const showGrid = gridToggleCheckbox ? gridToggleCheckbox.checked : false;

    if (!showGrid) {
        fabricCanvas.requestRenderAll();
        return;
    }

    const gridSize = GRID_SIZE || 10;
    
    // --- MODIFIÉ : La grille doit couvrir le canvas fixe, pas le viewport ---
    const width = fabricCanvas.getWidth(); // Largeur fixe (ex: 842)
    const height = fabricCanvas.getHeight(); // Hauteur fixe (ex: 595)
    
    let apparentGridSizeOnScreen = gridSize * zoom;
    let gridSpacing = gridSize;

    // Ajuste l'espacement pour garder la grille lisible
    while (apparentGridSizeOnScreen < 15 && gridSpacing < 10000) {
        gridSpacing *= 5;
        apparentGridSizeOnScreen *= 5;
    }
     while (apparentGridSizeOnScreen > 75 && gridSpacing > 1) {
        gridSpacing /= 5;
        apparentGridSizeOnScreen /= 5;
    }

    const strokeColor = '#ced4da';
    const strokeWidth = 1 / zoom; // Reste dépendant du zoom pour la visibilité

    // Dessine la grille sur toute la taille du canvas fixe (0,0 à width,height)
    for (let x = 0; x <= width; x += gridSpacing) {
        const line = new fabric.Line([x, 0, x, height], {
            stroke: strokeColor, strokeWidth: strokeWidth,
            selectable: false, evented: false,
            isGridLine: true, visible: true
        });
        fabricCanvas.add(line);
        gridLines.push(line);
    }
    for (let y = 0; y <= height; y += gridSpacing) {
        const line = new fabric.Line([0, y, width, y], {
            stroke: strokeColor, strokeWidth: strokeWidth,
            selectable: false, evented: false,
            isGridLine: true, visible: true
        });
        fabricCanvas.add(line);
        gridLines.push(line);
    }
    // --- FIN MODIF ---

    gridLines.forEach(line => line.sendToBack());
    fabricCanvas.requestRenderAll();
}


/**
 * Met à jour l'épaisseur des traits des objets en fonction du zoom.
 * (Fonction inchangée)
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
 * (Fonction inchangée)
 */
export function findSvgShapeByCodeGeo(svgId) {
    if (!svgId) return null;
    
    // Cible les objets dans le groupe 'isPlanBackground'
    const planGroup = fabricCanvas.getObjects().find(o => o.isPlanBackground);
    
    if (planGroup && planGroup.type === 'group') {
        return planGroup.getObjects().find(obj => obj.customData?.svgId === svgId) || null;
    }
    
    return null; // Ne cherche pas en dehors du groupe
}

/**
 * Exporte les dimensions de la "feuille" (le canvas fixe).
 * Utilisé par main.js pour la sauvegarde SVG.
 * @returns {object} { width, height, viewBox }
 */
export function getOriginalPlanDimensions() {
    // MODIFIÉ : Retourne les dimensions du canvas fixe
    const width = fabricCanvas.getWidth();
    const height = fabricCanvas.getHeight();
     return {
         width: width,
         height: height,
         viewBox: { x: 0, y: 0, width: width, height: height }
     };
}

/**
 * Dessine un rectangle en pointillés représentant le format de page sélectionné.
 * (Fonction inchangée, elle dessine juste un guide visuel)
 */
export function drawPageGuides(format) {
    if (!fabricCanvas) return;

    if (pageGuideRect) {
        fabricCanvas.remove(pageGuideRect);
        pageGuideRect = null;
    }

    const isOriginal = (format === 'Original');
    const formatData = PAGE_SIZES[format];
    const hasValidFormatData = !!formatData;
    const hasViewBox = hasValidFormatData && !!formatData.viewBox;

    if (isOriginal || !hasValidFormatData || !hasViewBox) {
        fabricCanvas.requestRenderAll();
        return;
    }

    const sizeInfo = PAGE_SIZES[format];
    const viewBox = sizeInfo.viewBox;
    const zoom = fabricCanvas.getZoom();

    console.log(`Dessin du guide pour ${format}:`, sizeInfo);

    pageGuideRect = new fabric.Rect({
        left: viewBox.x,
        top: viewBox.y,
        width: viewBox.width,
        height: viewBox.height,
        fill: 'transparent',
        stroke: '#adb5bd',
        strokeWidth: 1 / zoom,
        baseStrokeWidth: 1,
        strokeDashArray: [5 / zoom, 5 / zoom],
        selectable: false,
        evented: false,
        isPageGuide: true
    });

    fabricCanvas.add(pageGuideRect);
    console.log("Guide ajouté au canvas:", pageGuideRect);

    pageGuideRect.sendToBack();
    fabricCanvas.requestRenderAll();
    console.log("Rendu demandé après ajout/mise à jour du guide.");
}

/**
 * MODIFIÉ : Retourne les dimensions FIXES du canvas (la "feuille").
 * Ces dimensions sont utilisées comme référence pour les calculs en pourcentage.
 * @returns {Object} Un objet { width, height }
 */
export function getCanvasDimensions() {
    if (fabricCanvas) {
        return {
            width: fabricCanvas.getWidth(),
            height: fabricCanvas.getHeight()
        };
    }
    // Fallback si le canvas n'est pas prêt
    console.warn("getCanvasDimensions: Canvas non prêt, retour au format par défaut.");
    return {
        width: DEFAULT_FORMAT.width,
        height: DEFAULT_FORMAT.height
    };
}
