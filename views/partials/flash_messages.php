<?php
if (isset($_SESSION['flash_message'])): 
    $flash = $_SESSION['flash_message'];
    unset($_SESSION['flash_message']);
?>
    <div id="toast-notification" class="toast <?= htmlspecialchars($flash['type']) ?>" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-message">
            <?= htmlspecialchars($flash['message']) ?>
        </div>
        <button type="button" class="toast-close" aria-label="Close">&times;</button>
    </div>
<?php endif; ?>
