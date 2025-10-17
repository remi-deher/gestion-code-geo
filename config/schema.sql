-- config/schema.sql

-- Table pour gérer la liste des univers de produits
CREATE TABLE IF NOT EXISTS `univers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nom` VARCHAR(100) NOT NULL UNIQUE,
  `zone_assignee` ENUM('reserve', 'vente') NOT NULL DEFAULT 'vente',
  `color` VARCHAR(7) DEFAULT '#3498db', -- Ajout de la colonne couleur
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
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (univers_id) REFERENCES univers(id) ON DELETE RESTRICT
);

-- Table pour gérer les plans du magasin (MODIFIÉE pour drawing_data)
CREATE TABLE IF NOT EXISTS `plans` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nom` VARCHAR(255) NOT NULL,
  `nom_fichier` VARCHAR(255) NOT NULL,
  `zone` ENUM('reserve', 'vente') DEFAULT NULL,
  `drawing_data` TEXT DEFAULT NULL COMMENT 'Stocke les annotations Fabric.js au format JSON', -- NOUVELLE COLONNE
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NOUVELLE TABLE pour lier les plans et les univers
CREATE TABLE IF NOT EXISTS `plan_univers` (
  `plan_id` INT NOT NULL,
  `univers_id` INT NOT NULL,
  PRIMARY KEY (`plan_id`, `univers_id`),
  FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`univers_id`) REFERENCES `univers`(`id`) ON DELETE CASCADE
);

-- Table pour les positions des codes géo sur les plans
CREATE TABLE IF NOT EXISTS `geo_positions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `geo_code_id` INT NOT NULL,
    `plan_id` INT NOT NULL,
    `pos_x` FLOAT NOT NULL, -- Changé en FLOAT pour pourcentage précis
    `pos_y` FLOAT NOT NULL, -- Changé en FLOAT pour pourcentage précis
    `width` INT NULL,
    `height` INT NULL,
    `anchor_x` FLOAT DEFAULT NULL, -- Changé en FLOAT
    `anchor_y` FLOAT DEFAULT NULL, -- Changé en FLOAT
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (geo_code_id) REFERENCES geo_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    -- Si vous permettez plusieurs fois le même code sur un plan, pas besoin d'index unique ici.
);

-- NOUVELLE TABLE pour l'historique des positions des codes géo
CREATE TABLE IF NOT EXISTS `geo_positions_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `geo_code_id` INT NOT NULL,
  `plan_id` INT NOT NULL,
  `pos_x` FLOAT NULL, -- Changé en FLOAT
  `pos_y` FLOAT NULL, -- Changé en FLOAT
  `action_type` ENUM('placed', 'moved', 'removed') NOT NULL,
  `action_timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `geo_code_id_idx` (`geo_code_id`),
  KEY `plan_id_idx` (`plan_id`)
);

-- NOUVELLE TABLE pour l'historique des codes géo
CREATE TABLE IF NOT EXISTS `geo_codes_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `geo_code_id` INT NOT NULL,
  `action_type` ENUM('created', 'updated', 'deleted', 'restored') NOT NULL,
  `details` TEXT,
  `action_timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (geo_code_id) REFERENCES geo_codes(id) ON DELETE CASCADE -- Ajout pour nettoyage si code supprimé
);
