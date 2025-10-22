/**
 * Module API
 * Gère toutes les requêtes fetch vers le backend.
 */
import { showToast } from './utils.js';

// Récupérer le token CSRF (supposant qu'il est stocké dans window.planData)
function getCsrfToken() {
    return window.planData?.csrfToken || '';
}

/**
 * Envoie une requête fetch à l'API avec gestion des erreurs et CSRF.
 * @param {string} url - L'URL de l'API.
 * @param {object} options - Les options de fetch (method, headers, body).
 * @returns {Promise<any>} La réponse JSON de l'API.
 * @throws {Error} Si la réponse n'est pas OK ou si le JSON est invalide.
 */
async function apiFetch(url, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrfToken() // Ajout du token CSRF
    };

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };

    // Si le corps est un objet, le stringify
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
    }
    
    try {
        const response = await fetch(url, config);

        if (!response.ok) {
            let errorMsg = `Erreur HTTP: ${response.status} ${response.statusText}`;
            try {
                // Essayer de parser une réponse d'erreur JSON
                const errorData = await response.json();
                errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) {
                // Pas de JSON, utiliser le statusText
            }
            throw new Error(errorMsg);
        }

        // Gérer les réponses sans contenu (ex: 204 No Content)
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
             if (response.status === 204 || response.status === 200) {
                return { success: true, message: "Opération réussie (pas de contenu)." };
             }
        }
        
        // Gérer les réponses JSON
        const data = await response.json();
        
        // L'API peut renvoyer { success: false, error: "..." } même avec un status 200
        if (data.success === false && data.error) {
            throw new Error(data.error);
        }

        return data; // Devrait être { success: true, ... } ou les données directes

    } catch (error) {
        console.error(`Erreur API Fetch sur ${url}:`, error);
        // Ne pas afficher de toast ici, laisser l'appelant gérer
        throw error; // Propager l'erreur
    }
}

// --- API GeoCode ---

/**
 * Récupère les codes géo disponibles pour un plan (ceux non encore placés).
 * Utilisé par la modale de sélection ET la sidebar (liste 'dispo').
 * @param {number} planId - ID du plan.
 * @returns {Promise<Array>} Liste des codes disponibles.
 */
export async function fetchAvailableCodes(planId) {
    const data = await apiFetch(`index.php?action=apiGetAvailableCodes&plan_id=${planId}`);
    return data.codes || []; // S'assurer de renvoyer un tableau
}

/**
 * Sauvegarde un nouveau code géo dans la base de données (pas sur un plan).
 * @param {object} codeData - Données du code (code_geo, libelle, univers_id...).
 * @returns {Promise<object>} Le nouveau code géo créé.
 */
export async function saveNewGeoCode(codeData) {
    const data = await apiFetch('index.php?action=apiCreateGeoCode', {
        method: 'POST',
        body: codeData
    });
    return data.code; // Renvoie le code créé
}

// --- API Plan & Position ---

/**
 * Sauvegarde (crée ou met à jour) la position d'un élément géo sur un plan.
 * @param {object} positionData - Données de position (id, position_id, plan_id, pos_x, pos_y, width, height, anchor_x, anchor_y).
 * @returns {Promise<object>} Les données de position sauvegardées (incluant position_id).
 */
export async function savePosition(positionData) {
    // Nettoyer les données pour autoriser 'null'
     const body = {
        id: positionData.id, // ID du code géo
        plan_id: positionData.plan_id,
        pos_x: positionData.pos_x,
        pos_y: positionData.pos_y,
        // Autoriser 'null' pour width/height (cas des textes)
        width: positionData.width !== undefined ? positionData.width : null,
        height: positionData.height !== undefined ? positionData.height : null,
        anchor_x: positionData.anchor_x !== undefined ? positionData.anchor_x : null,
        anchor_y: positionData.anchor_y !== undefined ? positionData.anchor_y : null,
        // position_id est optionnel (sera 'null' ou 'undefined' à la création)
        position_id: positionData.position_id
    };

    const data = await apiFetch('index.php?action=apiSavePosition', {
        method: 'POST',
        body: body
    });
    return data.position; // Renvoie la position sauvegardée (avec position_id)
}

/**
 * Supprime une position spécifique d'un élément géo.
 * @param {number} positionId - L'ID de la position (geo_positions.id).
 * @returns {Promise<boolean>} True si succès.
 */
export async function removePosition(positionId) {
    const data = await apiFetch('index.php?action=apiRemovePosition', {
        method: 'POST',
        body: { position_id: positionId }
    });
    return data.success === true;
}

/**
 * Supprime TOUTES les positions d'un code géo sur un plan.
 * @param {number} geoCodeId - L'ID du code géo (geo_codes.id).
 * @param {number} planId - L'ID du plan.
 * @returns {Promise<boolean>} True si succès.
 */
export async function removeMultiplePositions(geoCodeId, planId) {
    const data = await apiFetch('index.php?action=apiRemoveAllPositions', {
        method: 'POST',
        body: { id: geoCodeId, plan_id: planId }
    });
    return data.success === true;
}

/**
 * Sauvegarde les données de dessin (annotations JSON) pour un plan 'image'.
 * @param {number} planId - ID du plan.
 * @param {object | null} drawingData - Objet JSON de Fabric.js (ou null pour effacer).
 * @returns {Promise<object>} Réponse de l'API.
 */
export async function saveDrawingData(planId, drawingData) {
    const data = await apiFetch('index.php?action=apiSaveDrawing', {
        method: 'POST',
        body: {
            plan_id: planId,
            drawing_data: drawingData
        }
    });
    return data;
}

/**
 * Crée un nouveau plan de type SVG (mode 'svg_creation').
 * @param {string} planName - Nom du plan.
 * @param {string} svgString - Contenu SVG (incluant dessins).
 * @param {Array<number>} universIds - Tableau d'IDs d'univers.
 * @returns {Promise<object>} Réponse de l'API (incluant plan_id).
 */
export async function createSvgPlan(planName, svgString, universIds) {
    const data = await apiFetch('index.php?action=apiCreateSvgPlan', {
        method: 'POST',
        body: {
            nom: planName,
            svg_content: svgString,
            univers_ids: universIds
        }
    });
    return data; // Devrait renvoyer { success: true, plan_id: ... }
}

/**
 * Met à jour le contenu SVG d'un plan existant (plan 'svg').
 * @param {number} planId - ID du plan.
 * @param {string} svgString - Contenu SVG (formes natives + dessins).
 * @returns {Promise<object>} Réponse de l'API.
 */
export async function updateSvgPlan(planId, svgString) {
     const data = await apiFetch('index.php?action=updateSvgPlan', {
        method: 'POST',
        body: {
            plan_id: planId,
            svg_content: svgString
        }
    });
    return data;
}

// --- API Assets ---

/**
 * Sauvegarde une sélection (objet JSON Fabric) comme Asset.
 * @param {string} assetName - Nom de l'asset.
 * @param {object} assetData - Données JSON de l'objet/groupe.
 * @returns {Promise<object>} L'asset créé.
 */
export async function saveAsset(assetName, assetData) {
    const data = await apiFetch('index.php?action=apiSaveAsset', {
        method: 'POST',
        body: {
            nom: assetName,
            data: assetData // L'objet sera stringifié par apiFetch
        }
    });
    return data.asset;
}

/**
 * Récupère la liste des assets disponibles.
 * @returns {Promise<Array>} Liste des assets (id, nom).
 */
export async function listAssets() {
    const data = await apiFetch('index.php?action=apiListAssets');
    return data.assets || [];
}

/**
 * Récupère les données JSON complètes d'un asset.
 * @param {number} assetId - ID de l'asset.
 * @returns {Promise<object>} L'asset complet (id, nom, data).
 */
export async function getAssetData(assetId) {
     const data = await apiFetch(`index.php?action=apiGetAsset&id=${assetId}`);
     return data.asset;
}
