// Fichier : public/assets/js/logic/cloture-wizard-events.js (Version avec Étape 2 séquentielle)

import { sendWsMessage } from './websocket-service.js';
import * as service from './cloture-wizard-service.js';
import * as ui from './cloture-wizard-ui.js';
import { parseLocaleFloat } from '../utils/formatters.js';

/**
 * Attache tous les écouteurs d'événements pour l'assistant de clôture.
 */
export function attachEventListeners(wizardElement, state, logic) {
    const wizardContent = wizardElement.querySelector('.wizard-content');
    
    // Utiliser la délégation sur le conteneur principal pour les boutons de navigation
    const wizardContainer = document.getElementById('cloture-wizard-page');

    wizardContainer.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('#wizard-next-btn')) logic.handleNextStep();
        if (target.closest('#wizard-prev-btn')) logic.handlePrevStep();
        if (target.closest('#wizard-cancel-btn')) logic.handleCancel();
        if (target.closest('#wizard-finish-btn')) logic.handleNextStep();
    });
    
    wizardContainer.addEventListener('change', (e) => {
        if (e.target.id === 'final-confirmation-checkbox') {
            const finishBtn = document.getElementById('wizard-finish-btn');
            if(finishBtn) finishBtn.disabled = !e.target.checked;
        }
    });

    wizardContent.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        if (button.matches('.js-reopen-caisse')) {
            const caisseId = button.dataset.caisseId;
            if (confirm(`Rouvrir la caisse "${state.config.nomsCaisses[caisseId]}" ?`)) {
                sendWsMessage({ type: 'cloture_reopen', caisse_id: caisseId });
            }
        }
        if (button.id === 'select-all-btn') {
            wizardContent.querySelectorAll('input[name="caisseSelection"]:not(:disabled)').forEach(cb => cb.checked = true);
            ui.updateWizardUI(state.wizardState, false);
        }
        if (button.id === 'deselect-all-btn') {
            wizardContent.querySelectorAll('input[name="caisseSelection"]:checked').forEach(cb => cb.checked = false);
            ui.updateWizardUI(state.wizardState, false);
        }
        
        if (button.matches('.validate-section-btn')) {
            logic.handleNextSubStep();
        }

        if (button.matches('.add-cheque-btn')) {
            const { caisseId } = button.dataset;
            const amountInput = document.getElementById(`cheque-amount-${caisseId}`);
            const commentInput = document.getElementById(`cheque-comment-${caisseId}`);
            const amount = parseLocaleFloat(amountInput.value);
            if(amount > 0) {
                state.chequesState[caisseId].push({ montant: amount, commentaire: commentInput.value });
                document.getElementById(`cheque-list-${caisseId}`).innerHTML = ui.createChequeList(state.chequesState[caisseId], state.config, caisseId);
                service.calculateAndDisplayAllEcarts(caisseId, state);
                amountInput.value = ''; commentInput.value = ''; amountInput.focus();
            }
        }
        
        if (button.matches('.delete-cheque-btn')) {
            const { caisseId, index } = button.dataset;
            state.chequesState[caisseId].splice(index, 1);
            document.getElementById(`cheque-list-${caisseId}`).innerHTML = ui.createChequeList(state.chequesState[caisseId], state.config, caisseId);
            service.calculateAndDisplayAllEcarts(caisseId, state);
        }

        if (button.matches('.add-tpe-btn')) {
            const { caisseId, tpeId } = button.dataset;
            const amountInput = document.getElementById(`tpe-amount-${tpeId}-${caisseId}`);
            const amount = parseLocaleFloat(amountInput.value);
            if(amount > 0) {
                if(!state.tpeState[caisseId][tpeId]) state.tpeState[caisseId][tpeId] = [];
                state.tpeState[caisseId][tpeId].push({ montant: amount, heure: new Date().toTimeString().slice(0,5) });
                document.getElementById(`tpe-list-${tpeId}-${caisseId}`).innerHTML = ui.createTpeReleveList(state.tpeState[caisseId][tpeId], state.config, caisseId, tpeId);
                service.calculateAndDisplayAllEcarts(caisseId, state);
                amountInput.value = ''; amountInput.focus();
            }
        }

        if (button.matches('.delete-tpe-btn')) {
            const { caisseId, tpeId, index } = button.dataset;
            state.tpeState[caisseId][tpeId].splice(index, 1);
            document.getElementById(`tpe-list-${tpeId}-${caisseId}`).innerHTML = ui.createTpeReleveList(state.tpeState[caisseId][tpeId], state.config, caisseId, tpeId);
            service.calculateAndDisplayAllEcarts(caisseId, state);
        }
    });

    wizardContent.addEventListener('input', (e) => {
        if (e.target.name === 'caisseSelection') {
            ui.updateWizardUI(state.wizardState, false);
        }

        if (state.wizardState.currentStep === 2 && e.target.matches('.reconciliation-input')) {
            const nameAttr = e.target.name;
            const caisseId = e.target.dataset.caisseId;
            if (!caisseId || !state.calculatorData.caisse[caisseId] || !nameAttr) return;

            const keys = nameAttr.match(/\[([^\]]+)\]/g).map(key => key.slice(1, -1));
            
            if (keys.length === 3 && keys[1] === 'denominations') {
                state.calculatorData.caisse[caisseId].denominations[keys[2]] = e.target.value;
            } else if (keys.length === 2) {
                state.calculatorData.caisse[caisseId][keys[1]] = e.target.value;
            }
            
            service.calculateAndDisplayAllEcarts(caisseId, state);
        }
    });
}
