// Fichier : public/assets/js/logic/calculator-ui.js

// Import des fonctions utilitaires partagées
import { formatCurrency, parseLocaleFloat } from '../utils/formatters.js';

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
        chequesState[id] = chequesState[id] || [];
        tpeState[id] = tpeState[id] || {};
        const isActive = index === 0 ? 'active' : '';
        tabsHtml += `<button type="button" class="tab-link ${isActive}" data-tab="caisse${id}" data-caisse-id="${id}">${nom}</button>`;
        ecartsHtml += `<div id="ecart-display-caisse${id}" class="ecart-display ${isActive}"><div id="main-ecart-caisse${id}" class="main-ecart-display"><span class="ecart-label">Écart Espèces</span><span class="ecart-value">0,00 €</span></div><div id="secondary-ecarts-caisse${id}" class="secondary-ecarts"></div></div>`;

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
            tpeState[id][tpeId] = tpeState[id][tpeId] || [];
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
            </div>`;
    });
    tabSelector.innerHTML = tabsHtml; 
    ecartContainer.innerHTML = ecartsHtml; 
    caissesContainer.innerHTML = contentHtml;

    // Après avoir généré la structure, on génère les listes dynamiques (chèques, tpe)
    Object.keys(config.nomsCaisses).forEach(id => {
        renderChequeList(id, chequesState, config);
        Object.keys(tpeState[id]).forEach(tpeId => renderTpeList(id, tpeId, tpeState));
    });
}

/**
 * Affiche et met à jour la liste des chèques pour une caisse.
 */
export function renderChequeList(caisseId, chequesState, config) {
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


/**
 * Affiche et met à jour la liste des relevés TPE pour un terminal.
 */
export function renderTpeList(caisseId, terminalId, tpeState) {
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
            return `<tr class="${rowClass}"><td>${releve.heure || 'N/A'}</td><td>${formatCurrency(parseLocaleFloat(releve.montant))}</td><td><button type="button" class="btn-icon delete-btn delete-tpe-releve-btn" data-caisse-id="${caisseId}" data-terminal-id="${terminalId}" data-index="${index}"><i class="fa-solid fa-trash-can"></i></button></td></tr>`;
        }).join('')}</tbody></table>`;
    }

    hiddenContainer.innerHTML = releves.map((r, i) => `<input type="hidden" name="caisse[${caisseId}][tpe][${terminalId}][${i}][montant]" value="${r.montant}"><input type="hidden" name="caisse[${caisseId}][tpe][${terminalId}][${i}][heure]" value="${r.heure}">`).join('');
}
