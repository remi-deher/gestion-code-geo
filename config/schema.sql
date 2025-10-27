-- Fichier de schéma SQL complet et corrigé pour le projet de gestion de codes géo.

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Table `univers` (Table mère des codes géo)
--
CREATE TABLE IF NOT EXISTS `univers` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nom` VARCHAR(100) NOT NULL UNIQUE,
  `zone_assignee` ENUM('vente','reserve') NOT NULL DEFAULT 'vente',
  `color` VARCHAR(7) NOT NULL DEFAULT '#3498db',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table `assets` (Déduite de votre dump initial)
--
CREATE TABLE IF NOT EXISTS `assets` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `type` ENUM('image','svg','group','raw','fabric') NOT NULL DEFAULT 'raw',
  `data` LONGTEXT DEFAULT NULL COMMENT 'Données brutes ou JSON/SVG de l''asset',
  `nom_fichier` VARCHAR(255) DEFAULT NULL,
  `thumbnail` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table `geo_codes` (Codes géo référençant univers)
--
CREATE TABLE IF NOT EXISTS `geo_codes` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `code_geo` VARCHAR(50) NOT NULL UNIQUE,
  `libelle` VARCHAR(255) NOT NULL,
  `commentaire` TEXT DEFAULT NULL,
  `zone` ENUM('reserve','vente') NOT NULL,
  `univers_id` INT(11) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`univers_id`) REFERENCES `univers`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table `plans` (Plans de la pharmacie)
--
CREATE TABLE IF NOT EXISTS `plans` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nom` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `type` ENUM('image','pdf','svg','drawing') NOT NULL DEFAULT 'image',
  `nom_fichier` VARCHAR(255) NOT NULL,
  `zone` ENUM('reserve','vente') DEFAULT NULL,
  `drawing_data` LONGTEXT DEFAULT NULL COMMENT 'Stocke les annotations Fabric.js (SAUF les codes géo) au format JSON',
  `page_format` VARCHAR(10) DEFAULT NULL COMMENT 'Format de page (ex: A4-P, A3-L)',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table `plan_univers` (Table de liaison Many-to-Many entre plans et univers)
--
CREATE TABLE IF NOT EXISTS `plan_univers` (
  `plan_id` INT(11) NOT NULL,
  `univers_id` INT(11) NOT NULL,
  PRIMARY KEY (`plan_id`,`univers_id`),
  FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`univers_id`) REFERENCES `univers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table `geo_positions` (La table qui contient la position des codes géo sur un plan donné)
-- C'est la source unique de vérité pour la position, non le drawing_data.
--
CREATE TABLE IF NOT EXISTS `geo_positions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `geo_code_id` INT(11) NOT NULL,
  `plan_id` INT(11) NOT NULL,
  `pos_x` FLOAT NOT NULL,
  `pos_y` FLOAT NOT NULL,
  `width` INT DEFAULT NULL,
  `height` INT DEFAULT NULL,
  `anchor_x` FLOAT DEFAULT 0.5,
  `anchor_y` FLOAT DEFAULT 0.5,
  `properties` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_geocode_plan` (`geo_code_id`,`plan_id`),
  FOREIGN KEY (geo_code_id) REFERENCES `geo_codes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES `plans`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table `geo_positions_history` (Historique des mouvements de codes géo)
--
CREATE TABLE IF NOT EXISTS `geo_positions_history` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `geo_code_id` INT(11) NOT NULL,
  `plan_id` INT(11) NOT NULL,
  `pos_x` FLOAT DEFAULT NULL,
  `pos_y` FLOAT DEFAULT NULL,
  `action_type` ENUM('placed','moved','removed') NOT NULL,
  `action_timestamp` TIMESTAMP NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `geo_code_id_idx` (`geo_code_id`),
  KEY `plan_id_idx` (`plan_id`),
  FOREIGN KEY (geo_code_id) REFERENCES `geo_codes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES `plans`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table `geo_codes_history` (Historique des modifications du code géo, déduite de votre dump)
--
CREATE TABLE IF NOT EXISTS `geo_codes_history` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `geo_code_id` INT(11) NOT NULL,
  `code_geo` VARCHAR(50) NOT NULL,
  `libelle` VARCHAR(255) NOT NULL,
  `commentaire` TEXT DEFAULT NULL,
  `action_type` ENUM('create','update','delete','restore') NOT NULL,
  `action_timestamp` TIMESTAMP NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
