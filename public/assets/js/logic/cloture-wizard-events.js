// Fichier : public/assets/js/logic/cloture-wizard-events.js (Corrigé)

import { sendWsMessage } from './websocket-service.js';
import * as service from './cloture-wizard-service.js';
import * as ui from './cloture-wizard-ui.js';
import { parseLocaleFloat } from '../utils/formatters.js';

/**
 * Attache tous les écouteurs d'événements pour l'assistant de clôture.
 * Utilise la délégation d'événements sur document.body pour gérer les éléments dynamiques des modales.
 * @param {object} state - L'état global de l'assistant.
 * @param {object} logic - Les fonctions de logique à appeler (handleNextStep, etc.).
 */
export function attachEventListeners(state, logic) {
    
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        const processModal = document.getElementById('cloture-process-modal');

        // Clic sur les boutons de navigation principaux de l'assistant
        if (target.closest('#wizard-next-btn')) logic.handleNextStep();
        if (target.closest('#wizard-prev-btn')) logic.handlePrevStep();
        if (target.closest('#wizard-cancel-btn')) logic.handleCancel();
        
        // Clic sur un bouton de réouverture dans la modale de sélection
        if (target.matches('.js-reopen-caisse')) {
            const caisseId = target.dataset.caisseId;
            if (confirm(`Rouvrir la caisse "${state.config.nomsCaisses[caisseId]}" ?`)) {
                sendWsMessage({ type: 'cloture_reopen', caisse_id: caisseId });
                ui.closeAllModals(); // Ferme la modale après l'action
            }
        }
        
        // Clic sur le bouton pour valider une sous-étape (ex: Espèces, CB...)
        if (target.matches('.validate-section-btn')) {
            logic.handleNextSubStep();
        }

        // --- Gestion des listes dynamiques (Chèques, TPE) ---
        if (target.closest('.add-cheque-btn')) {
            const { caisseId } = target.closest('.add-cheque-btn').dataset;
            const amountInput = processModal.querySelector(`#cheque-amount-${caisseId}`);
            const commentInput = processModal.querySelector(`#cheque-comment-${caisseId}`);
            const amount = parseLocaleFloat(amountInput.value);
            if (amount > 0) {
                state.chequesState[caisseId].push({ montant: amount, commentaire: commentInput.value });
                processModal.querySelector(`#cheque-list-${caisseId}`).innerHTML = ui.createChequeList(state.chequesState[caisseId], state.config, caisseId);
                service.calculateAndDisplayAllEcarts(caisseId, state);
                amountInput.value = ''; commentInput.value = ''; amountInput.focus();
            }
        }
        
        if (target.closest('.delete-cheque-btn')) {
            const { caisseId, index } = target.closest('.delete-cheque-btn').dataset;
            state.chequesState[caisseId].splice(index, 1);
            processModal.querySelector(`#cheque-list-${caisseId}`).innerHTML = ui.createChequeList(state.chequesState[caisseId], state.config, caisseId);
            service.calculateAndDisplayAllEcarts(caisseId, state);
        }

        if (target.closest('.add-tpe-btn')) {
            const { caisseId, tpeId } = target.closest('.add-tpe-btn').dataset;
            const amountInput = processModal.querySelector(`#tpe-amount-${tpeId}-${caisseId}`);
            const amount = parseLocaleFloat(amountInput.value);
            if (amount > 0) {
                if (!state.tpeState[caisseId][tpeId]) state.tpeState[caisseId][tpeId] = [];
                state.tpeState[caisseId][tpeId].push({ montant: amount, heure: new Date().toTimeString().slice(0, 5) });
                processModal.querySelector(`#tpe-list-${tpeId}-${caisseId}`).innerHTML = ui.createTpeReleveList(state.tpeState[caisseId][tpeId], state.config, caisseId, tpeId);
                service.calculateAndDisplayAllEcarts(caisseId, state);
                amountInput.value = ''; amountInput.focus();
            }
        }

        if (target.closest('.delete-tpe-btn')) {
            const { caisseId, tpeId, index } = target.closest('.delete-tpe-btn').dataset;
            state.tpeState[caisseId][tpeId].splice(index, 1);
            processModal.querySelector(`#tpe-list-${tpeId}-${caisseId}`).innerHTML = ui.createTpeReleveList(state.tpeState[caisseId][tpeId], state.config, caisseId, tpeId);
            service.calculateAndDisplayAllEcarts(caisseId, state);
        }
    });

    document.body.addEventListener('input', (e) => {
        const target = e.target;

        if (target.name === 'caisseSelection') {
            ui.updateWizardUI(state.wizardState, false);
        }

        if (state.wizardState.currentStep === 2 && target.matches('.reconciliation-input')) {
            const nameAttr = target.name;
            const caisseId = target.dataset.caisseId;
            if (!caisseId || !state.calculatorData.caisse[caisseId] || !nameAttr) return;

            const keys = nameAttr.match(/\[([^\]]+)\]/g).map(key => key.slice(1, -1));
            
            if (keys.length === 3 && keys[1] === 'denominations') {
                state.calculatorData.caisse[caisseId].denominations[keys[2]] = target.value;
            } else if (keys.length === 2) {
                state.calculatorData.caisse[caisseId][keys[1]] = target.value;
            }
            
            service.calculateAndDisplayAllEcarts(caisseId, state);
        }
    });
}
