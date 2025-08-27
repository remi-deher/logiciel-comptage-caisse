<?php
// templates/partials/footer.php

// Lecture du numéro de version local à partir du fichier VERSION
$current_version = 'N/A';
$version_file = __DIR__ . '/../../VERSION';
if (file_exists($version_file)) {
    $current_version = trim(file_get_contents($version_file));
}

$release_info = 'Information non disponible';
?>
    </div> <footer class="main-footer">
        <div class="footer-content">
            <div class="footer-section footer-about">
                <h4>&#128176; Comptage Caisse</h4>
                <p>Un outil simple et efficace pour gérer vos comptages de caisse au quotidien. Développé pour être rapide, collaboratif et open-source.</p>
            </div>

            <div class="footer-section footer-links">
                <h4>Ressources</h4>
                <a href="https://github.com/remi-deher/logiciel-comptage-caisse/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
                    <i class="fa-solid fa-file-invoice"></i> Licence MIT
                </a>
                <a href="https://github.com/remi-deher/logiciel-comptage-caisse" target="_blank" rel="noopener noreferrer">
                    <i class="fa-brands fa-github"></i> Dépôt GitHub
                </a>
                <a href="index.php?page=aide">
                    <i class="fa-solid fa-circle-question"></i> Guide d'utilisation
                </a>
            </div>

            <div class="footer-section footer-version">
                <h4>Mises à jour</h4>
                <p id="release-info-container">Dernière release : <span id="release-date-info"><?= htmlspecialchars($release_info) ?></span></p>
                <div id="update-container" class="update-container">
                    <span id="version-info">Vérification de la version...</span>
                    <a href="index.php?page=update" id="update-button" class="update-btn" style="display: none;">
                        Mettre à jour <i class="fa-solid fa-cloud-arrow-down"></i>
                    </a>
                    <button id="force-version-check" class="force-check-btn" title="Forcer la vérification">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                </div>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; <?= date('Y') ?> - Développé par DEHER Rémi. Tous droits réservés.</p>
        </div>
    </footer>

    <script src="/js/main.js"></script>
    
    <?php 
    // Logique pour charger les scripts spécifiques à la page en cours
    if (!empty($page_js)) {
        if (is_array($page_js)) {
            // Si $page_js est un tableau de scripts
            foreach ($page_js as $script) {
                // On ne charge pas history.js ici car il est déjà chargé en tant que module dans son propre template
                if ($script !== 'history.js') {
                    echo '<script src="/js/' . htmlspecialchars($script) . '"></script>';
                }
            }
        } else {
            // Si $page_js est une simple chaîne de caractères
            if ($page_js !== 'history.js') {
                echo '<script src="/js/' . htmlspecialchars($page_js) . '"></script>';
            }
        }
    }
    ?>
    </body>
</html>
