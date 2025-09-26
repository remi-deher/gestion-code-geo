document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('plan-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const mapImage = document.getElementById('map-image');
    const planContainer = document.getElementById('plan-container');

    let scale = 1, panX = 0, panY = 0;
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let initialPinchDistance = null;

    function initialize() {
        mapImage.onload = () => {
            resizeCanvas();
            draw();
        };
        if (mapImage.complete && mapImage.naturalWidth > 0) {
            resizeCanvas();
            draw();
        }
        addEventListeners();
    }

    function draw() {
        if (!mapImage.complete || mapImage.naturalWidth === 0) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(scale, scale);
        ctx.drawImage(mapImage, 0, 0, mapImage.naturalWidth, mapImage.naturalHeight);
        
        placedGeoCodes.forEach(code => {
            // Affiche seulement les codes pour le plan actuel
            if (code.plan_id != currentPlanId) return;
            const tag = getTagDimensions(code);
            ctx.fillStyle = universColors[code.univers] || '#7f8c8d';
            ctx.fillRect(tag.x - tag.width / 2, tag.y - tag.height / 2, tag.width, tag.height);
            ctx.font = `bold ${12 / scale}px Arial`;
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(code.code_geo, tag.x, tag.y);
        });

        ctx.restore();
    }

    function addEventListeners() {
        window.addEventListener('resize', () => { resizeCanvas(); draw(); });
        canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isPanning = true;
            panStart = { x: e.clientX - panX, y: e.clientY - panY };
            canvas.style.cursor = 'grabbing';
        });
        canvas.addEventListener('mousemove', (e) => {
            if (isPanning) {
                panX = e.clientX - panStart.x;
                panY = e.clientY - panStart.y;
                draw();
            }
        });
        canvas.addEventListener('mouseup', () => { isPanning = false; canvas.style.cursor = 'grab'; });
        canvas.addEventListener('mouseleave', () => { isPanning = false; canvas.style.cursor = 'grab'; });
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomIntensity = 0.1;
            const direction = e.deltaY > 0 ? -1 : 1;
            const newScale = scale + direction * zoomIntensity;
            if(newScale > 0.2 && newScale < 10) {
                 scale = newScale;
                 draw();
            }
        }, { passive: false });

        // Tactile
        canvas.addEventListener('touchstart', (e) => {
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
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && isPanning) {
                e.preventDefault();
                panX = e.touches[0].clientX - panStart.x;
                panY = e.touches[0].clientY - panStart.y;
                draw();
            } else if (e.touches.length === 2 && initialPinchDistance) {
                e.preventDefault();
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const currentPinchDistance = Math.sqrt(dx * dx + dy * dy);
                const zoomFactor = currentPinchDistance / initialPinchDistance;
                const newScale = scale * zoomFactor;
                if(newScale > 0.2 && newScale < 10) {
                    scale = newScale;
                    draw();
                }
                initialPinchDistance = currentPinchDistance;
            }
        }, { passive: false });

        canvas.addEventListener('touchend', () => {
            isPanning = false;
            initialPinchDistance = null;
        });
    }

    function resizeCanvas() {
        const containerRect = planContainer.getBoundingClientRect();
        const imageAspectRatio = mapImage.naturalHeight / mapImage.naturalWidth;
        const containerAspectRatio = containerRect.height / containerRect.width;
        if (imageAspectRatio > containerAspectRatio) {
            canvas.height = containerRect.height;
            canvas.width = containerRect.height / imageAspectRatio;
        } else {
            canvas.width = containerRect.width;
            canvas.height = containerRect.width * imageAspectRatio;
        }
    }
    
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

    initialize();
});
