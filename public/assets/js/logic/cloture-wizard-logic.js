// Fichier : public/assets/js/logic/cloture-wizard-logic.js (Version avec Étape 2 séquentielle)

import { setActiveMessageHandler } from '../main.js';
import { sendWsMessage } from './websocket-service.js';
import * as service from './cloture-wizard-service.js';
import * as ui from './cloture-wizard-ui.js';
import { attachEventListeners } from './cloture-wizard-events.js';

// --- État global de l'assistant ---
const state = {
    config: {},
    wsResourceId: null,
    calculatorData: { caisse: {} },
    chequesState: {},
    tpeState: {},
    wizardState: {
        currentStep: 1,
        selectedCaisses: [],
        confirmedData: {},
        reconciliation: {
            activeCaisseIndex: 0,
            activeMethodIndex: 0,
            paymentMethods: ['especes', 'cb', 'cheques'],
            status: {}
        }
    }
};

function isReconciliationComplete() {
    return state.wizardState.selectedCaisses.every(caisseId => {
        const status = state.wizardState.reconciliation.status[caisseId];
        return status && status.especes && status.cb && status.cheques;
    });
}

function handleNextSubStep() {
    const { reconciliation, selectedCaisses } = state.wizardState;
    const currentCaisseId = selectedCaisses[reconciliation.activeCaisseIndex];
    const currentMethod = reconciliation.paymentMethods[reconciliation.activeMethodIndex];

    reconciliation.status[currentCaisseId][currentMethod] = true;

    if (reconciliation.activeMethodIndex < reconciliation.paymentMethods.length - 1) {
        reconciliation.activeMethodIndex++;
    } 
    else if (reconciliation.activeCaisseIndex < selectedCaisses.length - 1) {
        reconciliation.activeCaisseIndex++;
        reconciliation.activeMethodIndex = 0;
    }

    renderCurrentStep();
    ui.updateWizardUI(state.wizardState, isReconciliationComplete());
}

async function handleNextStep() {
    const currentBtn = document.getElementById('wizard-next-btn') || document.getElementById('wizard-finish-btn');
    if (currentBtn) {
        currentBtn.disabled = true;
        currentBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Chargement...';
    }

    try {
        if (state.wizardState.currentStep === 1) {
            const selected = document.querySelectorAll('input[name="caisseSelection"]:checked');
            state.wizardState.selectedCaisses = Array.from(selected).map(cb => cb.value);
            
            state.wizardState.reconciliation.status = {};
            state.wizardState.selectedCaisses.forEach(id => {
                state.wizardState.reconciliation.status[id] = { especes: false, cb: false, cheques: false };
            });

            state.wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_lock', caisse_id: id }));
            state.wizardState.currentStep = 2;
        } 
        else if (state.wizardState.currentStep === 2) {
            if (isReconciliationComplete()) {
                state.wizardState.currentStep = 3;
            } else {
                throw new Error("Toutes les sections ne sont pas validées.");
            }
        }
        else if (state.wizardState.currentStep === 3) {
            state.wizardState.currentStep = 4;
        }
        else if (state.wizardState.currentStep === 4) {
            const formData = service.prepareFinalFormData(state);
            const result = await service.submitFinalCloture(formData);
            
            alert(result.message || 'Clôture réussie ! La page va être rechargée.');
            sendWsMessage({ type: 'force_reload_all' });
            window.location.href = '/calculateur'; // Redirection de secours
            return;
        }
        
        renderCurrentStep();

    } catch (error) {
        alert(`Erreur: ${error.message}`);
        ui.updateWizardUI(state.wizardState, isReconciliationComplete());
    }
}

function handlePrevStep() {
    if (state.wizardState.currentStep === 2) {
        state.wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
        state.wizardState.reconciliation = {
            activeCaisseIndex: 0,
            activeMethodIndex: 0,
            paymentMethods: ['especes', 'cb', 'cheques'],
            status: {}
        };
    }
    state.wizardState.currentStep--;
    renderCurrentStep();
}

function handleCancel() {
    if (confirm("Voulez-vous vraiment annuler ? Les caisses verrouillées seront libérées.")) {
        state.wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
        window.location.href = '/calculateur';
    }
}

function renderCurrentStep() {
    const wizardContent = document.querySelector('.wizard-content');
    if (!wizardContent) return;

    ui.updateWizardUI(state.wizardState, isReconciliationComplete());

    switch (state.wizardState.currentStep) {
        case 1:
            ui.renderStep1_Selection(wizardContent, state.config, state.wsResourceId);
            break;
        case 2:
            ui.renderStep2_Reconciliation(wizardContent, state);
            break;
        case 3:
            ui.renderStep3_Summary(wizardContent, state);
            break;
        case 4:
            ui.renderStep4_Finalization(wizardContent, state);
            break;
    }
}

function handleWizardWebSocketMessage(data) {
    if (data.type === 'welcome') {
        state.wsResourceId = data.resourceId.toString();
    }
    if (data.type === 'cloture_locked_caisses' && state.wizardState.currentStep === 1) {
        ui.renderStep1_Selection(document.querySelector('.wizard-content'), state.config, state.wsResourceId);
    }
}

export async function initializeClotureWizard() {
    const wizardElement = document.getElementById('cloture-wizard-page');
    if (!wizardElement) return;

    try {
        const initialData = await service.fetchInitialData();
        state.config = initialData.config;
        state.calculatorData = initialData.calculatorData;
        state.chequesState = initialData.chequesState;
        state.tpeState = initialData.tpeState;

        setActiveMessageHandler(handleWizardWebSocketMessage);
        
        const logic = { handleNextStep, handlePrevStep, handleCancel, handleNextSubStep };
        attachEventListeners(wizardElement, state, logic);

        renderCurrentStep();
    } catch (error) {
        console.error("Erreur critique lors de l'initialisation de l'assistant :", error);
        document.querySelector('.wizard-content').innerHTML = `<p class="error">${error.message}</p>`;
    }
}
