// Fichier : public/assets/js/logic/cloture-wizard-ui.js (Complet et Corrigé)

import { formatCurrency, parseLocaleFloat } from '../utils/formatters.js';
import * as service from './cloture-wizard-service.js';

/**
 * Met à jour l'interface globale de l'assistant (indicateurs d'étape, boutons).
 */
export function updateWizardUI(wizardState) {
    document.querySelectorAll('.step-item').forEach(stepEl => {
        stepEl.classList.remove('active');
        if (parseInt(stepEl.dataset.step) === wizardState.currentStep) {
            stepEl.classList.add('active');
        }
    });

    const nextBtn = document.getElementById('wizard-next-btn');
    const prevBtn = document.getElementById('wizard-prev-btn');

    prevBtn.style.display = wizardState.currentStep > 1 ? 'inline-block' : 'none';

    switch(wizardState.currentStep) {
        case 1:
            nextBtn.textContent = 'Suivant';
            nextBtn.disabled = true;
            break;
        case 2:
            nextBtn.textContent = 'Valider les comptages';
            nextBtn.disabled = false;
            break;
        case 3:
            nextBtn.textContent = 'Confirmer et Finaliser';
            nextBtn.disabled = false;
            break;
        case 4:
            nextBtn.textContent = 'Terminer la Journée';
            nextBtn.disabled = true;
            break;
    }
}

/**
 * Affiche l'étape 1 : Sélection des caisses.
 */
export async function renderStep1_Selection(container, config, wsResourceId) {
    container.innerHTML = '<p style="text-align:center;">Chargement de l\'état des caisses...</p>';
    try {
        const response = await fetch('index.php?route=cloture/get_state');
        const stateData = await response.json();
        if (!stateData.success) throw new Error("Impossible de récupérer l'état des caisses.");
        
        const lockedCaisses = stateData.locked_caisses || [];
        const closedCaisses = (stateData.closed_caisses || []).map(String);

        const caissesHtml = Object.entries(config.nomsCaisses).map(([id, nom]) => {
            const isClosed = closedCaisses.includes(id);
            const lockInfo = lockedCaisses.find(c => c.caisse_id.toString() === id);
            const isLockedByOther = lockInfo && String(lockInfo.locked_by) !== String(wsResourceId);
            const isDisabled = isLockedByOther || isClosed;

            let statusClass = 'status-libre';
            let statusIcon = 'fa-check-circle';
            let statusText = 'Prête pour la clôture';

            if (isClosed) {
                statusClass = 'status-cloturee';
                statusIcon = 'fa-flag-checkered';
                statusText = 'Déjà clôturée';
            } else if (isLockedByOther) {
                statusClass = 'status-verrouillee';
                statusIcon = 'fa-lock';
                statusText = 'Utilisée par un autre collaborateur';
            }
            
            const actionHtml = isClosed
                ? `<div class="caisse-action-footer"><button type="button" class="btn reopen-btn js-reopen-caisse" data-caisse-id="${id}"><i class="fa-solid fa-lock-open"></i> Rouvrir</button></div>`
                : `<input type="checkbox" name="caisseSelection" value="${id}" ${isDisabled ? 'disabled' : ''}>`;

            const wrapperTag = isClosed ? 'div' : 'label';

            return `
                <${wrapperTag} class="caisse-selection-item ${statusClass}" title="${statusText}">
                    ${!isClosed ? actionHtml : ''}
                    <div class="caisse-info">
                        <i class="fa-solid ${statusIcon}"></i>
                        <span>${nom}</span>
                        <small class="caisse-status-text">${statusText}</small>
                        ${isClosed ? actionHtml : ''}
                    </div>
                </${wrapperTag}>`;
        }).join('');

        container.innerHTML = `
            <div class="wizard-step-content">
                <h3>Sélectionnez les caisses à clôturer</h3>
                <div class="selection-controls">
                    <div class="color-key">
                        <div><span class="color-dot color-libre"></span> Libre</div>
                        <div><span class="color-dot color-verrouillee"></span> En cours d'utilisation</div>
                        <div><span class="color-dot color-cloturee"></span> Déjà clôturée</div>
                    </div>
                    <div class="button-group">
                        <button type="button" id="select-all-btn" class="btn action-btn">Tout sélectionner</button>
                        <button type="button" id="deselect-all-btn" class="btn action-btn">Tout désélectionner</button>
                    </div>
                </div>
                <div class="caisse-selection-grid">${caissesHtml}</div>
            </div>`;

    } catch (error) {
        container.innerHTML = `<p class="error">${error.message}</p>`;
    }
}

/**
 * Affiche l'étape 2 : Comptage.
 */
export function renderStep2_Counting(container, wizardState, calculatorData, tpeState, chequesState, config) {
    let tabsHtml = '', contentHtml = '', ecartsHtml = '';
    wizardState.selectedCaisses.forEach((id, index) => {
        const nom = config.nomsCaisses[id];
        const isActive = index === 0 ? 'active' : '';
        tabsHtml += `<button type="button" class="tab-link ${isActive}" data-tab="caisse${id}_wizard">${nom}</button>`;
        ecartsHtml += `<div id="ecart-display-caisse${id}_wizard" class="ecart-display ${isActive}"><span class="ecart-value"></span><p class="ecart-explanation"></p></div>`;
        
        const caisseData = calculatorData.caisse[id] || {};
        const denominationsData = caisseData.denominations || {};
        const tpeRelevesPourCaisse = tpeState[id] || {};

        const buildTextInput = (name, value) => `<input type="text" id="${name}_${id}_wizard" name="caisse[${id}][${name}]" data-caisse-id="${id}" value="${value || ''}">`;
        const buildDenomInput = (name, value) => `<input type="number" id="${name}_${id}_wizard" name="caisse[${id}][denominations][${name}]" data-caisse-id="${id}" value="${value || ''}" min="0">`;
        
        const billets = Object.entries(config.denominations.billets).map(([name, v]) => `<div class="form-group"><label>${v} ${config.currencySymbol}</label>${buildDenomInput(name, denominationsData[name])}<span class="total-line" id="total_${name}_${id}_wizard"></span></div>`).join('');
        const pieces = Object.entries(config.denominations.pieces).map(([name, v]) => `<div class="form-group"><label>${v >= 1 ? v + ' ' + config.currencySymbol : (v * 100) + ' cts'}</label>${buildDenomInput(name, denominationsData[name])}<span class="total-line" id="total_${name}_${id}_wizard"></span></div>`).join('');
        
        const tpePourCaisse = config.tpeParCaisse ? Object.entries(config.tpeParCaisse).filter(([, tpe]) => tpe.caisse_id.toString() === id) : [];
        
        const tpeHtml = tpePourCaisse.map(([tpeId, tpe]) => {
            const releves = tpeRelevesPourCaisse[tpeId] || [];
            const totalTpe = releves.reduce((sum, releve) => sum + parseLocaleFloat(releve.montant), 0);
            return `<div class="form-group"><label>${tpe.nom} (Total)</label><input type="text" id="tpe_total_${tpeId}_${id}_wizard" value="${formatCurrency(totalTpe, config)}" readonly></div>`;
        }).join('');

        contentHtml += `
            <div id="caisse${id}_wizard" class="caisse-tab-content ${isActive}">
                <div class="grid grid-4" style="margin-bottom:20px;">
                    <div class="form-group"><label>Fond de Caisse</label>${buildTextInput('fond_de_caisse', caisseData.fond_de_caisse)}</div>
                    <div class="form-group"><label>Ventes Espèces</label>${buildTextInput('ventes_especes', caisseData.ventes_especes)}</div>
                    <div class="form-group"><label>Ventes CB</label>${buildTextInput('ventes_cb', caisseData.ventes_cb)}</div>
                    <div class="form-group"><label>Ventes Chèques</label>${buildTextInput('ventes_cheques', caisseData.ventes_cheques)}</div>
                </div>
                 <div class="form-group">
                    <label>Rétrocessions (en Espèces)</label>
                    ${buildTextInput('retrocession', caisseData.retrocession)}
                </div>
                <div class="payment-method-tabs">
                    <div class="payment-method-selector">
                        <button type="button" class="payment-tab-link active" data-payment-tab="especes_${id}"><i class="fa-solid fa-money-bill-wave"></i> Espèces</button>
                        <button type="button" class="payment-tab-link" data-payment-tab="cb_${id}"><i class="fa-solid fa-credit-card"></i> Carte Bancaire</button>
                        <button type="button" class="payment-tab-link" data-payment-tab="cheques_${id}"><i class="fa-solid fa-money-check-dollar"></i> Chèques</button>
                    </div>
                    <div id="especes_${id}" class="payment-tab-content active"><h4>Billets</h4><div class="grid">${billets}</div><h4 style="margin-top:20px;">Pièces</h4><div class="grid">${pieces}</div></div>
                    <div id="cb_${id}" class="payment-tab-content"><div class="grid">${tpeHtml || '<p>Aucun TPE pour cette caisse.</p>'}</div></div>
                    <div id="cheques_${id}" class="payment-tab-content">
                        <div class="cheque-input-section">
                             <div class="form-group"><label for="cheque-amount-${id}-wizard">Montant du chèque</label><input type="text" id="cheque-amount-${id}-wizard" placeholder="0,00"></div>
                             <div class="form-group"><label for="cheque-comment-${id}-wizard">Commentaire (optionnel)</label><input type="text" id="cheque-comment-${id}-wizard" placeholder="Ex: Chèque n°123"></div>
                             <button type="button" class="btn new-btn add-cheque-btn-wizard" data-caisse-id="${id}"><i class="fa-solid fa-plus"></i> Ajouter</button>
                        </div>
                        <div class="cheque-list-section">
                             <h4>Liste des chèques</h4>
                             <div id="cheque-list-${id}-wizard" class="cheque-list"></div>
                             <div class="cheque-total">Total des chèques: <span id="cheque-total-${id}-wizard">0,00 €</span></div>
                        </div>
                    </div>
                </div>
            </div>`;
    });
    container.innerHTML = `<div class="wizard-step-content"><h3>Vérifiez les comptages</h3><div class="tab-selector">${tabsHtml}</div><div class="ecart-display-container">${ecartsHtml}</div><div id="caisses-content-container">${contentHtml}</div></div>`;
    
    // Initial calculation and rendering for dynamic parts
    wizardState.selectedCaisses.forEach(id => {
        // You would typically call a calculation function here
        // and render dynamic lists like cheques
    });
}

/**
 * Affiche l'étape 3 : Synthèse des retraits.
 */
export function renderStep3_Summary(container, wizardState, calculatorData, config) {
    let summaryHtml = wizardState.selectedCaisses.map(id => {
        const suggestions = service.calculateWithdrawalSuggestion(calculatorData.caisse[id], config);
        wizardState.confirmedData[id] = { withdrawals: suggestions.suggestions, totalToWithdraw: suggestions.totalToWithdraw };
        
        const suggestionTableHtml = suggestions.suggestions.length === 0
            ? `<div class="withdrawal-summary-card"><div class="withdrawal-total-header status-ok"><div class="total-amount">${formatCurrency(0, config)}</div><div class="total-label">Aucun retrait nécessaire</div></div><div class="withdrawal-details-list"><div class="detail-item-empty">Le fond de caisse correspond à la cible.</div></div></div>`
            : `<div class="withdrawal-summary-card"><div class="withdrawal-total-header"><div class="total-amount">${formatCurrency(suggestions.totalToWithdraw, config)}</div><div class="total-label">Total à retirer de la caisse</div></div><div class="withdrawal-details-list">${suggestions.suggestions.map(s => `<div class="detail-item"><span class="detail-item-label"><i class="fa-solid fa-money-bill-wave item-icon"></i> Retirer ${s.qty} x ${s.value >= 1 ? `${s.value} ${config.currencySymbol}` : `${s.value * 100} cts`}</span><span class="detail-item-value">${formatCurrency(s.total, config)}</span></div>`).join('')}</div></div>`;

        return `<div class="card"><h4>Synthèse des retraits pour ${config.nomsCaisses[id]}</h4>${suggestionTableHtml}</div>`;
    }).join('');
    container.innerHTML = `<div class="wizard-step-content"><h3>Synthèse des Opérations de Retrait</h3>${summaryHtml}</div>`;
}

/**
 * Affiche l'étape 4 : Finalisation.
 */
export function renderStep4_Finalization(container, wizardState, calculatorData, tpeState, chequesState, config) {
    let grandTotalVentes = 0, grandTotalCompteEspeces = 0, grandTotalRetraits = 0, grandTotalEcartEspeces = 0, rowsHtml = '';
    let grandTotalCompteCB = 0, grandTotalCompteCheques = 0;

    wizardState.selectedCaisses.forEach(id => {
        const nomCaisse = config.nomsCaisses[id] || `Caisse ${id}`;
        const caisseData = calculatorData.caisse[id] || {};
        const confirmedData = wizardState.confirmedData[id] || {};
        const ventesEspeces = parseLocaleFloat(caisseData.ventes_especes) + parseLocaleFloat(caisseData.retrocession);
        const ventesCb = parseLocaleFloat(caisseData.ventes_cb);
        const ventesCheques = parseLocaleFloat(caisseData.ventes_cheques);
        const totalVentesCaisse = ventesEspeces + ventesCb + ventesCheques;
        const retrait = confirmedData.totalToWithdraw || 0;
        
        let totalCompteEspeces = 0;
        const allDenoms = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
        for (const name in caisseData.denominations) {
            totalCompteEspeces += (parseInt(caisseData.denominations[name], 10) || 0) * (parseFloat(allDenoms[name]) || 0);
        }
        
        let totalCompteCb = 0;
        if(tpeState[id]) {
            for(const tpeId in tpeState[id]) {
                totalCompteCb += (tpeState[id][tpeId] || []).reduce((sum, r) => sum + parseLocaleFloat(r.montant), 0);
            }
        }
        const totalCompteCheques = (chequesState[id] || []).reduce((sum, cheque) => sum + parseLocaleFloat(cheque.montant), 0);
        const totalCompteCaisse = totalCompteEspeces + totalCompteCb + totalCompteCheques;
        const ecartEspeces = (totalCompteEspeces - parseLocaleFloat(caisseData.fond_de_caisse)) - (parseLocaleFloat(caisseData.ventes_especes) + parseLocaleFloat(caisseData.retrocession));
        const fondDeCaisseJ1 = totalCompteEspeces - retrait;
        
        grandTotalVentes += totalVentesCaisse;
        grandTotalCompteEspeces += totalCompteEspeces;
        grandTotalCompteCB += totalCompteCb;
        grandTotalCompteCheques += totalCompteCheques;
        grandTotalRetraits += retrait;
        grandTotalEcartEspeces += ecartEspeces;
        rowsHtml += `<tr><td><strong>${nomCaisse}</strong></td><td>${formatCurrency(totalVentesCaisse, config)}</td><td>${formatCurrency(totalCompteCaisse, config)}</td><td class="ecart-${Math.abs(ecartEspeces) < 0.01 ? 'ok' : (ecartEspeces > 0 ? 'positif' : 'negatif')}">${formatCurrency(ecartEspeces, config)}</td><td class="text-danger">${formatCurrency(retrait, config)}</td><td class="text-success">${formatCurrency(fondDeCaisseJ1, config)}</td></tr>`;
    });

    const grandTotalCompte = grandTotalCompteEspeces + grandTotalCompteCB + grandTotalCompteCheques;
    container.innerHTML = `
        <div class="wizard-step-content">
            <h3><i class="fa-solid fa-flag-checkered"></i> Synthèse Finale</h3>
            <p class="subtitle" style="text-align:center; margin-top:-20px; margin-bottom: 30px;">Veuillez vérifier les totaux avant de finaliser la journée.</p>
            <div class="card" style="padding:0;">
                <table class="final-summary-table">
                    <thead><tr><th>Caisse</th><th>Ventes Totales</th><th>Compté Total</th><th>Écart Espèces</th><th>Retrait Espèces</th><th>Fond de Caisse J+1</th></tr></thead>
                    <tbody>${rowsHtml}</tbody>
                    <tfoot><tr><td><strong>TOTAL GÉNÉRAL</strong></td><td><strong>${formatCurrency(grandTotalVentes, config)}</strong></td><td><strong>${formatCurrency(grandTotalCompte, config)}</strong></td><td class="ecart-${Math.abs(grandTotalEcartEspeces) < 0.01 ? 'ok' : (grandTotalEcartEspeces > 0 ? 'positif' : 'negatif')}"><strong>${formatCurrency(grandTotalEcartEspeces, config)}</strong></td><td class="text-danger"><strong>${formatCurrency(grandTotalRetraits, config)}</strong></td><td class="text-success"><strong>${formatCurrency(grandTotalCompteEspeces - grandTotalRetraits, config)}</strong></td></tr></tfoot>
                </table>
            </div>
            <div class="next-steps-info">
                <h4>Que se passe-t-il après avoir finalisé ?</h4>
                <ul>
                    <li><i class="fa-solid fa-check-circle"></i> Un comptage "Clôture Générale" sera créé dans l'historique avec les chiffres de ce tableau.</li>
                    <li><i class="fa-solid fa-check-circle"></i> Un nouveau comptage "Fond de caisse J+1" sera automatiquement généré pour démarrer la journée de demain.</li>
                    <li><i class="fa-solid fa-check-circle"></i> L'état des caisses sera réinitialisé.</li>
                </ul>
            </div>
            <div class="confirmation-box">
                <label><input type="checkbox" id="final-confirmation-checkbox"> Je confirme avoir vérifié les montants et je souhaite clôturer la journée.</label>
            </div>
        </div>`;
}
