<?php
// Fichier : templates/statistiques.php
// Cette page affiche les statistiques des comptages sous forme de graphiques.
// Elle inclut l'en-tête, la barre de navigation et le pied de page de l'application.

// On inclut l'en-tête de la page.
// On passe le nom du fichier CSS et JS spécifique à cette page.
$page_css = 'stats.css';
$page_js = 'stats.js';
require_once __DIR__ . '/partials/header.php';
require_once __DIR__ . '/partials/navbar.php';
?>

<div class="page-content">
    <h1>Statistiques des comptages</h1>

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
