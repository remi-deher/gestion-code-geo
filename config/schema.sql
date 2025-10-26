-- config/schema.sql - Schéma final pour le projet de gestion des plans et assets

-- Table `univers`
CREATE TABLE `univers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nom` VARCHAR(100) NOT NULL UNIQUE,
  `zone_assignee` ENUM('reserve', 'vente') NOT NULL DEFAULT 'vente',
  `color` VARCHAR(7) NOT NULL DEFAULT '#3498db',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table `geo_codes`
CREATE TABLE `geo_codes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code_geo` VARCHAR(50) NOT NULL UNIQUE,
  `libelle` VARCHAR(255) NOT NULL,
  `commentaire` TEXT DEFAULT NULL,
  `zone` ENUM('reserve','vente') NOT NULL,
  `univers_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (univers_id) REFERENCES univers(id) ON DELETE RESTRICT
);

-- Table `plans`
CREATE TABLE `plans` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nom` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `type` ENUM('image', 'svg', 'pdf') NOT NULL DEFAULT 'image',
  `nom_fichier` VARCHAR(255) NOT NULL,
  `zone` ENUM('reserve','vente') DEFAULT NULL,
  `drawing_data` LONGTEXT DEFAULT NULL COMMENT 'Stocke les annotations Fabric.js au format JSON',
  `page_format` VARCHAR(10) DEFAULT NULL COMMENT 'Format de page (ex: A4-P, A3-L)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL
);

-- Table `plan_univers` (Liaison Plans <-> Univers)
CREATE TABLE `plan_univers` (
  `plan_id` INT NOT NULL,
  `univers_id` INT NOT NULL,
  PRIMARY KEY (`plan_id`, `univers_id`),
  FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`univers_id`) REFERENCES `univers`(`id`) ON DELETE CASCADE
);

-- Table `geo_positions`
CREATE TABLE `geo_positions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `geo_code_id` INT NOT NULL,
  `plan_id` INT NOT NULL,
  `pos_x` FLOAT NOT NULL,
  `pos_y` FLOAT NOT NULL,
  `width` INT DEFAULT NULL,
  `height` INT DEFAULT NULL,
  `anchor_x` FLOAT DEFAULT 0.5,
  `anchor_y` FLOAT DEFAULT 0.5,
  `properties` JSON NULL, -- Pour stocker la customisation du code géo
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_geocode_plan` (`geo_code_id`,`plan_id`),
  FOREIGN KEY (geo_code_id) REFERENCES `geo_codes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES `plans`(`id`) ON DELETE CASCADE
);

-- Table `assets`
CREATE TABLE `assets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `type` ENUM('image', 'svg', 'group', 'raw') NOT NULL DEFAULT 'raw',
  `data` LONGTEXT NOT NULL,
  `nom_fichier` VARCHAR(255) DEFAULT NULL,
  `thumbnail` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table `geo_codes_history`
CREATE TABLE `geo_codes_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `geo_code_id` INT NOT NULL,
  `action_type` ENUM('created','updated','deleted','restored') NOT NULL,
  `details` TEXT DEFAULT NULL,
  `action_timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (geo_code_id) REFERENCES `geo_codes`(`id`) ON DELETE CASCADE
);

-- Table `geo_positions_history`
CREATE TABLE `geo_positions_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `geo_code_id` INT NOT NULL,
  `plan_id` INT NOT NULL,
  `pos_x` FLOAT DEFAULT NULL,
  `pos_y` FLOAT DEFAULT NULL,
  `action_type` ENUM('placed','moved','removed') NOT NULL,
  `action_timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `geo_code_id_idx` (`geo_code_id`),
  KEY `plan_id_idx` (`plan_id`)
);
