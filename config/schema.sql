-- config/schema.sql - Version finale avec ventes séparées et fond_cible

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
  `fond_cible` decimal(10,2) DEFAULT 100.00 COMMENT 'Fond de caisse cible pour J+1', -- COLONNE AJOUTÉE/MODIFIÉE
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `comptage_details` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `comptage_id` int(11) NOT NULL,
  `caisse_id` int(11) NOT NULL,
  `fond_de_caisse` decimal(10,2) DEFAULT 0.00 COMMENT 'Fond réel constaté ou restant après retrait (pour historique J+1)', -- Gardé pour historique
  `ventes_especes` decimal(10,2) DEFAULT 0.00,
  `ventes_cb` decimal(10,2) DEFAULT 0.00,
  `ventes_cheques` decimal(10,2) DEFAULT 0.00,
  `retrocession` decimal(10,2) DEFAULT 0.00,
  `retrocession_cb` decimal(10,2) DEFAULT 0.00,
  `retrocession_cheques` decimal(10,2) DEFAULT 0.00,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`comptage_id`) REFERENCES `comptages`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`caisse_id`) REFERENCES `caisses`(`id`) ON DELETE CASCADE -- Ajout ON DELETE CASCADE recommandé
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `comptage_denominations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `comptage_detail_id` int(11) NOT NULL,
  `denomination_nom` varchar(255) NOT NULL,
  `quantite` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`comptage_detail_id`) REFERENCES `comptage_details`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- Suppression de cloture_status, remplacée par cloture_caisse_data
-- DROP TABLE IF EXISTS `cloture_status`;

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
  `heure_releve` TIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`comptage_detail_id`) REFERENCES `comptage_details`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`terminal_id`) REFERENCES `terminaux_paiement`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `comptage_cheques` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `comptage_detail_id` INT(11) NOT NULL,
  `montant` DECIMAL(10,2) NOT NULL,
  `commentaire` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`comptage_detail_id`) REFERENCES `comptage_details`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reserve_denominations` (
  `denomination_nom` VARCHAR(50) NOT NULL,
  `quantite` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`denomination_nom`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `reserve_operations_log` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `demande_id` INT(11) NULL, -- Peut être NULL pour des ajustements manuels
  `date_operation` DATETIME NOT NULL,
  `caisse_id` INT(11) NULL, -- Peut être NULL
  `denomination_vers_caisse` VARCHAR(255) NULL,
  `quantite_vers_caisse` INT(11) NULL,
  `denomination_depuis_caisse` VARCHAR(255) NULL,
  `quantite_depuis_caisse` INT(11) NULL,
  `valeur_echange` DECIMAL(10,2) NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `approbateur_nom` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`caisse_id`) REFERENCES `caisses`(`id`) ON DELETE SET NULL -- Important si une caisse est supprimée
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reserve_demandes` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `date_demande` DATETIME NOT NULL,
  `caisse_id` INT(11) NOT NULL,
  `demandeur_nom` VARCHAR(255) NULL,
  `valeur_demandee` DECIMAL(10,2) NOT NULL,
  `details_json` TEXT NULL DEFAULT NULL COMMENT 'Détails demande: [{"type":"billet/piece/rouleau", "denomination":"b50", "quantite":10}]',
  `statut` ENUM('EN_ATTENTE', 'TRAITEE', 'ANNULEE') NOT NULL DEFAULT 'EN_ATTENTE',
  `notes_demandeur` TEXT DEFAULT NULL,
  `date_traitement` DATETIME NULL,
  `approbateur_nom` VARCHAR(255) NULL,
  -- Colonnes conservées pour rétrocompatibilité potentielle, mais plus utilisées activement
  `denomination_demandee_old` VARCHAR(255) NULL,
  `quantite_demandee_old` INT(11) NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`caisse_id`) REFERENCES `caisses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NOUVELLE TABLE POUR LES DONNÉES DE CLÔTURE --
CREATE TABLE IF NOT EXISTS `cloture_caisse_data` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `caisse_id` INT(11) NOT NULL,
  `date_cloture` DATETIME NOT NULL,
  `data_json` JSON NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `caisse_id` (`caisse_id`),
  FOREIGN KEY (`caisse_id`) REFERENCES `caisses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
