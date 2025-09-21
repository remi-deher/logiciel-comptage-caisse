// Fichier : public/assets/js/logic/cloture-wizard-ui.js

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
    
    const wizardNav = document.querySelector('.wizard-navigation');
    const prevBtnHtml = `<button id="wizard-prev-btn" class="btn"><i class="fa-solid fa-arrow-left"></i> Précédent</button>`;
    const nextBtnHtml = `<button id="wizard-next-btn" class="btn save-btn">Suivant <i class="fa-solid fa-arrow-right"></i></button>`;
    const finishBtnHtml = `<button id="wizard-finish-btn" class="btn save-btn" disabled>Terminer la Journée <i class="fa-solid fa-flag-checkered"></i></button>`;

    let navHtml = `<button id="wizard-cancel-btn" class="btn delete-btn"><i class="fa-solid fa-xmark"></i> Annuler</button><div>`;
    if (wizardState.currentStep > 1) navHtml += prevBtnHtml;
    if (wizardState.currentStep < 4) navHtml += nextBtnHtml;
    else navHtml += finishBtnHtml;
    navHtml += `</div>`;
    wizardNav.innerHTML = navHtml;

    const nextBtn = document.getElementById('wizard-next-btn');
    if (!nextBtn) return;

    switch(wizardState.currentStep) {
        case 1:
            nextBtn.innerHTML = 'Suivant <i class="fa-solid fa-arrow-right"></i>';
            nextBtn.disabled = document.querySelectorAll('input[name="caisseSelection"]:checked').length === 0;
            break;
        case 2:
            nextBtn.innerHTML = 'Valider les comptages <i class="fa-solid fa-arrow-right"></i>';
            const allValidated = Object.values(wizardState.validationStatus).every(caisse => caisse.especes && caisse.cb && caisse.cheques);
            nextBtn.disabled = !allValidated;
            break;
        case 3:
            nextBtn.innerHTML = 'Confirmer et Finaliser <i class="fa-solid fa-arrow-right"></i>';
            nextBtn.disabled = false;
            break;
    }
}


/**
 * Affiche l'étape 1 : Sélection des caisses.
 */
export async function renderStep1_Selection(container, config, wsResourceId) {
    container.innerHTML = '<p style="text-align:center;">Chargement de l\'état des caisses...</p>';
    try {
        const stateData = await service.fetchClotureState();
        if (!stateData.success) throw new Error("Impossible de récupérer l'état des caisses.");
        
        const lockedCaisses = stateData.locked_caisses || [];
        const closedCaisses = (stateData.closed_caisses || []).map(String);

        const caissesHtml = Object.entries(config.nomsCaisses).map(([id, nom]) => {
            const isClosed = closedCaisses.includes(id);
            const lockInfo = lockedCaisses.find(c => c.caisse_id.toString() === id);
            const isLockedByOther = lockInfo && String(lockInfo.locked_by) !== String(wsResourceId);
            const isDisabled = isLockedByOther || isClosed;

            let statusClass = 'status-libre';
            let statusText = 'Prête pour la clôture';

            if (isClosed) {
                statusClass = 'status-cloturee';
                statusText = 'Déjà clôturée';
            } else if (isLockedByOther) {
                statusClass = 'status-verrouillee';
                statusText = 'Utilisée par un autre collaborateur';
            }
            
            return `
                <label class="caisse-selection-item ${statusClass}" title="${statusText}">
                    <input type="checkbox" name="caisseSelection" value="${id}" ${isDisabled ? 'disabled' : ''}>
                    <div class="caisse-info">
                        <i class="fa-solid fa-cash-register"></i>
                        <span>${nom}</span>
                        <small class="caisse-status-text">${statusText}</small>
                    </div>
                     ${isClosed ? `<button type="button" class="btn reopen-btn js-reopen-caisse" data-caisse-id="${id}"><i class="fa-solid fa-lock-open"></i> Rouvrir</button>` : ''}
                </label>`;
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
 * Affiche l'étape 2 : Réconciliation guidée.
 */
export function renderStep2_Reconciliation(container, state) {
    const { wizardState, calculatorData, tpeState, chequesState, config } = state;

    let tabsHtml = '', contentHtml = '';
    wizardState.selectedCaisses.forEach((id, index) => {
        const nom = config.nomsCaisses[id];
        const isActive = index === 0 ? 'active' : '';
        tabsHtml += `<button type="button" class="tab-link ${isActive}" data-tab="caisse${id}_wizard">${nom}</button>`;
        
        const caisseData = calculatorData.caisse[id] || {};
        contentHtml += `<div id="caisse${id}_wizard" class="caisse-tab-content ${isActive}">
            ${createReconciliationSection('especes', id, caisseData, config)}
            ${createReconciliationSection('cb', id, caisseData, config)}
            ${createReconciliationSection('cheques', id, caisseData, config)}
        </div>`;
    });

    container.innerHTML = `
        <div class="wizard-step-content">
            <h3>Étape 2 : Réconciliation des Caisses</h3>
            <p class="subtitle" style="text-align:center; margin-top:-20px; margin-bottom:20px;">
                Vérifiez et ajustez les montants pour chaque mode de paiement. L'écart doit être à 0.00€ pour pouvoir valider une section.
            </p>
            <div class="tab-selector">${tabsHtml}</div>
            <div id="caisses-content-container">${contentHtml}</div>
        </div>`;

    wizardState.selectedCaisses.forEach(id => {
        const caisseData = calculatorData.caisse[id] || {};
        
        document.getElementById(`details-especes-${id}`).innerHTML = createEspecesDetails(id, caisseData.denominations, config);
        document.getElementById(`details-cb-${id}`).innerHTML = createCbDetails(id, tpeState[id], config);
        document.getElementById(`details-cheques-${id}`).innerHTML = createChequesDetails(id, chequesState[id], config);
        
        service.calculateAndDisplayAllEcarts(id, state);
    });
}


function createReconciliationSection(type, caisseId, caisseData, config) {
    const icons = { especes: 'fa-money-bill-wave', cb: 'fa-credit-card', cheques: 'fa-money-check-dollar' };
    const titles = { especes: 'Espèces', cb: 'Carte Bancaire', cheques: 'Chèques' };
    
    let aSaisirHtml = '';
    if (type === 'especes') {
        aSaisirHtml = `
            <div class="form-group"><label>1. Ventes Espèces Théoriques</label><input type="text" class="reconciliation-input" data-caisse-id="${caisseId}" data-type="especes" name="caisse[${caisseId}][ventes_especes]" value="${caisseData.ventes_especes || ''}"></div>
            <div class="form-group"><label>2. Rétrocessions</label><input type="text" class="reconciliation-input" data-caisse-id="${caisseId}" data-type="especes" name="caisse[${caisseId}][retrocession]" value="${caisseData.retrocession || ''}"></div>
             <div class="form-group"><label>3. Fond de Caisse Initial</label><input type="text" class="reconciliation-input" data-caisse-id="${caisseId}" data-type="especes" name="caisse[${caisseId}][fond_de_caisse]" value="${caisseData.fond_de_caisse || ''}"></div>`;
    } else {
        aSaisirHtml = `<div class="form-group"><label>1. Ventes ${titles[type]} Théoriques</label><input type="text" class="reconciliation-input" data-caisse-id="${caisseId}" data-type="${type}" name="caisse[${caisseId}][ventes_${type}]" value="${caisseData[`ventes_${type}`] || ''}"></div>`;
    }

    return `
        <div class="reconciliation-section" id="section-${type}-${caisseId}">
            <div class="reconciliation-header">
                <h3><i class="fa-solid ${icons[type]}"></i> ${titles[type]}</h3>
                <div class="reconciliation-status" id="status-${type}-${caisseId}">
                    <span class="ecart-value">--.-- €</span>
                    <button type="button" class="btn validate-section-btn" data-caisse-id="${caisseId}" data-type="${type}" disabled>
                        <i class="fa-solid fa-check"></i> Valider
                    </button>
                </div>
            </div>
            <div class="reconciliation-body">
                <div class="reconciliation-panel">
                    <h4>À Saisir</h4>
                    ${aSaisirHtml}
                </div>
                <div class="reconciliation-panel">
                    <h4>Compté (calculé)</h4>
                    <div class="reconciliation-counted" id="counted-${type}-${caisseId}">0,00 €</div>
                </div>
            </div>
            <div class="reconciliation-details" id="details-${type}-${caisseId}"></div>
        </div>`;
}

function createEspecesDetails(caisseId, denominationsData, config) {
    const buildDenomInput = (name, value) => `<input type="number" class="reconciliation-input" data-caisse-id="${caisseId}" data-type="especes" name="caisse[${caisseId}][denominations][${name}]" value="${value || ''}" min="0">`;
    const billets = Object.entries(config.denominations.billets).map(([name, v]) => `<div class="form-group grid-item"><label>${v} ${config.currencySymbol}</label>${buildDenomInput(name, denominationsData ? denominationsData[name] : '')}<span class="total-line" id="total_${name}_${caisseId}_wizard"></span></div>`).join('');
    const pieces = Object.entries(config.denominations.pieces).map(([name, v]) => `<div class="form-group grid-item"><label>${v >= 1 ? v + ' ' + config.currencySymbol : (v * 100) + ' cts'}</label>${buildDenomInput(name, denominationsData ? denominationsData[name] : '')}<span class="total-line" id="total_${name}_${caisseId}_wizard"></span></div>`).join('');
    return `<h5>Détail des Espèces</h5><div class="grid">${billets}</div><h5 style="margin-top:20px;">Pièces</h5><div class="grid">${pieces}</div>`;
}

function createCbDetails(caisseId, tpeData, config) {
    const tpePourCaisse = config.tpeParCaisse ? Object.entries(config.tpeParCaisse).filter(([,tpe]) => tpe.caisse_id.toString() === caisseId) : [];
    if (tpePourCaisse.length === 0) return '<h5>Détail CB</h5><p>Aucun TPE configuré pour cette caisse.</p>';
    
    const tpeHtml = tpePourCaisse.map(([tpeId, tpe]) => `
        <div class="card tpe-card-wizard">
            <h6>${tpe.nom}</h6>
            <div id="tpe-list-${tpeId}-${caisseId}">${createTpeReleveList(tpeData[tpeId], config, caisseId, tpeId)}</div>
            <div class="form-group-inline">
                <input type="text" class="reconciliation-input" id="tpe-amount-${tpeId}-${caisseId}" placeholder="Montant">
                <button type="button" class="btn new-btn add-tpe-btn" data-caisse-id="${caisseId}" data-tpe-id="${tpeId}">+</button>
            </div>
        </div>`
    ).join('');
    return `<h5>Détail des Relevés TPE</h5><div class="grid-3">${tpeHtml}</div>`;
}

function createChequesDetails(caisseId, cheques, config) {
    return `
        <h5>Détail des Chèques</h5>
        <div class="cheque-wizard-grid">
            <div class="card cheque-card-wizard">
                <div id="cheque-list-${caisseId}">${createChequeList(cheques, config, caisseId)}</div>
            </div>
            <div class="card cheque-card-wizard">
                 <h6>Ajouter un chèque</h6>
                 <div class="form-group"><label>Montant</label><input type="text" class="reconciliation-input" id="cheque-amount-${caisseId}"></div>
                 <div class="form-group"><label>Commentaire</label><input type="text" class="reconciliation-input" id="cheque-comment-${caisseId}"></div>
                 <button type="button" class="btn new-btn add-cheque-btn" data-caisse-id="${caisseId}" style="width:100%">Ajouter Chèque</button>
            </div>
        </div>`;
}

export function createTpeReleveList(releves, config, caisseId, tpeId) {
    if (!releves || releves.length === 0) return '<p class="empty-list">Aucun relevé.</p>';
    return `<ul>${releves.map((r, index) => `<li>${formatCurrency(parseLocaleFloat(r.montant), config)} <button type="button" class="delete-item-btn delete-tpe-btn" data-caisse-id="${caisseId}" data-tpe-id="${tpeId}" data-index="${index}">&times;</button></li>`).join('')}</ul>`;
}

export function createChequeList(cheques, config, caisseId) {
     if (!cheques || cheques.length === 0) return '<p class="empty-list">Aucun chèque.</p>';
    return `<ul>${cheques.map((c, index) => `<li>${formatCurrency(parseLocaleFloat(c.montant), config)} <small>(${c.commentaire || 'N/A'})</small> <button type="button" class="delete-item-btn delete-cheque-btn" data-caisse-id="${caisseId}" data-index="${index}">&times;</button></li>`).join('')}</ul>`;
}

export function renderStep3_Summary(container, state) {
    let summaryHtml = state.wizardState.selectedCaisses.map(id => {
        const suggestions = service.calculateWithdrawalSuggestion(state.calculatorData.caisse[id], state.config);
        state.wizardState.confirmedData[id] = { withdrawals: suggestions.suggestions, totalToWithdraw: suggestions.totalToWithdraw };
        
        const suggestionTableHtml = suggestions.suggestions.length === 0
            ? `<div class="withdrawal-summary-card"><div class="withdrawal-total-header status-ok"><div class="total-amount">${formatCurrency(0, state.config)}</div><div class="total-label">Aucun retrait nécessaire</div></div><div class="withdrawal-details-list"><div class="detail-item-empty">Le fond de caisse correspond à la cible.</div></div></div>`
            : `<div class="withdrawal-summary-card"><div class="withdrawal-total-header"><div class="total-amount">${formatCurrency(suggestions.totalToWithdraw, state.config)}</div><div class="total-label">Total à retirer de la caisse</div></div><div class="withdrawal-details-list">${suggestions.suggestions.map(s => `<div class="detail-item"><span class="detail-item-label"><i class="fa-solid fa-money-bill-wave item-icon"></i> Retirer ${s.qty} x ${s.value >= 1 ? `${s.value} ${state.config.currencySymbol}` : `${s.value * 100} cts`}</span><span class="detail-item-value">${formatCurrency(s.total, state.config)}</span></div>`).join('')}</div></div>`;

        return `<div class="card"><h4>Synthèse des retraits pour ${state.config.nomsCaisses[id]}</h4>${suggestionTableHtml}</div>`;
    }).join('');
    container.innerHTML = `<div class="wizard-step-content"><h3>Étape 3 : Synthèse des Opérations de Retrait</h3>${summaryHtml}</div>`;
}

export function renderStep4_Finalization(container, state) {
    const { wizardState, calculatorData, config } = state;
    let grandTotalVentes = 0, grandTotalCompteEspeces = 0, grandTotalRetraits = 0, grandTotalEcartEspeces = 0, rowsHtml = '';
    let grandTotalCompteCB = 0, grandTotalCompteCheques = 0;

    wizardState.selectedCaisses.forEach(id => {
        const nomCaisse = config.nomsCaisses[id] || `Caisse ${id}`;
        const caisseData = calculatorData.caisse[id] || {};
        const confirmedData = wizardState.confirmedData[id] || {};
        const { ecartEspeces, totalCompteEspeces, totalCompteCb, totalCompteCheques } = service.calculateEcartsForCaisse(id, state);
        
        const ventesEspeces = parseLocaleFloat(caisseData.ventes_especes) + parseLocaleFloat(caisseData.retrocession);
        const ventesCb = parseLocaleFloat(caisseData.ventes_cb);
        const ventesCheques = parseLocaleFloat(caisseData.ventes_cheques);
        const totalVentesCaisse = ventesEspeces + ventesCb + ventesCheques;
        const retrait = confirmedData.totalToWithdraw || 0;
        
        const totalCompteCaisse = totalCompteEspeces + totalCompteCb + totalCompteCheques;
        const fondDeCaisseJ1 = totalCompteEspeces - retrait;
        
        grandTotalVentes += totalVentesCaisse;
        grandTotalCompteEspeces += totalCompteEspeces;
        grandTotalCompteCB += totalCompteCb;
        grandTotalCompteCheques += totalCompteCheques;
        grandTotalRetraits += retrait;
        grandTotalEcartEspeces += ecartEspeces;
        rowsHtml += `<tr><td><strong>${nomCaisse}</strong></td><td>${formatCurrency(totalVentesCaisse, config)}</td><td>${formatCurrency(totalCompteCaisse, config)}</td><td class="text-success">${formatCurrency(ecartEspeces, config)}</td><td class="text-danger">${formatCurrency(retrait, config)}</td><td class="text-success">${formatCurrency(fondDeCaisseJ1, config)}</td></tr>`;
    });

    const grandTotalCompte = grandTotalCompteEspeces + grandTotalCompteCB + grandTotalCompteCheques;
    container.innerHTML = `
        <div class="wizard-step-content">
            <h3><i class="fa-solid fa-flag-checkered"></i> Synthèse Finale</h3>
            <p class="subtitle" style="text-align:center; margin-top:-20px; margin-bottom: 30px;">Veuillez vérifier les totaux avant de finaliser la journée.</p>
            <div class="card" style="padding:0; overflow-x: auto;">
                <table class="final-summary-table">
                    <thead><tr><th>Caisse</th><th>Ventes Totales</th><th>Compté Total</th><th>Écart Espèces</th><th>Retrait Espèces</th><th>Fond de Caisse J+1</th></tr></thead>
                    <tbody>${rowsHtml}</tbody>
                    <tfoot><tr><td><strong>TOTAL GÉNÉRAL</strong></td><td><strong>${formatCurrency(grandTotalVentes, config)}</strong></td><td><strong>${formatCurrency(grandTotalCompte, config)}</strong></td><td class="text-success"><strong>${formatCurrency(grandTotalEcartEspeces, config)}</strong></td><td class="text-danger"><strong>${formatCurrency(grandTotalRetraits, config)}</strong></td><td class="text-success"><strong>${formatCurrency(grandTotalCompteEspeces - grandTotalRetraits, config)}</strong></td></tr></tfoot>
                </table>
            </div>
            <div class="next-steps-info">
                <h4>Que se passe-t-il après avoir finalisé ?</h4>
                <ul>
                    <li><i class="fa-solid fa-check-circle"></i> Un comptage "Clôture" sera créé dans l'historique pour chaque caisse.</li>
                    <li><i class="fa-solid fa-check-circle"></i> L'état des caisses sera réinitialisé.</li>
                </ul>
            </div>
            <div class="confirmation-box">
                <label><input type="checkbox" id="final-confirmation-checkbox"> Je confirme avoir vérifié les montants et je souhaite clôturer la journée.</label>
            </div>
        </div>`;
}
