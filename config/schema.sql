-- config/schema.sql

-- Table pour gérer la liste des univers de produits
CREATE TABLE IF NOT EXISTS `univers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nom` VARCHAR(100) NOT NULL UNIQUE,
  `zone_assignee` ENUM('reserve', 'vente') NOT NULL DEFAULT 'vente', -- Colonne modifiée pour ajouter une zone par défaut
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour les codes géo
CREATE TABLE IF NOT EXISTS `geo_codes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code_geo` VARCHAR(50) NOT NULL UNIQUE,
  `libelle` VARCHAR(255) NOT NULL,
  `commentaire` TEXT,
  `univers_id` INT NOT NULL,
  `zone` ENUM('reserve', 'vente') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (univers_id) REFERENCES univers(id) ON DELETE RESTRICT -- Empêche la suppression d'un univers utilisé
);

-- NOUVELLE TABLE pour gérer les plans du magasin
CREATE TABLE IF NOT EXISTS `plans` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nom` VARCHAR(255) NOT NULL,
  `nom_fichier` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour les positions des codes géo sur les plans (MODIFIÉE)
CREATE TABLE IF NOT EXISTS `geo_positions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `geo_code_id` INT NOT NULL UNIQUE, -- Un code géo ne peut avoir qu'une seule position
    `plan_id` INT NOT NULL, -- NOUVEAU: Référence au plan sur lequel le code est placé
    `pos_x` INT NOT NULL,
    `pos_y` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (geo_code_id) REFERENCES geo_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE -- Si un plan est supprimé, ses positions le sont aussi
);
