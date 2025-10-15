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
<body class="template-<?= htmlspecialchars($options['template']) ?> <?= $options['cut_lines'] ? 'with-cut-lines' : '' ?> <?= $options['separate_univers'] ? 'separate-univers-print' : '' ?>">
    
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
                                        <div class="print-item">
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
            const templateClass = document.body.className;
            let qrSize;
            if (templateClass.includes('template-qr-left')) { qrSize = 130; } 
            else if (templateClass.includes('template-qr-top')) { qrSize = 130; } 
            else if (templateClass.includes('template-compact')) { qrSize = 75; }
            else if (templateClass.includes('template-ultra-compact')) { qrSize = 50; }

            document.querySelectorAll('.print-qr-code').forEach(container => {
                if(qrSize > 0) {
                    const codeText = container.dataset.code;
                    if (codeText) {
                        new QRCode(container, { text: codeText, width: qrSize, height: qrSize, correctLevel : QRCode.CorrectLevel.H });
                    }
                }
            });

            // --- Logique de pagination avant impression ---
            const showFooter = <?= json_encode($options['show_footer']) ?>;
            if (showFooter) {
                const separateUnivers = document.body.classList.contains('separate-univers-print');
                const pageHeight = 297 - (<?= $margins ?> * 2); // Hauteur imprimable A4 en mm
                let totalPageCount = 0;

                document.querySelectorAll('.univers-container').forEach(container => {
                    const contentHeight = container.querySelector('.univers-group').offsetHeight * 0.264583; // px to mm
                    const pagesInUnivers = Math.max(1, Math.ceil(contentHeight / pageHeight));
                    
                    for (let i = 1; i <= pagesInUnivers; i++) {
                        const pageClone = document.createElement('div');
                        pageClone.className = 'print-page-clone';

                        const header = document.createElement('div');
                        header.className = 'print-page-header';
                        header.textContent = "<?= htmlspecialchars($options['title'] ?? '') ?>";
                        
                        const footer = document.createElement('div');
                        footer.className = 'print-page-footer';
                        
                        if (separateUnivers) {
                            footer.innerHTML = `Généré le <?= date('d/m/Y') ?> - ${container.dataset.universName} - Page ${i} / ${pagesInUnivers}`;
                        } else {
                            footer.innerHTML = `Généré le <?= date('d/m/Y') ?> - Page ${totalPageCount + i}`;
                        }
                        
                        pageClone.appendChild(header);
                        pageClone.appendChild(footer);
                        container.appendChild(pageClone);
                    }
                    totalPageCount += pagesInUnivers;
                });

                // Mettre à jour le total global si nécessaire
                if (!separateUnivers) {
                    document.querySelectorAll('.print-page-footer').forEach(footer => {
                        footer.innerHTML += ` / ${totalPageCount}`;
                    });
                }
            }

            setTimeout(() => { 
                window.print(); 
            }, 500);
        });
    </script>
</body>
</html>
