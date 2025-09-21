// Fichier : public/assets/js/logic/cloture-wizard-logic.js

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
        // NOUVEAU : Suivi de la validation pour l'étape 2
        validationStatus: {} // ex: { caisseId: { especes: false, cb: false, cheques: false }}
    }
};

/**
 * Vérifie si toutes les sections de toutes les caisses sélectionnées sont validées à l'étape 2.
 */
function checkAllSectionsValidated() {
    return state.wizardState.selectedCaisses.every(caisseId => {
        const status = state.wizardState.validationStatus[caisseId];
        return status && status.especes && status.cb && status.cheques;
    });
}


/** Gère le passage à l'étape suivante */
async function handleNextStep() {
    const nextBtn = document.getElementById('wizard-next-btn');
    nextBtn.disabled = true;
    nextBtn.innerHTML = 'Chargement...';

    if (state.wizardState.currentStep === 1) {
        const selected = document.querySelectorAll('input[name="caisseSelection"]:checked');
        state.wizardState.selectedCaisses = Array.from(selected).map(cb => cb.value);
        
        // Initialiser le statut de validation
        state.wizardState.validationStatus = {};
        state.wizardState.selectedCaisses.forEach(id => {
            state.wizardState.validationStatus[id] = { especes: false, cb: false, cheques: false };
        });

        state.wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_lock', caisse_id: id }));
        state.wizardState.currentStep = 2;
        renderCurrentStep();
    } 
    else if (state.wizardState.currentStep === 2) {
        if (checkAllSectionsValidated()) {
            state.wizardState.currentStep = 3;
            renderCurrentStep();
        } else {
            alert("Veuillez valider toutes les sections (Espèces, CB, Chèques) pour chaque caisse avant de continuer.");
            nextBtn.disabled = false;
        }
    }
    else if (state.wizardState.currentStep === 3) {
        state.wizardState.currentStep = 4;
        renderCurrentStep();
    }
    else if (state.wizardState.currentStep === 4) {
        try {
            const formData = service.prepareFinalFormData(state);
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
    
    // Réinitialise le texte du bouton après l'action
    ui.updateWizardUI(state.wizardState);
}

/** Gère le retour à l'étape précédente */
function handlePrevStep() {
    if (state.wizardState.currentStep === 2) {
        state.wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
        state.wizardState.selectedCaisses = [];
        state.wizardState.validationStatus = {};
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

// --- Gestionnaire WebSocket ---

function handleWizardWebSocketMessage(data) {
    if (data.type === 'welcome') {
        state.wsResourceId = data.resourceId.toString();
    }
    
    if (data.type === 'cloture_locked_caisses' && state.wizardState.currentStep === 1) {
        ui.renderStep1_Selection(document.querySelector('.wizard-content'), state.config, state.wsResourceId);
    }
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
        sendWsMessage({ type: 'get_full_state' });

        const logic = { handleNextStep, handlePrevStep, handleCancel, checkAllSectionsValidated };
        attachEventListeners(wizardElement, state, logic);

        renderCurrentStep();
    } catch (error) {
        console.error("Erreur critique lors de l'initialisation de l'assistant :", error);
        document.querySelector('.wizard-content').innerHTML = `<p class="error">${error.message}</p>`;
        document.getElementById('wizard-next-btn').disabled = true;
    }
}
