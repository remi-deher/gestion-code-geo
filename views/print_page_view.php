<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title><?= htmlspecialchars($options['title']) ?></title>
    <link rel="stylesheet" href="css/print.css">
</head>
<body class="<?= htmlspecialchars($options['layout']) ?>">
    <div class="page-container">
        <header class="print-header">
            <?php if (!empty($options['title'])): ?>
                <h1 class="page-title"><?= htmlspecialchars($options['title']) ?></h1>
            <?php endif; ?>
            <div class="print-meta no-print">
                <?php if ($options['show_date']): ?>
                    <span>Page générée le <?= date('d/m/Y H:i') ?>.</span>
                <?php endif; ?>
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
                                <div class="print-item">
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
                                            <div class="print-univers"><strong>Univers :</strong> <?= htmlspecialchars($code['univers']) ?></div>
                                        <?php endif; ?>

                                        <?php // --- LIGNE CORRIGÉE ICI ---
                                        if (!empty($code['commentaire']) && in_array('commentaire', $options['fields'])): ?>
                                            <div class="print-comment"><strong>Note :</strong> <?= htmlspecialchars($code['commentaire']) ?></div>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            <?php endfor; ?>
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
            // 1. Déterminer la taille du QR code en fonction de la classe du body
            const layout = document.body.className;
            let qrSize;

            switch(layout) {
                case 'large_2x2':
                    qrSize = 100;
                    break;
                case 'small_3x7':
                    qrSize = 50;
                    break;
                case 'medium_2x4':
                default:
                    qrSize = 80;
                    break;
            }

            // 2. Générer chaque QR code avec la taille calculée
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

            // 3. Lancer l'impression
            setTimeout(() => { window.print(); }, 500);
        });
    </script>
</body>
</html>
