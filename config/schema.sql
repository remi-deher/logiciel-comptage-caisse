-- ATTENTION : CE FICHIER PEUT ÊTRE GÉNÉRÉ AUTOMATIQUEMENT.
-- Si vous avez modifié le nombre de caisses dans votre fichier config.php,
-- exécutez la commande suivante depuis la racine de votre projet pour mettre ce fichier à jour :
-- php config/generate-schema.php > config/schema.sql

CREATE TABLE IF NOT EXISTS `comptages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom_comptage` varchar(255) NOT NULL,
  `date_comptage` datetime NOT NULL,
  `explication` text DEFAULT NULL,
  
  -- Caisse 1
  `c1_fond_de_caisse` decimal(10,2) DEFAULT 0.00,
  `c1_ventes` decimal(10,2) DEFAULT 0.00,
  `c1_retrocession` decimal(10,2) DEFAULT 0.00,
  `c1_b500` int(11) DEFAULT 0, `c1_b200` int(11) DEFAULT 0, `c1_b100` int(11) DEFAULT 0, `c1_b50` int(11) DEFAULT 0, `c1_b20` int(11) DEFAULT 0, `c1_b10` int(11) DEFAULT 0, `c1_b5` int(11) DEFAULT 0,
  `c1_p200` int(11) DEFAULT 0, `c1_p100` int(11) DEFAULT 0, `c1_p050` int(11) DEFAULT 0, `c1_p020` int(11) DEFAULT 0, `c1_p010` int(11) DEFAULT 0, `c1_p005` int(11) DEFAULT 0, `c1_p002` int(11) DEFAULT 0, `c1_p001` int(11) DEFAULT 0,

  -- Caisse 2
  `c2_fond_de_caisse` decimal(10,2) DEFAULT 0.00,
  `c2_ventes` decimal(10,2) DEFAULT 0.00,
  `c2_retrocession` decimal(10,2) DEFAULT 0.00,
  `c2_b500` int(11) DEFAULT 0, `c2_b200` int(11) DEFAULT 0, `c2_b100` int(11) DEFAULT 0, `c2_b50` int(11) DEFAULT 0, `c2_b20` int(11) DEFAULT 0, `c2_b10` int(11) DEFAULT 0, `c2_b5` int(11) DEFAULT 0,
  `c2_p200` int(11) DEFAULT 0, `c2_p100` int(11) DEFAULT 0, `c2_p050` int(11) DEFAULT 0, `c2_p020` int(11) DEFAULT 0, `c2_p010` int(11) DEFAULT 0, `c2_p005` int(11) DEFAULT 0, `c2_p002` int(11) DEFAULT 0, `c2_p001` int(11) DEFAULT 0,

  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
