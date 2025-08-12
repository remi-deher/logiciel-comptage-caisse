<?php
// Fichier : templates/statistiques.php
// Mise à jour pour améliorer l'ergonomie et l'apparence de la page avec un style accordéon.

// On inclut l'en-tête de la page.
// On passe le nom du fichier CSS et JS spécifique à cette page.
$page_css = 'stats.css';
$page_js = 'stats.js';
require_once __DIR__ . '/partials/header.php';
require_once __DIR__ . '/partials/navbar.php';
?>

<div class="page-content">
    <header class="page-header">
        <h1>Tableau de bord des statistiques</h1>
        <p class="subtitle">Analyse des données de comptage de caisse</p>
    </header>

    <!-- Section Accordéon pour les KPI -->
    <div class="accordion-item">
        <button class="accordion-header" aria-expanded="false" aria-controls="kpi-content">
            <h3>Indicateurs de performance (KPI)</h3>
            <span class="accordion-icon"></span>
        </button>
        <div class="accordion-content" id="kpi-content">
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
        </div>
    </div>
    
    <!-- Section Accordéon pour les graphiques -->
    <div class="accordion-item">
        <button class="accordion-header" aria-expanded="false" aria-controls="charts-content">
            <h3>Graphiques d'analyse</h3>
            <span class="accordion-icon"></span>
        </button>
        <div class="accordion-content" id="charts-content">
            <div class="chart-section">
                <div class="chart-container">
                    <h2>Répartition des ventes par caisse</h2>
                    <!-- Nouveau canevas pour le graphique en secteurs -->
                    <canvas id="repartitionChart"></canvas>
                </div>
            </div>
        </div>
    </div>
</div>

<?php
// On inclut le pied de page
require_once __DIR__ . '/partials/footer.php';
?>
