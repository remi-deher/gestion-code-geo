/**
 * Module pour la gestion du canvas Fabric.js, incluant initialisation,
 * chargement des plans (SVG/Image), redimensionnement, zoom, grille, verrouillage.
 */
import { GRID_SIZE } from '../modules/config.js'; // Importe la taille de la grille
import { showToast } from '../modules/utils.js'; // Importe la fonction pour afficher les notifications

let fabricCanvas = null;
let canvasContainer = null;
let canvasElement = null;
let isLocked = false; // État du verrouillage du plan SVG
let showGrid = true; // État d'affichage de la grille
let snapToGrid = true; // État du magnétisme

// --- AJOUT : Dimensions des Pages ---
const PAGE_SIZES = {
    'A4_Portrait': { width: 595, height: 842, viewBox: { x: 0, y: 0, width: 595, height: 842 } },
    'A4_Landscape': { width: 842, height: 595, viewBox: { x: 0, y: 0, width: 842, height: 595 } },
    'A3_Portrait': { width: 842, height: 1191, viewBox: { x: 0, y: 0, width: 842, height: 1191 } },
    'A3_Landscape': { width: 1191, height: 842, viewBox: { x: 0, y: 0, width: 1191, height: 842 } },
    'Original': { width: null, height: null, viewBox: null } // Pour garder les dimensions chargées
};
// --- FIN AJOUT ---

// --- AJOUT : Variables globales pour stocker les dimensions du SVG chargé ---
let originalSvgWidth = null;
let originalSvgHeight = null;
let originalSvgViewBox = null; // Format attendu: { x: number, y: number, width: number, height: number }
let svgBoundingBox = null; // Bounding box calculée des objets (fallback)
// --- FIN AJOUT ---

// Références aux objets SVG et lignes de grille
let svgObjects = [];
let gridLines = [];

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

                // --- MODIFICATION : Stockage des dimensions lues ---
                originalSvgWidth = options.width;
                originalSvgHeight = options.height;
                // Fabric.js parse le viewBox en { x, y, width, height }
                originalSvgViewBox = options.viewBox || null;
                // Stocke sur window pour accès facile depuis main.js (ou autre module)
                window.originalSvgWidth = originalSvgWidth;
                window.originalSvgHeight = originalSvgHeight;
                window.originalSvgViewBox = originalSvgViewBox;
                console.log("SVG chargé. Dimensions lues:", { width: originalSvgWidth, height: originalSvgHeight, viewBox: originalSvgViewBox });
                // --- FIN MODIFICATION ---

                // Calcule la bounding box une fois si besoin (fallback pour zoom)
                const tempGroup = fabric.util.groupSVGElements(objects, options);
                svgBoundingBox = tempGroup.getBoundingRect();
                console.log("Bounding Box SVG calculée:", svgBoundingBox);

                // Ajoute les objets SVG au canvas individuellement
                objects.forEach(obj => {
                    // Marque l'objet comme faisant partie du SVG de base
                    obj.isSvgShape = true;
                    // Stocke l'ID SVG s'il existe (pourrait être utile pour les ancres)
                    obj.customData = { ...obj.customData, svgId: obj.id || null };
                    // Rend non sélectionnable par défaut (sera géré par setCanvasLock)
                    obj.set({
                        selectable: false,
                        evented: true, // Garde 'evented' pour détecter les clics même si non sélectionnable
                        hasControls: false, // Pas de contrôles de redimensionnement/rotation
                        hasBorders: false, // Pas de bordures de sélection
                        lockMovementX: true, // Empêche le déplacement par défaut
                        lockMovementY: true
                    });
                    fabricCanvas.add(obj);
                    svgObjects.push(obj); // Garde une référence
                });

                updateGrid(fabricCanvas.getZoom()); // Dessine la grille par-dessus
                fabricCanvas.requestRenderAll();
                resetZoom(); // Ajuste le zoom initial APRES ajout des objets
                console.log(`${svgObjects.length} objets SVG ajoutés individuellement au canvas.`);
                resolve(); // Terminé avec succès
            });
        });

    } catch (error) {
        console.error("Erreur lors du chargement ou parsing SVG:", error);
        showToast(`Erreur chargement plan: ${error.message}`, 'danger');
        resizeCanvas(); // Assure que le canvas vide a la bonne taille
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
            fabricCanvas.clear(); // Nettoie avant
            svgObjects = []; // Vide la liste des objets SVG

            // --- MODIFICATION : Stockage des dimensions lues ---
            originalSvgWidth = img.width;
            originalSvgHeight = img.height;
            originalSvgViewBox = { x: 0, y: 0, width: img.width, height: img.height }; // Simule un viewBox
            window.originalSvgWidth = originalSvgWidth;
            window.originalSvgHeight = originalSvgHeight;
            window.originalSvgViewBox = originalSvgViewBox;
            svgBoundingBox = { left: 0, top: 0, width: img.width, height: img.height }; // La BBox est l'image elle-même
            console.log("Image chargée. Dimensions:", { width: originalSvgWidth, height: originalSvgHeight });
            // --- FIN MODIFICATION ---

            // Configure l'image comme fond non sélectionnable
            img.set({
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false, // Ne réagit pas aux événements souris
                hasControls: false,
                hasBorders: false
            });

            // Met l'image en arrière-plan
            fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {
                 // Options pour l'arrière-plan si nécessaire
            });

            updateGrid(fabricCanvas.getZoom()); // Dessine la grille
            resetZoom(); // Ajuste le zoom initial
            resolve();
        }, { crossOrigin: 'anonymous' }); // Nécessaire si l'image vient d'un autre domaine
    });
}


/**
 * Ajuste le zoom et le pan pour afficher le plan entier.
 * MODIFIÉ pour utiliser viewBox ou width/height en priorité.
 */
export function resetZoom() {
    if (!fabricCanvas || !canvasContainer) return;

    const containerWidth = canvasContainer.clientWidth;
    const containerHeight = canvasContainer.clientHeight;

    let planWidth = containerWidth;  // Fallback
    let planHeight = containerHeight; // Fallback
    let planOffsetX = 0; // Décalage X du viewBox
    let planOffsetY = 0; // Décalage Y du viewBox

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
        // Pas d'offset connu si on utilise width/height seuls
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
        // Garde planWidth/Height = containerWidth/Height, offset = 0
    }

    // Calcul du scale pour faire rentrer le plan dans le conteneur
    const scaleX = containerWidth / planWidth;
    const scaleY = containerHeight / planHeight;
    const scale = Math.min(scaleX, scaleY) * 0.98; // Applique une petite marge (98%)

    // Calcule le centre du plan (basé sur le viewBox ou la BBox utilisée)
    const planCenterX = planOffsetX + planWidth / 2;
    const planCenterY = planOffsetY + planHeight / 2;

    // Point central du plan dans les coordonnées du canvas (avant zoom/pan)
    const centerPoint = new fabric.Point(planCenterX, planCenterY);

    // Zoome sur ce point central avec le scale calculé
    fabricCanvas.zoomToPoint(centerPoint, scale);

    // Ajuste le pan final pour que le centre du plan soit exactement au centre du viewport
    // zoomToPoint fait une partie du travail, mais cet ajustement peut être nécessaire
    // surtout si le point central n'était pas (0,0)
    const vpt = fabricCanvas.viewportTransform;
    // vpt[4] = panX, vpt[5] = panY
    vpt[4] = (containerWidth / 2) - (planCenterX * scale);
    vpt[5] = (containerHeight / 2) - (planCenterY * scale);
    fabricCanvas.setViewportTransform(vpt);

    console.log(`ResetZoom: Viewport ajusté. Scale: ${scale.toFixed(3)}, Pan: (${vpt[4].toFixed(1)}, ${vpt[5].toFixed(1)})`);

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
    const newZoom = currentZoom * factor;

    // Limites de zoom (optionnel)
    const minZoom = 0.05;
    const maxZoom = 20;
    if (newZoom < minZoom || newZoom > maxZoom) {
        return; // Ne pas dépasser les limites
    }

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
            selectable: !isLocked, // Sélectionnable si déverrouillé
            lockMovementX: isLocked, // Déplacement verrouillé si verrouillé
            lockMovementY: isLocked,
            hasControls: !isLocked, // Contrôles visibles si déverrouillé (peut être toujours false)
            hasBorders: !isLocked, // Bordures visibles si déverrouillé
            // Garde evented: true pour pouvoir cliquer dessus (ex: pour placement texte)
        });
    });
    // Si on verrouille, désélectionner l'objet actif s'il fait partie du SVG
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

/** Active/Désactive l'affichage de la grille. */
export function toggleGridDisplay(show) {
    showGrid = show;
    gridLines.forEach(line => line.set({ visible: showGrid }));
    fabricCanvas.requestRenderAll();
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

    // Ne pas afficher si showGrid est false
    if (!showGrid) {
        fabricCanvas.requestRenderAll();
        return;
    }

    const gridSize = GRID_SIZE || 10; // Taille de base de la grille
    const width = fabricCanvas.getWidth();
    const height = fabricCanvas.getHeight();

    // Calcule la taille de la grille apparente et l'espacement
    // L'objectif est d'avoir environ 10-20 lignes visibles
    let apparentGridSize = gridSize * zoom;
    let gridSpacing = gridSize;

    // Ajuste l'espacement si la grille devient trop dense ou trop espacée
    while (apparentGridSize < 15 && gridSpacing < 10000) { // Limite supérieure pour éviter boucle infinie
        gridSpacing *= 5;
        apparentGridSize *= 5;
    }
     while (apparentGridSize > 75 && gridSpacing > 1) { // Limite inférieure
        gridSpacing /= 5;
        apparentGridSize /= 5;
    }

    const strokeColor = '#ced4da'; // Couleur de la grille
    const strokeWidth = 1 / zoom; // Épaisseur constante quelle que soit le zoom

    // Coordonnées du viewport actuel
    const vpt = fabricCanvas.viewportTransform;
    const panX = vpt[4];
    const panY = vpt[5];

    // Calcul des limites visibles en coordonnées canvas (non zoomées)
    const startX = -panX / zoom;
    const startY = -panY / zoom;
    const endX = startX + width / zoom;
    const endY = startY + height / zoom;

    // Calcule le premier multiple de gridSpacing visible
    const firstGridX = Math.ceil(startX / gridSpacing) * gridSpacing;
    const firstGridY = Math.ceil(startY / gridSpacing) * gridSpacing;

    // Crée les lignes verticales
    for (let x = firstGridX; x <= endX; x += gridSpacing) {
        const line = new fabric.Line([x, startY, x, endY], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            selectable: false,
            evented: false,
            isGridLine: true, // Marqueur pour l'ignorer ailleurs
            visible: showGrid
        });
        fabricCanvas.add(line);
        gridLines.push(line);
    }

    // Crée les lignes horizontales
    for (let y = firstGridY; y <= endY; y += gridSpacing) {
        const line = new fabric.Line([startX, y, endX, y], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            selectable: false,
            evented: false,
            isGridLine: true,
            visible: showGrid
        });
        fabricCanvas.add(line);
        gridLines.push(line);
    }

    // Envoie les lignes de la grille à l'arrière-plan, mais au-dessus de l'image de fond
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
        // Applique seulement aux objets qui ont une épaisseur de base définie
        // et qui ne sont pas des textes (gérés par fontSize) ou la grille
        if (obj.baseStrokeWidth && obj.type !== 'i-text' && obj.type !== 'text' && !obj.isGridLine) {
            obj.set('strokeWidth', obj.baseStrokeWidth / zoom);
        }
    });
    // Note: Pas besoin de renderAll ici, car viewport:transformed le déclenche déjà
}

/**
 * Trouve une forme SVG spécifique par son ID SVG.
 * Utilisé pour ancrer les textes géo sur les plans SVG.
 * @param {string} svgId - L'ID de l'élément SVG recherché.
 * @returns {fabric.Object|null} L'objet Fabric correspondant ou null.
 */
export function findSvgShapeByCodeGeo(svgId) {
    if (!svgId) return null;
    return svgObjects.find(obj => obj.customData?.svgId === svgId) || null;
}
