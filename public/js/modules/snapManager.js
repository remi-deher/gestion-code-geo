// Fichier: public/js/modules/snapManager.js
/**
 * Gère le magnétisme (snapping) des objets à la grille et/ou aux autres objets.
 */

import { GRID_SIZE } from './config.js'; // Importer la taille de la grille

let canvasInstance = null;
let isSnapToGridEnabled = false; // État initial
let isSnapToObjectsEnabled = false; // État initial
const snapThreshold = 10; // Pixels de tolérance pour l'accroche aux objets

/**
 * Initialise les contrôles et la logique du magnétisme.
 * @param {HTMLElement} toolbarElement - La barre d'outils pour les boutons.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 */
export function setupSnapping(toolbarElement, canvas) {
    canvasInstance = canvas;

    // --- Ajouter des boutons à la toolbar ---
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'd-inline-flex align-items-center gap-1 border-start ps-2 ms-1';

    const gridSnapBtn = document.createElement('button');
    gridSnapBtn.id = 'snap-grid-btn';
    gridSnapBtn.className = 'btn btn-outline-secondary btn-sm';
    gridSnapBtn.title = 'Activer/Désactiver le magnétisme à la grille';
    gridSnapBtn.innerHTML = '<i class="bi bi-grid-3x3-gap"></i>';
    gridSnapBtn.addEventListener('click', toggleSnapToGrid);
    controlsContainer.appendChild(gridSnapBtn);

    // TODO: Ajouter un bouton pour snap aux objets (isSnapToObjectsEnabled) si besoin

    toolbarElement.appendChild(controlsContainer);

    // --- Écouteurs Fabric pour l'accroche ---
    canvas.on('object:moving', handleObjectMoveSnap);
    // Optionnel: Gérer aussi 'object:scaling' pour accrocher pendant redimensionnement

    console.log("SnapManager: Initialisé.");
}

/**
 * Active/Désactive le magnétisme à la grille.
 */
function toggleSnapToGrid() {
    isSnapToGridEnabled = !isSnapToGridEnabled;
    const btn = document.getElementById('snap-grid-btn');
    if (btn) {
        btn.classList.toggle('active', isSnapToGridEnabled);
        btn.classList.toggle('btn-primary', isSnapToGridEnabled);
        btn.classList.toggle('btn-outline-secondary', !isSnapToGridEnabled);
        btn.title = isSnapToGridEnabled ? 'Désactiver le magnétisme à la grille' : 'Activer le magnétisme à la grille';
    }
    console.log("SnapManager: Magnétisme Grille", isSnapToGridEnabled ? "Activé" : "Désactivé");
     // Redessiner la grille si elle est dynamique
     // drawGrid();
}

/**
 * Fonction appelée lors du déplacement d'un objet pour gérer l'accroche.
 * @param {object} options - L'événement Fabric 'object:moving'.
 */
function handleObjectMoveSnap(options) {
    if (!canvasInstance) return;
    const target = options.target;

    if (isSnapToGridEnabled) {
        // Accrocher l'origine de l'objet à la grille
        // Attention: l'origine (originX/Y) affecte le point qui s'accroche
        const left = Math.round(target.left / GRID_SIZE) * GRID_SIZE;
        const top = Math.round(target.top / GRID_SIZE) * GRID_SIZE;

        // Calculer le décalage dû à l'origine (si ce n'est pas top/left)
        // Fabric le fait automatiquement si l'origine est bien définie,
        // mais on peut le forcer si besoin.
        // const point = target.getPointByOrigin(target.originX, target.originY);
        // const offsetX = point.x - target.left;
        // const offsetY = point.y - target.top;
        // target.set({ left: left - offsetX, top: top - offsetY });

        target.set({ left: left, top: top });
    }

    if (isSnapToObjectsEnabled) {
        // Logique plus complexe:
        // 1. Itérer sur tous les autres objets (canvas.getObjects())
        // 2. Calculer les positions des bords/centres de 'target' et des autres objets
        // 3. Si un bord/centre de 'target' est proche (snapThreshold) d'un bord/centre d'un autre objet:
        //    a. Ajuster la position de 'target' (target.set({ left: ..., top: ... }))
        //    b. Optionnel: Afficher des lignes guides temporaires
        // Note: Cette logique peut devenir coûteuse en performances avec beaucoup d'objets.
    }
}

// Optionnel: Fonction pour dessiner une grille visuelle
// function drawGrid() { ... }
