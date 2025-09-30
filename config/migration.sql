-- migration_cloture.sql
-- Script pour migrer vers le nouveau système de clôture.
-- Exécutez ce script UNE SEULE FOIS.

-- Étape 1 : Créer la nouvelle table si elle n'existe pas déjà.
CREATE TABLE IF NOT EXISTS `cloture_caisse_data` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `caisse_id` INT(11) NOT NULL,
  `date_cloture` DATETIME NOT NULL,
  `data_json` JSON NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `caisse_id` (`caisse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Étape 2 : Supprimer la table `cloture_status` qui n'est plus utilisée.
DROP TABLE IF EXISTS `cloture_status`;
