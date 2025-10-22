/**
 * Module pour la gestion des outils de dessin (formes, texte libre),
 * groupement, et presse-papiers.
 * VERSION MODIFIÉE : Permet de grouper les éléments SVG de base (isSvgShape).
 */
import { getCanvasInstance, getSnapToGrid, getCanvasLock } from './canvas.js';
import { showToast } from '../modules/utils.js';
import { GRID_SIZE } from '../modules/config.js'; // Importé pour le magnétisme

let fabricCanvas;
let currentTool = 'select'; // Outil actif
let isDrawing = false;
let startPoint = null;
let currentObject = null; // Objet en cours de dessin

// Styles (les valeurs actuelles sont récupérées via getCurrentDrawingStyles)
let currentStrokeColor = '#000000';
let currentFillColor = 'transparent';
let baseStrokeWidth = 2; // Épaisseur de base

// Presse-papiers
let clipboard = null;

/**
 * Initialise le module des outils de dessin.
 * @param {fabric.Canvas} canvasInstance - L'instance du canvas.
 */
export function initializeDrawingTools(canvasInstance) {
    fabricCanvas = canvasInstance;
    console.log("Outils de dessin initialisés.");
}

/**
 * Définit l'outil de dessin actif.
 * @param {string} tool - Nom de l'outil ('select', 'rect', 'line', 'circle', 'text').
 */
export function setActiveTool(tool) {
    currentTool = tool;
    fabricCanvas.isDrawingMode = false; // On gère le dessin manuellement
    fabricCanvas.selection = (tool === 'select');

    if (tool === 'select') {
        fabricCanvas.defaultCursor = 'default';
        fabricCanvas.hoverCursor = 'move';
        // Réactiver la sélection pour tous les objets (sauf grille et tags/textes géo)
        fabricCanvas.getObjects().forEach(obj => {
            // Respecter le verrouillage global pour les shapes SVG
            const isLocked = getCanvasLock ? getCanvasLock() : true; // Fallback sécuritaire
             if (!obj.isGridLine && !(obj.customData?.isGeoTag || obj.customData?.isPlacedText)) {
                // Ne rendre sélectionnable que si ce n'est pas un SVG verrouillé
                obj.set({ selectable: !(obj.isSvgShape && isLocked), evented: true });
            } else if (obj.customData?.isGeoTag || obj.customData?.isPlacedText) {
                obj.set({ selectable: true, evented: true }); // Les tags géo sont toujours sélectionnables
            }
        });
    } else {
        fabricCanvas.defaultCursor = 'crosshair';
        fabricCanvas.hoverCursor = 'crosshair';
         // Désactiver la sélection des objets standards pendant le dessin
         fabricCanvas.getObjects().forEach(obj => {
            if (!obj.isGridLine && !(obj.customData?.isGeoTag || obj.customData?.isPlacedText)) {
                obj.set({ selectable: false, evented: false });
            } else if (obj.customData?.isGeoTag || obj.customData?.isPlacedText) {
                 // Garder les tags géo actifs même pendant le dessin pour pouvoir cliquer dessus (ex: ancrage)
                 obj.set({ evented: true });
            }
        });
    }
    fabricCanvas.discardActiveObject().renderAll(); // Désélectionner
    console.log("Outil actif:", currentTool);
}

/** Retourne l'outil actif */
export function getCurrentDrawingTool() { return currentTool; }

/** Retourne si un dessin est en cours */
export function getIsDrawing() { return isDrawing; }

/**
 * Récupère les options de style actuelles depuis les inputs de la toolbar.
 * @returns {object} { stroke, fill, strokeWidth, baseStrokeWidth }
 */
function getCurrentDrawingStyles() {
    const strokeColor = document.getElementById('stroke-color-picker')?.value || '#000000';
    const fillColorPicker = document.getElementById('fill-color-picker');
    const fillTransparentBtn = document.getElementById('fill-transparent-btn');

    // 'active' sur le bouton = NON transparent
    const isFillActive = fillTransparentBtn ? fillTransparentBtn.classList.contains('active') : false;
    const fill = isFillActive ? (fillColorPicker?.value || '#FFFFFF') : 'transparent';

    // Lire l'épaisseur depuis l'input
    const strokeWidthInput = document.getElementById('stroke-width'); // Assurez-vous que cet ID existe dans votre HTML
    const baseWidth = strokeWidthInput ? parseInt(strokeWidthInput.value, 10) : 2;
    const zoom = fabricCanvas.getZoom();
    const strokeWidth = baseWidth / zoom;

    return {
        stroke: strokeColor,
        fill: fill,
        strokeWidth: strokeWidth,
        baseStrokeWidth: baseWidth
    };
}


/**
 * Démarre le dessin lors d'un 'mouse:down' sur le canvas.
 * @param {object} opt - L'objet événement de Fabric.
 */
export function startDrawing(opt) {
    // Ne pas démarrer si on est en mode sélection, si un dessin est en cours, ou si on clique sur un objet existant
    if (currentTool === 'select' || isDrawing || opt.target) return;

    isDrawing = true;
    startPoint = fabricCanvas.getPointer(opt.e);

    // Magnétisme si activé
    if (getSnapToGrid()) {
        const snapSize = GRID_SIZE || 10;
        startPoint.x = Math.round(startPoint.x / snapSize) * snapSize;
        startPoint.y = Math.round(startPoint.y / snapSize) * snapSize;
    }

    const styles = getCurrentDrawingStyles();

    switch (currentTool) {
        case 'rect':
            currentObject = new fabric.Rect({
                left: startPoint.x,
                top: startPoint.y,
                width: 0,
                height: 0,
                fill: styles.fill,
                stroke: styles.stroke,
                strokeWidth: styles.strokeWidth,
                baseStrokeWidth: styles.baseStrokeWidth,
                selectable: false, evented: false,
                originX: 'left', originY: 'top' // Important pour dessiner depuis le coin
            });
            break;
        case 'circle':
             // Utiliser Ellipse pour pouvoir dessiner des ovales si besoin (maintenir Shift pour cercle parfait)
            currentObject = new fabric.Ellipse({
                left: startPoint.x,
                top: startPoint.y,
                rx: 0,
                ry: 0,
                fill: styles.fill,
                stroke: styles.stroke,
                strokeWidth: styles.strokeWidth,
                baseStrokeWidth: styles.baseStrokeWidth,
                selectable: false, evented: false,
                originX: 'left', originY: 'top' // Pour dessiner depuis le coin
            });
            break;
        case 'line':
            currentObject = new fabric.Line(
                [startPoint.x, startPoint.y, startPoint.x, startPoint.y],
                {
                    fill: 'transparent', // Les lignes n'ont pas de remplissage
                    stroke: styles.stroke,
                    strokeWidth: styles.strokeWidth,
                    baseStrokeWidth: styles.baseStrokeWidth,
                    selectable: false, evented: false
                }
            );
            break;
        case 'text':
            // Le texte est géré au mouse:up (clic simple)
            isDrawing = false; // Pas de 'drag' pour le texte
            break;
        default:
            isDrawing = false;
            break;
    }

    if (currentObject) {
        fabricCanvas.add(currentObject);
        fabricCanvas.requestRenderAll(); // Afficher l'objet initial (point ou ligne de 0px)
    }
}

/**
 * Continue le dessin lors d'un 'mouse:move'.
 * @param {object} opt - L'objet événement de Fabric.
 */
export function continueDrawing(opt) {
    if (!isDrawing || !currentObject || !startPoint) return;

    let pointer = fabricCanvas.getPointer(opt.e);

    // Magnétisme
    if (getSnapToGrid()) {
        const snapSize = GRID_SIZE || 10;
        pointer.x = Math.round(pointer.x / snapSize) * snapSize;
        pointer.y = Math.round(pointer.y / snapSize) * snapSize;
    }

    const width = pointer.x - startPoint.x;
    const height = pointer.y - startPoint.y;

    switch (currentTool) {
        case 'rect':
            currentObject.set({
                left: width > 0 ? startPoint.x : pointer.x,
                top: height > 0 ? startPoint.y : pointer.y,
                width: Math.abs(width),
                height: Math.abs(height)
            });
            break;
        case 'circle': // Gère Ellipse maintenant
            const rx = Math.abs(width) / 2;
            const ry = Math.abs(height) / 2;
            // Si Shift est pressé, faire un cercle parfait
            // Vérifie opt.e car opt peut être null si appelé autrement
            if (opt && opt.e && opt.e.shiftKey) {
                const r = Math.max(rx, ry);
                // Ajuste left/top pour que le centre soit correct lors du dessin avec Shift
                currentObject.set({
                    left: startPoint.x + (width / 2) - r,
                    top: startPoint.y + (height / 2) - r,
                    rx: r,
                    ry: r,
                    originX: 'left', // Garder l'origine le temps du dessin
                    originY: 'top'
                });
            } else {
                 currentObject.set({
                    left: width > 0 ? startPoint.x : pointer.x,
                    top: height > 0 ? startPoint.y : pointer.y,
                    rx: rx,
                    ry: ry,
                    originX: 'left',
                    originY: 'top'
                });
            }
             // Ne pas appeler setCoords() ici, cause des tremblements. Fait à la fin.
            break;
        case 'line':
            currentObject.set({ x2: pointer.x, y2: pointer.y });
            break;
    }

    fabricCanvas.requestRenderAll();
}

/**
 * Termine le dessin lors d'un 'mouse:up'. Crée un objet texte si l'outil est 'text'.
 * @param {object} opt - L'objet événement de Fabric (peut être null si appelé par Escape).
 * @param {boolean} [cancel=false] - True si le dessin est annulé (ex: Escape).
 * @returns {fabric.Object|null} L'objet créé (ou null si annulé ou clic simple pour forme).
 */
export function stopDrawing(opt, cancel = false) {
    if (cancel) {
        if (currentObject) {
            fabricCanvas.remove(currentObject);
        }
        isDrawing = false;
        currentObject = null;
        startPoint = null;
        fabricCanvas.renderAll();
        return null;
    }

    const styles = getCurrentDrawingStyles();

    // Cas spécial du Texte Libre (créé au clic simple)
    if (currentTool === 'text' && !isDrawing && startPoint && opt && !opt.target) {
        // Crée le texte seulement si on clique sur le fond (pas sur un objet existant)
        const zoom = fabricCanvas.getZoom();
        const pointer = fabricCanvas.getPointer(opt.e); // Utiliser le point du clic

        const text = new fabric.IText('Texte', {
            left: pointer.x, // Utiliser coords du clic
            top: pointer.y,
            originX: 'left', originY: 'top',
            fontSize: 20, // Taille de base (sera affectée par zoom global)
            fontFamily: 'Arial',
            fill: styles.stroke, // Utiliser la couleur de contour pour le texte par défaut
            stroke: null, // Pas de contour par défaut pour le texte
            strokeWidth: 0,
            baseStrokeWidth: 0, // Pas de stroke de base pour IText
            selectable: true, evented: true,
            padding: 5, // Un peu d'espace autour
            customData: { isDrawing: true } // Marqueur pour sauvegarde auto
        });

        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        text.enterEditing(); // Entrer en mode édition immédiatement
        text.selectAll(); // Sélectionner tout le texte pour remplacement facile

        // Réinitialiser les points
        isDrawing = false; // Était déjà false, mais pour confirmer
        startPoint = null; // Important
        fabricCanvas.requestRenderAll();
        // triggerAutoSaveDrawing(); // Sauvegarder après ajout (géré par main.js)
        return text; // Retourne l'objet texte créé
    }

    // Cas des formes (rect, ellipse, line)
    const finalObject = currentObject; // Garde une référence avant de réinitialiser

    // Réinitialisation de l'état de dessin AVANT les vérifications
    isDrawing = false;
    currentObject = null;
    startPoint = null; // Important

    if (finalObject) {
        // Annuler si le dessin est trop petit (considéré comme un clic simple)
        let tooSmall = false;
        if ((finalObject.type === 'rect' || finalObject.type === 'ellipse') && (Math.abs(finalObject.width) < 5 || Math.abs(finalObject.height) < 5)) {
             tooSmall = true;
        } else if (finalObject.type === 'line' && Math.abs(finalObject.x1 - finalObject.x2) < 5 && Math.abs(finalObject.y1 - finalObject.y2) < 5) {
            tooSmall = true;
        }

        if (tooSmall) {
             fabricCanvas.remove(finalObject);
             console.log("Dessin de forme annulé (taille trop petite).");
             fabricCanvas.renderAll();
             return null; // Pas d'objet créé
        }

        // Rendre l'objet final sélectionnable et interactif
        finalObject.setCoords(); // Très important après création/modification
        finalObject.set({
            selectable: true,
            evented: true,
            customData: { isDrawing: true } // Marqueur pour sauvegarde auto
        });

        // Ajuster l'origine pour Ellipse après dessin
        if (finalObject.type === 'ellipse') {
            // Recalculer le centre basé sur left/top/rx/ry avec origin left/top
            const center = finalObject.getCenterPoint();
             finalObject.set({
                 left: center.x,
                 top: center.y,
                 originX: 'center',
                 originY: 'center'
            });
            finalObject.setCoords();
        }

        // Sélectionner le nouvel objet
        fabricCanvas.setActiveObject(finalObject);
        fabricCanvas.renderAll();
        // triggerAutoSaveDrawing(); // Sauvegarder après ajout (géré par main.js)
        return finalObject; // Retourne l'objet forme créé
    }

    fabricCanvas.renderAll(); // Rendu final au cas où
    return null; // Aucun objet n'a été finalisé
}


// --- Fonctions de Manipulation (Grouper, Copier, Coller, Supprimer) ---

/**
 * Supprime les objets de dessin ou SVG sélectionnés.
 * Ne supprime pas les tags/textes géo.
 */
export function deleteSelectedDrawingShape() {
    const activeObj = fabricCanvas.getActiveObject();
    if (!activeObj || activeObj.isEditing) return; // Ne pas supprimer si en train d'éditer du texte

    // Ne pas supprimer les tags/textes géo (gérés par geo-tags.js)
    if (activeObj.customData?.isGeoTag || activeObj.customData?.isPlacedText) {
        showToast("Utilisez la toolbar flottante ou la touche Suppr pour effacer les tags géo.", "info");
        return;
    }
    // Ne pas supprimer les lignes de grille
    if (activeObj.isGridLine) return;

    // Confirmer avant de supprimer
    let count = 1;
    if (activeObj.type === 'activeSelection') {
        count = activeObj.getObjects().length;
    }
    if (confirm(`Supprimer ${count} objet(s) sélectionné(s) ?`)) {
        if (activeObj.type === 'activeSelection') {
            activeObj.forEachObject(obj => fabricCanvas.remove(obj));
            fabricCanvas.discardActiveObject(); // Important après suppression de groupe
        } else {
            fabricCanvas.remove(activeObj);
        }
        fabricCanvas.renderAll();
        // Déclencher sauvegarde (si nécessaire, géré par main.js via event 'object:removed' ou bouton)
        // triggerAutoSaveDrawing();
    }
}

/** Groupe les objets sélectionnés (y compris SVG de base si déverrouillés) */
export function groupSelectedObjects() {
    const activeObj = fabricCanvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'activeSelection') return;

    // --- MODIFICATION ICI ---
    // Vérification: Ne plus bloquer si la sélection contient des éléments SVG de base.
    // On garde la vérification pour les tags géo car ils ont une logique spécifique.
    const containsGeoTag = activeObj.getObjects().some(obj => obj.customData?.isGeoTag || obj.customData?.isPlacedText);
    if (containsGeoTag) {
         showToast("Impossible de grouper : la sélection contient des étiquettes ou textes géo.", "warning");
         return;
    }
    // --- FIN MODIFICATION ---

    // Le groupement est autorisé
    const group = activeObj.toGroup();
    group.customData = { isUserGroup: true }; // Marqueur pour dégrouper plus tard
    fabricCanvas.requestRenderAll();
    updateGroupButtonStates(); // Mettre à jour les boutons
}

/** Dégroupe l'objet sélectionné (si c'est un groupe créé par l'utilisateur) */
export function ungroupSelectedObject() {
    const activeObj = fabricCanvas.getActiveObject();
    // Dégrouper seulement si c'est un groupe et PAS un tag géo
    if (!activeObj || activeObj.type !== 'group' || activeObj.customData?.isGeoTag || activeObj.customData?.isPlacedText) {
        showToast("Sélectionnez un groupe valide à dégrouper.", "info");
        return;
    }

    // Convertit le groupe en une sélection active des objets qu'il contenait
    activeObj.toActiveSelection();
    fabricCanvas.requestRenderAll();
    updateGroupButtonStates(); // Mettre à jour les boutons
}

/** Met à jour l'état activé/désactivé des boutons Grouper/Dégrouper */
export function updateGroupButtonStates() { // Rendre exportable si appelée depuis main.js
    const groupBtn = document.getElementById('group-btn');
    const ungroupBtn = document.getElementById('ungroup-btn');
    if (!groupBtn || !ungroupBtn) return;

    const activeObject = fabricCanvas.getActiveObject();
    let canGroup = false;
    let canUngroup = false;

    if (activeObject) {
        if (activeObject.type === 'activeSelection') {
            const objects = activeObject.getObjects();
            // --- MODIFICATION ICI ---
            // Peut grouper si plus d'un objet et aucun n'est un tag/texte géo ou une ligne de grille
            canGroup = objects.length > 1 && !objects.some(obj => obj.customData?.isGeoTag || obj.customData?.isPlacedText || obj.isGridLine);
            // --- FIN MODIFICATION ---
        } else if (activeObject.type === 'group' && !(activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText)) {
            // Peut dégrouper si c'est un groupe qui n'est pas un tag/texte géo
            canUngroup = true;
        }
    }

    groupBtn.disabled = !canGroup;
    ungroupBtn.disabled = !canUngroup;
}


// --- Presse-papiers ---

/** Copie l'objet/la sélection active */
export function copyShape() {
    const activeObj = fabricCanvas.getActiveObject();
    if (!activeObj) return;

    // Filtrer les objets non copiables (tags géo, grille)
    if (activeObj.customData?.isGeoTag || activeObj.customData?.isPlacedText || activeObj.isGridLine) {
         showToast("Cet élément ne peut pas être copié.", "info");
         clipboard = null;
         document.getElementById('paste-btn')?.setAttribute('disabled', 'disabled'); // Désactiver Coller
         return;
    }
     // Vérifier les sélections multiples
     if (activeObj.type === 'activeSelection') {
         // --- MODIFICATION ICI ---
         // Autoriser la copie si la sélection contient des SVG (mais pas de tags géo)
         const containsInvalid = activeObj.getObjects().some(obj => obj.customData?.isGeoTag || obj.customData?.isPlacedText || obj.isGridLine);
         // --- FIN MODIFICATION ---
         if (containsInvalid) {
             showToast("La sélection contient des éléments non copiables (tags géo).", "warning");
             clipboard = null;
             document.getElementById('paste-btn')?.setAttribute('disabled', 'disabled'); // Désactiver Coller
             return;
         }
     }

    // Cloner l'objet avec ses propriétés custom
    activeObj.clone(cloned => {
        clipboard = cloned;
        showToast("Copié !", "info");
        // Activer le bouton Coller
        document.getElementById('paste-btn')?.removeAttribute('disabled');
    }, ['customData', 'baseStrokeWidth']); // Inclure nos propriétés custom
}

/** Colle l'objet/la sélection depuis le presse-papiers */
export function pasteShape() {
    if (!clipboard) {
         showToast("Presse-papiers vide.", "info");
        return;
    }

    clipboard.clone(clonedObj => {
        fabricCanvas.discardActiveObject(); // Désélectionner avant de coller

        // Positionner au centre de la vue actuelle
        const center = fabricCanvas.getVpCenter();

        // Appliquer position et rendre interactif
        clonedObj.set({
            left: center.x,
            top: center.y,
            originX: 'center',
            originY: 'center',
            evented: true,
            selectable: true, // Assurer la sélection
            customData: { ...(clonedObj.customData || {}), isDrawing: true } // Marqueur dessin
        });

        // Gérer le cas où l'objet copié était une sélection groupée
        if (clonedObj.type === 'activeSelection') {
            clonedObj.canvas = fabricCanvas;
            clonedObj.forEachObject(obj => {
                // Ajouter chaque objet du groupe cloné au canvas principal
                fabricCanvas.add(obj);
            });
            clonedObj.setCoords(); // Coordonnées pour le groupe de sélection
        } else {
            fabricCanvas.add(clonedObj); // Ajoute l'objet simple
        }

        // Mettre à jour la position "fantôme" du clipboard pour le prochain collage
        clipboard.set({
             left: (clonedObj.left || center.x) + 20 / fabricCanvas.getZoom(), // Décaler en pixels écran
             top: (clonedObj.top || center.y) + 20 / fabricCanvas.getZoom()
        });

        // Sélectionner l'objet collé
        fabricCanvas.setActiveObject(clonedObj);
        fabricCanvas.requestRenderAll();
        showToast("Collé !", "info");
        // triggerAutoSaveDrawing(); // Sauvegarder après collage (géré par main.js)

    }, ['customData', 'baseStrokeWidth']); // Propriétés custom à cloner
}

// Fonction utilitaire (si getCanvasLock n'est pas importable directement)
// À ajouter si setActiveTool ne peut pas l'importer de canvas.js
/*
function getCanvasLock() {
    const lockBtn = document.getElementById('toggle-lock-svg-btn');
    return lockBtn ? lockBtn.classList.contains('active') : true; // Retourne true (verrouillé) par défaut
}
*/
