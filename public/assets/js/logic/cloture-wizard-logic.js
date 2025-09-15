// Fichier : public/assets/js/logic/cloture-wizard-logic.js (Refactorisé)

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
    }
};

// --- Logique de navigation ---

/** Gère le passage à l'étape suivante */
async function handleNextStep() {
    const nextBtn = document.getElementById('wizard-next-btn');
    nextBtn.disabled = true;

    if (state.wizardState.currentStep === 1) {
        const selected = document.querySelectorAll('input[name="caisseSelection"]:checked');
        state.wizardState.selectedCaisses = Array.from(selected).map(cb => cb.value);
        state.wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_lock', caisse_id: id }));
        state.wizardState.currentStep = 2;
        renderCurrentStep();
    } 
    else if (state.wizardState.currentStep === 2) {
        state.wizardState.currentStep = 3;
        renderCurrentStep();
    }
    else if (state.wizardState.currentStep === 3) {
        state.wizardState.currentStep = 4;
        renderCurrentStep();
    }
    else if (state.wizardState.currentStep === 4) {
        try {
            const formData = new FormData();
            // ... (logique pour construire le FormData à partir de 'state')
            await service.submitFinalCloture(formData);
            
            alert('Clôture réussie ! La page va être rechargée.');
            sendWsMessage({ type: 'force_reload_all' });
            state.wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_caisse_confirmed', caisse_id: id }));
            window.location.href = '/calculateur';
        } catch (error) {
            alert(`Erreur: ${error.message}`);
            nextBtn.disabled = false;
        }
    }
}

/** Gère le retour à l'étape précédente */
function handlePrevStep() {
    if (state.wizardState.currentStep === 2) {
        state.wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
        state.wizardState.selectedCaisses = [];
    }
    state.wizardState.currentStep--;
    renderCurrentStep();
}

/** Gère l'annulation de l'assistant */
function handleCancel() {
    if (confirm("Voulez-vous vraiment annuler ? Les caisses verrouillées seront libérées.")) {
        state.wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
        window.location.href = '/calculateur';
    }
}

/** Gère le rendu de l'étape actuelle */
function renderCurrentStep() {
    const wizardContent = document.querySelector('.wizard-content');
    if (!wizardContent) return;

    ui.updateWizardUI(state.wizardState);

    switch (state.wizardState.currentStep) {
        case 1:
            ui.renderStep1_Selection(wizardContent, state.config, state.wsResourceId);
            break;
        case 2:
            ui.renderStep2_Counting(wizardContent, state.wizardState, state.calculatorData, state.tpeState, state.chequesState, state.config);
            break;
        case 3:
            ui.renderStep3_Summary(wizardContent, state.wizardState, state.calculatorData, state.config);
            break;
        case 4:
            ui.renderStep4_Finalization(wizardContent, state.wizardState, state.calculatorData, state.tpeState, state.chequesState, state.config);
            break;
    }
}

// --- Gestionnaire WebSocket ---

function handleWizardWebSocketMessage(data) {
    if (data.type === 'welcome') {
        state.wsResourceId = data.resourceId.toString();
    }
    
    // Si on est à l'étape 1, on rafraîchit la liste si l'état des caisses change
    if (data.type === 'cloture_locked_caisses' && state.wizardState.currentStep === 1) {
        ui.renderStep1_Selection(document.querySelector('.wizard-content'), state.config, state.wsResourceId);
    }
    // ... Gérer d'autres messages si nécessaire
}

// --- Point d'entrée ---

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
        sendWsMessage({ type: 'get_full_state' }); // Demande l'état live

        // Logique de navigation passée en paramètre aux écouteurs
        const logic = { handleNextStep, handlePrevStep, handleCancel };
        attachEventListeners(wizardElement, state, logic);

        renderCurrentStep();
    } catch (error) {
        console.error("Erreur critique lors de l'initialisation de l'assistant :", error);
        document.querySelector('.wizard-content').innerHTML = `<p class="error">${error.message}</p>`;
        document.getElementById('wizard-next-btn').disabled = true;
    }
}
