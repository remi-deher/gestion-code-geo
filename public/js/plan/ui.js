/**
 * Module pour la gestion des interactions UI générales (hors canvas/sidebar).
 * Gère le basculement de la sidebar et le mode plein écran.
 */

/**
 * Initialise les écouteurs d'événements pour l'UI générale.
 */
export function initializeUI() {
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const planPageContainer = document.querySelector('.plan-page-container');

    if (toggleSidebarBtn && planPageContainer) {
        toggleSidebarBtn.addEventListener('click', () => {
            planPageContainer.classList.toggle('sidebar-collapsed');
            
            // Mettre à jour l'icône du bouton
            const icon = toggleSidebarBtn.querySelector('i');
            if (icon) {
                icon.classList.toggle('bi-chevron-left');
                icon.classList.toggle('bi-chevron-right');
            }
            
            // Redimensionner le canvas après l'animation (si besoin)
            setTimeout(() => {
                // On pourrait appeler resizeCanvas() ici, mais c'est géré par
                // un ResizeObserver dans main.js ou un listener window.resize
                // Pour l'instant, on suppose que le CSS gère le redimensionnement.
                // Si le canvas ne se redimensionne pas, il faut appeler:
                // import { resizeCanvas } from './canvas.js'; resizeCanvas();
            }, 300); // 300ms = durée de transition CSS
        });
    }

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullScreen);
    }
    
    // Écouteur pour sortir du plein écran (touche Échap)
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    document.addEventListener('mozfullscreenchange', handleFullScreenChange);
    document.addEventListener('MSFullscreenChange', handleFullScreenChange);

    console.log("UI (sidebar toggle, fullscreen) initialisée.");
}

/**
 * Bascule le mode plein écran pour le conteneur principal de la page.
 */
function toggleFullScreen() {
    const docElement = document.documentElement;
    const fullscreenBtnIcon = document.getElementById('fullscreen-btn')?.querySelector('i');

    if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        // Entrer en plein écran
        if (docElement.requestFullscreen) {
            docElement.requestFullscreen();
        } else if (docElement.msRequestFullscreen) {
            docElement.msRequestFullscreen();
        } else if (docElement.mozRequestFullScreen) {
            docElement.mozRequestFullScreen();
        } else if (docElement.webkitRequestFullscreen) {
            docElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
        if (fullscreenBtnIcon) {
            fullscreenBtnIcon.classList.remove('bi-arrows-fullscreen');
            fullscreenBtnIcon.classList.add('bi-fullscreen-exit');
        }
    } else {
        // Sortir du plein écran
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
         if (fullscreenBtnIcon) {
            fullscreenBtnIcon.classList.remove('bi-fullscreen-exit');
            fullscreenBtnIcon.classList.add('bi-arrows-fullscreen');
        }
    }
}

/**
 * Met à jour l'icône du bouton plein écran lorsque l'état change (ex: touche Échap).
 */
function handleFullScreenChange() {
    const fullscreenBtnIcon = document.getElementById('fullscreen-btn')?.querySelector('i');
    if (!fullscreenBtnIcon) return;

    if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        // On n'est PLUS en plein écran
        fullscreenBtnIcon.classList.remove('bi-fullscreen-exit');
        fullscreenBtnIcon.classList.add('bi-arrows-fullscreen');
    } else {
        // On EST en plein écran
        fullscreenBtnIcon.classList.remove('bi-arrows-fullscreen');
        fullscreenBtnIcon.classList.add('bi-fullscreen-exit');
    }
}
