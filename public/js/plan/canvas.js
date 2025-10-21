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
    setCanvasLock,
    getCanvasLock,
    toggleSnapToGrid,
    getSnapToGrid, // <-- ADD THIS LINE
    findSvgShapeByCodeGeo,
    getSvgOriginalBBox
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
            let zoom = fabricCanvas.getZoom();
            zoom *= 0.999 ** delta;
            if (zoom > MAX_ZOOM) zoom = MAX_ZOOM;
            if (zoom < MIN_ZOOM) zoom = MIN_ZOOM;
            
            // Zoomer sur le pointeur de la souris
            fabricCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
            
            opt.e.preventDefault();
            opt.e.stopPropagation();

            // Mettre à jour la grille et les bordures
            updateGrid(zoom);
            updateStrokesWidth(zoom);
        });

        // Gestion du Pan (déplacement) avec Alt + Clic Gauche
        fabricCanvas.on('mouse:down', (opt) => {
            const e = opt.e;
            if (e.altKey === true) {
                fabricCanvas.isDragging = true;
                fabricCanvas.selection = false;
                fabricCanvas.lastPosX = e.clientX;
                fabricCanvas.lastPosY = e.clientY;
                fabricCanvas.defaultCursor = 'grabbing';
                fabricCanvas.hoverCursor = 'grabbing';
            }
        });

        fabricCanvas.on('mouse:move', (opt) => {
            if (fabricCanvas.isDragging) {
                const e = opt.e;
                const vpt = fabricCanvas.viewportTransform;
                vpt[4] += e.clientX - fabricCanvas.lastPosX;
                vpt[5] += e.clientY - fabricCanvas.lastPosY;
                fabricCanvas.requestRenderAll(); // Demander un rendu
                fabricCanvas.lastPosX = e.clientX;
                fabricCanvas.lastPosY = e.clientY;
            }
        });

        fabricCanvas.on('mouse:up', (opt) => {
            if (fabricCanvas.isDragging) {
                fabricCanvas.setViewportTransform(fabricCanvas.viewportTransform); // Appliquer la transformation
                fabricCanvas.isDragging = false;
                fabricCanvas.selection = true;
                fabricCanvas.defaultCursor = 'default';
                fabricCanvas.hoverCursor = 'default';
            }
        });

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
 * Le SVG est chargé comme un groupe d'objets individuels.
 * @param {string} url - URL du fichier SVG
 * @returns {Promise<void>}
 */
function loadSvgPlan(url) {
    return new Promise((resolve, reject) => {
        if (!fabricCanvas) return reject(new Error("Canvas non initialisé."));
        
        console.log(`Chargement du plan SVG (objets individuels) depuis ${url}`);
        fabricCanvas.clear(); // Nettoyer le canvas (sauf si on veut superposer?)
        svgObjects = []; // Vider la liste
        svgOriginalBBox = null; // Vider la BBox

        fabric.loadSVGFromURL(url, (objects, options) => {
            if (!objects || objects.length === 0) {
                console.error("Le SVG est vide ou n'a pas pu être chargé.");
                showToast("Erreur: Le fichier SVG est vide ou invalide.", 'error');
                return reject(new Error("SVG vide ou invalide."));
            }
            console.log(`SVG chargé, ${objects.length} objets trouvés.`);

            // Stocker la Bounding Box originale
            // 'options' contient width/height du <svg>
            // Mais on calcule la BBox réelle des objets
            const group = new fabric.Group(objects);
            svgOriginalBBox = group.getBoundingRect();
            console.log("Bounding Box SVG Originale:", svgOriginalBBox);

            // Dissocier le groupe et ajouter les objets
            objects.forEach((obj, index) => {
                // Tenter d'extraire un ID ou un nom depuis le SVG
                // (Fabric ne le fait pas nativement de manière fiable)
                // On utilise l'ID du code géo comme identifiant 'svgId'
                // Note: 'id' est souvent utilisé par Fabric, 'svgId' est plus sûr
                const svgId = options.svgUid ? options.svgUid[index]?.id : null; // Tenter de récupérer l'ID
                
                // Pré-configurer les objets SVG
                obj.set({
                    selectable: false,
                    evented: true, // Permet de détecter le clic droit (pour 'isSvgShape')
                    hoverCursor: 'default',
                    isSvgShape: true, // Marqueur pour identifier les formes du plan
                    customData: {
                        svgId: svgId || `shape_${index}` // Utiliser l'ID du SVG ou un index
                    }
                });

                fabricCanvas.add(obj);
                svgObjects.push(obj); // Stocker la référence
            });

            console.log("Objets SVG ajoutés individuellement au canvas.");

            // Ajuster le canvas et le zoom
            resizeCanvas(); // Ajuste la taille du wrapper
            resetZoom(); // Centre le plan
            resolve();

        }, (item, obj) => {
            // "Reviver" (optionnel) - appelé pour chaque élément parsé
            // Peut être utilisé pour extraire des données 'data-code-geo' si elles existent
            // (Nécessite une modification de Fabric ou un parsing XML séparé)
        }, {
            crossOrigin: 'anonymous' // Important si le SVG n'est pas sur le même domaine
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
        fabricCanvas.clear(); // Nettoyer
        svgObjects = []; // Vider
        svgOriginalBBox = null; // Vider

        fabric.Image.fromURL(url, (img) => {
            if (!img) {
                return reject(new Error("Impossible de charger l'image."));
            }

            // Configurer l'image comme arrière-plan non-sélectionnable
            img.set({
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
                isBackgroundImage: true
            });
            
            // Mettre l'image en arrière-plan
            fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {
                // Options pour s'adapter au canvas (on préfère centrer)
                // TBD: Faut-il étirer (scaleToWidth) ou juste centrer?
                // Pour l'instant, resetZoom s'en charge.
            });

            // Stocker la BBox (qui est la taille de l'image)
            svgOriginalBBox = img.getBoundingRect();
            console.log("Bounding Box Image (fond):", svgOriginalBBox);

            // Ajuster le canvas et le zoom
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
    const height = container.clientHeight; // ou une hauteur fixe ?
    
    // console.log(`Canvas redimensionné: ${width} x ${height}`);

    fabricCanvas.setWidth(width);
    fabricCanvas.setHeight(height);
    fabricCanvas.calcOffset(); // Recalculer l'offset
    fabricCanvas.requestRenderAll(); // Redessiner
    
    // Redessiner la grille si elle est active
    if (gridGroup && gridGroup.visible) {
        updateGrid(fabricCanvas.getZoom());
    }
}

/**
 * Réinitialise le zoom pour centrer et afficher l'intégralité du plan.
 */
function resetZoom() {
    if (!fabricCanvas) return;

    // Utiliser la BBox stockée (soit du SVG, soit de l'image)
    const bbox = svgOriginalBBox;
    if (!bbox || bbox.width === 0 || bbox.height === 0) {
        console.warn("ResetZoom: Bounding Box du plan non disponible. Centrage simple.");
        // Fallback: Centrage simple
        fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]); // Reset zoom et pan
        return;
    }

    const canvasWidth = fabricCanvas.width;
    const canvasHeight = fabricCanvas.height;
    const padding = 50; // Marge (en pixels)

    // Calculer le zoom pour s'adapter
    const scaleX = (canvasWidth - padding * 2) / bbox.width;
    const scaleY = (canvasHeight - padding * 2) / bbox.height;
    const zoom = Math.min(scaleX, scaleY);

    if (zoom < MIN_ZOOM) zoom = MIN_ZOOM;
    if (zoom > MAX_ZOOM) zoom = MAX_ZOOM;

    // Centrer le plan
    const panX = (canvasWidth - (bbox.width * zoom)) / 2 - (bbox.left * zoom);
    const panY = (canvasHeight - (bbox.height * zoom)) / 2 - (bbox.top * zoom);

    fabricCanvas.setViewportTransform([zoom, 0, 0, zoom, panX, panY]);
    
    updateGrid(zoom);
    updateStrokesWidth(zoom);
    fabricCanvas.requestRenderAll();
    console.log("ResetZoom: Viewport ajusté. Scale:", zoom.toFixed(3));
}

/**
 * Met à jour la largeur des bordures (strokes) de tous les objets
 * en fonction du niveau de zoom actuel.
 * @param {number} zoom - Le niveau de zoom actuel.
 */
function updateStrokesWidth(zoom) {
    if (!fabricCanvas) return;

    fabricCanvas.getObjects().forEach(obj => {
        let baseStrokeWidth = 1; // Défaut

        // Gérer les lignes de la grille
        if (obj.isGridLine) {
            baseStrokeWidth = obj.isMajorGridLine ? 0.5 : 0.2;
        } 
        // Gérer les objets Géo (Tags, Textes)
        else if (obj.customData?.isGeoTag) {
            // Le rectangle du tag
            if (obj._objects && obj._objects[0]) {
                obj._objects[0].set('strokeWidth', (obj._objects[0].baseStrokeWidth || 1) / zoom);
            }
        } 
        else if (obj.customData?.isPlacedText) {
            // Le texte (IText)
            baseStrokeWidth = obj.baseStrokeWidth || 0.5;
            obj.set('strokeWidth', baseStrokeWidth / zoom);
        }
        // Gérer les flèches (pour les tags)
        else if (obj.isArrow) {
             baseStrokeWidth = obj.baseStrokeWidth || 2;
             obj.set('strokeWidth', baseStrokeWidth / zoom);
        }
    });
    
    // Demander un rendu (sera fait par la fonction appelante, ex: zoom)
    // fabricCanvas.requestRenderAll(); 
}


/**
 * Verrouille ou déverrouille le plan (fond).
 * @param {boolean} lock - true pour verrouiller, false pour déverrouiller.
 */
function setCanvasLock(lock) {
    isLocked = lock;
    console.log(`Verrouillage SVG: ${isLocked}`);
    
    // Verrouiller/déverrouiller les objets SVG du fond
    svgObjects.forEach(obj => {
        obj.set({
            selectable: !isLocked,
            evented: true // Toujours 'true' pour le clic droit
        });
    });

    // Verrouiller/déverrouiller l'image de fond
    const bgImage = fabricCanvas.backgroundImage;
    if (bgImage) {
        bgImage.set({
            selectable: !isLocked,
            evented: !isLocked
        });
    }

    // Mettre à jour l'état de l'interface (ex: bouton)
    const lockBtn = document.getElementById('toggle-lock');
    if (lockBtn) {
        lockBtn.innerHTML = isLocked ? 
            '<i class="fas fa-lock"></i> Verrouillé' : 
            '<i class="fas fa-lock-open"></i> Déverrouillé';
        lockBtn.classList.toggle('active', isLocked);
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

    // Supprimer l'ancienne grille
    if (gridGroup) {
        fabricCanvas.remove(gridGroup);
        gridGroup = null;
    }

    // Si le magnétisme n'est pas actif, ne pas recréer la grille
    if (!snapToGrid) {
        fabricCanvas.requestRenderAll();
        return;
    }

    const gridSize = GRID_SIZE; // Taille de base de la grille
    const width = fabricCanvas.width * 5; // Étendre la grille au-delà du viewport
    const height = fabricCanvas.height * 5;
    const left = -width / 2;
    const top = -height / 2;
    
    const lines = [];
    const strokeWidthMinor = 0.2 / zoom;
    const strokeWidthMajor = 0.5 / zoom;
    const strokeColor = '#cccccc';

    // Lignes verticales
    for (let i = 0; i <= width; i += gridSize) {
        const isMajor = (i % (gridSize * 5) === 0);
        lines.push(new fabric.Line([i, 0, i, height], {
            left: left + i, top: top,
            stroke: strokeColor,
            strokeWidth: isMajor ? strokeWidthMajor : strokeWidthMinor,
            selectable: false, evented: false,
            isGridLine: true, isMajorGridLine: isMajor
        }));
    }
    // Lignes horizontales
    for (let i = 0; i <= height; i += gridSize) {
         const isMajor = (i % (gridSize * 5) === 0);
        lines.push(new fabric.Line([0, i, width, i], {
            left: left, top: top + i,
            stroke: strokeColor,
            strokeWidth: isMajor ? strokeWidthMajor : strokeWidthMinor,
            selectable: false, evented: false,
            isGridLine: true, isMajorGridLine: isMajor
        }));
    }

    gridGroup = new fabric.Group(lines, {
        left: 0, top: 0,
        selectable: false, evented: false,
        originX: 'center', originY: 'center',
        visible: true
    });

    fabricCanvas.add(gridGroup);
    gridGroup.moveTo(-1); // Mettre tout au fond (sauf le plan)
    fabricCanvas.requestRenderAll();
}

/**
 * Active ou désactive le magnétisme à la grille.
 */
function toggleSnapToGrid() {
    snapToGrid = !snapToGrid;
    console.log(`Magnétisme: ${snapToGrid}`);
    
    // Mettre à jour l'UI
    const snapBtn = document.getElementById('toggle-grid');
    if (snapBtn) {
        snapBtn.innerHTML = snapToGrid ? 
            '<i class="fas fa-border-all"></i> Grille ON' : 
            '<i class="fas fa-border-none"></i> Grille OFF';
        snapBtn.classList.toggle('active', snapToGrid);
    }
    
    // Mettre à jour l'affichage de la grille
    updateGrid(fabricCanvas.getZoom());
}

/**
 * Récupère l'état du magnétisme.
 * @returns {boolean}
 */
function getSnapToGrid() {
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
    
    // `svgObjects` contient les références directes
    return svgObjects.find(obj => obj.customData?.svgId === codeGeoId) || null;
}

/**
 * Récupère la Bounding Box (BBox) originale du SVG/Image chargé.
 * @returns {object|null} La BBox { left, top, width, height }
 */
function getSvgOriginalBBox() {
    return svgOriginalBBox;
}
