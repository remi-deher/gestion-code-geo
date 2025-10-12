<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title><?= htmlspecialchars($options['title'] ?? 'Impression des Étiquettes') ?></title>
    <link rel="stylesheet" href="css/print.css">
</head>
<body class="template-<?= htmlspecialchars($options['template']) ?>">
    <div class="page-container">
        <header class="print-header no-print">
            <?php if (!empty($options['title'])): ?>
                <h1 class="page-title"><?= htmlspecialchars($options['title']) ?></h1>
            <?php endif; ?>
            <div class="print-meta">
                <span>Page générée le <?= date('d/m/Y H:i') ?>. L'aperçu avant impression va s'ouvrir.</span>
                <button onclick="window.print()">
                    <i class="bi bi-printer-fill"></i> Ré-imprimer
                </button>
            </div>
        </header>

        <?php if (!empty($groupedCodes)): ?>
            <?php foreach ($groupedCodes as $univers => $codes): ?>
                <section class="univers-group">
                    <h2 class="univers-title"><?= htmlspecialchars($univers) ?></h2>
                    <div class="print-grid">
                        <?php foreach ($codes as $code): ?>
                            <?php for ($i = 0; $i < $options['copies']; $i++): ?>
                                <div class="print-item template-<?= htmlspecialchars($options['template']) ?>">
                                    <?php if (in_array('qrcode', $options['fields'])): ?>
                                        <div class="print-qr-code" data-code="<?= htmlspecialchars($code['code_geo']) ?>"></div>
                                    <?php endif; ?>
                                    
                                    <div class="print-details">
                                        <?php if (in_array('code_geo', $options['fields'])): ?>
                                            <div class="print-code"><?= htmlspecialchars($code['code_geo']) ?></div>
                                        <?php endif; ?>

                                        <?php if (in_array('libelle', $options['fields'])): ?>
                                            <div class="print-libelle"><?= htmlspecialchars($code['libelle']) ?></div>
                                        <?php endif; ?>
                                        
                                        <?php if (in_array('univers', $options['fields'])): ?>
                                            <div class="print-univers"><strong>Univers:</strong> <?= htmlspecialchars($code['univers']) ?></div>
                                        <?php endif; ?>

                                        <?php if (!empty($code['commentaire']) && in_array('commentaire', $options['fields'])): ?>
                                            <div class="print-comment"><strong>Note:</strong> <?= htmlspecialchars($code['commentaire']) ?></div>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            <?php endfor; ?>
                        <?php endforeach; ?>
                    </div>
                </section>
            <?php endforeach; ?>
        <?php else: ?>
            <p class="no-print" style="text-align: center; padding: 2rem;">Aucun code à imprimer pour la sélection effectuée.</p>
        <?php endif; ?>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const templateClass = document.body.className;
            let qrSize;

            if (templateClass.includes('template-qr-left')) {
                qrSize = 130; // ~35mm
            } else if (templateClass.includes('template-qr-top')) {
                qrSize = 130; // ~35mm
            } else if (templateClass.includes('template-compact')) {
                qrSize = 75;  // ~20mm
            } else {
                qrSize = 80;  // Default
            }

            document.querySelectorAll('.print-qr-code').forEach(container => {
                const codeText = container.dataset.code;
                if (codeText) {
                    new QRCode(container, { 
                        text: codeText, 
                        width: qrSize,
                        height: qrSize,
                        correctLevel : QRCode.CorrectLevel.H
                    });
                }
            });

            setTimeout(() => { 
                window.print(); 
            }, 500);
        });
    </script>
</body>
</html>
