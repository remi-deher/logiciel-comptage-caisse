<?php
// Fichier : templates/historique.php
$page_css = 'historique.css';

$currency_symbol = defined('APP_CURRENCY_SYMBOL') ? APP_CURRENCY_SYMBOL : '€';

$config_data = json_encode([
    'nomsCaisses' => $noms_caisses ?? [],
    'denominations' => $denominations ?? [],
    'currencySymbol' => $currency_symbol
]);

require 'partials/header.php';
require 'partials/navbar.php';
?>

<div id="history-data" data-config='<?= htmlspecialchars($config_data, ENT_QUOTES, 'UTF-8') ?>'></div>

<div class="container" id="history-page">
    <h2><i class="fa-solid fa-clock-rotate-left" style="color: #3498db;"></i> Historique des Comptages</h2>

    <div class="view-tabs">
        <a href="#comptages" class="tab-link active" data-view="comptages">Comptages</a>
        <a href="#retraits" class="tab-link" data-view="retraits">Synthèse des Retraits</a>
    </div>

    <div id="comptages-view" class="view-content active">
        <div class="filter-section">
            <h3>Filtres</h3>
            <div class="filter-buttons">
                <button type="button" class="quick-filter-btn" data-days="0">Aujourd'hui</button>
                <button type="button" class="quick-filter-btn" data-days="1">Hier</button>
                <button type="button" class="quick-filter-btn" data-days="7">7 derniers jours</button>
                <button type="button" class="quick-filter-btn" data-days="30">30 derniers jours</button>
            </div>
            <form id="history-filter-form" class="filter-form" action="index.php" method="GET">
                <input type="hidden" name="page" value="historique">
                <input type="hidden" name="vue" value="tout">
                <div class="form-group">
                    <label for="date_debut">Date de début :</label>
                    <input type="date" id="date_debut" name="date_debut" value="<?= htmlspecialchars($_GET['date_debut'] ?? '') ?>">
                </div>
                <div class="form-group">
                    <label for="date_fin">Date de fin :</label>
                    <input type="date" id="date_fin" name="date_fin" value="<?= htmlspecialchars($_GET['date_fin'] ?? '') ?>">
                </div>
                <div class="form-group">
                    <label for="recherche">Recherche :</label>
                    <input type="text" id="recherche" name="recherche" placeholder="Nom du comptage..." value="<?= htmlspecialchars($_GET['recherche'] ?? '') ?>">
                </div>
                <button type="submit" class="new-btn">Filtrer</button>
                <a href="index.php?page=historique&vue=tout" class="action-btn" style="background-color: #7f8c8d;">Réinitialiser</a>
            </form>
        </div>
        <div class="history-controls">
            <div class="history-actions">
                <button id="print-btn" class="action-btn"><i class="fa-solid fa-print"></i> Imprimer la vue</button>
                <a href="#" id="excel-btn" class="action-btn"><i class="fa-solid fa-file-csv"></i> Exporter en CSV</a>
                <button id="pdf-btn" class="action-btn"><i class="fa-solid fa-file-pdf"></i> Exporter en PDF</a>
            </div>
        </div>
        <div id="comparison-toolbar" class="comparison-toolbar">
            <span id="comparison-counter">0 comptage sélectionné</span>
            <button id="compare-btn" class="action-btn" disabled><i class="fa-solid fa-scale-balanced"></i> Comparer</button>
        </div>
        <div class="global-chart-container">
            <h3>Synthèse de la période filtrée</h3>
            <div id="global-chart-container"></div>
        </div>
        <div class="history-grid"></div>
        <nav class="pagination-nav" style="margin-top: 20px;"></nav>
    </div>

    <div id="retraits-view" class="view-content">
        <div class="withdrawals-header">
            <h3><i class="fa-solid fa-chart-line"></i> Tableau de Bord des Retraits</h3>
            <div class="history-actions">
                <button id="export-retraits-csv-btn" class="action-btn"><i class="fa-solid fa-file-csv"></i> Exporter en CSV</button>
                <button id="export-retraits-pdf-btn" class="action-btn"><i class="fa-solid fa-file-pdf"></i> Exporter en PDF</button>
            </div>
        </div>
        <div id="withdrawals-kpi-container" class="kpi-container-retraits"></div>
        <div class="withdrawals-grid">
            <div class="card">
                <h4><i class="fa-solid fa-coins"></i> Synthèse par Dénomination</h4>
                <div id="withdrawals-by-denomination-table"></div>
            </div>
            <div class="card">
                <h4><i class="fa-solid fa-cash-register"></i> Synthèse par Caisse</h4>
                <div id="withdrawals-by-caisse-chart"></div>
            </div>
        </div>
        <div class="withdrawals-log-wrapper">
            <h4><i class="fa-solid fa-calendar-day"></i> Journal Détaillé par Jour</h4>
            <div id="withdrawals-log-container"></div>
        </div>
    </div>
</div>

<div id="details-modal" class="modal">
    <div class="modal-content">
        <div id="modal-details-content"></div>
    </div>
</div>

<div id="comparison-modal" class="modal">
    <div class="modal-content wide">
        <div id="modal-comparison-content"></div>
    </div>
</div>

<div id="withdrawal-details-modal" class="modal">
    <div class="modal-content wide">
        <div id="modal-withdrawal-details-content"></div>
    </div>
</div>

<script type="module" src="js/history.js"></script>

<?php
require 'partials/footer.php';
?>
