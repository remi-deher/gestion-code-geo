// Fichier: public/js/modules/snapManager.js
/**
 * Gère le magnétisme (snapping) des objets à la grille et/ou aux autres objets.
 */

import { GRID_SIZE } from './config.js'; // Importer la taille de la grille

let canvasInstance = null;
let isSnapToGridEnabled = false; // État initial
let isSnapToObjectsEnabled = false; // État initial
const snapThreshold = 10; // Pixels de tolérance pour l'accroche aux objets

// --- NOUVEAU : Définition des couleurs pour le retour visuel ---
const DEFAULT_CORNER_COLOR = 'blue'; // Couleur par défaut (doit correspondre à canvasManager.js)
const SNAP_CORNER_COLOR = '#00ff00'; // Vert vif pour indiquer le magnétisme
// --- FIN NOUVEAU ---

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

    const objectSnapBtn = document.createElement('button');
    objectSnapBtn.id = 'snap-objects-btn';
    objectSnapBtn.className = 'btn btn-outline-secondary btn-sm';
    objectSnapBtn.title = 'Activer/Désactiver le magnétisme aux objets';
    objectSnapBtn.innerHTML = '<i class="bi bi-magnet"></i>';
    objectSnapBtn.addEventListener('click', toggleSnapToObjects);
    controlsContainer.appendChild(objectSnapBtn);

    toolbarElement.appendChild(controlsContainer);

    // --- Écouteurs Fabric pour l'accroche ---
    canvas.on('object:moving', handleObjectMoveSnap);
    
    // --- NOUVEAU : Réinitialiser la couleur au relâchement ---
    // S'assure que la couleur revient à la normale si on arrête de bouger
    canvas.on('object:moved', (options) => {
         if (options.target && options.target.cornerColor !== DEFAULT_CORNER_COLOR) {
            options.target.set({ cornerColor: DEFAULT_CORNER_COLOR });
        }
    });
    // --- FIN NOUVEAU ---


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
}

/**
 * Active/Désactive le magnétisme aux objets.
 */
function toggleSnapToObjects() {
    isSnapToObjectsEnabled = !isSnapToObjectsEnabled;
    const btn = document.getElementById('snap-objects-btn');
    if (btn) {
        btn.classList.toggle('active', isSnapToObjectsEnabled);
        btn.classList.toggle('btn-primary', isSnapToObjectsEnabled);
        btn.classList.toggle('btn-outline-secondary', !isSnapToObjectsEnabled);
        btn.title = isSnapToObjectsEnabled ? 'Désactiver le magnétisme aux objets' : 'Activer le magnétisme aux objets';
    }
    console.log("SnapManager: Magnétisme Objets", isSnapToObjectsEnabled ? "Activé" : "Désactivé");
}


/**
 * Fonction appelée lors du déplacement d'un objet pour gérer l'accroche.
 * @param {object} options - L'événement Fabric 'object:moving'.
 */
function handleObjectMoveSnap(options) {
    if (!canvasInstance) return;
    const target = options.target;

    // --- MODIFIÉ : Ajout de la gestion des couleurs ---

    // 1. Réinitialiser la couleur par défaut à chaque mouvement
    // (Sauf si elle est déjà verte à cause d'un snap précédent dans ce même mouvement)
    if (target.cornerColor !== SNAP_CORNER_COLOR) {
         target.set({ cornerColor: DEFAULT_CORNER_COLOR });
    }


    // 2. Logique de magnétisme à la grille (prioritaire)
    if (isSnapToGridEnabled) {
        // Accrocher l'origine de l'objet à la grille
        const left = Math.round(target.left / GRID_SIZE) * GRID_SIZE;
        const top = Math.round(target.top / GRID_SIZE) * GRID_SIZE;
        target.set({ left: left, top: top });
        
        // PAS de changement de couleur pour la grille, comme demandé
    }
    // 3. Logique de magnétisme aux objets (si grille désactivée)
    else if (isSnapToObjectsEnabled) {
        const snapZone = snapThreshold / canvasInstance.getZoom(); // Tolérance ajustée au zoom
        let snapX = false;
        let snapY = false;

        const targetCenter = target.getCenterPoint();
        const targetHalfWidth = target.getScaledWidth() / 2;
        const targetHalfHeight = target.getScaledHeight() / 2;
        
        // Coordonnées des lignes du target
        const targetLines = {
            v: [targetCenter.x - targetHalfWidth, targetCenter.x, targetCenter.x + targetHalfWidth], // Gauche, Centre, Droite
            h: [targetCenter.y - targetHalfHeight, targetCenter.y, targetCenter.y + targetHalfHeight]  // Haut, Centre, Bas
        };

        canvasInstance.forEachObject((obj) => {
            if (obj === target || obj.isGuide || !obj.visible) return; // Ne pas s'accrocher à soi-même, au guide ou aux objets cachés

            const objCenter = obj.getCenterPoint();
            const objHalfWidth = obj.getScaledWidth() / 2;
            const objHalfHeight = obj.getScaledHeight() / 2;

            // Coordonnées des lignes de l'objet statique
            const objLines = {
                v: [objCenter.x - objHalfWidth, objCenter.x, objCenter.x + objHalfWidth],
                h: [objCenter.y - objHalfHeight, objCenter.y, objCenter.y + objHalfHeight]
            };
            
            // Comparaison Lignes Verticales (pour magnétisme X)
            if (!snapX) {
                for (const tV of targetLines.v) {
                    for (const oV of objLines.v) {
                        if (Math.abs(tV - oV) <= snapZone) {
                            // Calculer le décalage pour s'aligner
                            const deltaX = oV - tV;
                            target.set({ left: target.left + deltaX });
                            snapX = true;
                            break;
                        }
                    }
                    if (snapX) break;
                }
            }

            // Comparaison Lignes Horizontales (pour magnétisme Y)
            if (!snapY) {
                for (const tH of targetLines.h) {
                    for (const oH of objLines.h) {
                        if (Math.abs(tH - oH) <= snapZone) {
                            // Calculer le décalage pour s'aligner
                            const deltaY = oH - tH;
                            target.set({ top: target.top + deltaY });
                            snapY = true;
                            break;
                        }
                    }
                    if (snapY) break;
                }
            }
            
            if (snapX && snapY) return; // Sortir tôt si on a déjà les deux
        });

        // 4. Appliquer le retour visuel SI un magnétisme aux objets a eu lieu
        if (snapX || snapY) {
            target.set({ cornerColor: SNAP_CORNER_COLOR });
        } else {
             target.set({ cornerColor: DEFAULT_CORNER_COLOR });
        }
    }
    // --- FIN MODIFICATION ---
}
