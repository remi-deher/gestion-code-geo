<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Impression des Étiquettes</title>
    <link rel="stylesheet" href="css/print.css">
</head>
<body>
    <div class="page-container">
        <h1>Étiquettes des Codes Géo</h1>
        <p class="print-info">Page générée le <?= date('d/m/Y H:i') ?>. Prête pour l'impression.</p>

        <div class="labels-grid">
            <?php foreach ($geoCodes as $code): ?>
                <div class="label-item">
                    <div class="label-qr-code" data-code="<?= htmlspecialchars($code['code_geo']) ?>"></div>
                    <div class="label-details">
                        <div class="label-code"><?= htmlspecialchars($code['code_geo']) ?></div>
                        <div class="label-libelle"><?= htmlspecialchars($code['libelle']) ?></div>
                        <div class="label-univers"><?= htmlspecialchars($code['univers']) ?></div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <script>
        // Génération des QR Codes pour les étiquettes
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('.label-qr-code').forEach(container => {
                const codeText = container.dataset.code;
                if (codeText) new QRCode(container, { text: codeText, width: 70, height: 70 });
            });
            // Lance l'impression automatiquement
            window.print();
        });
    </script>
</body>
</html>
