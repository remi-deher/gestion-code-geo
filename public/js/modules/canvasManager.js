// Fichier: public/js/modules/canvasManager.js
/**
 * Gère l'instance du canvas Fabric.js, son initialisation et son redimensionnement.
 */
class CanvasManager {
    /**
     * @param {HTMLCanvasElement|string} canvasEl - L'élément canvas HTML ou son ID.
     * @param {HTMLElement|string} wrapperEl - L'élément conteneur du canvas ou son ID.
     */
    constructor(canvasEl, wrapperEl) {
        this.canvasEl = typeof canvasEl === 'string' ? document.getElementById(canvasEl) : canvasEl;
        this.wrapperEl = typeof wrapperEl === 'string' ? document.getElementById(wrapperEl) : wrapperEl;
        this.canvas = null; // L'instance de fabric.Canvas
        this._resizeTimeout = null; // Pour stocker la référence du timeout debounce

        if (!this.canvasEl || !this.wrapperEl) {
            throw new Error("Élément canvas ou conteneur wrapper introuvable.");
        }

        // Garder une référence à la fonction de redimensionnement liée (debounced)
        this._boundResizeCanvas = this.debounce(this.resizeCanvas.bind(this), 100); // Ajout debounce
    }

    /**
     * Initialise le canvas Fabric.js.
     */
    initializeCanvas() {
        console.log("CanvasManager: Initialisation de Fabric.js...");
        this.canvas = new fabric.Canvas(this.canvasEl, {
             preserveObjectStacking: true,
             // objectCaching: false, // Optionnel : Désactiver si problèmes de rendu
        });

        // Fonction pour le redimensionnement initial avec retry
        const initialResize = () => {
            console.log("CanvasManager: Tentative de redimensionnement initial...");
            if (this.resizeCanvas()) { // resizeCanvas retourne true si succès
                // S'assurer que le décalage est bien calculé APRES stabilisation
                // L'appel à calcOffset est déjà dans resizeCanvas, mais on s'assure d'un rendu final
                this.canvas.renderAll();
                console.log("CanvasManager: Redimensionnement initial et offset OK.");
            } else {
                 // Si les dimensions étaient 0, réessayer après un délai plus long
                 console.warn("CanvasManager: Dimensions initiales invalides, nouvelle tentative...");
                 setTimeout(initialResize, 150); // Réessayer après 150ms
            }
        };
        // Lancer la première tentative après un délai initial
        setTimeout(initialResize, 50); // Délai initial de 50ms

        // Écouter les redimensionnements de la fenêtre pour adapter le canvas (avec debounce)
        window.addEventListener('resize', this._boundResizeCanvas);

        console.log("CanvasManager: Fabric.js initialisé, attente redimensionnement initial.");

        // --- Configuration initiale Fabric ---
        fabric.Object.prototype.transparentCorners = false;
        fabric.Object.prototype.cornerColor = 'blue';
        fabric.Object.prototype.cornerStyle = 'circle';
        fabric.Object.prototype.borderColor = 'blue';
        fabric.Object.prototype.borderScaleFactor = 2;

        return this.canvas;
    }

    /**
     * Redimensionne le canvas Fabric pour remplir son conteneur.
     * Appelle calcOffset() pour mettre à jour les coordonnées internes.
     * @returns {boolean} True si le redimensionnement a été effectué, false si dimensions invalides.
     */
    resizeCanvas() {
        if (!this.canvas || !this.wrapperEl) return false;

        const width = this.wrapperEl.offsetWidth;
        const height = this.wrapperEl.offsetHeight;

        // Vérifier si les dimensions sont valides
        if (width > 0 && height > 0) {
            const currentWidth = this.canvas.getWidth();
            const currentHeight = this.canvas.getHeight();

            // Appliquer seulement si la taille a réellement changé
            if (currentWidth !== width || currentHeight !== height) {
                this.canvas.setWidth(width);
                this.canvas.setHeight(height);
                console.log(`CanvasManager: Canvas redimensionné à ${width}x${height}`);
            }
            // Toujours recalculer l'offset car la position peut avoir changé
            this.canvas.calcOffset();
            this.canvas.renderAll();
            return true; // Succès
        } else {
             console.warn(`CanvasManager: Tentative de redimensionnement avec dimensions invalides (${width}x${height}). Reporté.`);
             return false; // Échec
        }
    }

    /**
     * Retourne l'instance du canvas Fabric.js.
     * @returns {fabric.Canvas} L'instance du canvas.
     */
    getCanvas() {
        if (!this.canvas) {
            throw new Error("Canvas non initialisé. Appelez initializeCanvas() d'abord.");
        }
        return this.canvas;
    }

    /**
     * Nettoie les écouteurs d'événements lors de la destruction.
     */
    dispose() {
        window.removeEventListener('resize', this._boundResizeCanvas);
        // Annuler tout timeout potentiel de debounce
        if (this._resizeTimeout) clearTimeout(this._resizeTimeout);
        this._resizeTimeout = null; // Réinitialiser la référence

        if (this.canvas) {
            this.canvas.dispose();
            this.canvas = null;
            console.log("CanvasManager: Canvas détruit et écouteurs nettoyés.");
        }
    }

     /**
     * Fonction utilitaire Debounce pour limiter les appels de resize.
     * @param {function} func - La fonction à appeler.
     * @param {number} wait - Le délai en ms.
     * @returns {function} La fonction "debounced".
     */
     debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                // Réinitialiser la référence avant d'appeler func
                this._resizeTimeout = null;
                func.apply(this, args);
            }, wait);
             this._resizeTimeout = timeout; // Stocker la référence
        };
    }
}

// Exporter la classe pour qu'elle puisse être importée ailleurs
export default CanvasManager;
