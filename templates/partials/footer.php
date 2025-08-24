<?php
// templates/partials/footer.php
$current_version = 'N/A';
$version_file = __DIR__ . '/../../VERSION';
if (file_exists($version_file)) {
    $current_version = trim(file_get_contents($version_file));
}

$release_info = 'Information non disponible';
?>
    </div>
    <footer class="main-footer">
        <div class="footer-section footer-links">
            <h4>Ressources</h4>
            <a href="https://opensource.org/license/mit" target="_blank" rel="noopener noreferrer">
                <i class="fa-solid fa-file-invoice"></i> Licence MIT
            </a>
            <a href="https://github.com/remi-deher/logiciel-comptage-caisse" target="_blank" rel="noopener noreferrer">
                <i class="fa-brands fa-github"></i> Dépôt GitHub
            </a>
        </div>

        <div class="footer-section footer-version">
            <h4>Mises à jour</h4>
            <p id="release-info-container">Dernière release : <span id="release-date-info"><?= htmlspecialchars($release_info) ?></span></p>
            <div id="update-container" class="update-container">
                <span id="version-info">Vérification de la version...</span>
                <a href="index.php?page=update" id="update-button" class="update-btn" style="display: none; text-decoration: none;">Mettre à jour</a>
                <button id="force-version-check" class="force-check-btn" title="Forcer la vérification">
                    <i class="fa-solid fa-arrows-rotate"></i>
                </button>
            </div>
        </div>
        
        <div class="footer-section footer-copyright">
            <h4>À propos</h4>
            <p>
                Développé par DEHER Rémi<br>
                &copy; <?= date('Y') ?> Tous droits réservés.
            </p>
        </div>
    </footer>

    <script src="/js/main.js"></script>
    <?php 
    // MISE À JOUR : Gère à la fois une chaîne et un tableau pour $page_js
    if (!empty($page_js)) {
        if (is_array($page_js)) {
            foreach ($page_js as $script) {
                echo '<script src="/js/' . htmlspecialchars($script) . '"></script>';
            }
        } else {
            echo '<script src="/js/' . htmlspecialchars($page_js) . '"></script>';
        }
    }
    ?>
    <div id="cloture-modal" class="modal">
        <div class="modal-content">
            <span class="modal-close">&times;</span>
            <div class="modal-header">
                <h3>Confirmer la clôture des caisses</h3>
            </div>
            <p>Êtes-vous sûr de vouloir lancer la procédure de clôture pour toutes les caisses ?</p>
            <p>Cette action sauvegardera l'état actuel et mettra les caisses à zéro.</p>
            <div class="modal-actions">
                <button id="cancel-cloture-btn" class="btn delete-btn">Annuler</button>
                <button id="confirm-final-cloture-btn" class="btn new-btn" style="display: none;">Confirmer la clôture</button>
            </div>
        </div>
    </div>
</body>
</html>
