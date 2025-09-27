// Fichier : public/assets/js/logic/calculator-logic.js (Complet et Final)

import * as service from './calculator-service.js';
import * as ui from './calculator-ui.js';
import { setActiveMessageHandler } from '../main.js';
import { initializeWebSocket, sendWsMessage } from './websocket-service.js';
import * as cloture from './cloture-logic.js';

// État global de la page du calculateur
let state = {
    config: {},
    wsResourceId: null,
    calculatorData: { caisse: {} },
    chequesState: {},
    tpeState: {},
    lockedCaisses: [],
    closedCaisses: [],
    isDirty: false
};

// --- FONCTIONS DE GESTION DU CYCLE DE VIE ---

async function refreshCalculatorData() {
    try {
        const initialData = await service.fetchInitialData();
        state.config = initialData.config;
        state.calculatorData = initialData.calculatorData;
        state.chequesState = initialData.chequesState;
        state.tpeState = initialData.tpeState;

        ui.renderCalculatorUI(document.getElementById('calculator-page'), state.config, state.chequesState, state.tpeState);
        ui.populateInitialData(state.calculatorData);
        service.calculateAll(state.config, state);
        
        attachEventListeners();
        
        updateClotureButtonState();

        sendWsMessage({ type: 'get_full_state' });

    } catch (error) {
        console.error("Erreur critique lors du rafraîchissement:", error);
        document.getElementById('main-content').innerHTML = `<div class="container error"><p>Impossible de rafraîchir les données : ${error.message}</p></div>`;
    }
}

async function handleAutosave() {
    if (!state.isDirty) return;
    const form = document.getElementById('caisse-form');
    if (!form) return;
    const statusElement = document.getElementById('autosave-status');
    if (statusElement) statusElement.textContent = 'Sauvegarde en cours...';
    try {
        const response = await fetch('index.php?route=calculateur/autosave', {
            method: 'POST',
            body: new FormData(form),
            keepalive: true
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        state.isDirty = false;
        if (statusElement) statusElement.textContent = 'Changements sauvegardés.';
    } catch (error) {
        if (statusElement) statusElement.textContent = 'Échec de la sauvegarde.';
        console.error("Erreur d'autosave :", error);
    }
}

// --- GESTION DES ÉVÉNEMENTS ---

function attachEventListeners() {
    const page = document.getElementById('calculator-page');
    if (page._eventListenersAttached) return;

    page.addEventListener('input', handlePageInput);
    page.addEventListener('click', handlePageClick);
    
    const form = document.getElementById('caisse-form');
    form.addEventListener('submit', (e) => { e.preventDefault(); handleAutosave(); });

    const clotureBtn = document.getElementById('cloture-btn');
    if (clotureBtn) {
        clotureBtn.addEventListener('click', () => {
            const activeTab = document.querySelector('.tab-link.active');
            if (activeTab) {
                const caisseId = activeTab.dataset.caisseId;
                const isClosed = state.closedCaisses.includes(caisseId);
                const isLockedByOther = state.lockedCaisses.some(c => c.caisse_id == caisseId && c.locked_by != state.wsResourceId);

                if (!isClosed && !isLockedByOther) {
                    cloture.startClotureCaisse(caisseId, state);
                } else {
                    alert("Cette caisse est déjà clôturée ou est en cours de modification par un autre utilisateur.");
                }
            }
        });
    }

    window.addEventListener('beforeunload', () => { if (state.isDirty) handleAutosave(); });
    
    page._eventListenersAttached = true;
}

function handlePageInput(e) {
    if (e.target.matches('input, textarea')) {
        state.isDirty = true;
        document.getElementById('autosave-status').textContent = 'Modifications non enregistrées.';
        service.calculateAll(state.config, state);
        if (e.target.matches('input[type="text"], input[type="number"], textarea')) {
             sendWsMessage({ type: 'update', id: e.target.id, value: e.target.value });
        }
    }
}

function handlePageClick(e) {
    const target = e.target;
    
    if (target.closest('.cloture-cancel-btn')) {
        cloture.cancelClotureCaisse(target.closest('.cloture-cancel-btn').dataset.caisseId, state);
        return;
    }
    if (target.closest('.cloture-validate-btn')) {
        cloture.validateClotureCaisse(target.closest('.cloture-validate-btn').dataset.caisseId, state);
        return;
    }
    if (target.closest('.cloture-reopen-btn')) {
        cloture.reopenCaisse(target.closest('.cloture-reopen-btn').dataset.caisseId, state);
        return;
    }
    if (target.closest('#finalize-day-btn')) {
        cloture.finalizeDay();
        return;
    }
    if (target.closest('#show-suggestions-btn')) {
        ui.renderWithdrawalSummaryModal(state);
        return;
    }
    const suggestionsModal = document.getElementById('suggestions-modal');
    if (suggestionsModal && (target.matches('.modal-close') || e.target === suggestionsModal)) {
        suggestionsModal.classList.remove('visible');
    }

    const handled = ui.handleCalculatorClickEvents(e, state);
    if(handled) {
        state.isDirty = true;
        service.calculateAll(state.config, state);
    }
}

// --- LOGIQUE WEBSOCKET ET MISE À JOUR DE L'UI ---

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'welcome':
            state.wsResourceId = data.resourceId.toString();
            updateClotureButtonState();
            sendWsMessage({ type: 'get_full_state' });
            break;
        case 'cloture_locked_caisses':
            state.lockedCaisses = data.caisses || [];
            state.closedCaisses = (data.closed_caisses || []).map(String);
            updateAllCaisseLocks();
            updateClotureButtonState();
            break;
        case 'full_form_state':
            ui.applyFullFormState(data, state);
            service.calculateAll(state.config, state);
            updateAllCaisseLocks(); // Mettre à jour l'UI de clôture après chargement de l'état
            break;
        case 'update':
            ui.applyLiveUpdate(data);
            service.calculateAll(state.config, state);
            break;
        case 'cheque_update': case 'tpe_update':
            ui.applyListUpdate(data, state);
            service.calculateAll(state.config, state);
            break;
        case 'force_reload_all':
             window.location.reload();
             break;
    }
}

function updateAllCaisseLocks() {
    Object.keys(state.config.nomsCaisses).forEach(caisseId => {
        const lockInfo = state.lockedCaisses.find(c => String(c.caisse_id) === String(caisseId));
        const isClosed = state.closedCaisses.includes(String(caisseId));
        
        let status = 'open';
        if (isClosed) status = 'closed';
        else if (lockInfo) status = String(lockInfo.locked_by) === String(state.wsResourceId) ? 'locked_by_me' : 'locked_by_other';
        
        ui.updateCaisseLockState(caisseId, status, state);
    });

    const allCaisseIds = Object.keys(state.config.nomsCaisses || {});
    const allClosed = allCaisseIds.length > 0 && allCaisseIds.every(id => state.closedCaisses.includes(id));
    
    if (allClosed) {
        ui.showFinalSummaryBanner(state);
    } else {
        const container = document.getElementById('cloture-final-summary-banner-container');
        if (container) container.innerHTML = '';
    }
}

function updateClotureButtonState() {
    const clotureBtn = document.getElementById('cloture-btn');
    if (!clotureBtn) return;
    
    const allCaisseIds = Object.keys(state.config.nomsCaisses || {});
    const allClosed = allCaisseIds.length > 0 && allCaisseIds.every(id => state.closedCaisses.includes(id));

    clotureBtn.disabled = !state.wsResourceId || allClosed;

    if (allClosed) {
        clotureBtn.innerHTML = `<i class="fa-solid fa-check-circle"></i> Journée Terminée`;
    } else {
        clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture Caisse Active';
    }
}

// --- POINT D'ENTRÉE ---

export async function initializeCalculator() {
    try {
        await refreshCalculatorData();
        setActiveMessageHandler(handleWebSocketMessage);
        await initializeWebSocket(handleWebSocketMessage);
    } catch (error) {
        console.error("Erreur critique d'initialisation:", error.stack);
        document.getElementById('main-content').innerHTML = `<div class="container error"><p>Impossible de charger le calculateur : ${error.message}</p></div>`;
    }
}
