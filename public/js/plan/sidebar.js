/**
 * Module pour la gestion de la sidebar (listes codes disponibles/placés, filtres, légende).
 * VERSION MISE A JOUR: Rôle informatif, listes séparées, fonction de localisation.
 */
import { getCanvasInstance } from './canvas.js';
import { showLoading, hideLoading } from './ui.js'; // ui.js gère loading
import { showToast } from '../modules/utils.js'; // utils.js gère showToast
import { setActiveTool } from './drawing-tools.js';

let canvasInstance = null;
let currentPlanId = null;
let currentPlanType = null;
let universList = [];
let universColors = {};

// Éléments DOM pour les listes
let dispoListEl;
let placedListEl;
let dispoCounterEl;
let placedCounterEl;
let searchInput;
let legendContainer;

// Modale "Ajouter nouveau code"
let addCodeModal;
let addCodeForm;
let saveNewCodeBtn;
let universSelectInModal;

// Données en cache
let allAvailableCodes = []; // Codes pas encore placés
let allPlacedCodes = [];    // Codes actuellement placés sur CE plan

/**
 * Initialise la sidebar.
 * @param {fabric.Canvas} canvas - Instance du canvas (envoyé en 1er)
 * @param {Object} uColors - Mapping des couleurs d'univers (envoyé en 2e)
 * @param {number} planId - ID du plan actuel (envoyé en 3e)
 * @param {string} pType - Type de plan (envoyé en 4e)
 * @param {Array} uList - Liste des univers du plan (envoyé en 5e)
 */
export function initializeSidebar(canvas, uColors, planId, pType, uList) {
    // Assigner les variables globales (en supposant qu'elles existent en haut du fichier)
    canvasInstance = canvas; // S'assurer que 'canvasInstance' est défini globalement
    currentPlanId = planId;
    universList = uList; // <-- CORRIGÉ: uList est le 5ème argument
    universColors = uColors; // <-- CORRIGÉ: uColors est le 2ème argument
    currentPlanType = pType; // S'assurer que 'currentPlanType' est défini globalement

    // Listes
    dispoListEl = document.getElementById('dispo-list');
    placedListEl = document.getElementById('placed-list');
    dispoCounterEl = document.getElementById('dispo-counter');
    placedCounterEl = document.getElementById('placed-counter');
    searchInput = document.getElementById('tag-search-input');
    legendContainer = document.getElementById('legend-container');

    // Modale "Ajouter"
    const modalElement = document.getElementById('add-code-modal');
    addCodeModal = modalElement ? new bootstrap.Modal(modalElement) : null;
    addCodeForm = document.getElementById('add-code-form');
    saveNewCodeBtn = document.getElementById('save-new-code-btn');
    universSelectInModal = document.getElementById('new-univers-id');

    if (!dispoListEl || !placedListEl || !dispoCounterEl || !placedCounterEl || !searchInput || !legendContainer) {
        console.warn("Sidebar: Éléments DOM manquants pour les listes/compteurs.");
    }

    addEventListeners();
    renderLegend(); // universList est maintenant le bon tableau (uList)
    fetchAndClassifyCodes(); // Charger les données initiales

    console.log("Sidebar (rôle info) initialisée.");
}

/** Ajoute les écouteurs d'événements */
function addEventListeners() {
    // Filtre pour les deux listes
    if (searchInput) searchInput.addEventListener('input', () => filterLists(searchInput.value));
    
    // Clic sur un élément PLACÉ pour le localiser
    if (placedListEl) placedListEl.addEventListener('click', handlePlacedCodeClick);

    // Note: les listeners pour la modale "Ajouter" sont dans main.js
}

/**
 * Récupère TOUS les codes associés au plan et les classe en 'dispo' et 'placés'.
 * C'est la fonction principale de rafraîchissement de la sidebar.
 */
export async function fetchAndClassifyCodes() {
    if (!currentPlanId || !dispoListEl || !placedListEl) return;
    
    // État de chargement
    dispoListEl.innerHTML = '<li class="list-group-item text-muted small">Chargement...</li>';
    placedListEl.innerHTML = '<li class="list-group-item text-muted small">Chargement...</li>';

    try {
        // 1. Récupérer tous les codes DISPONIBLES (non placés sur ce plan) via l'API
        // Note: L'API (fetchAvailableCodes) est supposée ne renvoyer que les codes non encore placés
        // sur *ce* planId.
        allAvailableCodes = await fetchAvailableCodes(currentPlanId); 
        console.log("Codes disponibles (API):", allAvailableCodes.length);

        // 2. Récupérer les codes PLACÉS depuis les données initiales de la page
        // C'est plus fiable de le faire à partir des objets sur le canvas
        const fabricCanvas = getCanvasInstance();
        if (!fabricCanvas) {
             console.warn("Canvas non dispo pour classer les codes placés.");
             allPlacedCodes = [];
        } else {
            const placedOnThisPlan = fabricCanvas.getObjects().filter(obj => 
                obj.customData && 
                (obj.customData.isGeoTag || obj.customData.isPlacedText) &&
                obj.customData.plan_id == currentPlanId
            ).map(obj => obj.customData); // Extraire les données
            
            // Regrouper par ID de code géo (un code peut être placé plusieurs fois)
            const placedCodeDetails = {};
            placedOnThisPlan.forEach(data => {
                const id = data.id;
                if (!placedCodeDetails[id]) {
                     placedCodeDetails[id] = {
                         ...data, // Copie toutes les infos (code_geo, libelle, univers...)
                         placement_count: 0,
                         position_ids: [] // Stocker les ID de position pour la localisation
                     };
                }
                placedCodeDetails[id].placement_count++;
                if(data.position_id) placedCodeDetails[id].position_ids.push(data.position_id);
            });
            allPlacedCodes = Object.values(placedCodeDetails);
            console.log("Codes placés (Canvas):", allPlacedCodes.length);
        }

        // 3. Afficher les listes
        renderCodeList(dispoListEl, allAvailableCodes, false); // false = pas de compteur/actions
        renderCodeList(placedListEl, allPlacedCodes, true);   // true = avec compteur/actions

        // 4. Mettre à jour les compteurs globaux
        if(dispoCounterEl) dispoCounterEl.textContent = allAvailableCodes.length;
        if(placedCounterEl) placedCounterEl.textContent = allPlacedCodes.length;

    } catch (error) {
        console.error("Erreur classement codes sidebar:", error);
        if(dispoListEl) dispoListEl.innerHTML = `<li class="list-group-item text-danger small">Erreur: ${error.message}</li>`;
        if(placedListEl) placedListEl.innerHTML = `<li class="list-group-item text-danger small">Erreur</li>`;
        showToast(`Erreur chargement listes: ${error.message}`, 'danger');
    }
}


/**
 * Affiche une liste de codes (disponibles ou placés) dans l'élément DOM fourni.
 * @param {HTMLElement} listElement - L'élément <ul> ou <div> où injecter la liste.
 * @param {Array} codesData - Le tableau de données de codes.
 * @param {boolean} isPlacedList - True s'il s'agit de la liste des codes placés.
 */
function renderCodeList(listElement, codesData, isPlacedList) {
    if (!listElement) return;
    listElement.innerHTML = ''; // Vide la liste

    if (!codesData || codesData.length === 0) {
        const message = isPlacedList ? "Aucun code placé sur ce plan." : "Aucun code disponible pour ce plan.";
        listElement.innerHTML = `<li class="list-group-item text-muted small">${message}</li>`;
        return;
    }

    // Tri alphabétique
    codesData.sort((a, b) => (a.code_geo || a.codeGeo || '').localeCompare(b.code_geo || b.codeGeo || ''));

    codesData.forEach(code => {
        const codeGeo = code.code_geo || code.codeGeo;
        const libelle = code.libelle || '';
        const univers = code.univers_nom || code.univers || 'Inconnu';
        
        const listItem = document.createElement('a'); // Utiliser 'a' pour le style Bootstrap
        listItem.href = '#';
        listItem.className = `list-group-item list-group-item-action ${isPlacedList ? 'placed-item' : 'dispo-item'}`;
        listItem.dataset.id = code.id;
        listItem.dataset.codeGeo = codeGeo;
        listItem.dataset.search = `${codeGeo} ${libelle} ${univers}`.toLowerCase();
        
        // Pour les placés, stocker les IDs de position pour la localisation
        if (isPlacedList && code.position_ids) {
             listItem.dataset.positionIds = JSON.stringify(code.position_ids);
        }

        const universColor = universColors[univers] || '#adb5bd';
        const placementCount = code.placement_count || 0; // Compteur pour les placés

        listItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between align-items-center">
                <div class="code-details flex-grow-1 me-2" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <strong class="mb-1 code-geo-text" style="color: ${universColor};">${codeGeo}</strong>
                    <small class="d-block text-muted libelle-text">${libelle || '<i>(Sans libellé)</i>'}</small>
                </div>
                ${isPlacedList ? `<span class="badge bg-primary rounded-pill me-2 placement-count" title="Nombre de fois placé">${placementCount}</span>` : ''}
                <span class="badge rounded-pill text-truncate" style="background-color: ${universColor}; color: white; max-width: 80px;" title="${univers}">${univers}</span>
                ${isPlacedList ? '<i class="bi bi-geo-alt-fill text-secondary ms-2 locate-icon" title="Localiser sur le plan"></i>' : ''}
            </div>
        `;
        listElement.appendChild(listItem);
    });

    // Réappliquer le filtre après rendu
    if (searchInput) filterLists(searchInput.value);
}

/**
 * Gère le clic sur un code PLACÉ pour le localiser sur le canvas.
 * @param {Event} event - L'événement de clic.
 */
function handlePlacedCodeClick(event) {
    event.preventDefault();
    const targetItem = event.target.closest('.placed-item');
    // Clic doit être sur l'icône de localisation
    const locateIcon = event.target.closest('.locate-icon'); 

    if (!targetItem || !locateIcon) return; 

    const codeId = targetItem.dataset.id;
    const positionIds = JSON.parse(targetItem.dataset.positionIds || '[]');
    const codeGeo = targetItem.dataset.codeGeo;

    console.log(`Localisation demandée pour: ${codeGeo} (ID ${codeId}), Positions:`, positionIds);

    const fabricCanvas = getCanvasInstance();
    if (!fabricCanvas) return;

    // Trouver les objets Fabric correspondants
    const objectsToHighlight = fabricCanvas.getObjects().filter(obj =>
        (obj.customData?.isGeoTag || obj.customData?.isPlacedText) && // Tag ou Texte
        obj.customData.id == codeId // Correspondant à l'ID du code géo
        // On pourrait aussi filtrer par positionIds si nécessaire
        // && positionIds.includes(obj.customData.position_id)
    );

    if (objectsToHighlight.length > 0) {
        // Centrer la vue sur le premier objet trouvé
        const firstObject = objectsToHighlight[0];
        const zoomLevel = Math.max(1.5, fabricCanvas.getZoom()); // Zoomer à 1.5x minimum
        
        fabricCanvas.viewportCenterObject(firstObject);
        fabricCanvas.zoomToPoint(firstObject.getCenterPoint(), zoomLevel);
        fabricCanvas.renderAll();

        // Animer brièvement les objets (clignotement)
        objectsToHighlight.forEach(obj => {
            const originalOpacity = obj.opacity;
            obj.animate('opacity', 0.2, {
                duration: 300,
                onChange: fabricCanvas.renderAll.bind(fabricCanvas),
                onComplete: () => {
                    obj.animate('opacity', originalOpacity, {
                         duration: 300,
                         onChange: fabricCanvas.renderAll.bind(fabricCanvas)
                    });
                }
            });
        });

        showToast(`Code ${codeGeo} localisé.`, 'info');

    } else {
        console.warn("Aucun objet Fabric trouvé pour la localisation:", codeId, positionIds);
        showToast(`Impossible de localiser ${codeGeo} sur le plan.`, 'warning');
    }
}


/** Filtre les deux listes (dispo et placés) en même temps */
function filterLists(searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    const filterList = (listElement) => {
        if (!listElement) return;
        const items = listElement.querySelectorAll('.list-group-item');
        items.forEach(item => {
            // Ignorer les items "chargement" ou "vide"
            if (!item.dataset.search) return; 
            
            const searchData = item.dataset.search || '';
            item.style.display = searchData.includes(term) ? '' : 'none';
        });
    };

    filterList(dispoListEl);
    filterList(placedListEl);
}

/** Affiche la légende des univers */
function renderLegend() {
    if (!legendContainer) return;
    legendContainer.innerHTML = '';
    
    if (!universList || universList.length === 0) {
        legendContainer.innerHTML = '<p class="text-muted small">Aucun univers défini.</p>';
        return;
    }

    universList.forEach(univers => {
        const color = universColors[univers.nom] || '#adb5bd';
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item d-flex align-items-center mb-1';
        legendItem.innerHTML = `
            <span class="legend-color-box me-2" style="background-color: ${color};"></span>
            <span class="legend-text small">${univers.nom}</span>
        `;
        legendContainer.appendChild(legendItem);
    });
}

// --- Fonctions pour la modale "Ajouter nouveau code" ---
// (Exportées pour être utilisées par main.js)

/** Remplit le <select> des univers dans la modale d'ajout */
export function populateUniversSelectInModal(selectElement, universData) {
     if (!selectElement) return;
     selectElement.innerHTML = '<option value="">Sélectionner un univers...</option>';
     if (universData && universData.length > 0) {
         universData.forEach(univers => {
             const option = document.createElement('option');
             option.value = univers.id;
             option.textContent = univers.nom;
             selectElement.appendChild(option);
         });
     }
}

/** Gère la soumission du formulaire d'ajout de nouveau code */
export async function handleSaveNewCodeInModal(formElement, buttonElement, apiSaveFunction) {
     if (!formElement || !buttonElement || !apiSaveFunction) return;

    const codeGeo = formElement.querySelector('#new-code-geo')?.value;
    const libelle = formElement.querySelector('#new-libelle')?.value;
    const universId = formElement.querySelector('#new-univers-id')?.value;
    const commentaire = formElement.querySelector('#new-commentaire')?.value;
    const zone = formElement.querySelector('#new-zone')?.value;

    if (!codeGeo || !universId) {
        showToast("Le 'Code Géo' et 'l'Univers' sont obligatoires.", "warning");
        return;
    }
    
    const codeData = {
        code_geo: codeGeo,
        libelle: libelle,
        univers_id: parseInt(universId, 10),
        commentaire: commentaire,
        zone: zone
    };

    // Gérer état "loading" du bouton
    const originalBtnText = buttonElement.innerHTML;
    buttonElement.disabled = true;
    buttonElement.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enregistrement...`;

    try {
        const newCode = await apiSaveFunction(codeData); // Appel API
        showToast(`Code "${newCode.code_geo}" ajouté avec succès !`, "success");
        formElement.reset(); // Vider le formulaire
        
        // La modale sera cachée et les listes rafraîchies par main.js
        
    } catch (error) {
        console.error("Erreur sauvegarde nouveau code:", error);
        showToast(`Erreur: ${error.message}`, "danger");
    } finally {
        buttonElement.disabled = false;
        buttonElement.innerHTML = originalBtnText;
    }
}


/**
 * @deprecated N'est plus utilisé, remplacé par fetchAndClassifyCodes
 */
export function updateCodeCountInSidebar(codeId, delta) {
    // console.log(`(DEPRECATED) Mise à jour compteur pour ${codeId} (delta: ${delta})`);
}

/**
 * @deprecated N'est plus utilisé, remplacé par fetchAndClassifyCodes
 */
export function updatePlacedCodesList(allFabricGeoElements) {
    // console.log("(DEPRECATED) updatePlacedCodesList appelé. Redirection vers fetchAndClassifyCodes.");
    // fetchAndClassifyCodes(); // On pourrait appeler ça, mais c'est mieux de le faire depuis main.js
}

/**
 * @deprecated N'est plus utilisé
 */
export function clearSidebarSelection() {
    // console.log("(DEPRECATED) clearSidebarSelection");
}
