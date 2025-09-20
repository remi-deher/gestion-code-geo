<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF--8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $title ?? 'Gestion Code Géo' ?></title>
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <link rel="stylesheet" href="css/main.css"> 
    
    <?= $head_styles ?? '' ?>
</head>
<body>
    <?php include 'partials/navbar.php'; ?>

    <main>
        <?= $content ?>
    </main>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <?= $body_scripts ?? '' ?>
</body>
</html>
