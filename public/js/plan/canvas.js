/**
 * Module pour la gestion du canvas Fabric.js, du fond, du zoom/pan et de la grille.
 * VERSION MISE A JOUR: Chargement SVG individuel, calcul BBox, verrouillage.
 */
import { MIN_ZOOM, MAX_ZOOM, GRID_SIZE } from '../modules/config.js';
import { snapToGridValue } from '../modules/utils.js';

let fabricCanvas;
let isPanning = false;
let lastPosX, lastPosY;
let gridLines = [];
let isGridVisible = false;
let isSnapEnabled = false;
let planType = 'unknown';
let svgObjects = []; // Stocker les objets SVG chargés
let svgOriginalBBox = null; // Bounding box initiale des objets SVG

/**
 * Initialise l'instance du canvas Fabric.
 * @param {HTMLCanvasElement} canvasEl - L'élément canvas.
 * @param {string} pType - Le type de plan ('image', 'svg', 'svg_creation').
 * @returns {fabric.Canvas} L'instance du canvas.
 */
export function initializeCanvas(canvasEl, pType) {
    planType = pType;
    try {
        fabricCanvas = new fabric.Canvas(canvasEl, {
            selection: true,
            backgroundColor: '#ffffff',
            stopContextMenu: true, // Empêche le menu contextuel natif
            fireRightClick: true,  // Déclenche l'événement 'contextmenu' de Fabric
            preserveObjectStacking: true // Important pour les calques
        });
        console.log("Canvas Fabric initialisé dans canvas.js");
        return fabricCanvas;
    } catch (error) {
        console.error("Erreur fatale lors de l'initialisation de Fabric.js:", error);
        return null;
    }
}

/**
 * Retourne l'instance du canvas Fabric.
 * @returns {fabric.Canvas}
 */
export function getCanvasInstance() { return fabricCanvas; }

/**
 * Charge une image comme fond de plan (pour planType 'image').
 * @param {HTMLImageElement} mapImageEl - L'élément <img> source.
 * @returns {Promise<fabric.Image>} L'objet image de fond Fabric.
 */
export function loadBackgroundImage(mapImageEl) {
    return new Promise((resolve, reject) => {
        if (!mapImageEl) {
            return reject(new Error("L'élément image de la carte est introuvable."));
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const fabricImage = new fabric.Image(img, {
                left: 0,
                top: 0,
                selectable: false,
                evented: false,
                isSvgBackground: false
            });

            // Stocker les dimensions originales pour les conversions
            fabricImage.originalWidth = img.width;
            fabricImage.originalHeight = img.height;

            fabricCanvas.setBackgroundImage(fabricImage, fabricCanvas.renderAll.bind(fabricCanvas));
            console.log("Image de fond chargée:", img.width, "x", img.height);
            resolve(fabricImage);
        };
        img.onerror = (err) => {
            console.error("Erreur chargement image de fond:", err);
            reject(new Error("Impossible de charger l'image du plan: " + mapImageEl.src));
        };
        img.src = mapImageEl.src;
    });
}

/**
 * Charge un plan SVG comme objets individuels sur le canvas.
 * @param {string} url - URL du fichier SVG.
 * @returns {Promise<fabric.Rect>} La bounding box originale des objets chargés.
 */
export function loadSvgPlan(url) {
    console.log("Chargement du plan SVG (objets individuels) depuis", url);
    svgObjects = []; // Réinitialiser
    svgOriginalBBox = null;
    
    return new Promise((resolve, reject) => {
        fabric.loadSVGFromURL(url, (objects, options) => {
            if (!objects) {
                console.error("Échec du chargement SVG (objets null):", url);
                return reject(new Error("Impossible de charger le SVG: "L + url));
            }
            console.log(`SVG chargé, ${objects.length} objets trouvés.`);

            if (objects.length === 0) {
                 console.warn("Le fichier SVG ne contient aucun objet interprétable.");
                 // Initialiser une BBox vide pour éviter les erreurs
                 svgOriginalBBox = new fabric.Rect({ left: 0, top: 0, width: 100, height: 100 });
                 resolve(svgOriginalBBox); // Résoudre avec une BBox par défaut
                 return;
            }

            // --- NOUVEAU: Traiter chaque objet ---
            objects.forEach(obj => {
                // Configurer chaque objet SVG
                obj.set({
                    selectable: false, // Non sélectionnable par défaut (car verrouillé)
                    evented: true,    // Rendre cliquable (pour le clic droit)
                    isSvgShape: true, // Marqueur pour identification
                    lockMovementX: true, // Verrouillé par défaut
                    lockMovementY: true,
                    lockRotation: true,
                    lockScalingX: true,
                    lockScalingY: true,
                    hasControls: false, // Pas de contrôles de redimensionnement par défaut
                    borderColor: 'transparent', // Pas de bordure de sélection par défaut
                    // On garde l'origine (top-left) car c'est souvent le cas pour les SVG
                });
                fabricCanvas.add(obj);
                svgObjects.push(obj); // Garder une référence
            });

            // Calculer la Bounding Box initiale de tous les objets SVG
            // On les groupe temporairement juste pour le calcul
            const groupForBBox = new fabric.Group(svgObjects, {
                // Assurer que le groupe n'est pas ajouté au canvas
            });
            
            // Calculer la BBox. Utiliser group.getCenterPoint() et group.width/height
            // getBoundingRect() est plus fiable car il inclut les positions
            svgOriginalBBox = groupForBBox.getBoundingRect();
            
            // On détruit le groupe temporaire (optionnel, mais propre)
            groupForBBox.destroy(); 

             console.log("Bounding Box SVG Originale:", svgOriginalBBox);
             
             if (svgOriginalBBox.width === 0 || svgOriginalBBox.height === 0) {
                 console.warn("La Bounding Box du SVG est nulle. Le zoom risque d'être incorrect.", svgOriginalBBox);
                 // Fallback
                 svgOriginalBBox = new fabric.Rect({ left: 0, top: 0, width: 1000, height: 1000 });
             }

            fabricCanvas.renderAll();
            console.log("Objets SVG ajoutés individuellement au canvas.");
            
            // Renvoyer la BBox calculée
            resolve(svgOriginalBBox); 

        }, null, { crossOrigin: 'anonymous' });
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

    resetZoom(); // Réinitialise le zoom pour adapter le fond ou le SVG
}

/**
 * Réinitialise le zoom et la position du plan pour qu'il s'adapte au mieux au canvas.
 * Adapté pour SVG avec objets multiples (utilise le viewportTransform).
 */
export function resetZoom() {
    if (!fabricCanvas) return;

    if (planType === 'svg_creation') {
        // Mode création vierge, centrer l'origine
        fabricCanvas.setViewportTransform([1, 0, 0, 1, fabricCanvas.getWidth()/2, fabricCanvas.getHeight()/2]);
    } else {
        const bg = fabricCanvas.backgroundImage; // Pour type 'image'
        let contentBBox; // Bounding box du contenu à afficher

        if (bg && bg.originalWidth > 0 && bg.originalHeight > 0) { 
            // Cas 1: C'est une image de fond
            contentBBox = {
                left: bg.left,
                top: bg.top,
                width: bg.originalWidth * bg.scaleX,
                height: bg.originalHeight * bg.scaleY
            };
            // Note: Si on charge l'image sans échelle, width/height sont déjà les bonnes.
             contentBBox = {
                left: 0,
                top: 0,
                width: bg.originalWidth,
                height: bg.originalHeight
            };
        } else if (svgOriginalBBox) { 
            // Cas 2: C'est un SVG (utilise la BBox calculée au chargement)
            contentBBox = svgOriginalBBox;
        } else {
            console.warn("ResetZoom: Aucun fond (Image ou BBox SVG) à ajuster.");
            fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]); // Fallback
            if (isGridVisible) drawGrid();
            fabricCanvas.renderAll();
            return;
        }

        if (!contentBBox || contentBBox.width === 0 || contentBBox.height === 0) {
            console.warn("ResetZoom: Bounding Box du contenu invalide.", contentBBox);
            fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]); // Fallback
            if (isGridVisible) drawGrid();
            fabricCanvas.renderAll();
            return;
        }

        const canvasWidth = fabricCanvas.getWidth();
        const canvasHeight = fabricCanvas.getHeight();
        const margin = 0.95; // 5% de marge

        // Calculer l'échelle pour adapter
        const scaleX = canvasWidth / contentBBox.width;
        const scaleY = canvasHeight / contentBBox.height;
        const scale = Math.min(scaleX, scaleY) * margin;

        // Calculer la translation pour centrer
        const panX = (canvasWidth - (contentBBox.width * scale)) / 2 - (contentBBox.left * scale);
        const panY = (canvasHeight - (contentBBox.height * scale)) / 2 - (contentBBox.top * scale);

        // Appliquer la transformation au viewport
        // [scaleX, 0, 0, scaleY, panX, panY]
        fabricCanvas.setViewportTransform([scale, 0, 0, scale, panX, panY]);
         
         console.log(`ResetZoom: Viewport ajusté. Scale: ${scale.toFixed(3)}`);
    }

    updateStrokesWidth(fabricCanvas.getZoom()); // Mettre à jour l'épaisseur des traits
    if (isGridVisible) drawGrid();
    fabricCanvas.renderAll();
}

/** Retourne la Bounding Box originale du SVG chargé */
export function getSvgOriginalBBox() {
    return svgOriginalBBox;
}

// --- Fonctions de Verrouillage SVG ---
let svgLocked = true; // SVG verrouillé par défaut

/**
 * Bascule l'état de verrouillage des objets SVG natifs.
 * @param {boolean} lockState - True pour verrouiller, false pour déverrouiller.
 */
export function toggleSvgLock(lockState) {
    if (planType !== 'svg') return;
    svgLocked = lockState;
    console.log("Verrouillage SVG:", svgLocked);
    
    svgObjects.forEach(obj => {
        obj.set({
            lockMovementX: svgLocked,
            lockMovementY: svgLocked,
            lockRotation: svgLocked,
            lockScalingX: svgLocked,
            lockScalingY: svgLocked,
            selectable: !svgLocked, // Sélectionnable seulement si déverrouillé
            evented: true, // Toujours evented pour le clic droit
            borderColor: svgLocked ? 'transparent' : 'rgba(100,100,200,0.5)', // Indice visuel
            hasControls: !svgLocked, // Afficher contrôles si déverrouillé
        });
    });
    
    // Forcer la désélection si on verrouille
    if (svgLocked) {
        fabricCanvas.discardActiveObject();
    }
    fabricCanvas.renderAll();
}

/** Retourne l'état de verrouillage actuel */
export function isSvgLocked() {
    return svgLocked;
}


// --- Fonctions Zoom/Pan ---

/**
 * Zoome le canvas sur un point donné.
 * @param {number} factor - Facteur de zoom (ex: 1.1 pour zoomer, 0.9 pour dézoomer).
 * @param {fabric.Point} point - Point sur lequel zoomer (centre du canvas si non fourni).
 */
export function zoom(factor, point) {
    if (!fabricCanvas) return;
    let zoomLevel = fabricCanvas.getZoom() * factor;
    zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel));
    
    const pointToZoom = point || fabricCanvas.getCenter();
    
    fabricCanvas.zoomToPoint(pointToZoom, zoomLevel);
    updateStrokesWidth(zoomLevel);
    if (isGridVisible) drawGrid();
}

/** Gère l'événement de la molette de la souris pour le zoom */
export function handleMouseWheel(opt) {
    opt.e.preventDefault();
    opt.e.stopPropagation();

    const delta = opt.e.deltaY;
    const factor = delta > 0 ? 0.95 : 1.05; // 0.9 = dézoom, 1.1 = zoom
    const pointer = fabricCanvas.getPointer(opt.e);
    
    zoom(factor, new fabric.Point(pointer.x, pointer.y));
}

/** Démarre le mode Panning (Alt+Clic ou Ctrl+Clic) */
export function startPan(opt) {
    if ((opt.e.altKey || opt.e.ctrlKey || fabricCanvas.isDrawingMode) && !isPanning) {
        // fabricCanvas.isDrawingMode = false; // Désactiver temporairement si besoin
        isPanning = true;
        lastPosX = opt.e.clientX;
        lastPosY = opt.e.clientY;
        fabricCanvas.selection = false; // Désactiver sélection pendant pan
        fabricCanvas.defaultCursor = 'grabbing';
        fabricCanvas.renderAll();
    }
}

/** Gère le mouvement de la souris pendant le Panning */
export function handlePanMove(opt) {
    if (isPanning) {
        const e = opt.e;
        const vpt = fabricCanvas.viewportTransform;
        vpt[4] += e.clientX - lastPosX;
        vpt[5] += e.clientY - lastPosY;
        fabricCanvas.requestRenderAll();
        lastPosX = e.clientX;
        lastPosY = e.clientY;
    }
}

/** Arrête le mode Panning */
export function stopPan() {
    if (isPanning) {
        isPanning = false;
        fabricCanvas.selection = true; // Réactiver sélection
        fabricCanvas.defaultCursor = 'default';
        // fabricCanvas.isDrawingMode = (getCurrentDrawingTool() !== 'select'); // Réactiver si besoin
        fabricCanvas.renderAll();
    }
}

/**
 * Met à jour l'épaisseur des traits de tous les objets (dessins)
 * pour qu'ils restent constants visuellement quel que soit le zoom.
 * @param {number} currentZoom - Le niveau de zoom actuel.
 */
export function updateStrokesWidth(currentZoom) {
    if (!fabricCanvas) return;
    fabricCanvas.getObjects().forEach(obj => {
        
        // Objets de dessin (rect, line, circle, text...)
        // On vérifie s'ils ont un 'baseStrokeWidth' défini par nous
        if (obj.baseStrokeWidth && !obj.customData?.isGeoTag && !obj.isGridLine && !obj.isPageGuide) {
            obj.set('strokeWidth', obj.baseStrokeWidth / currentZoom);
        }
        
        // Étiquettes Géo (rectangles)
        else if (obj.customData?.isGeoTag && obj.item && obj.item(0)) {
            const rect = obj.item(0);
            const baseStroke = rect.baseStrokeWidth || 1;
            rect.set('strokeWidth', baseStroke / currentZoom);
        }
        
        // Textes Géo (IText)
        else if (obj.customData?.isPlacedText) {
            const baseStroke = obj.baseStrokeWidth || 0.5; // Doit correspondre à la création
            obj.set('strokeWidth', baseStroke / currentZoom);
            // On pourrait aussi adapter la fontSize ici si on voulait qu'elle soit fixe ?
            // const baseSize = obj.baseFontSize || 14;
            // obj.set('fontSize', baseSize / currentZoom);
        }

        // Flèches des étiquettes géo
        if (obj.customData?.isGeoTag && obj.arrowLine) {
            const baseStroke = obj.arrowLine.baseStrokeWidth || 2;
            obj.arrowLine.set('strokeWidth', baseStroke / currentZoom);
        }
        
        // Formes SVG (on ne touche pas à leur trait, il scale avec le zoom)
        else if (obj.isSvgShape) {
             // Ne rien faire, le SVG scale naturellement.
             // Si on voulait un trait fixe, il faudrait stocker 'baseStrokeWidth'
             // lors du chargement initial du SVG.
        }
    });
}

// --- Fonctions Grille & Magnétisme ---

/** Dessine la grille sur le canvas */
export function drawGrid() {
    if (!fabricCanvas) return;
    removeGrid(); // Nettoyer l'ancienne grille
    isGridVisible = true;
    
    const zoom = fabricCanvas.getZoom();
    const vpt = fabricCanvas.viewportTransform;
    const panX = vpt[4];
    const panY = vpt[5];

    // Grille dynamique basée sur le zoom
    let gridSize = GRID_SIZE;
    if (zoom < 0.5) gridSize *= 4;
    else if (zoom < 1) gridSize *= 2;
    
    const gridScaled = gridSize * zoom;
    if (gridScaled < 10) { // Ne pas dessiner si trop dense
        return; 
    }

    const width = fabricCanvas.getWidth();
    const height = fabricCanvas.getHeight();

    // Calculer le décalage dû au pan
    const startX = panX % gridScaled;
    const startY = panY % gridScaled;

    for (let x = startX; x < width; x += gridScaled) {
        gridLines.push(new fabric.Line([x, 0, x, height], {
            stroke: '#e0e0e0', strokeWidth: 1, selectable: false, evented: false, isGridLine: true 
        }));
    }
    for (let y = startY; y < height; y += gridScaled) {
        gridLines.push(new fabric.Line([0, y, width, y], {
            stroke: '#e0e0e0', strokeWidth: 1, selectable: false, evented: false, isGridLine: true 
        }));
    }
    fabricCanvas.add(...gridLines);
    gridLines.forEach(line => line.moveTo(0)); // Mettre en arrière-plan
}

/** Supprime la grille du canvas */
export function removeGrid() {
    isGridVisible = false;
    if (gridLines.length > 0) {
        fabricCanvas.remove(...gridLines);
        gridLines = [];
    }
}

/** Affiche ou cache la grille */
export function toggleGrid(isVisible) {
    if (isVisible) {
        drawGrid();
    } else {
        removeGrid();
    }
    fabricCanvas.renderAll();
}

/** Active ou désactive le magnétisme */
export function toggleSnap(isEnabled) {
    isSnapEnabled = isEnabled;
    console.log("Magnétisme:", isSnapEnabled);
}

/** Retourne l'état du magnétisme */
export function getIsSnapEnabled() {
    return isSnapEnabled;
}

/**
 * Calcule la coordonnée magnétisée la plus proche sur la grille.
 * Prend en compte le zoom et le pan actuels.
 * @param {number} coord - Coordonnée (x ou y) dans le référentiel du canvas (zoomé).
 * @param {number} panOffset - Décalage du pan (vpt[4] pour x, vpt[5] pour y).
 * @param {number} zoom - Niveau de zoom actuel.
 * @returns {number} Coordonnée magnétisée.
 */
export function snapToGrid(coord, panOffset, zoom) {
    if (!isSnapEnabled || !isGridVisible) {
        return coord;
    }
    
    // Grille dynamique
    let gridSize = GRID_SIZE;
    if (zoom < 0.5) gridSize *= 4;
    else if (zoom < 1) gridSize *= 2;
    
    const gridScaled = gridSize * zoom;
    
    // Convertir la coordonnée de l'écran en coordonnée "monde" (non-zoomé, non-panné)
    const worldCoord = (coord - panOffset) / zoom;
    
    // Magnétiser dans le monde
    const snappedWorldCoord = Math.round(worldCoord / gridSize) * gridSize;
    
    // Reconvertir en coordonnée écran
    const snappedScreenCoord = (snappedWorldCoord * zoom) + panOffset;
    
    return snappedScreenCoord;
}

/**
 * Magnétise un objet à la grille pendant son déplacement.
 * @param {fabric.Object} target - L'objet en cours de déplacement.
 */
export function snapObjectToGrid(target) {
    if (!isSnapEnabled || !isGridVisible) return;
    
    const zoom = fabricCanvas.getZoom();
    const vpt = fabricCanvas.viewportTransform;
    const panX = vpt[4];
    const panY = vpt[5];

    // Grille dynamique
    let gridSize = GRID_SIZE;
    if (zoom < 0.5) gridSize *= 4;
    else if (zoom < 1) gridSize *= 2;
    
    const gridScaled = gridSize * zoom;

    // Calculer la coordonnée "monde" (non-zoomé, non-panné)
    const worldLeft = (target.left - panX) / zoom;
    const worldTop = (target.top - panY) / zoom;

    // Magnétiser dans le monde
    const snappedWorldLeft = snapToGridValue(worldLeft, gridSize);
    const snappedWorldTop = snapToGridValue(worldTop, gridSize);
    
    // Reconvertir en coordonnée écran
    const snappedScreenLeft = (snappedWorldLeft * zoom) + panX;
    const snappedScreenTop = (snappedWorldTop * zoom) + panY;

    target.set({
        left: snappedScreenLeft,
        top: snappedScreenTop
    }).setCoords();
}
