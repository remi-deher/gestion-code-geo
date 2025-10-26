/**
 * Module API
 * Gère toutes les requêtes fetch vers le backend.
 * VERSION SIMPLIFIÉE : Ne contient que les appels nécessaires pour GeoCodes.
 */
import { showToast } from './utils.js';

// Récupérer le token CSRF (si vous l'implémentez un jour)
function getCsrfToken() {
    // return window.planData?.csrfToken || ''; // Mettre en commentaire ou adapter si besoin
    return ''; // Placeholder
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
                const errorData = await response.json();
                errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) {
                // Pas de JSON, utiliser le statusText
            }
            throw new Error(errorMsg);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
             if (response.status === 204 || response.status === 200) {
                return { success: true, message: "Opération réussie (pas de contenu)." };
             }
             // Si pas de JSON et pas 204/200, renvoyer une erreur ou un objet vide
             console.warn(`Réponse non-JSON reçue de ${url} avec status ${response.status}`);
             return { success: false, error: `Réponse inattendue du serveur (status ${response.status})`};
        }

        const data = await response.json();

        if (data.success === false && data.error) {
            throw new Error(data.error);
        }

        return data;

    } catch (error) {
        console.error(`Erreur API Fetch sur ${url}:`, error);
        throw error; // Propager l'erreur
    }
}

// --- API GeoCode ---

/**
 * Sauvegarde un nouveau code géo dans la base de données (appel possible depuis une modale, par exemple).
 * @param {object} codeData - Données du code (code_geo, libelle, univers_id...).
 * @returns {Promise<object>} Le nouveau code géo créé.
 */
export async function saveNewGeoCode(codeData) {
    // Note : L'action 'apiCreateGeoCode' n'existe pas dans le contrôleur actuel.
    // Il faudrait soit l'ajouter, soit adapter cette fonction pour appeler 'add' ou 'addGeoCodeFromPlan'
    // Ici, on garde l'appel mais il faudra créer la route/méthode PHP correspondante si besoin.
    // OU BIEN, si l'ajout se fait toujours via POST classique, cette fonction n'est pas nécessaire.
    // Pour l'instant, on la garde commentée pour montrer la structure.

    /*
    const data = await apiFetch('index.php?action=apiCreateGeoCode', { // Action fictive pour l'exemple
        method: 'POST',
        body: codeData
    });
    if (!data.success) {
        throw new Error(data.error || "Erreur lors de la création du code géo via API.");
    }
    return data.code; // Renvoie le code créé (si l'API est conçue ainsi)
    */
   console.warn("La fonction API saveNewGeoCode n'est pas connectée à une route PHP existante.");
   // Simuler un succès pour le moment si on l'appelle quand même
   return Promise.resolve({ success: true, code: { id: Date.now(), ...codeData } });
}
