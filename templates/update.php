<?php
// templates/update.php
// Ce script gère le processus de migration de la base de données de l'ancienne version vers la nouvelle.

require 'partials/header.php';
require 'partials/navbar.php';

// Services nécessaires pour la migration
require_once __DIR__ . '/../src/services/DatabaseMigrationService.php';
require_once __DIR__ . '/../src/services/BackupService.php';
require_once __DIR__ . '/../src/services/VersionService.php';

$pdo = Bdd::getPdo();
$versionService = new VersionService();
$dbMigrationService = new DatabaseMigrationService($pdo);
$backupService = new BackupService();

// Récupérer les informations de la version distante
$release_info = $versionService->getLatestReleaseInfo();

$migration_sql = [];
$migration_needed = false;

// --- DÉTECTION DU SCHÉMA ACTUEL ---
try {
    $stmt = $pdo->query("SHOW TABLES LIKE 'comptage_details'");
    if ($stmt->rowCount() == 0) {
        $migration_needed = true;
    }
} catch (PDOException $e) {
    // La table n'existe pas, la migration est nécessaire
    $migration_needed = true;
}

if ($migration_needed) {
    // Génération dynamique des requêtes de migration
    $migration_sql = generateMigrationSqlForOldSchema($pdo);
}

// Gère l'action de migration si le formulaire a été soumis
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'perform_migration') {
    // 1. Sauvegarde de la base de données avant la migration
    $backupResult = $backupService->createBackup();
    if (!$backupResult['success']) {
        $_SESSION['update_result'] = ['success' => false, 'error' => "Échec de la sauvegarde : " . $backupResult['message']];
        header('Location: index.php?page=update');
        exit;
    }

    // 2. Application de la migration
    $migrationResult = $dbMigrationService->applyMigration($migration_sql);
    
    $_SESSION['update_result'] = $migrationResult;
    header('Location: index.php?page=update');
    exit;
}

/**
 * Génère le script SQL de migration de l'ancien schéma vers le nouveau.
 * @param PDO $pdo
 * @return array Les requêtes SQL à exécuter
 */
function generateMigrationSqlForOldSchema(PDO $pdo) {
    global $noms_caisses, $denominations;
    $migration_queries = [];

    // Créer la table `caisses` si elle n'existe pas
    $migration_queries[] = "CREATE TABLE IF NOT EXISTS `caisses` (`id` INT(11) NOT NULL AUTO_INCREMENT, `nom_caisse` VARCHAR(255) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
    
    // Créer la table `comptage_details`
    $migration_queries[] = "CREATE TABLE IF NOT EXISTS `comptage_details` (`id` INT(11) NOT NULL AUTO_INCREMENT, `comptage_id` INT(11) NOT NULL, `caisse_id` INT(11) NOT NULL, `fond_de_caisse` DECIMAL(10,2) DEFAULT 0.00, `ventes` DECIMAL(10,2) DEFAULT 0.00, `retrocession` DECIMAL(10,2) DEFAULT 0.00, PRIMARY KEY (`id`), FOREIGN KEY (`comptage_id`) REFERENCES `comptages`(`id`) ON DELETE CASCADE, FOREIGN KEY (`caisse_id`) REFERENCES `caisses`(`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
    
    // Créer la table `comptage_denominations`
    $migration_queries[] = "CREATE TABLE IF NOT EXISTS `comptage_denominations` (`id` INT(11) NOT NULL AUTO_INCREMENT, `comptage_detail_id` INT(11) NOT NULL, `denomination_nom` VARCHAR(255) NOT NULL, `quantite` INT(11) DEFAULT 0, PRIMARY KEY (`id`), FOREIGN KEY (`comptage_detail_id`) REFERENCES `comptage_details`(`id`) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    // Insérer les caisses par défaut
    foreach ($noms_caisses as $id => $nom) {
        $migration_queries[] = "INSERT INTO `caisses` (`id`, `nom_caisse`) VALUES ({$id}, '" . addslashes($nom) . "') ON DUPLICATE KEY UPDATE `nom_caisse` = '" . addslashes($nom) . "';";
    }

    // Migration des données pour chaque caisse
    $old_columns_to_drop = [];
    foreach ($noms_caisses as $caisse_id => $caisse_nom) {
        // Migration des données de base de la caisse (fond_de_caisse, ventes, retrocession)
        $migration_queries[] = "INSERT INTO `comptage_details` (`comptage_id`, `caisse_id`, `fond_de_caisse`, `ventes`, `retrocession`) SELECT `id`, {$caisse_id}, `c{$caisse_id}_fond_de_caisse`, `c{$caisse_id}_ventes`, `c{$caisse_id}_retrocession` FROM `comptages` WHERE `c{$caisse_id}_fond_de_caisse` IS NOT NULL;";

        // Migration des dénominations
        $denomination_columns = [];
        $denomination_columns_case = [];
        foreach ($denominations['billets'] as $name => $value) {
            $denomination_columns[] = "'{$name}'";
            $denomination_columns_case[] = "WHEN T.denomination = '{$name}' THEN T.`c{$caisse_id}_{$name}`";
            $old_columns_to_drop[] = "`c{$caisse_id}_{$name}`";
        }
        foreach ($denominations['pieces'] as $name => $value) {
            $denomination_columns[] = "'{$name}'";
            $denomination_columns_case[] = "WHEN T.denomination = '{$name}' THEN T.`c{$caisse_id}_{$name}`";
            $old_columns_to_drop[] = "`c{$caisse_id}_{$name}`";
        }

        $migration_queries[] = "INSERT INTO `comptage_denominations` (`comptage_detail_id`, `denomination_nom`, `quantite`) SELECT cd.id, T.denomination AS denomination_nom, CASE {$case_statements_quantite} END AS quantite FROM (SELECT id, `c{$caisse_id}_b500` AS b500, `c{$caisse_id}_b200` AS b200, ... FROM comptages WHERE `c{$caisse_id}_fond_de_caisse` IS NOT NULL) T CROSS JOIN ( SELECT 'b500' AS denomination UNION ALL SELECT 'b200' ... ) dlist JOIN `comptage_details` cd ON T.id = cd.comptage_id WHERE cd.caisse_id = {$caisse_id};";

        // Suppression des colonnes de l'ancien schéma de la table `comptages`
        $old_columns_to_drop[] = "`c{$caisse_id}_fond_de_caisse`";
        $old_columns_to_drop[] = "`c{$caisse_id}_ventes`";
        $old_columns_to_drop[] = "`c{$caisse_id}_retrocession`";
    }

    $migration_queries[] = "ALTER TABLE `comptages` " . implode(", ", array_map(fn($col) => "DROP COLUMN {$col}", array_unique($old_columns_to_drop))) . ";";
    
    return $migration_queries;
}

?>

<div class="container">
    <div class="update-header">
        <h2><i class="fa-solid fa-cloud-arrow-down"></i> Mise à jour de l'application</h2>
    </div>

    <div class="update-grid">
        <!-- Carte des notes de version -->
        <div class="update-card">
            <h3><i class="fa-solid fa-tags"></i> Version <?= htmlspecialchars($release_info['remote_version']) ?></h3>
            <div class="release-notes">
                <h4>Notes de version :</h4>
                <pre><?= htmlspecialchars($release_info['release_notes']) ?></pre>
            </div>
        </div>

        <!-- Carte de la mise à jour -->
        <div class="update-card">
            <h3><i class="fa-solid fa-cogs"></i> Processus de mise à jour</h3>
            <div class="update-process">
                <?php if ($migration_needed): ?>
                    <h4>1. Sauvegarde de la base de données</h4>
                    <p>Pour des raisons de sécurité, une sauvegarde complète de votre base de données sera créée avant la migration.</p>

                    <h4>2. Migration du schéma</h4>
                    <p class="status-warning"><i class="fa-solid fa-exclamation-triangle"></i> Une migration de la base de données est nécessaire. Le script suivant sera exécuté :</p>
                    <pre class="sql-code"><?= htmlspecialchars(implode("\n", $migration_sql)) ?></pre>
                    <form action="index.php?page=update" method="POST" onsubmit="return confirm('Êtes-vous sûr de vouloir lancer la MIGRATION et la mise à jour ? Une sauvegarde sera effectuée au préalable.');">
                        <input type="hidden" name="action" value="perform_migration">
                        <button type="submit" class="btn save-btn">Lancer la migration et la mise à jour</button>
                    </form>
                <?php else: ?>
                    <p class="status-ok"><i class="fa-solid fa-check-circle"></i> Votre base de données est déjà à jour.</p>
                    <h4>Mise à jour des fichiers</h4>
                    <p>Les fichiers de l'application seront mis à jour depuis le dépôt GitHub.</p>
                    <form action="index.php?page=update" method="POST">
                        <input type="hidden" name="action" value="perform_git_pull">
                        <button type="submit" class="btn save-btn">Mettre à jour les fichiers</button>
                    </form>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <?php if (isset($_SESSION['update_result'])): ?>
        <div class="update-results">
            <h3>Résultat de la mise à jour</h3>
            <?php if ($_SESSION['update_result']['success']): ?>
                <p class="status-ok">Mise à jour terminée avec succès !</p>
                <pre><?= htmlspecialchars($_SESSION['update_result']['output']) ?></pre>
            <?php else: ?>
                <p class="status-error">Une erreur est survenue :</p>
                <pre><?= htmlspecialchars($_SESSION['update_result']['error']) ?></pre>
            <?php endif; ?>
            <?php unset($_SESSION['update_result']); ?>
        </div>
    <?php endif; ?>
</div>

<?php
require 'partials/footer.php';
?>
