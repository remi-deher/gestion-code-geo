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
            display: flex; /* Utiliser flexbox pour centrer le spinner si besoin */
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        #print-canvas { 
            border: 1px solid #ccc;
            /* Cacher l'élément canvas initialement si non chargé */
            display: none; 
        }
        
        /* Cacher l'indicateur de chargement après que le JS ait masqué l'enveloppe */
        .loading-message {
             text-align: center;
             padding: 2rem;
        }

        /* Cacher tout ce qui n'est pas le canvas pour l'impression */
        @media print {
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
            // Ajoutez d'autres données ici si nécessaire
        };
    </script>
    
    <script type="module">
        import { loadPlanBackgroundAndObjects } from './js/modules/planLoader.js'; // Assurez-vous que le chemin est correct
        import { renderPlacedGeoCodes } from './js/modules/geoCodeRenderer.js';

        // Fonction asynchrone auto-exécutable (IIFE)
        (async () => {
            const printCanvasElement = document.getElementById('print-canvas');
            const printArea = document.getElementById('print-area');
            const loadingMessage = document.getElementById('loading-message'); // Sélectionner le message

            if (!window.planData.currentPlan || !printCanvasElement) {
                 console.error("Impossible d'initialiser l'impression: Données manquantes.");
                 if (printArea) {
                      printArea.innerHTML = '<div class="alert alert-danger m-3">Erreur : Données de plan manquantes.</div>';
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

                // 3. Rendu final
                canvas.renderAll();
                
                // --- MASQUER LE MESSAGE DE CHARGEMENT ET AFFICHER LE CANVAS ---
                if (loadingMessage) {
                     loadingMessage.style.display = 'none';
                }
                printCanvasElement.style.display = 'block'; // Afficher le canvas
                
                // 4. Lancement de l'impression
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
