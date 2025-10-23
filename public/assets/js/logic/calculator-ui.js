// Fichier : public/assets/js/logic/calculator-ui.js (Corrigé - Added Export for populateInitialData)

import { formatCurrency, parseLocaleFloat } from '../utils/formatters.js';
import * as service from './calculator-service.js';
import { sendWsMessage } from './websocket-service.js';

// Référence à la fonction qui met à jour le bouton principal (sera définie dans calculator-logic.js)
// On la retire car l'affectation directe ne fonctionne pas avec les modules ES6
// export let updateClotureButtonState = (state) => {};


/**
 * Met à jour l'état visuel de TOUTES les caisses en fonction des données de clôture.
 */
export function updateAllCaisseLocks(state) {
    if (!state.config || !state.config.nomsCaisses) return;

    Object.keys(state.config.nomsCaisses).forEach(caisseId => {
        const lockInfo = state.lockedCaisses.find(c => String(c.caisse_id) === String(caisseId));
        const isClosed = state.closedCaisses.includes(String(caisseId));

        let status = 'open';
        if (isClosed) status = 'closed';
        else if (lockInfo && String(lockInfo.locked_by) !== String(state.wsResourceId)) status = 'locked_by_other';

        updateCaisseLockState(caisseId, status, state);
    });

    const allCaisseIds = Object.keys(state.config.nomsCaisses || {});
    const allClosed = allCaisseIds.length > 0 && allCaisseIds.every(id => state.closedCaisses.includes(String(id)));

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
    const recapContainer = document.getElementById('cloture-recap-container');

    if (!tabLink || !caisseContent || !recapContainer) {
        // console.warn(`Éléments manquants pour la caisse ${caisseId}, impossible de mettre à jour l'état.`);
        return;
    }
    if (ecartDisplay) {
         ecartDisplay.classList.remove('cloture-mode', 'cloture-closed');
    }


    const isActive = tabLink.classList.contains('active');
    tabLink.className = 'tab-link';
    if (isActive) tabLink.classList.add('active');

    if (isActive) {
        recapContainer.innerHTML = '';
    }

    caisseContent.querySelectorAll('input, textarea, button').forEach(el => el.disabled = false);

    switch (status) {
        case 'locked_by_other':
            tabLink.classList.add('status-locked-by-other');
            caisseContent.querySelectorAll('input, textarea, button').forEach(el => el.disabled = true);
            break;

        case 'closed':
            tabLink.classList.add('status-closed');
             if (ecartDisplay) ecartDisplay.classList.add('cloture-closed');
            if (isActive) {
                recapContainer.innerHTML = renderClotureSectionForClosed(caisseId, state);
            }
            caisseContent.querySelectorAll('input, textarea, button:not(.payment-tab-link):not(.cloture-reopen-btn)').forEach(el => el.disabled = true);
            break;

        case 'open':
             break;
    }
}

/**
 * Génère le HTML pour le contenu du récapitulatif de dépôt/retrait.
 */
export function renderClotureSectionContent(caisseId, state) {
    const caisseData = state.calculatorData.caisse[caisseId];
    if (!caisseData) {
        return '<p class="error">Données de la caisse introuvables.</p>';
    }

    const suggestions = service.calculateWithdrawalSuggestion(caisseData, state.config);
    const { totalCompteCb, totalCompteCheques } = service.calculateEcartsForCaisse(caisseId, state);

    let rowsHtml = suggestions.suggestions.filter(s => s.qty > 0).map(s => {
        const label = s.value >= 1 ? `${s.value} ${state.config.currencySymbol}` : `${s.value * 100} cts`;
        return `
            <tr>
                <td><i class="fa-solid fa-money-bill-wave"></i> ${label}</td>
                <td class="text-center">${s.qty}</td>
                <td class="text-right">${formatCurrency(s.total, state.config)}</td>
            </tr>
        `;
    }).join('');

    const grandTotalDepot = suggestions.totalToWithdraw + totalCompteCb + totalCompteCheques;

    return `
        <p>Voici le détail du dépôt à effectuer basé sur les saisies effectuées pour cette caisse.</p>
        <div class="table-responsive">
            <table class="suggestion-table">
                <thead>
                    <tr>
                        <th>Dénomination</th>
                        <th class="text-center">Quantité retirée</th>
                        <th class="text-right">Total retiré</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml.length > 0 ? rowsHtml : `<tr><td colspan="3" class="text-center">Aucun retrait d'espèces effectué.</td></tr>`}
                    <tr class="summary-row">
                        <td colspan="2"><strong><i class="fa-solid fa-money-bill-wave"></i> Total Espèces retirées</strong></td>
                        <td class="text-right"><strong>${formatCurrency(suggestions.totalToWithdraw, state.config)}</strong></td>
                    </tr>
                    <tr class="summary-row">
                        <td colspan="2"><strong><i class="fa-solid fa-credit-card"></i> Total des Cartes Bancaires</strong></td>
                        <td class="text-right">${formatCurrency(totalCompteCb, state.config)}</td>
                    </tr>
                    <tr class="summary-row">
                        <td colspan="2"><strong><i class="fa-solid fa-money-check-dollar"></i> Total des Chèques</strong></td>
                        <td class="text-right">${formatCurrency(totalCompteCheques, state.config)}</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr class="grand-total-row">
                        <td colspan="2"><strong>Total Général du dépôt pour cette caisse</strong></td>
                        <td class="text-right"><strong>${formatCurrency(grandTotalDepot, state.config)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}


/**
 * Génère le HTML pour la section d'une caisse déjà clôturée.
 */
function renderClotureSectionForClosed(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    const recapContentHtml = renderClotureSectionContent(caisseId, state);

    return `
        <div class="cloture-recap-card">
            <h4><i class="fa-solid fa-check-circle"></i> ${caisseNom} Clôturée - Récapitulatif du Dépôt</h4>
            ${recapContentHtml}
            <div class="cloture-actions">
                <button type="button" class="btn action-btn cloture-reopen-btn" data-caisse-id="${caisseId}"><i class="fa-solid fa-rotate-left"></i> Réouvrir la caisse</button>
            </div>
        </div>
    `;
}


/**
 * Affiche la bannière de finalisation avec le récapitulatif global.
 */
export function showFinalSummaryBanner(state) {
    const container = document.getElementById('cloture-final-summary-banner-container');
    if (!container) return;

    const caisseDataMap = new Map();
    let grandTotalEspeces = 0;
    let grandTotalCb = 0;
    let grandTotalCheques = 0;
    let grandTotalGeneral = 0;

    const caisseIds = Object.keys(state.config.nomsCaisses);

    caisseIds.forEach(caisseId => {
        const caisseData = state.calculatorData.caisse[caisseId];
        let totals = { nom: state.config.nomsCaisses[caisseId], totalEspeces: 0, totalCb: 0, totalCheques: 0, totalCaisse: 0 };
        if (caisseData) {
            const suggestions = service.calculateWithdrawalSuggestion(caisseData, state.config);
            const ecarts = service.calculateEcartsForCaisse(caisseId, state);
            totals.totalEspeces = suggestions.totalToWithdraw;
            totals.totalCb = ecarts.totalCompteCb;
            totals.totalCheques = ecarts.totalCompteCheques;
            totals.totalCaisse = totals.totalEspeces + totals.totalCb + totals.totalCheques;

            grandTotalEspeces += totals.totalEspeces;
            grandTotalCb += totals.totalCb;
            grandTotalCheques += totals.totalCheques;
        }
        caisseDataMap.set(caisseId, totals);
    });

    grandTotalGeneral = grandTotalEspeces + grandTotalCb + grandTotalCheques;

    const headerHtml = `
        <tr>
            <th>Moyen de Paiement</th>
            ${caisseIds.map(id => `<th class="text-right">${caisseDataMap.get(id).nom}</th>`).join('')}
            <th class="text-right">Total Général</th>
        </tr>
    `;

    const especesRow = `
        <tr>
            <td><i class="fa-solid fa-money-bill-wave"></i> Espèces</td>
            ${caisseIds.map(id => `<td class="text-right">${formatCurrency(caisseDataMap.get(id).totalEspeces, state.config)}</td>`).join('')}
            <td class="text-right"><strong>${formatCurrency(grandTotalEspeces, state.config)}</strong></td>
        </tr>
    `;

    const cbRow = `
        <tr>
            <td><i class="fa-solid fa-credit-card"></i> Cartes Bancaires</td>
            ${caisseIds.map(id => `<td class="text-right">${formatCurrency(caisseDataMap.get(id).totalCb, state.config)}</td>`).join('')}
            <td class="text-right"><strong>${formatCurrency(grandTotalCb, state.config)}</strong></td>
        </tr>
    `;

    const chequesRow = `
        <tr>
            <td><i class="fa-solid fa-money-check-dollar"></i> Chèques</td>
            ${caisseIds.map(id => `<td class="text-right">${formatCurrency(caisseDataMap.get(id).totalCheques, state.config)}</td>`).join('')}
            <td class="text-right"><strong>${formatCurrency(grandTotalCheques, state.config)}</strong></td>
        </tr>
    `;

    const footerHtml = `
        <tr class="grand-total-row">
            <td><strong>Total Caisse</strong></td>
             ${caisseIds.map(id => `<td class="text-right"><strong>${formatCurrency(caisseDataMap.get(id).totalCaisse, state.config)}</strong></td>`).join('')}
            <td class="text-right"><strong>${formatCurrency(grandTotalGeneral, state.config)}</strong></td>
        </tr>
    `;

    container.innerHTML = `
        <div class="cloture-final-summary-banner">
            <div class="banner-header">
                <h4><i class="fa-solid fa-flag-checkered"></i> Journée Prête pour Finalisation</h4>
                <p>Toutes les caisses sont clôturées. Voici le récapitulatif consolidé de votre remise en banque :</p>
            </div>
            <div class="table-responsive">
                <table class="suggestion-table">
                    <thead>
                        ${headerHtml}
                    </thead>
                    <tbody>
                        ${especesRow}
                        ${cbRow}
                        ${chequesRow}
                    </tbody>
                    <tfoot>
                        ${footerHtml}
                    </tfoot>
                </table>
            </div>
            <div class="banner-actions">
                <button id="show-suggestions-btn" class="btn action-btn"><i class="fa-solid fa-eye"></i> Voir détail retraits par caisse</button>
                <button id="finalize-day-btn" class="btn save-btn">Finaliser et Archiver la Journée</button>
            </div>
        </div>

        <div id="suggestions-modal" class="modal">
            <div class="modal-content wide">
                <div class="modal-header">
                    <h3>Détail des retraits d'espèces par caisse</h3>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body" id="suggestions-modal-body"></div>
                 <div class="modal-footer">
                    <button type="button" class="btn action-btn modal-close">Fermer</button>
                </div>
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

        const rowsHtml = suggestions.suggestions.filter(s => s.qty > 0).map(s => `
            <tr>
                <td>${s.value >= 1 ? `${s.value} ${state.config.currencySymbol}` : `${s.value * 100} cts`}</td>
                <td class="text-center">${s.qty}</td>
                <td class="text-right">${formatCurrency(s.total, state.config)}</td>
            </tr>
        `).join('');

        contentHtml += `
            <div class="card" style="margin-bottom: 20px;">
                <h4>${caisseNom} - Total espèces retirées : ${formatCurrency(suggestions.totalToWithdraw, state.config)}</h4>
                <div class="table-responsive">
                    <table class="suggestion-table">
                        <thead>
                            <tr><th>Dénomination</th><th class="text-center">Quantité</th><th class="text-right">Valeur</th></tr>
                        </thead>
                        <tbody>${rowsHtml.length > 0 ? rowsHtml : `<tr><td colspan="3" class="text-center">Aucun retrait d'espèces pour cette caisse.</td></tr>`}</tbody>
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
    const numericValue = parseFloat(value);
    const label = numericValue >= 1 ? `${numericValue} ${config.currencySymbol}` : `${numericValue * 100} cts`;
    const inputId = `${name}_${caisseId}`;
    const totalId = `total_${inputId}`;
    const nameAttr = `caisse[${caisseId}][denominations][${name}]`;
    const cardClass = type === 'pieces' ? 'is-piece' : '';

    return `
        <div class="denom-card ${cardClass}">
            <div class="denom-card-header">${label}</div>
            <div class="denom-card-body">
                <input type="number" class="quantity-input" data-caisse-id="${caisseId}" id="${inputId}" name="${nameAttr}" min="0" placeholder="0" inputmode="numeric" pattern="[0-9]*">
            </div>
            <div class="denom-card-footer" id="${totalId}">${formatCurrency(0, config)}</div>
        </div>`;
}

/**
 * Génère la modale de proposition d'échange multi-dénominations.
 */
export function renderReserveModal(caisseId, reserveStatus, config) {
    const modalBody = document.getElementById('reserve-request-modal-body');
    if (!modalBody) return;

    const allDenominations = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
    const sortedDenoms = Object.entries(allDenominations).sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));

    const denomOptions = sortedDenoms.map(([name, value]) => {
        const numericValue = parseFloat(value);
        const label = numericValue >= 1 ? `${numericValue} ${config.currencySymbol}` : `${numericValue * 100} cts`;
        return `<option value="${name}">${label}</option>`;
    }).join('');

    const stockHtml = sortedDenoms.map(([name, value]) => {
        const quantite = reserveStatus.denominations[name] || 0;
        const numericValue = parseFloat(value);
        const label = numericValue >= 1 ? `${numericValue} ${config.currencySymbol}` : `${numericValue * 100} cts`;
        return `
            <div class="denom-card ${quantite > 0 ? '' : 'disabled'}">
                <h4>${label}</h4>
                <div class="quantite">${quantite}</div>
            </div>`;
    }).join('');

    modalBody.innerHTML = `
        <div class="reserve-request-layout">
            <div class="reserve-stock-preview">
                <h4><i class="fa-solid fa-boxes-stacked"></i> Stock actuel de la Réserve</h4>
                <div class="total-value-display">Valeur totale : ${formatCurrency(reserveStatus.total, config)}</div>
                <div class="denominations-grid">${stockHtml}</div>
            </div>

            <div class="reserve-request-form">
                <h4><i class="fa-solid fa-right-left"></i> Proposition d'Échange</h4>
                <form id="calculator-reserve-request-form">
                    <input type="hidden" name="caisse_id" value="${caisseId}">

                    <div class="exchange-panels-container">
                        <div class="exchange-panel">
                            <h5><i class="fa-solid fa-arrow-down-to-bracket"></i> Je demande (à la Réserve)</h5>
                            <div class="exchange-rows-container" id="demande-rows-container"></div>
                            <button type="button" class="btn action-btn-small add-exchange-row-btn" data-type="demande"><i class="fa-solid fa-plus"></i> Ajouter une ligne</button>
                            <div class="value-display">Total demandé : <span id="total-vers-caisse">${formatCurrency(0, config)}</span></div>
                        </div>

                        <div class="exchange-panel">
                            <h5><i class="fa-solid fa-arrow-up-from-bracket"></i> Je donne (de ma Caisse)</h5>
                            <div class="exchange-rows-container" id="donne-rows-container"></div>
                            <button type="button" class="btn action-btn-small add-exchange-row-btn" data-type="donne"><i class="fa-solid fa-plus"></i> Ajouter une ligne</button>
                            <div class="value-display">Total donné : <span id="total-depuis-caisse">${formatCurrency(0, config)}</span></div>
                        </div>
                    </div>

                    <div class="balance-indicator balance-nok" id="reserve-balance-indicator">
                        <i class="fa-solid fa-scale-unbalanced"></i>
                        <span>La balance doit être égale à ${formatCurrency(0, config)}</span>
                    </div>

                    <div class="form-group">
                        <label for="reserve-notes-demandeur">Notes (optionnel)</label>
                        <textarea id="reserve-notes-demandeur" name="notes_demandeur" rows="2" placeholder="Ex: Besoin urgent de monnaie..."></textarea>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn delete-btn" id="cancel-reserve-request-btn">Annuler</button>
                        <button type="submit" class="btn save-btn" id="submit-reserve-request-btn" disabled>Proposer l'échange</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    addExchangeRow('demande', denomOptions);
    addExchangeRow('donne', denomOptions);
}

/**
 * Crée une nouvelle ligne de dénomination dans la modale d'échange.
 */
export function addExchangeRow(type, denomOptions) {
    const container = document.getElementById(`${type}-rows-container`);
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'exchange-row';

    const namePrefix = type === 'demande' ? 'demande' : 'donne';

    row.innerHTML = `
        <select name="${namePrefix}_denoms[]" class="inline-input">${denomOptions}</select>
        <input type="number" name="${namePrefix}_qtys[]" class="inline-input quantity" min="0" placeholder="Qté" inputmode="numeric" pattern="[0-9]*">
        <button type="button" class="btn-icon delete-btn remove-exchange-row-btn"><i class="fa-solid fa-trash-can"></i></button>
    `;
    container.appendChild(row);
}

/**
 * Génère l'interface principale du calculateur.
 */
export function renderCalculatorUI(pageElement, config) {
    if (!pageElement || !config || !config.nomsCaisses || !config.denominations) {
        console.error("Impossible de rendre l'UI: configuration ou élément de page manquant.");
        if (pageElement) pageElement.innerHTML = `<p class="error">Erreur critique : Impossible d'afficher le calculateur.</p>`;
        return;
    }

    const tabSelector = pageElement.querySelector('.tab-selector');
    const ecartContainer = pageElement.querySelector('.ecart-display-container');
    const caissesContainer = pageElement.querySelector('#caisses-content-container');
    // Vérifier que les conteneurs existent
    if (!tabSelector || !ecartContainer || !caissesContainer) {
        console.error("Éléments conteneurs manquants pour renderCalculatorUI.");
        return;
    }


    let tabsHtml = '', contentHtml = '', ecartsHtml = '';

    Object.entries(config.nomsCaisses).forEach(([id, nom], index) => {
        const isActive = index === 0 ? 'active' : '';
        tabsHtml += `<button type="button" class="tab-link ${isActive}" data-tab="caisse${id}" data-caisse-id="${id}">${nom}</button>`;

        ecartsHtml += `
            <div id="ecart-display-caisse${id}" class="ecart-display ${isActive}">
                <div class="caisse-header">
                     <h3 class="caisse-name-display"><i class="fa-solid fa-cash-register"></i> ${nom}</h3>
                     <button type="button" class="btn action-btn open-reserve-modal-btn" data-caisse-id="${id}">
                         <i class="fa-solid fa-vault"></i> Demander à la Réserve
                     </button>
                </div>
                <div id="main-ecart-caisse${id}" class="main-ecart-display">
                    <span class="ecart-label">Écart Espèces</span>
                    <span class="ecart-value">${formatCurrency(0, config)}</span>
                    <p class="ecart-explanation"></p>
                </div>
                <div id="secondary-ecarts-caisse${id}" class="secondary-ecarts"></div>
            </div>`;

        const billetsHtml = Object.entries(config.denominations.billets || {}).map(([name, v]) => createDenominationCard(id, name, v, 'billets', config)).join('');
        const piecesHtml = Object.entries(config.denominations.pieces || {}).map(([name, v]) => createDenominationCard(id, name, v, 'pieces', config)).join('');

        const especesTabContent = `
            <div class="theoretical-inputs-panel">
                <div class="compact-input-group">
                    <label for="ventes_especes_${id}">Encaissement Espèces Théorique</label>
                    <input type="text" data-caisse-id="${id}" id="ventes_especes_${id}" name="caisse[${id}][ventes_especes]" inputmode="decimal">
                </div>
                <div class="compact-input-group">
                    <label for="retrocession_${id}">Rétrocessions en Espèces
                        <span class="help-tooltip">
                            <i class="fa-regular fa-circle-question help-icon"></i>
                            <span class="tooltip-text">Montant total des espèces sorties manuellement du tiroir-caisse (ex: paiement fournisseur, note de frais).</span>
                        </span>
                    </label>
                    <input type="text" data-caisse-id="${id}" id="retrocession_${id}" name="caisse[${id}][retrocession]" inputmode="decimal">
                </div>
            </div>
            <div class="cash-drawer-section">
                <h4><i class="fa-solid fa-money-bill-wave"></i> Billets <span class="section-total" id="total-billets-${id}">${formatCurrency(0, config)}</span></h4>
                <div class="denominations-container">${billetsHtml}</div>
            </div>
            <div class="cash-drawer-section">
                <h4><i class="fa-solid fa-coins"></i> Pièces <span class="section-total" id="total-pieces-${id}">${formatCurrency(0, config)}</span></h4>
                <div class="denominations-container">${piecesHtml}</div>
            </div>
            <div class="cash-drawer-section totals-summary">
                <div class="summary-line grand-total">
                    <span>Total Espèces Compté</span>
                    <span id="total-especes-${id}">${formatCurrency(0, config)}</span>
                </div>
            </div>`;

        const tpePourCaisse = config.tpeParCaisse ? Object.entries(config.tpeParCaisse).filter(([,tpe]) => String(tpe.caisse_id) === String(id)) : [];
        const tpeHtml = tpePourCaisse.map(([tpeId, tpe]) => `
            <div class="tpe-card">
                <h4>${tpe.nom || `TPE #${tpeId}`}</h4>
                <div class="tpe-releves-list" id="tpe-releves-list-${tpeId}-${id}">
                    <p class="empty-list">Aucun relevé pour ce TPE.</p>
                </div>
                <div class="tpe-releve-form">
                    <input type="text" id="tpe-releve-montant-${tpeId}-${id}" placeholder="Montant du relevé" inputmode="decimal">
                     <input type="time" id="tpe-releve-heure-${tpeId}-${id}" title="Heure du relevé (optionnel)">
                    <button type="button" class="btn new-btn add-tpe-releve-btn" data-caisse-id="${id}" data-terminal-id="${tpeId}">
                        <i class="fa-solid fa-plus"></i> Ajouter
                    </button>
                </div>
                <div id="tpe-hidden-inputs-${tpeId}-${id}"></div>
            </div>`).join('');
        const tpeSectionHtml = tpePourCaisse.length > 0 ? `<div class="tpe-grid">${tpeHtml}</div>` : '<p>Aucun TPE configuré pour cette caisse.</p>';

        const cbTabContent = `
            <div class="theoretical-inputs-panel">
                <div class="compact-input-group">
                    <label for="ventes_cb_${id}">Encaissement CB Théorique</label>
                    <input type="text" data-caisse-id="${id}" id="ventes_cb_${id}" name="caisse[${id}][ventes_cb]" inputmode="decimal">
                </div>
                <div class="compact-input-group">
                     <label for="retrocession_cb_${id}">Rétrocessions en CB
                        <span class="help-tooltip">
                            <i class="fa-regular fa-circle-question help-icon"></i>
                            <span class="tooltip-text">Montant total des transactions 'crédit' sur le TPE (ex: remboursement article).</span>
                        </span>
                    </label>
                    <input type="text" data-caisse-id="${id}" id="retrocession_cb_${id}" name="caisse[${id}][retrocession_cb]" inputmode="decimal">
                </div>
            </div>
            ${tpeSectionHtml}`;

        const chequesTabContent = `
            <div class="theoretical-inputs-panel">
                <div class="compact-input-group">
                     <label for="ventes_cheques_${id}">Encaissement Chèques Théorique</label>
                    <input type="text" data-caisse-id="${id}" id="ventes_cheques_${id}" name="caisse[${id}][ventes_cheques]" inputmode="decimal">
                </div>
                <div class="compact-input-group">
                     <label for="retrocession_cheques_${id}">Rétrocessions en Chèques
                        <span class="help-tooltip">
                            <i class="fa-regular fa-circle-question help-icon"></i>
                            <span class="tooltip-text">Montant total des chèques émis depuis la caisse (rare).</span>
                        </span>
                    </label>
                    <input type="text" data-caisse-id="${id}" id="retrocession_cheques_${id}" name="caisse[${id}][retrocession_cheques]" inputmode="decimal">
                </div>
            </div>
            <div class="cheque-section" id="cheque-section-${id}"></div>`;

        contentHtml += `
            <div id="caisse${id}" class="caisse-tab-content ${isActive}">
                <div class="payment-method-tabs">
                    <div class="payment-method-selector">
                        <button type="button" class="payment-tab-link active" data-payment-tab="especes_${id}" data-method-key="especes"><i class="fa-solid fa-money-bill-wave"></i> Espèces</button>
                        <button type="button" class="payment-tab-link" data-payment-tab="cb_${id}" data-method-key="cb"><i class="fa-solid fa-credit-card"></i> CB</button>
                        <button type="button" class="payment-tab-link" data-payment-tab="cheques_${id}" data-method-key="cheques"><i class="fa-solid fa-money-check-dollar"></i> Chèques</button>
                    </div>
                    <div id="especes_${id}" class="payment-tab-content active">${especesTabContent}</div>
                    <div id="cb_${id}" class="payment-tab-content">${cbTabContent}</div>
                    <div id="cheques_${id}" class="payment-tab-content">${chequesTabContent}</div>
                </div>
                <div class="form-group compact-input-group" style="max-width:300px; margin-top:25px;">
                    <label for="fond_de_caisse_${id}">Fond de Caisse Initial</label>
                    <input type="text" data-caisse-id="${id}" id="fond_de_caisse_${id}" name="caisse[${id}][fond_de_caisse]" inputmode="decimal">
                </div>
            </div>`;
    });

    tabSelector.innerHTML = tabsHtml;
    ecartContainer.innerHTML = ecartsHtml;
    caissesContainer.innerHTML = contentHtml;

     if (config.nomsCaisses) {
        Object.keys(config.nomsCaisses).forEach(id => {
            renderChequeList(id, [], config);
        });
    }
}


/**
 * Remplit les champs du formulaire et les listes (TPE, chèques) avec les données initiales chargées.
 * *** DOIT ÊTRE EXPORTÉE ***
 */
export function populateInitialData(calculatorData, config) {
    if (!calculatorData || !config) return;
    const form = document.getElementById('caisse-form');
     if (!form || !form.elements) {
        console.error("populateInitialData: Formulaire ou éléments introuvables.");
        return;
    }

    const setFieldValue = (name, value) => {
        const field = form.elements[name];
        if (field) {
            field.value = value || '';
        }
    };

    setFieldValue('nom_comptage', calculatorData.nom_comptage);
    setFieldValue('explication', calculatorData.explication);

    for (const caisseId in calculatorData.caisse) {
        if (!calculatorData.caisse.hasOwnProperty(caisseId)) continue;

        const caisseData = calculatorData.caisse[caisseId];
        if (caisseData) {
            setFieldValue(`caisse[${caisseId}][fond_de_caisse]`, caisseData.fond_de_caisse);
            setFieldValue(`caisse[${caisseId}][ventes_especes]`, caisseData.ventes_especes);
            setFieldValue(`caisse[${caisseId}][retrocession]`, caisseData.retrocession);
            setFieldValue(`caisse[${caisseId}][ventes_cb]`, caisseData.ventes_cb);
            setFieldValue(`caisse[${caisseId}][retrocession_cb]`, caisseData.retrocession_cb);
            setFieldValue(`caisse[${caisseId}][ventes_cheques]`, caisseData.ventes_cheques);
            setFieldValue(`caisse[${caisseId}][retrocession_cheques]`, caisseData.retrocession_cheques);

            if (caisseData.denominations) {
                Object.entries(caisseData.denominations).forEach(([denom, qty]) => {
                    setFieldValue(`caisse[${caisseId}][denominations][${denom}]`, qty);
                });
            }

            // Appeler les fonctions de rendu de listes (qui sont dans ce fichier maintenant)
            renderChequeList(caisseId, caisseData.cheques || [], config);
            const tpeData = caisseData.tpe || {};
            Object.keys(tpeData).forEach(tpeId => {
                if(config.tpeParCaisse && config.tpeParCaisse[tpeId]) {
                    renderTpeList(caisseId, tpeId, tpeData[tpeId] || [], config);
                }
            });
        }
    }
}

/**
 * Affiche la liste des chèques pour une caisse.
 */
export function renderChequeList(caisseId, cheques = [], config) {
    const container = document.getElementById(`cheque-section-${caisseId}`);
    if(!container) return;

    let totalCheques = 0;
    const chequesHtml = cheques.map((cheque, index) => {
        const montant = parseLocaleFloat(cheque.montant);
        totalCheques += montant;
        return `
            <tr>
                <td>${formatCurrency(montant, config)}</td>
                <td>${cheque.commentaire || ''}</td>
                <td class="cheque-actions">
                    <button type="button" class="btn-icon delete-btn delete-cheque-btn" data-caisse-id="${caisseId}" data-index="${index}" title="Supprimer">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="cheque-grid">
            <div class="cheque-form-container">
                <h4><i class="fa-solid fa-plus-circle"></i> Ajouter un chèque</h4>
                <div class="form-group">
                    <label for="cheque-amount-${caisseId}">Montant</label>
                    <input type="text" id="cheque-amount-${caisseId}" placeholder="0,00 ${config.currencySymbol}" inputmode="decimal">
                </div>
                <div class="form-group">
                    <label for="cheque-comment-${caisseId}">Commentaire (optionnel)</label>
                    <input type="text" id="cheque-comment-${caisseId}" placeholder="Ex: Chèque n°12345, Dupont">
                </div>
                <button type="button" class="btn new-btn add-cheque-btn" data-caisse-id="${caisseId}" style="width: 100%;">
                    <i class="fa-solid fa-plus"></i> Ajouter Chèque
                </button>
            </div>
            <div class="cheque-list-container">
                <div class="cheque-list-header">
                    <h4><i class="fa-solid fa-list-ol"></i> Chèques Encaissés (${cheques.length})</h4>
                    <div class="cheque-total" id="cheque-total-container-${caisseId}">
                        Total: <strong>${formatCurrency(totalCheques, config)}</strong>
                    </div>
                </div>
                <div class="cheque-list" id="cheque-list-${caisseId}">
                    ${cheques.length === 0 ? '<p class="empty-list">Aucun chèque ajouté pour cette caisse.</p>' : `
                        <table class="cheque-table">
                            <thead>
                                <tr>
                                    <th>Montant</th>
                                    <th>Commentaire</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>${chequesHtml}</tbody>
                        </table>
                    `}
                </div>
                <div id="cheque-hidden-inputs-${caisseId}">
                    ${cheques.map((cheque, index) => `
                        <input type="hidden" name="caisse[${caisseId}][cheques][${index}][montant]" value="${cheque.montant || '0'}">
                        <input type="hidden" name="caisse[${caisseId}][cheques][${index}][commentaire]" value="${cheque.commentaire || ''}">
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

/**
 * Affiche la liste des relevés TPE pour une caisse et un terminal.
 */
export function renderTpeList(caisseId, terminalId, releves = [], config) {
    const listContainer = document.getElementById(`tpe-releves-list-${terminalId}-${caisseId}`);
    const hiddenContainer = document.getElementById(`tpe-hidden-inputs-${terminalId}-${caisseId}`);
    if (!listContainer || !hiddenContainer) return;

    const validReleves = Array.isArray(releves) ? releves : [];
    const sortedReleves = [...validReleves].sort((a, b) => (b.heure || '00:00:00').localeCompare(a.heure || '00:00:00'));

    if (sortedReleves.length === 0) {
        listContainer.innerHTML = '<p class="empty-list">Aucun relevé ajouté.</p>';
    } else {
        listContainer.innerHTML = sortedReleves.map((releve, index) => {
            const isActive = index === 0;
            const montant = parseLocaleFloat(releve.montant);
            return `
                <div class="tpe-releve-item ${isActive ? 'releve-actif' : ''}">
                    <span class="releve-heure"><i class="fa-regular fa-clock"></i> ${releve.heure || 'N/A'}</span>
                    <span class="releve-montant">${formatCurrency(montant, config)}</span>
                    <button type="button" class="btn-icon delete-btn delete-tpe-releve-btn" data-caisse-id="${caisseId}" data-terminal-id="${terminalId}" data-index="${index}" title="Supprimer">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    hiddenContainer.innerHTML = sortedReleves.map((r, i) => `
        <input type="hidden" name="caisse[${caisseId}][tpe][${terminalId}][${i}][montant]" value="${r.montant || '0'}">
        <input type="hidden" name="caisse[${caisseId}][tpe][${terminalId}][${i}][heure]" value="${r.heure || ''}">
    `).join('');
}

/**
 * Applique les mises à jour des champs théoriques reçues par WebSocket.
 */
export function applyTheoreticalUpdate(caisseId, data) {
    const activeElement = document.activeElement;

    for (const fieldName in data) {
        const inputId = `${fieldName}_${caisseId}`;
        if (activeElement && activeElement.id === inputId) {
            continue;
        }
        const input = document.getElementById(inputId);
        if (input) {
            input.value = data[fieldName];
        }
    }
}


/**
 * Applique une mise à jour de champ simple (quantité) reçue par WebSocket.
 */
export function applyLiveUpdate(data) {
    const activeElement = document.activeElement;
    if (data.id && (!activeElement || activeElement.id !== data.id)) {
        const input = document.getElementById(data.id);
        if (input) {
            input.value = data.value;
        }
    }
}

/**
 * Applique une mise à jour de liste (chèques ou TPE) reçue par WebSocket.
 */
export function applyListUpdate(data, state) {
    if (!state || !state.config || !state.calculatorData) return;

    const caisseId = data.caisseId;
    if (!caisseId || !state.calculatorData.caisse[caisseId]) return;

    if (data.type === 'cheque_update' && data.cheques) {
        state.calculatorData.caisse[caisseId].cheques = data.cheques;
        renderChequeList(caisseId, data.cheques, state.config);
    }
    if (data.type === 'tpe_update' && data.terminalId && data.releves) {
        if (!state.calculatorData.caisse[caisseId].tpe) {
            state.calculatorData.caisse[caisseId].tpe = {};
        }
        state.calculatorData.caisse[caisseId].tpe[data.terminalId] = data.releves;
        renderTpeList(caisseId, data.terminalId, data.releves, state.config);
    }
}

/**
 * Gère les événements de clic spécifiques à l'interface du calculateur.
 * Retourne true si l'état a été modifié, false sinon.
 */
export function handleCalculatorClickEvents(e, state) {
    const target = e.target;
    const config = state.config;
    const calculatorData = state.calculatorData;

    // Gestion des onglets principaux (Caisses)
    const tabLink = target.closest('.tab-link');
    if (tabLink && tabLink.closest('.tab-selector')) {
        document.querySelectorAll('.tab-link, .caisse-tab-content, .ecart-display').forEach(el => el.classList.remove('active'));
        tabLink.classList.add('active');
        const caisseContent = document.getElementById(tabLink.dataset.tab);
        if (caisseContent) caisseContent.classList.add('active');
        const ecartDisplay = document.getElementById(`ecart-display-caisse${tabLink.dataset.caisseId}`);
        if (ecartDisplay) ecartDisplay.classList.add('active');

        updateAllCaisseLocks(state);
        service.calculateAll(config, state);
        return false;
    }

    // Gestion des sous-onglets (Mode de paiement)
    const paymentTab = target.closest('.payment-tab-link');
    if(paymentTab) {
        const container = paymentTab.closest('.payment-method-tabs');
        if (container) {
            container.querySelectorAll('.payment-tab-link, .payment-tab-content').forEach(el => el.classList.remove('active'));
            paymentTab.classList.add('active');
            const contentToShow = container.querySelector(`#${paymentTab.dataset.paymentTab}`);
            if (contentToShow) contentToShow.classList.add('active');
            service.calculateAll(config, state);
        }
        return false;
    }

    // Ajouter un chèque
    const addChequeBtn = target.closest('.add-cheque-btn');
    if (addChequeBtn) {
        const caisseId = addChequeBtn.dataset.caisseId;
        const amountInput = document.getElementById(`cheque-amount-${caisseId}`);
        const commentInput = document.getElementById(`cheque-comment-${caisseId}`);
        if (amountInput && commentInput) {
            const amount = parseLocaleFloat(amountInput.value);
            if (amount > 0) {
                const newCheque = { montant: amountInput.value.replace('.',','), commentaire: commentInput.value || '' };
                if (!calculatorData.caisse[caisseId].cheques) {
                    calculatorData.caisse[caisseId].cheques = [];
                }
                calculatorData.caisse[caisseId].cheques.push(newCheque);
                renderChequeList(caisseId, calculatorData.caisse[caisseId].cheques, config);
                sendWsMessage({ type: 'cheque_update', caisseId: caisseId, cheques: calculatorData.caisse[caisseId].cheques });
                amountInput.value = ''; commentInput.value = ''; amountInput.focus();
                return true;
            } else {
                 amountInput.focus();
            }
        }
        return false;
    }

    // Supprimer un chèque
    const deleteChequeBtn = target.closest('.delete-cheque-btn');
    if (deleteChequeBtn) {
        const { caisseId, index } = deleteChequeBtn.dataset;
        const idx = parseInt(index, 10);
        if (!isNaN(idx) && calculatorData.caisse[caisseId]?.cheques?.[idx]) {
            if (confirm('Voulez-vous vraiment supprimer ce chèque ?')) {
                calculatorData.caisse[caisseId].cheques.splice(idx, 1);
                renderChequeList(caisseId, calculatorData.caisse[caisseId].cheques, config);
                sendWsMessage({ type: 'cheque_update', caisseId: caisseId, cheques: calculatorData.caisse[caisseId].cheques });
                return true;
            }
        }
        return false;
    }

    // Ajouter un relevé TPE
    const addTpeBtn = target.closest('.add-tpe-releve-btn');
    if (addTpeBtn) {
        const { caisseId, terminalId } = addTpeBtn.dataset;
        const amountInput = document.getElementById(`tpe-releve-montant-${terminalId}-${caisseId}`);
        const timeInput = document.getElementById(`tpe-releve-heure-${terminalId}-${caisseId}`);
        if(amountInput && timeInput) {
            const amount = parseLocaleFloat(amountInput.value);
            if (amount > 0) {
                const newReleve = { montant: amountInput.value.replace('.',','), heure: timeInput.value || null };
                if (!calculatorData.caisse[caisseId].tpe) {
                    calculatorData.caisse[caisseId].tpe = {};
                }
                if (!calculatorData.caisse[caisseId].tpe[terminalId]) {
                    calculatorData.caisse[caisseId].tpe[terminalId] = [];
                }
                calculatorData.caisse[caisseId].tpe[terminalId].push(newReleve);
                renderTpeList(caisseId, terminalId, calculatorData.caisse[caisseId].tpe[terminalId], config);
                sendWsMessage({ type: 'tpe_update', caisseId, terminalId, releves: calculatorData.caisse[caisseId].tpe[terminalId] });
                amountInput.value = ''; timeInput.value = ''; amountInput.focus();
                return true;
            } else {
                amountInput.focus();
            }
        }
        return false;
    }

    // Supprimer un relevé TPE
    const deleteTpeBtn = target.closest('.delete-tpe-releve-btn');
    if (deleteTpeBtn) {
        const { caisseId, terminalId, index } = deleteTpeBtn.dataset;
        const idx = parseInt(index, 10);
        const releves = calculatorData.caisse[caisseId]?.tpe?.[terminalId];
        if (releves && releves.length > idx) {
             const sortedRelevesState = [...releves].sort((a, b) => (b.heure || '00:00:00').localeCompare(a.heure || '00:00:00'));
             const releveToDelete = sortedRelevesState[idx];
             const originalIndex = releves.findIndex(r => r.montant === releveToDelete.montant && r.heure === releveToDelete.heure);

            if (originalIndex !== -1 && confirm('Voulez-vous vraiment supprimer ce relevé TPE ?')) {
                 calculatorData.caisse[caisseId].tpe[terminalId].splice(originalIndex, 1);
                 renderTpeList(caisseId, terminalId, calculatorData.caisse[caisseId].tpe[terminalId], config);
                 sendWsMessage({ type: 'tpe_update', caisseId, terminalId, releves: calculatorData.caisse[caisseId].tpe[terminalId] });
                 return true;
            }
        }
        return false;
    }

    return false;
}

/**
 * Applique l'état complet du formulaire reçu par WebSocket.
 */
export function applyFullFormState(data, state) {
    if (!state || !state.config) return;

    // Appliquer les quantités de dénominations
    if (data.state) {
        for (const id in data.state) {
            const field = document.getElementById(id);
            if (field && document.activeElement !== field) field.value = data.state[id];
        }
    }
     // Appliquer les montants théoriques
    if (data.theoreticals) {
        for (const caisseId in data.theoreticals) {
            applyTheoreticalUpdate(caisseId, data.theoreticals[caisseId]);
        }
    }
    // Appliquer les listes de chèques
    if (data.cheques) {
        Object.keys(data.cheques).forEach(caisseId => {
            if (state.calculatorData.caisse[caisseId]) {
                state.calculatorData.caisse[caisseId].cheques = data.cheques[caisseId];
                renderChequeList(caisseId, data.cheques[caisseId], state.config);
            }
        });
    }
    // Appliquer les listes de TPE
    if (data.tpe) {
        Object.keys(data.tpe).forEach(caisseId => {
             if (state.calculatorData.caisse[caisseId]) {
                state.calculatorData.caisse[caisseId].tpe = data.tpe[caisseId];
                Object.keys(data.tpe[caisseId]).forEach(tpeId => {
                    renderTpeList(caisseId, tpeId, data.tpe[caisseId][tpeId] || [], state.config);
                });
            }
        });
    }
}
