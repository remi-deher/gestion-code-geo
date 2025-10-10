/**
 * Gère la consultation d'un plan.
 * Affiche l'image du plan, les codes géo positionnés, et permet le zoom/déplacement.
 * VERSION CORRIGÉE ET AMÉLIORÉE : Le zoom et le déplacement sont contraints pour ne pas perdre le plan.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- Éléments du DOM ---
    const canvas = document.getElementById('plan-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const mapImage = document.getElementById('map-image');
    const planContainer = document.getElementById('plan-container');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const planPageContainer = document.querySelector('.plan-page-container');

    // --- Constantes de configuration ---
    const MIN_ZOOM = 0.8; // Zoom minimum (le plan ne sera jamais plus petit que 80% du conteneur)
    const MAX_ZOOM = 5;   // Zoom maximum
    const ZOOM_INTENSITY = 0.1;

    // --- État du canvas ---
    let scale = 1, panX = 0, panY = 0;
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let imageLoaded = false;
    let initialPinchDistance = null;

    /**
     * Point d'entrée, initialise le script.
     */
    function initialize() {
        if (!mapImage) {
            console.error("L'image du plan (#map-image) n'a pas été trouvée.");
            return;
        }
        
        if (mapImage.complete && mapImage.naturalWidth > 0) {
            imageLoaded = true;
            setupCanvas();
        } else {
            mapImage.onload = () => {
                imageLoaded = true;
                setupCanvas();
            };
        }
    }

    /**
     * Configure le canvas et les écouteurs une fois l'image chargée.
     */
    function setupCanvas() {
        addEventListeners();
        resizeCanvas(); // Fait un premier "draw()" et "resetZoomAndPan()"
    }
    
    /**
     * Redimensionne le canvas pour s'adapter à son conteneur.
     */
    function resizeCanvas() {
        if (!imageLoaded) return;
        
        const containerRect = planContainer.getBoundingClientRect();
        
        // On garde les proportions de l'image source
        const imageAspectRatio = mapImage.naturalHeight / mapImage.naturalWidth;
        const containerAspectRatio = containerRect.height / containerRect.width;

        if (imageAspectRatio > containerAspectRatio) {
            canvas.height = containerRect.height;
            canvas.width = containerRect.height / imageAspectRatio;
        } else {
            canvas.width = containerRect.width;
            canvas.height = containerRect.width * imageAspectRatio;
        }
        
        resetZoomAndPan();
    }

    /**
     * Ajoute tous les écouteurs d'événements (souris, molette, tactile, boutons).
     */
    function addEventListeners() {
        window.addEventListener('resize', resizeCanvas);
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseUp);

        // Tactile
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd);

        if (fullscreenBtn && planPageContainer) {
            fullscreenBtn.addEventListener('click', toggleFullScreen);
        }
    }

    /**
     * Dessine l'image de fond et tous les tags sur le canvas.
     */
    function draw() {
        if (!imageLoaded) return;
        
        requestAnimationFrame(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(panX, panY);
            ctx.scale(scale, scale);
            ctx.drawImage(mapImage, 0, 0, mapImage.naturalWidth, mapImage.naturalHeight);
            
            placedGeoCodes.forEach(code => {
                // Affiche seulement les codes pour le plan actuel et qui ont une position
                if (code.plan_id == currentPlanId && code.pos_x !== null) {
                    drawTag(code);
                }
            });

            ctx.restore();
        });
    }
    
    /**
     * Dessine un seul tag (étiquette de code géo).
     * @param {object} code - L'objet code géo avec ses propriétés de position.
     */
    function drawTag(code) {
        const tagDimensions = getTagDimensions(code);
        const { x, y, width, height } = tagDimensions;

        ctx.fillStyle = universColors[code.univers] || '#7f8c8d'; // Couleur de fond
        ctx.fillRect(x - width / 2, y - height / 2, width, height);
        
        ctx.font = `bold ${12 / scale}px Arial`; // Le texte doit s'adapter au zoom
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(code.code_geo, x, y);
    }
    
    /**
     * Calcule les dimensions et la position en pixels d'un tag.
     * @param {object} code - L'objet code géo.
     * @returns {object} - {x, y, width, height} en pixels.
     */
    function getTagDimensions(code) {
        const textMetrics = ctx.measureText(code.code_geo);
        const calcWidth = textMetrics.width + 16;
        return {
            x: (code.pos_x / 100) * mapImage.naturalWidth,
            y: (code.pos_y / 100) * mapImage.naturalHeight,
            width: code.width || Math.max(80, calcWidth),
            height: code.height || 22,
        };
    }

    /**
     * Applique des contraintes au déplacement pour que le plan ne sorte pas du cadre.
     */
    function applyConstraints() {
        let minPanX, maxPanX, minPanY, maxPanY;

        // Si l'image zoomée est plus petite que le canvas, on la centre.
        if (mapImage.naturalWidth * scale < canvas.width) {
            minPanX = maxPanX = (canvas.width - mapImage.naturalWidth * scale) / 2;
        } else {
            // Sinon, on empêche de faire apparaître des bords vides.
            minPanX = canvas.width - mapImage.naturalWidth * scale;
            maxPanX = 0;
        }

        if (mapImage.naturalHeight * scale < canvas.height) {
            minPanY = maxPanY = (canvas.height - mapImage.naturalHeight * scale) / 2;
        } else {
            minPanY = canvas.height - mapImage.naturalHeight * scale;
            maxPanY = 0;
        }
        
        panX = Math.max(minPanX, Math.min(panX, maxPanX));
        panY = Math.max(minPanY, Math.min(panY, maxPanY));
    }

    // --- Gestionnaires d'événements ---

    function handleWheel(e) {
        e.preventDefault();
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoom = Math.exp(wheel * ZOOM_INTENSITY);
        const newScale = Math.max(MIN_ZOOM, Math.min(scale * zoom, MAX_ZOOM));
        
        if(newScale === scale) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        panX = mouseX - (mouseX - panX) * (newScale / scale);
        panY = mouseY - (mouseY - panY) * (newScale / scale);
        scale = newScale;

        applyConstraints();
        draw();
    }

    function handleMouseDown(e) {
        isPanning = true;
        panStart.x = e.clientX - panX;
        panStart.y = e.clientY - panY;
        canvas.style.cursor = 'grabbing';
    }

    function handleMouseMove(e) {
        if (isPanning) {
            panX = e.clientX - panStart.x;
            panY = e.clientY - panStart.y;
            applyConstraints();
            draw();
        }
    }

    function handleMouseUp() {
        isPanning = false;
        canvas.style.cursor = 'grab';
    }

    // --- Gestion du tactile ---
    function handleTouchStart(e) {
        if (e.touches.length === 1) {
           e.preventDefault();
           isPanning = true;
           panStart = { x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY };
        } else if (e.touches.length === 2) {
           e.preventDefault();
           isPanning = false;
           const dx = e.touches[0].clientX - e.touches[1].clientX;
           const dy = e.touches[0].clientY - e.touches[1].clientY;
           initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
        }
    }

    function handleTouchMove(e) {
        if (e.touches.length === 1 && isPanning) {
           e.preventDefault();
           panX = e.touches[0].clientX - panStart.x;
           panY = e.touches[0].clientY - panStart.y;
           applyConstraints();
           draw();
        } else if (e.touches.length === 2 && initialPinchDistance) {
           e.preventDefault();
           const dx = e.touches[0].clientX - e.touches[1].clientX;
           const dy = e.touches[0].clientY - e.touches[1].clientY;
           const currentPinchDistance = Math.sqrt(dx * dx + dy * dy);
           const zoomFactor = currentPinchDistance / initialPinchDistance;
           const newScale = Math.max(MIN_ZOOM, Math.min(scale * zoomFactor, MAX_ZOOM));
           
           if(newScale !== scale) {
              // Simule un zoom centré entre les deux doigts
              const rect = canvas.getBoundingClientRect();
              const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
              const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
              panX = midX - (midX - panX) * (newScale / scale);
              panY = midY - (midY - panY) * (newScale / scale);
              scale = newScale;
              applyConstraints();
              draw();
           }
           initialPinchDistance = currentPinchDistance;
        }
    }

    function handleTouchEnd() {
       isPanning = false;
       initialPinchDistance = null;
    }

    function resetZoomAndPan() {
        scale = 1;
        panX = 0;
        panY = 0;
        applyConstraints();
        draw();
    }
    
    function toggleFullScreen() {
        planPageContainer.classList.toggle('fullscreen-mode');
        const icon = fullscreenBtn.querySelector('i');
        
        if (planPageContainer.classList.contains('fullscreen-mode')) {
            icon.classList.remove('bi-arrows-fullscreen');
            icon.classList.add('bi-arrows-angle-contract');
            fullscreenBtn.title = "Quitter le plein écran";
        } else {
            icon.classList.add('bi-arrows-fullscreen');
            icon.classList.remove('bi-arrows-angle-contract');
            fullscreenBtn.title = "Plein écran";
        }
        setTimeout(() => {
            resizeCanvas();
        }, 300);
    }

    // --- Lancement ---
    initialize();
});
