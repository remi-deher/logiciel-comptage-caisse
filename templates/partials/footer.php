<?php
// Fichier : templates/partials/footer.php
// CORRIGÉ : Ce fichier est maintenant un partial complet et inclut les scripts JS.

$current_version = 'N/A';
$version_file = __DIR__ . '/../../VERSION';
if (file_exists($version_file)) {
    $current_version = trim(file_get_contents($version_file));
}

$release_info = 'Information non disponible';
?>
    </div>
    <footer class="main-footer">
        <p>
            Développé par DEHER Rémi |
            <a href="https://opensource.org/license/mit" target="_blank" rel="noopener noreferrer">Licence MIT</a> |
            <a href="https://github.com/remi-deher/logiciel-comptage-caisse" target="_blank" rel="noopener noreferrer">Dépôt GitHub</a>
        </p>

        <p>
            Version actuelle : <strong><?= htmlspecialchars($current_version) ?></strong> |
            <span id="release-info-container">Dernière release : <span id="release-date-info"><?= htmlspecialchars($release_info) ?></span></span>
            <button id="force-version-check" class="force-check-btn" title="Forcer la vérification">
                <i class="fa-solid fa-arrows-rotate"></i>
            </button>
        </p>

        <div id="update-container" class="update-container">
            <span id="version-info">Vérification de la version...</span>
            <a href="index.php?page=update" id="update-button" class="update-btn" style="display: none; text-decoration: none;">Mettre à jour</a>
        </div>
    </footer>

    <script src="js/main.js"></script>
    <?php if (!empty($page_js)): ?>
        <script src="js/<?= htmlspecialchars($page_js) ?>"></script>
    <?php endif; ?>
</body>
</html>
