// Fichier : public/assets/js/logic/calculator-ui.js (Complet et Corrigé)

import { formatCurrency, parseLocaleFloat } from '../utils/formatters.js';
import * as service from './calculator-service.js';
import { sendWsMessage } from './websocket-service.js';

/**
 * Met à jour l'état visuel de TOUTES les caisses en fonction des données de clôture.
 */
export function updateAllCaisseLocks(state) {
    Object.keys(state.config.nomsCaisses).forEach(caisseId => {
        const lockInfo = state.lockedCaisses.find(c => String(c.caisse_id) === String(caisseId));
        const isClosed = state.closedCaisses.includes(String(caisseId));
        
        let status = 'open';
        if (isClosed) status = 'closed';
        else if (lockInfo) status = String(lockInfo.locked_by) === String(state.wsResourceId) ? 'locked_by_me' : 'locked_by_other';
        
        updateCaisseLockState(caisseId, status, state);
    });

    const allCaisseIds = Object.keys(state.config.nomsCaisses || {});
    const allClosed = allCaisseIds.length > 0 && allCaisseIds.every(id => state.closedCaisses.includes(id));
    
    if (allClosed) {
        showFinalSummaryBanner(state);
    } else {
        const container = document.getElementById('cloture-final-summary-banner-container');
        if (container) container.innerHTML = '';
    }
}

/**
 * Met à jour l'état visuel et interactif d'une caisse (verrouillage, validation).
 */
export function updateCaisseLockState(caisseId, status, state) {
    const tabLink = document.querySelector(`.tab-link[data-caisse-id="${caisseId}"]`);
    const caisseContent = document.getElementById(`caisse${caisseId}`);
    const ecartDisplay = document.getElementById(`ecart-display-caisse${caisseId}`);
    const clotureDetailsContainer = document.getElementById('cloture-details-container');

    if (!tabLink || !caisseContent || !ecartDisplay || !clotureDetailsContainer) return;

    // 1. Réinitialisation
    const isActive = tabLink.classList.contains('active');
    tabLink.className = 'tab-link';
    if (isActive) tabLink.classList.add('active');
    
    ecartDisplay.classList.remove('cloture-mode', 'cloture-closed');
    
    if (isActive) {
        clotureDetailsContainer.innerHTML = '';
        clotureDetailsContainer.style.display = 'none';
        clotureDetailsContainer.dataset.caisseId = '';
    }
    
    caisseContent.querySelectorAll('input, textarea, button').forEach(el => el.disabled = false);

    // 2. Application du nouveau statut
    switch (status) {
        case 'locked_by_me':
            tabLink.classList.add('status-locked-by-me');
            if (isActive) {
                ecartDisplay.classList.add('cloture-mode');
                clotureDetailsContainer.innerHTML = renderClotureSectionForInitiator(caisseId, state);
                clotureDetailsContainer.style.display = 'block';
                clotureDetailsContainer.dataset.caisseId = caisseId;
            }
            break;

        case 'locked_by_other':
            tabLink.classList.add('status-locked-by-other');
            caisseContent.querySelectorAll('input, textarea, button').forEach(el => el.disabled = true);
            break;
            
        case 'closed':
            tabLink.classList.add('status-closed');
            if (isActive) {
                ecartDisplay.classList.add('cloture-closed');
                clotureDetailsContainer.innerHTML = renderClotureSectionForClosed(caisseId, state);
                clotureDetailsContainer.style.display = 'block';
                clotureDetailsContainer.dataset.caisseId = caisseId;
            }
            caisseContent.querySelectorAll('input, textarea, button:not(.payment-tab-link)').forEach(el => el.disabled = true);
            break;
    }
}

/**
 * Génère le HTML pour la section de retrait lorsque l'utilisateur a verrouillé la caisse.
 */
function renderClotureSectionForInitiator(caisseId, state) {
    const suggestions = service.calculateWithdrawalSuggestion(state.calculatorData.caisse[caisseId], state.config);
    const minToKeep = state.config.minToKeep || {};

    let rowsHtml = suggestions.suggestions.map(s => {
        const currentDenomQty = parseInt(state.calculatorData.caisse[caisseId]?.denominations?.[s.name] || 0);
        const minQtyToKeep = parseInt(minToKeep[s.name] || 0);
        const maxAllowedToWithdraw = Math.max(0, currentDenomQty - minQtyToKeep);

        return `
            <tr>
                <td>${s.value >= 1 ? `${s.value} ${state.config.currencySymbol}` : `${s.value * 100} cts`}</td>
                <td class="text-center">${currentDenomQty}</td>
                <td class="text-center">${minQtyToKeep}</td>
                <td>
                    <input type="number" class="retrait-input" data-caisse-id="${caisseId}" name="retraits[${caisseId}][${s.name}]" value="${s.qty}" min="0" max="${maxAllowedToWithdraw}">
                </td>
                <td class="text-right" id="total-retrait-${s.name}-${caisseId}">${formatCurrency(s.total, state.config)}</td>
            </tr>
        `;
    }).join('');

    return `
        <h4><i class="fa-solid fa-right-from-bracket"></i> Retraits et Finalisation</h4>
        <p>Ajustez les quantités à retirer pour préparer le fond de caisse de demain.</p>
        <div class="table-responsive">
            <table class="suggestion-table">
                <thead>
                    <tr>
                        <th>Dénomination</th>
                        <th class="text-center">Qté en caisse</th>
                        <th class="text-center">Qté min. à garder</th>
                        <th>Qté à retirer</th>
                        <th class="text-right">Total retiré</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="4"><strong>Total des retraits</strong></td>
                        <td class="text-right" id="total-global-retrait-${caisseId}"><strong>${formatCurrency(suggestions.totalToWithdraw, state.config)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        </div>
        <div class="cloture-actions">
            <button type="button" class="btn delete-btn cloture-cancel-btn" data-caisse-id="${caisseId}"><i class="fa-solid fa-unlock"></i> Annuler</button>
            <button type="button" class="btn save-btn cloture-validate-btn" data-caisse-id="${caisseId}"><i class="fa-solid fa-check"></i> Valider la clôture</button>
        </div>
    `;
}

/**
 * Génère le HTML pour la section d'une caisse déjà clôturée.
 */
function renderClotureSectionForClosed(caisseId, state) {
    const suggestions = service.calculateWithdrawalSuggestion(state.calculatorData.caisse[caisseId], state.config);
    
    const rowsHtml = suggestions.suggestions.map(s => `
        <tr>
            <td>${s.value >= 1 ? `${s.value} ${state.config.currencySymbol}` : `${s.value * 100} cts`}</td>
            <td class="text-center">${s.qty}</td>
            <td class="text-right">${formatCurrency(s.total, state.config)}</td>
        </tr>
    `).join('');

    return `
        <h4><i class="fa-solid fa-check-circle"></i> Caisse Clôturée - Récapitulatif des retraits</h4>
        <p>Cette caisse a été validée. Voici le résumé des retraits enregistrés.</p>
        <div class="table-responsive">
            <table class="suggestion-table">
                <thead>
                    <tr>
                        <th>Dénomination</th>
                        <th class="text-center">Qté à retirer</th>
                        <th class="text-right">Valeur</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml.length > 0 ? rowsHtml : `<tr><td colspan="3" class="text-center">Aucun retrait enregistré pour cette clôture.</td></tr>`}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="2"><strong>Total des retraits</strong></td>
                        <td class="text-right"><strong>${formatCurrency(suggestions.totalToWithdraw, state.config)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        </div>
        <div class="cloture-actions">
            <button type="button" class="btn action-btn cloture-reopen-btn" data-caisse-id="${caisseId}"><i class="fa-solid fa-rotate-left"></i> Réouvrir la caisse</button>
        </div>
    `;
}


/**
 * Affiche la nouvelle bannière de finalisation avec le bouton "Voir les suggestions".
 */
export function showFinalSummaryBanner(state) {
    const container = document.getElementById('cloture-final-summary-banner-container');
    if (!container) return;

    let totalRetraits = 0;
    Object.keys(state.config.nomsCaisses).forEach(caisseId => {
        const caisseData = state.calculatorData.caisse[caisseId];
        if(caisseData) {
            const suggestions = service.calculateWithdrawalSuggestion(caisseData, state.config);
            totalRetraits += suggestions.totalToWithdraw;
        }
    });

    container.innerHTML = `
        <div class="cloture-final-summary-banner">
            <div class="banner-header">
                <h4><i class="fa-solid fa-flag-checkered"></i> Journée Prête pour Finalisation</h4>
                <p>Toutes les caisses ont été clôturées. Le retrait total à effectuer est de <strong>${formatCurrency(totalRetraits, state.config)}</strong>.</p>
            </div>
            <div class="banner-actions">
                <button id="show-suggestions-btn" class="btn action-btn"><i class="fa-solid fa-eye"></i> Voir les suggestions de retrait</button>
                <button id="finalize-day-btn" class="btn save-btn">Finaliser et Archiver la Journée</button>
            </div>
        </div>
        
        <div id="suggestions-modal" class="modal">
            <div class="modal-content wide">
                <div class="modal-header">
                    <h3>Détail des retraits suggérés</h3>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body" id="suggestions-modal-body"></div>
            </div>
        </div>
    `;
}

/**
 * Remplit et affiche la modale des suggestions de retrait.
 */
export function renderWithdrawalSummaryModal(state) {
    const modalBody = document.getElementById('suggestions-modal-body');
    const modal = document.getElementById('suggestions-modal');
    if (!modalBody || !modal) return;

    let contentHtml = '';
    Object.keys(state.config.nomsCaisses).forEach(caisseId => {
        const caisseData = state.calculatorData.caisse[caisseId];
        if(!caisseData) return;

        const suggestions = service.calculateWithdrawalSuggestion(caisseData, state.config);
        const caisseNom = state.config.nomsCaisses[caisseId];

        const rowsHtml = suggestions.suggestions.map(s => `
            <tr>
                <td>${s.value >= 1 ? `${s.value} ${state.config.currencySymbol}` : `${s.value * 100} cts`}</td>
                <td class="text-center">${s.qty}</td>
                <td class="text-right">${formatCurrency(s.total, state.config)}</td>
            </tr>
        `).join('');

        contentHtml += `
            <div class="card">
                <h4>${caisseNom} - Total à retirer : ${formatCurrency(suggestions.totalToWithdraw, state.config)}</h4>
                <div class="table-responsive">
                    <table class="suggestion-table">
                        <thead>
                            <tr><th>Dénomination</th><th class="text-center">Quantité</th><th class="text-right">Valeur</th></tr>
                        </thead>
                        <tbody>${rowsHtml.length > 0 ? rowsHtml : `<tr><td colspan="3" class="text-center">Aucun retrait suggéré pour cette caisse.</td></tr>`}</tbody>
                    </table>
                </div>
            </div>
        `;
    });

    modalBody.innerHTML = contentHtml;
    modal.classList.add('visible');
}

/**
 * Crée le HTML pour une carte de dénomination (billet ou pièce).
 */
function createDenominationCard(caisseId, name, value, type, config) {
    const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
    const inputId = `${name}_${caisseId}`;
    const totalId = `total_${inputId}`;
    const nameAttr = `caisse[${caisseId}][denominations][${name}]`;
    const cardClass = type === 'piece' ? 'is-piece' : '';

    return `
        <div class="denom-card ${cardClass}">
            <div class="denom-card-header">${label}</div>
            <div class="denom-card-body">
                <input type="number" class="quantity-input" data-caisse-id="${caisseId}" id="${inputId}" name="${nameAttr}" min="0" placeholder="0">
            </div>
            <div class="denom-card-footer" id="${totalId}">0,00 €</div>
        </div>`;
}

/**
 * Génère l'interface principale du calculateur.
 */
export function renderCalculatorUI(pageElement, config, calculatorData) {
    if (!pageElement) return;
    const tabSelector = pageElement.querySelector('.tab-selector');
    const ecartContainer = pageElement.querySelector('.ecart-display-container');
    const caissesContainer = pageElement.querySelector('#caisses-content-container');
    let tabsHtml = '', contentHtml = '', ecartsHtml = '';

    Object.entries(config.nomsCaisses).forEach(([id, nom], index) => {
        const isActive = index === 0 ? 'active' : '';
        tabsHtml += `<button type="button" class="tab-link ${isActive}" data-tab="caisse${id}" data-caisse-id="${id}">${nom}</button>`;
        
        ecartsHtml += `<div id="ecart-display-caisse${id}" class="ecart-display ${isActive}"><div id="main-ecart-caisse${id}" class="main-ecart-display"><span class="ecart-label">Écart Espèces</span><span class="ecart-value">0,00 €</span></div><div id="secondary-ecarts-caisse${id}" class="secondary-ecarts"></div></div>`;

        const billetsHtml = Object.entries(config.denominations.billets).map(([name, v]) => createDenominationCard(id, name, v, 'bill', config)).join('');
        const piecesHtml = Object.entries(config.denominations.pieces).map(([name, v]) => createDenominationCard(id, name, v, 'piece', config)).join('');

        const especesTabContent = `<div class="theoretical-inputs-panel"><div class="compact-input-group"><label>Encaissement Espèces Théorique</label><input type="text" data-caisse-id="${id}" id="ventes_especes_${id}" name="caisse[${id}][ventes_especes]"></div><div class="compact-input-group"><label>Rétrocessions en Espèces</label><input type="text" data-caisse-id="${id}" id="retrocession_${id}" name="caisse[${id}][retrocession]"></div></div><div class="cash-drawer-section"><h4><i class="fa-solid fa-money-bill-wave"></i> Billets <span class="section-total" id="total-billets-${id}">0,00 €</span></h4><div class="denominations-container">${billetsHtml}</div></div><div class="cash-drawer-section"><h4><i class="fa-solid fa-coins"></i> Pièces <span class="section-total" id="total-pieces-${id}">0,00 €</span></h4><div class="denominations-container">${piecesHtml}</div></div><div class="cash-drawer-section totals-summary"><div class="summary-line grand-total"><span>Total Espèces Compté</span><span id="total-especes-${id}">0,00 €</span></div></div>`;

        const tpePourCaisse = config.tpeParCaisse ? Object.entries(config.tpeParCaisse).filter(([,tpe]) => tpe.caisse_id.toString() === id) : [];
        const tpeHtml = tpePourCaisse.map(([tpeId, tpe]) => `<div class="tpe-card"><h4>${tpe.nom}</h4><div class="tpe-releves-list" id="tpe-releves-list-${tpeId}-${id}"></div><div class="tpe-releve-form"><input type="text" id="tpe-releve-montant-${tpeId}-${id}" placeholder="Montant du relevé"><button type="button" class="btn new-btn add-tpe-releve-btn" data-caisse-id="${id}" data-terminal-id="${tpeId}"><i class="fa-solid fa-plus"></i> Ajouter</button></div><div id="tpe-hidden-inputs-${tpeId}-${id}"></div></div>`).join('');
        const tpeSectionHtml = tpePourCaisse.length > 0 ? `<div class="tpe-grid">${tpeHtml}</div>` : '<p>Aucun TPE configuré pour cette caisse.</p>';
        const cbTabContent = `<div class="theoretical-inputs-panel"><div class="compact-input-group"><label>Encaissement CB Théorique</label><input type="text" data-caisse-id="${id}" id="ventes_cb_${id}" name="caisse[${id}][ventes_cb]"></div><div class="compact-input-group"><label>Rétrocessions en CB</label><input type="text" data-caisse-id="${id}" id="retrocession_cb_${id}" name="caisse[${id}][retrocession_cb]"></div></div>${tpeSectionHtml}`;
        const chequesTabContent = `<div class="theoretical-inputs-panel"><div class="compact-input-group"><label>Encaissement Chèques Théorique</label><input type="text" data-caisse-id="${id}" id="ventes_cheques_${id}" name="caisse[${id}][ventes_cheques]"></div><div class="compact-input-group"><label>Rétrocessions en Chèques</label><input type="text" data-caisse-id="${id}" id="retrocession_cheques_${id}" name="caisse[${id}][retrocession_cheques]"></div></div><div class="cheque-section" id="cheque-section-${id}"></div>`;

        contentHtml += `<div id="caisse${id}" class="caisse-tab-content ${isActive}"><div class="form-group compact-input-group" style="max-width:300px;margin-bottom:25px;"><label>Fond de Caisse</label><input type="text" data-caisse-id="${id}" id="fond_de_caisse_${id}" name="caisse[${id}][fond_de_caisse]"></div><div class="payment-method-tabs"><div class="payment-method-selector"><button type="button" class="payment-tab-link active" data-payment-tab="especes_${id}" data-method-key="especes"><i class="fa-solid fa-money-bill-wave"></i> Espèces</button><button type="button" class="payment-tab-link" data-payment-tab="cb_${id}" data-method-key="cb"><i class="fa-solid fa-credit-card"></i> CB</button><button type="button" class="payment-tab-link" data-payment-tab="cheques_${id}" data-method-key="cheques"><i class="fa-solid fa-money-check-dollar"></i> Chèques</button></div><div id="especes_${id}" class="payment-tab-content active">${especesTabContent}</div><div id="cb_${id}" class="payment-tab-content">${cbTabContent}</div><div id="cheques_${id}" class="payment-tab-content">${chequesTabContent}</div></div></div>`;
    });
    tabSelector.innerHTML = tabsHtml; 
    ecartContainer.innerHTML = ecartsHtml + `<div id="cloture-details-container" style="display:none;"></div>`;
    caissesContainer.innerHTML = contentHtml;

    Object.keys(config.nomsCaisses).forEach(id => {
        const caisseData = calculatorData.caisse[id] || {};
        renderChequeList(id, caisseData.cheques || [], config);
        const tpeData = caisseData.tpe || {};
        Object.keys(tpeData).forEach(tpeId => renderTpeList(id, tpeId, tpeData[tpeId], config));
    });
}

/**
 * Remplit les champs du formulaire avec les données initiales chargées.
 */
export function populateInitialData(calculatorData) {
    if (!calculatorData) return;
    const form = document.getElementById('caisse-form');
    form.elements.nom_comptage.value = calculatorData.nom_comptage || '';
    form.elements.explication.value = calculatorData.explication || '';

    for (const caisseId in calculatorData.caisse) {
        const caisseData = calculatorData.caisse[caisseId];
        if (caisseData) {
            form.elements[`caisse[${caisseId}][fond_de_caisse]`].value = caisseData.fond_de_caisse || '';
            form.elements[`caisse[${caisseId}][ventes_especes]`].value = caisseData.ventes_especes || '';
            form.elements[`caisse[${caisseId}][retrocession]`].value = caisseData.retrocession || '';
            form.elements[`caisse[${caisseId}][ventes_cb]`].value = caisseData.ventes_cb || '';
            form.elements[`caisse[${caisseId}][retrocession_cb]`].value = caisseData.retrocession_cb || '';
            form.elements[`caisse[${caisseId}][ventes_cheques]`].value = caisseData.ventes_cheques || '';
            form.elements[`caisse[${caisseId}][retrocession_cheques]`].value = caisseData.retrocession_cheques || '';

            if (caisseData.denominations) {
                Object.entries(caisseData.denominations).forEach(([denom, qty]) => {
                    const field = form.elements[`caisse[${caisseId}][denominations][${denom}]`];
                    if (field) field.value = qty;
                });
            }
        }
    }
}

function renderChequeList(caisseId, cheques = [], config) {
    const container = document.getElementById(`cheque-section-${caisseId}`);
    if(!container) return;
    container.innerHTML = `<div class="cheque-grid"><div class="cheque-form-container"><h4><i class="fa-solid fa-plus-circle"></i> Ajouter un chèque</h4><div class="form-group"><label for="cheque-amount-${caisseId}">Montant</label><input type="text" id="cheque-amount-${caisseId}" placeholder="0,00 ${config.currencySymbol}"></div><div class="form-group"><label for="cheque-comment-${caisseId}">Commentaire</label><input type="text" id="cheque-comment-${caisseId}" placeholder="Chèque n°12345"></div><button type="button" class="btn new-btn add-cheque-btn" data-caisse-id="${caisseId}" style="width: 100%;"><i class="fa-solid fa-plus"></i> Ajouter</button></div><div class="cheque-list-container"><div class="cheque-list-header"><h4><i class="fa-solid fa-list-ol"></i> Chèques Encaissés</h4><div class="cheque-total" id="cheque-total-container-${caisseId}"></div></div><div id="cheque-list-${caisseId}" class="cheque-list"></div><div id="cheque-hidden-inputs-${caisseId}"></div></div></div>`;
    const listContainer = document.getElementById(`cheque-list-${caisseId}`);
    const totalContainerParent = document.getElementById(`cheque-total-container-${caisseId}`);
    const hiddenInputsContainer = document.getElementById(`cheque-hidden-inputs-${caisseId}`);
    let totalCheques = 0;
    if (cheques.length === 0) {
        listContainer.innerHTML = '<p class="empty-list">Aucun chèque ajouté.</p>';
    } else {
        listContainer.innerHTML = `<table class="cheque-table"><thead><tr><th>Montant</th><th>Commentaire</th><th>Actions</th></tr></thead><tbody>${cheques.map((cheque, index) => { totalCheques += parseLocaleFloat(cheque.montant); return `<tr><td>${formatCurrency(parseLocaleFloat(cheque.montant), config)}</td><td>${cheque.commentaire || ''}</td><td class="cheque-actions"><button type="button" class="btn-icon delete-btn delete-cheque-btn" data-caisse-id="${caisseId}" data-index="${index}" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button></td></tr>`;}).join('')}</tbody></table>`;
    }
    totalContainerParent.innerHTML = `Total (${cheques.length} chèque${cheques.length > 1 ? 's' : ''}): <span id="cheque-total-${caisseId}">${formatCurrency(totalCheques, config)}</span>`;
    hiddenInputsContainer.innerHTML = cheques.map((cheque, index) => `<input type="hidden" name="caisse[${caisseId}][cheques][${index}][montant]" value="${cheque.montant}"><input type="hidden" name="caisse[${caisseId}][cheques][${index}][commentaire]" value="${cheque.commentaire}">`).join('');
}

function renderTpeList(caisseId, terminalId, releves = [], config) {
    const listContainer = document.getElementById(`tpe-releves-list-${terminalId}-${caisseId}`);
    const hiddenContainer = document.getElementById(`tpe-hidden-inputs-${terminalId}-${caisseId}`);
    if (!listContainer || !hiddenContainer) return;
    const sortedReleves = [...releves].sort((a, b) => (b.heure || '').localeCompare(a.heure || ''));
    if (sortedReleves.length === 0) {
        listContainer.innerHTML = '<p class="empty-list">Aucun relevé pour ce TPE.</p>';
    } else {
        listContainer.innerHTML = `<table class="tpe-table"><thead><tr><th>Heure</th><th>Montant</th><th>Action</th></tr></thead><tbody>${sortedReleves.map((releve, index) => { const isLast = index === 0; const rowClass = isLast ? 'releve-actif' : ''; return `<tr class="${rowClass}"><td>${releve.heure || 'N/A'}</td><td>${formatCurrency(parseLocaleFloat(releve.montant), config)}</td><td><button type="button" class="btn-icon delete-btn delete-tpe-releve-btn" data-caisse-id="${caisseId}" data-terminal-id="${terminalId}" data-index="${index}"><i class="fa-solid fa-trash-can"></i></button></td></tr>`;}).join('')}</tbody></table>`;
    }
    hiddenContainer.innerHTML = sortedReleves.map((r, i) => `<input type="hidden" name="caisse[${caisseId}][tpe][${terminalId}][${i}][montant]" value="${r.montant}"><input type="hidden" name="caisse[${caisseId}][tpe][${terminalId}][${i}][heure]" value="${r.heure}">`).join('');
}

export function applyFullFormState(data, state) {
    if (data.state) {
        for (const id in data.state) {
            const field = document.getElementById(id);
            if (field) field.value = data.state[id];
        }
    }
    // Après avoir mis à jour les champs, on met à jour l'état interne
    if (data.cheques) {
        Object.keys(data.cheques).forEach(caisseId => {
            state.calculatorData.caisse[caisseId].cheques = data.cheques[caisseId];
            renderChequeList(caisseId, data.cheques[caisseId], state.config);
        });
    }
    if (data.tpe) {
        Object.keys(data.tpe).forEach(caisseId => {
            state.calculatorData.caisse[caisseId].tpe = data.tpe[caisseId];
            Object.keys(data.tpe[caisseId]).forEach(tpeId => {
                renderTpeList(caisseId, tpeId, data.tpe[caisseId][tpeId], state.config);
            });
        });
    }
}

export function applyLiveUpdate(data) {
    const activeElement = document.activeElement;
    if (data.id && activeElement && activeElement.id !== data.id) {
        const input = document.getElementById(data.id);
        if (input) {
            input.value = data.value;
        }
    }
}

export function applyListUpdate(data, state) {
    if (data.type === 'cheque_update' && data.caisseId && data.cheques) {
        state.calculatorData.caisse[data.caisseId].cheques = data.cheques;
        renderChequeList(data.caisseId, data.cheques, state.config);
    }
    if (data.type === 'tpe_update' && data.caisseId && data.terminalId && data.releves) {
        if (!state.calculatorData.caisse[data.caisseId].tpe) {
            state.calculatorData.caisse[data.caisseId].tpe = {};
        }
        state.calculatorData.caisse[data.caisseId].tpe[data.terminalId] = data.releves;
        renderTpeList(data.caisseId, data.terminalId, data.releves, state.config);
    }
}

export function handleCalculatorClickEvents(e, state) {
    const target = e.target;
    
    const tabLink = target.closest('.tab-link');
    if (tabLink) {
        document.querySelectorAll('.tab-link, .caisse-tab-content, .ecart-display').forEach(el => el.classList.remove('active'));
        tabLink.classList.add('active');
        document.getElementById(tabLink.dataset.tab)?.classList.add('active');
        document.getElementById(`ecart-display-caisse${tabLink.dataset.caisseId}`)?.classList.add('active');
        updateAllCaisseLocks(state);
        service.calculateAll(state.config, state);
        return false;
    }
    const paymentTab = target.closest('.payment-tab-link');
    if(paymentTab) {
        const container = paymentTab.closest('.payment-method-tabs');
        container.querySelectorAll('.payment-tab-link, .payment-tab-content').forEach(el => el.classList.remove('active'));
        paymentTab.classList.add('active');
        container.querySelector(`#${paymentTab.dataset.paymentTab}`)?.classList.add('active');
        service.calculateAll(state.config, state);
        return false;
    }
    const addChequeBtn = target.closest('.add-cheque-btn');
    if (addChequeBtn) {
        const caisseId = addChequeBtn.dataset.caisseId;
        const amountInput = document.getElementById(`cheque-amount-${caisseId}`);
        const commentInput = document.getElementById(`cheque-comment-${caisseId}`);
        const amount = parseLocaleFloat(amountInput.value);
        if (amount > 0) {
            state.calculatorData.caisse[caisseId].cheques.push({ montant: amount, commentaire: commentInput.value });
            renderChequeList(caisseId, state.calculatorData.caisse[caisseId].cheques, state.config);
            sendWsMessage({ type: 'cheque_update', caisseId: caisseId, cheques: state.calculatorData.caisse[caisseId].cheques });
            amountInput.value = ''; commentInput.value = ''; amountInput.focus();
            return true;
        }
    }
    const deleteChequeBtn = target.closest('.delete-cheque-btn');
    if (deleteChequeBtn) {
        const { caisseId, index } = deleteChequeBtn.dataset;
        if (confirm('Voulez-vous vraiment supprimer ce chèque ?')) {
            state.calculatorData.caisse[caisseId].cheques.splice(index, 1);
            renderChequeList(caisseId, state.calculatorData.caisse[caisseId].cheques, state.config);
            sendWsMessage({ type: 'cheque_update', caisseId: caisseId, cheques: state.calculatorData.caisse[caisseId].cheques });
            return true;
        }
    }
    const addTpeBtn = target.closest('.add-tpe-releve-btn');
    if (addTpeBtn) {
        const { caisseId, terminalId } = addTpeBtn.dataset;
        const amountInput = document.getElementById(`tpe-releve-montant-${terminalId}-${caisseId}`);
        const amount = parseLocaleFloat(amountInput.value);
        if (amount > 0) {
            if (!state.calculatorData.caisse[caisseId].tpe[terminalId]) {
                state.calculatorData.caisse[caisseId].tpe[terminalId] = [];
            }
            state.calculatorData.caisse[caisseId].tpe[terminalId].push({ montant: amount, heure: new Date().toTimeString().slice(0, 8) });
            renderTpeList(caisseId, terminalId, state.calculatorData.caisse[caisseId].tpe[terminalId], state.config);
            sendWsMessage({ type: 'tpe_update', caisseId, terminalId, releves: state.calculatorData.caisse[caisseId].tpe[terminalId] });
            amountInput.value = ''; amountInput.focus();
            return true;
        }
    }
    const deleteTpeBtn = target.closest('.delete-tpe-releve-btn');
    if (deleteTpeBtn) {
        const { caisseId, terminalId, index } = deleteTpeBtn.dataset;
        if (state.calculatorData.caisse[caisseId]?.tpe?.[terminalId]) {
            state.calculatorData.caisse[caisseId].tpe[terminalId].splice(index, 1);
            renderTpeList(caisseId, terminalId, state.calculatorData.caisse[caisseId].tpe[terminalId], state.config);
            sendWsMessage({ type: 'tpe_update', caisseId, terminalId, releves: state.calculatorData.caisse[caisseId].tpe[terminalId] });
            return true;
        }
        return false;
    }
    return false;
}
