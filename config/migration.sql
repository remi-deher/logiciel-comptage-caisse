-- Script de migration des données de l'ancien schéma vers le nouveau

-- Création des tables temporaires pour stocker les données transformées
CREATE TEMPORARY TABLE IF NOT EXISTS `comptage_details_temp` LIKE `comptage_details`;
CREATE TEMPORARY TABLE IF NOT EXISTS `comptage_denominations_temp` LIKE `comptage_denominations`;

-- Migration des données de la Caisse 1
INSERT INTO `comptage_details_temp` (`comptage_id`, `caisse_id`, `fond_de_caisse`, `ventes`, `retrocession`)
SELECT `id`, 1, `c1_fond_de_caisse`, `c1_ventes`, `c1_retrocession`
FROM `comptages`;

-- Migration des dénominations de la Caisse 1
INSERT INTO `comptage_denominations_temp` (`comptage_detail_id`, `denomination_nom`, `quantite`)
SELECT
  cd.id,
  CASE
    WHEN T.denominations = 'b500' THEN 'b500'
    WHEN T.denominations = 'b200' THEN 'b200'
    WHEN T.denominations = 'b100' THEN 'b100'
    WHEN T.denominations = 'b50' THEN 'b50'
    WHEN T.denominations = 'b20' THEN 'b20'
    WHEN T.denominations = 'b10' THEN 'b10'
    WHEN T.denominations = 'b5' THEN 'b5'
    WHEN T.denominations = 'p200' THEN 'p200'
    WHEN T.denominations = 'p100' THEN 'p100'
    WHEN T.denominations = 'p050' THEN 'p050'
    WHEN T.denominations = 'p020' THEN 'p020'
    WHEN T.denominations = 'p010' THEN 'p010'
    WHEN T.denominations = 'p005' THEN 'p005'
    WHEN T.denominations = 'p002' THEN 'p002'
    WHEN T.denominations = 'p001' THEN 'p001'
  END AS denomination_nom,
  CASE
    WHEN T.denominations = 'b500' THEN T.`c1_b500`
    WHEN T.denominations = 'b200' THEN T.`c1_b200`
    WHEN T.denominations = 'b100' THEN T.`c1_b100`
    WHEN T.denominations = 'b50' THEN T.`c1_b50`
    WHEN T.denominations = 'b20' THEN T.`c1_b20`
    WHEN T.denominations = 'b10' THEN T.`c1_b10`
    WHEN T.denominations = 'b5' THEN T.`c1_b5`
    WHEN T.denominations = 'p200' THEN T.`c1_p200`
    WHEN T.denominations = 'p100' THEN T.`c1_p100`
    WHEN T.denominations = 'p050' THEN T.`c1_p050`
    WHEN T.denominations = 'p020' THEN T.`c1_p020`
    WHEN T.denominations = 'p010' THEN T.`c1_p010`
    WHEN T.denominations = 'p005' THEN T.`c1_p005`
    WHEN T.denominations = 'p002' THEN T.`c1_p002`
    WHEN T.denominations = 'p001' THEN T.`c1_p001`
  END AS quantite
FROM `comptages` T
CROSS JOIN (
    SELECT 'b500' as denominations UNION ALL
    SELECT 'b200' UNION ALL
    SELECT 'b100' UNION ALL
    SELECT 'b50' UNION ALL
    SELECT 'b20' UNION ALL
    SELECT 'b10' UNION ALL
    SELECT 'b5' UNION ALL
    SELECT 'p200' UNION ALL
    SELECT 'p100' UNION ALL
    SELECT 'p050' UNION ALL
    SELECT 'p020' UNION ALL
    SELECT 'p010' UNION ALL
    SELECT 'p005' UNION ALL
    SELECT 'p002' UNION ALL
    SELECT 'p001'
) AS denominations_list
JOIN `comptage_details_temp` cd ON T.id = cd.comptage_id
WHERE cd.caisse_id = 1;

-- Migration des données de la Caisse 2
INSERT INTO `comptage_details_temp` (`comptage_id`, `caisse_id`, `fond_de_caisse`, `ventes`, `retrocession`)
SELECT `id`, 2, `c2_fond_de_caisse`, `c2_ventes`, `c2_retrocession`
FROM `comptages`;

-- Migration des dénominations de la Caisse 2
INSERT INTO `comptage_denominations_temp` (`comptage_detail_id`, `denomination_nom`, `quantite`)
SELECT
  cd.id,
  CASE
    WHEN T.denominations = 'b500' THEN 'b500'
    WHEN T.denominations = 'b200' THEN 'b200'
    WHEN T.denominations = 'b100' THEN 'b100'
    WHEN T.denominations = 'b50' THEN 'b50'
    WHEN T.denominations = 'b20' THEN 'b20'
    WHEN T.denominations = 'b10' THEN 'b10'
    WHEN T.denominations = 'b5' THEN 'b5'
    WHEN T.denominations = 'p200' THEN 'p200'
    WHEN T.denominations = 'p100' THEN 'p100'
    WHEN T.denominations = 'p050' THEN 'p050'
    WHEN T.denominations = 'p020' THEN 'p020'
    WHEN T.denominations = 'p010' THEN 'p010'
    WHEN T.denominations = 'p005' THEN 'p005'
    WHEN T.denominations = 'p002' THEN 'p002'
    WHEN T.denominations = 'p001' THEN 'p001'
  END AS denomination_nom,
  CASE
    WHEN T.denominations = 'b500' THEN T.`c2_b500`
    WHEN T.denominations = 'b200' THEN T.`c2_b200`
    WHEN T.denominations = 'b100' THEN T.`c2_b100`
    WHEN T.denominations = 'b50' THEN T.`c2_b50`
    WHEN T.denominations = 'b20' THEN T.`c2_b20`
    WHEN T.denominations = 'b10' THEN T.`c2_b10`
    WHEN T.denominations = 'b5' THEN T.`c2_b5`
    WHEN T.denominations = 'p200' THEN T.`c2_p200`
    WHEN T.denominations = 'p100' THEN T.`c2_p100`
    WHEN T.denominations = 'p050' THEN T.`c2_p050`
    WHEN T.denominations = 'p020' THEN T.`c2_p020`
    WHEN T.denominations = 'p010' THEN T.`c2_p010`
    WHEN T.denominations = 'p005' THEN T.`c2_p005`
    WHEN T.denominations = 'p002' THEN T.`c2_p002`
    WHEN T.denominations = 'p001' THEN T.`c2_p001`
  END AS quantite
FROM `comptages` T
CROSS JOIN (
    SELECT 'b500' as denominations UNION ALL
    SELECT 'b200' UNION ALL
    SELECT 'b100' UNION ALL
    SELECT 'b50' UNION ALL
    SELECT 'b20' UNION ALL
    SELECT 'b10' UNION ALL
    SELECT 'b5' UNION ALL
    SELECT 'p200' UNION ALL
    SELECT 'p100' UNION ALL
    SELECT 'p050' UNION ALL
    SELECT 'p020' UNION ALL
    SELECT 'p010' UNION ALL
    SELECT 'p005' UNION ALL
    SELECT 'p002' UNION ALL
    SELECT 'p001'
) AS denominations_list
JOIN `comptage_details_temp` cd ON T.id = cd.comptage_id
WHERE cd.caisse_id = 2;


-- Insertion des données migrées dans les tables permanentes
INSERT INTO `comptage_details` (`comptage_id`, `caisse_id`, `fond_de_caisse`, `ventes`, `retrocession`)
SELECT `comptage_id`, `caisse_id`, `fond_de_caisse`, `ventes`, `retrocession`
FROM `comptage_details_temp`;

INSERT INTO `comptage_denominations` (`comptage_detail_id`, `denomination_nom`, `quantite`)
SELECT `comptage_detail_id`, `denomination_nom`, `quantite`
FROM `comptage_denominations_temp`;


-- Suppression des colonnes de l'ancien schéma de la table `comptages`
ALTER TABLE `comptages`
DROP COLUMN `c1_fond_de_caisse`,
DROP COLUMN `c1_ventes`,
DROP COLUMN `c1_retrocession`,
DROP COLUMN `c1_b500`,
DROP COLUMN `c1_b200`,
DROP COLUMN `c1_b100`,
DROP COLUMN `c1_b50`,
DROP COLUMN `c1_b20`,
DROP COLUMN `c1_b10`,
DROP COLUMN `c1_b5`,
DROP COLUMN `c1_p200`,
DROP COLUMN `c1_p100`,
DROP COLUMN `c1_p050`,
DROP COLUMN `c1_p020`,
DROP COLUMN `c1_p010`,
DROP COLUMN `c1_p005`,
DROP COLUMN `c1_p002`,
DROP COLUMN `c1_p001`,
DROP COLUMN `c2_fond_de_caisse`,
DROP COLUMN `c2_ventes`,
DROP COLUMN `c2_retrocession`,
DROP COLUMN `c2_b500`,
DROP COLUMN `c2_b200`,
DROP COLUMN `c2_b100`,
DROP COLUMN `c2_b50`,
DROP COLUMN `c2_b20`,
DROP COLUMN `c2_b10`,
DROP COLUMN `c2_b5`,
DROP COLUMN `c2_p200`,
DROP COLUMN `c2_p100`,
DROP COLUMN `c2_p050`,
DROP COLUMN `c2_p020`,
DROP COLUMN `c2_p010`,
DROP COLUMN `c2_p005`,
DROP COLUMN `c2_p002`,
DROP COLUMN `c2_p001`;

-- Insertion des caisses dans la table `caisses` si elles n'existent pas
INSERT INTO `caisses` (`id`, `nom_caisse`) VALUES (1, 'Caisse 1') ON DUPLICATE KEY UPDATE `nom_caisse` = 'Caisse 1';
INSERT INTO `caisses` (`id`, `nom_caisse`) VALUES (2, 'Caisse 2') ON DUPLICATE KEY UPDATE `nom_caisse` = 'Caisse 2';

-- Suppression des tables temporaires
DROP TABLE IF EXISTS `comptage_details_temp`;
DROP TABLE IF EXISTS `comptage_denominations_temp`;
