// Fichier: public/js/modules/planLoader.js
/**
 * Module pour charger le fond du plan (image/SVG) et les objets Fabric.js sauvegardés.
 */

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
    canvas.setBackgroundImage(null); // Réinitialiser l'image de fond
    canvas.setBackgroundColor('#e9ecef'); // Fond par défaut

    const planUrl = `uploads/plans/${planData.nom_fichier}`; // Chemin vers le fichier du plan

    try {
        // --- 1. Charger le fond du plan ---
        console.log(`PlanLoader: Chargement du fond type '${planData.type}' depuis ${planUrl}`);

        if (planData.type === 'image' || planData.type === 'pdf') { // PDF traité comme image pour le fond
            await loadImageBackground(canvas, planUrl);
        } else if (planData.type === 'svg') {
            await loadSVGBackgroundOrObjects(canvas, planUrl);
        } else {
            console.warn(`PlanLoader: Type de plan '${planData.type}' non géré pour le fond.`);
        }

        // --- 2. Charger les objets Fabric.js sauvegardés (dessins, codes géo placés) ---
        if (planData.drawing_data) {
            console.log("PlanLoader: Chargement des objets sauvegardés (drawing_data)...");
            await loadJsonData(canvas, planData.drawing_data);
        } else {
            console.log("PlanLoader: Aucune donnée de dessin (drawing_data) à charger.");
        }

        // Ajuster le zoom initial pour voir tout le plan (optionnel)
        // zoomToFit(canvas); // Implémentation à ajouter si besoin

        canvas.renderAll();
        console.log("PlanLoader: Chargement du plan terminé.");

    } catch (error) {
        console.error("PlanLoader: Erreur lors du chargement du plan:", error);
        // Afficher une erreur sur le canvas ou via une notification
        canvas.clear(); // Nettoyer en cas d'erreur
        // Pourrait ajouter un texte d'erreur sur le canvas
        throw error; // Propager l'erreur pour que l'initialisation principale l'attrape
    }
}

/**
 * Charge une image comme fond fixe du canvas.
 * @param {fabric.Canvas} canvas
 * @param {string} url
 */
function loadImageBackground(canvas, url) {
    return new Promise((resolve, reject) => {
        fabric.Image.fromURL(url, (img) => {
            if (!img) {
                return reject(new Error(`Impossible de charger l'image depuis ${url}`));
            }

            console.log(`PlanLoader: Image chargée (${img.width}x${img.height}). Positionnement comme fond.`);

            // Adapter la taille du canvas à l'image
            canvas.setWidth(img.width);
            canvas.setHeight(img.height);

            // Mettre l'image en fond, non sélectionnable, non modifiable
            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                originX: 'left',
                originY: 'top',
                // On ne met PAS scaleX/scaleY ici, le canvas prend la taille de l'image
                selectable: false,
                evented: false, // Ne réagit pas aux événements souris
            });

            resolve();
        }, { crossOrigin: 'anonymous' }); // Nécessaire si les images sont sur un autre domaine/port
    });
}

/**
 * Charge un SVG. Tente de le mettre en fond si simple, sinon l'ajoute comme objets.
 * @param {fabric.Canvas} canvas
 * @param {string} url
 */
function loadSVGBackgroundOrObjects(canvas, url) {
    return new Promise((resolve, reject) => {
        fabric.loadSVGFromURL(url, (objects, options) => {
            if (!objects) {
                 return reject(new Error(`Impossible de charger ou parser le SVG depuis ${url}`));
            }

            console.log(`PlanLoader: SVG chargé. ${objects.length} objets trouvés.`);

            // Adapter la taille du canvas aux dimensions du SVG
            const svgWidth = options.width;
            const svgHeight = options.height;
            canvas.setWidth(svgWidth);
            canvas.setHeight(svgHeight);

             // Tenter de grouper et mettre en fond si possible (simplification)
             // Vous pourriez vouloir ajouter les objets directement pour les rendre modifiables
            const group = fabric.util.groupSVGElements(objects, options);

            canvas.setBackgroundImage(group, canvas.renderAll.bind(canvas), {
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
            });

            // Alternative : Ajouter les objets SVG comme éléments modifiables
            /*
            objects.forEach(obj => {
                canvas.add(obj);
            });
            canvas.renderAll();
            */

            resolve();
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
            // Le JSON de Fabric inclut déjà les objets, il suffit de les charger.
            // La méthode loadFromJSON de Fabric est asynchrone par nature à cause du chargement potentiel d'images.
            canvas.loadFromJSON(jsonString, () => {
                canvas.renderAll(); // S'assurer que tout est dessiné
                console.log("PlanLoader: Objets JSON chargés sur le canvas.");
                resolve(); // La promesse est résolue dans le callback de loadFromJSON
            }, (o, object) => {
                // Fonction de rappel pour chaque objet chargé (utile pour déboguer ou modifier à la volée)
                 // console.log("Objet chargé:", o, object);
            });
        } catch (error) {
            console.error("PlanLoader: Erreur lors du parsing ou chargement JSON:", error);
            reject(error); // Rejeter la promesse en cas d'erreur de parsing JSON initial
        }
    });
}


// --- Fonction de Zoom (Optionnelle, à ajouter si besoin) ---
/*
function zoomToFit(canvas) {
    const objects = canvas.getObjects();
    if (objects.length === 0 && !canvas.backgroundImage) {
        return; // Rien à ajuster
    }

    let boundingBox;
    if (canvas.backgroundImage instanceof fabric.Object) {
         // Utiliser les dimensions du fond si présent
         boundingBox = canvas.backgroundImage.getBoundingRect();
    } else if (objects.length > 0) {
        // Calculer le rectangle englobant de tous les objets
        const group = new fabric.Group(objects);
        boundingBox = group.getBoundingRect();
        group.destroy(); // Nettoyer le groupe temporaire
    } else {
        return; // Cas étrange, rien à faire
    }


    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    const zoomX = canvasWidth / boundingBox.width;
    const zoomY = canvasHeight / boundingBox.height;
    const zoom = Math.min(zoomX, zoomY) * 0.95; // 95% pour laisser une petite marge

    canvas.setZoom(zoom);
    canvas.absolutePan({
         x: -boundingBox.left * zoom + (canvasWidth - boundingBox.width * zoom) / 2,
         y: -boundingBox.top * zoom + (canvasHeight - boundingBox.height * zoom) / 2
    });
    canvas.renderAll();
    console.log(`PlanLoader: Zoom initial ajusté à ${zoom.toFixed(2)}`);
}
*/
