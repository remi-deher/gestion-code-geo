// --- IMPORTS ---
import {
    initializeCanvas, loadSvgPlan, loadPlanImage,
    getCanvasInstance, resizeCanvas,
    resetZoom, setCanvasLock, getCanvasLock,
    findSvgShapeByCodeGeo, toggleSnapToGrid, getSnapToGrid
} from './canvas.js';

import {
    initializeSidebar,
    fetchAndClassifyCodes, // Fonction pour charger et classer
    populateUniversSelectInModal, // Pour la modale d'ajout
    handleSaveNewCodeInModal // Pour la modale d'ajout
} from './sidebar.js';

import {
    initializeDrawingTools, // Outils de dessin (rectangle, etc.)
    setDrawingMode, // Activer/désactiver un mode
    getCurrentDrawingMode // Obtenir le mode actuel
} from './drawing-tools.js';

import {
    initializeUI, // Boutons (toggle sidebar, fullscreen)
    showLoading, hideLoading // Indicateur de chargement
} from './ui.js';

// Importer showToast depuis le bon fichier
import { showToast } from '../modules/utils.js';

// *** CORRECTION 5: Importer 'sizePresets' au lieu des constantes individuelles ***
import {
    sizePresets, // Importer l'objet des tailles
    GEO_TEXT_FONT_SIZE
} from '../modules/config.js';
// *** FIN CORRECTION 5 ***


// --- INITIALISATION GLOBALE ---
console.log("Plan Editor v2 (Clic Droit) - DOMContentLoaded");

let fabricCanvas; // Instance du canvas Fabric
let currentPlanId; // ID du plan en cours
let planType; // 'svg' ou 'image'
let planImageUrl; // URL de l'image (si type 'image')
let planSvgUrl; // URL du SVG (si type 'svg')
let initialPlacedGeoCodes; // Données des codes géo déjà placés
let universColors; // Mapping des couleurs par univers

// Récupération des données PHP injectées
try {
    const phpData = window.PHP_DATA || {};
    initialPlacedGeoCodes = phpData.placedGeoCodes || [];
    universColors = phpData.universColors || {};
    currentPlanId = phpData.currentPlanId;
    planType = phpData.planType;
    planImageUrl = phpData.planImageUrl;
    planSvgUrl = phpData.planSvgUrl;

    if (!currentPlanId || !planType) {
        throw new Error("Données PHP essentielles (planId, planType) manquantes.");
    }
    console.log("Données initiales:", phpData);

} catch (error) {
    console.error("Erreur lors de la récupération des données PHP:", error);
    showToast("Erreur critique: Données initiales non chargées.", 'error');
    // Arrêter l'exécution si les données critiques manquent
    // return; // Ne fonctionne pas au niveau global, mais on devrait stopper
}


// --- DÉMARRAGE ---
document.addEventListener('DOMContentLoaded', async () => {
    showLoading("Initialisation du plan...");
    try {
        // 1. Initialiser le Canvas Fabric
        fabricCanvas = initializeCanvas('plan-canvas');
        if (!fabricCanvas) {
            throw new Error("Impossible d'initialiser le canvas Fabric.");
        }
        console.log("Canvas Fabric initialisé dans canvas.js");

        // 2. Initialiser les modules UI (Sidebar, Outils, Boutons)
        // Note: La sidebar a besoin de 'fabricCanvas' et des 'universColors'
        initializeSidebar(fabricCanvas, universColors, currentPlanId, planType);
        console.log("Sidebar (rôle info) initialisée.");

        initializeDrawingTools(fabricCanvas, handleDrawingComplete);
        console.log("Outils de dessin initialisés.");

        initializeUI(fabricCanvas); // Toggle sidebar, fullscreen
        console.log("UI (sidebar toggle, fullscreen) initialisée.");

        // 3. Charger le plan (SVG ou Image)
        // Cette étape charge le fond et redimensionne le canvas
        if (planType === 'svg' && planSvgUrl) {
            await loadSvgPlan(planSvgUrl);
            // Pour SVG, on verrouille le fond par défaut
            setCanvasLock(true);
        } else if (planType === 'image' && planImageUrl) {
            await loadPlanImage(planImageUrl);
            // Pour Image, on verrouille aussi
            setCanvasLock(true);
        } else {
            // Pas de plan chargé, on fait un resize standard
            resizeCanvas();
            showToast("Aucun plan (SVG/Image) n'a été chargé.", 'warning');
        }

        // 4. Attacher les écouteurs d'événements principaux
        setupEventListeners();

        // 5. Créer les éléments géo initiaux (après chargement du plan)
        // Note: createInitialGeoElements dépend du type de plan (SVG vs Image)
        // et doit être appelé APRÈS le chargement du plan (loadSvgPlan/loadPlanImage)
        // car il peut nécessiter de trouver des formes SVG cibles.
        createInitialGeoElements(initialPlacedGeoCodes, planType);

        // 6. Remplir la sidebar (après création des éléments initiaux)
        // fetchAndClassifyCodes(currentPlanId, planType); // Déplacé ? Non, nécessaire ici.
        // updatePlacedCodesList(); // Met à jour la liste des codes placés (basé sur canvas)
        // updateAvailableCodesList(); // Met à jour la liste des codes non placés (basé sur API)
        // => Remplacé par:
        await fetchAndClassifyCodes(); // Charge et met à jour les 2 listes

        // 7. Remplir le sélecteur d'univers dans la modale "Ajouter Code"
        // On suppose que les univers sont dans les données initiales
        populateUniversSelectInModal(universColors);

        // 8. Attacher l'événement au bouton "Sauvegarder" de la modale "Ajouter Code"
        document.getElementById('saveNewGeoCodeBtn')?.addEventListener('click', async () => {
            const success = await handleSaveNewCodeInModal(currentPlanId);
            if (success) {
                // Recharger les listes dans la sidebar
                await fetchAndClassifyCodes();
            }
        });


    } catch (error) {
        console.error("Erreur majeure lors de l'initialisation:", error);
        showToast(`Erreur d'initialisation: ${error.message}`, 'error');
    } finally {
        hideLoading();
        // S'assurer que le canvas est à la bonne taille même si le chargement du plan échoue
        resizeCanvas();
        resetZoom();
        console.log("Fin initialisation main.js");
    }
});


/**
 * Attache les écouteurs d'événements principaux au canvas et au document.
 */
function setupEventListeners() {
    if (!fabricCanvas) return;

    // --- Événements Souris sur le Canvas ---

    // Clic Droit (Menu Contextuel)
    fabricCanvas.on('mouse:down', (options) => {
        if (options.button === 3) { // Clic droit
            handleRightClick(options);
        }
    });

    // Clic Gauche
    fabricCanvas.on('mouse:down', (options) => {
        if (options.button === 1) { // Clic gauche
            // Clic sur le canvas (pas un objet)
            if (!options.target) {
                handleCanvasClick(options);
            }
            // Clic sur un objet (géré par 'selection:created')
        }
    });

    // Mouvement de la souris (pour le magnétisme)
    fabricCanvas.on('object:moving', (options) => {
        if (getSnapToGrid()) {
            const snapSize = 10; // Taille de la grille (en pixels)
            const target = options.target;
            target.set({
                left: Math.round(target.left / snapSize) * snapSize,
                top: Math.round(target.top / snapSize) * snapSize
            });
        }
    });

    // Fin du déplacement d'un objet (Mise à jour DB)
    fabricCanvas.on('object:modified', (e) => {
        const target = e.target;
        if (target && (target.customData?.isGeoTag || target.customData?.isPlacedText)) {
            console.log("Objet modifié (déplacé):", target.customData.codeGeo);
            handleObjectMoved(target);
        }
    });

    // Sélection d'un objet
    fabricCanvas.on('selection:created', (e) => {
        const target = e.selected[0]; // On gère la sélection unique
        if (target && (target.customData?.isGeoTag || target.customData?.isPlacedText)) {
            handleObjectSelected(target);
        }
    });

    // Désélection
    fabricCanvas.on('selection:cleared', (e) => {
        handleObjectDeselected();
    });


    // --- Événements du Document (Menu Contextuel, Raccourcis) ---

    // Clic global (pour fermer le menu contextuel)
    document.addEventListener('click', () => {
        const contextMenu = document.getElementById('custom-context-menu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
    });

    // Empêcher le menu contextuel natif sur le canvas
    fabricCanvas.upperCanvasEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Raccourcis clavier
    document.addEventListener('keydown', (e) => {
        // Supprimer l'objet sélectionné avec la touche 'Delete' ou 'Backspace'
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const activeObject = fabricCanvas.getActiveObject();
            if (activeObject && (activeObject.customData?.isGeoTag || activeObject.customData?.isPlacedText)) {
                e.preventDefault(); // Empêcher la navigation retour
                console.log("Touche Suppr. - Suppression de :", activeObject.customData.codeGeo);
                handleDeleteObject(activeObject);
            }
        }

        // Échapper (Désélection, Annuler dessin)
        if (e.key === 'Escape') {
            // Annuler le mode dessin
            if (getCurrentDrawingMode()) {
                setDrawingMode(null);
            }
            // Désélectionner l'objet actif
            fabricCanvas.discardActiveObject();
            fabricCanvas.requestRenderAll();
        }
    });
}

// --- GESTIONNAIRES D'ÉVÉNEMENTS (Canvas) ---

/**
 * Gère le clic droit sur le canvas (affiche le menu contextuel).
 * @param {object} options - Événement Fabric 'mouse:down'
 */
function handleRightClick(options) {
    const contextMenu = document.getElementById('custom-context-menu');
    if (!contextMenu) return;

    // Masquer tous les items par défaut
    contextMenu.querySelectorAll('li').forEach(item => item.style.display = 'none');

    const target = options.target;
    const pointer = fabricCanvas.getPointer(options.e);

    if (target && (target.customData?.isGeoTag || target.customData?.isPlacedText)) {
        // Clic droit sur un Géo Code (Tag ou Texte)
        fabricCanvas.setActiveObject(target); // Sélectionner l'objet
        document.getElementById('menu-item-delete').style.display = 'block';
        document.getElementById('menu-item-info').style.display = 'block';
        // Attacher l'objet cible aux actions du menu
        document.getElementById('menu-action-delete').onclick = () => handleDeleteObject(target);
        document.getElementById('menu-action-info').onclick = () => alert(JSON.stringify(target.customData, null, 2));

    } else if (target && target.isSvgShape) {
        // Clic droit sur une forme SVG (pour placement de texte)
        document.getElementById('menu-item-place-text').style.display = 'block';
        document.getElementById('menu-action-place-text').onclick = () => {
            // Simule un "drop" de texte sur cette forme
            // On récupère le code sélectionné dans la sidebar
            const selectedCodeEl = document.querySelector('#available-codes-list .list-group-item.active');
            if (selectedCodeEl) {
                const codeData = JSON.parse(selectedCodeEl.dataset.code);
                console.log("Placement (Menu Clic Droit) de:", codeData.code_geo, "sur SVG:", target.customData.svgId);
                // On crée l'objet texte et on le sauvegarde
                const textObject = placeTextOnSvg(codeData, target);
                if (textObject) {
                    handleObjectPlaced(textObject, codeData.id);
                }
            } else {
                showToast("Veuillez sélectionner un code dans la liste 'Disponibles'.", 'info');
            }
        };

    } else {
        // Clic droit sur le canvas vide
        document.getElementById('menu-item-add-tag').style.display = 'block';
        document.getElementById('menu-item-toggle-grid').style.display = 'block';
        document.getElementById('menu-item-toggle-lock').style.display = 'block';

        // Mettre à jour le texte des items "toggle"
        document.getElementById('menu-text-toggle-grid').textContent = getSnapToGrid() ? "Désactiver Magnétisme" : "Activer Magnétisme";
        document.getElementById('menu-text-toggle-lock').textContent = getCanvasLock() ? "Déverrouiller le plan" : "Verrouiller le plan";

        // Attacher les actions
        document.getElementById('menu-action-add-tag').onclick = () => {
            // Simule un "drop" de tag à cet endroit
            const selectedCodeEl = document.querySelector('#available-codes-list .list-group-item.active');
            if (selectedCodeEl) {
                const codeData = JSON.parse(selectedCodeEl.dataset.code);
                console.log("Placement (Menu Clic Droit) de:", codeData.code_geo, "en (x,y):", pointer.x, pointer.y);
                const tagObject = placeTagAtPoint(codeData, pointer);
                if (tagObject) {
                    handleObjectPlaced(tagObject, codeData.id);
                }
            } else {
                showToast("Veuillez sélectionner un code dans la liste 'Disponibles'.", 'info');
            }
        };
        document.getElementById('menu-action-toggle-grid').onclick = () => toggleSnapToGrid();
        document.getElementById('menu-action-toggle-lock').onclick = () => setCanvasLock(!getCanvasLock());
    }

    // Afficher le menu à la position du clic
    contextMenu.style.left = `${options.e.clientX}px`;
    contextMenu.style.top = `${options.e.clientY}px`;
    contextMenu.style.display = 'block';
}

/**
 * Gère le clic gauche sur le canvas (pas sur un objet).
 * Utilisé pour le dessin ou le placement.
 * @param {object} options - Événement Fabric 'mouse:down'
 */
function handleCanvasClick(options) {
    const mode = getCurrentDrawingMode();
    const pointer = fabricCanvas.getPointer(options.e);

    if (mode === 'tag') {
        // Mode "Placer Tag" activé (via sidebar)
        const selectedCodeEl = document.querySelector('#available-codes-list .list-group-item.active');
        if (!selectedCodeEl) {
            showToast("Aucun code disponible sélectionné.", 'warning');
            setDrawingMode(null); // Annuler le mode
            return;
        }
        const codeData = JSON.parse(selectedCodeEl.dataset.code);

        // Créer le tag et le sauvegarder
        console.log("Placement (Clic Gauche) de:", codeData.code_geo, "en (x,y):", pointer.x, pointer.y);
        const tagObject = placeTagAtPoint(codeData, pointer);
        if (tagObject) {
            handleObjectPlaced(tagObject, codeData.id);
        }

        // Option: Désactiver le mode après un clic ?
        // setDrawingMode(null);

    } else if (mode === 'rect') {
        // Mode "Dessin Rectangle" (géré par drawing-tools.js)
        // Ne rien faire ici, la logique est dans drawing-tools
    }
}

/**
 * Gère la sélection d'un objet Géo (Tag ou Texte).
 * @param {fabric.Object} target - Objet Fabric sélectionné.
 */
function handleObjectSelected(target) {
    // Mettre en surbrillance l'item correspondant dans la sidebar "Placés"
    const positionId = target.customData?.position_id;
    if (!positionId) return;

    document.querySelectorAll('#placed-codes-list .list-group-item').forEach(item => {
        if (item.dataset.positionId == positionId) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

/**
 * Gère la désélection d'objets.
 */
function handleObjectDeselected() {
    // Retirer la surbrillance de tous les items "Placés"
    document.querySelectorAll('#placed-codes-list .list-group-item.active').forEach(item => {
        item.classList.remove('active');
    });
}

// --- GESTIONNAIRES D'ACTIONS (CRUD) ---

/**
 * Appelé lorsqu'un nouvel objet (Tag ou Texte) est finalisé sur le canvas.
 * (Soit par clic, soit par drop, soit par dessin).
 * @param {fabric.Object} fabricObject - Le nouvel objet Fabric créé.
 * @param {string|number} geoCodeId - L'ID du Géo Code (pas le position_id).
 */
async function handleObjectPlaced(fabricObject, geoCodeId) {
    showLoading("Sauvegarde...");
    try {
        const { x_percent, y_percent } = convertPixelsToPercent(
            fabricObject.left,
            fabricObject.top,
            fabricCanvas
        );

        // Données à sauvegarder
        const positionData = {
            geo_code_id: geoCodeId,
            plan_id: currentPlanId,
            pos_x: x_percent,
            pos_y: y_percent,
            // Pour les Tags rectangulaires (type 'image' ou dessin)
            width: fabricObject.customData.isGeoTag ? fabricObject.width * fabricObject.scaleX : null,
            height: fabricObject.customData.isGeoTag ? fabricObject.height * fabricObject.scaleY : null,
            // Pour le texte sur SVG (type 'svg')
            anchor_x: fabricObject.customData.isPlacedText ? fabricObject.customData.anchorSvgId : null,
            anchor_y: null // Non utilisé ?
        };

        // Appel API
        const savedPosition = await savePosition(positionData);

        // Mettre à jour l'objet Fabric avec le position_id retourné par l'API
        fabricObject.set('customData', {
            ...fabricObject.customData, // Conserver les données existantes (id, code_geo, etc.)
            position_id: savedPosition.id, // Ajouter le nouveau position_id
            plan_id: savedPosition.plan_id // Confirmer le plan_id
        });
        fabricCanvas.requestRenderAll();

        showToast(`Code "${fabricObject.customData.codeGeo}" placé.`, 'success');

        // Mettre à jour les listes de la sidebar
        await fetchAndClassifyCodes();

    } catch (error) {
        console.error("Erreur lors de la sauvegarde de la position:", error);
        showToast(`Échec sauvegarde: ${error.message}`, 'error');
        // Si la sauvegarde échoue, supprimer l'élément du canvas
        fabricCanvas.remove(fabricObject);
    } finally {
        hideLoading();
        // Quoi qu'il arrive, désactiver le mode dessin/placement
        setDrawingMode(null);
    }
}

/**
 * Appelé lorsqu'un objet Géo est déplacé sur le canvas.
 * @param {fabric.Object} target - L'objet Fabric qui a été déplacé.
 */
async function handleObjectMoved(target) {
    showLoading("Mise à jour...");
    try {
        const { x_percent, y_percent } = convertPixelsToPercent(
            target.left,
            target.top,
            fabricCanvas
        );
        const positionId = target.customData.position_id;

        // Données à sauvegarder
        const positionData = {
            pos_x: x_percent,
            pos_y: y_percent,
            // Mettre à jour la taille si c'est un tag (non-texte)
            width: target.customData.isGeoTag ? target.width * target.scaleX : null,
            height: target.customData.isGeoTag ? target.height * target.scaleY : null,
            // Anchor ne change pas lors d'un déplacement (pour l'instant)
            anchor_x: target.customData.anchorSvgId || null,
            anchor_y: null
        };

        // Appel API (savePosition gère l'update si positionId est fourni)
        await savePosition(positionData, positionId);

        showToast(`Position de "${target.customData.codeGeo}" mise à jour.`, 'success');

        // Mettre à jour les listes (au cas où, même si pas indispensable)
        // await fetchAndClassifyCodes(); // Peut-être lourd, à voir.

    } catch (error) {
        console.error("Erreur lors de la mise à jour de la position:", error);
        showToast(`Échec mise à jour: ${error.message}`, 'error');
        // TODO: Remettre l'objet à sa position précédente ? (Nécessite de stocker l'état 'object:moving')
    } finally {
        hideLoading();
    }
}

/**
 * Appelé lors d'un clic sur 'Supprimer' (menu contextuel ou touche clavier).
 * @param {fabric.Object} target - L'objet Fabric à supprimer.
 */
async function handleDeleteObject(target) {
    const positionId = target.customData?.position_id;
    const codeGeo = target.customData?.codeGeo || "inconnu";

    if (!positionId) {
        console.warn("Tentative de suppression d'un objet sans position_id (probablement non sauvegardé). Suppression locale.");
        fabricCanvas.remove(target);
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
        // Mettre à jour les listes (si jamais il était compté)
        await fetchAndClassifyCodes();
        return;
    }

    if (!confirm(`Voulez-vous vraiment supprimer le code "${codeGeo}" de ce plan ?`)) {
        return;
    }

    showLoading("Suppression...");
    try {
        // Appel API
        await deletePosition(positionId);

        // Supprimer du canvas
        fabricCanvas.remove(target);
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();

        showToast(`Code "${codeGeo}" supprimé du plan.`, 'success');

        // Mettre à jour les listes (essentiel ici)
        await fetchAndClassifyCodes();

    } catch (error) {
        console.error("Erreur lors de la suppression de la position:", error);
        showToast(`Échec suppression: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}


/**
 * Appelé lorsque le dessin d'un outil (ex: rectangle) est terminé.
 * @param {fabric.Object} drawnObject - L'objet dessiné (ex: fabric.Rect)
 */
function handleDrawingComplete(drawnObject) {
    const mode = getCurrentDrawingMode();

    if (mode === 'rect') {
        // Le dessin d'un rectangle est terminé
        // On le transforme en Géo Tag
        console.log("Dessin rectangle terminé. Objet:", drawnObject);

        // 1. Récupérer le code sélectionné dans la sidebar
        const selectedCodeEl = document.querySelector('#available-codes-list .list-group-item.active');
        if (!selectedCodeEl) {
            showToast("Aucun code disponible sélectionné pour ce rectangle.", 'warning');
            fabricCanvas.remove(drawnObject); // Annuler le dessin
            setDrawingMode(null);
            return;
        }
        const codeData = JSON.parse(selectedCodeEl.dataset.code);
        const universColor = universColors[codeData.univers_id] || '#6c757d';

        // 2. Mettre à jour l'objet dessiné (le rectangle) en Géo Tag
        const tagObject = updateFabricTag(drawnObject, codeData, universColor);

        // 3. Sauvegarder (comme un placement standard)
        handleObjectPlaced(tagObject, codeData.id);

        // 4. Quitter le mode dessin
        setDrawingMode(null);
    }
}


// --- FONCTIONS DE PLACEMENT (Création Fabric) ---

/**
 * Crée un objet Texte (fabric.IText) sur une forme SVG cible.
 * @param {object} codeData - Données complètes du Géo Code (code_geo, id, etc.)
 * @param {fabric.Object} targetSvgShape - Forme SVG (objet Fabric) où placer le texte.
 * @returns {fabric.Object|null} Le textObject créé ou null si échec.
 */
function placeTextOnSvg(codeData, targetSvgShape) {
    if (!targetSvgShape || !targetSvgShape.getCenterPoint) {
        console.error("placeTextOnSvg: targetSvgShape invalide");
        return null;
    }
    // const bbox = targetSvgShape.getBoundingRect();
    const center = targetSvgShape.getCenterPoint(); // Centre de la forme SVG
    const zoom = fabricCanvas.getZoom();

    // *** CORRECTION 3: Utiliser snake_case (code_geo) ***
    const textToShow = codeData.code_geo || 'ERREUR'; // Fallback si code_geo est null/undefined
    if (!codeData.code_geo) {
        console.warn("placeTextOnSvg: codeData.code_geo est manquant ou vide pour l'ID:", codeData.id, "Utilisation de 'ERREUR'.");
    }
    // *** FIN CORRECTION 3 ***

    // Utiliser les coordonnées % converties (point du clic) plutôt que le centre de la forme?
    // Non, utilisons le centre de la forme, c'est plus logique.
    // const { left, top } = convertPercentToPixels(codeData.pos_x, codeData.pos_y, fabricCanvas);

    const fontSize = (GEO_TEXT_FONT_SIZE || 16) / zoom; // Taille de base adaptée au zoom (Utiliser GEO_TEXT_FONT_SIZE)

    const textObject = new fabric.IText(textToShow, { // Utiliser textToShow
        left: center.x,
        top: center.y,
        originX: 'center', originY: 'center',
        fontSize: fontSize,
        fill: '#000000', // Texte noir
        stroke: '#FFFFFF', // Contour blanc pour lisibilité
        paintFirst: 'stroke', // Dessine le contour d'abord
        strokeWidth: 0.5 / zoom,
        baseStrokeWidth: 0.5, // Stocker base
        fontFamily: 'Arial',
        textAlign: 'center',
        selectable: true, evented: true, hasControls: false, hasBorders: true,
        borderColor: '#007bff', cornerSize: 0, transparentCorners: true,
        lockRotation: true,

        // Stocker TOUTES les données (code + position)
        customData: {
            ...codeData,
            // *** CORRECTION 3: Utiliser snake_case (code_geo) ***
            codeGeo: codeData.code_geo, // Stocker la valeur originale, même si null
            // *** FIN CORRECTION 3 ***
            isPlacedText: true, // Marqueur spécifique
            isGeoTag: false, // Pas une étiquette standard
            anchorSvgId: targetSvgShape.customData?.svgId, // ID de la forme SVG parente
            id: parseInt(codeData.id, 10), // ID du code géo
            position_id: parseInt(codeData.position_id, 10) || null, // ID de la position (peut être null si nouvelle)
            plan_id: parseInt(codeData.plan_id, 10) || parseInt(currentPlanId, 10)
        }
    });

    fabricCanvas.add(textObject);
    textObject.moveTo(999); // Mettre au premier plan
    return textObject;
}

/**
 * Crée un Géo Tag (rectangle + texte) à un point spécifique (x, y).
 * @param {object} codeData - Données complètes du Géo Code (code_geo, id, etc.)
 * @param {object} point - Coordonnées Fabric { x, y } où centrer le tag.
 * @returns {fabric.Object|null} Le group (tag) créé ou null si échec.
 */
function placeTagAtPoint(codeData, point) {
    if (!point) {
        console.error("placeTagAtPoint: point (x, y) manquant.");
        return null;
    }
    const universColor = universColors[codeData.univers_id] || '#6c757d';

    // *** CORRECTION 5: Utiliser 'sizePresets' ***
    const tagData = {
        ...codeData,
        pos_x_pixels: point.x,
        pos_y_pixels: point.y,
        width: sizePresets.medium.width, // Utiliser la largeur moyenne par défaut
        height: sizePresets.medium.height, // Utiliser la hauteur moyenne par défaut
        // Pas de position_id pour l'instant (sera ajouté lors de la sauvegarde)
        position_id: null,
        plan_id: currentPlanId
    };
    // *** FIN CORRECTION 5 ***

    const tagObject = createFabricTag(tagData, universColor);

    if (tagObject) {
        // Centrer l'objet sur le point de clic/drop
        tagObject.set({
            left: point.x - (tagObject.width / 2),
            top: point.y - (tagObject.height / 2),
            originX: 'left', // Origine standard
            originY: 'top'
        });
        fabricCanvas.add(tagObject);
        fabricCanvas.setActiveObject(tagObject); // Sélectionner le nouveau tag
        tagObject.moveTo(999); // Mettre au premier plan
    }
    return tagObject;
}



// --- INITIALISATION AU CHARGEMENT DE LA PAGE ---

/**
 * Crée les objets Fabric (Tags ou Textes) initiaux au chargement de la page,
 * à partir des données PHP (initialPlacedGeoCodes).
 * @param {Array} placedGeoCodes - Données PHP (codes + positions)
 * @param {string} planType - 'svg' ou 'image'
 */
function createInitialGeoElements(placedGeoCodes, planType) {
    console.log("Création éléments géo initiaux...");
    if (!fabricCanvas || !placedGeoCodes || placedGeoCodes.length === 0) {
        console.warn("createInitialGeoElements: Canvas non prêt ou aucun code géo initial.");
        return;
    }

    let createdCount = 0;

    placedGeoCodes.forEach(elementData => {
        // 'elementData' contient un mix des infos de 'geo_codes' et 'geo_positions'
        // (voir GeoCodeManager::getAllGeoCodesWithPositions)

        // Sécurité: Vérifier si les IDs essentiels sont présents
        // (Corrigé dans GeoCodeManager en PHP, mais bonne sécurité ici)
        if (!elementData.id || !elementData.position_id) {
            console.error("ERREUR createInitial: ID ou Position_ID manquant!", { codeInfo: elementData.codeInfo, placement: elementData.placement });
            return; // Skip cet élément
        }

        let createdElement = null;

        // Cas 1: C'est un texte à placer sur un plan SVG
        if (planType === 'svg' && (elementData.width === null || elementData.width === undefined)) {
            // C'est un placement de texte (pas un tag rectangulaire)

            // 1a. Trouver la forme SVG cible via l'ancre (anchor_x)
            const targetSvgShape = findSvgShapeByCodeGeo(elementData.anchor_x);
            if (targetSvgShape) {
                console.log(`Création Texte initial: ${elementData.code_geo} (sur SVG: ${elementData.anchor_x})`);
                createdElement = placeTextOnSvg(elementData, targetSvgShape);
            } else {
                console.warn(`Forme SVG cible "${elementData.anchor_x}" non trouvée pour le code "${elementData.code_geo}" (ID: ${elementData.id}). Tentative de placement par (x,y).`);

                // 1b. Plan B: Placer par (x,y) si la forme n'est pas trouvée
                // (Peu fiable sur SVG, mais mieux que rien)
                // TODO: Implémenter un placement texte simple par (x,y) ?
                // Pour l'instant, on ignore s'il n'y a pas d'ancre
            }

        }
        // Cas 2: C'est un tag rectangulaire (Plan Image, ou data de type tag sur SVG)
        else if (elementData.width !== null && elementData.width !== undefined) {
            // C'est un tag rectangulaire (avec largeur/hauteur)

            if (planType === 'image') {
                // Convertir les % en pixels pour le placement initial
                const { left, top } = convertPercentToPixels(elementData.pos_x, elementData.pos_y, fabricCanvas);
                // Préparer les données pour createFabricTag
                const tagData = {
                    ...elementData,
                    pos_x_pixels: left,
                    pos_y_pixels: top
                    // width et height sont déjà dans elementData
                };
                const universColor = universColors[elementData.univers_id] || '#6c757d';

                console.log(`Création Tag initial: ${elementData.code_geo}`);
                createdElement = createFabricTag(tagData, universColor);
                if (createdElement) {
                    fabricCanvas.add(createdElement);
                }

            } else {
                // (planType === 'svg')
                // On ignore les tags rectangulaires sur les plans SVG (logique métier)
                console.warn(`Tag rectangulaire (${elementData.code_geo}) ignoré sur plan SVG.`, elementData);
            }

        }

        // Si l'élément a échoué (ex: forme SVG non trouvée)
        if (!createdElement) {
            console.error(`Échec création élément Fabric initial pour:`, elementData);
        } else {
            createdCount++;
        }
    });

    console.log(`${createdCount} éléments géo initiaux créés.`);
    fabricCanvas.requestRenderAll();
}


// *** CORRECTION 2: Réintégration des fonctions API et Utilitaires ***

// --- API (Sauvegarde, Suppression) ---

/**
 * Sauvegarde (Crée ou Met à jour) une position via l'API.
 * @param {object} positionData - Données de position (geo_code_id, plan_id, pos_x, pos_y, etc.)
 * @param {number|null} [positionId=null] - ID de la position (si mise à jour)
 * @returns {Promise<object>} Les données de la position sauvegardée
 */
async function savePosition(positionData, positionId = null) {
    const url = `index.php?action=savePosition${positionId ? '&id=' + positionId : ''}`;
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(positionData)
    };

    try {
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok || data.status !== 'success') {
            throw new Error(data.message || 'Erreur lors de la sauvegarde');
        }

        console.log("Position sauvegardée:", data.data);
        return data.data; // Renvoie les données de la position (avec son ID)

    } catch (error) {
        console.error('Erreur API (savePosition):', error);
        throw error; // Propage l'erreur pour que le .catch() appelant puisse la gérer
    }
}

/**
 * Supprime une position via l'API.
 * @param {number} positionId - ID de la position à supprimer
 * @returns {Promise<object>} Réponse JSON de l'API
 */
async function deletePosition(positionId) {
    const url = `index.php?action=deletePosition&id=${positionId}`;
    const options = {
        method: 'POST', // Utiliser POST pour la suppression (ou DELETE si l'API le gère)
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    };

    try {
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok || data.status !== 'success') {
            throw new Error(data.message || 'Erreur lors de la suppression');
        }

        console.log("Position supprimée:", data);
        return data;

    } catch (error) {
        console.error('Erreur API (deletePosition):', error);
        throw error;
    }
}


// --- API (Récupération de données) ---

/**
 * Récupère les codes non placés pour un plan spécifique (par univers).
 * @param {number} planId - ID du plan
 * @returns {Promise<Array>} Liste des codes géo disponibles
 */
async function fetchAvailableCodes(planId) {
    const url = `index.php?action=getAvailableCodes&plan_id=${planId}`;
    try {
        const response = await fetch(url, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data.status !== 'success') {
            throw new Error(data.message || 'Erreur API');
        }
        return data.codes || [];
    } catch (error) {
        console.error('Erreur API (fetchAvailableCodes):', error);
        showToast(`Erreur chargement codes disponibles: ${error.message}`, 'error');
        return []; // Retourner un tableau vide en cas d'échec
    }
}

/**
 * Récupère les codes déjà placés sur un plan.
 * (Note: Obsolète ? Les codes placés sont chargés initialement via PHP_DATA)
 * @param {number} planId - ID du plan
 * @returns {Promise<Array>} Liste des codes géo placés
 */
async function fetchPlacedCodes(planId) {
    const url = `index.php?action=getPlacedCodes&plan_id=${planId}`;
    try {
        const response = await fetch(url, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data.status !== 'success') {
            throw new Error(data.message || 'Erreur API');
        }
        return data.codes || [];
    } catch (error) {
        console.error('Erreur API (fetchPlacedCodes):', error);
        showToast(`Erreur chargement codes placés: ${error.message}`, 'error');
        return [];
    }
}

/**
 * Récupère les détails d'un code géo par son ID.
 * @param {number} geoCodeId - ID du Géo Code
 * @returns {Promise<object|null>} Données du code géo
 */
async function fetchGeoCodeById(geoCodeId) {
    const url = `index.php?action=getGeoCodeJson&id=${geoCodeId}`;
    try {
        const response = await fetch(url, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data.status !== 'success') {
            throw new Error(data.message || 'Code non trouvé');
        }
        return data.code || null;
    } catch (error) {
        console.error('Erreur API (fetchGeoCodeById):', error);
        showToast(`Erreur récupération code ${geoCodeId}: ${error.message}`, 'error');
        return null;
    }
}

/**
 * Crée un nouveau Géo Code via l'API (utilisé par la modale).
 * @param {object} codeData - Données du code (code_geo, libelle, univers_id, etc.)
 * @returns {Promise<object>} Le code géo créé
 */
async function saveNewGeoCode(codeData) {
    const url = 'index.php?action=createGeoCodeAjax';
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(codeData)
    };

    try {
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok || data.status !== 'success') {
            // Gérer les erreurs de validation
            if (data.errors) {
                const errorMsg = Object.values(data.errors).join(', ');
                throw new Error(errorMsg);
            }
            throw new Error(data.message || 'Erreur lors de la création du code');
        }

        console.log("Nouveau code créé:", data.code);
        return data.code; // Renvoie les données du code créé

    } catch (error) {
        console.error('Erreur API (saveNewGeoCode):', error);
        throw error; // Propage l'erreur
    }
}


// --- UTILITAIRES DE CONVERSION (Coordonnées) ---

/**
 * Convertit les coordonnées pixels (Fabric) en pourcentage (%) du plan.
 * @param {number} pixelX - Coordonnée X (left) en pixels
 *_ @param {number} pixelY - Coordonnée Y (top) en pixels
 * @param {fabric.Canvas} canvas - Instance du canvas Fabric
 * @returns {object} { x_percent, y_percent }
 */
function convertPixelsToPercent(pixelX, pixelY, canvas) {
    if (!canvas.backgroundObject) {
        console.warn("convertPixelsToPercent: Arrière-plan non trouvé.");
        // Fallback: utiliser la taille du canvas (moins précis si zoomé)
        return {
            x_percent: (pixelX / canvas.width) * 100,
            y_percent: (pixelY / canvas.height) * 100
        };
    }

    const bg = canvas.backgroundObject;
    const bgWidth = bg.width * bg.scaleX;
    const bgHeight = bg.height * bg.scaleY;
    const bgLeft = bg.left;
    const bgTop = bg.top;

    // Calculer la position relative à l'arrière-plan
    const relativeX = pixelX - bgLeft;
    const relativeY = pixelY - bgTop;

    // Convertir en pourcentage de la taille de l'arrière-plan
    const x_percent = (relativeX / bgWidth) * 100;
    const y_percent = (relativeY / bgHeight) * 100;

    // console.log(`Px(x:${pixelX}, y:${pixelY}) -> %(x:${x_percent.toFixed(2)}, y:${y_percent.toFixed(2)})`);

    return { x_percent, y_percent };
}

/**
 * Convertit les coordonnées pourcentage (%) en pixels (Fabric).
 * @param {number} percentX - Pourcentage X
 * @param {number} percentY - Pourcentage Y
 * @param {fabric.Canvas} canvas - Instance du canvas Fabric
 * @returns {object} { left, top } (coordonnées en pixels)
 */
function convertPercentToPixels(percentX, percentY, canvas) {
    if (!canvas.backgroundObject) {
        console.warn("convertPercentToPixels: Arrière-plan non trouvé.");
        return { left: 0, top: 0 };
    }

    const bg = canvas.backgroundObject;
    const bgWidth = bg.width * bg.scaleX;
    const bgHeight = bg.height * bg.scaleY;
    const bgLeft = bg.left;
    const bgTop = bg.top;

    // Calculer la position relative en pixels
    const relativeX = (percentX / 100) * bgWidth;
    const relativeY = (percentY / 100) * bgHeight;

    // Convertir en position absolue sur le canvas
    const left = bgLeft + relativeX;
    const top = bgTop + relativeY;

    return { left, top };
}
