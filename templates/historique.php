<?php
// Fichier : templates/historique.php
// Mise à jour pour inclure les éléments nécessaires au mode de comparaison.

$page_js = 'history.js';
$page_css = 'historique.css';

// On récupère le symbole de la devise
$currency_symbol = defined('APP_CURRENCY_SYMBOL') ? APP_CURRENCY_SYMBOL : '€';

$config_data = json_encode([
    'nomsCaisses' => $noms_caisses ?? [],
    'denominations' => $denominations ?? [],
    'currencySymbol' => $currency_symbol
]);

require 'partials/header.php';
require 'partials/navbar.php';

function renderPagination($page_courante, $pages_totales) {
    $params = $_GET;
    unset($params['p']);
    $query_string = http_build_query($params);
    $window = 1;

    echo '<ul class="pagination">';
    if ($page_courante > 1) {
        echo '<li><a href="?p=' . ($page_courante - 1) . '&' . $query_string . '">« Préc.</a></li>';
    } else {
        echo '<li class="disabled"><span>« Préc.</span></li>';
    }
    for ($i = 1; $i <= $pages_totales; $i++) {
        if ($i == 1 || $i == $pages_totales || ($i >= $page_courante - $window && $i <= $page_courante + $window)) {
            if ($i == $page_courante) {
                echo '<li class="active"><span>' . $i . '</span></li>';
            } else {
                echo '<li><a href="?p=' . $i . '&' . $query_string . '">' . $i . '</a></li>';
            }
        } 
        elseif (($i == $page_courante - $window - 1) || ($i == $page_courante + $window + 1)) {
            echo '<li class="disabled"><span>...</span></li>';
        }
    }
    if ($page_courante < $pages_totales) {
        echo '<li><a href="?p=' . ($page_courante + 1) . '&' . $query_string . '">Suiv. »</a></li>';
    } else {
        echo '<li class="disabled"><span>Suiv. »</span></li>';
    }
    echo '</ul>';
}
?>

<div id="history-data" data-config='<?= htmlspecialchars($config_data, ENT_QUOTES, 'UTF-8') ?>'></div>

<div class="container" id="history-page"> 
    <h2><i class="fa-solid fa-clock-rotate-left" style="color: #3498db;"></i> Historique des Comptages</h2>

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
                <input type="date" id="date_debut" name="date_debut" value="<?= htmlspecialchars($date_debut ?? '') ?>">
            </div>
            <div class="form-group">
                <label for="date_fin">Date de fin :</label>
                <input type="date" id="date_fin" name="date_fin" value="<?= htmlspecialchars($date_fin ?? '') ?>">
            </div>
            <div class="form-group">
                <label for="recherche">Recherche :</label>
                <input type="text" id="recherche" name="recherche" placeholder="Nom du comptage..." value="<?= htmlspecialchars($recherche ?? '') ?>">
            </div>
            <button type="submit" class="new-btn">Filtrer</button>
            <a href="index.php?page=historique&vue=tout" class="action-btn" style="background-color: #7f8c8d;">Réinitialiser</a>
        </form>
    </div>

    <div id="comparison-toolbar" class="comparison-toolbar">
        <span id="comparison-counter">0/2 comptages sélectionnés</span>
        <button id="compare-btn" class="action-btn" disabled><i class="fa-solid fa-scale-balanced"></i> Comparer</button>
    </div>

    <div class="global-chart-container">
        <h3>Synthèse de la période filtrée</h3>
        <div id="global-chart-container"></div>
    </div>

    <div class="history-grid"></div>
    <nav class="pagination-nav" style="margin-top: 20px;"></nav>

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


<?php
require 'partials/footer.php';
?>
