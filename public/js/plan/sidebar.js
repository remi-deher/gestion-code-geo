/**
 * Module pour la gestion de la sidebar (liste des codes géo disponibles, filtre).
 */
import { fetchAvailableCodes, saveNewGeoCode } from '../modules/api.js';

let unplacedListEl;
let searchInputEl;
let addCodeBtnEl;
let addCodeModalInstance;
let saveNewCodeBtnEl;
let newUniversIdSelectEl;
let unplacedCounterEl;

let currentPlanId = null; // Sera défini à l'init
let planUniversData = []; // Sera défini à l'init
let universColorsData = {}; // Sera défini à l'init
let codeToPlaceCallback = null; // Callback pour notifier main.js

/**
 * Initialise la sidebar.
 * @param {number} planId - L'ID du plan actuel.
 * @param {Array} planUnivers - Liste des univers liés au plan.
 * @param {object} universColors - Couleurs des univers.
 * @param {Function} onCodeSelect - Callback appelé quand un code est sélectionné pour placement.
 */
export function initializeSidebar(planId, planUnivers, universColors, onCodeSelect) {
    currentPlanId = planId;
    planUniversData = planUnivers;
    universColorsData = universColors;
    codeToPlaceCallback = onCodeSelect;

    unplacedListEl = document.getElementById('unplaced-list');
    searchInputEl = document.getElementById('tag-search-input');
    addCodeBtnEl = document.getElementById('add-code-btn');
    const addCodeModalElement = document.getElementById('add-code-modal');
    addCodeModalInstance = addCodeModalElement ? new bootstrap.Modal(addCodeModalElement) : null;
    saveNewCodeBtnEl = document.getElementById('save-new-code-btn');
    newUniversIdSelectEl = document.getElementById('new-univers-id');
    unplacedCounterEl = document.getElementById('unplaced-counter');

    if (!unplacedListEl || !searchInputEl || !addCodeBtnEl || !addCodeModalInstance || !saveNewCodeBtnEl || !newUniversIdSelectEl || !unplacedCounterEl) {
        console.warn("Certains éléments de la sidebar sont manquants.");
        // Ne pas bloquer complètement, certaines fonctionnalités peuvent marcher
    }

    addEventListeners();
    fetchAndRenderAvailableCodes(); // Charge les codes initiaux
    updateLegend();
    console.log("Sidebar initialisée.");
}

/** Ajoute les écouteurs d'événements pour la sidebar */
function addEventListeners() {
    if (unplacedListEl) unplacedListEl.addEventListener('click', handleAvailableCodeClick);
    if (searchInputEl) searchInputEl.addEventListener('input', filterAvailableCodes);
    if (addCodeBtnEl) addCodeBtnEl.addEventListener('click', openAddCodeModal);
    if (saveNewCodeBtnEl) saveNewCodeBtnEl.addEventListener('click', handleSaveNewCode);
}

/** Récupère et affiche les codes disponibles pour le plan */
export async function fetchAndRenderAvailableCodes() {
    if (!unplacedListEl || !currentPlanId) return;
    unplacedListEl.innerHTML = `<p class="text-muted small p-3">Chargement...</p>`;
    updateCounter('...');

    try {
        const codes = await fetchAvailableCodes(currentPlanId);
        console.log("Codes disponibles reçus:", codes.length);
        renderAvailableCodes(codes);
    } catch (error) {
        console.error("Erreur fetchAvailableCodes:", error);
        unplacedListEl.innerHTML = `<p class="text-danger p-3">Erreur chargement: ${error.message}</p>`;
        updateCounter('!');
    }
}

/** Affiche la liste des codes disponibles dans la sidebar */
function renderAvailableCodes(codes) {
    if (!unplacedListEl) return;
    unplacedListEl.innerHTML = ''; // Vide la liste

    if (!codes || codes.length === 0) {
        unplacedListEl.innerHTML = `<p class="text-muted small p-3">Aucun code disponible pour les univers de ce plan.</p>`;
        updateCounter(0);
        return;
    }

    codes.forEach(code => {
        const item = document.createElement('div');
        // Classes Bootstrap pour style et interaction
        item.className = 'unplaced-item list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        // Stocker toutes les données nécessaires dans dataset
        Object.assign(item.dataset, {
            id: code.id,
            codeGeo: code.code_geo,
            libelle: code.libelle || '', // Assurer une chaîne vide si null
            univers: code.univers || 'Inconnu',
            // Préparer la chaîne de recherche en minuscule
            search: `${code.code_geo} ${code.libelle || ''} ${code.univers || ''}`.toLowerCase()
        });
        // Couleur de la bordure basée sur l'univers
        item.style.borderLeft = `5px solid ${universColorsData[code.univers] || '#ccc'}`;

        item.innerHTML = `
            <div>
                <strong class="item-code">${code.code_geo}</strong>
                <small class="item-libelle d-block text-muted">${code.libelle || 'Pas de libellé'}</small>
            </div>
            <span class="badge bg-secondary rounded-pill placement-count">${code.placement_count || 0}</span>
        `;
        unplacedListEl.appendChild(item);
    });

    filterAvailableCodes(); // Appliquer le filtre initial (au cas où)
    console.log(`${codes.length} codes disponibles affichés.`);
}

/** Filtre la liste des codes disponibles basé sur la recherche */
function filterAvailableCodes() {
    if (!searchInputEl || !unplacedListEl) return;
    const searchTerm = searchInputEl.value.toLowerCase().trim();
    let visibleCount = 0;
    const items = unplacedListEl.querySelectorAll('.unplaced-item');

    items.forEach(item => {
        // Vérifier si dataset.search existe avant d'appeler includes
        const isVisible = item.dataset.search ? item.dataset.search.includes(searchTerm) : true;
        item.style.display = isVisible ? 'flex' : 'none';
        if (isVisible) visibleCount++;
    });

    updateCounter(visibleCount); // Met à jour le compteur
}

/** Met à jour le compteur de codes visibles */
function updateCounter(count) {
    if (unplacedCounterEl) {
        unplacedCounterEl.textContent = `${count}`;
    }
}

/** Gère le clic sur un code dans la liste */
function handleAvailableCodeClick(event) {
    const item = event.target.closest('.unplaced-item');
    if (item && codeToPlaceCallback) {
        console.log("Code sélectionné pour placement:", item.dataset.codeGeo);
        // Notifier le module principal (main.js)
        codeToPlaceCallback({ ...item.dataset }); // Passe une copie des données

        // Gérer l'état visuel 'active'
        document.querySelectorAll('#unplaced-list .unplaced-item.active').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
    }
}

/**
 * Met à jour le compteur de placement pour un code spécifique dans la sidebar.
 * @param {number|string} geoCodeId - L'ID du code géo.
 * @param {number} change - +1 pour ajout, -1 pour suppression.
 */
export function updateCodeCountInSidebar(geoCodeId, change) {
    if (!unplacedListEl) return;
    const item = unplacedListEl.querySelector(`.unplaced-item[data-id="${geoCodeId}"]`);
    const countBadge = item?.querySelector('.placement-count');
    if (countBadge) {
        const currentCount = parseInt(countBadge.textContent, 10) || 0;
        const newCount = Math.max(0, currentCount + change);
        countBadge.textContent = newCount;
         console.log(`Compteur sidebar mis à jour pour ${geoCodeId}: ${newCount}`);
    } else {
        console.warn(`Badge compteur non trouvé pour ${geoCodeId} dans la sidebar.`);
    }
}

/** Désactive l'état 'active' sur tous les items de la liste */
export function clearSidebarSelection() {
    document.querySelectorAll('#unplaced-list .unplaced-item.active').forEach(el => el.classList.remove('active'));
}


// --- Gestion Modal Ajout Code ---

/** Ouvre la modal pour ajouter un nouveau code géo */
function openAddCodeModal() {
    if (!newUniversIdSelectEl || !addCodeModalInstance || !planUniversData) return;

    // Remplir le select des univers disponibles pour CE plan
    newUniversIdSelectEl.innerHTML = '<option value="">Choisir un univers...</option>';
    planUniversData.forEach(u => {
        const option = new Option(u.nom, u.id);
        newUniversIdSelectEl.add(option);
    });

    document.getElementById('add-code-form')?.reset(); // Vide le formulaire
    addCodeModalInstance.show();
}

/** Gère la sauvegarde du nouveau code géo depuis la modal */
async function handleSaveNewCode() {
    const form = document.getElementById('add-code-form');
    if (!form || !addCodeModalInstance) return;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Validation simple côté client
    if (!data.code_geo || !data.libelle || !data.univers_id) {
        alert("Les champs Code Géo, Libellé et Univers sont requis.");
        return;
    }

    console.log("Tentative de sauvegarde nouveau code géo via modal:", data);
    try {
        // Appel API pour créer le code
        const newCode = await saveNewGeoCode(data); // `saveNewGeoCode` gère le fetch et retourne les données ou lance une erreur
        console.log("Nouveau code créé:", newCode);

        // Mettre à jour l'UI (fermer modal, rafraîchir liste)
        addCodeModalInstance.hide();
        await fetchAndRenderAvailableCodes(); // Recharge la liste pour inclure le nouveau

        // Sélectionner automatiquement le nouveau code pour placement immédiat
        const newItem = unplacedListEl?.querySelector(`.unplaced-item[data-id="${newCode.id}"]`);
        if (newItem) {
            newItem.click(); // Simule un clic pour activer le mode placement
            alert("Code créé avec succès. Cliquez maintenant sur le plan pour le placer.");
        } else {
             console.warn("Impossible de trouver le nouvel élément après création:", newCode.id);
             alert("Code créé, mais impossible de le sélectionner automatiquement.");
        }

    } catch (error) {
        console.error('Erreur lors de la création du code géo:', error);
        alert(`Erreur: ${error.message}`); // Affiche l'erreur à l'utilisateur
    }
}


/** Met à jour la légende des univers */
function updateLegend() {
    const legendContainer = document.getElementById('legend-container');
    if (!legendContainer || !planUniversData) return;

    legendContainer.innerHTML = ''; // Vide la légende actuelle
    if (planUniversData.length === 0) {
        legendContainer.innerHTML = '<p class="text-muted small">Aucun univers lié à ce plan.</p>';
        return;
    }

    // Trier les univers par nom
    const sortedUnivers = [...planUniversData].sort((a, b) => a.nom.localeCompare(b.nom));

    sortedUnivers.forEach(univers => {
        const color = universColorsData[univers.nom] || '#7f8c8d'; // Couleur par défaut
        const item = document.createElement('div');
        item.className = 'legend-item d-flex align-items-center mb-1';
        item.innerHTML = `
            <div class="legend-color-box me-2" style="width: 15px; height: 15px; background-color: ${color}; border: 1px solid #666;"></div>
            <span>${univers.nom}</span>
        `;
        legendContainer.appendChild(item);
    });
     console.log("Légende mise à jour.");
}
