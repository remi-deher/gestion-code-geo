<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title><?= $title ?? 'Gestion Code Géo' ?></title>

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

    <link rel="stylesheet" href="css/main.css"> <?= $head_styles ?? '' ?>

    </head>
<body>
    <?php include 'partials/navbar.php'; // Inclut la barre de navigation ?>

    <main>
        <?php include 'partials/flash_messages.php'; // Inclut le système de messages flash ?>
        <?= $content // Contenu spécifique de la page rendu par le contrôleur ?>
    </main>

    <footer class="app-footer mt-auto py-3 bg-light no-print"> <div class="container text-center">
            <span class="text-muted">Gestion Code Géo - &copy; <?= date('Y') ?></span>
            </div>
    </footer>


    <script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>

    <script src="https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js"></script> <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js" 
            integrity="sha512-P6uimDKoj1nnPSo2sPmgbZy99pPq9nHXhLwddOnLi1DC+fEM83FEUcHPRPifbx1rlRkdMinViaWyDfG45G9BuA==" 
            crossorigin="anonymous" 
            referrerpolicy="no-referrer"></script> <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" integrity="sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script> <script src="//cdnjs.cloudflare.com/ajax/libs/list.js/2.3.1/list.min.js"></script>

    <?= $body_scripts ?? '' ?>

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

    <script>
        document.addEventListener('DOMContentLoaded', function () {
            var toastElList = [].slice.call(document.querySelectorAll('.toast:not(.hide)')); // Sélectionne les toasts qui ne sont pas déjà cachés
            var toastList = toastElList.map(function (toastEl) {
                const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 5000 }); // Auto-hide après 5s
                toast.show();
                 // Ajouter un bouton de fermeture manuel s'il existe
                const closeButton = toastEl.querySelector('.toast-close');
                 if(closeButton){
                     closeButton.addEventListener('click', () => toast.hide());
                 }
                return toast;
            });
        });
    </script>
</body>
</html>
