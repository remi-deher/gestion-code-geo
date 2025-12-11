<?php
// Fichier : config/pdo_options.php

/**
 * Ce fichier retourne une fonction anonyme qui prépare les options PDO.
 * Cela isole la complexité de la configuration SSL.
 */
return function(array $config): array {
    // 1. Options de base
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];

    // 2. Gestion du SSL
    // Si la clé 'ssl_mode' est présente et non vide
    if (!empty($config['ssl_mode'])) {
        
        // Cas spécial : mot-clé 'system' pour utiliser le magasin Debian
        if ($config['ssl_mode'] === 'system') {
            $options[PDO::MYSQL_ATTR_SSL_CA] = '/etc/ssl/certs/ca-certificates.crt';
        } 
        // Sinon, on considère que c'est un chemin personnalisé vers un fichier .pem spécifique
        else {
            $options[PDO::MYSQL_ATTR_SSL_CA] = $config['ssl_mode'];
        }

        // Sécurité : On force la vérification du certificat du serveur
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = true;
    }

    return $options;
};
