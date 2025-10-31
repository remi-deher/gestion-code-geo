// Fichier: public/js/modules/geoCodeRenderer.js
/**
 * Module responsable de la création de la représentation visuelle
 * des codes géo sur le canvas Fabric.js.
 */

import { convertPercentToPixels } from './utils.js'; // Pour charger les codes existants

const GEO_CODE_DEFAULT_WIDTH = 80; // Largeur par défaut en pixels
const GEO_CODE_DEFAULT_HEIGHT = 40; // Hauteur par défaut
export const GEO_CODE_FONT_SIZE = 14; // Taille de police pour le code

/**
 * Crée un objet Fabric.js représentant un code géo.
 * @param {object} codeData - Données du code géo { id, code, libelle, universId, posX?, posY?, width?, height? }.
 * @param {number} x - Position X (left) en pixels sur le canvas.
 * @param {number} y - Position Y (top) en pixels sur le canvas.
 * @param {object} universColors - Map { universId: '#couleur' }.
 * @returns {fabric.Group} L'objet Fabric représentant le code géo.
 */
export function createGeoCodeObject(codeData, x, y, universColors = {}) {
    const universColor = universColors[codeData.universId] || '#6c757d'; // Gris par défaut

    // Dimensions
    const width = codeData.width || GEO_CODE_DEFAULT_WIDTH;
    const height = codeData.height || GEO_CODE_DEFAULT_HEIGHT;

    // Créer le rectangle de fond
    const backgroundRect = new fabric.Rect({
        width: width,
        height: height,
        fill: '#FFFFFF', // Fond blanc
        stroke: universColor, // Bordure de la couleur de l'univers
        strokeWidth: 2,
        rx: 3, // Coins arrondis
        ry: 3,
        shadow: 'rgba(0,0,0,0.2) 2px 2px 3px', // Ombre portée légère
        originX: 'center', // Important pour le positionnement dans le groupe
        originY: 'center'
    });

    // Créer le texte du code géo
    const text = new fabric.Textbox(codeData.code || 'N/A', {
        fontSize: GEO_CODE_FONT_SIZE,
        fill: '#000000',
        fontWeight: 'bold',
        textAlign: 'center',
        width: width - 10, // Laisser un peu de marge
        originX: 'center',
        originY: 'center',
        splitByGrapheme: true // Pour mieux gérer les retours à la ligne si nécessaire
    });

    // Créer un groupe Fabric
    const group = new fabric.Group([backgroundRect, text], {
        left: x,
        top: y,
        originX: 'center', // L'origine du groupe est son centre
        originY: 'center',
        // --- Stocker les métadonnées importantes DANS l'objet Fabric ---
        // Préfixe 'custom' ou un objet dédié pour éviter les conflits
        customData: {
            type: 'geoCode', // Pour identifier facilement ces objets
            geoCodeId: parseInt(codeData.id, 10),
            code: codeData.code,
            libelle: codeData.libelle,
            universId: codeData.universId,
            // positionId: codeData.positionId || null // Si on a l'ID de la position BDD
        },
        // Rendre les contrôles de redimensionnement proportionnels et limiter la rotation
        lockUniScaling: true, // Redimensionnement proportionnel par défaut
        // hasRotatingPoint: false, // Cacher le point de rotation
        snapAngle: 45, // Angle d'accroche pour la rotation
        padding: 5 // Marge interne pour la sélection
    });

    // Écouteur pour la modification (déplacement, redimensionnement)
    group.on('modified', (e) => {
         console.log('GeoCode Object Modified:', e.target.customData.code);
         // Ici, on pourrait déclencher un événement personnalisé pour indiquer qu'une sauvegarde est nécessaire
         // e.target.canvas.fire('custom:objectmodified', { target: e.target });
         // Ou appeler directement la fonction de sauvegarde de position (moins idéal pour la séparation des préoccupations)
    });

    return group;
}


/**
 * Charge et affiche les codes géo déjà placés (venant de la BDD) sur le canvas.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 * @param {Array} placedCodes - Tableau des objets position (avec id, geo_code_id, pos_x, pos_y, etc.).
 * @param {object} universColors - Map { universId: '#couleur' }.
 */
export function renderPlacedGeoCodes(canvas, placedCodes, universColors) {
    if (!placedCodes || placedCodes.length === 0) {
        console.log("GeoCodeRenderer: Aucun code géo placé à rendre.");
        return;
    }

     // Importer dynamiquement les fonctions utilitaires si ce n'est pas déjà fait globalement
     import('./utils.js').then(({ convertPercentToPixels }) => {
        placedCodes.forEach(positionData => {
            // Récupérer les détails du code géo correspondant (on suppose qu'ils sont inclus dans positionData)
            // Sinon, il faudrait les chercher dans window.planData.availableGeoCodes ou faire un appel API
            const codeData = {
                id: positionData.geo_code_id,
                code: positionData.code_geo, // Supposons que ces champs existent après jointure SQL
                libelle: positionData.libelle,
                universId: positionData.univers_id,
                // positionId: positionData.position_id // L'ID de la ligne geo_positions
                // Ajouter width, height si stockés
            };

             // Convertir les % en pixels
            const { left, top } = convertPercentToPixels(positionData.pos_x, positionData.pos_y, canvas);

            if (!isNaN(left) && !isNaN(top)) {
                const geoCodeObject = createGeoCodeObject(codeData, left, top, universColors);
                // Stocker l'ID de la position BDD si disponible
                if (positionData.position_id) {
                     geoCodeObject.customData.positionId = positionData.position_id;
                }
                canvas.add(geoCodeObject);
            } else {
                 console.warn(`GeoCodeRenderer: Coordonnées invalides pour le code ${codeData.code} (pos_x=${positionData.pos_x}, pos_y=${positionData.pos_y})`);
            }
        });
        canvas.requestRenderAll(); // Redessiner après avoir ajouté tous les codes
        console.log(`GeoCodeRenderer: ${placedCodes.length} codes géo placés ont été rendus.`);

     }).catch(error => {
         console.error("GeoCodeRenderer: Erreur lors de l'import de utils.js pour le rendu:", error);
     });
}
