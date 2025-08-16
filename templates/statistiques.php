<?php
// Fichier : templates/statistiques.php
// Nouvelle version de la page de statistiques avec des fonctionnalités de graphique avancées.

$page_css = 'stats.css';
$page_js = 'stats.js';
require_once __DIR__ . '/partials/header.php';
require_once __DIR__ . '/partials/navbar.php';
?>

<div class="container">
    <header class="page-header">
        <h1>Tableau de bord des statistiques</h1>
        <p class="subtitle">Analyse des données de comptage de caisse</p>
    </header>

    <!-- Section des filtres de recherche -->
    <div class="card filter-section">
        <h3>Filtres de recherche</h3>
        <div class="filter-buttons">
            <button type="button" class="quick-filter-btn" data-days="0">Aujourd'hui</button>
            <button type="button" class="quick-filter-btn" data-days="1">Hier</button>
            <button type="button" class="quick-filter-btn" data-days="7">7 derniers jours</button>
            <button type="button" class="quick-filter-btn" data-days="30">30 derniers jours</button>
        </div>
        <form id="stats-filter-form" class="filter-form">
            <div class="input-group">
                <label for="date_debut">Date de début :</label>
                <input type="date" id="date_debut" name="date_debut">
            </div>
            <div class="input-group">
                <label for="date_fin">Date de fin :</label>
                <input type="date" id="date_fin" name="date_fin">
            </div>
            <button type="submit" class="filter-btn">Filtrer</button>
            <button type="button" id="reset-filter-btn" class="reset-btn">Réinitialiser</button>
        </form>
    </div>

    <!-- Boutons d'exportation -->
    <div class="export-buttons-container">
        <button id="print-stats-btn" class="export-btn"><i class="fa-solid fa-print"></i> Imprimer</button>
        <button id="pdf-stats-btn" class="export-btn"><i class="fa-solid fa-file-pdf"></i> Exporter en PDF</button>
        <button id="excel-stats-btn" class="export-btn"><i class="fa-solid fa-file-csv"></i> Exporter en CSV</button>
    </div>

    <!-- Indicateurs de performance (KPI) -->
    <div class="card section-kpi">
        <h3>Indicateurs de performance (KPI)</h3>
        <div class="kpi-container">
            <div class="kpi-card" data-kpi="total_comptages" data-title="Nombre total de comptages">
                <h3>Nombre total de comptages</h3>
                <p id="total-comptages">Chargement...</p>
            </div>
            <div class="kpi-card" data-kpi="total_ventes" data-title="Ventes totales">
                <h3>Ventes totales</h3>
                <p id="total-ventes">Chargement...</p>
            </div>
            <div class="kpi-card" data-kpi="ventes_moyennes" data-title="Ventes moyennes">
                <h3>Ventes moyennes</h3>
                <p id="ventes-moyennes">Chargement...</p>
            </div>
            <div class="kpi-card" data-kpi="total_retrocession" data-title="Rétrocessions totales">
                <h3>Rétrocessions totales</h3>
                <p id="total-retrocession">Chargement...</p>
            </div>
        </div>
    </div>
    
    <!-- Section pour les graphiques -->
    <div class="card section-charts">
        <div class="chart-controls">
            <h3>Graphiques d'analyse</h3>
            <div class="input-group">
                <label for="data-selector">Sélectionner les données :</label>
                <select id="data-selector">
                    <option value="evolution" selected>Évolution des ventes par jour</option>
                    <option value="repartition">Répartition des ventes par caisse</option>
                    <option value="comparaison">Comparaison des ventes par caisse</option>
                </select>
            </div>
            <div class="input-group">
                <label for="chart-type-selector">Sélectionner le type de graphique :</label>
                <select id="chart-type-selector">
                    <option value="line" selected>Graphique linéaire</option>
                    <option value="bar">Graphique à barres</option>
                    <option value="doughnut">Graphique en secteurs</option>
                </select>
            </div>
            <button id="generate-chart-btn" class="filter-btn">Générer le graphique</button>
        </div>
        <div class="chart-display">
            <div class="card chart-container">
                <h2 id="chart-title">Évolution des ventes par jour</h2>
                <canvas id="mainChart"></canvas>
            </div>
        </div>
    </div>
</div>

<!-- Fenêtre Modale pour les détails des KPI -->
<div id="details-modal" class="modal">
    <div class="modal-content">
        <span class="modal-close">&times;</span>
        <div id="modal-details-content"></div>
    </div>
</div>

<?php
require_once __DIR__ . '/partials/footer.php';
?>
