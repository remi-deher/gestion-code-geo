// Fichier: public/js/modules/planLoader.js
/**
 * Module pour charger le fond du plan (image/PDF) et les objets Fabric.js sauvegardés,
 * y compris les SVG comme objets éditables.
 * Met à l'échelle le fond (image/PDF) pour REMPLIR le canvas.
 * Adapte la taille du canvas si le format est 'Custom'.
 */
import { setCanvasSizeFromFormat } from './guideManager.js'; // Import pour le format Custom

// Variable globale pour stocker les dimensions de référence (taille du canvas A4/A3/Custom)
window.originalPlanWidth = 0;
window.originalPlanHeight = 0;
// Stocker la référence viewBox du SVG pour la conversion des coordonnées
window.originalSvgViewBox = null;

/**
 * Charge le fond du plan (image ou PDF), les SVG comme objets éditables,
 * et les objets Fabric.js sauvegardés sur le canvas.
 * Adapte la taille du canvas si le format est 'Custom' et qu'un fond/SVG est chargé.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric (déjà dimensionnée si format prédéfini).
 * @param {object} planData - Les données du plan.
 */
export async function loadPlanBackgroundAndObjects(canvas, planData) {
    if (!canvas || !planData) {
        console.error("PlanLoader: Canvas ou données du plan manquants.");
        return;
    }

    // Effacer le canvas (sauf couleur de fond)
    canvas.clear();
    if (canvas.backgroundImage instanceof fabric.Object) canvas.backgroundImage = null;
    canvas.getObjects().filter(o => o.isBackground || o.isPlanContentGroup).forEach(o => canvas.remove(o)); // Supprimer aussi l'ancien groupe SVG
    canvas.setBackgroundColor(window.canvasBackgroundColor || '#ffffff', canvas.renderAll.bind(canvas));

    const planUrl = planData.nom_fichier ? `uploads/plans/${planData.nom_fichier}` : null;
    const formatKey = planData.page_format || 'Custom'; // Format défini lors de la création/modif
    const isDrawingPlan = planData.type === 'drawing';

    // Réinitialiser la viewBox globale
    window.originalSvgViewBox = null;

    try {
        console.log(`PlanLoader: Chargement plan type '${planData.type}'. Format initial: '${formatKey}'`);

        let planContent = null; // Pour le groupe SVG éditable

        // --- 1. Charger le contenu principal (Fond image/PDF OU Objets SVG) ---
        if (!isDrawingPlan && planUrl) {
            if (planData.type === 'image' || planData.type === 'pdf') { // PDF traité comme image
                const backgroundImg = await loadImageForBackground(canvas, planUrl);

                // --- Redimensionner le canvas si format 'Custom' basé sur l'image ---
                if (formatKey === 'Custom' && backgroundImg) {
                    console.log("PlanLoader: Format 'Custom' + Image, adaptation du canvas.");
                    if (setCanvasSizeFromFormat('Custom', canvas, backgroundImg)) {
                        // Taille a changé, canvasManager devrait gérer le wrapper CSS
                    }
                }

                // --- Appliquer et mettre à l'échelle le fond Image/PDF ---
                if (backgroundImg && canvas.width > 0 && canvas.height > 0) {
                    canvas.setBackgroundImage(backgroundImg, canvas.renderAll.bind(canvas), {
                        scaleX: canvas.width / backgroundImg.width,
                        scaleY: canvas.height / backgroundImg.height,
                        originX: 'left',
                        originY: 'top',
                        selectable: false, evented: false, excludeFromExport: true, isBackground: true
                    });
                    console.log("PlanLoader: Fond Image/PDF appliqué et mis à l'échelle.");
                } else {
                    console.error("PlanLoader: Dimensions canvas invalides ou image non chargée.");
                }

            } else if (planData.type === 'svg') {
                // --- Charger le SVG comme objets éditables ---
                planContent = await loadSVGAsObjects(canvas, planUrl); // Appel de la nouvelle fonction

                // --- Redimensionner le canvas si format 'Custom' basé sur le SVG ---
                if (formatKey === 'Custom' && planContent) {
                    console.log("PlanLoader: Format 'Custom' + SVG, adaptation du canvas.");
                    if (setCanvasSizeFromFormat('Custom', canvas, planContent)) {
                        // La taille a changé. Recalculer échelle/position du groupe SVG
                        const scaleFactor = Math.min(canvas.width / planContent.width, canvas.height / planContent.height);
                        planContent.scale(scaleFactor);
                        // S'assurer que le SVG est positionné à 0,0 dans le canvas redimensionné
                        planContent.set({ left: 0, top: 0 });
                        planContent.setCoords(); // Mettre à jour les coordonnées
                        console.log("PlanLoader: Groupe SVG rescalé et repositionné pour nouveau canvas Custom.");
                    }
                } else if (planContent) {
                    // Si format NON Custom (A4/A3), adapter le SVG au canvas existant
                     const scaleFactor = Math.min(canvas.width / planContent.width, canvas.height / planContent.height);
                     planContent.scale(scaleFactor);
                     // Centrer le SVG sur la page A4/A3
                     planContent.center();
                     planContent.setCoords();
                     console.log("PlanLoader: Groupe SVG rescalé et centré pour format prédéfini.");
                }
                // Pas de setBackgroundImage pour le SVG
            }
        } else {
            console.log("PlanLoader: Plan 'drawing' ou sans fichier, pas de contenu principal chargé depuis URL.");
            // Le canvas a déjà été dimensionné par setCanvasSizeFromFormat dans plan-editor.js
        }

        // --- 2. Charger les objets Fabric.js sauvegardés (annotations, codes géo...) ---
        if (planData.drawing_data) {
            console.log("PlanLoader: Chargement des objets sauvegardés (drawing_data)...");
            // Ici on suppose que drawing_data contient UNIQUEMENT les annotations
            // ajoutées par l'utilisateur, PAS le contenu SVG/Image de base.
            await loadJsonData(canvas, planData.drawing_data);
        } else {
            console.log("PlanLoader: Aucune donnée de dessin (drawing_data) à charger.");
        }

        // --- 3. Définir les dimensions de référence pour la conversion % ---
        // La référence est TOUJOURS la taille du canvas/page défini par le format (A4/A3/Custom).
        window.originalPlanWidth = canvas.getWidth();
        window.originalPlanHeight = canvas.getHeight();
        // La viewBox du SVG a été stockée par loadSVGAsObjects si applicable.

        if (window.originalPlanWidth > 0 && window.originalPlanHeight > 0) {
             console.log(`PlanLoader: Dimensions référence pour %: ${window.originalPlanWidth.toFixed(0)}x${window.originalPlanHeight.toFixed(0)} (Taille Canvas/Page)`);
             if (window.originalSvgViewBox) {
                 console.log(`PlanLoader: ViewBox SVG pour coords: x=${window.originalSvgViewBox.x}, y=${window.originalSvgViewBox.y}`);
             }
        } else {
             console.warn("PlanLoader: Dimensions du canvas invalides après chargement.");
             // Fallback minimal
             window.originalPlanWidth = 800; window.originalPlanHeight = 600;
        }

        canvas.renderAll();
        console.log("PlanLoader: Chargement du plan terminé.");

    } catch (error) {
        console.error("PlanLoader: Erreur lors du chargement du plan:", error);
        canvas.clear(); // Nettoyer en cas d'erreur
        throw error; // Propager pour l'afficher à l'utilisateur
    }
}

/**
 * Charge une image pour l'utiliser comme fond. NE L'APPLIQUE PAS.
 * @param {fabric.Canvas} canvas
 * @param {string} url
 * @returns {Promise<fabric.Image|null>} L'objet image créé ou null.
 */
function loadImageForBackground(canvas, url) {
    return new Promise((resolve, reject) => {
        fabric.Image.fromURL(url, (img) => {
            if (!img || !img.width || !img.height) { // Vérifier validité image
                console.error(`PlanLoader: Image non chargée ou invalide depuis ${url}`);
                return reject(new Error(`Impossible de charger l'image depuis ${url}`));
            }
            console.log(`PlanLoader: Image chargée (${img.width}x${img.height}).`);
            resolve(img); // Retourne l'objet image

        }, { crossOrigin: 'anonymous' });
    });
}

/**
 * Charge un SVG et l'ajoute comme groupe éditable au canvas.
 * Met également à jour window.originalSvgViewBox.
 * @param {fabric.Canvas} canvas
 * @param {string} url
 * @returns {Promise<fabric.Group|null>} Le groupe SVG ajouté ou null.
 */
function loadSVGAsObjects(canvas, url) {
    return new Promise((resolve, reject) => {
        fabric.loadSVGFromURL(url, (objects, options) => {
            if (!objects || objects.length === 0) {
                 console.error(`PlanLoader: SVG non chargé ou vide depuis ${url}`);
                 // Stocker une viewBox par défaut même si le chargement échoue ? Ou laisser null ? Laisser null.
                 window.originalSvgViewBox = null;
                 return reject(new Error(`Impossible de charger le SVG ou SVG vide depuis ${url}`));
            }
            console.log(`PlanLoader: SVG chargé (${options.width}x${options.height}). ${objects.length} objets.`);

            // --- Stocker la viewBox pour la conversion des coordonnées ---
            // La viewBox définit le système de coordonnées interne du SVG.
            // Fabric.js utilise généralement les coordonnées left/top par rapport au coin sup gauche (0,0) du canvas,
            // MAIS pour convertir nos % (qui sont relatifs à la viewBox 0-100), il faut l'offset de la viewBox.
            window.originalSvgViewBox = {
                x: options.viewBox?.x ?? 0,
                y: options.viewBox?.y ?? 0,
                width: options.viewBox?.width ?? options.width, // Fallback aux dimensions si pas de viewBox
                height: options.viewBox?.height ?? options.height
            };
            console.log("PlanLoader: ViewBox SVG stockée:", window.originalSvgViewBox);


            // Créer un groupe avec les objets chargés
            const group = new fabric.Group(objects, {
                // Dimensions natives du SVG (avant mise à l'échelle)
                width: options.width,
                height: options.height,
                // Positionner initialement au coin supérieur gauche du canvas
                left: 0,
                top: 0,
                // Rendre le groupe modifiable par défaut
                selectable: true,
                evented: true,
                // Marqueur pour identifier ce groupe comme le contenu principal du plan
                // Utile pour pouvoir le supprimer/remplacer facilement si on recharge
                isPlanContentGroup: true,
                // Optionnel: Empêcher la modification interne des objets du SVG
                // subTargetCheck: true, // Permet de sélectionner des objets dans le groupe
                // lockMovementX: true, lockMovementY: true, // Si on veut juste pouvoir zoomer/panner le SVG entier
            });

            // Mise à l'échelle initiale pour s'adapter au canvas (méthode "contain")
            // Sera potentiellement recalculée si format="Custom" après setCanvasSizeFromFormat
            const scaleFactor = Math.min(canvas.width / group.width, canvas.height / group.height);
            group.scale(scaleFactor);

            // Centrer le groupe sur le canvas (A4/A3)
            // Si c'est Custom, setCanvasSizeFromFormat pourrait redéfinir left/top à 0
            group.center();

            // Ajouter le groupe au canvas
            canvas.add(group);
             // Envoyer le groupe SVG en arrière-plan (derrière les futures annotations)
             // mais devant la couleur de fond du canvas
             canvas.sendToBack(group);

            canvas.requestRenderAll(); // Demander un rendu
            console.log("PlanLoader: SVG ajouté comme groupe éditable.");
            resolve(group); // Retourne le groupe ajouté

        });
    });
}


/**
 * Charge les données JSON (objets Fabric.js annotés) sur le canvas.
 * @param {fabric.Canvas} canvas
 * @param {string} jsonString - Les données JSON sérialisées.
 */
function loadJsonData(canvas, jsonString) {
    return new Promise((resolve, reject) => {
        try {
            // Utiliser la fonction de rappel pour s'assurer que tout est chargé
            canvas.loadFromJSON(jsonString, () => {
                canvas.renderAll(); // Rendu après chargement complet
                console.log("PlanLoader: Objets JSON (annotations) chargés sur le canvas.");
                resolve();
            }, (o, object) => {
                // Fonction de rappel pour chaque objet chargé depuis le JSON
                // Vous pouvez ajouter ici une logique spécifique si nécessaire
                // par exemple, s'assurer que les objets sont bien configurés
                if (object) {
                     object.set({
                         // Assurer la sélection/modification si ce n'est pas déjà le cas
                         // selectable: true, // Normalement déjà dans le JSON
                         // evented: true,
                     });
                     // Si ce sont des codes géo, on pourrait vérifier/mettre à jour leur customData ici
                     // if (object.customData?.type === 'geoCode') { ... }
                }
            });
        } catch (error) {
            console.error("PlanLoader: Erreur lors du parsing ou chargement JSON:", error);
            reject(error);
        }
    });
}
