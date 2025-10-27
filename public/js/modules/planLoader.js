// Fichier: public/js/modules/planLoader.js
/**
 * Module pour charger le fond du plan (image/SVG) et les objets Fabric.js sauvegardés.
 * Met à l'échelle le fond pour REMPLIR le canvas (qui a la taille A4/A3).
 * Adapte la taille du canvas si le format est 'Custom'.
 */
import { setCanvasSizeFromFormat } from './guideManager.js'; // Import pour le format Custom

// Variable globale pour stocker les dimensions de référence (taille du canvas A4/A3)
window.originalPlanWidth = 0;
window.originalPlanHeight = 0;

/**
 * Charge le fond du plan (image ou SVG) et les objets Fabric.js sur le canvas.
 * Adapte la taille du canvas si le format est 'Custom' et qu'un fond est chargé.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric (déjà dimensionnée A4/A3 si format prédéfini).
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
    canvas.getObjects().filter(o => o.isBackground).forEach(o => canvas.remove(o));
    canvas.setBackgroundColor(window.canvasBackgroundColor || '#ffffff', canvas.renderAll.bind(canvas));

    const planUrl = planData.nom_fichier ? `uploads/plans/${planData.nom_fichier}` : null;
    const formatKey = planData.page_format || 'Custom'; // Format défini lors de la création/modif
    const isDrawingPlan = planData.type === 'drawing';

    try {
        // --- 1. Charger le fond (si plan importé) ---
        console.log(`PlanLoader: Chargement plan type '${planData.type}'. Format initial: '${formatKey}'`);

        let backgroundImg = null; // Image/Groupe Fabric à utiliser comme fond

        if (!isDrawingPlan && planUrl) {
            if (planData.type === 'image' || planData.type === 'pdf') { // PDF traité comme image
                backgroundImg = await loadImageForBackground(canvas, planUrl);
            } else if (planData.type === 'svg') {
                backgroundImg = await loadSVGForBackground(canvas, planUrl);
            }

            // --- Redimensionner le canvas si format 'Custom' basé sur l'image chargée ---
            // Fait AVANT d'appliquer l'image de fond
            if (formatKey === 'Custom' && backgroundImg) {
                console.log("PlanLoader: Format 'Custom', adaptation du canvas à l'image de fond.");
                // Redimensionne le canvas Fabric aux dimensions de l'image/SVG chargé
                if (setCanvasSizeFromFormat('Custom', canvas, backgroundImg)) {
                    // Si la taille a changé, il faut que canvasManager mette à jour le wrapper CSS
                    // On pourrait déclencher un événement ou appeler une méthode de canvasManager ici
                    // Pour l'instant, on suppose que le wrapper s'adapte via CSS (align/justify-center)
                }
            }

            // --- Appliquer et mettre à l'échelle le fond ---
            if (backgroundImg) {
                // S'assurer que les dimensions du canvas sont > 0 avant de scaler
                if (canvas.width > 0 && canvas.height > 0) {
                    canvas.setBackgroundImage(backgroundImg, canvas.renderAll.bind(canvas), {
                        // Mettre à l'échelle pour couvrir/remplir le canvas (A4/A3 ou Custom)
                        scaleX: canvas.width / backgroundImg.width,
                        scaleY: canvas.height / backgroundImg.height,
                        originX: 'left',
                        originY: 'top',
                        // Propriétés pour fond non interactif
                        selectable: false, evented: false, excludeFromExport: true, isBackground: true
                    });
                    console.log("PlanLoader: Fond appliqué et mis à l'échelle pour remplir le canvas.");
                } else {
                    console.error("PlanLoader: Dimensions du canvas invalides, impossible d'appliquer le fond.");
                }
            } else {
                 console.warn(`PlanLoader: Type de plan '${planData.type}' non géré ou chargement échoué.`);
            }
        } else {
            console.log("PlanLoader: Plan 'drawing' ou sans fichier, pas de fond appliqué.");
            // Le canvas a déjà été dimensionné par setCanvasSizeFromFormat dans plan-editor.js
        }


        // --- 2. Charger les objets Fabric.js sauvegardés (dessins, codes géo) ---
        if (planData.drawing_data) {
            console.log("PlanLoader: Chargement des objets sauvegardés (drawing_data)...");
            await loadJsonData(canvas, planData.drawing_data);
        } else {
            console.log("PlanLoader: Aucune donnée de dessin (drawing_data) à charger.");
        }

        // --- 3. Définir les dimensions de référence pour la conversion % ---
        // La référence est maintenant TOUJOURS la taille du canvas
        window.originalPlanWidth = canvas.getWidth();
        window.originalPlanHeight = canvas.getHeight();
        if(window.originalPlanWidth > 0 && window.originalPlanHeight > 0) {
             console.log(`PlanLoader: Dimensions originales pour conversion % définies à ${window.originalPlanWidth.toFixed(0)}x${window.originalPlanHeight.toFixed(0)} (Taille Canvas/Page)`);
        } else {
             console.warn("PlanLoader: Dimensions du canvas invalides après chargement.");
             // Fallback ? Peut indiquer un problème dans setCanvasSizeFromFormat
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
                return reject(new Error(`Impossible de charger l'image depuis ${url}`));
            }
            console.log(`PlanLoader: Image chargée (${img.width}x${img.height}).`);
            resolve(img); // Retourne l'objet image

        }, { crossOrigin: 'anonymous' });
    });
}

/**
 * Charge un SVG et le groupe pour l'utiliser comme fond. NE L'APPLIQUE PAS.
 * @param {fabric.Canvas} canvas
 * @param {string} url
 * @returns {Promise<fabric.Group|null>} Le groupe SVG créé ou null.
 */
function loadSVGForBackground(canvas, url) {
    return new Promise((resolve, reject) => {
        fabric.loadSVGFromURL(url, (objects, options) => {
            if (!objects || !options.width || !options.height) { // Vérifier validité SVG
                 return reject(new Error(`Impossible de charger le SVG depuis ${url}`));
            }
            console.log(`PlanLoader: SVG chargé (${options.width}x${options.height}). ${objects.length} objets.`);
            const group = fabric.util.groupSVGElements(objects, options);
            // Assurer que width/height sont bien sur le groupe pour le scaling
            group.width = options.width;
            group.height = options.height;
            resolve(group); // Retourne l'objet groupe
        });
    });
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
            }, (o, object) => { /* Callback pour chaque objet */ });
        } catch (error) {
            console.error("PlanLoader: Erreur lors du parsing ou chargement JSON:", error);
            reject(error);
        }
    });
}
