/**
 * Fonctions pour interagir avec l'API backend (actions PHP).
 */

/**
 * Effectue une requête fetch vers le backend.
 * @param {string} action - L'action du contrôleur PHP (ex: 'savePosition').
 * @param {object} data - Les données à envoyer dans le corps de la requête (sera JSONifié).
 * @param {string} method - La méthode HTTP ('POST' par défaut).
 * @returns {Promise<object>} La réponse JSON parsée du serveur.
 * @throws {Error} Lance une erreur en cas de problème réseau ou de réponse non-OK.
 */
async function apiRequest(action, data = {}, method = 'POST') {
    console.log(`apiRequest: action=${action}, method=${method}, data=`, data);
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                // Ajoutez ici un header CSRF si nécessaire, ex: 'X-CSRF-TOKEN': window.planData.csrfToken
            },
        };
        // N'ajoute le corps que pour les méthodes qui le permettent
        if (method !== 'GET' && method !== 'HEAD') {
            options.body = JSON.stringify(data);
        }

        // Construit l'URL avec les paramètres GET si besoin
        let url = `index.php?action=${action}`;
        if (method === 'GET' && Object.keys(data).length > 0) {
            // Pour les requêtes GET, les 'data' sont ajoutés comme paramètres d'URL
            // Note: `action` peut déjà contenir des paramètres GET (ex: getAsset&id=X)
            const params = new URLSearchParams(data);
            url += (url.includes('?') ? '&' : '?') + params.toString();
        }

        const response = await fetch(url, options);

        console.log(`apiRequest ${action} - Status: ${response.status}`);
        const responseText = await response.text(); // Lire en texte d'abord pour le debug
        console.log(`apiRequest ${action} - Response Text (début):`, responseText.substring(0, 150) + "...");

        if (!response.ok) {
            let errorMsg = `HTTP Error ${response.status}`;
            try {
                const errorJson = JSON.parse(responseText);
                errorMsg += `: ${errorJson.message || errorJson.error || 'Erreur inconnue'}`;
            } catch (e) {
                // Si la réponse n'est pas du JSON valide, utiliser le texte brut
                if(responseText.length < 200) errorMsg += `: ${responseText}`; // Limite la taille si texte brut
            }
             console.error(`apiRequest ${action} - Failed:`, errorMsg);
            throw new Error(errorMsg);
        }

        try {
            const result = JSON.parse(responseText);
             console.log(`apiRequest ${action} - Success, Result:`, result);
            return result;
        } catch (e) {
             console.error(`apiRequest ${action} - Failed to parse JSON response:`, responseText);
            throw new Error('Réponse serveur invalide (JSON mal formé).');
        }

    } catch (error) {
        console.error(`apiRequest ${action} - Network or processing error:`, error);
        // Remonte l'erreur pour que l'appelant puisse la gérer (ex: afficher un message)
        throw error;
    }
}

// --- Fonctions spécifiques pour chaque action ---

export async function savePosition(positionData) {
    const result = await apiRequest('savePosition', positionData);
    if (result.status === 'success' && result.position_data) {
        return result.position_data; // Retourne l'objet position complet
    } else {
        throw new Error(result.message || 'Erreur lors de la sauvegarde de la position.');
    }
}

export async function removePosition(positionId) {
    const result = await apiRequest('removePosition', { id: parseInt(positionId, 10) });
    return result.status === 'success';
}

export async function removeMultiplePositions(geoCodeId, planId) {
    const result = await apiRequest('removeMultiplePositions', {
        geo_code_id: parseInt(geoCodeId, 10),
        plan_id: parseInt(planId, 10)
    });
    return result.status === 'success';
}

export async function fetchAvailableCodes(planId) {
    // Utilise GET avec ID dans l'action string
    return await apiRequest(`getAvailableCodesForPlan&id=${planId}`, {}, 'GET');
}

export async function saveNewGeoCode(codeData) {
    const result = await apiRequest('addGeoCodeFromPlan', codeData);
    // L'API est censée retourner directement le nouvel objet code géo si succès
    if (result && result.id) {
        return result;
    } else {
        throw new Error(result.error || 'Erreur lors de la création du code géo.');
    }
}

export async function saveDrawingData(planId, drawingData) {
    const result = await apiRequest('saveDrawing', {
        plan_id: planId,
        drawing_data: drawingData // Peut être null si vide
    });
    // L'API saveDrawing renvoie juste status: success/error
    if (result.status === 'success') {
        return true;
    } else {
        throw new Error(result.message || 'Erreur lors de la sauvegarde des annotations.');
    }
}

export async function createSvgPlan(planName, svgContent) {
    const result = await apiRequest('createSvgPlan', { nom: planName, svgContent: svgContent });
    if (result.status === 'success' && result.new_plan_id) {
        return result.new_plan_id;
    } else {
        throw new Error(result.message || 'Erreur lors de la création du plan SVG.');
    }
}

export async function updateSvgPlan(planId, svgContent) {
    const result = await apiRequest('updateSvgPlan', { plan_id: planId, svgContent: svgContent });
    // L'API updateSvgPlan renvoie juste status: success/error
    if (result.status === 'success') {
        return true;
    } else {
        throw new Error(result.message || 'Erreur lors de la mise à jour du plan SVG.');
    }
}


// --- Fonctions spécifiques pour les Assets ---

export async function saveAsset(assetName, assetData) {
    const result = await apiRequest('saveAsset', { name: assetName, data: assetData });
    if (result.status === 'success' && result.asset_id) {
        return result.asset_id;
    } else {
        throw new Error(result.message || 'Erreur lors de la sauvegarde de l\'asset.');
    }
}

export async function listAssets() {
    // Utilise GET, pas de corps
    return await apiRequest('listAssets', {}, 'GET');
}

export async function getAssetData(assetId) {
    // Utilise GET avec ID dans l'action string
    const result = await apiRequest(`getAsset&id=${assetId}`, {}, 'GET');
    // L'API renvoie {id: ..., name: ..., data: '{...}'}
    if (result && result.data) {
        try {
            // Tente de parser la chaîne JSON contenue dans 'data'
            const parsedData = JSON.parse(result.data);
            return { id: result.id, name: result.name, data: parsedData }; // Renvoie l'objet JS
        } catch(e) {
            console.error("Erreur parsing JSON de l'asset:", e);
            throw new Error("Données de l'asset reçues corrompues.");
        }
    } else {
        throw new Error(result.error || 'Asset non trouvé ou données manquantes.');
    }
}

// Optionnel: Ajouter une fonction deleteAsset(assetId)
// export async function deleteAsset(assetId) {
//     const result = await apiRequest('deleteAsset', { id: parseInt(assetId, 10) });
//     return result.status === 'success';
// }
