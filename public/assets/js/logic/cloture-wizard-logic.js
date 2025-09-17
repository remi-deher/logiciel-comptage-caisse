// Fichier : public/assets/js/logic/cloture-wizard-logic.js (Corrigé avec l'envoi des données de retrait)

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
            // --- DÉBUT DE LA CORRECTION ---
            const formData = new FormData();
            
            // On ajoute les informations générales
            formData.append('nom_comptage', state.calculatorData.nom_comptage);
            formData.append('explication', state.calculatorData.explication);

            // On ajoute les caisses à clôturer
            state.wizardState.selectedCaisses.forEach(caisseId => {
                formData.append('caisses_a_cloturer[]', caisseId);

                // On ajoute toutes les données de chaque caisse
                const caisseData = state.calculatorData.caisse[caisseId] || {};
                for (const key in caisseData) {
                    if (key === 'denominations' && typeof caisseData[key] === 'object') {
                        for (const denom in caisseData[key]) {
                            formData.append(`caisse[${caisseId}][denominations][${denom}]`, caisseData[key][denom]);
                        }
                    } else if (key === 'cheques' && Array.isArray(caisseData[key])) {
                        caisseData[key].forEach((cheque, index) => {
                            formData.append(`caisse[${caisseId}][cheques][${index}][montant]`, cheque.montant);
                            formData.append(`caisse[${caisseId}][cheques][${index}][commentaire]`, cheque.commentaire);
                        });
                    } else if (key === 'tpe' && typeof caisseData[key] === 'object') {
                         for (const terminalId in caisseData[key]) {
                            (caisseData[key][terminalId] || []).forEach((releve, index) => {
                                formData.append(`caisse[${caisseId}][tpe][${terminalId}][${index}][montant]`, releve.montant);
                                formData.append(`caisse[${caisseId}][tpe][${terminalId}][${index}][heure]`, releve.heure);
                            });
                         }
                    } else {
                        formData.append(`caisse[${caisseId}][${key}]`, caisseData[key]);
                    }
                }
                
                // On ajoute les données de retrait pour cette caisse
                const withdrawalData = state.wizardState.confirmedData[caisseId]?.withdrawals || [];
                withdrawalData.forEach(item => {
                    formData.append(`retraits[${caisseId}][${item.name}]`, item.qty);
                });
            });

            await service.submitFinalCloture(formData);
            // --- FIN DE LA CORRECTION ---
            
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

        const logic = { handleNextStep, handlePrevStep, handleCancel };
        attachEventListeners(wizardElement, state, logic);

        renderCurrentStep();
    } catch (error) {
        console.error("Erreur critique lors de l'initialisation de l'assistant :", error);
        document.querySelector('.wizard-content').innerHTML = `<p class="error">${error.message}</p>`;
        document.getElementById('wizard-next-btn').disabled = true;
    }
}
