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

    // Écouteur pour le placement d'asset (clic) - Utilise :before
    canvas.on('mouse:down:before', handlePlaceAssetClick);

    // Le drop d'asset est géré dans plan-editor.js

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

        // --- CORRECTION DU DÉCALAGE ---
        // Réinitialiser la position de l'objet DANS LE JSON,
        // pour que son point d'origine (0,0) soit relatif à l'objet lui-même.
        // L'objet sur le canvas (activeObject) n'est PAS modifié.
        fabricObjectData.left = 0;
        fabricObjectData.top = 0;
        // S'assurer que l'origine est définie au centre pour le placement futur
        fabricObjectData.originX = 'center';
        fabricObjectData.originY = 'center';
        // --- FIN CORRECTION ---

        const jsonDataString = JSON.stringify(fabricObjectData);

        // 2. Générer une miniature (optionnel mais recommandé)
        let thumbnailDataUrl = null;
        try {
            // Pour la miniature, nous devons temporairement appliquer la réinitialisation
            // à l'objet cloné ou à l'original (ici on utilise l'original)
            // Sauvegarder l'état
            const originalPos = {
                left: activeObject.left,
                top: activeObject.top,
                originX: activeObject.originX,
                originY: activeObject.originY
            };
            
            // Appliquer la normalisation pour la capture de la miniature
            activeObject.set({
                left: 0,
                top: 0,
                originX: 'center',
                originY: 'center'
            });
            // Forcer le recalcul de la position AVANT de générer le DataURL
            activeObject.setCoords(); 
            
            thumbnailDataUrl = activeObject.toDataURL({
                format: 'png',
                quality: 0.7,
            });

            // Restaurer l'objet original
            activeObject.set(originalPos);
            activeObject.setCoords();
            canvasInstance.requestRenderAll(); // Rafraîchir le canvas

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
                jsonData: jsonDataString, // Envoie le JSON normalisé (left: 0, top: 0)
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
            // (peut nécessiter d'appeler une fonction exportée de sidebar.js ou un événement)
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
 * Gère le placement d'un asset par clic sur le canvas (via mouse:down:before).
 */
async function handlePlaceAssetClick(options) {
    console.log("[handlePlaceAssetClick] Événement mouse:down:before détecté."); // LOG AJOUTÉ

    const assetPlacementData = getCurrentAssetPlacementData();

    // LOG AJOUTÉ POUR LA CONDITION
    if (!assetPlacementData || options.target || options.e.altKey || !canvasInstance) {
        console.log("[handlePlaceAssetClick] Condition d'arrêt remplie:", {
            hasAssetData: !!assetPlacementData,
            hasTarget: !!options.target,
            isAltKey: options.e.altKey, // Correction: accès direct à l'événement
            hasCanvas: !!canvasInstance
        });
        // Si on clique sur un objet existant pendant le placement d'asset, annuler
        if (assetPlacementData && options.target) {
            cancelAssetPlacementMode(canvasInstance);
        }
        return; // Important de retourner ici
    }
    // FIN LOG CONDITION

    console.log("[handlePlaceAssetClick] Préparation de l'appel à placeAssetById..."); // LOG AJOUTÉ

    const assetId = assetPlacementData.id;
    const pointer = canvasInstance.getPointer(options.e);

    // Annuler le mode placement immédiatement
    cancelAssetPlacementMode(canvasInstance);

    // Appeler la fonction exportée pour réellement placer l'asset
    await placeAssetById(assetId, pointer.x, pointer.y, canvasInstance);
}


/**
 * Place un asset par ID à une position donnée (appelée par clic ou drop).
 * Gère différents types d'assets (Fabric JSON, SVG, Image).
 * AVEC LOGS DE DÉBOGAGE AJOUTÉS.
 * @param {number} assetId - L'ID de l'asset à placer.
 * @param {number} x - Coordonnée X (canvas).
 * @param {number} y - Coordonnée Y (canvas).
 * @param {fabric.Canvas} canvas - L'instance du canvas.
 */
export async function placeAssetById(assetId, x, y, canvas) {
    console.log(`[placeAssetById] Début - ID: ${assetId}, Coords: (${x?.toFixed(0)}, ${y?.toFixed(0)})`);

    if (!canvas || !assetId) {
        console.error("[placeAssetById] Erreur: Instance Canvas ou assetId manquant.");
        showToast("Erreur interne: Impossible de placer l'asset.", "danger");
        return;
    }

    try {
        // 1. Récupérer les données complètes de l'asset via API
        const apiUrl = `${window.planData?.getAssetUrl || 'index.php?action=apiGetAsset'}&id=${assetId}`;
        console.log(`[placeAssetById] Appel API: ${apiUrl}`);
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status} lors de la récupération de l'asset.`);

        const result = await response.json();
        console.log("[placeAssetById] Réponse API reçue:", result);

        if (!result.success || !result.asset) {
            throw new Error(result.error || "Données de l'asset non trouvées ou invalides dans la réponse API.");
        }

        const asset = result.asset;
        const assetBaseUrl = window.planData?.assetBaseUrl || 'uploads/assets/';
        console.log("[placeAssetById] Données Asset:", asset);

        // 2. Charger l'objet/groupe Fabric en fonction du type
        let fabricAsset = null;
        let loadPromise;

        console.log(`[placeAssetById] Chargement type '${asset.type}'...`);

        if ((asset.type === 'fabric' || asset.type === 'group') && asset.data) {
            let assetObjectData;
            try {
                assetObjectData = JSON.parse(asset.data);
            } catch (parseError) {
                console.error("[placeAssetById] JSON Asset Data (Fabric/Group) invalide:", asset.data, parseError);
                throw new Error("Format de données Fabric/Group invalide.");
            }
            loadPromise = new Promise((resolve, reject) => {
                fabric.util.enlivenObjects([assetObjectData], (objects) => {
                    if (!objects || objects.length === 0) {
                        console.error("[placeAssetById] enlivenObjects n'a retourné aucun objet.");
                        return reject(new Error("Erreur lors du chargement de l'objet asset (enlivenObjects)."));
                    }
                    console.log("[placeAssetById] enlivenObjects réussi.");
                    resolve(objects[0]);
                }, ''); // Namespace vide
            }).catch(err => {
                 console.error("[placeAssetById] Erreur dans enlivenObjects:", err);
                 throw err;
            });

        } else if (asset.type === 'svg' && asset.nom_fichier) {
            const svgUrl = assetBaseUrl + asset.nom_fichier;
            console.log(`[placeAssetById] Chargement SVG depuis: ${svgUrl}`);
            loadPromise = new Promise((resolve, reject) => {
                fabric.loadSVGFromURL(svgUrl, (objects, options) => {
                    if (!objects) {
                         console.error(`[placeAssetById] Échec loadSVGFromURL pour: ${svgUrl}`);
                         return reject(new Error(`Impossible de charger le SVG depuis ${svgUrl}`));
                    }
                    console.log("[placeAssetById] loadSVGFromURL réussi, groupement...");
                    const group = fabric.util.groupSVGElements(objects, options);
                    if (!group) {
                         console.error("[placeAssetById] groupSVGElements a retourné null/undefined.");
                         return reject(new Error("Erreur lors du groupement des éléments SVG."));
                    }
                    console.log("[placeAssetById] Groupement SVG réussi.");
                    resolve(group);
                });
            }).catch(err => {
                 console.error(`[placeAssetById] Erreur lors du chargement/groupement SVG depuis ${svgUrl}:`, err);
                 throw err;
            });

        } else if (asset.type === 'image' && asset.nom_fichier) {
            const imageUrl = assetBaseUrl + asset.nom_fichier;
            console.log(`[placeAssetById] Chargement Image depuis: ${imageUrl}`);
            loadPromise = new Promise((resolve, reject) => {
                fabric.Image.fromURL(imageUrl, (img) => {
                    if (!img || !img.width) {
                        console.error(`[placeAssetById] Échec Image.fromURL pour: ${imageUrl}. L'objet img est invalide ou n'a pas de largeur.`);
                        return reject(new Error(`Impossible de charger ou image invalide depuis ${imageUrl}`));
                    }
                     console.log("[placeAssetById] Image.fromURL réussi.");
                    resolve(img);
                }, { crossOrigin: 'anonymous' });
            }).catch(err => {
                 console.error(`[placeAssetById] Erreur lors du chargement Image depuis ${imageUrl}:`, err);
                 throw err;
            });

        } else {
            console.error(`[placeAssetById] Type d'asset '${asset.type}' inconnu ou fichier manquant ('${asset.nom_fichier}').`);
            throw new Error(`Type d'asset inconnu ou fichier manquant: ${asset.type}`);
        }

        fabricAsset = await loadPromise;

        if (fabricAsset) {
            console.log("[placeAssetById] Objet Fabric créé/chargé:", fabricAsset.toObject(['customData']));

            if (!fabricAsset.width || !fabricAsset.height) {
                 console.warn("[placeAssetById] Attention: L'objet Fabric chargé a une largeur ou hauteur nulle/invalide.", {width: fabricAsset.width, height: fabricAsset.height});
            }

            fabricAsset.set({
                left: x,
                top: y,
                originX: 'center',
                originY: 'center',
                evented: true,
                selectable: true
            });

            fabricAsset.customData = { type: 'asset', sourceAssetId: assetId };

            if (fabricAsset.type === 'group' && fabricAsset._objects) {
                console.log("[placeAssetById] Configuration des objets internes du groupe...");
                fabricAsset._objects.forEach(obj => {
                    obj.set({ evented: true, selectable: true });
                });
                 const maxDim = 200;
                 if (fabricAsset.width > maxDim || fabricAsset.height > maxDim) {
                     console.log("[placeAssetById] Redimensionnement initial du groupe SVG/Fabric...");
                     fabricAsset.scaleToWidth(maxDim, false);
                     if (fabricAsset.getScaledHeight() > maxDim) {
                          fabricAsset.scaleToHeight(maxDim, false);
                     }
                 }
                 fabricAsset.setCoords();
            } else {
                 fabricAsset.setCoords();
            }

            console.log("[placeAssetById] Ajout de l'asset au canvas...", fabricAsset);
            canvas.add(fabricAsset);
            canvas.setActiveObject(fabricAsset);
            canvas.requestRenderAll();

            const objectsOnCanvas = canvas.getObjects();
            if (objectsOnCanvas.includes(fabricAsset)) {
                 console.log("[placeAssetById] Vérification: Asset ajouté avec succès à la collection du canvas.");
            } else {
                 console.error("[placeAssetById] Erreur: L'asset n'a pas été ajouté à la collection du canvas !");
            }

            showToast(`Asset "${asset.name}" placé.`, "success");
        } else {
             console.error("[placeAssetById] Erreur: fabricAsset est null après la promesse de chargement.");
             throw new Error("Impossible de créer l'objet Fabric pour l'asset.");
        }

    } catch (error) {
        console.error("[placeAssetById] Erreur CATCH finale lors du placement:", error);
        showToast(`Erreur placement asset : ${error.message}`, 'danger');
    } finally {
        // Cacher l'indicateur de chargement si utilisé
        // hideLoadingIndicator();
    }
}


/**
 * Met à jour l'état activé/désactivé du bouton "Créer Asset".
 */
function updateCreateAssetButtonState() {
    const createAssetBtn = document.getElementById('create-asset-btn');
    if (createAssetBtn && canvasInstance) {
        createAssetBtn.disabled = !(canvasInstance.getActiveObject());
    }
}

/**
 * Fonction de désactivation (si nécessaire)
 * @param {fabric.Canvas} canvas
 */
export function deactivateClipboard(canvas) { // Renommé pour correspondre à sa fonction
    canvas.off('mouse:down:before', handlePlaceAssetClick);
    console.log("AssetManager: Écouteur de placement par clic désactivé.");
}
