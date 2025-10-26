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

        if (!this.canvasEl || !this.wrapperEl) {
            throw new Error("Élément canvas ou conteneur wrapper introuvable.");
        }

        // Garder une référence à la fonction de redimensionnement liée
        this._boundResizeCanvas = this.resizeCanvas.bind(this);
    }

    /**
     * Initialise le canvas Fabric.js.
     */
    initializeCanvas() {
        console.log("CanvasManager: Initialisation de Fabric.js...");
        this.canvas = new fabric.Canvas(this.canvasEl, {
            // Options initiales si nécessaire (ex: backgroundColor)
             // backgroundColor: '#ffffff', // Fond blanc pour commencer
             preserveObjectStacking: true, // Important pour la gestion des calques/superpositions
        });

        // Adapter la taille du canvas à son conteneur initialement
	setTimeout(() => this.resizeCanvas(), 10);

        // Écouter les redimensionnements de la fenêtre pour adapter le canvas
        window.addEventListener('resize', this._boundResizeCanvas);

        console.log("CanvasManager: Fabric.js initialisé.");

        // --- Configuration initiale Fabric (peut être étendue) ---
        fabric.Object.prototype.transparentCorners = false;
        fabric.Object.prototype.cornerColor = 'blue';
        fabric.Object.prototype.cornerStyle = 'circle';
        fabric.Object.prototype.borderColor = 'blue';
        fabric.Object.prototype.borderScaleFactor = 2; // Épaisseur bordure sélection

         // Activer le snap-to-grid (optionnel, à configurer plus tard)
         // this.enableGridSnapping();

         // Activer le pan (déplacement) avec Alt+Click (optionnel)
         // this.enablePanning();

        return this.canvas;
    }

    /**
     * Redimensionne le canvas Fabric pour remplir son conteneur.
     */
    resizeCanvas() {
        if (!this.canvas || !this.wrapperEl) return;

        const width = this.wrapperEl.offsetWidth;
        const height = this.wrapperEl.offsetHeight;

        this.canvas.setWidth(width);
        this.canvas.setHeight(height);
        this.canvas.calcOffset(); // Recalcule la position du canvas sur la page
        this.canvas.renderAll(); // Redessine le canvas
        console.log(`CanvasManager: Canvas redimensionné à ${width}x${height}`);
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
        if (this.canvas) {
            this.canvas.dispose(); // Méthode de nettoyage de Fabric.js
            this.canvas = null;
            console.log("CanvasManager: Canvas détruit et écouteurs nettoyés.");
        }
    }

    // --- Méthodes optionnelles (à décommenter et implémenter si besoin) ---

    /*
    enableGridSnapping() {
        const gridSize = 20; // Taille de la grille en pixels
        this.canvas.on('object:moving', (options) => {
            const target = options.target;
            target.set({
                left: Math.round(target.left / gridSize) * gridSize,
                top: Math.round(target.top / gridSize) * gridSize
            });
        });
        console.log("CanvasManager: Snap-to-grid activé.");
    }

    enablePanning() {
        let isPanning = false;
        let lastPosX, lastPosY;

        this.canvas.on('mouse:down', (opt) => {
            const evt = opt.e;
            if (evt.altKey === true) {
                isPanning = true;
                this.canvas.selection = false; // Désactiver la sélection pendant le pan
                lastPosX = evt.clientX;
                lastPosY = evt.clientY;
                this.canvas.setCursor('grab');
            }
        });

        this.canvas.on('mouse:move', (opt) => {
            if (isPanning) {
                const e = opt.e;
                const vpt = this.canvas.viewportTransform;
                if (vpt) { // Vérifier si viewportTransform est défini
                    vpt[4] += e.clientX - lastPosX;
                    vpt[5] += e.clientY - lastPosY;
                    this.canvas.requestRenderAll();
                    lastPosX = e.clientX;
                    lastPosY = e.clientY;
                }
            }
        });

        this.canvas.on('mouse:up', () => {
            if (isPanning) {
                 if (this.canvas) { // Vérifier si canvas existe toujours
                    this.canvas.setViewportTransform(this.canvas.viewportTransform); // Appliquer la transformation
                    this.canvas.selection = true; // Réactiver la sélection
                    this.canvas.setCursor('default');
                 }
                 isPanning = false;
            }
        });
        console.log("CanvasManager: Panning (Alt+Click) activé.");
    }
    */
}

// Exporter la classe pour qu'elle puisse être importée ailleurs
export default CanvasManager;
