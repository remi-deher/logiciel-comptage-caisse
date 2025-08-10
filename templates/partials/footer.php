<?php
// templates/partials/footer.php

$current_version = 'N/A';
$version_file = __DIR__ . '/../../VERSION';
if (file_exists($version_file)) {
    $current_version = trim(file_get_contents($version_file));
}

$release_date = 'Information non disponible';
$cacheFile = __DIR__ . '/../../cache/github_release.json';
if (file_exists($cacheFile)) {
    $data = json_decode(file_get_contents($cacheFile), true);
    if (!empty($data['formatted_release_date'])) {
         $release_date = $data['formatted_release_date'];
    }
}
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
            Dernière release : <span id="release-date-info"><?= htmlspecialchars($release_date) ?></span>
        </p>
        
        <div id="update-container" class="update-container">
            <span id="version-info">Vérification de la version...</span>
            <button id="update-button" class="update-btn" style="display: none;">Mettre à jour</button>
        </div>
    </footer>

    <script src="js/app.js"></script>
</body>
</html>
