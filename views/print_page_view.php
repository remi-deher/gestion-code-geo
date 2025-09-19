<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Impression des Étiquettes</title>
    <link rel="stylesheet" href="css/print.css">
</head>
<body>
    <div class="page-container">
        <div class="controls no-print">
            <p class="print-info">Page générée le <?= date('d/m/Y H:i') ?>.</p>
            <button onclick="window.print()">Ré-imprimer</button>
        </div>

        <?php if (!empty($groupedCodes)): ?>
            <?php foreach ($groupedCodes as $univers => $codes): ?>
                <section class="univers-group">
                    <h2 class="univers-title"><?= htmlspecialchars($univers) ?></h2>
                    <div class="print-list">
                        <?php foreach ($codes as $code): ?>
                            <div class="print-item">
                                <div class="print-qr-code" data-code="<?= htmlspecialchars($code['code_geo']) ?>"></div>
                                <div class="print-details">
                                    <div class="print-code"><?= htmlspecialchars($code['code_geo']) ?></div>
                                    <div class="print-libelle"><?= htmlspecialchars($code['libelle']) ?></div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </section>
            <?php endforeach; ?>
        <?php else: ?>
            <p class="no-print">Aucun code à imprimer pour la sélection effectuée.</p>
        <?php endif; ?>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('.print-qr-code').forEach(container => {
                const codeText = container.dataset.code;
                if (codeText) {
                    new QRCode(container, { 
                        text: codeText, 
                        width: 100, 
                        height: 100,
                        correctLevel : QRCode.CorrectLevel.H
                    });
                }
            });
            setTimeout(() => { window.print(); }, 500);
        });
    </script>
</body>
</html>
