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

    <!-- Section des filtres de recherche -->
    <div class="filter-section">
        <h3>Filtres de recherche</h3>
        <div class="filter-buttons">
            <button type="button" class="quick-filter-btn" data-days="0">Aujourd'hui</button>
            <button type="button" class="quick-filter-btn" data-days="1">Hier</button>
            <button type="button" class="quick-filter-btn" data-days="7">7 derniers jours</button>
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
            <div class="input-group">
                <label for="caisse_filter">Filtrer par caisse :</label>
                <select id="caisse_filter" name="caisse">
                    <option value="">Toutes les caisses</option>
                    <?php foreach ($noms_caisses as $i => $nom): ?>
                        <option value="c<?= $i ?>"><?= htmlspecialchars($nom) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <button type="submit" class="filter-btn">Filtrer</button>
            <button type="button" id="reset-filter-btn" class="reset-btn">Réinitialiser</button>
        </form>
    </div>

    <!-- Section Accordéon pour les KPI -->
    <div class="accordion-item">
        <button class="accordion-header" aria-expanded="true" aria-controls="kpi-content">
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
