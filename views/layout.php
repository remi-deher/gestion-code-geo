<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= isset($title) ? htmlspecialchars($title) : 'Gestion Code Géo' ?></title>

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

    <link rel="stylesheet" href="css/main.css">

    <?= $head_styles ?? '' ?>

</head>
<body>

    <?php include __DIR__ . '/partials/navbar.php'; // Inclut la barre de navigation ?>

    <div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 1100">
        <?php include __DIR__ . '/partials/flash_messages.php'; ?>
        </div>

    <main class="container-fluid mt-4 mb-4">
        <?= $content // Contenu spécifique de la page rendu par le contrôleur ?>
    </main>

    <footer class="app-footer mt-auto py-3 bg-light border-top no-print">
        <div class="container text-center">
            <span class="text-muted">Gestion Code Géo - &copy; <?= date('Y') ?></span>
        </div>
    </footer>

    <script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>

    <script src="https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js"></script>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" integrity="sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

    <script src="//cdnjs.cloudflare.com/ajax/libs/list.js/2.3.1/list.min.js"></script>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js" integrity="sha512-dfX5uYVXzyU8+KHqj8fcHrDrcQdSFOvJsJWFTF7TfC9CunXQ9Nmq97B4N/T+T3n30l+xP3hN+rL4FkN7A+s+Bw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js" integrity="sha512-DY4+UOB86V/hX/PeT+VF/7Kz4KDDhG+K0H4v2GfJ6+T0s5fOsdK0+6f0t8i+i1eB8L7LhLqdxqfP8w==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" integrity="sha512-r22gChDnGvBshcchBbsL+iT8K/T59B4+4Shtp9F7P/k1R/Mv0p3tQf9/rAJ/Vf/L8wQGZ5qX1W6Z0m/pU2BqUw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

//    <?= $body_scripts ?? ''

    </body>
</html>
