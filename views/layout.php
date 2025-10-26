<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $title ?? 'Gestion Code Géo' ?></title>

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" xintegrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

    <link rel="stylesheet" href="css/main.css">
    <?= $head_styles ?? '' ?>

</head>
<body>

    <?php include 'partials/navbar.php'; // Inclut la barre de navigation ?>

    <!-- =============================================== -->
    <!-- NOUVEAU CONTENEUR DE TOASTS GLOBAL -->
    <!-- =============================================== -->
    <div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 1100">
        <!-- Les toasts PHP (flash messages) seront insérés ici -->
        <?php include __DIR__ . '/partials/flash_messages.php'; ?>
        <!-- Les toasts JS (via showToast) seront aussi ajoutés ici -->
    </div>


    <main class="container-fluid">
        <!-- L'ancien include des flash_messages a été RETIRÉ d'ici -->
        <?= $content // Contenu spécifique de la page rendu par le contrôleur ?>
    </main>

    <footer class="app-footer mt-auto py-3 bg-light no-print">
        <div class="container text-center">
            <span class="text-muted">Gestion Code Géo - &copy; <?= date('Y') ?></span>
        </div>
    </footer>

    <!-- Scripts JS (ordre important) -->
    <!-- Dépendances (Bootstrap, QR, Fabric, List, etc.) -->
    <script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" xintegrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js" xintegrity="sha512-P6uimDKoj1nnPSo2sPmgbZy99pPq9nHXhLwddOnLi1DC+fEM83FEUcHPRPifbx1rlRkdMinViaWyDfG45G9BuA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" xintegrity="sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/list.js/2.3.1/list.min.js"></script>

    <!-- Scripts de la page (définis dans la vue) -->
    <?= $body_scripts ?? '' ?>

    <!-- Offcanvas des Assets (conservé) -->
    <div class="offcanvas offcanvas-end no-print" tabindex="-1" id="assetsOffcanvas" aria-labelledby="assetsOffcanvasLabel">
      <div class="offcanvas-header">
        <h5 id="assetsOffcanvasLabel"><i class="bi bi-star-fill"></i> Mes Assets</h5>
        <button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
      </div>
      <div class="offcanvas-body">
        <button id="save-asset-btn" class="btn btn-success mb-3 w-100">
            <i class="bi bi-plus-circle-fill"></i> Sauvegarder la sélection comme Asset
        </button>
        <hr>
        <h6>Assets disponibles :</h6>
        <div id="assets-list" class="mt-2">
          <p class="text-muted">Chargement...</p>
        </div>
      </div>
    </div>

</body>
</html>
