// Fichier : public/assets/js/logic/cloture-logic.js (Version Finale Complète et Corrigée)

import { sendWsMessage } from './websocket-service.js';
import * as service from './cloture-wizard-service.js';
import * as ui from './cloture-wizard-ui.js';
import { attachEventListeners as attachWizardEventListeners } from './cloture-wizard-events.js';

/**
 * Gère le clic sur le bouton "Valider la Caisse".
 * Ouvre la modale de suggestion de retrait pour une seule caisse.
 */
export function handleValidateCaisse(caisseId, state) {
    state.wizardState = {
        currentStep: 3,
        selectedCaisses: [caisseId],
        confirmedData: {},
        reconciliation: { status: {} }
    };
    ui.renderStep(3, state);
}

/**
 * Détermine l'action à effectuer lors du clic sur le bouton de clôture principal.
 * Reçoit l'état le plus récent en paramètre.
 */
export async function handleClotureAction(state) {
    const allCaisseIds = Object.keys(state.config.nomsCaisses || {});
    const closedCaisses = state.closedCaisses || [];
    const allClosed = allCaisseIds.length > 0 && allCaisseIds.every(id => closedCaisses.includes(id));

    if (allClosed) {
        ui.showFinalSummaryBanner(state);
    } else {
        state.wizardState = {
            currentStep: 1,
            selectedCaisses: [],
        };
        ui.renderStep(1, state);
    }
}

/**
 * Gère la navigation vers l'étape suivante dans les modales.
 */
function handleNextStep(state) {
    const { wizardState } = state;

    if (wizardState.currentStep === 1) {
        const selected = document.querySelectorAll('input[name="caisseSelection"]:checked');
        wizardState.selectedCaisses = Array.from(selected).map(cb => cb.value);
        if (wizardState.selectedCaisses.length > 0) {
            ui.setNavigationLoading(true);
            wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_lock', caisse_id: id }));
        }
    } else if (wizardState.currentStep === 3) {
        ui.setNavigationLoading(true);
        const formData = service.prepareFinalFormData(state);
        service.submitFinalCloture(formData).then(() => {
            sendWsMessage({ type: 'state_changed_refresh_ui' });
            ui.closeAllModals();
        }).finally(() => {
            ui.setNavigationLoading(false);
        });
    }
}

/**
 * Gère l'annulation depuis une modale.
 */
function handleCancel(state) {
    const { wizardState } = state;
    if (wizardState && wizardState.selectedCaisses) {
        wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
    }
    ui.closeAllModals();
}

/**
 * Gère les messages WebSocket pertinents pour la clôture.
 */
export function handleWebSocketMessage(data, state) {
    if (!state.wizardState) return false;

    if (data.type === 'cloture_locked_caisses') {
        const selectionModal = document.getElementById('cloture-selection-modal');
        if (selectionModal && selectionModal.classList.contains('visible')) {
            const lockedCaisseIds = (data.caisses || []).map(c => c.caisse_id.toString());
            const allSelectedAreNowLocked = state.wizardState.selectedCaisses.every(id => lockedCaisseIds.includes(id));

            if (state.wizardState.selectedCaisses.length > 0 && allSelectedAreNowLocked) {
                ui.closeAllModals();
                return false;
            } else {
                ui.renderStep(1, state);
                ui.setNavigationLoading(false);
                return true;
            }
        }
    }
    return false;
}

/**
 * Met à jour l'état du bouton de clôture principal dans la barre de navigation.
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
 * Point d'entrée pour attacher les écouteurs d'événements des modales.
 */
export function initializeClotureEventListeners(state) {
    const logic = {
        handleNextStep: () => handleNextStep(state),
        handleCancel: () => handleCancel(state)
    };
    attachWizardEventListeners(state, logic);
}
