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
// --- AJOUT : Exporté pour être utilisable par d'autres modules ---
export const PAGE_SIZES = {
    'A4-P': { width: 595, height: 842, viewBox: { x: 0, y: 0, width: 595, height: 842 } },
    'A4-L': { width: 842, height: 595, viewBox: { x: 0, y: 0, width: 842, height: 595 } },
    'A3-P': { width: 842, height: 1191, viewBox: { x: 0, y: 0, width: 842, height: 1191 } },
    'A3-L': { width: 1191, height: 842, viewBox: { x: 0, y: 0, width: 1191, height: 842 } },
    'Original': { width: null, height: null, viewBox: null } // Ne sera plus utilisé pour le canvas
};
// --- FIN AJOUT ---

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
                fabricCanvas.clear(); // Efface l'ancien contenu
                fabricCanvas.backgroundColor = '#f8f9fa'; // Remet le fond
                svgObjects = []; // Réinitialise la liste des objets SVG
                gridLines = []; // Réinitialise la liste des lignes de grille
                pageGuideRect = null; // Réinitialise le guide

                if (!objects || objects.length === 0) {
                    console.warn("Le SVG chargé est vide ou ne contient pas d'objets reconnus.");
                     // Initialise quand même la grille et le zoom
                    updateGrid(fabricCanvas.getZoom());
                    resetZoom();
                    return resolve(); // Résout sans erreur, mais avec un canvas vide
                }


                // --- Dimensions du SVG chargé ---
                const originalSvgWidth = options.width;
                const originalSvgHeight = options.height;
                const originalSvgViewBox = options.viewBox || null;
                // Crée un groupe temporaire juste pour obtenir la bounding box précise
                const tempGroup = fabric.util.groupSVGElements(objects, options);
                const svgBoundingBox = tempGroup.getBoundingRect();

                const svgWidth = originalSvgViewBox?.width || originalSvgWidth || svgBoundingBox.width;
                const svgHeight = originalSvgViewBox?.height || originalSvgHeight || svgBoundingBox.height;

                if (!svgWidth || !svgHeight || svgWidth <= 0 || svgHeight <= 0) {
                     console.error("Impossible de déterminer des dimensions valides pour le SVG chargé.", {svgWidth, svgHeight, options});
                     // Initialise quand même la grille et le zoom
                    updateGrid(fabricCanvas.getZoom());
                    resetZoom();
                    return reject(new Error("Dimensions du SVG non reconnues ou invalides."));
                }
                
                // --- Dimensions du Canvas FIXE (notre "feuille") ---
                const canvasWidth = fabricCanvas.getWidth(); // (ex: 842)
                const canvasHeight = fabricCanvas.getHeight(); // (ex: 595)

                // --- Calcul pour centrer/fitter le SVG dans le Canvas ---
                const padding = 20; // Marge visuelle
                const safeCanvasWidth = canvasWidth - padding * 2;
                const safeCanvasHeight = canvasHeight - padding * 2;
                
                const scaleX = safeCanvasWidth > 0 ? safeCanvasWidth / svgWidth : 1;
                const scaleY = safeCanvasHeight > 0 ? safeCanvasHeight / svgHeight : 1;
                const scale = Math.min(scaleX, scaleY); // "Fit"

                const finalSvgWidth = svgWidth * scale;
                const finalSvgHeight = svgHeight * scale;

                const left = (canvasWidth - finalSvgWidth) / 2;
                const top = (canvasHeight - finalSvgHeight) / 2;

                // Applique les propriétés (non sélectionnable, etc.) aux objets
                objects.forEach(obj => {
                    if (!obj) return; // Sécurité si un objet est null/undefined
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
                const planGroup = new fabric.Group(objects.filter(obj => !!obj), { // Filtre les objets non valides
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
            }, 
            // Fonction de rappel pour reviver (non utilisée ici, mais bonne pratique de l'inclure)
            null, 
            // Options de parsing
            { crossOrigin: 'anonymous' }
            );
        });

    } catch (error) {
        console.error("Erreur lors du chargement ou parsing SVG:", error);
        showToast(`Erreur chargement plan: ${error.message}`, 'danger');
        // Assure que le canvas est utilisable même si le chargement échoue
        fabricCanvas.clear();
        fabricCanvas.backgroundColor = '#f8f9fa';
        svgObjects = [];
        gridLines = [];
        pageGuideRect = null;
        updateGrid(fabricCanvas.getZoom());
        resetZoom(); 
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
        fabric.Image.fromURL(imageUrl, (img, isError) => {
             if (isError || !img) {
                console.error("Erreur lors du chargement de l'image depuis l'URL:", imageUrl);
                showToast("Erreur chargement image", 'danger');
                // Assure que le canvas est utilisable
                fabricCanvas.clear();
                fabricCanvas.backgroundColor = '#f8f9fa';
                svgObjects = [];
                gridLines = [];
                pageGuideRect = null;
                updateGrid(fabricCanvas.getZoom());
                resetZoom();
                return reject(new Error("Erreur chargement image"));
            }
            if (!fabricCanvas) return reject(new Error("Canvas non prêt après chargement image"));
            
            fabricCanvas.clear(); // Efface l'ancien contenu
            fabricCanvas.backgroundColor = '#f8f9fa'; // Remet le fond
            svgObjects = []; // Réinitialise la liste des objets SVG
            gridLines = []; // Réinitialise la liste des lignes de grille
            pageGuideRect = null; // Réinitialise le guide


            // --- Dimensions de l'image chargée ---
            const imgWidth = img.width;
            const imgHeight = img.height;
             if (!imgWidth || !imgHeight || imgWidth <= 0 || imgHeight <= 0) {
                 console.error("Dimensions de l'image invalides.", {imgWidth, imgHeight});
                 // Initialise quand même la grille et le zoom
                 updateGrid(fabricCanvas.getZoom());
                 resetZoom();
                 return reject(new Error("Dimensions de l'image invalides."));
            }

            // --- Dimensions du Canvas FIXE (notre "feuille") ---
            const canvasWidth = fabricCanvas.getWidth();
            const canvasHeight = fabricCanvas.getHeight();

            // --- Calcul pour centrer/fitter l'Image dans le Canvas ---
            const padding = 20; // Marge visuelle
            const safeCanvasWidth = canvasWidth - padding * 2;
            const safeCanvasHeight = canvasHeight - padding * 2;
                
            const scaleX = safeCanvasWidth > 0 ? safeCanvasWidth / imgWidth : 1;
            const scaleY = safeCanvasHeight > 0 ? safeCanvasHeight / imgHeight : 1;
            const scale = Math.min(scaleX, scaleY); // "Fit"

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
            console.log(`Image chargée (objet). Dimensions originales: ${imgWidth}x${imgHeight}, Affichée à l'échelle: ${scale.toFixed(3)}`);
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
    // Le canvas fixe commence toujours à (0,0)
    let planOffsetX = 0; 
    let planOffsetY = 0; 
    
    // --- AJOUT : Log pour débogage du centrage ---
    console.log(`ResetZoom - Container: ${containerWidth}x${containerHeight}, Canvas Fixe: ${planWidth}x${planHeight}`);
    // --- FIN AJOUT ---

    // Vérifie si les dimensions sont valides pour éviter les divisions par zéro
    if (!containerWidth || !containerHeight || !planWidth || !planHeight || containerWidth <= padding*2 || containerHeight <= padding*2) {
        console.warn("ResetZoom: Dimensions invalides ou trop petites pour calculer le zoom/pan.", {containerWidth, containerHeight, planWidth, planHeight});
         // Applique une transformation par défaut (zoom 1, centré à l'origine)
        fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        updateGrid(1);
        updateStrokesWidth(1);
        fabricCanvas.requestRenderAll();
        return;
    }

    // Calcul du scale pour faire rentrer le canvas fixe dans le conteneur
    const scaleX = (containerWidth - padding * 2) / planWidth;
    const scaleY = (containerHeight - padding * 2) / planHeight;
    const scale = Math.min(scaleX, scaleY);

    // Calcul du Pan pour centrer le canvas fixe
    // On veut que le coin supérieur gauche (planOffsetX, planOffsetY) du *plan* (qui est maintenant 0,0)
    // soit positionné correctement après scaling.
    // Position finale X = panX + (planOffsetX * scale)
    // Position finale Y = panY + (planOffsetY * scale)
    // On veut centrer : Position finale X = (containerWidth - (planWidth * scale)) / 2
    // On veut centrer : Position finale Y = (containerHeight - (planHeight * scale)) / 2
    // Comme planOffsetX/Y = 0, on a:
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
        // Si aucun point n'est fourni, zoomer par rapport au centre du viewport
        point = fabricCanvas.getVpCenter(); 
    }

    fabricCanvas.zoomToPoint(point, newZoom);
    // Important: Mettre à jour la grille et les traits après le zoom manuel
    updateGrid(newZoom);
    updateStrokesWidth(newZoom);
    fabricCanvas.requestRenderAll(); // Assure le rendu après zoom manuel
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
             // Vérifie si l'objet est bien un objet Fabric avant de le modifier
             if (obj && typeof obj.set === 'function') {
                 obj.set({
                    selectable: !isLocked,
                    lockMovementX: isLocked,
                    lockMovementY: isLocked,
                    hasControls: !isLocked,
                    hasBorders: !isLocked,
                    evented: true, // Laisse passer les événements même si verrouillé ? A tester.
                });
             }
        });
    } else if (planGroup && planGroup.type === 'image') { // Gère le cas d'une image
         planGroup.set({
            selectable: false, // Une image de fond ne doit jamais être sélectionnable
            evented: false,
        });
    }

    // Désélectionne l'objet actif s'il appartient au plan et qu'on verrouille
    if (isLocked) {
        const activeObj = fabricCanvas.getActiveObject();
        // Vérifie si l'objet actif fait partie du groupe plan
        if (activeObj && planGroup && planGroup.type === 'group' && planGroup.contains(activeObj)) {
            fabricCanvas.discardActiveObject();
        } 
        // Si l'objet actif est l'image de fond elle-même (ne devrait pas arriver avec selectable: false)
        else if (activeObj && activeObj === planGroup) {
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
    // Gère le cas où l'argument est l'événement du checkbox
    if (snap instanceof Event && snap.target && typeof snap.target.checked === 'boolean') {
        snapToGrid = snap.target.checked;
    } 
    // Gère le cas où l'argument est directement un booléen
    else if (typeof snap === 'boolean') {
        snapToGrid = snap;
    } 
    // Sinon, ne change pas la valeur
    else {
        console.warn("toggleSnapToGrid appelé avec un argument invalide:", snap);
        // Garde la valeur actuelle
    }
    
    console.log("Magnétisme grille:", snapToGrid);
    
    // Met à jour l'état visuel du checkbox s'il existe
    const snapToggleCheckbox = document.getElementById('snap-toggle');
    if (snapToggleCheckbox) {
        snapToggleCheckbox.checked = snapToGrid;
    }
}


/** Retourne l'état actuel du magnétisme. (Fonction inchangée) */
export function getSnapToGrid() {
    // Assure que l'état interne est synchronisé avec le checkbox s'il existe
    const snapToggleCheckbox = document.getElementById('snap-toggle');
    if (snapToggleCheckbox) {
        snapToGrid = snapToggleCheckbox.checked;
    }
    return snapToGrid;
}

/**
 * Met à jour (recrée) la grille visuelle en fonction du zoom.
 * MODIFIÉ : Assure que la grille couvre le canvas fixe.
 */
export function updateGrid(zoom) {
    if (!fabricCanvas) return;

    // Supprime les anciennes lignes
    gridLines.forEach(line => fabricCanvas.remove(line));
    gridLines = [];

    // Vérifie si la grille doit être affichée
    const gridToggleCheckbox = document.getElementById('grid-toggle');
    const showGrid = gridToggleCheckbox ? gridToggleCheckbox.checked : false;

    if (!showGrid) {
        fabricCanvas.requestRenderAll(); // Assure le rafraîchissement même si la grille est cachée
        return;
    }

    const gridSize = GRID_SIZE || 10; // Taille de base de la grille
    
    // Dimensions du canvas fixe
    const width = fabricCanvas.getWidth(); 
    const height = fabricCanvas.getHeight(); 
    
    // Calcule l'espacement visible à l'écran
    let apparentGridSizeOnScreen = gridSize * zoom;
    let gridSpacing = gridSize;

    // Ajuste l'espacement pour que la grille ne soit ni trop dense ni trop large
    // Augmente l'espacement si trop dense
    while (apparentGridSizeOnScreen < 15 && gridSpacing < width && gridSpacing < height) { // Ajout limite
        gridSpacing *= 5;
        apparentGridSizeOnScreen *= 5;
    }
     // Diminue l'espacement si trop large
     while (apparentGridSizeOnScreen > 75 && gridSpacing > 1) { // Ajout limite min
        gridSpacing /= 5;
        apparentGridSizeOnScreen /= 5;
        // Empêche des espacements trop petits
        if (gridSpacing < 1) gridSpacing = 1; 
    }
    // Assure un espacement minimal pour éviter les boucles infinies/erreurs
    if (gridSpacing <= 0) gridSpacing = gridSize;


    const strokeColor = '#ced4da'; // Couleur de la grille
    const strokeWidth = Math.max(0.5, 1 / zoom); // Épaisseur de ligne (min 0.5px)

    // Dessine les lignes verticales sur toute la largeur du canvas fixe
    for (let x = 0; x <= width; x += gridSpacing) {
        const line = new fabric.Line([x, 0, x, height], {
            stroke: strokeColor, strokeWidth: strokeWidth,
            selectable: false, evented: false, excludeFromExport: true, // Ne pas exporter
            isGridLine: true
        });
        fabricCanvas.add(line);
        gridLines.push(line);
    }
    // Dessine les lignes horizontales sur toute la hauteur du canvas fixe
    for (let y = 0; y <= height; y += gridSpacing) {
        const line = new fabric.Line([0, y, width, y], {
            stroke: strokeColor, strokeWidth: strokeWidth,
            selectable: false, evented: false, excludeFromExport: true, // Ne pas exporter
            isGridLine: true
        });
        fabricCanvas.add(line);
        gridLines.push(line);
    }

    // Envoie toutes les lignes de la grille à l'arrière-plan
    gridLines.forEach(line => line.sendToBack());
    fabricCanvas.requestRenderAll();
}


/**
 * Met à jour l'épaisseur des traits des objets en fonction du zoom.
 * Assigne une épaisseur de base si elle n'existe pas.
 */
export function updateStrokesWidth(zoom) {
    if (!fabricCanvas) return;
    const baseStroke = 0.5; // Épaisseur de base souhaitée (indépendante du zoom)
    
    fabricCanvas.getObjects().forEach(obj => {
        // Ignore les textes, les lignes de grille et les guides de page
        if (obj.type === 'i-text' || obj.type === 'text' || obj.isGridLine || obj.isPageGuide || !obj.stroke) {
            return;
        }

        // Si l'épaisseur de base n'est pas définie, on la définit maintenant
        if (obj.baseStrokeWidth === undefined || obj.baseStrokeWidth === null) {
            // Si l'objet a déjà un strokeWidth, on l'utilise comme base
            // Sinon, on utilise la valeur par défaut 'baseStroke'
            obj.baseStrokeWidth = obj.strokeWidth > 0 ? obj.strokeWidth : baseStroke;
        }
        
        // Calcule la nouvelle épaisseur en fonction du zoom
        // Assure une épaisseur minimale pour la visibilité
        let newStrokeWidth = Math.max(0.5 / zoom, obj.baseStrokeWidth / zoom); 
        obj.set('strokeWidth', newStrokeWidth);
    });
}


/**
 * Trouve une forme SVG spécifique par son ID SVG.
 * Recherche à l'intérieur du groupe 'isPlanBackground'.
 */
export function findSvgShapeByCodeGeo(svgId) {
    if (!svgId || !fabricCanvas) return null;
    
    // Trouve le groupe contenant le plan
    const planGroup = fabricCanvas.getObjects().find(o => o.isPlanBackground && o.type === 'group');
    
    // Si le plan est un groupe, cherche l'objet dedans
    if (planGroup) {
        return planGroup.getObjects().find(obj => obj.customData?.svgId === svgId) || null;
    }
    
    // Si le plan n'est pas un groupe (ex: image), on ne peut pas trouver de forme SVG
    return null; 
}


/**
 * Exporte les dimensions de la "feuille" (le canvas fixe).
 * Utilisé par main.js pour la sauvegarde SVG, pour définir les attributs width/height du SVG.
 * @returns {object} { width, height, viewBox }
 */
export function getOriginalPlanDimensions() {
    if (!fabricCanvas) {
         console.warn("getOriginalPlanDimensions appelé avant initialisation canvas.");
         return { width: DEFAULT_FORMAT.width, height: DEFAULT_FORMAT.height, viewBox: DEFAULT_FORMAT.viewBox };
    }
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
 * Assure que le guide est mis à jour avec le zoom.
 * AJOUT : Exporté pour être utilisable par d'autres modules
 */
export function drawPageGuides(format) {
    if (!fabricCanvas) return;
    
    // Supprime l'ancien guide s'il existe
    if (pageGuideRect) {
        fabricCanvas.remove(pageGuideRect);
        pageGuideRect = null;
    }

    const isOriginal = (format === 'Original'); // 'Original' signifie pas de guide
    const formatData = PAGE_SIZES[format]; // Récupère les données du format

    // Si format 'Original' ou données invalides, ne rien dessiner
    if (isOriginal || !formatData || !formatData.viewBox) {
        fabricCanvas.requestRenderAll(); // Rafraîchit au cas où on a supprimé l'ancien
        return;
    }

    const viewBox = formatData.viewBox;
    const zoom = fabricCanvas.getZoom();

    console.log(`Dessin du guide pour ${format}:`, formatData);

    // Crée le rectangle de guide
    pageGuideRect = new fabric.Rect({
        left: viewBox.x,
        top: viewBox.y,
        width: viewBox.width,
        height: viewBox.height,
        fill: 'transparent',    // Fond transparent
        stroke: '#adb5bd',      // Couleur du trait (gris)
        strokeWidth: 1 / zoom,  // Épaisseur ajustée au zoom
        baseStrokeWidth: 1,     // Épaisseur de base (pour recalculer)
        strokeDashArray: [5 / zoom, 5 / zoom], // Pointillés ajustés au zoom
        selectable: false,      // Non sélectionnable
        evented: false,         // Ne réagit pas aux événements
        excludeFromExport: true,// Ne pas inclure dans l'export SVG/JSON
        isPageGuide: true       // Marqueur personnalisé
    });

    fabricCanvas.add(pageGuideRect);
    console.log("Guide ajouté au canvas:", pageGuideRect);

    pageGuideRect.sendToBack(); // Envoie le guide à l'arrière-plan
     // Assure que la grille est DESSUS le guide mais SOUS le plan
    gridLines.forEach(line => line.bringToFront());
    const planBg = fabricCanvas.getObjects().find(o => o.isPlanBackground);
    if (planBg) planBg.sendToBack(); // Assure que le plan est tout derrière
    if (pageGuideRect) pageGuideRect.sendToBack(); // Assure que le guide est juste au-dessus du fond

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
    // Fallback si le canvas n'est pas prêt (important pour les calculs initiaux)
    console.warn("getCanvasDimensions: Canvas non prêt, retour au format par défaut.");
    return {
        width: DEFAULT_FORMAT.width,
        height: DEFAULT_FORMAT.height
    };
}

