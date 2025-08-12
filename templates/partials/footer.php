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
            <a href="[https://opensource.org/license/mit](https://opensource.org/license/mit)" target="_blank" rel="noopener noreferrer">Licence MIT</a> | 
            <a href="[https://github.com/remi-deher/logiciel-comptage-caisse](https://github.com/remi-deher/logiciel-comptage-caisse)" target="_blank" rel="noopener noreferrer">Dépôt GitHub</a>
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

    <!-- Chargement du script principal sur toutes les pages -->
    <script src="js/main.js"></script>
    <!-- Chargement du script spécifique à la page, s'il est défini -->
    <?php if (!empty($page_js)): ?>
        <script src="js/<?= htmlspecialchars($page_js) ?>"></script>
    <?php endif; ?>
</body>
</html>
```php
<?php
// Fichier : templates/statistiques.php
// Mise à jour pour inclure les emplacements des KPI.

// On inclut l'en-tête de la page.
// On passe le nom du fichier CSS et JS spécifique à cette page.
$page_css = 'stats.css';
$page_js = 'stats.js';
require_once __DIR__ . '/partials/header.php';
require_once __DIR__ . '/partials/navbar.php';
?>

<div class="page-content">
    <h1>Statistiques des comptages</h1>

    <!-- Section pour afficher les KPI -->
    <div class="kpi-container">
        <div class="kpi-card">
            <h3>Nombre total de comptages</h3>
            <p id="total-comptages">Chargement...</p>
        </div>
        <div class="kpi-card">
            <h3>Ventes totales</h3>
            <p id="total-ventes">Chargement...</p>
        </div>
        <div class="kpi-card">
            <h3>Ventes moyennes</h3>
            <p id="ventes-moyennes">Chargement...</p>
        </div>
    </div>

    <div class="chart-container">
        <h2>Ventes des 10 derniers comptages</h2>
        <!-- C'est dans cet élément canvas que le graphique sera dessiné par le JavaScript -->
        <canvas id="ventesChart"></canvas>
    </div>

</div>

<?php
// On inclut le pied de page
require_once __DIR__ . '/partials/footer.php';
?>
