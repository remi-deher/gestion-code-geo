/**
 * Module pour la gestion de la sidebar (liste des codes disponibles, filtres, légende, compteurs).
 * CORRECTIONS: Compteurs individuels, placement multiple, compteur global = types de codes, comptage initial robuste.
 */
import { fetchAvailableCodes, saveNewGeoCode } from '../modules/api.js';
import { showToast } from '../modules/utils.js';

let currentPlanId = null;
let universList = [];
let universColors = {};
let onCodeSelectedCallback = null; // Fonction à appeler quand un code est sélectionné pour placement

let unplacedList;
let unplacedCounter; // Compteur global (nombre de types de codes)
let searchInput;
let legendContainer;
let addCodeBtn;
let addCodeModal;
let addCodeForm;
let saveNewCodeBtn;
let universSelectInModal;

let allAvailableCodes = []; // Garder une copie locale pour filtrer et accéder aux données

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
    // Vérifier l'existence avant d'instancier le modal
    const modalElement = document.getElementById('add-code-modal');
    addCodeModal = modalElement ? new bootstrap.Modal(modalElement) : null;
    addCodeForm = document.getElementById('add-code-form');
    saveNewCodeBtn = document.getElementById('save-new-code-btn');
    universSelectInModal = document.getElementById('new-univers-id');

    // Vérification plus robuste des éléments
    if (!unplacedList || !unplacedCounter || !searchInput || !legendContainer || !addCodeBtn || !addCodeModal || !addCodeForm || !saveNewCodeBtn || !universSelectInModal) {
        console.warn("Sidebar: Un ou plusieurs éléments DOM sont manquants. Certaines fonctionnalités peuvent être désactivées.", {
            unplacedList: !!unplacedList, unplacedCounter: !!unplacedCounter, searchInput: !!searchInput,
            legendContainer: !!legendContainer, addCodeBtn: !!addCodeBtn, addCodeModal: !!addCodeModal,
            addCodeForm: !!addCodeForm, saveNewCodeBtn: !!saveNewCodeBtn, universSelectInModal: !!universSelectInModal
        });
        // Ne pas retourner complètement, certaines parties peuvent encore fonctionner
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
    if (unplacedList) unplacedList.addEventListener('click', handleCodeClick);

    // Filtrage en temps réel
    if (searchInput) searchInput.addEventListener('input', () => filterCodes(searchInput.value));

    // Bouton "+" pour ajouter un code
    if (addCodeBtn) addCodeBtn.addEventListener('click', () => {
        if (addCodeForm) addCodeForm.reset(); // Vider le formulaire
        if (addCodeModal) addCodeModal.show();
    });

    // Bouton "Enregistrer" dans le modal
    if (saveNewCodeBtn) saveNewCodeBtn.addEventListener('click', handleSaveNewCode);
}

/** Récupère les codes disponibles via API et les affiche */
export async function fetchAndRenderAvailableCodes() {
    if (!currentPlanId || !unplacedList) return;
    unplacedList.innerHTML = '<p class="text-muted small p-3">Chargement...</p>'; // Indicateur de chargement
    try {
        // L'API getAvailableCodesForPlan renvoie les codes SANS leur compte de placement actuel.
        // Nous devons le calculer côté client en utilisant planData.placedGeoCodes.
        const codes = await fetchAvailableCodes(currentPlanId);

        // --- CORRECTION CALCUL COMPTE INITIAL ---
        const placedCounts = {};
        console.log("Calcul des compteurs initiaux. currentPlanId:", currentPlanId);
        if (window.planData && window.planData.placedGeoCodes && Array.isArray(window.planData.placedGeoCodes)) {
            // Log un échantillon pour voir la structure exacte
            console.log("Données placedGeoCodes (échantillon):", JSON.stringify(window.planData.placedGeoCodes.slice(0, 2)));

            window.planData.placedGeoCodes.forEach(placedCode => {
                // placedCode = { id: XXX, code_geo: 'ABC', ..., placements: [...] }
                const geoCodeId = placedCode.id; // ID du code géo

                if (!geoCodeId) {
                    console.warn("Compteur initial: geoCodeId manquant dans placedCode:", placedCode);
                    return; // Passe au suivant si pas d'ID
                }

                if (placedCode.placements && Array.isArray(placedCode.placements)) {
                    placedCode.placements.forEach(placement => {
                        // placement = { position_id: YYY, plan_id: ZZZ, ... }
                        // Comparaison non stricte pour plan_id
                        if (placement && placement.plan_id == currentPlanId) {
                            // Incrémenter le compteur pour ce geoCodeId
                            placedCounts[geoCodeId] = (placedCounts[geoCodeId] || 0) + 1;
                            // Log plus précis
                             console.log(`Compteur pour code ID ${geoCodeId} (${placedCode.code_geo || placedCode.codeGeo}) incrémenté. Total: ${placedCounts[geoCodeId]}`);
                        }
                    });
                }
                // else { // Pas une erreur si un code n'a pas de placement sur CE plan
                //    console.log(`Aucun placement trouvé pour le code ID ${geoCodeId} sur ce plan.`);
                //}
            });
        } else {
             console.log("Aucune donnée 'placedGeoCodes' valide trouvée pour le comptage initial.");
        }
        console.log("Compteurs initiaux calculés:", placedCounts);
        // --- FIN CORRECTION ---

        // Ajouter le compte initial aux données des codes
        allAvailableCodes = codes.map(code => ({
            ...code,
            // Utiliser le compte calculé ou 0 par défaut
            current_placement_count: placedCounts[code.id] || 0
        }));

        console.log("Codes disponibles reçus et comptes initiaux appliqués:", allAvailableCodes.length);
        renderUnplacedCodes(allAvailableCodes); // Appelle render qui utilise current_placement_count

    } catch (error) {
        console.error("Erreur chargement codes disponibles:", error);
        if (unplacedList) unplacedList.innerHTML = `<p class="text-danger small p-3">Erreur chargement: ${error.message}</p>`;
        showToast(`Erreur chargement codes: ${error.message}`, 'danger');
    }
}


/** Affiche les codes disponibles dans la sidebar */
function renderUnplacedCodes(codesData) {
    if (!unplacedList || !unplacedCounter) {
        console.error("renderUnplacedCodes: Element 'unplacedList' ou 'unplacedCounter' non trouvé.");
        return;
    }

    unplacedList.innerHTML = ''; // Vide la liste actuelle

    // Le compteur global indique le nombre de *types* de codes disponibles
    const totalTypesCount = codesData.length;
    updateCounterElement(totalTypesCount); // Met à jour le compteur global

    if (totalTypesCount === 0) {
        unplacedList.innerHTML = '<li class="list-group-item text-muted small">Aucun code disponible pour ce plan.</li>';
        return;
    }

    codesData.sort((a, b) => (a.code_geo || a.codeGeo).localeCompare(b.code_geo || b.codeGeo)); // Trier par code_geo

    codesData.forEach(code => {
        const listItem = document.createElement('a');
        listItem.href = '#';
        // Garder 'unplaced-item' même s'il est déjà placé, pour la sélection
        listItem.className = 'list-group-item list-group-item-action unplaced-item';
        listItem.dataset.id = code.id;
        // Stocker les deux formats au cas où
        listItem.dataset.codeGeo = code.code_geo || code.codeGeo;
        listItem.dataset.code_geo = code.code_geo || code.codeGeo; // Conserver aussi snake_case si utile ailleurs
        listItem.dataset.libelle = code.libelle;
        listItem.dataset.univers = code.univers;
        // Stocker le compte initial
        listItem.dataset.placementCount = code.current_placement_count || 0;

        const universColor = universColors[code.univers] || '#adb5bd'; // Gris par défaut
        const placementCount = code.current_placement_count || 0;

        listItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between align-items-center">
                <div class="code-details flex-grow-1 me-2">
                    <strong class="mb-1 code-geo-text" style="color: ${universColor};">${listItem.dataset.codeGeo}</strong>
                    <small class="d-block text-muted libelle-text">${code.libelle}</small>
                </div>
                <span class="badge bg-secondary rounded-pill me-2 placement-count" title="Nombre de fois placé sur ce plan">${placementCount}</span>
                <span class="badge rounded-pill text-truncate" style="background-color: ${universColor}; color: white; max-width: 80px;" title="${code.univers}">${code.univers}</span>
            </div>
        `;
        unplacedList.appendChild(listItem);
    });

    // Réappliquer le filtre après rendu initial
    if (searchInput) filterCodes(searchInput.value);
    console.log(`${totalTypesCount} types de codes rendus dans la sidebar.`);
}

/** Met à jour le texte du compteur global (nombre de types de codes) */
function updateCounterElement(count) {
    if (unplacedCounter) {
        unplacedCounter.textContent = count >= 0 ? count : 0; // Assurer >= 0
        // console.log("Compteur global (types de codes) mis à jour:", unplacedCounter.textContent);
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

    // Extraire les données du dataset (utiliser codeGeo pour la cohérence JS)
    const codeData = {
        id: targetItem.dataset.id,
        codeGeo: targetItem.dataset.codeGeo,
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
    if (!unplacedList) return;
    const activeItems = unplacedList.querySelectorAll('.unplaced-item.active');
    activeItems.forEach(item => item.classList.remove('active'));
}

/** Filtre la liste des codes affichés */
function filterCodes(searchTerm) {
    if (!unplacedList) return;
    const term = searchTerm.toLowerCase().trim();
    const items = unplacedList.querySelectorAll('.unplaced-item');

    items.forEach(item => {
        const codeGeo = (item.dataset.codeGeo || '').toLowerCase();
        const libelle = (item.dataset.libelle || '').toLowerCase();
        const univers = (item.dataset.univers || '').toLowerCase();

        // Afficher si le terme est trouvé dans code, libellé ou univers
        const isMatch = codeGeo.includes(term) || libelle.includes(term) || univers.includes(term);
        item.hidden = !isMatch; // Utiliser 'hidden' pour le filtrage simple
    });
}

/**
 * Met à jour le compteur individuel d'un code spécifique dans la sidebar.
 * NE CACHE PLUS L'ÉLÉMENT. Met à jour le compteur individuel.
 * @param {string|number} codeId L'ID du code géo.
 * @param {number} delta La variation du nombre de placements (+1 pour ajout, -N pour suppression multiple).
 */
export function updateCodeCountInSidebar(codeId, delta) {
    if (!unplacedList) return;

    try {
        const listItem = unplacedList.querySelector(`.unplaced-item[data-id="${codeId}"]`);
        if (listItem) {
            const countSpan = listItem.querySelector('.placement-count');
            if (countSpan) {
                const currentCountText = countSpan.textContent || '0';
                let currentCount = parseInt(currentCountText, 10);
                if (isNaN(currentCount)) currentCount = 0;

                const newCount = Math.max(0, currentCount + delta); // Empêche les compteurs négatifs
                countSpan.textContent = newCount;
                listItem.dataset.placementCount = newCount; // Mettre à jour aussi le dataset
                console.log(`Compteur individuel pour ${listItem.dataset.codeGeo} (${codeId}) mis à jour: ${newCount} (Delta: ${delta})`);
            } else {
                 console.warn("updateCodeCountInSidebar: Span compteur non trouvé pour ID", codeId);
            }
             // On ne cache plus l'élément
             // On s'assure qu'il n'est pas 'hidden' à cause d'un filtre
             if (searchInput) filterCodes(searchInput.value); // Réappliquer le filtre pour assurer la visibilité correcte

        } else {
             console.warn("updateCodeCountInSidebar: listItem non trouvé pour ID", codeId);
             // Cas où un code ajouté via modal est supprimé : il n'est pas dans la liste initiale.
             // On pourrait le recréer ou ignorer. Pour l'instant, on ignore.
             // Le compteur global (types) ne change pas ici.
        }

    } catch (e) {
        console.error("Erreur mise à jour compteur individuel sidebar:", e);
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

    // Trier les univers par nom pour la légende
    const sortedUniversList = [...universList].sort((a, b) => a.nom.localeCompare(b.nom));

    sortedUniversList.forEach(univers => {
        const color = universColors[univers.nom] || '#adb5bd';
        const listItem = document.createElement('li');
        listItem.className = 'mb-1 d-flex align-items-center';
        listItem.innerHTML = `
            <span class="d-inline-block me-2" style="width: 12px; height: 12px; background-color: ${color}; border: 1px solid #666; flex-shrink: 0;"></span>
            <span class="text-truncate" title="${univers.nom}">${univers.nom}</span>
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

    // Trier pour le select aussi
    const sortedUniversList = [...universList].sort((a, b) => a.nom.localeCompare(b.nom));

    sortedUniversList.forEach(univers => {
        const option = document.createElement('option');
        option.value = univers.id;
        option.textContent = univers.nom;
        universSelectInModal.appendChild(option);
    });
}

/** Gère la sauvegarde d'un nouveau code géo depuis le modal */
async function handleSaveNewCode() {
    if (!addCodeForm || !saveNewCodeBtn || !addCodeModal) return;

    // Validation simple côté client
    const codeGeoInput = addCodeForm.querySelector('#new-code-geo');
    const libelleInput = addCodeForm.querySelector('#new-libelle');
    if (!codeGeoInput || !libelleInput || !universSelectInModal || !codeGeoInput.value.trim() || !libelleInput.value.trim() || !universSelectInModal.value) {
        showToast("Veuillez remplir tous les champs obligatoires (Code Géo, Libellé, Univers).", "warning");
        return;
    }

    const formData = new FormData(addCodeForm);
    const codeData = Object.fromEntries(formData.entries());

    saveNewCodeBtn.disabled = true;
    saveNewCodeBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enregistrement...';

    try {
        const newCode = await saveNewGeoCode(codeData); // API devrait retourner le nouveau code complet
        showToast(`Code "${newCode.code_geo || newCode.codeGeo}" ajouté avec succès !`, "success");
        addCodeModal.hide();

        // Ajouter le nouveau code à la liste locale avec un compte de 0
        const newCodeWithCount = {
            ...newCode,
            current_placement_count: 0,
            // S'assurer que les propriétés attendues par render existent (univers.nom)
             univers: universList.find(u => u.id == newCode.univers_id)?.nom || 'Inconnu'
        };
        allAvailableCodes.push(newCodeWithCount);

        // Réafficher la liste complète avec le nouveau code
        renderUnplacedCodes(allAvailableCodes);

    } catch (error) {
        console.error("Erreur ajout code géo:", error);
        showToast(`Erreur ajout code: ${error.message}`, "danger");
    } finally {
        saveNewCodeBtn.disabled = false;
        saveNewCodeBtn.textContent = 'Enregistrer';
    }
}
