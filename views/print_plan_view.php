<?php
// Fichier: views/print_plan_view.php
// Vue utilisée pour charger le plan dans un contexte optimisé pour l'impression/export.
$title = $title ?? 'Impression de Plan';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($title) ?></title>

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js" integrity="sha512-CeIsOAsgJnmevfCi2C7Zsyy6bQKi43utIjdA87Q0ZY84oDqnI0uwfM9+bKiIkI75lUeI00WG/+uJzOmuHlesMA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

    <link rel="stylesheet" href="css/print.css" media="print">
    <style>
        /* Styles pour masquer les éléments non-essentiels à l'écran */
        body { margin: 0; padding: 0; background-color: #fff; }
        #print-area { 
            width: 100vw; 
            height: 100vh; 
            position: relative; 
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        #print-canvas { 
            border: 1px solid #ccc;
            display: none; 
        }
        
        .loading-message {
             text-align: center;
             padding: 2rem;
        }

        /* Cacher tout ce qui n'est pas le canvas pour l'impression */
        @media print {
            /* Le canvas Fabric est généralement rendu avec des dimensions fixes. 
               C'est au JS de le dimensionner correctement, mais ce CSS s'assure qu'il est visible. */
            body * { visibility: hidden; }
            #print-area, #print-area * { visibility: visible; }
        }
    </style>
</head>
<body>

    <div id="print-area">
        <div class="loading-message" id="loading-message">
            <h1>Préparation du Plan pour l'impression...</h1>
            <p class="text-muted">Veuillez patienter pendant le chargement des objets et du fond.</p>
        </div>
        <canvas id="print-canvas"></canvas>
    </div>

    <script>
        window.planData = {
            currentPlan: <?= json_encode($plan ?? null) ?>,
            placedGeoCodes: <?= json_encode($positions ?? []) ?>,
            universColors: [],
        };
    </script>
    
    <script type="module">
        import { loadPlanBackgroundAndObjects } from './js/modules/planLoader.js';
        import { renderPlacedGeoCodes } from './js/modules/geoCodeRenderer.js';

        /**
         * Calcule et applique le zoom pour que le plan tienne sur une seule page A4.
         * @param {fabric.Canvas} canvas
         */
        function scaleToFitPage(canvas) {
            if (!canvas) return;

            // Dimensions maximales du plan dans la zone imprimable (en pixels)
            // Estimation prudente pour A4 Portrait (8.5in * 96 DPI = 816px) moins les marges.
            const MAX_WIDTH_PIXELS = 750; 
            const MAX_HEIGHT_PIXELS = 1050; 

            const canvasWidth = canvas.getWidth();
            const canvasHeight = canvas.getHeight();

            // S'assurer que le plan est plus grand que l'aire d'impression avant de zoomer
            if (canvasWidth <= MAX_WIDTH_PIXELS && canvasHeight <= MAX_HEIGHT_PIXELS) {
                console.log("Print: Plan plus petit que l'aire d'impression, pas de mise à l'échelle.");
                return;
            }

            // Calculer le ratio d'ajustement (Width / Max_W) et (Height / Max_H)
            const ratioX = MAX_WIDTH_PIXELS / canvasWidth;
            const ratioY = MAX_HEIGHT_PIXELS / canvasHeight;

            // Utiliser le plus petit des deux ratios pour garantir que le plan entier rentre
            const zoom = Math.min(ratioX, ratioY) * 0.98; // 98% pour une petite marge de sécurité
            
            // Appliquer le zoom au canvas
            canvas.setZoom(zoom);

            // Redimensionner le canvas HTML (l'élément DOM) pour qu'il ne cause pas de scrollbar
            // Fabric gère la mise à l'échelle interne (le rendu) via setZoom, mais nous devons 
            // ajuster les propriétés width/height de l'élément Canvas lui-même pour l'impression.
            canvas.setWidth(canvasWidth * zoom);
            canvas.setHeight(canvasHeight * zoom);
            canvas.calcOffset(); 
            
            console.log(`Print: Canvas mis à l'échelle à ${canvas.getWidth().toFixed(0)}x${canvas.getHeight().toFixed(0)} (Zoom: ${zoom.toFixed(2)})`);
        }


        // Fonction asynchrone auto-exécutable (IIFE)
        (async () => {
            const printCanvasElement = document.getElementById('print-canvas');
            const loadingMessage = document.getElementById('loading-message');

            if (!window.planData.currentPlan || !printCanvasElement) {
                 if (loadingMessage) {
                      loadingMessage.innerHTML = '<div class="alert alert-danger m-3">Erreur : Données de plan manquantes.</div>';
                 }
                 return;
            }

            // Créer l'instance Fabric.js
            const canvas = new fabric.Canvas(printCanvasElement, {
                selection: false,
                evented: false,
            });

            try {
                // 1. Charger le fond et les dessins Fabric
                await loadPlanBackgroundAndObjects(canvas, window.planData.currentPlan);

                // 2. Charger les codes géo placés
                if (window.planData.placedGeoCodes && window.planData.placedGeoCodes.length > 0) {
                     renderPlacedGeoCodes(canvas, window.planData.placedGeoCodes, window.planData.universColors || {});
                }
                
                // 3. Mise à l'échelle du plan pour la page d'impression
                scaleToFitPage(canvas); // Appel de la nouvelle fonction

                // 4. Rendu final et préparation de l'interface
                canvas.renderAll();
                
                if (loadingMessage) {
                     loadingMessage.style.display = 'none';
                }
                printCanvasElement.style.display = 'block'; // Afficher le canvas
                
                // 5. Lancement de l'impression
                setTimeout(() => {
                    console.log("Préparation terminée. Impression lancée.");
                    window.print();
                }, 100); 

            } catch (error) {
                console.error("Erreur lors de la préparation à l'impression:", error);
                 if (loadingMessage) {
                     loadingMessage.innerHTML = '<div class="alert alert-danger m-3">Échec du rendu du plan : ' + error.message + '</div>';
                 }
            }
        })();
    </script>
</body>
</html>
