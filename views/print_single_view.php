<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Imprimer Étiquette : <?= htmlspecialchars($geoCode['code_geo']) ?></title>
    <link rel="stylesheet" href="css/print.css">
    <style>
        /* Styles spécifiques pour centrer la seule étiquette sur la page */
        @media screen {
             body {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
             }
        }
        @media print {
            .page-container {
                margin: 0;
                padding: 0;
            }
        }
        /* On force la taille de l'étiquette (modèle classique par défaut) */
        .print-item {
            margin: 10mm; /* Marge pour ne pas coller au bord de la page */
        }
    </style>
</head>
<body class="template-qr-left"> 
    
    <div class="page-container">
        <div class="print-item template-qr-left">
            <div class="print-qr-code" data-code="<?= htmlspecialchars($geoCode['code_geo']) ?>"></div>
            <div class="print-details">
                <div class="print-code"><?= htmlspecialchars($geoCode['code_geo']) ?></div>
                <div class="print-libelle"><?= htmlspecialchars($geoCode['libelle']) ?></div>
                <div class="print-univers"><strong>Univers :</strong> <?= htmlspecialchars($geoCode['univers']) ?></div>
                <?php if (!empty($geoCode['commentaire'])): ?>
                    <div class="print-comment"><strong>Note :</strong> <?= htmlspecialchars($geoCode['commentaire']) ?></div>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const qrContainer = document.querySelector('.print-qr-code');
            const codeText = qrContainer.dataset.code;

            // On génère le QR code (taille fixe pour le modèle classique)
            new QRCode(qrContainer, { 
                text: codeText, 
                width: 130,
                height: 130,
                correctLevel : QRCode.CorrectLevel.H
            });
            
            // On lance l'impression après un court délai
            setTimeout(() => { 
                window.print(); 
            }, 500);
        });
    </script>
</body>
</html>
