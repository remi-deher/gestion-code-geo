<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Impression du Plan : <?= htmlspecialchars($plan['nom']) ?></title>
    <link rel="stylesheet" href="css/plan_print.css">
</head>
<body>
    <div class="print-container">
        <div class="print-header-container">
            <h1><?= htmlspecialchars($plan['nom']) ?></h1>
        </div>
        <img id="printed-canvas" src="" alt="Plan à imprimer" />
        <div class="print-legend-container"></div>
    </div>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const mapImage = new Image();
            // Assure que le navigateur ne met pas en cache une ancienne version de l'image
            mapImage.src = 'uploads/plans/<?= htmlspecialchars($plan['nom_fichier']) ?>?t=' + new Date().getTime();

            mapImage.onload = () => {
                const placedGeoCodes = <?= json_encode($geoCodes ?? []); ?>;
                const universColors = <?= json_encode($universColors ?? []); ?>;
                const currentPlanId = <?= json_encode($plan['id']); ?>;
                
                const printCanvas = document.createElement('canvas');
                printCanvas.width = mapImage.naturalWidth;
                printCanvas.height = mapImage.naturalHeight;
                const printCtx = printCanvas.getContext('2d');
                
                printCtx.drawImage(mapImage, 0, 0);

                // --- Fonctions de dessin ---
                function getTagDimensions(code) {
                    const textMetrics = printCtx.measureText(code.code_geo);
                    const calcWidth = textMetrics.width + 16;
                    return {
                        x: (code.pos_x / 100) * mapImage.naturalWidth,
                        y: (code.pos_y / 100) * mapImage.naturalHeight,
                        width: code.width || Math.max(80, calcWidth),
                        height: code.height || 22,
                        anchor_x_abs: (code.anchor_x / 100) * mapImage.naturalWidth,
                        anchor_y_abs: (code.anchor_y / 100) * mapImage.naturalHeight
                    };
                }
                
                function drawArrow(fromX, fromY, toX, toY) {
                    const headlen = 10;
                    const angle = Math.atan2(toY - fromY, toX - fromX);
                    printCtx.beginPath();
                    printCtx.moveTo(fromX, fromY);
                    printCtx.lineTo(toX, toY);
                    printCtx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
                    printCtx.moveTo(toX, toY);
                    printCtx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
                    printCtx.strokeStyle = '#34495e';
                    printCtx.lineWidth = 2;
                    printCtx.stroke();
                }

                // --- Dessin des étiquettes et des flèches ---
                placedGeoCodes.forEach(code => {
                    if (code.plan_id != currentPlanId || code.pos_x === null) return;
                    
                    const tag = getTagDimensions(code);

                    if (code.anchor_x != null && code.anchor_y != null) {
                        drawArrow(tag.x, tag.y, tag.anchor_x_abs, tag.anchor_y_abs);
                    }

                    printCtx.strokeStyle = 'black';
                    printCtx.lineWidth = 1;
                    printCtx.fillStyle = universColors[code.univers] || '#7f8c8d';
                    printCtx.fillRect(tag.x - tag.width / 2, tag.y - tag.height / 2, tag.width, tag.height);
                    printCtx.strokeRect(tag.x - tag.width / 2, tag.y - tag.height / 2, tag.width, tag.height);

                    printCtx.font = `bold 12px Arial`;
                    printCtx.fillStyle = 'white';
                    printCtx.textAlign = 'center';
                    printCtx.textBaseline = 'middle';
                    printCtx.fillText(code.code_geo, tag.x, tag.y);
                });

                // --- Ajout de la légende ---
                const legendContainer = document.querySelector('.print-legend-container');
                let legendHTML = '<h3>Légende</h3>';
                const placedUnivers = new Set(placedGeoCodes.filter(c => c.plan_id == currentPlanId && c.univers).map(c => c.univers));
                placedUnivers.forEach(universName => {
                    const color = universColors[universName] || '#7f8c8d';
                    legendHTML += `<div class="legend-item"><div class="legend-color-box" style="background-color: ${color};"></div><span>${universName}</span></div>`;
                });
                legendContainer.innerHTML = legendHTML;

                // --- Lancement de l'impression ---
                document.getElementById('printed-canvas').src = printCanvas.toDataURL('image/png');
                setTimeout(() => window.print(), 500);
            };
        });
    </script>
</body>
</html>
