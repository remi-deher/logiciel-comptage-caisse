// Fichier : public/assets/js/logic/cloture-wizard-logic.js (Version Finale Complète et Corrigée)

import { sendWsMessage } from './websocket-service.js';

// --- Variables d'état ---
let config = {};
let wsResourceId = null;
let calculatorData = {};
let wizardState = {
    currentStep: 1,
    selectedCaisses: [],
    confirmedData: {},
};
let chequesState = {}; // NOUVEAU

// --- Fonctions Utilitaires ---
const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(amount);
const parseLocaleFloat = (str) => parseFloat(String(str || '0').replace(',', '.')) || 0;

// --- API ---
async function fetchInitialData() {
    console.log("[Wizard] Récupération de la configuration et de la dernière sauvegarde auto...");
    const configPromise = fetch('index.php?route=calculateur/config').then(res => res.json());
    const dataPromise = fetch('index.php?route=calculateur/get_initial_data').then(res => res.json());

    const [configResult, dataResult] = await Promise.all([configPromise, dataPromise]);
    config = configResult;

    if (!dataResult.success || !dataResult.data) {
        throw new Error("Dernière sauvegarde non trouvée. Veuillez retourner au calculateur.");
    }

    const rawData = dataResult.data;
    calculatorData = {
        nom_comptage: rawData.nom_comptage,
        explication: rawData.explication,
        caisse: {}
    };
    for (const caisseId in rawData) {
        if (!isNaN(caisseId)) {
             calculatorData.caisse[caisseId] = rawData[caisseId];
             if (!calculatorData.caisse[caisseId].denominations) calculatorData.caisse[caisseId].denominations = {};
             if (!calculatorData.caisse[caisseId].tpe) calculatorData.caisse[caisseId].tpe = {};
             // NOUVEAU: Initialiser les chèques
             chequesState[caisseId] = rawData[caisseId].cheques || [];
        }
    }
    console.log("[Wizard] Configuration et données de la BDD chargées.", { config, calculatorData });
}

// --- Logique de Calcul ---
function calculateAllForCaisse(caisseId) {
    if (!calculatorData.caisse?.[caisseId]) return;

    let totalCompteEspeces = 0;
    const allDenoms = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
    const denominationsData = calculatorData.caisse[caisseId].denominations || {};

    for (const name in allDenoms) {
        const quantite = parseInt(denominationsData[name], 10) || 0;
        const totalLigne = quantite * parseFloat(allDenoms[name]);
        totalCompteEspeces += totalLigne;
        const totalLineEl = document.getElementById(`total_${name}_${caisseId}_wizard`);
        if (totalLineEl) totalLineEl.textContent = formatCurrency(totalLigne);
    }

    const fondDeCaisse = parseLocaleFloat(calculatorData.caisse[caisseId].fond_de_caisse);
    const ventesEspeces = parseLocaleFloat(calculatorData.caisse[caisseId].ventes_especes);
    const retrocession = parseLocaleFloat(calculatorData.caisse[caisseId].retrocession);

    const recetteReelleEspeces = totalCompteEspeces - fondDeCaisse;
    const ecart = recetteReelleEspeces - (ventesEspeces + retrocession);
    
    updateEcartDisplay(caisseId, ecart);
}

function calculateWithdrawalSuggestion(caisseId) {
    const caisseData = calculatorData.caisse?.[caisseId] || {};
    if (!caisseData) return { suggestions: [], totalToWithdraw: 0 };

    const denominationsData = caisseData.denominations || {};
    const allDenoms = { ...(config.denominations?.billets || {}), ...(config.denominations?.pieces || {}) };
    const minToKeepRules = config.minToKeep || {};

    const targetFundValue = parseLocaleFloat(caisseData.fond_de_caisse);
    const currentQuantities = {};
    let currentTotalValue = 0;
    for (const name in allDenoms) {
        const qty = parseInt(denominationsData[name], 10) || 0;
        if (qty > 0) {
            currentQuantities[name] = qty;
            currentTotalValue += qty * parseFloat(allDenoms[name]);
        }
    }

    if (currentTotalValue <= targetFundValue) {
        return { suggestions: [], totalToWithdraw: 0 };
    }

    const fundToKeep = {};
    let fundToKeepValue = 0;
    const sortedDenoms = Object.keys(allDenoms).sort((a, b) => parseFloat(allDenoms[b]) - parseFloat(allDenoms[a]));

    for (const name of sortedDenoms) {
        const targetQty = parseInt(minToKeepRules[name], 10) || 0;
        if (targetQty > 0 && currentQuantities[name]) {
            const qtyToReserve = Math.min(currentQuantities[name], targetQty);
            const valueReserved = qtyToReserve * parseFloat(allDenoms[name]);
            if (fundToKeepValue + valueReserved <= targetFundValue) {
                fundToKeep[name] = (fundToKeep[name] || 0) + qtyToReserve;
                fundToKeepValue += valueReserved;
            }
        }
    }

    for (const name of sortedDenoms) {
        const availableQty = (currentQuantities[name] || 0) - (fundToKeep[name] || 0);
        if (availableQty > 0) {
            const value = parseFloat(allDenoms[name]);
            const remainingValueNeeded = targetFundValue - fundToKeepValue;
            if (remainingValueNeeded > 0) {
                const qtyToAdd = Math.min(availableQty, Math.floor(remainingValueNeeded / value));
                if (qtyToAdd > 0) {
                    fundToKeep[name] = (fundToKeep[name] || 0) + qtyToAdd;
                    fundToKeepValue += qtyToAdd * value;
                }
            }
        }
    }

    const suggestions = [];
    let totalToWithdraw = 0;
    for (const name in currentQuantities) {
        const qtyToWithdraw = currentQuantities[name] - (fundToKeep[name] || 0);
        if (qtyToWithdraw > 0) {
            const value = parseFloat(allDenoms[name]);
            const withdrawnAmount = qtyToWithdraw * value;
            suggestions.push({ name, value, qty: qtyToWithdraw, total: withdrawnAmount });
            totalToWithdraw += withdrawnAmount;
        }
    }
    
    return { suggestions, totalToWithdraw };
}

// --- Fonctions de Rendu ---
function updateEcartDisplay(id, ecart) {
    const display = document.getElementById(`ecart-display-caisse${id}_wizard`);
    if (!display) return;
    const valueSpan = display.querySelector('.ecart-value'), explanation = display.querySelector('.ecart-explanation');
    display.classList.remove('ecart-ok', 'ecart-positif', 'ecart-negatif');
    if (valueSpan) valueSpan.textContent = formatCurrency(ecart);
    if (Math.abs(ecart) < 0.01) { display.classList.add('ecart-ok'); if (explanation) explanation.textContent = "L'écart en espèces est de 0."; }
    else if (ecart > 0) { display.classList.add('ecart-positif'); if (explanation) explanation.textContent = "Il y a un surplus d'espèces."; }
    else { display.classList.add('ecart-negatif'); if (explanation) explanation.textContent = "Il manque des espèces."; }
}

function renderSuggestionTable(suggestionData) {
    if (!suggestionData || !suggestionData.suggestions || suggestionData.suggestions.length === 0) {
        return `<div class="withdrawal-summary-card"><div class="withdrawal-total-header status-ok"><div class="total-amount">0,00 €</div><div class="total-label">Aucun retrait nécessaire</div></div><div class="withdrawal-details-list"><div class="detail-item-empty">Le fond de caisse correspond à la cible.</div></div></div>`;
    }
    const detailRows = suggestionData.suggestions.map(s => `<div class="detail-item"><span class="detail-item-label"><i class="fa-solid fa-money-bill-wave item-icon"></i> Retirer ${s.qty} x ${s.value >= 1 ? `${s.value} ${config.currencySymbol}` : `${s.value * 100} cts`}</span><span class="detail-item-value">${formatCurrency(s.total)}</span></div>`).join('');
    return `<div class="withdrawal-summary-card"><div class="withdrawal-total-header"><div class="total-amount">${formatCurrency(suggestionData.totalToWithdraw)}</div><div class="total-label">Total à retirer de la caisse</div></div><div class="withdrawal-details-list">${detailRows}</div></div>`;
}

// NOUVELLE FONCTION pour afficher la liste des chèques dans l'assistant
function renderChequeListWizard(caisseId) {
    const listContainer = document.getElementById(`cheque-list-${caisseId}-wizard`);
    const totalContainer = document.getElementById(`cheque-total-${caisseId}-wizard`);
    if (!listContainer || !totalContainer) return;

    const cheques = chequesState[caisseId] || [];
    let totalCheques = 0;
    
    if (cheques.length === 0) {
        listContainer.innerHTML = '<p class="empty-list">Aucun chèque ajouté.</p>';
    } else {
        listContainer.innerHTML = `
            <table class="cheque-table">
                <thead><tr><th>Montant</th><th>Commentaire</th><th>Action</th></tr></thead>
                <tbody>
                    ${cheques.map((cheque, index) => {
                        totalCheques += parseLocaleFloat(cheque.montant);
                        return `
                            <tr>
                                <td>${formatCurrency(parseLocaleFloat(cheque.montant))}</td>
                                <td>${cheque.commentaire || ''}</td>
                                <td><button type="button" class="btn delete-btn delete-cheque-btn-wizard" data-caisse-id="${caisseId}" data-index="${index}"><i class="fa-solid fa-trash-can"></i></button></td>
                            </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
    }
    totalContainer.textContent = formatCurrency(totalCheques);
    // On met à jour la donnée principale pour la sauvegarde finale
    calculatorData.caisse[caisseId].cheques = cheques;
}


async function renderStep1_Selection() {
    const container = document.querySelector('.wizard-content');
    if (!container) return;
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
            const isLocked = lockInfo && String(lockInfo.locked_by) !== String(wsResourceId);
            const isDisabled = isClosed || isLocked;
            let statusClass = 'status-libre', statusIcon = 'fa-check-circle', statusText = 'Prête pour la clôture';
            if (isClosed) { statusClass = 'status-cloturee'; statusIcon = 'fa-flag-checkered'; statusText = 'Déjà clôturée'; }
            else if (isLocked) { statusClass = 'status-verrouillee'; statusIcon = 'fa-lock'; statusText = 'Utilisée par un autre collaborateur'; }
            return `<label class="caisse-selection-item ${statusClass}" title="${statusText}"><input type="checkbox" name="caisseSelection" value="${id}" ${isDisabled ? 'disabled' : ''}><div class="caisse-info"><i class="fa-solid ${statusIcon}"></i><span>${nom}</span><small class="caisse-status-text">${statusText}</small></div></label>`;
        }).join('');
        container.innerHTML = `<div class="wizard-step-content"><h3>Sélectionnez les caisses à clôturer</h3><div class="selection-controls"><div class="color-key"><div><span class="color-dot color-libre"></span> Libre</div><div><span class="color-dot color-verrouillee"></span> En cours d'utilisation</div><div><span class="color-dot color-cloturee"></span> Déjà clôturée</div></div><div class="button-group"><button type="button" id="select-all-btn" class="btn action-btn">Tout sélectionner</button><button type="button" id="deselect-all-btn" class="btn action-btn">Tout désélectionner</button></div></div><div class="caisse-selection-grid">${caissesHtml}</div></div>`;
        const grid = container.querySelector('.caisse-selection-grid');
        const nextBtn = document.getElementById('wizard-next-btn');
        const updateNextButtonState = () => { nextBtn.disabled = grid.querySelectorAll('input:checked').length === 0; };
        grid.addEventListener('change', updateNextButtonState);
        document.getElementById('select-all-btn').addEventListener('click', () => { grid.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach(cb => cb.checked = true); updateNextButtonState(); });
        document.getElementById('deselect-all-btn').addEventListener('click', () => { grid.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => cb.checked = false); updateNextButtonState(); });
    } catch (error) {
        container.innerHTML = `<p class="error" style="text-align:center;">${error.message}</p>`;
    }
}

function renderStep2_Counting() {
    const container = document.querySelector('.wizard-content');
    let tabsHtml = '', contentHtml = '', ecartsHtml = '';
    wizardState.selectedCaisses.forEach((id, index) => {
        const nom = config.nomsCaisses[id];
        const isActive = index === 0 ? 'active' : '';
        tabsHtml += `<button type="button" class="tab-link ${isActive}" data-tab="caisse${id}_wizard">${nom}</button>`;
        ecartsHtml += `<div id="ecart-display-caisse${id}_wizard" class="ecart-display ${isActive}"><span class="ecart-value"></span><p class="ecart-explanation"></p></div>`;
        
        const caisseData = calculatorData.caisse[id] || {};
        const denominationsData = caisseData.denominations || {};
        const tpeData = caisseData.tpe || {};

        const buildTextInput = (name, value) => `<input type="text" id="${name}_${id}" name="caisse[${id}][${name}]" data-caisse-id="${id}" value="${value || ''}">`;
        const buildDenomInput = (name, value) => `<input type="number" id="${name}_${id}" name="caisse[${id}][denominations][${name}]" data-caisse-id="${id}" value="${value || ''}" min="0">`;
        
        const billets = Object.entries(config.denominations.billets).map(([name, v]) => `<div class="form-group"><label>${v} ${config.currencySymbol}</label>${buildDenomInput(name, denominationsData[name])}<span class="total-line" id="total_${name}_${id}_wizard"></span></div>`).join('');
        const pieces = Object.entries(config.denominations.pieces).map(([name, v]) => `<div class="form-group"><label>${v >= 1 ? v + ' ' + config.currencySymbol : (v * 100) + ' cts'}</label>${buildDenomInput(name, denominationsData[name])}<span class="total-line" id="total_${name}_${id}_wizard"></span></div>`).join('');
        
        const tpePourCaisse = config.tpeParCaisse ? Object.entries(config.tpeParCaisse).filter(([, tpe]) => tpe.caisse_id.toString() === id) : [];
        const tpeHtml = tpePourCaisse.map(([tpeId, tpe]) => `<div class="form-group"><label>${tpe.nom}</label><input type="text" id="tpe_${tpeId}_${id}" name="caisse[${id}][tpe][${tpeId}]" data-caisse-id="${id}" value="${tpeData[tpeId] || ''}"></div>`).join('');

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
    wizardState.selectedCaisses.forEach(id => {
        calculateAllForCaisse(id);
        renderChequeListWizard(id);
    });
}

function renderStep3_Summary() {
    const container = document.querySelector('.wizard-content');
    let summaryHtml = wizardState.selectedCaisses.map(id => {
        const nom = config.nomsCaisses[id];
        const suggestions = calculateWithdrawalSuggestion(id);
        wizardState.confirmedData[id] = { withdrawals: suggestions.suggestions, totalToWithdraw: suggestions.totalToWithdraw };
        return `<div class="card"><h4>Synthèse des retraits pour ${nom}</h4>${renderSuggestionTable(suggestions)}</div>`;
    }).join('');
    container.innerHTML = `<div class="wizard-step-content"><h3>Synthèse des Opérations de Retrait</h3>${summaryHtml}</div>`;
}

function renderStep4_Finalization() {
    const container = document.querySelector('.wizard-content');
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
            totalCompteEspeces += (parseInt(caisseData.denominations[name], 10) || 0) * parseFloat(allDenoms[name]);
        }
        let totalCompteCb = 0;
        if(caisseData.tpe) {
            for(const tpeId in caisseData.tpe) {
                totalCompteCb += parseLocaleFloat(caisseData.tpe[tpeId]);
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
        rowsHtml += `<tr><td><strong>${nomCaisse}</strong></td><td>${formatCurrency(totalVentesCaisse)}</td><td>${formatCurrency(totalCompteCaisse)}</td><td class="ecart-${Math.abs(ecartEspeces) < 0.01 ? 'ok' : (ecartEspeces > 0 ? 'positif' : 'negatif')}">${formatCurrency(ecartEspeces)}</td><td class="text-danger">${formatCurrency(retrait)}</td><td class="text-success">${formatCurrency(fondDeCaisseJ1)}</td></tr>`;
    });

    const grandTotalCompte = grandTotalCompteEspeces + grandTotalCompteCB + grandTotalCompteCheques;
    container.innerHTML = `<div class="wizard-step-content"><h3><i class="fa-solid fa-flag-checkered"></i> Synthèse Finale</h3><p class="subtitle" style="text-align:center; margin-top:-20px; margin-bottom: 30px;">Veuillez vérifier les totaux avant de finaliser la journée.</p><div class="card" style="padding:0;"><table class="final-summary-table"><thead><tr><th>Caisse</th><th>Ventes Totales</th><th>Compté Total</th><th>Écart Espèces</th><th>Retrait Espèces</th><th>Fond de Caisse J+1</th></tr></thead><tbody>${rowsHtml}</tbody><tfoot><tr><td><strong>TOTAL GÉNÉRAL</strong></td><td><strong>${formatCurrency(grandTotalVentes)}</strong></td><td><strong>${formatCurrency(grandTotalCompte)}</strong></td><td class="ecart-${Math.abs(grandTotalEcartEspeces) < 0.01 ? 'ok' : (grandTotalEcartEspeces > 0 ? 'positif' : 'negatif')}"><strong>${formatCurrency(grandTotalEcartEspeces)}</strong></td><td class="text-danger"><strong>${formatCurrency(grandTotalRetraits)}</strong></td><td class="text-success"><strong>${formatCurrency(grandTotalCompteEspeces - grandTotalRetraits)}</strong></td></tr></tfoot></table></div><div class="next-steps-info"><h4>Que se passe-t-il après avoir finalisé ?</h4><ul><li><i class="fa-solid fa-check-circle"></i> Un comptage "Clôture Générale" sera créé dans l'historique avec les chiffres de ce tableau.</li><li><i class="fa-solid fa-check-circle"></i> Un nouveau comptage "Fond de caisse J+1" sera automatiquement généré pour démarrer la journée de demain.</li><li><i class="fa-solid fa-check-circle"></i> L'état des caisses sera réinitialisé.</li></ul></div><div class="confirmation-box"><label><input type="checkbox" id="final-confirmation-checkbox"> Je confirme avoir vérifié les montants et je souhaite clôturer la journée.</label></div></div>`;
    const checkbox = document.getElementById('final-confirmation-checkbox');
    const nextBtn = document.getElementById('wizard-next-btn');
    nextBtn.disabled = true;
    checkbox.addEventListener('change', () => { nextBtn.disabled = !checkbox.checked; });
}

// --- Gestionnaire Principal ---
function updateWizardUI() {
    document.querySelectorAll('.step-item').forEach(stepEl => {
        stepEl.classList.remove('active');
        if (parseInt(stepEl.dataset.step) === wizardState.currentStep) stepEl.classList.add('active');
    });
    const nextBtn = document.getElementById('wizard-next-btn'), prevBtn = document.getElementById('wizard-prev-btn');
    switch(wizardState.currentStep) {
        case 1: renderStep1_Selection(); prevBtn.style.display = 'none'; nextBtn.textContent = 'Suivant'; nextBtn.disabled = true; break;
        case 2: renderStep2_Counting(); prevBtn.style.display = 'inline-block'; nextBtn.textContent = 'Valider les comptages'; nextBtn.disabled = false; break;
        case 3: renderStep3_Summary(); prevBtn.style.display = 'inline-block'; nextBtn.textContent = 'Confirmer et Finaliser'; nextBtn.disabled = false; break;
        case 4: renderStep4_Finalization(); prevBtn.style.display = 'inline-block'; nextBtn.textContent = 'Terminer la Journée'; nextBtn.disabled = true; break;
    }
}

async function handleNextStep() {
    const nextBtn = document.getElementById('wizard-next-btn');
    nextBtn.disabled = true;
    if (wizardState.currentStep === 1) {
        wizardState.selectedCaisses = Array.from(document.querySelectorAll('input:checked')).map(cb => cb.value);
        wizardState.selectedCaisses.forEach(id => {
            if (!calculatorData.caisse[id]) {
                calculatorData.caisse[id] = { 
                    denominations: {}, 
                    tpe: {}, 
                    fond_de_caisse: '0', 
                    ventes_especes: '0', 
                    ventes_cb: '0', 
                    ventes_cheques: '0', 
                    retrocession: '0', 
                    cheques: [] 
                };
            }
            sendWsMessage({ type: 'cloture_lock', caisse_id: id });
        });
        wizardState.currentStep = 2;
    } 
    else if (wizardState.currentStep === 2) { wizardState.currentStep = 3; }
    else if (wizardState.currentStep === 3) { wizardState.currentStep = 4; }
    else if (wizardState.currentStep === 4) {
        const formData = new FormData();
        formData.append('explication', 'Clôture de journée via l\'assistant.');
        wizardState.selectedCaisses.forEach(id => {
            formData.append('caisses_a_cloturer[]', id);
            for (const [key, value] of Object.entries(calculatorData.caisse[id])) {
                if (key === 'denominations' || key === 'tpe') {
                     for(const [subKey, subValue] of Object.entries(value)) {
                        formData.append(`caisse[${id}][${key}][${subKey}]`, subValue);
                    }
                } else if (key === 'cheques') {
                    (value || []).forEach((cheque, index) => {
                        formData.append(`caisse[${id}][cheques][${index}][montant]`, cheque.montant);
                        formData.append(`caisse[${id}][cheques][${index}][commentaire]`, cheque.commentaire);
                    });
                }
                else {
                    formData.append(`caisse[${id}][${key}]`, value);
                }
            }
            wizardState.confirmedData[id].withdrawals.forEach(s => {
                formData.append(`retraits[${id}][${s.name}]`, s.qty);
            });
        });
        try {
            const response = await fetch('index.php?route=cloture/confirm_caisse', { method: 'POST', body: formData });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            sendWsMessage({ type: 'force_reload_all' });
            alert('Clôture réussie ! La page va être rechargée.');
            wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_caisse_confirmed', caisse_id: id }));
            window.location.href = '/calculateur';
            return;
        } catch (error) {
            console.error("[Wizard] Erreur lors de la soumission :", error);
            alert(`Erreur: ${error.message}`);
            nextBtn.disabled = false;
        }
    }
    updateWizardUI();
}

function handlePrevStep() {
    if (wizardState.currentStep === 2) {
        wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
        wizardState.selectedCaisses = [];
    }
    wizardState.currentStep--;
    updateWizardUI();
}

function attachWizardListeners() {
    document.getElementById('wizard-next-btn').addEventListener('click', handleNextStep);
    document.getElementById('wizard-prev-btn').addEventListener('click', handlePrevStep);
    document.getElementById('wizard-cancel-btn').addEventListener('click', () => {
        if (confirm("Voulez-vous vraiment annuler ?")) {
            wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
            window.location.href = '/calculateur';
        }
    });
    
    const wizardContent = document.querySelector('.wizard-content');
    
    wizardContent.addEventListener('input', e => {
        if (e.target.tagName === 'INPUT' && wizardState.currentStep === 2) {
            const nameAttr = e.target.name;
            const caisseId = e.target.dataset.caisseId;
            
            if (!e.target.id.startsWith('cheque-')) { // Ne pas traiter les champs de saisie de chèque ici
                sendWsMessage({ type: 'update', id: e.target.id, value: e.target.value });
            }

            if (!caisseId || !calculatorData.caisse[caisseId] || !nameAttr) return;

            const keys = nameAttr.match(/\[([^\]]+)\]/g).map(key => key.slice(1, -1));

            if (keys.length === 3) { 
                const [id, mainKey, subKey] = keys;
                if (!calculatorData.caisse[id][mainKey]) calculatorData.caisse[id][mainKey] = {};
                calculatorData.caisse[id][mainKey][subKey] = e.target.value;
            } else if (keys.length === 2) {
                const [id, mainKey] = keys;
                calculatorData.caisse[id][mainKey] = e.target.value;
            }

            const mainKey = keys[1];
            if (mainKey === 'denominations' || mainKey === 'fond_de_caisse' || mainKey === 'ventes_especes' || mainKey === 'retrocession') {
                calculateAllForCaisse(caisseId);
            }
        }
    });
    
    wizardContent.addEventListener('click', e => {
        const mainTab = e.target.closest('.tab-link');
        const paymentTab = e.target.closest('.payment-tab-link');
        if (mainTab) {
            wizardContent.querySelectorAll('.tab-link, .caisse-tab-content, .ecart-display').forEach(el => el.classList.remove('active'));
            mainTab.classList.add('active');
            const tabId = mainTab.dataset.tab;
            wizardContent.querySelector(`#${tabId}`)?.classList.add('active');
            wizardContent.querySelector(`#ecart-display-${tabId}`)?.classList.add('active');
        } else if (paymentTab) {
            const container = paymentTab.closest('.payment-method-tabs');
            container.querySelectorAll('.payment-tab-link, .payment-tab-content').forEach(el => el.classList.remove('active'));
            paymentTab.classList.add('active');
            const tabId = paymentTab.dataset.paymentTab;
            container.querySelector(`#${tabId}`)?.classList.add('active');
        }
        
        const addBtn = e.target.closest('.add-cheque-btn-wizard');
        if (addBtn) {
            const caisseId = addBtn.dataset.caisseId;
            const amountInput = document.getElementById(`cheque-amount-${caisseId}-wizard`);
            const commentInput = document.getElementById(`cheque-comment-${caisseId}-wizard`);
            const amount = parseLocaleFloat(amountInput.value);
            if (amount > 0) {
                chequesState[caisseId].push({ montant: amount, commentaire: commentInput.value });
                renderChequeListWizard(caisseId);
                sendWsMessage({ type: 'cheque_update', caisseId: caisseId, cheques: chequesState[caisseId] });
                amountInput.value = '';
                commentInput.value = '';
                amountInput.focus();
            }
        }
        
        const deleteBtn = e.target.closest('.delete-cheque-btn-wizard');
        if (deleteBtn) {
            const { caisseId, index } = deleteBtn.dataset;
            chequesState[caisseId].splice(index, 1);
            renderChequeListWizard(caisseId);
            sendWsMessage({ type: 'cheque_update', caisseId: caisseId, cheques: chequesState[caisseId] });
        }
    });
}

export async function initializeClotureWizard() {
    try {
        await fetchInitialData();
        updateWizardUI();
        attachWizardListeners();
    } catch (error) {
        console.error("Erreur critique lors de l'initialisation de l'assistant de clôture :", error);
        document.querySelector('.wizard-content').innerHTML = `<p class="error">${error.message}</p>`;
        document.getElementById('wizard-next-btn').disabled = true;
        document.getElementById('wizard-prev-btn').style.display = 'none';
    }
}
