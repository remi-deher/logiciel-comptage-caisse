<?php
// templates/update.php
$page_css = 'update.css';
require 'partials/header.php';
require 'partials/navbar.php';
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
                <h4>1. Mise à jour des fichiers</h4>
                <p>Les fichiers de l'application seront mis à jour depuis le dépôt GitHub.</p>

                <h4>2. Mise à jour de la base de données</h4>
                <?php if (empty($db_migrations)): ?>
                    <p class="status-ok"><i class="fa-solid fa-check-circle"></i> Votre base de données est déjà à jour.</p>
                <?php else: ?>
                    <p class="status-warning"><i class="fa-solid fa-exclamation-triangle"></i> Les modifications suivantes seront appliquées :</p>
                    <pre class="sql-code"><?= htmlspecialchars(implode("\n", $db_migrations)) ?></pre>
                <?php endif; ?>

                <form action="index.php?page=admin&action=perform_update" method="POST" onsubmit="return confirm('Êtes-vous sûr de vouloir lancer la mise à jour ?');">
                    <button type="submit" class="btn save-btn">Lancer la mise à jour</button>
                </form>
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
