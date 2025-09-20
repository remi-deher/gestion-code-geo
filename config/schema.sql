-- config/schema.sql

-- Table pour gérer la liste des univers de produits
CREATE TABLE IF NOT EXISTS `univers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nom` VARCHAR(100) NOT NULL UNIQUE,
  `zone_assignee` ENUM('reserve', 'vente') NOT NULL DEFAULT 'vente',
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
  FOREIGN KEY (univers_id) REFERENCES univers(id) ON DELETE RESTRICT
);

-- Table pour gérer les plans du magasin (MODIFIÉE)
CREATE TABLE IF NOT EXISTS `plans` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nom` VARCHAR(255) NOT NULL,
  `nom_fichier` VARCHAR(255) NOT NULL,
  `zone` ENUM('reserve', 'vente') DEFAULT NULL, -- NOUVEAU: Zone associée au plan
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NOUVELLE TABLE pour lier les plans et les univers
CREATE TABLE IF NOT EXISTS `plan_univers` (
  `plan_id` INT NOT NULL,
  `univers_id` INT NOT NULL,
  PRIMARY KEY (`plan_id`, `univers_id`), -- Clé primaire composite
  FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`univers_id`) REFERENCES `univers`(`id`) ON DELETE CASCADE
);

-- Table pour les positions des codes géo sur les plans
CREATE TABLE IF NOT EXISTS `geo_positions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `geo_code_id` INT NOT NULL UNIQUE,
    `plan_id` INT NOT NULL,
    `pos_x` INT NOT NULL,
    `pos_y` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (geo_code_id) REFERENCES geo_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);
