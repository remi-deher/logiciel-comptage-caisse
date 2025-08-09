<?php
// templates/partials/footer.php

// --- NOUVELLE LOGIQUE POUR AFFICHER LA VERSION ET LA DATE DE RELEASE ---

// 1. Lire la version actuelle depuis le fichier VERSION local
$projectRoot = __DIR__ . '/../../..';
$version_file = $projectRoot . '/VERSION';
$current_version = file_exists($version_file) ? trim(file_get_contents($version_file)) : 'N/A';

// 2. Récupérer la date de la dernière release depuis l'API GitHub
$release_date = 'Information non disponible';
$repo_api_url = 'https://api.github.com/repos/remi-deher/logiciel-comptage-caisse/releases/latest';

// Utilise cURL si disponible pour contacter l'API
if (function_exists('curl_init')) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $repo_api_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Comptage-Caisse-App'); 
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code == 200) {
        $data = json_decode($response, true);
        if (isset($data['published_at'])) {
            // Formate la date en français
            $date = new DateTime($data['published_at']);
            $formatter = new IntlDateFormatter('fr_FR', IntlDateFormatter::LONG, IntlDateFormatter::NONE);
            $release_date = $formatter->format($date);
        }
    }
}
?>
    </div> <!-- Fin du .container principal -->

    <footer class="main-footer">
        <p>
            Développé par DEHER Rémi | 
            <a href="https://opensource.org/license/mit" target="_blank" rel="noopener noreferrer">Licence MIT</a> | 
            <a href="<?= htmlspecialchars(GIT_REPO_URL) ?>" target="_blank" rel="noopener noreferrer">Dépôt GitHub</a>
        </p>
        
        <!-- NOUVELLE SECTION POUR LA VERSION -->
        <p>
            Version actuelle : <strong><?= htmlspecialchars($current_version) ?></strong> |
            Dernière release : <?= htmlspecialchars($release_date) ?>
        </p>
        
        <!-- Section pour la mise à jour (pour les admins) -->
        <div id="update-container" class="update-container">
            <span id="version-info">Vérification de la version...</span>
            <button id="update-button" class="update-btn" style="display: none;">Mettre à jour</button>
        </div>
    </footer>

    <!-- Inclusion du script JavaScript principal de l'application. -->
    <script src="js/app.js"></script>
</body>
</html>
