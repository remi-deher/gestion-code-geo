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

/**
 * Affiche un indicateur de chargement simple (à adapter si nécessaire).
 * @param {string} message - Message facultatif à afficher.
 */
export function showLoading(message = "Chargement...") {
    // Créez ou sélectionnez un élément pour l'indicateur
    let loader = document.getElementById('global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        // Style basique - vous devriez le styliser via CSS
        loader.style.position = 'fixed';
        loader.style.top = '50%';
        loader.style.left = '50%';
        loader.style.transform = 'translate(-50%, -50%)';
        loader.style.padding = '20px';
        loader.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        loader.style.color = 'white';
        loader.style.borderRadius = '5px';
        loader.style.zIndex = '9999';
        document.body.appendChild(loader);
    }
    loader.textContent = message;
    loader.style.display = 'block';
    console.log("Showing Loading:", message); // For debugging
}

/**
 * Masque l'indicateur de chargement.
 */
export function hideLoading() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.display = 'none';
    }
    console.log("Hiding Loading"); // For debugging
}
