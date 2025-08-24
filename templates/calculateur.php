<?php
// templates/calculateur.php - Version corrigée pour le chargement des données et l'affichage sur écran 4/3.

// Définir les scripts spécifiques à la page pour qu'ils soient chargés dans le footer
$page_js = 'calculator.js';

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
     data-loaded-data='<?= htmlspecialchars(json_encode($loaded_data), ENT_QUOTES, 'UTF-8') ?>'
     data-comptage-id="<?= htmlspecialchars($_GET['load'] ?? '') ?>"></div>

<div class="container">
    <?php if ($isLoadedFromHistory ?? false): ?>
        <div class="history-view-banner">
            <i class="fa-solid fa-eye"></i>
            <div>
                <strong>Mode Consultation</strong>
                <p>Vous consultez un ancien comptage. Le temps réel et la sauvegarde automatique sont désactivés.</p>
            </div>
            <button type="button" id="resume-counting-btn" class="btn new-btn">
                <i class="fa-solid fa-play"></i> Reprendre ce comptage
            </button>
        </div>
    <?php endif; ?>

    <?php if (isset($message)): ?>
        <p class="session-message"><?= htmlspecialchars($message) ?></p>
    <?php endif; ?>

    <form id="caisse-form" action="index.php?page=calculateur" method="post">
        <input type="hidden" name="action" value="save">

        <div class="tab-selector">
            <?php $is_first = true; foreach ($noms_caisses as $id => $nom): ?>
                <button type="button" class="tab-link <?= $is_first ? 'active' : '' ?>" data-tab="caisse<?= $id ?>">
                    <?= htmlspecialchars($nom) ?>
                    <span id="caisse-status-<?= $id ?>" class="caisse-status-badge"></span>
                </button>
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
                            <button type="button" class="open-synthesis-modal-btn action-btn-small new-btn" data-caisse-id="<?= $id ?>" style="margin-left: auto;">
                                <i class="fa-solid fa-chart-pie"></i> Synthèse
                            </button>
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
</div>

<div id="resume-choice-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3>Reprendre un comptage</h3>
        </div>
        <p>Que souhaitez-vous faire ?</p>
        <div class="modal-actions">
            <a href="index.php?page=calculateur" class="btn delete-btn"><i class="fa-solid fa-xmark"></i> Annuler et retourner au comptage en direct</a>
            <button id="load-from-history-btn" class="btn new-btn"><i class="fa-solid fa-download"></i> Charger ce comptage</button>
        </div>
    </div>
</div>

<div id="resume-confirm-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header" style="background-color: var(--color-warning); color: white; border-radius: 8px 8px 0 0; padding: 15px;">
            <h3 style="color: white; border: none;"><i class="fa-solid fa-triangle-exclamation"></i> Avertissement</h3>
        </div>
        <p style="margin-top: 20px;">Vous êtes sur le point d'écraser le comptage actuellement en cours. Cette action est irréversible.</p>
        <p><strong>Êtes-vous sûr de vouloir continuer ?</strong></p>
        <div class="modal-actions">
            <button id="cancel-resume-btn" class="btn new-btn">Annuler</button>
            <a href="#" id="confirm-resume-btn" class="btn delete-btn">Confirmer et Écraser</a>
        </div>
    </div>
</div>

<div id="synthesis-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3>Synthèse en Temps Réel</h3>
        </div>
        <div class="modal-body-content-wrapper">
            <div class="results" id="results-container">
                <div class="synthesis-grid">
                    <?php 
                    $caisse_ids = array_keys($noms_caisses);
                    $num_caisses = count($caisse_ids);
                    for ($i = 0; $i < $num_caisses; $i += 2): 
                        $id1 = $caisse_ids[$i];
                        $nom1 = $noms_caisses[$id1];
                        $id2 = isset($caisse_ids[$i+1]) ? $caisse_ids[$i+1] : null;
                        $nom2 = isset($noms_caisses[$id2]) ? $noms_caisses[$id2] : null;
                    ?>
                        <div class="synthesis-pair">
                            <div class="result-box">
                                <h3><?= htmlspecialchars($nom1) ?></h3>
                                <div class="result-line"><span>Fond de caisse :</span> <span id="res-c<?= $id1 ?>-fdc">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                                <div class="result-line total"><span>Total compté :</span> <span id="res-c<?= $id1 ?>-total">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                                <div class="result-line"><span>Recette théorique :</span> <span id="res-c<?= $id1 ?>-theorique">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                                <div class="result-line total"><span>Recette réelle (à retirer) :</span> <span id="res-c<?= $id1 ?>-recette">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                                <div class="result-line total"><span>ÉCART :</span> <span id="res-c<?= $id1 ?>-ecart">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                            </div>
                            <?php if ($id2 !== null): ?>
                            <div class="result-box">
                                <h3><?= htmlspecialchars($nom2) ?></h3>
                                <div class="result-line"><span>Fond de caisse :</span> <span id="res-c<?= $id2 ?>-fdc">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                                <div class="result-line total"><span>Total compté :</span> <span id="res-c<?= $id2 ?>-total">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                                <div class="result-line"><span>Recette théorique :</span> <span id="res-c<?= $id2 ?>-theorique">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                                <div class="result-line total"><span>Recette réelle (à retirer) :</span> <span id="res-c<?= $id2 ?>-recette">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                                <div class="result-line total"><span>ÉCART :</span> <span id="res-c<?= $id2 ?>-ecart">0,00 <?= APP_CURRENCY_SYMBOL ?></span></div>
                            </div>
                            <?php endif; ?>
                        </div>
                    <?php endfor; ?>
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

<div id="details-modal" class="modal">
    <div class="modal-content">
        <div id="modal-details-content"></div>
    </div>
</div>
<div id="help-modal" class="modal">
    <div class="modal-content">
        <div id="help-modal-content">
            </div>
    </div>
</div>
<div id="cloture-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3>Confirmer la clôture des caisses</h3>
        </div>
        <p>Êtes-vous sûr de vouloir lancer la procédure de clôture pour toutes les caisses ?</p>
        <p>Cette action sauvegardera l'état actuel et mettra les caisses à zéro.</p>
        <div class="modal-actions">
            <button id="cancel-cloture-btn" class="btn delete-btn">Annuler</button>
            <button id="confirm-final-cloture-btn" class="btn new-btn" style="display: none;">Confirmer la clôture</button>
        </div>
    </div>
</div>
<div id="caisse-selection-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header-cloture"><h3>Gestion de la Clôture</h3></div>
        <div class="modal-body-cloture">
            <p>Sélectionnez une caisse pour commencer ou modifier son état de clôture.</p>
            <div class="color-key">
                <div><span class="color-dot color-libre"></span> Libre</div>
                <div><span class="color-dot color-cloturee"></span> Clôturée</div>
                <div><span class="color-dot color-en-cours"></span> En cours</div>
            </div>
            <div class="caisse-status-list"></div>
        </div>
    </div>
</div>
<div id="cloture-confirmation-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header"><h3>Confirmer la clôture</h3></div>
        <p>Voulez-vous finaliser la clôture de cette caisse ? Cette action est irréversible.</p>
        <div class="modal-body-content-wrapper"></div>
        <div class="modal-actions">
            <button id="cancel-cloture-btn" class="btn delete-btn">Annuler</button>
            <button id="confirm-final-cloture-btn" class="btn new-btn">Confirmer la clôture</button>
        </div>
    </div>
</div>
<div id="final-confirmation-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header modal-header-danger"><h3>Confirmation Finale</h3></div>
        <p>Validez la clôture de la journée ?<br>Cela remettra les caisses à 0 en gardant le fond de caisse et va créer une sauvegarde des comptages.</p>
        <div class="modal-actions">
            <button id="cancel-final-cloture-action-btn" class="btn delete-btn">Annuler</button>
            <button id="confirm-final-cloture-action-btn" class="btn save-btn">Confirmer</button>
        </div>
    </div>
</div>
<div id="cloture-generale-modal" class="modal">
    <div class="modal-content">
         <div class="modal-header"><h3>Toutes les caisses sont clôturées</h3></div>
        <p>Vérifiez les suggestions de retrait une dernière fois avant de lancer la clôture générale.</p>
        <div class="accordion-container"></div>
        <div class="modal-actions">
            <button id="confirm-cloture-generale-btn" class="btn save-btn">Confirmer la Clôture Générale</button>
        </div>
    </div>
</div>
<script src="/js/realtime.js"></script>
<script src="/js/cloture.js"></script>
<?php
require 'partials/footer.php';
?>
