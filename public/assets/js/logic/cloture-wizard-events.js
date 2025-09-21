// Fichier : public/assets/js/logic/cloture-wizard-events.js

import { sendWsMessage } from './websocket-service.js';
import * as service from './cloture-wizard-service.js';
import * as ui from './cloture-wizard-ui.js';
import { parseLocaleFloat } from '../utils/formatters.js';

/**
 * Attache tous les écouteurs d'événements pour l'assistant de clôture.
 */
export function attachEventListeners(wizardElement, state, logic) {
    const wizardContent = wizardElement.querySelector('.wizard-content');
    const wizardNav = wizardElement.querySelector('.wizard-navigation');

    wizardNav.addEventListener('click', (e) => {
        if (e.target.closest('#wizard-next-btn')) logic.handleNextStep();
        if (e.target.closest('#wizard-prev-btn')) logic.handlePrevStep();
        if (e.target.closest('#wizard-cancel-btn')) logic.handleCancel();
        if (e.target.closest('#wizard-finish-btn')) logic.handleNextStep();
    });
    
    wizardElement.addEventListener('change', (e) => {
        if (e.target.id === 'final-confirmation-checkbox') {
            document.getElementById('wizard-finish-btn').disabled = !e.target.checked;
        }
    });

    wizardContent.addEventListener('click', (e) => {
        const target = e.target;
        const button = target.closest('button');

        if (button?.matches('.js-reopen-caisse')) {
            const caisseId = button.dataset.caisseId;
            if (confirm(`Rouvrir la caisse "${state.config.nomsCaisses[caisseId]}" ?`)) {
                sendWsMessage({ type: 'cloture_reopen', caisse_id: caisseId });
            }
        }
        if (button?.id === 'select-all-btn') {
            wizardContent.querySelectorAll('input[name="caisseSelection"]:not(:disabled)').forEach(cb => cb.checked = true);
            ui.updateWizardUI(state.wizardState);
        }
        if (button?.id === 'deselect-all-btn') {
            wizardContent.querySelectorAll('input[name="caisseSelection"]:checked').forEach(cb => cb.checked = false);
            ui.updateWizardUI(state.wizardState);
        }
        
        const mainTab = target.closest('.tab-link');
        if (mainTab) {
            wizardContent.querySelectorAll('.tab-link, .caisse-tab-content').forEach(el => el.classList.remove('active'));
            mainTab.classList.add('active');
            wizardContent.querySelector(`#${mainTab.dataset.tab}`)?.classList.add('active');
        }

        if (button?.matches('.validate-section-btn')) {
            const { caisseId, type } = button.dataset;
            state.wizardState.validationStatus[caisseId][type] = true;
            service.calculateAndDisplayAllEcarts(caisseId, state);
            ui.updateWizardUI(state.wizardState);
        }

        if (button?.matches('.add-cheque-btn')) {
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
        
        if (button?.matches('.delete-cheque-btn')) {
            const { caisseId, index } = button.dataset;
            state.chequesState[caisseId].splice(index, 1);
            document.getElementById(`cheque-list-${caisseId}`).innerHTML = ui.createChequeList(state.chequesState[caisseId], state.config, caisseId);
            service.calculateAndDisplayAllEcarts(caisseId, state);
        }

        if (button?.matches('.add-tpe-btn')) {
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

        if (button?.matches('.delete-tpe-btn')) {
            const { caisseId, tpeId, index } = button.dataset;
            state.tpeState[caisseId][tpeId].splice(index, 1);
            document.getElementById(`tpe-list-${tpeId}-${caisseId}`).innerHTML = ui.createTpeReleveList(state.tpeState[caisseId][tpeId], state.config, caisseId, tpeId);
            service.calculateAndDisplayAllEcarts(caisseId, state);
        }
    });

    wizardContent.addEventListener('input', (e) => {
        if (e.target.name === 'caisseSelection') {
            ui.updateWizardUI(state.wizardState);
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
