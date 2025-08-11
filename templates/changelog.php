<?php
// templates/changelog.php

$page_css = 'changelog.css';
require 'partials/header.php';
require 'partials/navbar.php';

// Fonction d'aide pour déterminer le type de release et l'icône associée
function getReleaseTypeInfo($bodyHtml) {
    if (stripos($bodyHtml, 'nouvelle fonctionnalité') !== false || stripos($bodyHtml, 'nouveau') !== false) {
        return ['type' => 'Fonctionnalité', 'icon' => 'fa-rocket', 'color' => '#3498db'];
    }
    if (stripos($bodyHtml, 'correction') !== false || stripos($bodyHtml, 'bug') !== false) {
        return ['type' => 'Correction', 'icon' => 'fa-bug', 'color' => '#e74c3c'];
    }
    if (stripos($bodyHtml, 'amélioration') !== false || stripos($bodyHtml, 'mise à jour') !== false) {
        return ['type' => 'Amélioration', 'icon' => 'fa-wrench', 'color' => '#f39c12'];
    }
    return ['type' => 'Mise à jour', 'icon' => 'fa-tag', 'color' => '#95a5a6']; // Par défaut
}

$latest_release = !empty($releases) ? array_shift($releases) : null;
?>

<div class="container">
    <div class="changelog-main-header">
        <h2><i class="fa-solid fa-rocket" style="color: #3498db;"></i> Journal des Modifications</h2>
        <p>Suivez les dernières mises à jour, corrections de bugs et nouvelles fonctionnalités de l'application.</p>
    </div>

    <?php if ($latest_release): ?>
        <!-- Section "À la une" pour la dernière release -->
        <div class="latest-release-card">
            <div class="latest-release-header">
                <h3>À la une : Version <?= htmlspecialchars($latest_release['tag_name']) ?></h3>
                <span class="release-date"><?= format_date_fr($latest_release['published_at']) ?></span>
            </div>
            <div class="release-notes">
                <?= $latest_release['body_html'] ?? '<p>Aucune note de version détaillée.</p>' ?>
            </div>
            <div class="latest-release-footer">
                <a href="<?= htmlspecialchars($latest_release['html_url']) ?>" target="_blank" rel="noopener noreferrer" class="github-link">
                    <i class="fa-brands fa-github"></i> Voir sur GitHub
                </a>
            </div>
        </div>
        <h3 class="timeline-title">Versions précédentes</h3>
    <?php endif; ?>

    <!-- Frise chronologique pour les autres releases -->
    <div class="changelog-timeline">
        <?php if (empty($releases) && !$latest_release): ?>
            <p>Impossible de charger le journal des modifications pour le moment.</p>
        <?php else: ?>
            <?php foreach ($releases as $release): 
                $typeInfo = getReleaseTypeInfo($release['body_html'] ?? '');
            ?>
                <div class="timeline-item">
                    <div class="timeline-icon" style="background-color: <?= $typeInfo['color'] ?>; box-shadow: 0 0 0 4px <?= $typeInfo['color'] ?>;">
                        <i class="fa-solid <?= $typeInfo['icon'] ?>"></i>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-content-header">
                            <h4>
                                <span class="release-type" style="color: <?= $typeInfo['color'] ?>;"><?= $typeInfo['type'] ?></span>
                                <?= htmlspecialchars($release['tag_name']) ?>
                            </h4>
                            <span class="release-date"><?= format_date_fr($release['published_at']) ?></span>
                        </div>
                        <div class="release-notes">
                            <?= $release['body_html'] ?? '<p>Aucune note de version détaillée.</p>' ?>
                        </div>
                        <a href="<?= htmlspecialchars($release['html_url']) ?>" target="_blank" rel="noopener noreferrer" class="github-link">
                            <i class="fa-brands fa-github"></i> Voir sur GitHub
                        </a>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>
</div>

<?php
require 'partials/footer.php';
?>

