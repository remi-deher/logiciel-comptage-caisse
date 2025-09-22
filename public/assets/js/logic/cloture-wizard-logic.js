// Fichier : public/assets/js/logic/cloture-wizard-logic.js (Corrigé avec attente de confirmation)

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
        currentBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Traitement...';
    }

    try {
        if (state.wizardState.currentStep === 1) {
            // --- DÉBUT DE LA CORRECTION ---
            const selected = document.querySelectorAll('input[name="caisseSelection"]:checked');
            state.wizardState.selectedCaisses = Array.from(selected).map(cb => cb.value);

            const allCheckboxes = document.querySelectorAll('input[name="caisseSelection"]');
            const allDisabled = allCheckboxes.length > 0 && Array.from(allCheckboxes).every(cb => cb.disabled);

            if (state.wizardState.selectedCaisses.length > 0) {
                // On envoie le message de verrouillage mais on n'avance pas d'étape ici.
                // Le gestionnaire WebSocket s'en chargera à la réception de la confirmation.
                state.wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_lock', caisse_id: id }));
                // On affiche un message d'attente à l'utilisateur
                const wizardContent = document.querySelector('.wizard-content');
                if(wizardContent) {
                    wizardContent.innerHTML = '<p style="text-align:center; padding: 40px 0;"><i class="fa-solid fa-lock fa-2x"></i><br><br>Verrouillage des caisses en cours...</p>';
                }
            } else if (allDisabled) {
                // Si toutes les caisses sont déjà clôturées, on saute à la fin
                state.wizardState.selectedCaisses = Object.keys(state.config.nomsCaisses);
                state.wizardState.currentStep = 4;
                renderCurrentStep();
            } else {
                // L'utilisateur n'a rien coché
                ui.updateWizardUI(state.wizardState, isReconciliationComplete()); 
                return;
            }
            // --- FIN DE LA CORRECTION ---
            
        } else if (state.wizardState.currentStep === 2) {
            if (isReconciliationComplete()) {
                state.wizardState.currentStep = 3;
            } else {
                throw new Error("Toutes les sections ne sont pas validées.");
            }
        }
        else if (state.wizardState.currentStep === 3) {
            const formData = service.prepareFinalFormData(state);
            await service.submitFinalCloture(formData);

            const currentClotureState = await service.fetchClotureState();
            const allCaisseIds = Object.keys(state.config.nomsCaisses);
            const closedCaisseIds = (currentClotureState.closed_caisses || []).map(String);

            if (allCaisseIds.length > 0 && allCaisseIds.every(id => closedCaisseIds.includes(id))) {
                state.wizardState.currentStep = 4;
            } else {
                alert('Les caisses sélectionnées ont été clôturées. La clôture générale sera possible lorsque toutes les autres caisses seront également fermées.');
                sendWsMessage({ type: 'force_reload_all' });
                window.location.href = '/calculateur';
                return;
            }
        }
        else if (state.wizardState.currentStep === 4) {
            const finalResult = await service.submitClotureGenerale();
            alert(finalResult.message || 'Clôture générale réussie ! La page va être rechargée.');
            sendWsMessage({ type: 'force_reload_all' });
            window.location.href = '/calculateur';
            return;
        }
        
        // On ne render que si on n'a pas redirigé
        if (state.wizardState.currentStep !== 1) {
            renderCurrentStep();
        }

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
    // --- DÉBUT DE LA CORRECTION ---
    if (data.type === 'cloture_locked_caisses') {
        // Si on est à l'étape 1 et qu'on a sélectionné des caisses, on attend la confirmation de verrouillage
        if (state.wizardState.currentStep === 1 && state.wizardState.selectedCaisses.length > 0) {
            const lockedCaisseIds = (data.caisses || []).map(c => c.caisse_id.toString());
            const allSelectedAreNowLocked = state.wizardState.selectedCaisses.every(id => lockedCaisseIds.includes(id));

            if (allSelectedAreNowLocked) {
                console.log("Verrouillage confirmé par le serveur. Passage à l'étape 2.");
                state.wizardState.reconciliation.status = {};
                state.wizardState.selectedCaisses.forEach(id => {
                    state.wizardState.reconciliation.status[id] = { especes: false, cb: false, cheques: false };
                });
                state.wizardState.currentStep = 2;
                renderCurrentStep();
            }
        } 
        // Sinon, si on est à l'étape 1 sans attendre, on rafraîchit simplement la vue
        else if (state.wizardState.currentStep === 1) {
            ui.renderStep1_Selection(document.querySelector('.wizard-content'), state.config, state.wsResourceId);
        }
    }
    // --- FIN DE LA CORRECTION ---
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
