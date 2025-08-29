-- config/schema.sql - Nouvelle version normalisée avec table des retraits

CREATE TABLE IF NOT EXISTS `comptages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom_comptage` varchar(255) NOT NULL,
  `date_comptage` datetime NOT NULL,
  `explication` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `caisses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom_caisse` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `comptage_details` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `comptage_id` int(11) NOT NULL,
  `caisse_id` int(11) NOT NULL,
  `fond_de_caisse` decimal(10,2) DEFAULT 0.00,
  `ventes` decimal(10,2) DEFAULT 0.00,
  `retrocession` decimal(10,2) DEFAULT 0.00,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`comptage_id`) REFERENCES `comptages`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`caisse_id`) REFERENCES `caisses`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `comptage_denominations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `comptage_detail_id` int(11) NOT NULL,
  `denomination_nom` varchar(255) NOT NULL,
  `quantite` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`comptage_detail_id`) REFERENCES `comptage_details`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NOUVEAU : Table pour stocker les retraits effectués lors de la clôture
CREATE TABLE IF NOT EXISTS `comptage_retraits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `comptage_detail_id` int(11) NOT NULL,
  `denomination_nom` varchar(255) NOT NULL,
  `quantite_retiree` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`comptage_detail_id`) REFERENCES `comptage_details`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cloture_status` (
  `caisse_id` INT(11) NOT NULL,
  `status` ENUM('open', 'locked', 'closed') NOT NULL DEFAULT 'open',
  `locked_by_ws_id` VARCHAR(255) NULL,
  PRIMARY KEY (`caisse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `terminaux_paiement` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nom_terminal` VARCHAR(255) NOT NULL,
  `caisse_associee` INT(11) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`caisse_associee`) REFERENCES `caisses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `comptage_cb` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `comptage_detail_id` INT(11) NOT NULL,
  `terminal_id` INT(11) NOT NULL,
  `montant` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`comptage_detail_id`) REFERENCES `comptage_details`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`terminal_id`) REFERENCES `terminaux_paiement`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `comptage_cheques` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `comptage_detail_id` INT(11) NOT NULL,
  `montant` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`comptage_detail_id`) REFERENCES `comptage_details`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reserve_operations_log` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `date_operation` DATETIME NOT NULL,
  `caisse_id` INT(11) NOT NULL,
  `denomination_vers_caisse` VARCHAR(255) NOT NULL,
  `quantite_vers_caisse` INT(11) NOT NULL,
  `denomination_depuis_caisse` VARCHAR(255) NOT NULL,
  `quantite_depuis_caisse` INT(11) NOT NULL,
  `valeur_echange` DECIMAL(10,2) NOT NULL,
  `notes` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`caisse_id`) REFERENCES `caisses`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reserve_demandes` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `date_demande` DATETIME NOT NULL,
  `caisse_id` INT(11) NOT NULL,
  `demandeur_nom` VARCHAR(255) NULL, -- Nom de l'opérateur (si vous avez un système d'utilisateurs)
  `denomination_demandee` VARCHAR(255) NOT NULL,
  `quantite_demandee` INT(11) NOT NULL,
  `valeur_demandee` DECIMAL(10,2) NOT NULL,
  `statut` ENUM('EN_ATTENTE', 'TRAITEE', 'ANNULEE') NOT NULL DEFAULT 'EN_ATTENTE',
  `notes_demandeur` TEXT DEFAULT NULL,
  -- Ces champs seront remplis lors du traitement par le dirigeant
  `date_traitement` DATETIME NULL,
  `approbateur_nom` VARCHAR(255) NULL, 
  PRIMARY KEY (`id`),
  FOREIGN KEY (`caisse_id`) REFERENCES `caisses`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
