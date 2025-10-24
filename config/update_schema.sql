-- Active le mode SQL strict pour une meilleure intégrité des données (optionnel mais recommandé)
-- SET SQL_MODE = "STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION";

-- Table des Univers
CREATE TABLE IF NOT EXISTS `univers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL UNIQUE,
  `couleur` varchar(7) DEFAULT '#FFFFFF', -- Couleur hexadécimale
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table des Codes Géo
CREATE TABLE IF NOT EXISTS `geo_codes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code_geo` varchar(50) NOT NULL UNIQUE,
  `libelle` varchar(255) DEFAULT NULL,
  `commentaire` text DEFAULT NULL,
  `zone` varchar(100) DEFAULT NULL,
  `univers_id` int(11) NULL DEFAULT NULL, -- Clé étrangère vers univers (NULL si pas d'univers)
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(), -- Ajouté pour cohérence
  `deleted_at` timestamp NULL DEFAULT NULL, -- Ajouté pour soft delete
  PRIMARY KEY (`id`),
  KEY `idx_geo_codes_univers_id` (`univers_id`),
  CONSTRAINT `fk_geo_codes_univers` FOREIGN KEY (`univers_id`) REFERENCES `univers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE -- Permet NULL et met à jour/supprime en cascade
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table de liaison Géo Codes <-> Univers (obsolète si univers_id est dans geo_codes, mais gardée pour compatibilité si ancien code l'utilise)
CREATE TABLE IF NOT EXISTS `geo_code_univers` (
  `geo_code_id` int(11) NOT NULL,
  `univers_id` int(11) NOT NULL,
  PRIMARY KEY (`geo_code_id`,`univers_id`),
  KEY `idx_gcu_geo_code_id` (`geo_code_id`),
  KEY `idx_gcu_univers_id` (`univers_id`),
  CONSTRAINT `fk_gcu_geo_codes` FOREIGN KEY (`geo_code_id`) REFERENCES `geo_codes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_gcu_univers` FOREIGN KEY (`univers_id`) REFERENCES `univers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table des Plans (AVEC LES NOUVELLES COLONNES)
CREATE TABLE IF NOT EXISTS `plans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,                      -- Ajouté
  `type` varchar(50) DEFAULT 'image',                 -- Ajouté ('image', 'svg')
  `nom_fichier` varchar(255) DEFAULT NULL,            -- Chemin relatif vers l'image/SVG original
  `json_path` varchar(255) DEFAULT NULL,              -- Ajouté: Chemin relatif vers le fichier JSON sauvegardé
  `drawing_data` longtext DEFAULT NULL,               -- Ajouté: Annotations JSON pour plans 'image'
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(), -- Ajouté
  `deleted_at` timestamp NULL DEFAULT NULL,             -- Ajouté (pour soft delete)
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table de liaison Plans <-> Univers
CREATE TABLE IF NOT EXISTS `plan_univers` (
  `plan_id` int(11) NOT NULL,
  `univers_id` int(11) NOT NULL,
  PRIMARY KEY (`plan_id`,`univers_id`),
  KEY `idx_pu_plan_id` (`plan_id`),
  KEY `idx_pu_univers_id` (`univers_id`),
  CONSTRAINT `fk_pu_plans` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pu_univers` FOREIGN KEY (`univers_id`) REFERENCES `univers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table des Positions Géo
CREATE TABLE IF NOT EXISTS `geo_positions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `geo_code_id` int(11) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `pos_x` float NOT NULL, -- Position X en %
  `pos_y` float NOT NULL, -- Position Y en %
  `width` int(11) DEFAULT NULL, -- Largeur en pixels (optionnel)
  `height` int(11) DEFAULT NULL, -- Hauteur en pixels (optionnel)
  `anchor_x` float DEFAULT 0.5, -- Point d'ancrage X en % (0=gauche, 0.5=centre, 1=droite)
  `anchor_y` float DEFAULT 0.5, -- Point d'ancrage Y en % (0=haut, 0.5=centre, 1=bas)
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(), -- Utile ici aussi
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_geocode_plan` (`geo_code_id`,`plan_id`), -- Assurer qu'un code géo n'est placé qu'une fois par plan (SI C'EST LA REGLE VOULUE)
  KEY `idx_gp_geo_code_id` (`geo_code_id`),
  KEY `idx_gp_plan_id` (`plan_id`),
  CONSTRAINT `fk_gp_geo_codes` FOREIGN KEY (`geo_code_id`) REFERENCES `geo_codes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_gp_plans` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table d'Historique des Positions Géo
CREATE TABLE IF NOT EXISTS `geo_positions_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `geo_code_id` int(11) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `pos_x` float NOT NULL,
  `pos_y` float NOT NULL,
  `action` varchar(50) DEFAULT 'placé', -- 'placé', 'déplacé', 'supprimé' (Gardé ici, même si code PHP ne l'utilise plus)
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_gph_plan_id` (`plan_id`),
  KEY `idx_gph_geo_code_id` (`geo_code_id`),
  KEY `idx_gph_timestamp` (`timestamp`)
  -- Pas de clés étrangères ici pour éviter de bloquer la suppression des codes/plans
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- --------------------------------------------------------------------------
-- Commandes ALTER TABLE pour ajouter les colonnes à une table 'plans' existante
-- Exécutez ces commandes si la table 'plans' existe déjà mais sans ces colonnes.
-- Ignorez les erreurs "Duplicate column name" si les colonnes existent déjà.
-- --------------------------------------------------------------------------

ALTER TABLE `plans` ADD COLUMN IF NOT EXISTS `description` TEXT DEFAULT NULL AFTER `nom`;
ALTER TABLE `plans` ADD COLUMN IF NOT EXISTS `type` VARCHAR(50) DEFAULT 'image' AFTER `description`;
ALTER TABLE `plans` ADD COLUMN IF NOT EXISTS `json_path` VARCHAR(255) DEFAULT NULL AFTER `nom_fichier`;
ALTER TABLE `plans` ADD COLUMN IF NOT EXISTS `drawing_data` LONGTEXT DEFAULT NULL AFTER `json_path`;
ALTER TABLE `plans` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`;
ALTER TABLE `plans` ADD COLUMN IF NOT EXISTS `deleted_at` TIMESTAMP NULL DEFAULT NULL AFTER `updated_at`;

-- Optionnel: Ajouter 'updated_at' et 'deleted_at' à geo_codes si besoin de cohérence
ALTER TABLE `geo_codes` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`;
ALTER TABLE `geo_codes` ADD COLUMN IF NOT EXISTS `deleted_at` TIMESTAMP NULL DEFAULT NULL AFTER `updated_at`;

-- Optionnel: Ajouter 'updated_at' à univers
ALTER TABLE `univers` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`;

-- Optionnel: Ajouter 'updated_at' à geo_positions si elle manque
ALTER TABLE `geo_positions` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`;

 Mettre à jour la valeur initiale de updated_at là où elle vient d'être ajoutée (optionnel)
 UPDATE `plans` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;
 UPDATE `geo_codes` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;
 UPDATE `univers` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;
 UPDATE `geo_positions` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;

