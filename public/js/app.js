// Fichier : public/js/app.js

document.addEventListener('DOMContentLoaded', () => {
    
    // Génère les QR Codes pour la liste existante
    const qrCodeContainers = document.querySelectorAll('.qr-code-container');
    
    qrCodeContainers.forEach(container => {
        const codeText = container.dataset.code; // Récupère le code depuis l'attribut data-code
        if (codeText) {
            new QRCode(container, {
                text: codeText,
                width: 80,
                height: 80,
            });
        }
    });

    // Vous pourrez ajouter ici la logique pour la prévisualisation du QR Code du formulaire,
    // la recherche dynamique, etc.
    
    console.log("app.js chargé et exécuté !");
});
