<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title><?= htmlspecialchars($options['title'] ?? 'Impression des Étiquettes') ?></title>
    <link rel="stylesheet" href="css/print.css">

    <?php
        $pageSize = $options['page_size'] ?? 'A4';
        $orientation = $options['orientation'] ?? 'portrait';
        $margins = (int)($options['margins'] ?? 10);
        $columns = (int)($options['columns'] ?? 2);
        $gap = (int)($options['gap'] ?? 4);
    ?>
    <style>
        :root {
            --grid-gap: <?= $gap ?>mm;
        }

        @media print {
            @page {
                size: <?= htmlspecialchars($pageSize) ?> <?= htmlspecialchars($orientation) ?>;
                margin: <?= $margins ?>mm;
            }

            .print-grid {
                grid-template-columns: repeat(<?= $columns ?>, 1fr);
            }
        }
    </style>
</head>
<body class="template-<?= htmlspecialchars($options['template']) ?> <?= $options['cut_lines'] ? 'with-cut-lines' : '' ?>">
    
    <div class="page-container">
        <header class="print-header no-print">
            <?php if (!empty($options['title'])): ?>
                <h1 class="page-title"><?= htmlspecialchars($options['title']) ?></h1>
            <?php endif; ?>
            <div class="print-meta">
                <span>Page générée le <?= date('d/m/Y H:i') ?>. L'aperçu avant impression va s'ouvrir.</span>
                <button onclick="window.print()"><i class="bi bi-printer-fill"></i> Ré-imprimer</button>
            </div>
        </header>

        <div id="print-content">
            <?php if (!empty($groupedCodes)): ?>
                <?php foreach ($groupedCodes as $univers => $codes): ?>
                    <div class="univers-container" data-univers-name="<?= htmlspecialchars($univers) ?>">
                        <section class="univers-group">
                            <h2 class="univers-title"><?= htmlspecialchars($univers) ?></h2>
                            <div class="print-grid">
                                <?php foreach ($codes as $code): ?>
                                    <?php for ($i = 0; $i < $options['copies']; $i++): ?>
                                        <div class="print-item template-<?= htmlspecialchars($options['template']) ?>">
                                            <?php if (in_array('qrcode', $options['fields'])): ?><div class="print-qr-code" data-code="<?= htmlspecialchars($code['code_geo']) ?>"></div><?php endif; ?>
                                            <div class="print-details">
                                                <?php if (in_array('code_geo', $options['fields'])): ?><div class="print-code"><?= htmlspecialchars($code['code_geo']) ?></div><?php endif; ?>
                                                <?php if (in_array('libelle', $options['fields'])): ?><div class="print-libelle"><?= htmlspecialchars($code['libelle']) ?></div><?php endif; ?>
                                                <?php if (in_array('univers', $options['fields'])): ?><div class="print-univers"><strong>Univers:</strong> <?= htmlspecialchars($code['univers']) ?></div><?php endif; ?>
                                                <?php if (!empty($code['commentaire']) && in_array('commentaire', $options['fields'])): ?><div class="print-comment"><strong>Note:</strong> <?= htmlspecialchars($code['commentaire']) ?></div><?php endif; ?>
                                            </div>
                                        </div>
                                    <?php endfor; ?>
                                <?php endforeach; ?>
                            </div>
                        </section>
                    </div>
                <?php endforeach; ?>
            <?php else: ?>
                <p class="no-print" style="text-align: center; padding: 2rem;">Aucun code à imprimer pour la sélection effectuée.</p>
            <?php endif; ?>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            // --- Génération des QR Codes (inchangé) ---
            const templateClass = document.body.className;
            let qrSize;
            if (templateClass.includes('template-qr-left')) { qrSize = 130; } 
            else if (templateClass.includes('template-qr-top')) { qrSize = 130; } 
            else if (templateClass.includes('template-compact')) { qrSize = 75; } 
            else { qrSize = 80; }

            document.querySelectorAll('.print-qr-code').forEach(container => {
                const codeText = container.dataset.code;
                if (codeText) {
                    new QRCode(container, { text: codeText, width: qrSize, height: qrSize, correctLevel : QRCode.CorrectLevel.H });
                }
            });

            // --- NOUVEAU : Logique de pagination ---
            const showFooter = <?= json_encode($options['show_footer']) ?>;
            const separateUnivers = <?= json_encode($options['separate_univers']) ?>;

            if (showFooter) {
                // Pour chaque univers, on crée un en-tête et un pied de page
                document.querySelectorAll('.univers-container').forEach(container => {
                    const header = document.createElement('div');
                    header.className = 'print-page-header';
                    header.setAttribute('aria-hidden', 'true');
                    header.textContent = "<?= htmlspecialchars($options['title'] ?? '') ?>";
                    
                    const footer = document.createElement('div');
                    footer.className = 'print-page-footer';
                    footer.setAttribute('aria-hidden', 'true');

                    if (separateUnivers) {
                        // Pagination par univers : Page X / Y (pour cet univers)
                        footer.innerHTML = `Généré le <?= date('d/m/Y') ?> - ${container.dataset.universName} - Page <span class="page-number-in-univers"></span> / <span class="total-pages-in-univers"></span>`;
                    } else {
                        // Pagination globale : Page X / Y (total)
                        footer.innerHTML = `Généré le <?= date('d/m/Y') ?> - Page <span class="page-number-total"></span> / <span class="total-pages"></span>`;
                    }
                    
                    container.prepend(header);
                    container.append(footer);
                });
            }

            // Lance l'impression après un court délai pour laisser le temps aux QR codes de se générer
            setTimeout(() => { 
                window.print(); 
            }, 500);
        });
    </script>
</body>
</html>
