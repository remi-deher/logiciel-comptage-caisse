// Fichier : public/assets/js/logic/cloture-wizard-logic.js (Amélioré avec étape de comptage)

import { sendWsMessage } from './websocket-service.js';

// --- Variables d'état de l'assistant ---
let config = {};
let wsResourceId = null;
let calculatorData = {}; // Stockera les données du formulaire du calculateur
let wizardState = {
    currentStep: 1,
    selectedCaisses: [], // IDs des caisses à clôturer
    confirmedData: {},   // Données validées pour chaque caisse
};

// --- Fonctions Utilitaires ---
const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(amount);
const parseLocaleFloat = (str) => parseFloat(String(str || '0').replace(',', '.')) || 0;

// --- API ---
async function fetchInitialData() {
    const configPromise = fetch('index.php?route=calculateur/config').then(res => res.json());
    const [conf] = await Promise.all([configPromise]);
    
    config = conf;
    
    const savedData = sessionStorage.getItem('calculatorFormData');
    if (savedData) {
        calculatorData = JSON.parse(savedData);
    } else {
        throw new Error("Les données du calculateur n'ont pas pu être chargées. Veuillez retourner au calculateur.");
    }
}

// --- Logique de calcul ---
function calculateAllForCaisse(caisseId) {
    if (!calculatorData.caisse || !calculatorData.caisse[caisseId]) return;

    let totalCompte = 0;
    const allDenoms = {...(config.denominations.billets || {}), ...(config.denominations.pieces || {})};
    
    for (const name in allDenoms) {
        const quantite = parseInt(calculatorData.caisse[caisseId][name], 10) || 0;
        totalCompte += quantite * parseFloat(allDenoms[name]);
    }

    const fondDeCaisse = parseLocaleFloat(calculatorData.caisse[caisseId].fond_de_caisse);
    const ventes = parseLocaleFloat(calculatorData.caisse[caisseId].ventes);
    const retrocession = parseLocaleFloat(calculatorData.caisse[caisseId].retrocession);
    const ecart = (totalCompte - fondDeCaisse) - (ventes + retrocession);

    updateEcartDisplay(caisseId, ecart);
}

function calculateWithdrawalSuggestion(caisseId) {
    const suggestions = [];
    let totalToWithdraw = 0;
    const caisseData = calculatorData.caisse?.[caisseId] || {};
    const allDenoms = { ...(config.denominations?.billets || {}), ...(config.denominations?.pieces || {}) };
    const minToKeep = config.minToKeep || {};

    const sortedDenoms = Object.keys(allDenoms).sort((a, b) => allDenoms[b] - allDenoms[a]);

    for (const name of sortedDenoms) {
        const currentQty = parseInt(caisseData[name], 10) || 0;
        const minQty = minToKeep[name] || 0;
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
    const display = document.getElementById(`ecart-display-caisse${id}`);
    if (!display) return;
    const valueSpan = display.querySelector('.ecart-value');
    display.classList.remove('ecart-ok', 'ecart-positif', 'ecart-negatif');
    if (valueSpan) valueSpan.textContent = formatCurrency(ecart);
    if (Math.abs(ecart) < 0.01) {
        display.classList.add('ecart-ok');
    } else if (ecart > 0) {
        display.classList.add('ecart-positif');
    } else {
        display.classList.add('ecart-negatif');
    }
}

function renderSuggestionTable(suggestions, total) {
    if (suggestions.length === 0) return '<p class="status-ok">Aucun retrait nécessaire.</p>';
    const rows = suggestions.map(s => `<tr><td>${s.value >= 1 ? `${s.value} ${config.currencySymbol}` : `${s.value * 100} cts`}</td><td class="text-right">${s.qty}</td><td class="text-right">${formatCurrency(s.total)}</td></tr>`).join('');
    return `<div class="table-responsive"><table class="modal-details-table"><thead><tr><th>Dénomination</th><th class="text-right">Quantité</th><th class="text-right">Valeur</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2"><strong>Total à retirer</strong></td><td class="text-right"><strong>${formatCurrency(total)}</strong></td></tr></tfoot></table></div>`;
}

function renderStep1_Selection() {
    const container = document.querySelector('.wizard-content');
    const availableCaisses = Object.entries(config.nomsCaisses);
    
    if (availableCaisses.length === 0) {
        container.innerHTML = `<div class="wizard-step-content"><p class="status-ok">Aucune caisse n'est configurée.</p></div>`;
        document.getElementById('wizard-next-btn').disabled = true;
        return;
    }

    const caissesHtml = availableCaisses.map(([id, nom]) => `
        <label class="caisse-selection-item">
            <input type="checkbox" name="caisseSelection" value="${id}">
            <div class="caisse-info"><i></i><span>${nom}</span></div>
        </label>
    `).join('');

    container.innerHTML = `<div class="wizard-step-content" id="step-1-content"><h3>Sélectionnez les caisses à clôturer</h3><div class="caisse-selection-grid">${caissesHtml}</div></div>`;
    
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
        tabsHtml += `<button type="button" class="tab-link ${isActive}" data-tab="caisse${id}">${nom}</button>`;
        ecartsHtml += `<div id="ecart-display-caisse${id}" class="ecart-display ${isActive}"><span class="ecart-value"></span></div>`;
        
        const caisseData = calculatorData.caisse[id];
        const billets = Object.entries(config.denominations.billets).map(([name, v]) => `<div class="form-group"><label>${v} ${config.currencySymbol}</label><input type="number" data-caisse-id="${id}" name="caisse[${id}][${name}]" value="${caisseData[name] || ''}" min="0"></div>`).join('');
        const pieces = Object.entries(config.denominations.pieces).map(([name, v]) => `<div class="form-group"><label>${v >= 1 ? v + ' ' + config.currencySymbol : (v*100) + ' cts'}</label><input type="number" data-caisse-id="${id}" name="caisse[${id}][${name}]" value="${caisseData[name] || ''}" min="0"></div>`).join('');

        contentHtml += `<div id="caisse${id}" class="caisse-tab-content ${isActive}">
            <div class="grid grid-3">
                <div class="form-group"><label>Fond de Caisse</label><input type="text" data-caisse-id="${id}" name="caisse[${id}][fond_de_caisse]" value="${caisseData.fond_de_caisse || ''}"></div>
                <div class="form-group"><label>Ventes</label><input type="text" data-caisse-id="${id}" name="caisse[${id}][ventes]" value="${caisseData.ventes || ''}"></div>
                <div class="form-group"><label>Rétrocessions</label><input type="text" data-caisse-id="${id}" name="caisse[${id}][retrocession]" value="${caisseData.retrocession || ''}"></div>
            </div>
            <h4>Billets</h4><div class="grid">${billets}</div><h4>Pièces</h4><div class="grid">${pieces}</div>
        </div>`;
    });

    container.innerHTML = `<div class="wizard-step-content">
        <h3>Vérifiez et ajustez les comptages</h3>
        <div class="tab-selector">${tabsHtml}</div>
        <div class="ecart-display-container">${ecartsHtml}</div>
        <div id="caisses-content-container">${contentHtml}</div>
    </div>`;
    
    wizardState.selectedCaisses.forEach(id => calculateAllForCaisse(id));
}

function renderStep3_Summary() {
    const container = document.querySelector('.wizard-content');
    let summaryHtml = '';

    wizardState.selectedCaisses.forEach(id => {
        const nom = config.nomsCaisses[id];
        const { suggestions, totalToWithdraw } = calculateWithdrawalSuggestion(id);
        wizardState.confirmedData[id] = { withdrawals: suggestions, totalToWithdraw };

        summaryHtml += `<div class="card">
            <h4>Synthèse pour ${nom}</h4>
            ${renderSuggestionTable(suggestions, totalToWithdraw)}
        </div>`;
    });
    
    container.innerHTML = `<div class="wizard-step-content"><h3>Synthèse et Suggestions de Retrait</h3>${summaryHtml}</div>`;
}

function renderStep4_Finalization() {
    const container = document.querySelector('.wizard-content');
    container.innerHTML = `<div class="wizard-step-content">
        <h3>Finalisation</h3>
        <p>Vous êtes sur le point de clôturer ${wizardState.selectedCaisses.length} caisse(s). Cette action enregistrera les comptages et les retraits dans l'historique.</p>
        <p class="warning-text">Cette action est irréversible.</p>
    </div>`;
}


// --- Gestionnaire Principal ---
function updateWizardUI() {
    document.querySelectorAll('.step-item').forEach(stepEl => {
        stepEl.classList.remove('active');
        if (parseInt(stepEl.dataset.step) === wizardState.currentStep) {
            stepEl.classList.add('active');
        }
    });

    switch(wizardState.currentStep) {
        case 1: renderStep1_Selection(); break;
        case 2: renderStep2_Counting(); break;
        case 3: renderStep3_Summary(); break;
        case 4: renderStep4_Finalization(); break;
    }
    
    document.getElementById('wizard-prev-btn').style.display = wizardState.currentStep > 1 ? 'inline-block' : 'none';
    const nextBtn = document.getElementById('wizard-next-btn');
    nextBtn.disabled = false;

    if (wizardState.currentStep === 1) nextBtn.textContent = 'Suivant';
    else if (wizardState.currentStep === 2) nextBtn.textContent = 'Valider les comptages';
    else if (wizardState.currentStep === 3) nextBtn.textContent = 'Confirmer et Finaliser';
    else if (wizardState.currentStep === 4) nextBtn.textContent = 'Terminer la Journée';
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
            alert('Clôture réussie !');
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
        if (confirm("Voulez-vous vraiment annuler ?")) {
            wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
            sessionStorage.removeItem('calculatorFormData');
            window.location.href = '/calculateur';
        }
    });

    document.querySelector('.wizard-content').addEventListener('input', e => {
        if (e.target.tagName === 'INPUT' && wizardState.currentStep === 2) {
            const caisseId = e.target.dataset.caisseId;
            const name = e.target.name;
            const match = name.match(/caisse\[\d+\]\[(\w+)\]/);
            if (match) {
                calculatorData.caisse[caisseId][match[1]] = e.target.value;
                calculateAllForCaisse(caisseId);
            }
        }
    });

    document.querySelector('.wizard-content').addEventListener('click', e => {
        const btn = e.target.closest('.tab-link');
        if (btn && wizardState.currentStep === 2) {
            document.querySelectorAll('.tab-link, .caisse-tab-content, .ecart-display').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            document.getElementById(tabId)?.classList.add('active');
            document.getElementById(`ecart-display-${tabId}`)?.classList.add('active');
        }
    });
}

// --- Point d'entrée ---
export async function initializeClotureWizard() {
    try {
        await fetchInitialData();
        updateWizardUI();
        attachWizardListeners();
    } catch (error) {
        document.querySelector('.wizard-content').innerHTML = `<p class="error">${error.message}</p>`;
        document.getElementById('wizard-next-btn').disabled = true;
    }
}
