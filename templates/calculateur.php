<?php
// templates/calculateur.php

// MISE À JOUR : La variable $page_js est maintenant définie dans le contrôleur
// $page_js = 'calculator.js'; 

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
        <div class="tpe-grid">
            <?php foreach ($terminaux_par_caisse[$id] as $terminal): ?>
            <div class="tpe-card" id="tpe-card-<?= $terminal['id'] ?>">
                <div class="tpe-card-header">
                    <h4><i class="fa-solid fa-credit-card"></i> <?= htmlspecialchars($terminal['nom_terminal']) ?></h4>
                    <strong class="tpe-total" id="tpe-total-<?= $terminal['id'] ?>">0,00 <?= APP_CURRENCY_SYMBOL ?></strong>
                </div>
                <div class="tpe-saisie-container">
                    <div class="form-group-tpe-add">
                        <input type="text" class="add-releve-input" data-terminal-id="<?= $terminal['id'] ?>" placeholder="Nouveau relevé..." <?= $disabled_attr ?>>
                        <button type="button" class="btn-add-tpe-from-input" data-terminal-id="<?= $terminal['id'] ?>" <?= $disabled_attr ?>><i class="fa-solid fa-plus"></i> Ajouter</button>
                    </div>
                </div>
                <div class="tpe-releves-table-container">
                    <table class="tpe-releves-table">
                        <thead>
                            <tr>
                                <th>Heure</th>
                                <th>Montant</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="tpe-releves-body-<?= $terminal['id'] ?>">
                            </tbody>
                    </table>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
        <div class="cb-summary">
            <div class="form-group">
                <label>Total encaissement CB logiciel (<?= APP_CURRENCY_SYMBOL ?>)</label>
                <input type="text" id="cb_attendu_<?= $id ?>" class="cb-attendu" data-caisse-id="<?= $id ?>" placeholder="0,00" <?= $disabled_attr ?>>
            </div>
            <div class="form-group">
                <label>Encaissement CB réalisé (Total des relevés)</label>
                <input type="text" id="cb_constate_<?= $id ?>" readonly>
            </div>
            <div class="form-group">
                <label>Écart TPE</label>
                <input type="text" id="cb_ecart_<?= $id ?>" readonly>
                <span class="ecart-message" id="cb_ecart_message_<?= $id ?>"></span>
            </div>
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
                                        <?php if ($index > 0): ?>
                                            <button type="button" class="action-btn-small delete-btn remove-cheque-btn" <?= $disabled_attr ?>><i class="fa-solid fa-trash-can"></i></button>
                                        <?php endif; ?>
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
            const itemToRemove = event.target.closest('.cheque-item');
            const container = itemToRemove.closest('.cheques-grid');
            itemToRemove.remove();
            
            container.querySelectorAll('.cheque-item label').forEach((label, index) => {
                label.textContent = `Chèque N°${index + 1} (<?= APP_CURRENCY_SYMBOL ?>)`;
            });
        }
    });
});
</script>

<div id="caisse-selection-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header-cloture">
            <h3><i class="fa-solid fa-store"></i> Gestion de la Clôture</h3>
            <p>Sélectionnez une caisse pour commencer la procédure.</p>
        </div>
        <div class="modal-body-cloture">
            <div class="color-key">
                <div><span class="color-dot color-libre"></span> Libre</div>
                <div><span class="color-dot color-en-cours"></span> En cours</div>
                <div><span class="color-dot color-cloturee"></span> Clôturée</div>
            </div>
            <div class="caisse-status-list">
                </div>
        </div>
    </div>
</div>

<div id="cloture-confirmation-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3><i class="fa-solid fa-check-double"></i> Confirmer la clôture de : <span id="confirm-caisse-name"></span></h3>
        </div>
        <p>Veuillez vérifier les informations ci-dessous avant de confirmer la clôture définitive de cette caisse.</p>
        <div id="confirm-caisse-summary"></div>
        <div id="confirm-caisse-withdrawal"></div>
        <div id="confirm-caisse-cheques"></div>
        <p class="warning-text">Cette action est irréversible et créera un enregistrement final dans l'historique.</p>
        <div class="modal-actions">
            <button id="cancel-cloture-btn" class="btn delete-btn">Annuler</button>
            <button id="confirm-final-cloture-btn" class="btn save-btn">Confirmer la Clôture</button>
        </div>
    </div>
</div>

<div id="cloture-generale-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <i class="fa-solid fa-flag-checkered"></i>
            <div>
                <h3>Clôture Générale</h3>
                <p>Toutes les caisses ont été confirmées. Voici le récapitulatif final avant de préparer la journée suivante.</p>
            </div>
        </div>
        <div class="modal-body">
            <div class="accordion-container"></div>
            <div id="cheques-summary-container"></div>
            <div class="modal-actions">
                <button id="confirm-cloture-generale-btn" class="btn save-btn"><i class="fa-solid fa-power-off"></i> Lancer la Clôture Générale</button>
            </div>
        </div>
    </div>
</div>

<div id="final-confirmation-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header-danger">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <h3>Êtes-vous absolument sûr ?</h3>
        </div>
        <div class="modal-body">
            <p>Cette action va finaliser tous les comptages de la journée et réinitialiser les caisses pour demain. Elle ne peut pas être annulée.</p>
            <div class="modal-actions">
                <button id="cancel-final-cloture-action-btn" class="btn delete-btn">Annuler</button>
                <button id="confirm-final-cloture-action-btn" class="btn save-btn">Oui, terminer la journée</button>
            </div>
        </div>
    </div>
</div>

<?php
require 'partials/footer.php';
?>
