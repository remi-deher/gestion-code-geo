<?php
// Fichier : views/partials/flash_messages.php
// Génère le HTML pour les toasts venant du PHP (session)

if (isset($_SESSION['flash_message'])): 
    $flash = $_SESSION['flash_message'];
    unset($_SESSION['flash_message']); // Nettoyer la session

    // Déterminer la couleur de l'icône et de l'en-tête en fonction du type
    $toastClass = '';
    $icon = '';
    switch ($flash['type']) {
        case 'success':
            $toastClass = 'text-bg-success'; // Fond vert
            $icon = '<i class="bi bi-check-circle-fill me-2"></i>';
            break;
        case 'danger':
            $toastClass = 'text-bg-danger'; // Fond rouge
            $icon = '<i class="bi bi-exclamation-triangle-fill me-2"></i>';
            break;
        case 'warning':
            $toastClass = 'text-bg-warning'; // Fond jaune
            $icon = '<i class="bi bi-exclamation-triangle-fill me-2"></i>';
            break;
        default: // 'info' ou autre
            $toastClass = 'text-bg-info'; // Fond bleu
            $icon = '<i class="bi bi-info-circle-fill me-2"></i>';
            break;
    }
?>
    <!-- Structure de toast Bootstrap 5.3 (simplifiée, sans en-tête) -->
    <div class="toast align-items-center <?= htmlspecialchars($toastClass) ?> border-0" 
         role="alert" 
         aria-live="assertive" 
         aria-atomic="true" 
         data-bs-autohide="true" 
         data-bs-delay="5000">
        
        <div class="d-flex">
            <div class="toast-body">
                <?= $icon . ' ' . htmlspecialchars($flash['message']) ?>
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    </div>
<?php endif; ?>
