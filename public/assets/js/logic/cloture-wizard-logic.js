// Fichier : public/assets/js/logic/cloture-wizard-logic.js (CORRIGÉ)

import { sendWsMessage } from './websocket-service.js';

// --- Variables d'état de l'assistant ---
let config = {};
let closedCaisses = [];
let calculatorData = {}; // NOUVEAU: Stockera les données du formulaire du calculateur
let wizardState = {
    currentStep: 1,
    selectedCaisses: [], // IDs des caisses à clôturer
    confirmedData: {},   // Données validées pour chaque caisse
    currentIndex: 0     // Index de la caisse en cours de revue
};

// --- Fonctions Utilitaires ---
const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(amount);
const parseLocaleFloat = (str) => parseFloat(String(str || '0').replace(',', '.')) || 0;

// --- API ---
async function fetchInitialData() {
    const configPromise = fetch('index.php?route=calculateur/config').then(res => res.json());
    const clotureStatePromise = fetch('index.php?route=cloture/get_state').then(res => res.json());
    const [conf, clotureState] = await Promise.all([configPromise, clotureStatePromise]);
    
    config = conf;
    closedCaisses = clotureState.closed_caisses.map(String) || [];
    
    // NOUVEAU: Charger les données depuis sessionStorage
    const savedData = sessionStorage.getItem('calculatorFormData');
    if (savedData) {
        calculatorData = JSON.parse(savedData);
    } else {
        throw new Error("Les données du calculateur n'ont pas pu être chargées. Veuillez retourner au calculateur.");
    }
}


/**
 * CORRIGÉ : Cette fonction est maintenant définie avant d'être utilisée.
 * Génère le HTML pour afficher la table des suggestions de retrait.
 * @param {array} suggestions Le tableau des suggestions calculées.
 * @param {number} total Le montant total à retirer.
 * @returns {string} Le code HTML de la table.
 */
function renderSuggestionTable(suggestions, total) {
    if (suggestions.length === 0) {
        return '<p class="status-ok" style="text-align:center; padding: 10px;">Aucun retrait nécessaire pour optimiser le fond de caisse.</p>';
    }

    const rows = suggestions.map(s => {
        const label = s.value >= 1 ? `${s.value} ${config.currencySymbol}` : `${s.value * 100} cts`;
        return `<tr>
                    <td>${label}</td>
                    <td style="text-align: right;">${s.qty}</td>
                    <td style="text-align: right;">${formatCurrency(s.total)}</td>
                </tr>`;
    }).join('');

    return `
        <div class="table-responsive">
            <table class="modal-details-table">
                <thead>
                    <tr>
                        <th>Dénomination</th>
                        <th style="text-align: right;">Quantité à retirer</th>
                        <th style="text-align: right;">Valeur</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="2"><strong>Total à retirer</strong></td>
                        <td style="text-align: right;"><strong>${formatCurrency(total)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
}


// --- Logique de calcul (CORRIGÉE pour utiliser les données en mémoire) ---

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

function calculateCaisseDataForConfirmation(caisseId) {
    let totalCompte = 0;
    const caisseData = calculatorData.caisse?.[caisseId] || {};
    const allDenoms = {...(config.denominations?.billets || {}), ...(config.denominations?.pieces || {})};
    for (const name in allDenoms) {
        totalCompte += (parseInt(caisseData[name], 10) || 0) * allDenoms[name];
    }
    
    const fondDeCaisse = parseLocaleFloat(caisseData.fond_de_caisse);
    const ventes = parseLocaleFloat(caisseData.ventes);
    const retrocession = parseLocaleFloat(caisseData.retrocession);
    const recetteReelle = totalCompte - fondDeCaisse;
    const ecart = recetteReelle - (ventes + retrocession);
    return { recetteReelle, ecart, totalCompte, fondDeCaisse };
}

// --- Fonctions de Rendu des Étapes (inchangées, mais utiliseront les fonctions de calcul corrigées) ---

function renderStep1_Selection() {
    const container = document.querySelector('.wizard-content');
    const availableCaisses = Object.entries(config.nomsCaisses).filter(([id]) => !closedCaisses.includes(id));
    
    if (availableCaisses.length === 0) {
        container.innerHTML = `<div class="wizard-step-content"><p class="status-ok">Toutes les caisses ont déjà été clôturées pour aujourd'hui.</p></div>`;
        document.getElementById('wizard-next-btn').disabled = true;
        return;
    }

    const caissesHtml = availableCaisses.map(([id, nom]) => `
        <label class="caisse-selection-item">
            <input type="checkbox" name="caisseSelection" value="${id}">
            <div class="caisse-info">
                <i class="fa-solid fa-cash-register"></i>
                <span>${nom}</span>
            </div>
        </label>
    `).join('');

    container.innerHTML = `
        <div class="wizard-step-content" id="step-1-content">
            <h3>Sélectionnez les caisses à clôturer</h3>
            <div class="caisse-selection-grid">${caissesHtml}</div>
        </div>
    `;
    
    container.querySelector('.caisse-selection-grid').addEventListener('change', () => {
        const selected = container.querySelectorAll('input[name="caisseSelection"]:checked').length;
        document.getElementById('wizard-next-btn').disabled = selected === 0;
    });
}

function renderStep2_Review() {
    const container = document.querySelector('.wizard-content');
    const caisseId = wizardState.selectedCaisses[wizardState.currentIndex];
    const caisseNom = config.nomsCaisses[caisseId];

    const data = calculateCaisseDataForConfirmation(caisseId);
    const { suggestions, totalToWithdraw } = calculateWithdrawalSuggestion(caisseId);

    wizardState.confirmedData[caisseId] = {
        summary: data,
        withdrawals: suggestions,
        totalToWithdraw: totalToWithdraw
    };

    container.innerHTML = `
        <div class="wizard-step-content" id="step-2-content">
            <div class="review-header">
                <h3>Revue de la Caisse : <strong>${caisseNom}</strong></h3>
                <span class="step-indicator">Caisse ${wizardState.currentIndex + 1} sur ${wizardState.selectedCaisses.length}</span>
            </div>
            <div class="review-grid">
                <div class="review-summary card">
                    <h4>Résumé du comptage</h4>
                    <div class="summary-line"><span>Recette réelle :</span> <strong>${formatCurrency(data.recetteReelle)}</strong></div>
                    <div class="summary-line"><span>Écart constaté :</span> <strong>${formatCurrency(data.ecart)}</strong></div>
                </div>
                <div class="review-withdrawal card">
                    <h4>Suggestion de retrait</h4>
                    ${renderSuggestionTable(suggestions, totalToWithdraw)}
                </div>
            </div>
        </div>
    `;
}

function renderStep3_FinalSummary() {
    const container = document.querySelector('.wizard-content');
    let grandTotalCompte = 0;
    
    const summaryHtml = Object.entries(wizardState.confirmedData).map(([id, data]) => {
        grandTotalCompte += data.summary.totalCompte;
        const caisseNom = config.nomsCaisses[id];
        return `<div class="card"><h4>${caisseNom}</h4><p>Total compté: <strong>${formatCurrency(data.summary.totalCompte)}</strong></p></div>`;
    }).join('');

    const withdrawalsHtml = Object.entries(wizardState.confirmedData)
        .filter(([, data]) => data.withdrawals.length > 0)
        .map(([id, data]) => {
            const caisseNom = config.nomsCaisses[id];
            return `<div class="card"><h4>Retraits pour ${caisseNom}</h4>${renderSuggestionTable(data.withdrawals, data.totalToWithdraw)}</div>`;
        }).join('');

    container.innerHTML = `
        <div class="wizard-step-content" id="step-3-content">
            <h3>Synthèse de la Clôture</h3>
            <div class="final-summary-grid">
                <div>
                    <h4>Totaux par caisse</h4>
                    <div class="card-grid">${summaryHtml}</div>
                    <div class="card grand-total">Total Général en Caisse: <strong>${formatCurrency(grandTotalCompte)}</strong></div>
                </div>
                <div>
                    <h4>Récapitulatif des retraits</h4>
                    ${withdrawalsHtml || '<p>Aucun retrait suggéré.</p>'}
                </div>
            </div>
        </div>
    `;
}

// --- Gestionnaire Principal de l'Assistant ---

function updateWizardUI() {
    document.querySelectorAll('.step-item').forEach(stepEl => {
        stepEl.classList.remove('active');
        if (parseInt(stepEl.dataset.step) === wizardState.currentStep) {
            stepEl.classList.add('active');
        }
    });

    switch(wizardState.currentStep) {
        case 1: renderStep1_Selection(); break;
        case 2: renderStep2_Review(); break;
        case 3: renderStep3_FinalSummary(); break;
    }

    const prevBtn = document.getElementById('wizard-prev-btn');
    const nextBtn = document.getElementById('wizard-next-btn');
    
    prevBtn.style.display = wizardState.currentStep > 1 ? 'inline-block' : 'none';
    
    if (wizardState.currentStep === 1) {
        const selected = document.querySelectorAll('input[name="caisseSelection"]:checked').length;
        nextBtn.disabled = selected === 0;
        nextBtn.textContent = 'Suivant';
    } else if (wizardState.currentStep === 2) {
        nextBtn.disabled = false;
        const isLastCaisse = wizardState.currentIndex === wizardState.selectedCaisses.length - 1;
        nextBtn.textContent = isLastCaisse ? 'Voir la synthèse' : 'Confirmer et Suivant';
    } else if (wizardState.currentStep === 3) {
        nextBtn.disabled = false;
        nextBtn.textContent = 'Terminer la Journée';
    }
}

async function handleNextStep() {
    const nextBtn = document.getElementById('wizard-next-btn');
    nextBtn.disabled = true;

    if (wizardState.currentStep === 1) {
        wizardState.selectedCaisses = Array.from(document.querySelectorAll('input[name="caisseSelection"]:checked')).map(cb => cb.value);
        wizardState.currentStep = 2;
        wizardState.currentIndex = 0;
        updateWizardUI();
    } 
    else if (wizardState.currentStep === 2) {
        const caisseId = wizardState.selectedCaisses[wizardState.currentIndex];
        
        // CORRIGÉ: On construit FormData par programmation
        const formData = new FormData();
        formData.append('caisse_id_a_cloturer', caisseId);
        // On ajoute les données de la caisse concernée
        for (const [key, value] of Object.entries(calculatorData.caisse[caisseId])) {
            formData.append(`caisse[${caisseId}][${key}]`, value);
        }
        wizardState.confirmedData[caisseId].withdrawals.forEach(s => {
            formData.append(`retraits[${caisseId}][${s.name}]`, s.qty);
        });

        try {
            const response = await fetch('index.php?route=cloture/confirm_caisse', { method: 'POST', body: formData });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            sendWsMessage({ type: 'cloture_caisse_confirmed', caisse_id: caisseId });
            
            if (wizardState.currentIndex < wizardState.selectedCaisses.length - 1) {
                wizardState.currentIndex++;
                updateWizardUI();
            } else {
                wizardState.currentStep = 3;
                updateWizardUI();
            }

        } catch (error) {
            alert(`Erreur lors de la confirmation de la caisse: ${error.message}`);
            nextBtn.disabled = false;
        }
    } 
    else if (wizardState.currentStep === 3) {
        if (!confirm("Vous êtes sur le point de finaliser tous les comptages et de réinitialiser les caisses pour demain. Cette action est irréversible. Continuer ?")) {
            nextBtn.disabled = false;
            return;
        }

        // CORRIGÉ: On construit FormData par programmation
        const formData = new FormData();
        // Ajouter toutes les données de toutes les caisses
        for (const [caisseId, caisseData] of Object.entries(calculatorData.caisse)) {
            for (const [key, value] of Object.entries(caisseData)) {
                formData.append(`caisse[${caisseId}][${key}]`, value);
            }
        }
        // Ajouter tous les retraits
        Object.entries(wizardState.confirmedData).forEach(([caisseId, data]) => {
             data.withdrawals.forEach(s => {
                formData.append(`retraits[${caisseId}][${s.name}]`, s.qty);
             });
        });

        try {
            const response = await fetch('index.php?route=cloture/confirm_generale', { method: 'POST', body: formData });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            alert('Clôture générale réussie ! La page va être rechargée.');
            sessionStorage.removeItem('calculatorFormData'); // Nettoyer
            window.location.href = '/calculateur';
        } catch (error) {
            alert(`Erreur lors de la clôture générale : ${error.message}`);
            nextBtn.disabled = false;
        }
    }
}

function handlePrevStep() {
    if (wizardState.currentStep === 2) {
        if (wizardState.currentIndex > 0) {
            wizardState.currentIndex--;
        } else {
            wizardState.currentStep = 1;
            wizardState.confirmedData = {};
        }
        updateWizardUI();
    } else if (wizardState.currentStep === 3) {
        wizardState.currentStep = 2;
        updateWizardUI();
    }
}

// --- Point d'entrée ---
export async function initializeClotureWizard() {
    document.getElementById('wizard-next-btn').addEventListener('click', handleNextStep);
    document.getElementById('wizard-prev-btn').addEventListener('click', handlePrevStep);
    document.getElementById('wizard-cancel-btn').addEventListener('click', () => {
        if (confirm("Voulez-vous vraiment annuler le processus de clôture ?")) {
            sessionStorage.removeItem('calculatorFormData'); // Nettoyer
            window.location.href = '/calculateur';
        }
    });

    try {
        await fetchInitialData();
        updateWizardUI();
    } catch (error) {
        document.querySelector('.wizard-content').innerHTML = `<p class="error">Erreur critique : ${error.message}</p>`;
        document.getElementById('wizard-next-btn').disabled = true;
    }
}














