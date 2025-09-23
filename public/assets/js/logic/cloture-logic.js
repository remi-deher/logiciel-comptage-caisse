// Fichier : public/assets/js/logic/cloture-logic.js (Version Finale Complète)

import { sendWsMessage } from './websocket-service.js';
import * as service from './cloture-wizard-service.js';
import * as ui from './cloture-wizard-ui.js';
import { attachEventListeners as attachWizardEventListeners } from './cloture-wizard-events.js';

// Référence à l'état global de l'application (fourni à l'initialisation)
let globalState = {};

/**
 * Vérifie si toutes les sections de toutes les caisses sélectionnées ont été validées.
 * @returns {boolean}
 */
function isReconciliationComplete() {
    const { wizardState } = globalState;
    if (!wizardState.selectedCaisses || wizardState.selectedCaisses.length === 0) return false;

    return wizardState.selectedCaisses.every(caisseId => {
        const status = wizardState.reconciliation.status[caisseId];
        return status && status.especes && status.cb && status.cheques;
    });
}

/**
 * Gère la navigation vers l'étape suivante de l'assistant.
 */
async function handleNextStep() {
    const { wizardState } = globalState;
    ui.setNavigationLoading(true); // Active le spinner

    try {
        if (wizardState.currentStep === 1) {
            const selected = document.querySelectorAll('input[name="caisseSelection"]:checked');
            wizardState.selectedCaisses = Array.from(selected).map(cb => cb.value);

            if (wizardState.selectedCaisses.length > 0) {
                wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_lock', caisse_id: id }));
                wizardState.currentStep = 2;
                ui.renderStep(2, globalState, true);
            } else {
                alert("Veuillez sélectionner au moins une caisse pour démarrer la clôture.");
                ui.setNavigationLoading(false); // Désactive le spinner si erreur
            }
        } else if (wizardState.currentStep === 2) {
            if (isReconciliationComplete()) {
                wizardState.currentStep = 3;
                ui.renderStep(3, globalState);
            }
        } else if (wizardState.currentStep === 3) {
            const formData = service.prepareFinalFormData(globalState);
            await service.submitFinalCloture(formData);
            
            const clotureState = await service.fetchClotureState();
            const allCaisseIds = Object.keys(globalState.config.nomsCaisses);
            const closedCaisseIds = (clotureState.closed_caisses || []).map(String);

            if (allCaisseIds.every(id => closedCaisseIds.includes(id))) {
                wizardState.currentStep = 4;
                ui.renderStep(4, globalState);
            } else {
                alert('Les caisses sélectionnées ont été clôturées. La clôture générale sera possible une fois toutes les caisses fermées.');
                sendWsMessage({ type: 'force_reload_all' });
                ui.closeAllModals();
            }
        } else if (wizardState.currentStep === 4) {
            ui.showFinalConfirmModal(async () => {
                const result = await service.submitClotureGenerale();
                alert(result.message);
                sendWsMessage({ type: 'force_reload_all' });
                ui.closeAllModals();
            });
        }
    } catch (error) {
        alert(`Erreur : ${error.message}`);
    } finally {
        if(!(wizardState.currentStep === 2 && wizardState.selectedCaisses.length > 0)) {
            ui.setNavigationLoading(false);
        }
    }
}

/**
 * Gère le retour à l'étape précédente.
 */
function handlePrevStep() {
    const { wizardState } = globalState;
    if (wizardState.currentStep > 1) {
        if (wizardState.currentStep === 2) {
            wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
        }
        wizardState.currentStep--;
        ui.renderStep(wizardState.currentStep, globalState);
    }
}

/**
 * Gère l'annulation complète du processus de clôture.
 */
function handleCancel() {
    const { wizardState } = globalState;
    if (confirm("Voulez-vous annuler ? Les caisses verrouillées seront libérées.")) {
        if (wizardState && wizardState.selectedCaisses) {
            wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
        }
        ui.closeAllModals();
    }
}

/**
 * Gère la validation d'une sous-étape de la réconciliation.
 */
function handleNextSubStep() {
    const { reconciliation, selectedCaisses } = globalState.wizardState;
    const currentCaisseId = selectedCaisses[reconciliation.activeCaisseIndex];
    const currentMethod = reconciliation.paymentMethods[reconciliation.activeMethodIndex];

    reconciliation.status[currentCaisseId][currentMethod] = true;

    if (reconciliation.activeMethodIndex < reconciliation.paymentMethods.length - 1) {
        reconciliation.activeMethodIndex++;
    } else if (reconciliation.activeCaisseIndex < selectedCaisses.length - 1) {
        reconciliation.activeCaisseIndex++;
        reconciliation.activeMethodIndex = 0;
    }
    
    ui.renderStep(2, globalState);
}

/**
 * Gère les messages WebSocket pertinents pour l'assistant.
 * @returns {boolean} - True si le message a été géré, sinon false.
 */
export function handleWebSocketMessage(data, mainState) {
    globalState = mainState;
    const { wizardState } = globalState;
    if (!wizardState) return false;

    if (data.type === 'cloture_locked_caisses' && wizardState.currentStep === 2) {
        const lockedIds = (data.caisses || []).map(c => c.caisse_id.toString());
        const allSelectedAreLocked = wizardState.selectedCaisses.every(id => lockedIds.includes(id));

        if (allSelectedAreLocked) {
            console.log("Confirmation de verrouillage reçue. Affichage de la réconciliation.");
            wizardState.reconciliation.status = {};
            wizardState.selectedCaisses.forEach(id => {
                wizardState.reconciliation.status[id] = { especes: false, cb: false, cheques: false };
            });
            ui.renderStep(2, globalState, false);
        }
        return true;
    }
    
    return false;
}

/**
 * Met à jour l'état du bouton de clôture principal.
 */
export function updateClotureButtonState(isReady, mainState) {
    const clotureBtn = document.getElementById('cloture-btn');
    if (!clotureBtn) return;
    
    clotureBtn.disabled = !isReady;

    const allCaisseIds = Object.keys(mainState.config.nomsCaisses || {});
    const closedCaisses = mainState.closedCaisses || [];
    const allClosed = allCaisseIds.length > 0 && allCaisseIds.every(id => closedCaisses.includes(id));

    if (allClosed) {
        clotureBtn.classList.add('mode-finalisation');
        clotureBtn.innerHTML = `<i class="fa-solid fa-flag-checkered"></i> Finaliser`;
    } else {
        clotureBtn.classList.remove('mode-finalisation');
        clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture';
    }
}

/**
 * Point d'entrée pour initialiser toute la logique de clôture.
 */
export function initializeClotureModals(mainState) {
    globalState = mainState;
    
    const clotureBtn = document.getElementById('cloture-btn');
    clotureBtn.addEventListener('click', () => {
        globalState.wizardState = {
            currentStep: 1, selectedCaisses: [], confirmedData: {},
            reconciliation: {
                activeCaisseIndex: 0, activeMethodIndex: 0,
                paymentMethods: ['especes', 'cb', 'cheques'], status: {}
            }
        };
        ui.renderStep(1, globalState);
    });

    const logic = { handleNextStep, handlePrevStep, handleCancel, handleNextSubStep };
    attachWizardEventListeners(globalState, logic);
}
