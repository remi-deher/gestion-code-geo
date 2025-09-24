<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $title ?? 'Gestion Code Géo' ?></title>
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    
    <link rel="stylesheet" href="css/main.css"> 
    
    <?= $head_styles ?? '' ?>
</head>
<body>
    <?php include 'partials/navbar.php'; ?>

    <main>
        <?= $content ?>
    </main>
    
    <footer class="app-footer">
        <div class="container">
            <div class="footer-content">
                <span>© <?= date('Y') ?> - Rémi Deher | Version 1.0.0</span>
                <span class="footer-links">
                    <a href="https://github.com/remi-deher/gestion-code-geo" target="_blank">
                        <i class="bi bi-github"></i> GitHub
                    </a>
                    <a href="https://opensource.org/licenses/MIT" target="_blank">Licence MIT</a>
                </span>
            </div>
        </div>
    </footer>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <?= $body_scripts ?? '' ?>
</body>
</html>
