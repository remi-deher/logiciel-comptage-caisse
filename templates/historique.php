<?php
// Fichier : templates/historique.php
// Mise à jour pour inclure les nouveaux filtres de recherche.

$page_js = 'history.js';
$config_data = json_encode([
    'nomsCaisses' => $noms_caisses ?? [],
    'denominations' => $denominations ?? []
]);

require 'partials/header.php';
require 'partials/navbar.php';

// NOUVELLE FONCTION DE PAGINATION "INTELLIGENTE"
function renderPagination($page_courante, $pages_totales) {
    $params = $_GET;
    unset($params['p']);
    $query_string = http_build_query($params);
    $window = 1; // Nombre de pages à afficher de chaque côté de la page active

    echo '<ul class="pagination">';
    // Bouton Précédent
    if ($page_courante > 1) {
        echo '<li><a href="?p=' . ($page_courante - 1) . '&' . $query_string . '">« Préc.</a></li>';
    } else {
        echo '<li class="disabled"><span>« Préc.</span></li>';
    }

    // Liens des pages
    for ($i = 1; $i <= $pages_totales; $i++) {
        // Conditions pour afficher le numéro de page
        if ($i == 1 || $i == $pages_totales || ($i >= $page_courante - $window && $i <= $page_courante + $window)) {
            if ($i == $page_courante) {
                echo '<li class="active"><span>' . $i . '</span></li>';
            } else {
                echo '<li><a href="?p=' . $i . '&' . $query_string . '">' . $i . '</a></li>';
            }
        } 
        // Conditions pour afficher les ellipses (...)
        elseif (($i == $page_courante - $window - 1) || ($i == $page_courante + $window + 1)) {
            echo '<li class="disabled"><span>...</span></li>';
        }
    }
    
    // Bouton Suivant
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

    <!-- Anciens onglets de vue retirés pour laisser la place aux filtres avancés -->

    <!-- NOUVELLE SECTION DE FILTRES -->
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
                <input type="date" id="date_debut" name="date_debut" value="<?= htmlspecialchars($date_debut) ?>">
            </div>
            <div class="form-group">
                <label for="date_fin">Date de fin :</label>
                <input type="date" id="date_fin" name="date_fin" value="<?= htmlspecialchars($date_fin) ?>">
            </div>
            <div class="form-group">
                <label for="caisse_filter">Filtrer par caisse :</label>
                <select id="caisse_filter" name="caisse">
                    <option value="">Toutes les caisses</option>
                    <?php foreach ($noms_caisses as $i => $nom): ?>
                        <option value="c<?= $i ?>_ventes" <?= ($caisse_filtre == "c{$i}_ventes" ? 'selected' : '') ?>><?= htmlspecialchars($nom) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label for="recherche">Recherche :</label>
                <input type="text" id="recherche" name="recherche" placeholder="Nom du comptage..." value="<?= htmlspecialchars($recherche) ?>">
            </div>
            <button type="submit" class="new-btn">Filtrer</button>
            <a href="index.php?page=historique&vue=tout" class="action-btn" style="background-color: #7f8c8d;">Réinitialiser</a>
        </form>
    </div>

    <?php if (isset($message)): ?>
        <p class="session-message"><?= htmlspecialchars($message) ?></p>
    <?php endif; ?>

    <div class="history-controls">
        <div class="history-actions">
            <button id="print-btn" class="action-btn no-export"><i class="fa-solid fa-print"></i> Imprimer</button>
            <button id="pdf-btn" class="action-btn no-export"><i class="fa-solid fa-file-pdf"></i> PDF</button>
            <button id="excel-btn" class="action-btn no-export"><i class="fa-solid fa-file-csv"></i> Excel</button>
        </div>
    </div>

    <?php if (empty($historique)): ?>
        <p>Aucun enregistrement trouvé pour ces critères.</p>
    <?php else: ?>
        <?php if ($pages_totales > 1): ?>
            <nav class="pagination-nav"><?php renderPagination($page_courante, $pages_totales); ?></nav>
        <?php endif; ?>

        <div class="history-grid">
            <?php foreach ($historique as $comptage):
                $nombre_caisses_actuel = isset($nombre_caisses) ? $nombre_caisses : count($noms_caisses);
                $denominations_actuel = isset($denominations) ? $denominations : [];
                $calculated = calculate_results_from_data($comptage, $nombre_caisses_actuel, $denominations_actuel);
            ?>
                <div class="history-card" data-comptage='<?= htmlspecialchars(json_encode($comptage), ENT_QUOTES, 'UTF-8') ?>'>
                    <div class="history-card-header">
                        <h4><?= htmlspecialchars($comptage['nom_comptage']) ?></h4>
                        <div class="date"><i class="fa-regular fa-calendar"></i> <?= format_date_fr($comptage['date_comptage']) ?></div>
                        <?php if(!empty($comptage['explication'])): ?>
                            <p class="explication"><i class="fa-solid fa-lightbulb"></i> <?= htmlspecialchars($comptage['explication']) ?></p>
                        <?php endif; ?>
                    </div>
                    <div class="history-card-body">
                        <div class="summary-line">
                            <div><i class="fa-solid fa-coins icon-total"></i> Total Compté Global</div>
                            <span><?= format_euros($calculated['combines']['total_compté']) ?></span>
                        </div>
                        <div class="summary-line">
                             <div><i class="fa-solid fa-right-left icon-ecart"></i> Écart Global</div>
                            <span class="<?= $calculated['combines']['ecart'] > 0.001 ? 'ecart-positif' : ($calculated['combines']['ecart'] < -0.001 ? 'ecart-negatif' : '') ?>">
                                <?= format_euros($calculated['combines']['ecart']) ?>
                            </span>
                        </div>
                        <hr class="card-divider">
                        <?php foreach($noms_caisses as $num => $nom): 
                            $ecart = $calculated['caisses'][$num]['ecart']; ?>
                            <div class="summary-line">
                                <div class="caisse-name">Écart <?= htmlspecialchars($nom) ?></div>
                                <span class="<?= $ecart > 0.001 ? 'ecart-positif' : ($ecart < -0.001 ? 'ecart-negatif' : '') ?>">
                                    <?= format_euros($ecart) ?>
                                </span>
                            </div>
                        <?php endforeach; ?>
                    </div>
                    <div class="history-card-footer no-export">
                        <button class="action-btn-small details-all-btn"><i class="fa-solid fa-layer-group"></i> Ensemble</button>
                        <?php foreach($noms_caisses as $num => $nom): ?>
                            <button class="action-btn-small details-btn" data-caisse-id="<?= $num ?>" data-caisse-nom="<?= htmlspecialchars($nom) ?>">
                                <i class="fa-solid fa-list-ul"></i> <?= htmlspecialchars($nom) ?>
                            </button>
                        <?php endforeach; ?>
                        <div style="flex-grow: 1;"></div> <!-- Espace flexible -->
                        <a href="index.php?page=calculateur&load=<?= $comptage['id'] ?>" class="action-btn-small save-btn"><i class="fa-solid fa-pen-to-square"></i></a>
                        <form method="POST" action="index.php?page=historique" onsubmit="return confirm('Êtes-vous sûr de vouloir supprimer DÉFINITIVEMENT ce comptage ?');" style="margin:0;">
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="id_a_supprimer" value="<?= $comptage['id'] ?>">
                            <button type="submit" class="action-btn-small delete-btn"><i class="fa-solid fa-trash-can"></i></button>
                        </form>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>

        <?php if ($pages_totales > 1): ?>
            <nav class="pagination-nav" style="margin-top: 20px;"><?php renderPagination($page_courante, $pages_totales); ?></nav>
        <?php endif; ?>
    <?php endif; ?>
</div>

<!-- Fenêtre Modale pour les détails -->
<div id="details-modal" class="modal">
    <div class="modal-content">
        <span class="modal-close">&times;</span>
        <div id="modal-details-content"></div>
    </div>
</div>

<?php
require 'partials/footer.php';
?>
