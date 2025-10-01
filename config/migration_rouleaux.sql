-- migration_rouleaux.sql
-- Script pour faire évoluer la table `reserve_demandes` afin de gérer les demandes multiples (pièces et rouleaux).

-- 1. Ajoute la colonne qui stockera les détails de la demande au format JSON.
ALTER TABLE `reserve_demandes` ADD `details_json` TEXT NULL DEFAULT NULL COMMENT 'Détails de la demande au format JSON' AFTER `valeur_demandee`;

-- 2. Renomme les anciennes colonnes pour les archiver. Vous pourrez les supprimer plus tard.
-- Cela évite les erreurs si le script est exécuté plusieurs fois.
ALTER TABLE `reserve_demandes` CHANGE `denomination_demandee` `denomination_demandee_old` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL;
ALTER TABLE `reserve_demandes` CHANGE `quantite_demandee` `quantite_demandee_old` INT(11) NULL DEFAULT NULL;

-- 3. Ajoute la nouvelle variable de configuration pour les rouleaux dans votre fichier de configuration.
-- Note pour l'utilisateur : Ajoutez le tableau $rouleaux_pieces dans votre config/config.php
