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

    const nextBtn = document.getElementById('wizard-next-btn');
    const prevBtn = document.getElementById('wizard-prev-btn');

    prevBtn.style.display = wizardState.currentStep > 1 ? 'inline-block' : 'none';

    switch(wizardState.currentStep) {
        case 1:
            nextBtn.textContent = 'Suivant';
            nextBtn.disabled = true;
            break;
        case 2:
            nextBtn.textContent = 'Valider les comptages';
            nextBtn.disabled = false;
            break;
        case 3:
            nextBtn.textContent = 'Confirmer et Finaliser';
            nextBtn.disabled = false;
            break;
        case 4:
            nextBtn.textContent = 'Terminer la Journée';
            nextBtn.disabled = true;
            break;
    }
}

/**
 * Affiche l'étape 1 : Sélection des caisses.
 */
export async function renderStep1_Selection(container, config, wsResourceId) {
    container.innerHTML = '<p style="text-align:center;">Chargement de l\'état des caisses...</p>';
    try {
        const response = await fetch('index.php?route=cloture/get_state');
        const stateData = await response.json();
        if (!stateData.success) throw new Error("Impossible de récupérer l'état des caisses.");
        
        const lockedCaisses = stateData.locked_caisses || [];
        const closedCaisses = (stateData.closed_caisses || []).map(String);

        // ... (Logique de génération HTML identique à l'ancien fichier)
        const caissesHtml = Object.entries(config.nomsCaisses).map(([id, nom]) => {
            const isClosed = closedCaisses.includes(id);
            const lockInfo = lockedCaisses.find(c => c.caisse_id.toString() === id);
            const isLocked = lockInfo && String(lockInfo.locked_by) !== String(wsResourceId);
            const isDisabled = isLocked;

            let statusClass = isClosed ? 'status-cloturee' : (isLocked ? 'status-verrouillee' : 'status-libre');
            let statusIcon = isClosed ? 'fa-flag-checkered' : (isLocked ? 'fa-lock' : 'fa-check-circle');
            let statusText = isClosed ? 'Déjà clôturée' : (isLocked ? 'Utilisée par un autre collaborateur' : 'Prête pour la clôture');
            let actionHtml = isClosed 
                ? `<button type="button" class="btn reopen-btn js-reopen-caisse" data-caisse-id="${id}"><i class="fa-solid fa-lock-open"></i> Rouvrir</button>`
                : `<input type="checkbox" name="caisseSelection" value="${id}" ${isDisabled ? 'disabled' : ''}>`;
            
            // ... le reste du HTML de la carte
            return `<label class="caisse-selection-item ${statusClass}" title="${statusText}">...</label>`;
        }).join('');

        container.innerHTML = `<div class="wizard-step-content"><h3>Sélectionnez les caisses à clôturer</h3>...${caissesHtml}...</div>`;

    } catch (error) {
        container.innerHTML = `<p class="error">${error.message}</p>`;
    }
}

/**
 * Affiche l'étape 2 : Comptage.
 */
export function renderStep2_Counting(container, wizardState, calculatorData, tpeState, chequesState, config) {
    // ... (Logique de génération HTML identique à l'ancien fichier)
    // Cette fonction est très longue et sera principalement un copier/coller.
    let tabsHtml = '', contentHtml = '', ecartsHtml = '';
    wizardState.selectedCaisses.forEach((id, index) => {
        //...
    });
    container.innerHTML = `<div class="wizard-step-content">...${tabsHtml}...${ecartsHtml}...${contentHtml}...</div>`;
}

/**
 * Affiche l'étape 3 : Synthèse des retraits.
 */
export function renderStep3_Summary(container, wizardState, calculatorData, config) {
    let summaryHtml = wizardState.selectedCaisses.map(id => {
        const suggestions = service.calculateWithdrawalSuggestion(calculatorData.caisse[id], config);
        // On stocke le résultat du calcul dans l'état du wizard pour l'étape 4
        wizardState.confirmedData[id] = { withdrawals: suggestions.suggestions, totalToWithdraw: suggestions.totalToWithdraw };
        
        // ... Logique de rendu de la table des suggestions ...
        return `<div class="card"><h4>Synthèse pour ${config.nomsCaisses[id]}</h4>...</div>`;
    }).join('');
    container.innerHTML = `<div class="wizard-step-content"><h3>Synthèse des Retraits</h3>${summaryHtml}</div>`;
}

/**
 * Affiche l'étape 4 : Finalisation.
 */
export function renderStep4_Finalization(container, wizardState, calculatorData, tpeState, chequesState, config) {
    // ... (Logique de génération HTML identique à l'ancien fichier)
    // Cette fonction est également très longue et sera un copier/coller.
    container.innerHTML = `<div class="wizard-step-content"><h3>Synthèse Finale</h3>...</div>`;
}
