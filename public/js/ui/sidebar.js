// Fichier: public/js/ui/sidebar.js
/**
 * Gère l'interactivité de la sidebar : filtrage des codes géo et assets,
 * sélection pour placement (clic), et potentiellement drag-and-drop.
 */

// Variable pour suivre l'état du placement (quel code est sélectionné)
let currentPlacementData = null;
// Variable pour suivre l'asset sélectionné pour placement
let currentAssetPlacementData = null;

/**
 * Initialise les fonctionnalités de la sidebar.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export async function setupSidebar(canvas) { // Rendre async pour fetch
    const geocodeSearchInput = document.getElementById('geocode-search');
    const availableGeocodesList = document.getElementById('available-geocodes-list');
    const assetSearchInput = document.getElementById('asset-search');

    if (!geocodeSearchInput || !availableGeocodesList) {
        console.warn("[Sidebar] Éléments de recherche ou liste de codes géo manquants.");
    }
    // Les vérifications pour les éléments assets sont maintenant dans reloadAssetList

    // --- 1. Filtrage de la liste Codes Géo ---
    if (geocodeSearchInput && availableGeocodesList) {
        geocodeSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const items = availableGeocodesList.querySelectorAll('.available-geocode-item');
            items.forEach(item => {
                const code = item.dataset.code?.toLowerCase() || '';
                const libelle = item.dataset.libelle?.toLowerCase() || '';
                const isVisible = code.includes(searchTerm) || libelle.includes(searchTerm);
                item.style.display = isVisible ? '' : 'none';
            });
        });
    }

    // --- 2. Sélection Code Géo pour Placement (Clic) ---
    if (availableGeocodesList) {
        availableGeocodesList.addEventListener('click', (e) => {
            const targetItem = e.target.closest('.available-geocode-item');
            if (!targetItem) return;

            // Désélectionner l'ancien item actif (code géo OU asset)
            const availableAssetsList = document.getElementById('available-assets-list');
            const currentlyActiveAsset = availableAssetsList?.querySelector('.placement-active');
            if (currentlyActiveAsset) currentlyActiveAsset.classList.remove('placement-active');

            const currentlyActiveCode = availableGeocodesList.querySelector('.placement-active');
            if (currentlyActiveCode && currentlyActiveCode !== targetItem) {
                currentlyActiveCode.classList.remove('placement-active');
            }

            // Basculer l'état actif de l'item cliqué
            targetItem.classList.toggle('placement-active');

            if (targetItem.classList.contains('placement-active')) {
                // Activer le mode placement code géo
                currentPlacementData = {
                    id: targetItem.dataset.id,
                    code: targetItem.dataset.code,
                    libelle: targetItem.dataset.libelle,
                    universId: targetItem.dataset.universId
                };
                currentAssetPlacementData = null; // Désactiver mode placement asset
                canvas.defaultCursor = 'crosshair';
                canvas.setCursor('crosshair');
                console.log("[Sidebar] Mode placement Code Géo activé pour", currentPlacementData);

            } else {
                cancelPlacementMode(canvas);
            }
        });
    }


    // --- 3. Annuler le placement si on clique sur un objet existant ---
    canvas.on('mouse:down', (options) => {
        if (currentPlacementData && options.target) {
             console.log("[Sidebar] Clic sur objet existant, annulation mode placement Code Géo.");
             cancelPlacementMode(canvas);
        }
        if (currentAssetPlacementData && options.target) {
            console.log("[Sidebar] Clic sur objet existant, annulation mode placement Asset.");
            cancelAssetPlacementMode(canvas);
        }
    });


    // --- 4. Gestion Drag-and-Drop (Initiation - Code Géo) ---
    if (availableGeocodesList) {
        availableGeocodesList.addEventListener('dragstart', (e) => {
            const targetItem = e.target.closest('.available-geocode-item');
            if (targetItem) {
                const dataToSend = JSON.stringify({
                     id: targetItem.dataset.id,
                     code: targetItem.dataset.code,
                     libelle: targetItem.dataset.libelle,
                     universId: targetItem.dataset.universId
                 });
                e.dataTransfer.setData('text/plain', dataToSend);
                e.dataTransfer.effectAllowed = 'copy';
                document.body.classList.add('dragging-geocode');
                console.log("[Sidebar] Drag start Code Géo. Données:", dataToSend);
            } else {
                e.preventDefault();
            }
        });

        availableGeocodesList.addEventListener('dragend', (e) => {
            document.body.classList.remove('dragging-geocode');
        });
    }

    // --- 5. Logique pour l'onglet Assets ---

    // Appel initial pour charger les assets
    await reloadAssetList();

    // Filtrage de la liste d'assets
    if (assetSearchInput) {
        assetSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const items = document.querySelectorAll('#available-assets-list .available-asset-item');
            items.forEach(item => {
                const name = item.dataset.name?.toLowerCase() || '';
                const isVisible = name.includes(searchTerm);
                item.style.display = isVisible ? 'flex' : 'none';
            });
        });
    }

    // Attacher les écouteurs de clic/drag à la liste
    const availableAssetsList = document.getElementById('available-assets-list');
    if (availableAssetsList) {
        // Sélection d'asset pour Placement (Clic)
        availableAssetsList.addEventListener('click', (e) => {
            const targetItem = e.target.closest('.available-asset-item');
            if (!targetItem) return;

            const currentlyActiveCode = availableGeocodesList?.querySelector('.placement-active');
            if (currentlyActiveCode) currentlyActiveCode.classList.remove('placement-active');

            const currentlyActiveAsset = availableAssetsList.querySelector('.placement-active');
            if (currentlyActiveAsset && currentlyActiveAsset !== targetItem) {
                currentlyActiveAsset.classList.remove('placement-active');
            }

            targetItem.classList.toggle('placement-active');

            if (targetItem.classList.contains('placement-active')) {
                currentAssetPlacementData = {
                    id: targetItem.dataset.id,
                    name: targetItem.dataset.name
                };
                currentPlacementData = null;
                canvas.defaultCursor = 'copy';
                canvas.setCursor('copy');
                console.log("[Sidebar] Mode placement Asset activé pour ID", currentAssetPlacementData.id);
            } else {
                cancelAssetPlacementMode(canvas);
            }
        });

        // Drag & Drop pour les assets (Initiation)
        availableAssetsList.addEventListener('dragstart', (e) => {
             const targetItem = e.target.closest('.available-asset-item');
             if (targetItem) {
                 const dataToSend = JSON.stringify({
                     id: targetItem.dataset.id,
                     name: targetItem.dataset.name
                 });
                 e.dataTransfer.setData('text/plain', dataToSend);
                 e.dataTransfer.effectAllowed = 'copy';
                 document.body.classList.add('dragging-asset');
                 console.log("[Sidebar] Drag start Asset. Données:", dataToSend);
             } else {
                 e.preventDefault();
             }
         });

         availableAssetsList.addEventListener('dragend', (e) => {
            document.body.classList.remove('dragging-asset');
         });
    } // Fin if availableAssetsList

    console.log("[Sidebar] Initialisation terminée.");
}

/**
 * Recharge la liste des assets depuis l'API. (Exportée)
 */
export async function reloadAssetList() {
    console.log("[reloadAssetList] Tentative de rechargement...");

    // 1. Cherche les éléments LISTE et PLACEHOLDER
    const availableAssetsList = document.getElementById('available-assets-list');
    let assetListPlaceholder = document.getElementById('asset-list-placeholder'); // Utiliser let

    console.log("[reloadAssetList] Recherche initiale - Liste:", availableAssetsList);
    console.log("[reloadAssetList] Recherche initiale - Placeholder:", assetListPlaceholder);

    // 2. Vérifie si la LISTE existe (le placeholder peut être recréé)
    if (!availableAssetsList) {
        console.error("[Sidebar] Élément #available-assets-list INTROUVABLE. Rechargement impossible.");
        return;
    }

    // 3. Vide la liste ET gère le placeholder
    availableAssetsList.innerHTML = ''; // Vider l'ancienne liste

    // Recréer le placeholder s'il n'existe plus ou le réutiliser
    if (!assetListPlaceholder) {
        console.log("[reloadAssetList] Placeholder non trouvé, recréation...");
        assetListPlaceholder = document.createElement('li');
        assetListPlaceholder.id = 'asset-list-placeholder';
        assetListPlaceholder.className = 'list-group-item text-muted small';
    } else {
         console.log("[reloadAssetList] Placeholder trouvé, réutilisation...");
    }

    assetListPlaceholder.textContent = "Chargement des assets...";
    assetListPlaceholder.classList.remove('text-danger');
    assetListPlaceholder.classList.add('text-muted');
    assetListPlaceholder.style.display = 'block';
    availableAssetsList.appendChild(assetListPlaceholder); // Ajouter/Remettre le placeholder

    // 4. Fetch et Rendu
    try {
        console.log("[Sidebar] Rechargement des assets via API...");
        const apiUrl = window.planData?.listAssetsUrl || 'index.php?action=apiListAssets';
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.error || "Erreur API");

        // Appeler renderAssetList qui AJOUTERA les éléments
        renderAssetList(result.assets || [], availableAssetsList, assetListPlaceholder);
        console.log(`[Sidebar] ${result.assets?.length || 0} assets rechargés.`);

    } catch (error) {
        console.error("[Sidebar] Erreur rechargement assets:", error);
        // Afficher l'erreur DANS le placeholder existant
        assetListPlaceholder.textContent = "Erreur chargement assets.";
        assetListPlaceholder.classList.remove('text-muted');
        assetListPlaceholder.classList.add('text-danger');
        assetListPlaceholder.style.display = 'block'; // S'assurer qu'il est visible
    }
}

/**
 * Fonction pour annuler le mode placement Code Géo activé par clic.
 * @param {fabric.Canvas} canvas
 */
export function cancelPlacementMode(canvas) {
    if (!currentPlacementData) return;

    const availableGeocodesList = document.getElementById('available-geocodes-list');
    const activeItem = availableGeocodesList?.querySelector('.placement-active');
    if (activeItem) {
        activeItem.classList.remove('placement-active');
    }
    currentPlacementData = null;
    if (canvas && canvas.defaultCursor === 'crosshair') {
         canvas.defaultCursor = 'default';
         canvas.setCursor('default');
    }
    console.log("[Sidebar] Mode placement Code Géo annulé.");
}

/**
 * Fonction pour annuler le mode placement d'asset.
 * @param {fabric.Canvas} canvas
 */
export function cancelAssetPlacementMode(canvas) {
    if (!currentAssetPlacementData) return;

    const availableAssetsList = document.getElementById('available-assets-list');
    const activeItem = availableAssetsList?.querySelector('.placement-active');
    if (activeItem) {
        activeItem.classList.remove('placement-active');
    }
    currentAssetPlacementData = null;
    if (canvas && canvas.defaultCursor === 'copy') {
        canvas.defaultCursor = 'default'; canvas.setCursor('default');
    }
    console.log("[Sidebar] Mode placement Asset annulé.");
}


/**
 * Récupère les données du code géo actuellement sélectionné pour placement.
 * @returns {object | null} Les données du code ou null.
 */
export function getCurrentPlacementData() {
    return currentPlacementData;
}

/**
 * Récupère les données de l'asset actuellement sélectionné pour placement.
 * @returns {object | null} L'ID et le nom de l'asset ou null.
 */
export function getCurrentAssetPlacementData() {
    return currentAssetPlacementData;
}

/**
 * Remplit la liste des assets dans la sidebar AVEC les données fournies.
 * Gère l'affichage/masquage du placeholder.
 * NE VIDE PAS LA LISTE elle-même.
 * @param {Array} assets - Tableau d'objets asset {id, name, thumbnail}.
 * @param {HTMLElement} listElement - L'élément UL où ajouter les items.
 * @param {HTMLElement} placeholderElement - L'élément placeholder à gérer.
 */
function renderAssetList(assets, listElement, placeholderElement) {
    // Ne pas vider la liste ici, reloadAssetList l'a déjà fait.

    if (!assets || assets.length === 0) {
        // S'il n'y a pas d'assets, s'assurer que le placeholder est visible et a le bon texte.
        placeholderElement.textContent = "Aucun asset créé.";
        placeholderElement.classList.remove('text-danger'); // Retirer style erreur si succès mais vide
        placeholderElement.classList.add('text-muted');
        placeholderElement.style.display = 'block';
        console.log("[renderAssetList] Aucun asset trouvé, affichage placeholder.");
    } else {
        // S'il y a des assets, cacher le placeholder et ajouter les items.
        placeholderElement.style.display = 'none';
        console.log(`[renderAssetList] Ajout de ${assets.length} assets à la liste...`);

        assets.forEach(asset => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action available-asset-item d-flex align-items-center gap-2';
            li.dataset.id = asset.id;
            li.dataset.name = asset.name;
            li.style.cursor = 'grab';
            li.draggable = true;
            li.title = `Placer "${asset.name}"`;

            const img = document.createElement('img');
            img.src = asset.thumbnail || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22currentColor%22 class=%22bi bi-bounding-box%22 viewBox=%220 0 16 16%22%3E%3Cpath d=%22M5 2V0H0v5h2v6H0v5h5v-2h6v2h5v-5h-2V5h2V0H5zm6 1v2h2v6h-2v2H5v-2H3V5h2V3zM1 1h3v2H1zm1 12H1v3h3zM14 15h-3v-2h3zm0-12V1h-3v2z%22/%3E%3C/svg%3E';
            img.alt = asset.name;
            img.style.width = '32px'; img.style.height = '32px'; img.style.objectFit = 'contain';
            img.style.border = '1px solid #eee'; img.style.flexShrink = '0';
            img.draggable = false;

            const span = document.createElement('span');
            span.textContent = asset.name;
            span.style.overflow = 'hidden'; span.style.textOverflow = 'ellipsis'; span.style.whiteSpace = 'nowrap';
            span.draggable = false;

            li.appendChild(img);
            li.appendChild(span);
            listElement.appendChild(li); // Ajouter l'asset à la liste
        });
    }
}
