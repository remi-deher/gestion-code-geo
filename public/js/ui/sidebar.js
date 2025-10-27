// Fichier: public/js/ui/sidebar.js
/**
 * Gère l'interactivité de la sidebar : filtrage des codes géo et assets,
 * sélection pour placement (clic), et potentiellement drag-and-drop.
 */

// Variable pour suivre l'état du placement (quel code est sélectionné)
let currentPlacementData = null;
// NOUVEAU: Variable pour suivre l'asset sélectionné pour placement
let currentAssetPlacementData = null;

/**
 * Initialise les fonctionnalités de la sidebar.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export async function setupSidebar(canvas) { // Rendre async pour fetch
    const geocodeSearchInput = document.getElementById('geocode-search');
    const availableGeocodesList = document.getElementById('available-geocodes-list');

    // NOUVEAU: Éléments pour les assets
    const assetSearchInput = document.getElementById('asset-search');
    const availableAssetsList = document.getElementById('available-assets-list');
    const assetListPlaceholder = document.getElementById('asset-list-placeholder');


    if (!geocodeSearchInput || !availableGeocodesList) {
        console.warn("[Sidebar] Éléments de recherche ou liste de codes géo manquants.");
        // Ne pas retourner ici pour que la logique asset puisse continuer
    }
    if (!assetSearchInput || !availableAssetsList || !assetListPlaceholder) {
         console.warn("[Sidebar] Éléments de recherche, liste ou placeholder d'assets manquants.");
         // Ne pas retourner ici pour que la logique geocode puisse continuer
    }

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
                    // Ajoutez d'autres data-* si nécessaire
                };
                currentAssetPlacementData = null; // Désactiver mode placement asset
                canvas.defaultCursor = 'crosshair'; // Changer le curseur du canvas
                canvas.setCursor('crosshair'); // Appliquer immédiatement
                console.log("[Sidebar] Mode placement Code Géo activé pour", currentPlacementData);

            } else {
                // Désactiver le mode placement
                cancelPlacementMode(canvas);
            }
        });
    }


    // --- 3. Annuler le placement si on clique sur un objet existant ---
    canvas.on('mouse:down', (options) => {
        // Si on clique sur un objet existant pendant un mode placement (code ou asset), on annule ce mode.
        if (currentPlacementData && options.target) {
             console.log("[Sidebar] Clic sur objet existant, annulation mode placement Code Géo.");
             cancelPlacementMode(canvas);
        }
        if (currentAssetPlacementData && options.target) {
            console.log("[Sidebar] Clic sur objet existant, annulation mode placement Asset.");
            cancelAssetPlacementMode(canvas);
        }
        // La logique pour *créer* l'objet au clic sera gérée ailleurs
    });


    // --- 4. Gestion Drag-and-Drop (Initiation - Code Géo) ---
    if (availableGeocodesList) {
        availableGeocodesList.addEventListener('dragstart', (e) => {
            const targetItem = e.target.closest('.available-geocode-item');
            if (targetItem) {
                const dataToSend = JSON.stringify({
                     id: targetItem.dataset.id,
                     code: targetItem.dataset.code, // Présence de 'code' identifie un code géo
                     libelle: targetItem.dataset.libelle,
                     universId: targetItem.dataset.universId
                 });
                e.dataTransfer.setData('text/plain', dataToSend);
                e.dataTransfer.effectAllowed = 'copy';
                document.body.classList.add('dragging-geocode'); // Style visuel global
                // ---> LOG AJOUTÉ <---
                console.log("[Sidebar] Drag start Code Géo. Données:", dataToSend);
            } else {
                e.preventDefault();
            }
        });

        availableGeocodesList.addEventListener('dragend', (e) => {
            document.body.classList.remove('dragging-geocode'); // Nettoyer le style
            console.log("[Sidebar] Drag end Code Géo");
        });
    }

    // --- 5. NOUVEAU: Logique pour l'onglet Assets ---
    if (assetSearchInput && availableAssetsList && assetListPlaceholder) {
        // Chargement initial des assets
        try {
            console.log("[Sidebar] Chargement des assets via API...");
            const response = await fetch(window.planData?.listAssetsUrl || 'index.php?action=apiListAssets');
            if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.error || "Erreur API");

            renderAssetList(result.assets || [], availableAssetsList, assetListPlaceholder);
            console.log(`[Sidebar] ${result.assets?.length || 0} assets chargés.`);

        } catch (error) {
            console.error("[Sidebar] Erreur chargement assets:", error);
            assetListPlaceholder.textContent = "Erreur chargement assets.";
            assetListPlaceholder.classList.remove('text-muted');
            assetListPlaceholder.classList.add('text-danger');
        }

        // Filtrage de la liste d'assets
        assetSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const items = availableAssetsList.querySelectorAll('.available-asset-item');
            items.forEach(item => {
                const name = item.dataset.name?.toLowerCase() || '';
                const isVisible = name.includes(searchTerm);
                item.style.display = isVisible ? 'flex' : 'none'; // Utiliser 'flex' car c'est un flex container
            });
        });

        // Sélection d'asset pour Placement (Clic)
        availableAssetsList.addEventListener('click', (e) => {
            const targetItem = e.target.closest('.available-asset-item');
            if (!targetItem) return;

            // Désélectionner l'ancien item actif (code géo OU asset)
            const currentlyActiveCode = availableGeocodesList?.querySelector('.placement-active');
            if (currentlyActiveCode) currentlyActiveCode.classList.remove('placement-active');
            const currentlyActiveAsset = availableAssetsList.querySelector('.placement-active');
            if (currentlyActiveAsset && currentlyActiveAsset !== targetItem) {
                currentlyActiveAsset.classList.remove('placement-active');
            }

            targetItem.classList.toggle('placement-active');

            if (targetItem.classList.contains('placement-active')) {
                // Activer le mode placement asset
                currentAssetPlacementData = { // Stocker juste l'ID, on fetchera les data au placement
                    id: targetItem.dataset.id,
                    name: targetItem.dataset.name // Utile pour le log
                };
                currentPlacementData = null; // Désactiver mode placement code géo
                canvas.defaultCursor = 'copy'; // Curseur différent pour asset
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
                     name: targetItem.dataset.name // Présence de 'name' identifie un asset
                 });
                 e.dataTransfer.setData('text/plain', dataToSend);
                 e.dataTransfer.effectAllowed = 'copy';
                 document.body.classList.add('dragging-asset'); // Style différent ?
                 // ---> LOG AJOUTÉ <---
                 console.log("[Sidebar] Drag start Asset. Données:", dataToSend);
             } else {
                 e.preventDefault();
             }
         });

         availableAssetsList.addEventListener('dragend', (e) => {
            document.body.classList.remove('dragging-asset');
            console.log("[Sidebar] Drag end Asset");
         });

    } // Fin if assets elements exist

    console.log("[Sidebar] Initialisation terminée.");
}


/**
 * Fonction pour annuler le mode placement Code Géo activé par clic.
 * @param {fabric.Canvas} canvas
 */
export function cancelPlacementMode(canvas) {
    if (!currentPlacementData) return; // Si pas en mode placement, ne rien faire

    const availableGeocodesList = document.getElementById('available-geocodes-list');
    const activeItem = availableGeocodesList?.querySelector('.placement-active');
    if (activeItem) {
        activeItem.classList.remove('placement-active');
    }
    currentPlacementData = null;
    if (canvas && canvas.defaultCursor === 'crosshair') { // Ne reset que si c'était le curseur code géo
         canvas.defaultCursor = 'default';
         canvas.setCursor('default');
    }
    console.log("[Sidebar] Mode placement Code Géo annulé.");
}

/**
 * NOUVEAU: Fonction pour annuler le mode placement d'asset.
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
    if (canvas && canvas.defaultCursor === 'copy') { // Ne reset que si c'était le curseur asset
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
 * NOUVEAU: Récupère les données de l'asset actuellement sélectionné pour placement.
 * @returns {object | null} L'ID et le nom de l'asset ou null.
 */
export function getCurrentAssetPlacementData() {
    return currentAssetPlacementData;
}

/**
 * NOUVEAU: Remplit la liste des assets dans la sidebar.
 * @param {Array} assets - Tableau d'objets asset {id, name, thumbnail}.
 * @param {HTMLElement} listElement - L'élément UL où ajouter les items.
 * @param {HTMLElement} placeholderElement - L'élément de chargement/erreur.
 */
function renderAssetList(assets, listElement, placeholderElement) {
    listElement.innerHTML = ''; // Vider la liste

    if (!assets || assets.length === 0) {
        placeholderElement.textContent = "Aucun asset créé.";
        placeholderElement.style.display = 'block'; // Assurer visibilité
        return;
    }

    placeholderElement.style.display = 'none'; // Cacher le placeholder

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
        img.style.width = '32px'; img.style.height = '32px'; img.style.objectFit = 'contain'; img.style.border = '1px solid #eee'; img.style.flexShrink = '0';

        const span = document.createElement('span');
        span.textContent = asset.name;
        span.style.overflow = 'hidden';
        span.style.textOverflow = 'ellipsis';
        span.style.whiteSpace = 'nowrap';

        li.appendChild(img);
        li.appendChild(span);
        listElement.appendChild(li);
    });
}
