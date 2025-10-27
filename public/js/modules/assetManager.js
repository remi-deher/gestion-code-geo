// Fichier: public/js/modules/assetManager.js
/**
 * Gère la création d'assets depuis la sélection et le placement d'assets sur le canvas.
 */
import { showToast } from './utils.js'; // Pour les notifications
import { getCurrentAssetPlacementData, cancelAssetPlacementMode } from '../ui/sidebar.js';

let canvasInstance = null;

/**
 * Initialise le bouton "Créer Asset" et les écouteurs de placement.
 * @param {HTMLElement} toolbarElement - La barre d'outils.
 * @param {fabric.Canvas} canvas - L'instance du canvas.
 */
export function setupAssetCreation(toolbarElement, canvas) {
    canvasInstance = canvas;

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'd-inline-flex align-items-center gap-1 border-start ps-2 ms-1';

    const createAssetBtn = document.createElement('button');
    createAssetBtn.id = 'create-asset-btn';
    createAssetBtn.className = 'btn btn-outline-success btn-sm';
    createAssetBtn.title = 'Créer un asset à partir de la sélection';
    createAssetBtn.innerHTML = '<i class="bi bi-plus-square-dotted"></i> Créer Asset';
    createAssetBtn.disabled = true; // Désactivé par défaut
    createAssetBtn.addEventListener('click', createAssetFromSelection);
    controlsContainer.appendChild(createAssetBtn);

    toolbarElement.appendChild(controlsContainer);

    // Mettre à jour l'état du bouton selon la sélection
    canvas.on('selection:created', updateCreateAssetButtonState);
    canvas.on('selection:updated', updateCreateAssetButtonState);
    canvas.on('selection:cleared', updateCreateAssetButtonState);

    // Écouteur pour le placement d'asset (clic)
    canvas.on('mouse:down', handlePlaceAssetClick);

    // TODO: Gérer le drop d'asset (similaire à geoCode, déjà géré dans plan-editor.js pour le drop)

    console.log("AssetManager: Initialisé.");
}

/**
 * Fonction appelée au clic sur "Créer Asset".
 */
async function createAssetFromSelection() {
    if (!canvasInstance) return;
    const activeObject = canvasInstance.getActiveObject();
    if (!activeObject) {
        showToast("Veuillez sélectionner un ou plusieurs objets.", "warning");
        return;
    }

    const assetName = prompt("Entrez un nom pour ce nouvel asset :");
    if (!assetName || assetName.trim() === '') {
        showToast("Création d'asset annulée.", "info");
        return;
    }

    const createAssetBtn = document.getElementById('create-asset-btn');
    const originalHtml = createAssetBtn?.innerHTML;
    if(createAssetBtn) {
        createAssetBtn.disabled = true;
        createAssetBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Création...`;
    }

    try {
        // 1. Exporter la sélection en JSON Fabric.js
        const fabricObjectData = activeObject.toObject(['customData']);
        const jsonDataString = JSON.stringify(fabricObjectData);

        // 2. Générer une miniature (optionnel mais recommandé)
        let thumbnailDataUrl = null;
        try {
            thumbnailDataUrl = activeObject.toDataURL({
                format: 'png',
                quality: 0.7,
            });
        } catch (thumbError) {
            console.warn("Impossible de générer la miniature pour l'asset:", thumbError);
        }

        // 3. Envoyer à l'API backend
        const apiUrl = 'index.php?action=apiCreateAsset';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                name: assetName.trim(),
                jsonData: jsonDataString,
                thumbnailDataUrl: thumbnailDataUrl
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `Erreur HTTP ${response.status}` }));
            throw new Error(errorData.error || `Erreur serveur ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
            showToast(`Asset "${assetName}" créé avec succès !`, 'success');
            // TODO: Rafraîchir la liste des assets dans la sidebar
            // Peut nécessiter une fonction exportée par sidebar.js ou un event custom
        } else {
            throw new Error(result.error || "Erreur inconnue lors de la création de l'asset.");
        }

    } catch (error) {
        console.error("Erreur lors de la création de l'asset:", error);
        showToast(`Erreur création asset : ${error.message}`, 'danger');
    } finally {
         if(createAssetBtn) {
             createAssetBtn.disabled = false;
             createAssetBtn.innerHTML = originalHtml;
             updateCreateAssetButtonState(); // Réévaluer l'état du bouton
         }
    }
}

/**
 * Gère le placement d'un asset par clic sur le canvas.
 */
async function handlePlaceAssetClick(options) {
    const assetPlacementData = getCurrentAssetPlacementData();
    if (!assetPlacementData || options.target || options.e.altKey || !canvasInstance) {
        if (assetPlacementData && options.target) {
            cancelAssetPlacementMode(canvasInstance);
        }
        return;
    }

    const assetId = assetPlacementData.id;
    const pointer = canvasInstance.getPointer(options.e);

    // Annuler le mode placement immédiatement
    cancelAssetPlacementMode(canvasInstance);

    // Appeler la fonction exportée pour réellement placer l'asset
    await placeAssetById(assetId, pointer.x, pointer.y, canvasInstance);
}


/**
 * Place un asset par ID à une position donnée (appelée par clic ou drop).
 * @param {number} assetId - L'ID de l'asset à placer.
 * @param {number} x - Coordonnée X (canvas).
 * @param {number} y - Coordonnée Y (canvas).
 * @param {fabric.Canvas} canvas - L'instance du canvas (ajouté pour clarté).
 */
export async function placeAssetById(assetId, x, y, canvas) { // AJOUT de export et du param canvas
     if (!canvas || !assetId) { // Utiliser le paramètre canvas
        console.error("placeAssetById: Canvas instance or assetId missing.");
        return;
     }
     console.log(`Placement Asset ID ${assetId} demandé à ${x.toFixed(0)}, ${y.toFixed(0)}`);

    try {
        // 1. Récupérer les données complètes de l'asset via API
        const apiUrl = `${window.planData?.getAssetUrl || 'index.php?action=apiGetAsset'}&id=${assetId}`;
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        const result = await response.json();
        if (!result.success || !result.asset || !result.asset.data) throw new Error(result.error || "Données de l'asset non trouvées.");

        const assetDataString = result.asset.data;
        // Tenter de parser ici pour vérifier, mais Fabric s'attend à une string
        let assetObjectData;
        try {
            assetObjectData = JSON.parse(assetDataString);
        } catch(parseError) {
             console.error("JSON Asset Data invalide:", assetDataString);
             throw new Error("Format de données de l'asset invalide.");
        }

        // 2. Charger l'objet/groupe Fabric depuis les données JSON
        // Utiliser une Promesse pour gérer l'asynchronisme de enlivenObjects
        await new Promise((resolve, reject) => {
            fabric.util.enlivenObjects([assetObjectData], (objects) => {
                if (!objects || objects.length === 0) {
                    return reject(new Error("Erreur lors du chargement de l'objet asset."));
                }
                const fabricAsset = objects[0];

                // 3. Positionner et ajouter au canvas
                fabricAsset.set({
                    left: x,
                    top: y,
                    originX: 'center', // Centrer sur le point de clic/drop
                    originY: 'center',
                    evented: true,    // Assurer l'interactivité
                    selectable: true
                });

                // Ajouter customData pour identifier l'asset et sa source
                fabricAsset.customData = { type: 'asset', sourceAssetId: assetId };

                // Si c'est un groupe, s'assurer que les objets internes sont aussi interactifs
                if (fabricAsset.type === 'group' && fabricAsset._objects) {
                     fabricAsset._objects.forEach(obj => {
                         obj.set({ evented: true, selectable: true });
                     });
                }

                canvas.add(fabricAsset);
                canvas.setActiveObject(fabricAsset); // Sélectionner l'objet ajouté
                canvas.requestRenderAll();

                console.log("AssetManager: Asset placé:", fabricAsset);
                showToast(`Asset "${result.asset.name}" placé.`, "success");
                resolve(); // Résoudre la promesse

            }, ''); // Namespace vide
        });

    } catch (error) {
        console.error("Erreur lors du placement de l'asset:", error);
        showToast(`Erreur placement asset : ${error.message}`, 'danger');
    }
}


/**
 * Met à jour l'état activé/désactivé du bouton "Créer Asset".
 */
function updateCreateAssetButtonState() {
    const createAssetBtn = document.getElementById('create-asset-btn');
    if (createAssetBtn && canvasInstance) { // Vérifier aussi canvasInstance
        createAssetBtn.disabled = !(canvasInstance.getActiveObject());
    }
}
