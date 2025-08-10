<?php
// templates/historique.php (Interface - Cartes)

// On injecte les variables PHP nécessaires pour que le JS puisse construire la modale
echo "<script>const denominations = " . json_encode($denominations) . "; const nomsCaisses = " . json_encode($noms_caisses) . ";</script>";

$page_css = 'historique.css';
require 'partials/header.php';
require 'partials/navbar.php';
?>

<div class="container">
    <h2><i class="fa-solid fa-clock-rotate-left" style="color: #3498db;"></i> Historique des Comptages</h2>

    <?php if (isset($message)): ?>
        <p class="session-message"><?= htmlspecialchars($message) ?></p>
    <?php endif; ?>

    <div class="history-controls">
        <div class="history-actions">
            <button id="print-btn" class="action-btn no-export"><i class="fa-solid fa-print"></i> Imprimer</button>
            <button id="pdf-btn" class="action-btn no-export"><i class="fa-solid fa-file-pdf"></i> PDF</button>
            <button id="excel-btn" class="action-btn no-export"><i class="fa-solid fa-file-csv"></i> Excel</button>
        </div>
        <form action="index.php" method="GET" class="filter-form">
            <input type="hidden" name="page" value="historique">
            <div class="form-group">
                <label>Date début</label>
                <input type="date" name="date_debut" value="<?= htmlspecialchars($date_debut) ?>">
            </div>
            <div class="form-group">
                <label>Date fin</label>
                <input type="date" name="date_fin" value="<?= htmlspecialchars($date_fin) ?>">
            </div>
            <div class="form-group">
                <label>Recherche</label>
                <input type="text" name="recherche" placeholder="Nom du comptage..." value="<?= htmlspecialchars($recherche) ?>">
            </div>
            <button type="submit" class="new-btn">Filtrer</button>
            <a href="index.php?page=historique" class="action-btn" style="background-color: #7f8c8d;">Reset</a>
        </form>
    </div>

    <?php if (empty($historique)): ?>
        <p>Aucun enregistrement trouvé pour ces critères.</p>
    <?php else: ?>
        <div class="history-grid">
            <?php foreach ($historique as $comptage):
                $calculated = calculate_results_from_data($comptage, $nombre_caisses, $denominations);
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
    <?php endif; ?>
</div>

<!-- Fenêtre Modale pour les détails -->
<div id="details-modal" class="modal">
    <div class="modal-content">
        <span class="modal-close">&times;</span>
        <div id="modal-details-content">
            <!-- Le contenu des détails sera injecté ici par JavaScript -->
        </div>
    </div>
</div>

<?php
require 'partials/footer.php';
?>
