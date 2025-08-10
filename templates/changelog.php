<?php
// templates/changelog.php
$page_css = 'changelog.css';
require 'partials/header.php';
require 'partials/navbar.php';
?>

<div class="container">
    <h2><i class="fa-solid fa-rocket" style="color: #3498db;"></i> Journal des Modifications (Changelog)</h2>
    <p>Suivez les dernières mises à jour, corrections de bugs et nouvelles fonctionnalités de l'application.</p>

    <div class="changelog-timeline">
        <?php if (empty($releases)): ?>
            <p>Impossible de charger le journal des modifications pour le moment.</p>
        <?php else: ?>
            <?php foreach ($releases as $release): ?>
                <div class="timeline-item">
                    <div class="timeline-icon">
                        <i class="fa-solid fa-tag"></i>
                    </div>
                    <div class="timeline-content">
                        <h3><?= htmlspecialchars($release['tag_name']) ?> - <span class="release-date"><?= format_date_fr($release['published_at']) ?></span></h3>
                        <div class="release-notes">
                            <!-- On affiche directement le contenu HTML fourni par l'API -->
                            <?= $release['body_html'] ?? '<p>Aucune note de version détaillée.</p>' ?>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>
</div>

<?php
require 'partials/footer.php';
?>
