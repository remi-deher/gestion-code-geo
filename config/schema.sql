-- NOUVELLE TABLE pour gérer la liste des univers
CREATE TABLE IF NOT EXISTS `univers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nom` VARCHAR(100) NOT NULL UNIQUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table existante pour les codes géo (MODIFIÉE)
CREATE TABLE IF NOT EXISTS `geo_codes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code_geo` VARCHAR(50) NOT NULL UNIQUE,
  `libelle` VARCHAR(255) NOT NULL,
  `commentaire` TEXT,
  -- `univers` VARCHAR(100) NOT NULL, -- Ancienne colonne
  `univers_id` INT NOT NULL, -- Nouvelle colonne
  `zone` ENUM('reserve', 'vente') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (univers_id) REFERENCES univers(id) ON DELETE RESTRICT -- Lier les tables
);

-- Table pour les positions (inchangée)
CREATE TABLE IF NOT EXISTS `geo_positions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `geo_code_id` INT NOT NULL,
    `pos_x` INT NOT NULL,
    `pos_y` INT NOT NULL,
    FOREIGN KEY (geo_code_id) REFERENCES geo_codes(id) ON DELETE CASCADE
);
