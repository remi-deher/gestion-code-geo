<!DOCTYPE html>
<html lang="fr">
<head>
    </head>
<body>
    <div class="page-container">
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
                                        </div>
                                </div>
                            <?php endfor; ?>
                        <?php endforeach; ?>
                    </div>
                </section>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>
    
    </body>
</html>
