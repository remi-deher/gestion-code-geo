/**
 * Module pour la gestion de la sidebar (liste des codes non placés, filtres, légende).
 * CORRECTIONS: Logique du compteur global et mise à jour de la liste.
 */
import { fetchAvailableCodes, saveNewGeoCode } from '../modules/api.js';
import { showToast } from '../modules/utils.js';

let currentPlanId = null;
let universList = [];
let universColors = {};
let onCodeSelectedCallback = null; // Fonction à appeler quand un code est sélectionné pour placement

let unplacedList;
let unplacedCounter;
let searchInput;
let legendContainer;
let addCodeBtn;
let addCodeModal;
let addCodeForm;
let saveNewCodeBtn;
let universSelectInModal;

let allAvailableCodes = []; // Garder une copie locale pour filtrer

/**
 * Initialise la sidebar.
 * @param {number} planId - L'ID du plan actuel.
 * @param {Array} uList - La liste des univers disponibles.
 * @param {object} uColors - Les couleurs associées aux univers.
 * @param {function} onCodeSelected - Callback à appeler quand un code est sélectionné.
 */
export function initializeSidebar(planId, uList, uColors, onCodeSelected) {
    currentPlanId = planId;
    universList = uList;
    universColors = uColors;
    onCodeSelectedCallback = onCodeSelected;

    unplacedList = document.getElementById('unplaced-list');
    unplacedCounter = document.getElementById('unplaced-counter');
    searchInput = document.getElementById('tag-search-input');
    legendContainer = document.getElementById('legend-container');
    addCodeBtn = document.getElementById('add-code-btn');
    addCodeModal = new bootstrap.Modal(document.getElementById('add-code-modal'));
    addCodeForm = document.getElementById('add-code-form');
    saveNewCodeBtn = document.getElementById('save-new-code-btn');
    universSelectInModal = document.getElementById('new-univers-id');

    if (!unplacedList || !unplacedCounter || !searchInput || !legendContainer || !addCodeBtn || !addCodeModal || !addCodeForm || !saveNewCodeBtn || !universSelectInModal) {
        console.warn("Sidebar: Un ou plusieurs éléments DOM sont manquants.");
        return; // Ne pas continuer si des éléments essentiels manquent
    }

    addEventListeners();
    populateUniversSelect(); // Remplir le select du modal
    renderLegend(); // Afficher la légende
    fetchAndRenderAvailableCodes(); // Charger et afficher les codes

    console.log("Sidebar initialisée.");
}

/** Ajoute les écouteurs d'événements pour la sidebar */
function addEventListeners() {
    // Clic sur un code dans la liste pour le sélectionner
    unplacedList.addEventListener('click', handleCodeClick);

    // Filtrage en temps réel
    searchInput.addEventListener('input', () => filterCodes(searchInput.value));

    // Bouton "+" pour ajouter un code
    addCodeBtn.addEventListener('click', () => {
        addCodeForm.reset(); // Vider le formulaire
        addCodeModal.show();
    });

    // Bouton "Enregistrer" dans le modal
    saveNewCodeBtn.addEventListener('click', handleSaveNewCode);
}

/** Récupère les codes disponibles via API et les affiche */
export async function fetchAndRenderAvailableCodes() {
    if (!currentPlanId) return;
    unplacedList.innerHTML = '<p class="text-muted small p-3">Chargement...</p>'; // Indicateur de chargement
    try {
        const codes = await fetchAvailableCodes(currentPlanId);
        allAvailableCodes = codes; // Stocker localement
        console.log("Codes disponibles reçus:", codes.length);
        renderUnplacedCodes(allAvailableCodes);
    } catch (error) {
        console.error("Erreur chargement codes disponibles:", error);
        unplacedList.innerHTML = `<p class="text-danger small p-3">Erreur chargement: ${error.message}</p>`;
        showToast(`Erreur chargement codes: ${error.message}`, 'danger');
    }
}

/** Affiche les codes non placés dans la sidebar */
function renderUnplacedCodes(codesData) {
    if (!unplacedList || !unplacedCounter) {
        console.error("renderUnplacedCodes: Element 'unplacedList' ou 'unplacedCounter' non trouvé.");
        return;
    }

    unplacedList.innerHTML = ''; // Vide la liste actuelle

    // **** CORRECTION ICI ****
    // Le nombre total de codes disponibles est simplement la longueur du tableau reçu.
    const totalAvailableCount = codesData.length; 
    updateCounterElement(totalAvailableCount); // Met à jour le compteur global
    // **** FIN CORRECTION ****

    if (totalAvailableCount === 0) {
        unplacedList.innerHTML = '<li class="list-group-item text-muted small">Aucun code disponible pour ce plan.</li>';
        return;
    }

    codesData.sort((a, b) => a.code_geo.localeCompare(b.code_geo)); // Trier par code_geo

    codesData.forEach(code => {
        const listItem = document.createElement('a');
        listItem.href = '#';
        listItem.className = 'list-group-item list-group-item-action unplaced-item';
        listItem.dataset.id = code.id;
        listItem.dataset.codeGeo = code.code_geo; // Utiliser camelCase ou snake_case selon ce que l'API renvoie
        listItem.dataset.libelle = code.libelle;
        listItem.dataset.univers = code.univers;
        // Ajouter d'autres data-* si nécessaire (ex: commentaire)

        // Correction pour utiliser la couleur correcte
        const universColor = universColors[code.univers] || '#adb5bd'; // Gris par défaut

        listItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between align-items-center">
                <div class="code-details">
                    <strong class="mb-1 code-geo-text" style="color: ${universColor};">${code.code_geo}</strong>
                    <small class="d-block text-muted libelle-text">${code.libelle}</small>
                </div>
                <span class="badge rounded-pill" style="background-color: ${universColor}; color: white;">${code.univers}</span>
            </div>
        `;
        unplacedList.appendChild(listItem);
    });

    // Réappliquer le filtre après rendu initial (important si un filtre était déjà saisi)
    filterCodes(searchInput.value); 
    console.log(`${totalAvailableCount} codes disponibles rendus dans la sidebar.`);
}

/** Met à jour le texte du compteur global */
function updateCounterElement(count) {
    if (unplacedCounter) {
        unplacedCounter.textContent = count >= 0 ? count : 0; // Assurer >= 0
        console.log("Compteur global mis à jour:", unplacedCounter.textContent);
    }
}

/** Gère le clic sur un code dans la liste */
function handleCodeClick(event) {
    event.preventDefault();
    const targetItem = event.target.closest('.unplaced-item');
    if (!targetItem) return;

    // Supprimer 'active' des autres éléments
    clearSidebarSelection();

    // Ajouter 'active' à l'élément cliqué
    targetItem.classList.add('active');

    // Extraire les données du dataset
    const codeData = {
        id: targetItem.dataset.id,
        codeGeo: targetItem.dataset.codeGeo, // Assurer camelCase ici
        libelle: targetItem.dataset.libelle,
        univers: targetItem.dataset.univers,
        // Ajouter d'autres champs si stockés dans dataset
    };

    // Appeler le callback (défini dans main.js)
    if (onCodeSelectedCallback) {
        onCodeSelectedCallback(codeData);
    } else {
        console.warn("Sidebar: Callback 'onCodeSelected' non défini.");
    }
}

/** Désélectionne tout élément actif dans la liste */
export function clearSidebarSelection() {
    const activeItems = unplacedList.querySelectorAll('.unplaced-item.active');
    activeItems.forEach(item => item.classList.remove('active'));
}

/** Filtre la liste des codes affichés */
function filterCodes(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    const items = unplacedList.querySelectorAll('.unplaced-item');
    let visibleCount = 0;

    items.forEach(item => {
        // Ne considérer que les éléments actuellement visibles (non déjà placés)
        if (item.style.display !== 'none') {
            const codeGeo = item.dataset.codeGeo.toLowerCase();
            const libelle = item.dataset.libelle.toLowerCase();
            const univers = item.dataset.univers.toLowerCase();
            
            // Afficher si le terme est trouvé dans code, libellé ou univers ET si l'élément n'est pas caché car placé
            const isMatch = codeGeo.includes(term) || libelle.includes(term) || univers.includes(term);
            
            if (isMatch) {
                // Rendre visible SI il n'est pas déjà caché par 'updateCodeCountInSidebar'
                // Pour éviter de réafficher un code placé juste parce qu'il correspond au filtre
                // On se base sur le fait que updateCodeCountInSidebar met display='none'
                if (item.style.display !== 'none') {
                    item.hidden = false; // Utiliser 'hidden' pour le filtrage
                    visibleCount++;
                } else {
                    item.hidden = true; // S'il est caché par 'placement', il reste caché
                }
            } else {
                item.hidden = true; // Cacher s'il ne correspond pas au filtre
            }
        } else {
             item.hidden = true; // S'il est déjà caché (placé), il reste caché peu importe le filtre
        }
    });

    // Mettre à jour le compteur avec le nombre d'éléments *visibles après filtrage*
    // Note : Cela peut être déroutant. On pourrait choisir de toujours afficher le total *disponible*
    // updateCounterElement(visibleCount); 
    // Ou garder le total disponible (préférable) :
    // updateCounterElement(allAvailableCodes.length - (nombre_de_codes_places)); // Nécessiterait de suivre les codes placés
    // Simplification pour l'instant : le compteur affiche le total initialement disponible.
}

/**
 * Met à jour le compteur global et cache/réaffiche l'élément dans la sidebar.
 * @param {string|number} codeId L'ID du code géo.
 * @param {number} delta La variation du nombre de placements (+1 pour ajout, -N pour suppression multiple).
 */
export function updateCodeCountInSidebar(codeId, delta) {
    if (!unplacedCounter) return;

    try {
        // Mettre à jour le compteur global (Nombre de codes *disponibles*)
        const currentTotalText = unplacedCounter.textContent || '0';
        let currentTotal = parseInt(currentTotalText, 10);
        if (isNaN(currentTotal)) {
            // Si NaN, recalculer depuis la liste visible ? Non, risque d'être faux si filtré.
            // On se base sur l'idée que le compteur initial était correct.
            console.warn("Compteur sidebar était NaN, recalcul imprécis.");
            currentTotal = unplacedList.querySelectorAll('.unplaced-item:not([hidden]):not([style*="display: none"])').length || 0;
        }

        const newTotal = Math.max(0, currentTotal + delta); // Appliquer delta au total disponible
        updateCounterElement(newTotal);

        // Cacher/Réafficher l'élément dans la liste
        const listItem = unplacedList?.querySelector(`.unplaced-item[data-id="${codeId}"]`);
        if (listItem) {
             if (delta > 0) { // Si on a placé un tag
                listItem.style.display = 'none'; // Cacher l'élément de la liste des disponibles
                listItem.classList.remove('active');
                listItem.hidden = true; // Assurer qu'il est aussi caché pour le filtre
             } else if (delta < 0) { // Si on a supprimé un ou plusieurs tags
                // On le rend à nouveau disponible (visible)
                listItem.style.display = '';
                // On laisse filterCodes décider s'il doit être hidden ou non basé sur le terme de recherche
                filterCodes(searchInput.value);
             }
        } else {
             console.warn("updateCodeCountInSidebar: listItem non trouvé pour ID", codeId);
             // Si on supprime un code qui a été ajouté via le modal, il n'est pas dans la liste initiale.
             // On pourrait potentiellement le rajouter à allAvailableCodes et relancer render ? Ou ignorer.
             // Pour l'instant on ignore.
        }

    } catch (e) {
        console.error("Erreur mise à jour compteur sidebar:", e);
    }
}

/** Affiche la légende des univers */
function renderLegend() {
    if (!legendContainer || !universList) return;
    legendContainer.innerHTML = ''; // Vide la légende actuelle

    if (universList.length === 0) {
        legendContainer.innerHTML = '<p class="text-muted small">Aucun univers défini.</p>';
        return;
    }

    const list = document.createElement('ul');
    list.className = 'list-unstyled small';

    universList.forEach(univers => {
        const color = universColors[univers.nom] || '#adb5bd';
        const listItem = document.createElement('li');
        listItem.className = 'mb-1 d-flex align-items-center';
        listItem.innerHTML = `
            <span class="d-inline-block me-2" style="width: 12px; height: 12px; background-color: ${color}; border: 1px solid #666;"></span>
            ${univers.nom}
        `;
        list.appendChild(listItem);
    });

    legendContainer.appendChild(list);
    console.log("Légende mise à jour.");
}

/** Remplit le <select> des univers dans le modal d'ajout */
function populateUniversSelect() {
    if (!universSelectInModal || !universList) return;
    universSelectInModal.innerHTML = '<option value="" selected disabled>Choisir...</option>'; // Option par défaut

    universList.forEach(univers => {
        const option = document.createElement('option');
        option.value = univers.id;
        option.textContent = univers.nom;
        universSelectInModal.appendChild(option);
    });
}

/** Gère la sauvegarde d'un nouveau code géo depuis le modal */
async function handleSaveNewCode() {
    // Validation simple côté client
    const codeGeoInput = addCodeForm.querySelector('#new-code-geo');
    const libelleInput = addCodeForm.querySelector('#new-libelle');
    if (!codeGeoInput.value.trim() || !libelleInput.value.trim() || !universSelectInModal.value) {
        showToast("Veuillez remplir tous les champs obligatoires (Code Géo, Libellé, Univers).", "warning");
        return;
    }

    const formData = new FormData(addCodeForm);
    const codeData = Object.fromEntries(formData.entries());

    saveNewCodeBtn.disabled = true;
    saveNewCodeBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enregistrement...';

    try {
        const newCode = await saveNewGeoCode(codeData);
        showToast(`Code "${newCode.code_geo}" ajouté avec succès !`, "success");
        addCodeModal.hide();
        // Ajouter le nouveau code à la liste locale et réafficher
        allAvailableCodes.push(newCode);
        renderUnplacedCodes(allAvailableCodes); // Met à jour liste et compteur
    } catch (error) {
        console.error("Erreur ajout code géo:", error);
        showToast(`Erreur ajout code: ${error.message}`, "danger");
    } finally {
        saveNewCodeBtn.disabled = false;
        saveNewCodeBtn.textContent = 'Enregistrer';
    }
}
