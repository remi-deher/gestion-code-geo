/**
 * Module pour la gestion des éléments généraux de l'interface utilisateur de l'éditeur de plan
 * (hors canvas principal, sidebar et outils de dessin spécifiques).
 * Gère: Fullscreen, boutons Zoom, toggle Sidebar, Modal ajout code.
 */
import { zoom, resetZoom } from './canvas.js';
// Note: La sauvegarde du nouveau code est maintenant gérée dans sidebar.js via l'API

let fullscreenBtn;
let zoomInBtn, zoomOutBtn, zoomResetBtn;
let toggleSidebarBtn;
let planPageContainer;

/**
 * Initialise les éléments et écouteurs d'événements de l'UI générale.
 */
export function initializeUI() {
    fullscreenBtn = document.getElementById('fullscreen-btn');
    zoomInBtn = document.getElementById('zoom-in-btn');
    zoomOutBtn = document.getElementById('zoom-out-btn');
    zoomResetBtn = document.getElementById('zoom-reset-btn');
    toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    planPageContainer = document.querySelector('.plan-page-container'); // Conteneur global

    addEventListeners();
    console.log("Module UI initialisé.");
}

/** Ajoute les écouteurs pour les boutons de l'UI */
function addEventListeners() {
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => zoom(1.2));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => zoom(0.8));
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoom);
    if (toggleSidebarBtn) toggleSidebarBtn.addEventListener('click', toggleSidebar);

    // Écouteur pour sortir du mode plein écran avec la touche Echap
    document.addEventListener('fullscreenchange', handleFullscreenChange);
}

/** Active/désactive le mode plein écran pour le conteneur principal */
function toggleFullscreen() {
    if (!planPageContainer) return;

    if (!document.fullscreenElement) {
        planPageContainer.requestFullscreen()
            .catch(err => console.error(`Erreur passage plein écran: ${err.message}`));
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
    // La mise à jour de l'icône et le resize sont gérés par handleFullscreenChange
}

/** Met à jour l'icône du bouton plein écran lors d'un changement d'état */
function handleFullscreenChange() {
    if (!fullscreenBtn) return;
    const icon = fullscreenBtn.querySelector('i');
    if (document.fullscreenElement) {
        icon.classList.remove('bi-arrows-fullscreen');
        icon.classList.add('bi-arrows-angle-contract');
        fullscreenBtn.title = "Quitter le plein écran";
    } else {
        icon.classList.add('bi-arrows-fullscreen');
        icon.classList.remove('bi-arrows-angle-contract');
        fullscreenBtn.title = "Plein écran";
    }
    // Redimensionner le canvas après un délai pour laisser le temps au navigateur
    //setTimeout(resizeCanvas, 300); // resizeCanvas est dans canvas.js, appelé par main.js si besoin
}

/** Affiche/cache la sidebar */
function toggleSidebar() {
    planPageContainer?.classList.toggle('sidebar-hidden');
    // Le style CSS gère l'animation et le déplacement du bouton/icône
}
