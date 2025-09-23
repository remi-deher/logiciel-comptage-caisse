// Fichier : public/assets/js/logic/cloture-logic.js (Version Finale Complète et Corrigée)

import { sendWsMessage } from './websocket-service.js';
import * as service from './cloture-wizard-service.js';
import * as ui from './cloture-wizard-ui.js';
import { attachEventListeners as attachWizardEventListeners } from './cloture-wizard-events.js';

// Référence à l'état global de l'application (fourni à l'initialisation)
let globalState = {};

/**
 * Gère le clic sur le bouton "Valider la Caisse".
 * Ouvre la modale de suggestion de retrait pour une seule caisse.
 * @param {string} caisseId - L'ID de la caisse à valider.
 * @param {object} state - L'état global de l'application.
 */
export function handleValidateCaisse(caisseId, state) {
    globalState = state;
    globalState.wizardState = {
        currentStep: 3, // On passe directement à l'étape des retraits
        selectedCaisses: [caisseId], // L'action ne concerne que cette caisse
        confirmedData: {},
        reconciliation: { status: {} } // Initialisation pour éviter les erreurs
    };
    // Affiche la modale des retraits (étape 3 de l'ancien assistant)
    ui.renderStep(3, globalState);
}


/**
 * Détermine l'action à effectuer lors du clic sur le bouton de clôture principal.
 */
async function handleClotureAction() {
    const allCaisseIds = Object.keys(globalState.config.nomsCaisses || {});
    const closedCaisses = globalState.closedCaisses || [];
    const allClosed = allCaisseIds.length > 0 && allCaisseIds.every(id => closedCaisses.includes(id));

    if (allClosed) {
        // Si tout est fermé, on affiche la bannière finale
        ui.showFinalSummaryBanner(globalState);
    } else {
        // Sinon, on ouvre la modale de sélection de caisse
        globalState.wizardState = {
            currentStep: 1,
            selectedCaisses: [],
        };
        ui.renderStep(1, globalState);
    }
}

/**
 * Gère la navigation vers l'étape suivante dans les modales.
 */
function handleNextStep() {
    const { wizardState } = globalState;

    if (wizardState.currentStep === 1) { // Après sélection des caisses
        const selected = document.querySelectorAll('input[name="caisseSelection"]:checked');
        wizardState.selectedCaisses = Array.from(selected).map(cb => cb.value);
        if (wizardState.selectedCaisses.length > 0) {
            wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_lock', caisse_id: id }));
            ui.closeAllModals();
        }
    } else if (wizardState.currentStep === 3) { // Après confirmation des retraits
        const formData = service.prepareFinalFormData(globalState);
        service.submitFinalCloture(formData).then(() => {
            sendWsMessage({ type: 'force_reload_all' });
            ui.closeAllModals();
        });
    }
}

/**
 * Gère l'annulation depuis une modale.
 */
function handleCancel() {
    const { wizardState } = globalState;
    if (wizardState && wizardState.selectedCaisses) {
        wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
    }
    ui.closeAllModals();
}

/**
 * Gère les messages WebSocket pertinents pour la clôture.
 */
export function handleWebSocketMessage(data, mainState) {
    globalState = mainState;
    if (!globalState.wizardState) return false;

    // Rafraîchit la modale de sélection si elle est ouverte
    if (data.type === 'cloture_locked_caisses') {
        const selectionModal = document.getElementById('cloture-selection-modal');
        if (selectionModal && selectionModal.classList.contains('visible')) {
            ui.renderStep(1, globalState);
        }
        return true;
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
 * Point d'entrée pour initialiser toute la logique de clôture.
 */
export function initializeClotureModals(mainState) {
    globalState = mainState;
    
    const clotureBtn = document.getElementById('cloture-btn');
    clotureBtn.addEventListener('click', handleClotureAction);

    const logic = { handleNextStep, handleCancel };
    attachWizardEventListeners(globalState, logic);
}
