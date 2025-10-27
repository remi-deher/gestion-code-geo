<?php
// Fichier: views/print_plan_view.php
// Vue simplifiée pour l'impression directe du canvas.
$title = $title ?? 'Impression de Plan';
// Extraire l'orientation et la taille du formatKey
$formatKey = $plan['page_format'] ?? 'A4-P';
$formatParts = explode('-', $formatKey);
$pageSize = $formatParts[0] ?? 'A4'; // Ex: A4
$orientation = ($formatParts[1] ?? 'P') === 'L' ? 'landscape' : 'portrait'; // Ex: portrait

?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($title) ?></title>

    <!-- Fabric.js -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js" xintegrity="sha512-CeIsOAsgJnmevfCi2C7Zsyy6bQKi43utIjdA87Q0ZY84oDqnI0uwfM9+bKiIkI75lUeI00WG/+uJzOmuHlesMA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

    <style>
        body { margin: 0; padding: 0; background-color: #fff; }
        /* Wrapper pour centrer à l'écran */
        #print-canvas-wrapper {
            display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #eee;
        }
        #print-canvas {
            border: 1px solid #ccc; /* Visible à l'écran */
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .loading-message { text-align: center; padding: 2rem; }

        @media print {
            body { background-color: white; }
            /* Cacher wrapper et message */
            #print-canvas-wrapper, .loading-message { display: none; visibility: hidden; }
            /* Styles pour que le canvas prenne la page */
            #print-canvas {
                 visibility: visible;
                 position: absolute; left: 0; top: 0;
                 border: none; box-shadow: none;
                 width: 100%; /* S'assurer qu'il prend la largeur définie par @page */
                 height: 100%; /* S'assurer qu'il prend la hauteur définie par @page */
                 object-fit: contain; /* S'assurer que le contenu reste proportionnel */
            }
             /* Configurer la page d'impression */
             @page {
                 /* Utiliser les variables PHP pour définir dynamiquement la taille/orientation */
                 size: <?= htmlspecialchars($pageSize) ?> <?= htmlspecialchars($orientation) ?>;
                 margin: 5mm; /* Marges minimales */
             }
        }
    </style>
</head>
<body>

    <div class="loading-message" id="loading-message">
        <h1>Préparation pour l'impression...</h1>
    </div>

    <!-- Wrapper pour centrer à l'écran -->
    <div id="print-canvas-wrapper" style="display:none;">
        <canvas id="print-canvas"></canvas>
    </div>


    <script>
        window.planData = {
            currentPlan: <?= json_encode($plan ?? null) ?>,
            placedGeoCodes: <?= json_encode($positions ?? []) ?>,
            universColors: [],
            pageFormat: "<?= htmlspecialchars($plan['page_format'] ?? 'A4-P') ?>"
        };
    </script>

    <script type="module">
        import { loadPlanBackgroundAndObjects } from './js/modules/planLoader.js';
        import { renderPlacedGeoCodes } from './js/modules/geoCodeRenderer.js';
        // Importer uniquement la fonction pour définir la taille
        import { setCanvasSizeFromFormat } from './js/modules/guideManager.js';

        (async () => {
            const printCanvasElement = document.getElementById('print-canvas');
            const loadingMessage = document.getElementById('loading-message');
            const canvasWrapper = document.getElementById('print-canvas-wrapper');

            if (!window.planData.currentPlan || !printCanvasElement) {
                if(loadingMessage) loadingMessage.textContent = "Erreur: Données manquantes."; return;
            }

            // Créer l'instance Fabric (sans taille initiale fixe)
            const canvas = new fabric.Canvas(printCanvasElement, { selection: false, evented: false });

            try {
                // 1. Définir la taille EXACTE du canvas (A4/A3)
                const formatKey = window.planData.pageFormat;
                if (!setCanvasSizeFromFormat(formatKey, canvas)) {
                     console.warn("Format invalide pour l'impression, utilisation taille par défaut.");
                     // Si setCanvasSize échoue, définir une taille par défaut explicite
                     canvas.setWidth(794); canvas.setHeight(1123); // A4-P fallback
                     canvas.calcOffset();
                }

                // 2. Charger le contenu
                await loadPlanBackgroundAndObjects(canvas, window.planData.currentPlan);
                if (window.planData.placedGeoCodes?.length > 0) {
                     renderPlacedGeoCodes(canvas, window.planData.placedGeoCodes, window.planData.universColors || {});
                }

                // Attendre le rendu
                await new Promise(resolve => setTimeout(resolve, 50));
                canvas.renderAll();

                // Afficher le canvas et masquer le chargement
                if(loadingMessage) loadingMessage.style.display = 'none';
                if(canvasWrapper) canvasWrapper.style.display = 'flex'; // Afficher le wrapper centré

                // Lancer l'impression
                setTimeout(() => {
                    console.log("Prêt à imprimer.");
                    window.print();
                }, 100);

            } catch (error) {
                console.error("Erreur préparation impression:", error);
                if(loadingMessage) {
                    loadingMessage.style.display = 'block';
                    loadingMessage.innerHTML = '<div class="alert alert-danger">Erreur: ' + error.message + '</div>';
                }
                if(canvasWrapper) canvasWrapper.style.display = 'none';
            }
            // Ne pas disposer le canvas pour permettre réimpression
        })();
    </script>

</body>
</html>
