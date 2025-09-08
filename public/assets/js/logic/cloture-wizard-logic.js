// Fichier : public/assets/js/logic/cloture-wizard-logic.js (Finalisé avec modes de paiement et synchro temps réel)

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

// --- Fonctions Utilitaires ---
const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(amount);
const parseLocaleFloat = (str) => parseFloat(String(str || '0').replace(',', '.')) || 0;

// --- API ---
async function fetchInitialData() {
    config = await (await fetch('index.php?route=calculateur/config')).json();
    const savedData = sessionStorage.getItem('calculatorFormData');
    if (!savedData) {
        throw new Error("Données du calculateur non trouvées. Veuillez retourner au calculateur.");
    }
    calculatorData = JSON.parse(savedData);
}

// --- Logique de Calcul ---
function calculateAllForCaisse(caisseId) {
    if (!calculatorData.caisse?.[caisseId]) return;
    let totalCompte = 0;
    const allDenoms = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
    for (const name in allDenoms) {
        const quantite = parseInt(calculatorData.caisse[caisseId][name], 10) || 0;
        const totalLigne = quantite * parseFloat(allDenoms[name]);
        totalCompte += totalLigne;
        const totalLineEl = document.getElementById(`total_${name}_${caisseId}_wizard`);
        if (totalLineEl) totalLineEl.textContent = formatCurrency(totalLigne);
    }
    const fondDeCaisse = parseLocaleFloat(calculatorData.caisse[caisseId].fond_de_caisse);
    const ventes = parseLocaleFloat(calculatorData.caisse[caisseId].ventes);
    const retrocession = parseLocaleFloat(calculatorData.caisse[caisseId].retrocession);
    const ecart = (totalCompte - fondDeCaisse) - (ventes + retrocession);
    updateEcartDisplay(caisseId, ecart);
}

function calculateWithdrawalSuggestion(caisseId) {
    const suggestions = [], caisseData = calculatorData.caisse?.[caisseId] || {};
    let totalToWithdraw = 0;
    const allDenoms = { ...(config.denominations?.billets || {}), ...(config.denominations?.pieces || {}) };
    const minToKeep = config.minToKeep || {};
    const sortedDenoms = Object.keys(allDenoms).sort((a, b) => allDenoms[b] - allDenoms[a]);
    for (const name of sortedDenoms) {
        const currentQty = parseInt(caisseData[name], 10) || 0, minQty = minToKeep[name] || 0;
        if (currentQty > minQty) {
            const qtyToWithdraw = currentQty - minQty;
            const value = qtyToWithdraw * parseFloat(allDenoms[name]);
            totalToWithdraw += value;
            suggestions.push({ name, value: allDenoms[name], qty: qtyToWithdraw, total: value });
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
    if (Math.abs(ecart) < 0.01) {
        display.classList.add('ecart-ok');
        if (explanation) explanation.textContent = "La caisse est juste.";
    } else if (ecart > 0) {
        display.classList.add('ecart-positif');
        if (explanation) explanation.textContent = "Il y a un surplus.";
    } else {
        display.classList.add('ecart-negatif');
        if (explanation) explanation.textContent = "Il manque de l'argent.";
    }
}

function renderSuggestionTable(suggestions, total) {
    if (suggestions.length === 0) return '<p class="status-ok">Aucun retrait nécessaire.</p>';
    const rows = suggestions.map(s => `<tr><td>${s.value >= 1 ? `${s.value} ${config.currencySymbol}` : `${s.value * 100} cts`}</td><td class="text-right">${s.qty}</td><td class="text-right">${formatCurrency(s.total)}</td></tr>`).join('');
    return `<div class="table-responsive"><table class="modal-details-table"><thead><tr><th>Dénomination</th><th class="text-right">Quantité</th><th class="text-right">Valeur</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2"><strong>Total</strong></td><td class="text-right"><strong>${formatCurrency(total)}</strong></td></tr></tfoot></table></div>`;
}

function renderStep1_Selection() {
    const container = document.querySelector('.wizard-content');
    const caissesHtml = Object.entries(config.nomsCaisses).map(([id, nom]) => `<label class="caisse-selection-item"><input type="checkbox" name="caisseSelection" value="${id}"><div class="caisse-info"><i class="fa-solid fa-cash-register"></i><span>${nom}</span></div></label>`).join('');
    container.innerHTML = `<div class="wizard-step-content"><h3>Sélectionnez les caisses à clôturer</h3><div class="caisse-selection-grid">${caissesHtml}</div></div>`;
    container.querySelector('.caisse-selection-grid').addEventListener('change', () => {
        document.getElementById('wizard-next-btn').disabled = container.querySelectorAll('input:checked').length === 0;
    });
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
        const billets = Object.entries(config.denominations.billets).map(([name, v]) => `<div class="form-group"><label>${v} ${config.currencySymbol}</label><input type="number" id="${name}_${id}" data-caisse-id="${id}" value="${caisseData[name] || ''}" min="0"><span class="total-line" id="total_${name}_${id}_wizard"></span></div>`).join('');
        const pieces = Object.entries(config.denominations.pieces).map(([name, v]) => `<div class="form-group"><label>${v >= 1 ? v + ' ' + config.currencySymbol : (v * 100) + ' cts'}</label><input type="number" id="${name}_${id}" data-caisse-id="${id}" value="${caisseData[name] || ''}" min="0"><span class="total-line" id="total_${name}_${id}_wizard"></span></div>`).join('');
        const tpeHtml = (config.tpeParCaisse[id] || []).map(tpe => `<div class="form-group"><label>${tpe.nom_terminal}</label><input type="text" id="tpe_${tpe.id}" data-caisse-id="${id}" value="${caisseData[`tpe_${tpe.id}`] || ''}"></div>`).join('');

        contentHtml += `<div id="caisse${id}_wizard" class="caisse-tab-content ${isActive}">
            <div class="grid grid-3" style="margin-bottom:20px;">
                <div class="form-group"><label>Fond de Caisse</label><input type="text" id="fond_de_caisse_${id}" data-caisse-id="${id}" value="${caisseData.fond_de_caisse || ''}"></div>
                <div class="form-group"><label>Ventes</label><input type="text" id="ventes_${id}" data-caisse-id="${id}" value="${caisseData.ventes || ''}"></div>
                <div class="form-group"><label>Rétrocessions</label><input type="text" id="retrocession_${id}" data-caisse-id="${id}" value="${caisseData.retrocession || ''}"></div>
            </div>
            <div class="payment-method-tabs">
                <div class="payment-method-selector">
                    <button type="button" class="payment-tab-link active" data-payment-tab="especes_${id}"><i class="fa-solid fa-money-bill-wave"></i> Espèces</button>
                    ${tpeHtml ? `<button type="button" class="payment-tab-link" data-payment-tab="cb_${id}"><i class="fa-solid fa-credit-card"></i> Carte Bancaire</button>` : ''}
                </div>
                <div id="especes_${id}" class="payment-tab-content active"><h4>Billets</h4><div class="grid">${billets}</div><h4 style="margin-top:20px;">Pièces</h4><div class="grid">${pieces}</div></div>
                ${tpeHtml ? `<div id="cb_${id}" class="payment-tab-content"><div class="grid">${tpeHtml}</div></div>` : ''}
            </div>
        </div>`;
    });
    container.innerHTML = `<div class="wizard-step-content"><h3>Vérifiez et ajustez les comptages</h3><div class="tab-selector">${tabsHtml}</div><div class="ecart-display-container">${ecartsHtml}</div><div id="caisses-content-container">${contentHtml}</div></div>`;
    wizardState.selectedCaisses.forEach(id => calculateAllForCaisse(id));
}

function renderStep3_Summary() {
    const container = document.querySelector('.wizard-content');
    let summaryHtml = wizardState.selectedCaisses.map(id => {
        const nom = config.nomsCaisses[id];
        const { suggestions, totalToWithdraw } = calculateWithdrawalSuggestion(id);
        wizardState.confirmedData[id] = { withdrawals: suggestions, totalToWithdraw };
        return `<div class="card"><h4>Synthèse pour ${nom}</h4>${renderSuggestionTable(suggestions, totalToWithdraw)}</div>`;
    }).join('');
    container.innerHTML = `<div class="wizard-step-content"><h3>Synthèse et Suggestions de Retrait</h3>${summaryHtml}</div>`;
}

function renderStep4_Finalization() {
    const container = document.querySelector('.wizard-content');
    container.innerHTML = `<div class="wizard-step-content"><h3>Finalisation</h3><p>Vous êtes sur le point de clôturer ${wizardState.selectedCaisses.length} caisse(s). Cette action enregistrera les comptages et les retraits dans l'historique.</p><p class="warning-text" style="text-align:center; font-weight:bold; color: var(--color-danger);">Cette action est irréversible.</p></div>`;
}

// --- Gestionnaire Principal ---
function updateWizardUI() {
    document.querySelectorAll('.step-item').forEach(stepEl => {
        stepEl.classList.remove('active');
        if (parseInt(stepEl.dataset.step) === wizardState.currentStep) {
            stepEl.classList.add('active');
        }
    });

    const nextBtn = document.getElementById('wizard-next-btn');
    const prevBtn = document.getElementById('wizard-prev-btn');

    switch(wizardState.currentStep) {
        case 1: 
            renderStep1_Selection();
            prevBtn.style.display = 'none';
            nextBtn.textContent = 'Suivant';
            nextBtn.disabled = document.querySelectorAll('input[name="caisseSelection"]:checked').length === 0;
            break;
        case 2: 
            renderStep2_Counting();
            prevBtn.style.display = 'inline-block';
            nextBtn.textContent = 'Valider les comptages';
            nextBtn.disabled = false;
            break;
        case 3: 
            renderStep3_Summary();
            prevBtn.style.display = 'inline-block';
            nextBtn.textContent = 'Confirmer et Finaliser';
            nextBtn.disabled = false;
            break;
        case 4: 
            renderStep4_Finalization();
            prevBtn.style.display = 'inline-block';
            nextBtn.textContent = 'Terminer la Journée';
            nextBtn.disabled = false;
            break;
    }
}

async function handleNextStep() {
    const nextBtn = document.getElementById('wizard-next-btn');
    nextBtn.disabled = true;

    if (wizardState.currentStep === 1) {
        wizardState.selectedCaisses = Array.from(document.querySelectorAll('input:checked')).map(cb => cb.value);
        wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_lock', caisse_id: id }));
        wizardState.currentStep = 2;
    } 
    else if (wizardState.currentStep === 2) {
        wizardState.currentStep = 3;
    }
    else if (wizardState.currentStep === 3) {
        wizardState.currentStep = 4;
    }
    else if (wizardState.currentStep === 4) {
        const formData = new FormData();
        // Le nom du comptage est maintenant généré côté serveur pour plus de cohérence
        formData.append('explication', 'Clôture de journée via l\'assistant.');

        wizardState.selectedCaisses.forEach(id => {
            formData.append('caisses_a_cloturer[]', id);
            for (const [key, value] of Object.entries(calculatorData.caisse[id])) {
                formData.append(`caisse[${id}][${key}]`, value);
            }
            wizardState.confirmedData[id].withdrawals.forEach(s => {
                formData.append(`retraits[${id}][${s.name}]`, s.qty);
            });
        });
        
        try {
            const response = await fetch('index.php?route=cloture/confirm_caisse', { method: 'POST', body: formData });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            alert('Clôture réussie ! La page va être rechargée.');
            wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_caisse_confirmed', caisse_id: id }));
            sessionStorage.removeItem('calculatorFormData');
            window.location.href = '/calculateur';
            return;
        } catch (error) {
            alert(`Erreur: ${error.message}`);
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
        if (confirm("Voulez-vous vraiment annuler ? Le comptage en cours sera perdu.")) {
            wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
            sessionStorage.removeItem('calculatorFormData');
            window.location.href = '/calculateur';
        }
    });

    const wizardContent = document.querySelector('.wizard-content');

    wizardContent.addEventListener('input', e => {
        if (e.target.tagName === 'INPUT' && wizardState.currentStep === 2) {
            const caisseId = e.target.dataset.caisseId;
            const inputId = e.target.id;
            // Extrait la clé (ex: 'b500', 'fond_de_caisse', 'tpe_1') de l'ID
            const key = inputId.replace(`_${caisseId}`, '');
            if (caisseId && calculatorData.caisse[caisseId]) {
                calculatorData.caisse[caisseId][key] = e.target.value;
                sendWsMessage({ id: inputId, value: e.target.value }); // Envoi temps réel
                // On ne recalcule l'écart que si ce n'est pas un champ TPE
                if (!key.startsWith('tpe_')) {
                    calculateAllForCaisse(caisseId);
                }
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
    });
}


// --- Point d'entrée ---
export async function initializeClotureWizard() {
    try {
        await fetchInitialData();
        updateWizardUI(); // Appelle une version condensée pour la clarté
        attachWizardListeners();
    } catch (error) {
        document.querySelector('.wizard-content').innerHTML = `<p class="error">${error.message}</p>`;
        document.getElementById('wizard-next-btn').disabled = true;
        document.getElementById('wizard-prev-btn').style.display = 'none';
    }
}
