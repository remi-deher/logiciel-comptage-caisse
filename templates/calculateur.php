<?php
// templates/calculateur.php - Version corrigée pour le chargement des données et l'affichage sur écran 4/3.

// Définir les scripts spécifiques à la page pour qu'ils soient chargés dans le footer
$page_js = 'calculator-core.js'; 

require 'partials/header.php';
require 'partials/navbar.php';

global $min_to_keep;
if (!isset($min_to_keep)) {
    $min_to_keep = [];
}

$config_data = json_encode([
    'nomsCaisses' => $noms_caisses ?? [],
    'denominations' => $denominations ?? [],
    'minToKeep' => $min_to_keep, 
    'isLoadedFromHistory' => $isLoadedFromHistory ?? false,
    'currencySymbol' => APP_CURRENCY_SYMBOL 
]);

$disabled_attr = ($isLoadedFromHistory ?? false) ? 'disabled' : '';
?>

<div id="calculator-data" data-config='<?= htmlspecialchars($config_data, ENT_QUOTES, 'UTF-8') ?>'
     data-loaded-data='<?= htmlspecialchars(json_encode($loaded_data), ENT_QUOTES, 'UTF-8') ?>'></div>

<div class="container">
    <?php if ($isLoadedFromHistory ?? false): ?>
        <div class="history-view-banner">
            <i class="fa-solid fa-eye"></i>
            <div>
                <strong>Mode Consultation</strong>
                <p>Vous consultez un ancien comptage. Le temps réel et la sauvegarde automatique sont désactivés.</p>
            </div>
            <a href="index.php?page=calculateur" class="btn new-btn">Reprendre le comptage en direct</a>
        </div>
    <?php endif; ?>

    <?php if (isset($message)): ?>
        <p class="session-message"><?= htmlspecialchars($message) ?></p>
    <?php endif; ?>

    <form id="caisse-form" action="index.php?page=calculateur" method="post">
        <input type="hidden" name="action" value="save">

        <div class="tab-selector">
            <?php $is_first = true; foreach ($noms_caisses as $id => $nom): ?>
                <button type="button" class="tab-link <?= $is_first ? 'active' : '' ?>" data-tab="caisse<?= $id ?>"><?= htmlspecialchars($nom) ?></button>
                <?php $is_first = false; endforeach; ?>
        </div>
        
        <div class="ecart-display-container">
    <?php $is_first = true; foreach ($noms_caisses as $id => $nom): ?>
        <div id="ecart-display-caisse<?= $id ?>" class="ecart-display <?= $is_first ? 'active' : '' ?>">
            Écart Caisse Actuelle : <span class="ecart-value">0,00 <?= APP_CURRENCY_SYMBOL ?></span>
            <p class="ecart-explanation"></p>
        </div>
        <div id="suggestion-accordion-caisse<?= $id ?>" class="suggestion-accordion-container"></div>
        <?php $is_first = false; endforeach; ?>
        </div>

        <?php $is_first = true; foreach ($noms_caisses as $id => $nom): ?>
            <div id="caisse<?= $id ?>" class="tab-content <?= $is_first ? 'active' : '' ?>">
                <div class="accordion-container">
                    <div class="accordion-card">
                        <div class="accordion-header active">
                            <i class="fa-solid fa-cash-register"></i>
                            <h3>Informations Caisse</h3>
                            <i class="fa-solid fa-chevron-down accordion-toggle-icon"></i>
                        </div>
                        <div class="accordion-content open">
                            <div class="accordion-content-inner">
                                <div class="grid grid-3">
                                    <div class="form-group">
                                        <label>Fond de Caisse (<?= APP_CURRENCY_SYMBOL ?>)</label>
                                        <input type="text" id="fond_de_caisse_<?= $id ?>" name="caisse[<?= $id ?>][fond_de_caisse]" placeholder="0,00" value="<?= htmlspecialchars($loaded_data[$id]['fond_de_caisse'] ?? '') ?>" <?= $disabled_attr ?>>
                                    </div>
                                    <div class="form-group">
                                        <label>Total Ventes du Jour (<?= APP_CURRENCY_SYMBOL ?>)</label>
                                        <input type="text" id="ventes_<?= $id ?>" name="caisse[<?= $id ?>][ventes]" placeholder="0,00" value="<?= htmlspecialchars($loaded_data[$id]['ventes'] ?? '') ?>" <?= $disabled_attr ?>>
                                    </div>
                                    <div class="form-group">
                                        <label>Rétrocessions / Prélèvements (<?= APP_CURRENCY_SYMBOL ?>)</label>
                                        <input type="text" id="retrocession_<?= $id ?>" name="caisse[<?= $id ?>][retrocession]" placeholder="0,00" value="<?= htmlspecialchars($loaded_data[$id]['retrocession'] ?? '') ?>" <?= $disabled_attr ?>>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="accordion-card">
                        <div class="accordion-header active">
                            <i class="fa-solid fa-money-bill-wave"></i>
                            <h3>Détail des Espèces</h3>
                            <i class="fa-solid fa-chevron-down accordion-toggle-icon"></i>
                        </div>
                        <div class="accordion-content open">
                            <div class="accordion-content-inner">
                                <h4>Billets</h4>
                                <div class="grid">
                                    <?php foreach($denominations['billets'] as $name => $valeur): ?>
                                    <div class="form-group">
                                        <label><?= $valeur ?> <?= APP_CURRENCY_SYMBOL ?></label>
                                        <input type="number" id="<?= $name ?>_<?= $id ?>" name="caisse[<?= $id ?>][<?= $name ?>]" min="0" step="1" placeholder="0" value="<?= htmlspecialchars($loaded_data[$id]['denominations'][$name] ?? '') ?>" <?= $disabled_attr ?>>
                                        <span class="total-line" id="total_<?= $name ?>_<?= $id ?>">0,00 <?= APP_CURRENCY_SYMBOL ?></span>
                                    </div>
                                    <?php endforeach; ?>
                                </div>
                                <h4 style="margin-top: 20px;">Pièces</h4>
                                <div class="grid">
                                    <?php foreach($denominations['pieces'] as $name => $valeur): ?>
                                    <div class="form-group">
                                        <label><?= $valeur >= 1 ? $valeur.' '.APP_CURRENCY_SYMBOL : ($valeur*100).' cts' ?></label>
                                        <input type="number" id="<?= $name ?>_<?= $id ?>" name="caisse[<?= $id ?>][<?= $name ?>]" min="0" step="1" placeholder="0" value="<?= htmlspecialchars($loaded_data[$id]['denominations'][$name] ?? '') ?>" <?= $disabled_attr ?>>
                                        <span class="total-line" id="total_<?= $name ?>_<?= $id ?>">0,00 <?= APP_CURRENCY_SYMBOL ?></span>
                                    </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <?php $is_first = false; endforeach; ?>

        <div class="save-section">
            <h3>Enregistrer le comptage</h3>
            <div class="form-group">
                <label for="nom_comptage">Donnez un nom à ce comptage</label>
                <input type="text" id="nom_comptage" name="nom_comptage" value="<?= htmlspecialchars($loaded_data['nom_comptage'] ?? '') ?>" <?= $disabled_attr ?>>
            </div>
            <div class="form-group" style="margin-top: 10px;">
                <label for="explication">Explication (optionnel)</label>
                <textarea id="explication" name="explication" rows="3" placeholder="Ex: jour de marché, erreur de rendu monnaie, etc." <?= $disabled_attr ?>><?= htmlspecialchars($loaded_data['explication'] ?? '') ?></textarea>
            </div>
            <div class="button-group">
                <?php if (!($isLoadedFromHistory ?? false)): ?>
                    <button type="submit" class="save-btn">Enregistrer le Comptage</button>
                <?php endif; ?>
                <div id="autosave-status" class="autosave-status"></div>
            </div>
        </div>
    </form>

    <div class="accordion-container" style="margin-top: 30px;">
        <div class="accordion-card">
            <div class="accordion-header active">
                <i class="fa-solid fa-chart-pie"></i>
                <h3>Synthèse en Temps Réel</h3>
                <i class="fa-solid fa-chevron-down accordion-toggle-icon"></i>
            </div>
            <div class="accordion-content open">
                <div class="accordion-content-inner">
                    <div class="results" id="results-container">
                        <div class="results-grid">
                            <?php foreach ($noms_caisses as $id => $nom): ?>
                            <div class="result-box">
                                <h3><?= htmlspecialchars($nom) ?></h3>
                                <div class="result-line"><span>Fond de caisse :</span> <span id="res-c<?= $id ?>-fdc">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                                <div class="result-line total"><span>Total compté :</span> <span id="res-c<?= $id ?>-total">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                                <hr>
                                <div class="result-line"><span>Recette théorique :</span> <span id="res-c<?= $id ?>-theorique">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                                <div class="result-line total"><span>Recette réelle (à retirer) :</span> <span id="res-c<?= $id ?>-recette">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                                <div class="result-line total"><span>ÉCART :</span> <span id="res-c<?= $id ?>-ecart">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                            </div>
                            <?php endforeach; ?>
                        </div>
                        <div class="result-box combined-results">
                            <h3>Totaux Combinés</h3>
                            <div class="result-line"><span>Total Fonds de caisse :</span> <span id="res-total-fdc">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                            <div class="result-line"><span>Total compté (global) :</span> <span id="res-total-total">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                            <hr>
                            <div class="result-line"><span>Recette théorique totale :</span> <span id="res-total-theorique">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                            <div class="result-line total"><span>Recette réelle totale (à retirer) :</span> <span id="res-total-recette">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                            <div class="result-line total"><span>ÉCART TOTAL :</span> <span id="res-total-ecart">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- NOUVEAU: Inclusion des scripts spécifiques à la page. -->
<script src="/js/realtime.js"></script>
<script src="/js/cloture.js"></script>
<?php
require 'partials/footer.php';
?>
