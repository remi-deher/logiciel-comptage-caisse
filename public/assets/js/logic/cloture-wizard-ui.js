// Fichier : public/assets/js/logic/cloture-wizard-ui.js (Version Finale Complète et Corrigée)

import { formatCurrency, parseLocaleFloat } from '../utils/formatters.js';
import * as service from './cloture-wizard-service.js';

// --- Fonctions de Rendu des Composants ---

export function createTpeReleveList(releves, config, caisseId, tpeId) {
    if (!releves || releves.length === 0) return '<p class="empty-list">Aucun relevé.</p>';
    return `<ul>${releves.map((r, index) => `<li>${formatCurrency(parseLocaleFloat(r.montant), config)} <button type="button" class="delete-item-btn delete-tpe-btn" data-caisse-id="${caisseId}" data-tpe-id="${tpeId}" data-index="${index}">&times;</button></li>`).join('')}</ul>`;
}

export function createChequeList(cheques, config, caisseId) {
    if (!cheques || cheques.length === 0) return '<p class="empty-list">Aucun chèque.</p>';
    return `<ul>${cheques.map((c, index) => `<li>${formatCurrency(parseLocaleFloat(c.montant), config)} <small>(${c.commentaire || 'N/A'})</small> <button type="button" class="delete-item-btn delete-cheque-btn" data-caisse-id="${caisseId}" data-index="${index}">&times;</button></li>`).join('')}</ul>`;
}


// --- Fonctions de Rendu des Étapes de la Modale ---

function renderStep1_Selection(modalElement, state) {
    const { config, wsResourceId } = state;
    modalElement.innerHTML = '<div class="modal-content wide"><p style="text-align:center;">Chargement...</p></div>';

    service.fetchClotureState().then(stateData => {
        if (!stateData.success) throw new Error("Impossible de récupérer l'état des caisses.");
        
        const caissesHtml = Object.entries(config.nomsCaisses).map(([id, nom]) => {
            const { statusClass, statusText, isDisabled } = service.getCaisseStatusInfo(id, stateData, wsResourceId);
            return `
                <label class="caisse-selection-item ${statusClass}" title="${statusText}">
                    <input type="checkbox" name="caisseSelection" value="${id}" ${isDisabled ? 'disabled' : ''}>
                    <div class="caisse-info">
                        <i class="fa-solid fa-cash-register"></i>
                        <span>${nom}</span>
                        <small class="caisse-status-text">${statusText}</small>
                    </div>
                     ${statusClass === 'status-cloturee' ? `<button type="button" class="btn reopen-btn js-reopen-caisse" data-caisse-id="${id}"><i class="fa-solid fa-lock-open"></i> Rouvrir</button>` : ''}
                </label>`;
        }).join('');

        modalElement.innerHTML = `
            <div class="modal-content wide">
                <div class="modal-header"><h3>Étape 1 : Sélection des Caisses</h3><span class="modal-close" id="wizard-cancel-btn">&times;</span></div>
                <div class="modal-body">
                    <div class="selection-controls">
                        <div class="color-key">
                            <div><span class="color-dot color-libre"></span> Libre</div>
                            <div><span class="color-dot color-verrouillee"></span> En cours</div>
                            <div><span class="color-dot color-cloturee"></span> Clôturée</div>
                        </div>
                        <div class="button-group">
                            <button type="button" id="select-all-btn" class="btn action-btn">Tout sélectionner</button>
                            <button type="button" id="deselect-all-btn" class="btn action-btn">Tout désélectionner</button>
                        </div>
                    </div>
                    <div class="caisse-selection-grid">${caissesHtml}</div>
                </div>
                <div class="modal-footer">
                    <button class="btn delete-btn" id="wizard-cancel-btn">Annuler</button>
                    <button class="btn save-btn" id="wizard-next-btn" disabled>Démarrer la Clôture</button>
                </div>
            </div>`;
    }).catch(error => {
        modalElement.innerHTML = `<div class="modal-content"><p class="error">${error.message}</p></div>`;
    });
}

function renderStep_Loading(modalElement) {
    modalElement.innerHTML = `
        <div class="modal-content">
            <div class="modal-body" style="text-align:center; padding: 40px 0;">
                <i class="fa-solid fa-lock fa-2x fa-beat"></i>
                <p style="margin-top:20px; font-weight:bold;">Verrouillage des caisses...</p>
            </div>
        </div>`;
}

function renderStep2_Reconciliation(container, state) {
    const { wizardState, calculatorData, config } = state;
    const { reconciliation } = wizardState;
    const caisseId = wizardState.selectedCaisses[reconciliation.activeCaisseIndex];
    const method = reconciliation.paymentMethods[reconciliation.activeMethodIndex];
    const caisseData = calculatorData.caisse[caisseId] || {};

    const caissesProgressHtml = wizardState.selectedCaisses.map((id, index) => {
        const isActive = index === reconciliation.activeCaisseIndex ? 'active' : '';
        const isDone = reconciliation.status[id] ? Object.values(reconciliation.status[id]).every(s => s === true) : false;
        return `<div class="progress-item ${isActive} ${isDone ? 'done' : ''}">${config.nomsCaisses[id]}</div>`;
    }).join('');

    const methodsProgressHtml = reconciliation.paymentMethods.map((m, index) => {
        const titles = { especes: 'Espèces', cb: 'CB', cheques: 'Chèques' };
        const isActive = index === reconciliation.activeMethodIndex ? 'active' : '';
        const isDone = reconciliation.status[caisseId] ? reconciliation.status[caisseId][m] : false;
        return `<div class="progress-item ${isActive} ${isDone ? 'done' : ''}">${titles[m]}</div>`;
    }).join('');

    container.innerHTML = `
        <div class="reconciliation-progress">
            <div class="progress-group">
                <div class="progress-title">Caisse en cours :</div>
                <div class="progress-bar">${caissesProgressHtml}</div>
            </div>
            <div class="progress-group">
                <div class="progress-title">Paiement :</div>
                <div class="progress-bar">${methodsProgressHtml}</div>
            </div>
        </div>
        <div id="reconciliation-content-container">
            ${createReconciliationSection(method, caisseId, caisseData, state)}
        </div>`;
    
    document.getElementById(`details-${method}-${caisseId}`).innerHTML = createDetailsSection(method, caisseId, state);
    service.calculateAndDisplayAllEcarts(caisseId, state);
}


function createReconciliationSection(type, caisseId, caisseData, state) {
    const icons = { especes: 'fa-money-bill-wave', cb: 'fa-credit-card', cheques: 'fa-money-check-dollar' };
    const titles = { especes: 'Espèces', cb: 'Carte Bancaire', cheques: 'Chèques' };
    
    let aSaisirHtml = '';
    if (type === 'especes') {
        aSaisirHtml = `
            <div class="form-group"><label>1. Ventes Espèces Théoriques</label><input type="text" class="reconciliation-input" data-caisse-id="${caisseId}" name="caisse[${caisseId}][ventes_especes]" value="${caisseData.ventes_especes || ''}"></div>
            <div class="form-group"><label>2. Rétrocessions</label><input type="text" class="reconciliation-input" data-caisse-id="${caisseId}" name="caisse[${caisseId}][retrocession]" value="${caisseData.retrocession || ''}"></div>
            <div class="form-group"><label>3. Fond de Caisse Initial</label><input type="text" class="reconciliation-input" data-caisse-id="${caisseId}" name="caisse[${caisseId}][fond_de_caisse]" value="${caisseData.fond_de_caisse || ''}"></div>`;
    } else {
        aSaisirHtml = `<div class="form-group"><label>1. Ventes ${titles[type]} Théoriques</label><input type="text" class="reconciliation-input" data-caisse-id="${caisseId}" name="caisse[${caisseId}][ventes_${type}]" value="${caisseData[`ventes_${type}`] || ''}"></div>`;
    }

    const isDone = state.wizardState.reconciliation.status[caisseId]?.[type];
    const buttonText = isDone ? 'Validé' : 'Valider et Continuer';

    return `
        <div class="reconciliation-section" id="section-${type}-${caisseId}">
            <div class="reconciliation-header">
                <h3><i class="fa-solid ${icons[type]}"></i> ${titles[type]}</h3>
                <div class="reconciliation-status" id="status-${type}-${caisseId}">
                    <span class="ecart-value">--.-- €</span>
                    <button type="button" class="btn validate-section-btn" data-caisse-id="${caisseId}" data-type="${type}" disabled>
                        <i class="fa-solid fa-check"></i> ${buttonText}
                    </button>
                </div>
            </div>
            <div class="reconciliation-body">
                <div class="reconciliation-panel"><h4>À Saisir</h4>${aSaisirHtml}</div>
                <div class="reconciliation-panel"><h4>Compté (calculé)</h4><div class="reconciliation-counted" id="counted-${type}-${caisseId}">0,00 €</div></div>
            </div>
            <div class="reconciliation-details" id="details-${type}-${caisseId}"></div>
        </div>`;
}

function createDetailsSection(type, caisseId, state) {
    const { calculatorData, chequesState, tpeState, config } = state;
    const denominationsData = calculatorData.caisse[caisseId]?.denominations;

    switch(type) {
        case 'especes':
            const billets = Object.entries(config.denominations.billets).map(([name, v]) => `<div class="form-group grid-item"><label>${v} ${config.currencySymbol}</label><input type="number" class="reconciliation-input" data-caisse-id="${caisseId}" name="caisse[${caisseId}][denominations][${name}]" value="${denominationsData?.[name] || ''}" min="0"></div>`).join('');
            const pieces = Object.entries(config.denominations.pieces).map(([name, v]) => `<div class="form-group grid-item"><label>${v >= 1 ? v + ' ' + config.currencySymbol : (v * 100) + ' cts'}</label><input type="number" class="reconciliation-input" data-caisse-id="${caisseId}" name="caisse[${caisseId}][denominations][${name}]" value="${denominationsData?.[name] || ''}" min="0"></div>`).join('');
            return `<h5>Détail des Espèces</h5><div class="grid">${billets}</div><h5 style="margin-top:20px;">Pièces</h5><div class="grid">${pieces}</div>`;
        
        case 'cb':
            const tpePourCaisse = config.tpeParCaisse ? Object.entries(config.tpeParCaisse).filter(([,tpe]) => tpe.caisse_id.toString() === caisseId) : [];
            if (tpePourCaisse.length === 0) return '<h5>Détail CB</h5><p>Aucun TPE configuré pour cette caisse.</p>';
            const tpeHtml = tpePourCaisse.map(([tpeId, tpe]) => `
                <div class="card tpe-card-wizard">
                    <h6>${tpe.nom}</h6>
                    <div id="tpe-list-${tpeId}-${caisseId}">${createTpeReleveList(tpeState[caisseId]?.[tpeId], config, caisseId, tpeId)}</div>
                    <div class="form-group-inline"><input type="text" class="reconciliation-input" id="tpe-amount-${tpeId}-${caisseId}" placeholder="Montant"><button type="button" class="btn new-btn add-tpe-btn" data-caisse-id="${caisseId}" data-tpe-id="${tpeId}">+</button></div>
                </div>`).join('');
            return `<h5>Détail des Relevés TPE</h5><div class="grid-3">${tpeHtml}</div>`;

        case 'cheques':
             return `
                <h5>Détail des Chèques</h5>
                <div class="cheque-wizard-grid">
                    <div class="card cheque-card-wizard"><div id="cheque-list-${caisseId}">${createChequeList(chequesState[caisseId], config, caisseId)}</div></div>
                    <div class="card cheque-card-wizard">
                         <h6>Ajouter un chèque</h6>
                         <div class="form-group"><label>Montant</label><input type="text" class="reconciliation-input" id="cheque-amount-${caisseId}"></div>
                         <div class="form-group"><label>Commentaire</label><input type="text" class="reconciliation-input" id="cheque-comment-${caisseId}"></div>
                         <button type="button" class="btn new-btn add-cheque-btn" data-caisse-id="${caisseId}" style="width:100%">Ajouter Chèque</button>
                    </div>
                </div>`;
    }
    return '';
}

function renderStep3_Summary(container, state) {
    let summaryHtml = state.wizardState.selectedCaisses.map(id => {
        const suggestions = service.calculateWithdrawalSuggestion(state.calculatorData.caisse[id], state.config);
        state.wizardState.confirmedData[id] = { withdrawals: suggestions.suggestions, totalToWithdraw: suggestions.totalToWithdraw };
        
        const suggestionTableHtml = suggestions.suggestions.length === 0
            ? `<div class="withdrawal-summary-card"><div class="withdrawal-total-header status-ok"><div class="total-amount">${formatCurrency(0, state.config)}</div><div class="total-label">Aucun retrait nécessaire</div></div></div>`
            : `<div class="withdrawal-summary-card"><div class="withdrawal-total-header"><div class="total-amount">${formatCurrency(suggestions.totalToWithdraw, state.config)}</div><div class="total-label">Total à retirer</div></div><div class="withdrawal-details-list">${suggestions.suggestions.map(s => `<div class="detail-item"><span>Retirer ${s.qty} x ${s.value >= 1 ? `${s.value} ${state.config.currencySymbol}` : `${s.value * 100} cts`}</span><span>${formatCurrency(s.total, state.config)}</span></div>`).join('')}</div></div>`;

        return `<div class="card"><h4>Synthèse des retraits pour ${state.config.nomsCaisses[id]}</h4>${suggestionTableHtml}</div>`;
    }).join('');
    container.innerHTML = summaryHtml;
}

function renderStep4_Finalization(container, state) {
    container.innerHTML = `
        <h3><i class="fa-solid fa-flag-checkered"></i> Synthèse Finale</h3>
        <p class="subtitle" style="text-align:center;">Vérifiez les totaux avant de finaliser.</p>
        <div class="confirmation-box">
            <label><input type="checkbox" id="final-confirmation-checkbox"> Je confirme vouloir clôturer la journée.</label>
        </div>`;
}

function renderProcessModalLayout(modalElement) {
     modalElement.innerHTML = `
        <div class="modal-content wide">
            <div class="wizard-header">
                 <h2><i class="fa-solid fa-flag-checkered"></i> Assistant de Clôture</h2>
                 <div class="wizard-steps">
                     <div class="step-item" data-step="1"><span>1</span> Sélection</div>
                     <div class="step-item" data-step="2"><span>2</span> Comptage</div>
                     <div class="step-item" data-step="3"><span>3</span> Retraits</div>
                     <div class="step-item" data-step="4"><span>4</span> Finalisation</div>
                 </div>
            </div>
            <div class="wizard-content"></div>
            <div class="wizard-navigation"></div>
        </div>
    `;
}

// --- Fonctions Publiques Exportées ---

export function setNavigationLoading(isLoading) {
    const container = document.querySelector('.modal.visible');
    if (!container) return;
    const nextBtn = container.querySelector('#wizard-next-btn, #wizard-finish-btn');
    const prevBtn = container.querySelector('#wizard-prev-btn');

    if (nextBtn) {
        if (isLoading) {
            nextBtn.disabled = true;
            nextBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Traitement...';
        } else {
            nextBtn.disabled = false;
            const text = nextBtn.id === 'wizard-finish-btn' ? 'Terminer la Journée' : 'Suivant';
            const icon = nextBtn.id === 'wizard-finish-btn' ? 'fa-flag-checkered' : 'fa-arrow-right';
            nextBtn.innerHTML = `${text} <i class="fa-solid ${icon}"></i>`;
        }
    }
    if (prevBtn) {
        prevBtn.disabled = isLoading;
    }
}

export function renderStep(step, state, isLoading = false) {
    const selectionModal = document.getElementById('cloture-selection-modal');
    const processModal = document.getElementById('cloture-process-modal');
    
    closeAllModals();

    if (step === 1) {
        renderStep1_Selection(selectionModal, state);
        selectionModal.classList.add('visible');
    } else {
        processModal.classList.add('visible');
        if (isLoading) {
            renderStep_Loading(processModal);
        } else {
            if (!processModal.querySelector('.wizard-header')) {
                renderProcessModalLayout(processModal);
            }
            const contentContainer = processModal.querySelector('.wizard-content');
            
            switch(step) {
                case 2: renderStep2_Reconciliation(contentContainer, state); break;
                case 3: renderStep3_Summary(contentContainer, state); break;
                case 4: renderStep4_Finalization(contentContainer, state); break;
            }
        }
        updateWizardUI(state.wizardState, isReconciliationComplete(state));
    }
}

export function updateWizardUI(wizardState, isReconciliationComplete) {
    const container = document.querySelector('.modal.visible');
    if (!container) return;

    const wizardNav = container.querySelector('.wizard-navigation, .modal-footer');
    const stepItems = document.querySelectorAll('.wizard-steps .step-item');

    if (stepItems.length) {
        stepItems.forEach(stepEl => {
            stepEl.classList.remove('active');
            if (parseInt(stepEl.dataset.step) === wizardState.currentStep) {
                stepEl.classList.add('active');
            }
        });
    }

    if (wizardNav) {
        if (wizardState.currentStep === 1) {
            const nextBtn = wizardNav.querySelector('#wizard-next-btn');
            if(nextBtn) nextBtn.disabled = document.querySelectorAll('input[name="caisseSelection"]:checked').length === 0;
            return;
        }

        const prevBtnHtml = `<button id="wizard-prev-btn" class="btn"><i class="fa-solid fa-arrow-left"></i> Précédent</button>`;
        const nextBtnHtml = `<button id="wizard-next-btn" class="btn save-btn">Suivant <i class="fa-solid fa-arrow-right"></i></button>`;
        const finishBtnHtml = `<button id="wizard-finish-btn" class="btn save-btn" disabled>Terminer la Journée <i class="fa-solid fa-flag-checkered"></i></button>`;

        let navHtml = `<button id="wizard-cancel-btn" class="btn delete-btn">Annuler</button><div>`;
        if (wizardState.currentStep > 1) navHtml += prevBtnHtml;
        if (wizardState.currentStep < 4) navHtml += nextBtnHtml;
        else if (wizardState.currentStep === 4) navHtml += finishBtnHtml;
        navHtml += `</div>`;
        
        wizardNav.innerHTML = navHtml;

        const nextBtn = document.getElementById('wizard-next-btn');
        if (nextBtn) {
            if (wizardState.currentStep === 2) nextBtn.disabled = !isReconciliationComplete;
            if (wizardState.currentStep === 3) nextBtn.disabled = false;
        }
        
        const finishBtn = document.getElementById('wizard-finish-btn');
        if(finishBtn) {
            const checkbox = document.getElementById('final-confirmation-checkbox');
            if(checkbox) finishBtn.disabled = !checkbox.checked;
        }
    }
}

export function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('visible');
        modal.innerHTML = '';
    });
}

export function showFinalConfirmModal(onConfirmCallback) {
    const finalConfirmModal = document.getElementById('cloture-final-confirm-modal');
    finalConfirmModal.innerHTML = `
        <div class="modal-content">
             <div class="modal-header-danger">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <h3>Êtes-vous absolument sûr ?</h3>
            </div>
            <div class="modal-body">
                <p>Cette action va finaliser la journée. Elle est irréversible.</p>
                <div class="modal-actions">
                    <button class="btn delete-btn">Annuler</button>
                    <button class="btn save-btn">Oui, terminer</button>
                </div>
            </div>
        </div>`;
    finalConfirmModal.classList.add('visible');
    finalConfirmModal.querySelector('.save-btn').onclick = () => onConfirmCallback();
    finalConfirmModal.querySelector('.delete-btn').onclick = () => finalConfirmModal.classList.remove('visible');
}

function isReconciliationComplete(state) {
    const { wizardState } = state;
    if (!wizardState.selectedCaisses || wizardState.selectedCaisses.length === 0) return false;
    return wizardState.selectedCaisses.every(caisseId => {
        const status = wizardState.reconciliation.status[caisseId];
        return status && status.especes && status.cb && status.cheques;
    });
}
