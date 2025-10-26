<?php
// Fichier: controllers/BaseController.php

class BaseController {
    
    /**
     * Gère le rendu d'une vue à l'intérieur du layout principal.
     * @param string $view Le nom du fichier de la vue (sans .php)
     * @param array $data Les données à passer à la vue
     * @param bool $useLayout Indique si le layout principal doit être utilisé (false pour les vues fullscreen).
     */
    protected function render(string $view, array $data = [], bool $useLayout = true) {
        // Extrait les clés du tableau associatif en variables
        // ex: ['title' => 'Mon Titre'] devient $title = 'Mon Titre';
        extract($data);
        
        // Démarre la mise en mémoire tampon de la sortie
        ob_start();
        
        // Inclut le fichier de la vue spécifique (ex: geo_codes_list_view.php)
        // Son contenu est maintenant dans le tampon
        require __DIR__ . '/../views/' . $view . '.php';
        
        // Récupère le contenu du tampon dans la variable $content et nettoie le tampon
        $content = ob_get_clean();
        
        // Inclut le layout principal, qui a maintenant accès à toutes les variables
        // extraites et à la variable $content.
        if ($useLayout) { // Ajout de la condition
            require __DIR__ . '/../views/layout.php';
        } else {
             // Si on n'utilise pas le layout, on affiche juste le contenu (qui est la page HTML complète)
             echo $content;
        }
    }
}
