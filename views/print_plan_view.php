<?php
// Fichier: views/print_plan_view.php
// Vue utilisée pour charger le plan et générer une image clippée pour l'impression.
$title = $title ?? 'Impression de Plan';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($title) ?></title>

    <!-- Bootstrap CSS minimal (pour les icônes) -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

    <!-- Fabric.js (avec le hash corrigé) -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js" integrity="sha512-CeIsOAsgJnmevfCi2C7Zsyy6bQKi43utIjdA87Q0ZY84oDqnI0uwfM9+bKiIkI75lUeI00WG/+uJzOmuHlesMA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

    <!-- CSS d'impression spécifique -->
    <link rel="stylesheet" href="css/print.css" media="print">
    <style>
        body { margin: 0; padding: 0; background-color: #f8f9fa; /* Fond gris clair pour l'écran */ }
        #print-container {
            /* Centre le contenu à l'écran */
            display: flex;
            justify-content: center;
            align-items: flex-start; /* Aligner en haut */
            padding-top: 2rem;
            min-height: 100vh;
        }
        #print-image-wrapper {
             /* Style pour l'aperçu de l'image générée (pas visible à l'impression) */
             box-shadow: 0 4px 8px rgba(0,0,0,0.1);
             background-color: white;
             padding: 10px; /* Petite marge interne */
             max-width: 90vw; /* Limiter la taille à l'écran */
        }
        #print-image {
             display: block; /* Évite les marges sous l'image */
             max-width: 100%;
             height: auto;
        }
        .loading-message { text-align: center; padding: 2rem; }

        /* Styles pour l'impression réelle */
        @media print {
            body { background-color: white; /* Fond blanc pour l'impression */ }
            #print-container { padding-top: 0; justify-content: flex-start; align-items: flex-start; }
            #print-image-wrapper { box-shadow: none; padding: 0; max-width: 100%; }
            .loading-message, #print-canvas-hidden { visibility: hidden; display: none; } /* Cacher message et canvas original */
            #print-image { visibility: visible; max-width: 100%; height: auto; } /* Assurer que seule l'image est visible */

             /* Optionnel: Définir la taille de la page pour le dialogue d'impression */
             /* @page { size: A4 portrait; margin: 10mm; } */
             /* Note: La taille @page est indicative, l'utilisateur a le dernier mot. */
        }
    </style>
</head>
<body>

    <div id="print-container">
        <!-- Message de chargement -->
        <div class="loading-message" id="loading-message">
            <h1>Préparation du Plan pour l'impression...</h1>
            <p class="text-muted">Génération de l'image clippée...</p>
        </div>

        <!-- Canvas caché pour le rendu Fabric (pas directement imprimé) -->
        <div style="position: absolute; left: -9999px; top: -9999px;">
             <canvas id="print-canvas-hidden"></canvas>
        </div>

        <!-- Wrapper pour l'image générée (pour l'aperçu écran) -->
        <div id="print-image-wrapper" style="display: none;">
             <img id="print-image" alt="Aperçu du plan pour impression">
        </div>
    </div>

    <!-- Injecter les données PHP nécessaires pour JavaScript -->
    <script>
        window.planData = {
            currentPlan: <?= json_encode($plan ?? null) ?>,
            placedGeoCodes: <?= json_encode($positions ?? []) ?>,
            universColors: [],
            // Format de page est crucial ici
            pageFormat: "<?= htmlspecialchars($plan['page_format'] ?? 'Custom') ?>"
        };
    </script>

    <!-- Script de rendu pour l'impression -->
    <script type="module">
        import { loadPlanBackgroundAndObjects } from './js/modules/planLoader.js';
        import { renderPlacedGeoCodes } from './js/modules/geoCodeRenderer.js';
        // Importer le gestionnaire de guide pour récupérer le guide
        import { getActiveGuide, updatePageGuide } from './js/modules/guideManager.js';
        // Importer les formats pour obtenir les dimensions
        import { PAGE_FORMATS } from './js/modules/config.js';

        // Fonction asynchrone auto-exécutable (IIFE)
        (async () => {
            const hiddenCanvasElement = document.getElementById('print-canvas-hidden');
            const loadingMessage = document.getElementById('loading-message');
            const printImageWrapper = document.getElementById('print-image-wrapper');
            const printImage = document.getElementById('print-image');

            if (!window.planData.currentPlan || !hiddenCanvasElement || !loadingMessage || !printImageWrapper || !printImage) {
                 if (loadingMessage) loadingMessage.innerHTML = '<div class="alert alert-danger m-3">Erreur : Éléments DOM ou données de plan manquants.</div>';
                 return;
            }

            // Créer l'instance Fabric.js sur le canvas caché
            // Donner une taille initiale suffisante, elle sera ajustée par updatePageGuide
            const canvas = new fabric.Canvas(hiddenCanvasElement, {
                width: 1000, height: 1000, // Taille temporaire
                selection: false, evented: false,
            });

            try {
                // 1. Déterminer le format et redimensionner le canvas caché via le guide
                //    Ceci définit la taille de l'espace de travail pour charger les éléments.
                const formatKey = window.planData.pageFormat || 'Custom';
                updatePageGuide(formatKey, canvas, window.planData.currentPlan);

                // 2. Charger le fond et les dessins Fabric sur le canvas caché
                await loadPlanBackgroundAndObjects(canvas, window.planData.currentPlan);

                // 3. Charger les codes géo placés sur le canvas caché
                if (window.planData.placedGeoCodes && window.planData.placedGeoCodes.length > 0) {
                     renderPlacedGeoCodes(canvas, window.planData.placedGeoCodes, window.planData.universColors || {});
                }

                // Attendre un court instant pour s'assurer que tout est rendu
                await new Promise(resolve => setTimeout(resolve, 50));
                canvas.renderAll();

                // 4. Récupérer le guide et générer l'image clippée
                const guide = getActiveGuide(); // Récupère le guide dessiné par updatePageGuide
                let dataUrl = null;

                if (guide && guide.width > 0 && guide.height > 0) {
                    console.log(`Print: Clipping à la zone du guide (${guide.left.toFixed(0)}, ${guide.top.toFixed(0)}, ${guide.width.toFixed(0)}, ${guide.height.toFixed(0)})`);
                    // Options pour extraire uniquement la zone du guide
                    const clipOptions = {
                        left: guide.left,
                        top: guide.top,
                        width: guide.width,
                        height: guide.height,
                        format: 'png',
                        quality: 1.0,
                        multiplier: 1 // Garder la résolution 1:1 pour l'impression
                    };
                    dataUrl = canvas.toDataURL(clipOptions);
                } else if (formatKey === 'Custom' || !guide) {
                    console.log("Print: Aucun guide valide trouvé ou format 'Custom', impression du canvas entier.");
                    // Fallback: Exporter le canvas entier s'il n'y a pas de guide
                     dataUrl = canvas.toDataURL({ format: 'png', quality: 1.0 });
                     // Attention: la taille peut être très grande si CANVAS_OVERSIZE_FACTOR est élevé
                }

                if (!dataUrl) {
                    throw new Error("Impossible de générer l'image pour l'impression.");
                }

                // 5. Afficher l'image générée et masquer le reste
                printImage.src = dataUrl;
                printImageWrapper.style.display = 'block'; // Afficher le conteneur de l'image
                if (loadingMessage) loadingMessage.style.display = 'none';

                // 6. Lancement de l'impression après chargement de l'image
                printImage.onload = () => {
                     // Lancer l'impression après un court délai pour être sûr
                    setTimeout(() => {
                        console.log("Image clippée chargée. Impression lancée.");
                        window.print();
                    }, 100);
                };
                 printImage.onerror = () => {
                     throw new Error("L'image générée pour l'impression n'a pas pu être chargée.");
                 };

            } catch (error) {
                console.error("Erreur lors de la préparation à l'impression:", error);
                 if (loadingMessage) {
                     loadingMessage.innerHTML = '<div class="alert alert-danger m-3">Échec du rendu du plan : ' + error.message + '</div>';
                 }
            } finally {
                // Nettoyer le canvas Fabric caché pour libérer la mémoire
                if (canvas) {
                    canvas.dispose();
                }
            }
        })();

    </script>
</body>
</html>
