// Fichier: public/js/modules/planLoader.js
/**
 * Module pour charger le fond du plan (image/SVG) et les objets Fabric.js sauvegardés.
 * Met à l'échelle le fond pour correspondre au format de page (guide).
 */
import { PAGE_FORMATS } from './config.js';
// Importer getActiveGuide pour obtenir les dimensions cibles si le canvas a déjà été redimensionné
import { getActiveGuide } from './guideManager.js';

/**
 * Charge le fond du plan (image ou SVG) et les objets Fabric.js sur le canvas.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 * @param {object} planData - Les données du plan (provenant de window.planData.currentPlan).
 */
export async function loadPlanBackgroundAndObjects(canvas, planData) {
    if (!canvas || !planData) {
        console.error("PlanLoader: Canvas ou données du plan manquants.");
        return;
    }

    // Effacer le canvas précédent (au cas où)
    canvas.clear();
    canvas.setBackgroundImage(null);
    canvas.setBackgroundColor(window.canvasBackgroundColor || '#ffffff'); // Utiliser la couleur de fond définie

    const planUrl = `uploads/plans/${planData.nom_fichier}`;
    const formatKey = planData.page_format || 'Custom'; // Format défini lors de la création/modif
    const isDrawingPlan = planData.type === 'drawing';

    try {
        // --- 1. Charger le fond du plan (si ce n'est pas un plan 'drawing') ---
        console.log(`PlanLoader: Chargement plan type '${planData.type}'. Format cible: '${formatKey}'`);

        let backgroundObject = null; // Pour stocker l'objet créé (Image ou Group)

        if (!isDrawingPlan && planData.nom_fichier) { // Charger fond seulement si importé
            if (planData.type === 'image' || planData.type === 'pdf') {
                backgroundObject = await loadImageBackground(canvas, planUrl, formatKey);
            } else if (planData.type === 'svg') {
                backgroundObject = await loadSVGBackground(canvas, planUrl, formatKey);
            } else {
                console.warn(`PlanLoader: Type de plan '${planData.type}' non géré pour le fond.`);
            }
        } else {
            console.log("PlanLoader: Plan de type 'drawing' ou sans fichier, pas de fond à charger.");
            // Le canvas a déjà été dimensionné par updatePageGuide s'il y a un format
        }

        // Positionner le fond chargé (s'il y en a un)
        if (backgroundObject) {
            positionBackground(canvas, backgroundObject);
        }

        // --- 2. Charger les objets Fabric.js sauvegardés (dessins, codes géo placés via JSON) ---
        if (planData.drawing_data) {
            console.log("PlanLoader: Chargement des objets sauvegardés (drawing_data)...");
            await loadJsonData(canvas, planData.drawing_data);
        } else {
            console.log("PlanLoader: Aucune donnée de dessin (drawing_data) à charger.");
        }

        // Stocker les dimensions originales pour la conversion Pixels <=> Pourcentage
        // Utiliser les dimensions du guide s'il existe, sinon celles du fond, sinon celles du canvas
        const guide = getActiveGuide();
        if (guide) {
             window.originalPlanWidth = guide.width;
             window.originalPlanHeight = guide.height;
        } else if (backgroundObject) {
            window.originalPlanWidth = backgroundObject.width * (backgroundObject.scaleX || 1);
            window.originalPlanHeight = backgroundObject.height * (backgroundObject.scaleY || 1);
        } else {
            window.originalPlanWidth = canvas.getWidth();
            window.originalPlanHeight = canvas.getHeight();
        }
        console.log(`PlanLoader: Dimensions originales pour conversion % définies à ${window.originalPlanWidth}x${window.originalPlanHeight}`);


        canvas.renderAll();
        console.log("PlanLoader: Chargement du plan terminé.");

    } catch (error) {
        console.error("PlanLoader: Erreur lors du chargement du plan:", error);
        canvas.clear();
        throw error;
    }
}

/**
 * Charge une image et la met à l'échelle pour correspondre au formatKey.
 * @param {fabric.Canvas} canvas
 * @param {string} url
 * @param {string} formatKey
 * @returns {Promise<fabric.Image|null>} L'objet image créé ou null.
 */
function loadImageBackground(canvas, url, formatKey) {
    return new Promise((resolve) => {
        fabric.Image.fromURL(url, (img) => {
            if (!img) {
                console.error(`PlanLoader: Impossible de charger l'image depuis ${url}`);
                return resolve(null);
            }
            console.log(`PlanLoader: Image chargée (${img.width}x${img.height}).`);

            const targetFormat = PAGE_FORMATS[formatKey];
            if (formatKey !== 'Custom' && targetFormat) {
                // Mettre à l'échelle pour correspondre au guide
                scaleObjectToDimensions(img, targetFormat.width, targetFormat.height);
                console.log(`PlanLoader: Image mise à l'échelle vers ${targetFormat.width}x${targetFormat.height}px.`);
            }

            // Marquer comme fond pour exclusion future
             img.set({
                 isBackground: true,
                 selectable: false, evented: false, excludeFromExport: true,
                 // Positionnement sera fait par positionBackground
             });
            resolve(img);

        }, { crossOrigin: 'anonymous' });
    });
}

/**
 * Charge un SVG, le groupe, et le met à l'échelle pour correspondre au formatKey.
 * @param {fabric.Canvas} canvas
 * @param {string} url
 * @param {string} formatKey
 * @returns {Promise<fabric.Group|null>} Le groupe SVG créé ou null.
 */
function loadSVGBackground(canvas, url, formatKey) {
    return new Promise((resolve) => {
        fabric.loadSVGFromURL(url, (objects, options) => {
            if (!objects) {
                 console.error(`PlanLoader: Impossible de charger/parser le SVG depuis ${url}`);
                 return resolve(null);
            }
            console.log(`PlanLoader: SVG chargé (${options.width}x${options.height}). ${objects.length} objets.`);

            const group = fabric.util.groupSVGElements(objects, options);
            const targetFormat = PAGE_FORMATS[formatKey];

            if (formatKey !== 'Custom' && targetFormat) {
                // Mettre à l'échelle pour correspondre au guide
                scaleObjectToDimensions(group, targetFormat.width, targetFormat.height);
                console.log(`PlanLoader: Groupe SVG mis à l'échelle vers ${targetFormat.width}x${targetFormat.height}px.`);
            }

             // Marquer comme fond
             group.set({
                 isBackground: true,
                 selectable: false, evented: false, excludeFromExport: true,
                 // Positionnement sera fait par positionBackground
             });
            resolve(group);
        });
    });
}

/**
 * Met à l'échelle un objet Fabric (Image ou Group) pour correspondre aux dimensions cibles.
 * @param {fabric.Object} obj - L'objet à redimensionner.
 * @param {number} targetWidth - Largeur cible en pixels.
 * @param {number} targetHeight - Hauteur cible en pixels.
 */
function scaleObjectToDimensions(obj, targetWidth, targetHeight) {
    const scaleX = targetWidth / obj.width;
    const scaleY = targetHeight / obj.height;
    // Utiliser le scale le plus contraignant pour conserver les proportions (fit)
    // Ou choisir 'cover' si vous préférez remplir la zone et rogner
    const scale = Math.min(scaleX, scaleY); // 'fit'

    obj.scaleX = scale;
    obj.scaleY = scale;
    // Mettre à jour width/height après scaling pour le positionnement
    // obj.width = obj.width * scale;
    // obj.height = obj.height * scale;
}

/**
 * Positionne un objet (Image/Group) comme fond centré sur le guide (ou au centre du canvas).
 * @param {fabric.Canvas} canvas
 * @param {fabric.Object} backgroundObject
 */
function positionBackground(canvas, backgroundObject) {
    const guide = getActiveGuide();
    let targetLeft, targetTop;

    if (guide) {
        // Centrer sur le guide
        targetLeft = guide.left + (guide.width - backgroundObject.getScaledWidth()) / 2;
        targetTop = guide.top + (guide.height - backgroundObject.getScaledHeight()) / 2;
    } else {
        // Centrer sur le canvas si pas de guide
        targetLeft = (canvas.getWidth() - backgroundObject.getScaledWidth()) / 2;
        targetTop = (canvas.getHeight() - backgroundObject.getScaledHeight()) / 2;
    }

    backgroundObject.set({
        left: targetLeft,
        top: targetTop,
        originX: 'left', // Assurer que l'origine est cohérente
        originY: 'top',
        selectable: false,
        evented: false,
        hoverCursor: 'default',
        excludeFromExport: true, // Ne pas inclure dans l'export JSON standard
        isBackground: true // Marqueur pour l'identifier
    });

    // Ajouter l'objet au canvas (pas setBackgroundImage pour le contrôle)
    canvas.add(backgroundObject);
    canvas.sendToBack(backgroundObject); // Mettre en arrière-plan

    console.log(`PlanLoader: Fond positionné à (${targetLeft.toFixed(0)}, ${targetTop.toFixed(0)})`);
}

/**
 * Charge les données JSON (objets Fabric.js) sur le canvas.
 * @param {fabric.Canvas} canvas
 * @param {string} jsonString - Les données JSON sérialisées.
 */
function loadJsonData(canvas, jsonString) {
    return new Promise((resolve, reject) => {
        try {
            canvas.loadFromJSON(jsonString, () => {
                canvas.renderAll();
                console.log("PlanLoader: Objets JSON chargés sur le canvas.");
                resolve();
            }, (o, object) => {
                // Callback pour chaque objet (utile pour réappliquer des propriétés non sérialisées)
            });
        } catch (error) {
            console.error("PlanLoader: Erreur lors du parsing ou chargement JSON:", error);
            reject(error);
        }
    });
}
