<?php
// templates/calculateur.php

$page_js = 'calculator.js';
require 'partials/header.php';
require 'partials/navbar.php';

global $min_to_keep;
if (!isset($min_to_keep)) $min_to_keep = [];

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
     data-comptage-id="<?= htmlspecialchars($_GET['load'] ?? $_GET['resume_from'] ?? '') ?>"></div>

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
            <?php $is_first = false; endforeach; ?>
        </div>

        <?php $is_first_caisse = true; foreach ($noms_caisses as $id => $nom): ?>
            <div id="caisse<?= $id ?>" class="caisse-tab-content <?= $is_first_caisse ? 'active' : '' ?>">
                
                <div class="accordion-card" style="margin-bottom: 20px;">
                    <div class="accordion-header active">
                        <i class="fa-solid fa-info-circle"></i>
                        <h3>Informations Générales de la Caisse</h3>
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

                <div class="payment-method-tabs">
                    <div class="payment-method-selector">
                        <button type="button" class="payment-tab-link active" data-payment-tab="especes-<?= $id ?>"><i class="fa-solid fa-money-bill-wave"></i> Espèces</button>
                        <button type="button" class="payment-tab-link" data-payment-tab="cb-<?= $id ?>"><i class="fa-solid fa-credit-card"></i> Carte Bancaire</button>
                        <button type="button" class="payment-tab-link" data-payment-tab="cheques-<?= $id ?>"><i class="fa-solid fa-money-check-dollar"></i> Chèques</button>
                    </div>

                    <div id="especes-<?= $id ?>" class="payment-tab-content active">
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

                    <div id="cb-<?= $id ?>" class="payment-tab-content">
                        <?php if (isset($terminaux_par_caisse[$id]) && !empty($terminaux_par_caisse[$id])): ?>
                            <div class="grid grid-3">
                                <?php foreach ($terminaux_par_caisse[$id] as $terminal): ?>
                                <div class="form-group">
                                    <label><?= htmlspecialchars($terminal['nom_terminal']) ?> (<?= APP_CURRENCY_SYMBOL ?>)</label>
                                    <input type="text" id="cb_<?= $terminal['id'] ?>_<?= $id ?>" name="caisse[<?= $id ?>][cb][<?= $terminal['id'] ?>]" placeholder="0,00" value="<?= htmlspecialchars($loaded_data[$id]['cb'][$terminal['id']] ?? '') ?>" <?= $disabled_attr ?>>
                                </div>
                                <?php endforeach; ?>
                            </div>
                        <?php else: ?>
                            <p class="info-message">Aucun terminal de paiement n'est associé à cette caisse. Vous pouvez en ajouter dans le panneau d'administration.</p>
                        <?php endif; ?>
                    </div>

                    <div id="cheques-<?= $id ?>" class="payment-tab-content">
                        <div id="cheques-container-<?= $id ?>">
                            <div class="grid grid-3 cheques-grid">
                                <?php 
                                $cheques = $loaded_data[$id]['cheques'] ?? [''];
                                if (empty($cheques)) $cheques = [''];
                                foreach ($cheques as $index => $montant):
                                ?>
                                <div class="form-group cheque-item">
                                    <label>Chèque N°<?= $index + 1 ?> (<?= APP_CURRENCY_SYMBOL ?>)</label>
                                    <div style="display: flex; gap: 5px;">
                                        <input type="text" name="caisse[<?= $id ?>][cheques][]" placeholder="0,00" value="<?= htmlspecialchars($montant) ?>" <?= $disabled_attr ?>>
                                        <button type="button" class="action-btn-small delete-btn remove-cheque-btn" <?= $disabled_attr ?>><i class="fa-solid fa-trash-can"></i></button>
                                    </div>
                                </div>
                                <?php endforeach; ?>
                            </div>
                            <button type="button" class="new-btn add-cheque-btn" data-caisse-id="<?= $id ?>" style="margin-top: 15px;" <?= $disabled_attr ?>><i class="fa-solid fa-plus"></i> Ajouter un chèque</button>
                        </div>
                    </div>
                </div>
            </div>
            <?php $is_first_caisse = false; endforeach; ?>
        
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

<div id="caisse-selection-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header-cloture">
            <h3><i class="fa-solid fa-store-lock"></i> Gestion de la Clôture</h3>
            <p>Sélectionnez une caisse pour commencer ou modifier son état de clôture.</p>
        </div>
        <div class="modal-body-cloture">
            <div class="color-key">
                <div><span class="color-dot color-libre"></span> Libre</div>
                <div><span class="color-dot color-cloturee"></span> Clôturée</div>
                <div><span class="color-dot color-en-cours"></span> Verrouillée</div>
            </div>
            <div class="caisse-status-list"></div>
        </div>
    </div>
</div>
<div id="cloture-confirmation-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3><i class="fa-solid fa-circle-question" style="color: var(--color-warning);"></i> Confirmer la clôture</h3>
        </div>
        <p>Voulez-vous finaliser la clôture pour : <strong id="confirm-caisse-name"></strong> ?</p>
        <div id="confirm-caisse-summary"></div>
        <div id="confirm-caisse-withdrawal"></div>
        <div id="confirm-caisse-cheques"></div>
        <p class="warning-text">Cette action peut être annulée avec le bouton "Réouvrir".</p>
        <div class="modal-actions">
            <button id="cancel-cloture-btn" class="btn delete-btn">Annuler</button>
            <button id="confirm-final-cloture-btn" class="btn new-btn">Confirmer la clôture</button>
        </div>
    </div>
</div>
<div id="final-confirmation-modal" class="modal">
    <div class="modal-content" style="padding:0;">
        <div class="modal-header-danger">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <h3>Confirmation Finale Requise</h3>
        </div>
        <div class="modal-body" style="padding:25px;">
             <p>Validez la clôture définitive de la journée ?<br>Cette action réinitialisera les caisses pour le jour suivant (le fond de caisse sera conservé).</p>
            <div class="modal-actions">
                <button id="cancel-final-cloture-action-btn" class="btn delete-btn">Annuler</button>
                <button id="confirm-final-cloture-action-btn" class="btn save-btn">Confirmer et Terminer</button>
            </div>
        </div>
    </div>
</div>
<div id="cloture-generale-modal" class="modal">
    <div class="modal-content" style="padding: 0;">
         <div class="modal-header" style="background-color: var(--color-success); color: white; border-radius: 12px 12px 0 0;">
            <i class="fa-solid fa-flag-checkered"></i>
            <h3 style="border:none; color:white;">Toutes les caisses sont clôturées</h3>
         </div>
        <div class="modal-body" style="padding: 25px;">
            <p style="text-align:center; margin-top:0;">Vérifiez les suggestions de retrait et les chèques à retirer avant de lancer la clôture générale.</p>
            <div class="accordion-container"></div>
            <div id="cheques-summary-container"></div>
        </div>
        <div class="modal-actions" style="padding: 20px; background-color: var(--color-surface-alt); border-top: 1px solid var(--color-border-light); justify-content: flex-end;">
            <button id="confirm-cloture-generale-btn" class="btn save-btn">Lancer la Clôture Générale</button>
        </div>
    </div>
</div>

<script src="/js/realtime.js"></script>
<script src="/js/cloture.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.add-cheque-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const caisseId = this.dataset.caisseId;
            const container = document.querySelector(`#cheques-container-${caisseId} .cheques-grid`);
            const chequeCount = container.querySelectorAll('.cheque-item').length + 1;
            
            const newChequeHtml = `
                <div class="form-group cheque-item">
                    <label>Chèque N°${chequeCount} (<?= APP_CURRENCY_SYMBOL ?>)</label>
                     <div style="display: flex; gap: 5px;">
                        <input type="text" name="caisse[${caisseId}][cheques][]" placeholder="0,00">
                        <button type="button" class="action-btn-small delete-btn remove-cheque-btn"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>`;
            container.insertAdjacentHTML('beforeend', newChequeHtml);
        });
    });

    document.body.addEventListener('click', function(event) {
        if (event.target.closest('.remove-cheque-btn')) {
            event.target.closest('.cheque-item').remove();
            const container = event.target.closest('.cheques-grid');
            if(container) {
                container.querySelectorAll('.cheque-item label').forEach((label, index) => {
                    label.textContent = `Chèque N°${index + 1} (<?= APP_CURRENCY_SYMBOL ?>)`;
                });
            }
        }
    });
});
</script>
<?php
require 'partials/footer.php';
?>
