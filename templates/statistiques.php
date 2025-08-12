<?php
// Fichier : templates/statistiques.php
// Mise à jour pour inclure les emplacements des KPI et un second graphique.

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
        <div class="kpi-card">
            <h3>Rétrocessions totales</h3>
            <p id="total-retrocession">Chargement...</p>
        </div>
    </div>

    <div class="chart-container">
        <h2>Ventes des 10 derniers comptages</h2>
        <!-- C'est dans cet élément canvas que le graphique sera dessiné par le JavaScript -->
        <canvas id="ventesChart"></canvas>
    </div>

    <div class="chart-container">
        <h2>Répartition des ventes par caisse</h2>
        <!-- Nouveau canevas pour le graphique en secteurs -->
        <canvas id="repartitionChart"></canvas>
    </div>

</div>

<?php
// On inclut le pied de page
require_once __DIR__ . '/partials/footer.php';
?>
