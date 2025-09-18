-- Table existante pour les codes géo
CREATE TABLE IF NOT EXISTS `geo_codes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code_geo` VARCHAR(50) NOT NULL UNIQUE,
  `libelle` VARCHAR(255) NOT NULL,
  `commentaire` TEXT,
  `univers` VARCHAR(100) NOT NULL,
  `zone` ENUM('reserve', 'vente') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- NOUVELLE TABLE pour stocker la position des codes sur le plan
CREATE TABLE IF NOT EXISTS `geo_positions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `geo_code_id` INT NOT NULL,
    `pos_x` INT NOT NULL,
    `pos_y` INT NOT NULL,
    FOREIGN KEY (geo_code_id) REFERENCES geo_codes(id) ON DELETE CASCADE
);
