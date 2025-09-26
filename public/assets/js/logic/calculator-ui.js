// Fichier : public/assets/js/logic/calculator-ui.js (Complet et Final)

import { formatCurrency, parseLocaleFloat } from '../utils/formatters.js';
import * as service from './calculator-service.js';
import { sendWsMessage } from './websocket-service.js';

/**
 * Met à jour l'état visuel et interactif d'une caisse (verrouillage, validation).
 * @param {string} caisseId - L'ID de la caisse à mettre à jour.
 * @param {string} status - 'open', 'locked_by_me', 'locked_by_other', 'closed'.
 * @param {object} state - L'état global de l'application.
 */
export function updateCaisseLockState(caisseId, status, state) {
    const tabLink = document.querySelector(`.tab-link[data-caisse-id="${caisseId}"]`);
    const caisseContent = document.getElementById(`caisse${caisseId}`);
    const clotureSection = document.getElementById(`cloture-section-${caisseId}`);

    if (!tabLink || !caisseContent || !clotureSection) return;

    // 1. Réinitialisation des états visuels
    const isActive = tabLink.classList.contains('active');
    tabLink.className = 'tab-link'; // Enlève toutes les classes de statut
    if (isActive) tabLink.classList.add('active');
    
    caisseContent.querySelectorAll('input, textarea, .add-cheque-btn, .add-tpe-releve-btn, .delete-cheque-btn, .delete-tpe-releve-btn').forEach(el => el.disabled = false);
    clotureSection.innerHTML = `<button type="button" class="btn new-btn cloture-start-btn" data-caisse-id="${caisseId}"><i class="fa-solid fa-lock-open"></i> Démarrer la clôture de cette caisse</button>`;
    
    // 2. Application du nouveau statut
    switch (status) {
        case 'locked_by_me':
            tabLink.classList.add('status-locked-by-me');
            caisseContent.querySelectorAll('input, textarea, .add-cheque-btn, .add-tpe-releve-btn, .delete-cheque-btn, .delete-tpe-releve-btn').forEach(el => el.disabled = true);
            clotureSection.innerHTML = renderClotureSectionForInitiator(caisseId, state);
            clotureSection.querySelectorAll('.retrait-input').forEach(el => el.disabled = false); // Réactive seulement les inputs de retrait
            break;

        case 'locked_by_other':
            tabLink.classList.add('status-locked-by-other');
            caisseContent.querySelectorAll('input, textarea, button').forEach(el => el.disabled = true);
            const lockInfo = state.lockedCaisses.find(c => String(c.caisse_id) === String(caisseId));
            const locker = lockInfo ? `par l'utilisateur #${lockInfo.locked_by}` : '';
            clotureSection.innerHTML = `<div class="cloture-locked-info"><i class="fa-solid fa-lock"></i> Caisse verrouillée ${locker}.</div>`;
            break;

        case 'closed':
            tabLink.classList.add('status-closed');
            caisseContent.querySelectorAll('input, textarea, button').forEach(el => el.disabled = true);
            clotureSection.innerHTML = `<div class="cloture-validated-info"><i class="fa-solid fa-check-circle"></i> Caisse clôturée.</div>`;
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
 * Affiche la bannière de résumé final lorsque toutes les caisses sont fermées.
 */
export function showFinalSummaryBanner() {
    const container = document.getElementById('cloture-final-summary-banner-container');
    if (!container) return;
    container.innerHTML = `
        <div class="cloture-final-summary-banner">
            <div class="banner-header">
                <h4><i class="fa-solid fa-flag-checkered"></i> Journée Prête pour Finalisation</h4>
                <p>Toutes les caisses ont été clôturées. Vous pouvez maintenant archiver la journée.</p>
            </div>
            <div class="banner-actions">
                <button id="finalize-day-btn" class="btn save-btn">Finaliser et Archiver la Journée</button>
            </div>
        </div>`;
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
 * Génère l'interface principale du calculateur (onglets, conteneurs, etc.).
 */
export function renderCalculatorUI(pageElement, config, chequesState, tpeState) {
    if (!pageElement) return;
    const tabSelector = pageElement.querySelector('.tab-selector');
    const ecartContainer = pageElement.querySelector('.ecart-display-container');
    const caissesContainer = pageElement.querySelector('#caisses-content-container');
    let tabsHtml = '', contentHtml = '', ecartsHtml = '';

    Object.entries(config.nomsCaisses).forEach(([id, nom], index) => {
        const isActive = index === 0 ? 'active' : '';
        tabsHtml += `<button type="button" class="tab-link ${isActive}" data-tab="caisse${id}" data-caisse-id="${id}">${nom}</button>`;
        
        ecartsHtml += `
            <div id="ecart-display-caisse${id}" class="ecart-display ${isActive}">
                <div id="main-ecart-caisse${id}" class="main-ecart-display">
                    <span class="ecart-label">Écart Espèces</span>
                    <span class="ecart-value">0,00 €</span>
                </div>
                <div id="secondary-ecarts-caisse${id}" class="secondary-ecarts"></div>
            </div>`;

        const billetsHtml = Object.entries(config.denominations.billets).map(([name, v]) => createDenominationCard(id, name, v, 'bill', config)).join('');
        const piecesLooseHtml = Object.entries(config.denominations.pieces).map(([name, v]) => createDenominationCard(id, name, v, 'piece', config)).join('');

        const especesTabContent = `
            <div class="theoretical-inputs-panel">
                <div class="compact-input-group"><label>Encaissement Espèces Théorique</label><input type="text" data-caisse-id="${id}" id="ventes_especes_${id}" name="caisse[${id}][ventes_especes]"></div>
                <div class="compact-input-group"><label>Rétrocessions en Espèces</label><input type="text" data-caisse-id="${id}" id="retrocession_${id}" name="caisse[${id}][retrocession]"></div>
            </div>
            <div class="cash-drawer-section">
                <h4><i class="fa-solid fa-money-bill-wave"></i> Billets <span class="section-total" id="total-billets-${id}">0,00 €</span></h4>
                <div class="denominations-container">${billetsHtml}</div>
            </div>
             <div class="cash-drawer-section">
                <h4><i class="fa-solid fa-coins"></i> Pièces <span class="section-total" id="total-pieces-${id}">0,00 €</span></h4>
                <div class="denominations-container">${piecesLooseHtml}</div>
            </div>
            <div class="cash-drawer-section totals-summary">
                 <div class="summary-line grand-total"><span>Total Espèces Compté</span><span id="total-especes-${id}">0,00 €</span></div>
            </div>`;

        const tpePourCaisse = config.tpeParCaisse ? Object.entries(config.tpeParCaisse).filter(([,tpe]) => tpe.caisse_id.toString() === id) : [];
        const tpeHtml = tpePourCaisse.map(([tpeId, tpe]) => {
            return `<div class="tpe-card"><h4>${tpe.nom}</h4><div class="tpe-releves-list" id="tpe-releves-list-${tpeId}-${id}"></div><div class="tpe-releve-form"><input type="text" id="tpe-releve-montant-${tpeId}-${id}" placeholder="Montant du relevé"><button type="button" class="btn new-btn add-tpe-releve-btn" data-caisse-id="${id}" data-terminal-id="${tpeId}"><i class="fa-solid fa-plus"></i> Ajouter</button></div><div id="tpe-hidden-inputs-${tpeId}-${id}"></div></div>`;
        }).join('');
        const tpeSectionHtml = tpePourCaisse.length > 0 ? `<div class="tpe-grid">${tpeHtml}</div>` : '<p>Aucun TPE configuré pour cette caisse.</p>';

        contentHtml += `
            <div id="caisse${id}" class="caisse-tab-content ${isActive}">
                <div class="form-group compact-input-group" style="max-width:300px;margin-bottom:25px;"><label>Fond de Caisse</label><input type="text" data-caisse-id="${id}" id="fond_de_caisse_${id}" name="caisse[${id}][fond_de_caisse]"></div>
                <div class="payment-method-tabs">
                    <div class="payment-method-selector">
                        <button type="button" class="payment-tab-link active" data-payment-tab="especes_${id}" data-method-key="especes"><i class="fa-solid fa-money-bill-wave"></i> Espèces</button>
                        <button type="button" class="payment-tab-link" data-payment-tab="cb_${id}" data-method-key="cb"><i class="fa-solid fa-credit-card"></i> CB</button>
                        <button type="button" class="payment-tab-link" data-payment-tab="cheques_${id}" data-method-key="cheques"><i class="fa-solid fa-money-check-dollar"></i> Chèques</button>
                    </div>
                    <div id="especes_${id}" class="payment-tab-content active">${especesTabContent}</div>
                    <div id="cb_${id}" class="payment-tab-content"><div class="theoretical-inputs-panel"><div class="compact-input-group"><label>Encaissement CB Théorique</label><input type="text" data-caisse-id="${id}" id="ventes_cb_${id}" name="caisse[${id}][ventes_cb]"></div></div>${tpeSectionHtml}</div>
                    <div id="cheques_${id}" class="payment-tab-content"></div>
                </div>
                <div class="cloture-section-container" id="cloture-section-${id}">
                    </div>
            </div>`;
    });
    tabSelector.innerHTML = tabsHtml; 
    ecartContainer.innerHTML = ecartsHtml; 
    caissesContainer.innerHTML = contentHtml;

    Object.keys(config.nomsCaisses).forEach(id => {
        renderChequeList(id, chequesState, config);
        if (tpeState[id]) {
            Object.keys(tpeState[id]).forEach(tpeId => renderTpeList(id, tpeId, tpeState, config));
        }
    });
}

/**
 * Remplit les champs du formulaire avec les données initiales chargées.
 */
export function populateInitialData(calculatorData) {
    if (!calculatorData) return;

    document.getElementById('nom_comptage').value = calculatorData.nom_comptage || '';
    document.getElementById('explication').value = calculatorData.explication || '';

    for (const caisseId in calculatorData.caisse) {
        const caisseData = calculatorData.caisse[caisseId];
        if (caisseData) {
            ['fond_de_caisse', 'ventes_especes', 'retrocession', 'ventes_cb', 'ventes_cheques'].forEach(key => {
                const field = document.getElementById(`${key}_${caisseId}`);
                if (field && caisseData[key] !== undefined) {
                    field.value = caisseData[key];
                }
            });

            if (caisseData.denominations) {
                Object.entries(caisseData.denominations).forEach(([denom, qty]) => {
                    const denomField = document.getElementById(`${denom}_${caisseId}`);
                    if (denomField) denomField.value = qty;
                });
            }
        }
    }
}

function renderChequeList(caisseId, chequesState, config) {
    const container = document.getElementById(`cheques_${caisseId}`);
    if(!container) return;
    container.innerHTML = `
        <div class="theoretical-inputs-panel"><div class="compact-input-group"><label>Encaissement Chèques Théorique</label><input type="text" data-caisse-id="${caisseId}" id="ventes_cheques_${caisseId}" name="caisse[${caisseId}][ventes_cheques]"></div></div>
        <div class="cheque-section"><div class="cheque-grid"><div class="cheque-form-container"><h4><i class="fa-solid fa-plus-circle"></i> Ajouter un chèque</h4><div class="form-group"><label for="cheque-amount-${caisseId}">Montant</label><input type="text" id="cheque-amount-${caisseId}" placeholder="0,00 ${config.currencySymbol}"></div><div class="form-group"><label for="cheque-comment-${caisseId}">Commentaire</label><input type="text" id="cheque-comment-${caisseId}" placeholder="Chèque n°12345"></div><button type="button" class="btn new-btn add-cheque-btn" data-caisse-id="${caisseId}" style="width: 100%;"><i class="fa-solid fa-plus"></i> Ajouter</button></div><div class="cheque-list-container"><div class="cheque-list-header"><h4><i class="fa-solid fa-list-ol"></i> Chèques Encaissés</h4><div class="cheque-total" id="cheque-total-container-${caisseId}"></div></div><div id="cheque-list-${caisseId}" class="cheque-list"></div><div id="cheque-hidden-inputs-${caisseId}"></div></div></div></div>
    `;

    const listContainer = document.getElementById(`cheque-list-${caisseId}`);
    const totalContainerParent = document.getElementById(`cheque-total-container-${caisseId}`);
    const hiddenInputsContainer = document.getElementById(`cheque-hidden-inputs-${caisseId}`);
    const cheques = chequesState[caisseId] || [];
    let totalCheques = 0;

    if (cheques.length === 0) {
        listContainer.innerHTML = '<p class="empty-list">Aucun chèque ajouté.</p>';
    } else {
        listContainer.innerHTML = `<table class="cheque-table"><thead><tr><th>Montant</th><th>Commentaire</th><th>Actions</th></tr></thead><tbody>${cheques.map((cheque, index) => { totalCheques += parseLocaleFloat(cheque.montant); return `<tr><td>${formatCurrency(parseLocaleFloat(cheque.montant), config)}</td><td>${cheque.commentaire || ''}</td><td class="cheque-actions"><button type="button" class="btn-icon delete-btn delete-cheque-btn" data-caisse-id="${caisseId}" data-index="${index}" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button></td></tr>`;}).join('')}</tbody></table>`;
    }
    
    totalContainerParent.innerHTML = `Total (${cheques.length} chèque${cheques.length > 1 ? 's' : ''}): <span id="cheque-total-${caisseId}">${formatCurrency(totalCheques, config)}</span>`;
    hiddenInputsContainer.innerHTML = cheques.map((cheque, index) => `<input type="hidden" name="caisse[${caisseId}][cheques][${index}][montant]" value="${cheque.montant}"><input type="hidden" name="caisse[${caisseId}][cheques][${index}][commentaire]" value="${cheque.commentaire}">`).join('');
}

function renderTpeList(caisseId, terminalId, tpeState, config) {
    const listContainer = document.getElementById(`tpe-releves-list-${terminalId}-${caisseId}`);
    const hiddenContainer = document.getElementById(`tpe-hidden-inputs-${terminalId}-${caisseId}`);
    if (!listContainer || !hiddenContainer) return;

    const releves = (tpeState[caisseId]?.[terminalId] || []).sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));

    if (releves.length === 0) {
        listContainer.innerHTML = '<p class="empty-list">Aucun relevé pour ce TPE.</p>';
    } else {
        listContainer.innerHTML = `<table class="tpe-table"><thead><tr><th>Heure</th><th>Montant</th><th>Action</th></tr></thead><tbody>${releves.map((releve, index) => {
            const isLast = index === releves.length - 1;
            const rowClass = isLast ? 'releve-actif' : '';
            return `<tr class="${rowClass}"><td>${releve.heure || 'N/A'}</td><td>${formatCurrency(parseLocaleFloat(releve.montant), config)}</td><td><button type="button" class="btn-icon delete-btn delete-tpe-releve-btn" data-caisse-id="${caisseId}" data-terminal-id="${terminalId}" data-index="${index}"><i class="fa-solid fa-trash-can"></i></button></td></tr>`;
        }).join('')}</tbody></table>`;
    }

    hiddenContainer.innerHTML = releves.map((r, i) => `<input type="hidden" name="caisse[${caisseId}][tpe][${terminalId}][${i}][montant]" value="${r.montant}"><input type="hidden" name="caisse[${caisseId}][tpe][${terminalId}][${i}][heure]" value="${r.heure}">`).join('');
}

export function applyFullFormState(data, state) {
    if (data.cheques) {
        state.chequesState = data.cheques;
        Object.keys(state.chequesState).forEach(id => renderChequeList(id, state.chequesState, state.config));
    }
    if (data.tpe) {
        state.tpeState = data.tpe;
        Object.keys(state.tpeState).forEach(caisseId => {
            Object.keys(state.tpeState[caisseId]).forEach(tpeId => renderTpeList(caisseId, tpeId, state.tpeState, state.config));
        });
    }
    if (data.state) {
        for (const id in data.state) {
            const field = document.getElementById(id);
            if (field) field.value = data.state[id];
        }
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
        state.chequesState[data.caisseId] = data.cheques;
        renderChequeList(data.caisseId, state.chequesState, state.config);
    }
    if (data.type === 'tpe_update' && data.caisseId && data.terminalId && data.releves) {
        if (!state.tpeState[data.caisseId]) state.tpeState[data.caisseId] = {};
        state.tpeState[data.caisseId][data.terminalId] = data.releves;
        renderTpeList(data.caisseId, data.terminalId, state.tpeState, state.config);
    }
}

export function handleCalculatorClickEvents(e, state) {
    const target = e.target;
    
    const tabLink = target.closest('.tab-link');
    if (tabLink) {
        document.querySelectorAll('.tab-link, .caisse-tab-content, .ecart-display').forEach(el => el.classList.remove('active'));
        tabLink.classList.add('active');
        document.getElementById(tabLink.dataset.tab)?.classList.add('active');
        document.getElementById(`ecart-display-${tabLink.dataset.tab}`)?.classList.add('active');
        service.calculateAll(state.config, state); // Recalculate to update main ecart display
        return false; // Not a state change, just UI
    }
    const paymentTab = target.closest('.payment-tab-link');
    if(paymentTab) {
        const container = paymentTab.closest('.payment-method-tabs');
        container.querySelectorAll('.payment-tab-link, .payment-tab-content').forEach(el => el.classList.remove('active'));
        paymentTab.classList.add('active');
        container.querySelector(`#${paymentTab.dataset.paymentTab}`)?.classList.add('active');
        service.calculateAll(state.config, state); // Recalculate to update main ecart display
        return false; // Not a state change, just UI
    }
    const addChequeBtn = target.closest('.add-cheque-btn');
    if (addChequeBtn) {
        const caisseId = addChequeBtn.dataset.caisseId;
        const amountInput = document.getElementById(`cheque-amount-${caisseId}`);
        const commentInput = document.getElementById(`cheque-comment-${caisseId}`);
        const amount = parseLocaleFloat(amountInput.value);
        if (amount > 0) {
            if (!state.chequesState[caisseId]) state.chequesState[caisseId] = [];
            state.chequesState[caisseId].push({ montant: amount, commentaire: commentInput.value });
            renderChequeList(caisseId, state.chequesState, state.config);
            sendWsMessage({ type: 'cheque_update', caisseId: caisseId, cheques: state.chequesState[caisseId] });
            amountInput.value = ''; commentInput.value = ''; amountInput.focus();
            return true;
        }
    }
    const deleteChequeBtn = target.closest('.delete-cheque-btn');
    if (deleteChequeBtn) {
        const { caisseId, index } = deleteChequeBtn.dataset;
        if (confirm('Voulez-vous vraiment supprimer ce chèque ?')) {
            state.chequesState[caisseId].splice(index, 1);
            renderChequeList(caisseId, state.chequesState, state.config);
            sendWsMessage({ type: 'cheque_update', caisseId: caisseId, cheques: state.chequesState[caisseId] });
            return true;
        }
    }
    const addTpeBtn = target.closest('.add-tpe-releve-btn');
    if (addTpeBtn) {
        const { caisseId, terminalId } = addTpeBtn.dataset;
        const amountInput = document.getElementById(`tpe-releve-montant-${terminalId}-${caisseId}`);
        const amount = parseLocaleFloat(amountInput.value);
        if (amount > 0) {
            if (!state.tpeState[caisseId]) state.tpeState[caisseId] = {};
            if (!state.tpeState[caisseId][terminalId]) state.tpeState[caisseId][terminalId] = [];
            state.tpeState[caisseId][terminalId].push({ montant: amount, heure: new Date().toTimeString().slice(0, 5) });
            renderTpeList(caisseId, terminalId, state.tpeState, state.config);
            sendWsMessage({ type: 'tpe_update', caisseId, terminalId, releves: state.tpeState[caisseId][terminalId] });
            amountInput.value = ''; amountInput.focus();
            return true;
        }
    }
    const deleteTpeBtn = target.closest('.delete-tpe-releve-btn');
    if (deleteTpeBtn) {
        const { caisseId, terminalId, index } = deleteTpeBtn.dataset;
        state.tpeState[caisseId][terminalId].splice(index, 1);
        renderTpeList(caisseId, terminalId, state.tpeState, state.config);
        sendWsMessage({ type: 'tpe_update', caisseId, terminalId, releves: state.tpeState[caisseId][terminalId] });
        return true;
    }
    return false;
}
