// Fichier : public/assets/js/logic/calculator-logic.js (Version Finale Complète et Corrigée)

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

async function refreshCalculatorData() {
    console.log("Rafraîchissement des données du calculateur...");
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
        
        sendWsMessage({ type: 'get_full_state' });

    } catch (error) {
        console.error("Erreur lors du rafraîchissement des données:", error);
        document.getElementById('main-content').innerHTML = `<div class="container error"><p>Impossible de rafraîchir les données : ${error.message}</p></div>`;
    }
}

async function handleAutosave() {
    if (!state.isDirty) return;
    const form = document.getElementById('caisse-form');
    if (!form) return;
    const statusElement = document.getElementById('autosave-status');
    if (statusElement) statusElement.textContent = 'Sauvegarde...';
    try {
        const response = await fetch('index.php?route=calculateur/autosave', {
            method: 'POST',
            body: new FormData(form),
            keepalive: true
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        state.isDirty = false;
        if (statusElement) statusElement.textContent = 'Sauvegardé.';
    } catch (error) {
        if (statusElement) statusElement.textContent = 'Erreur.';
        console.error("Erreur d'autosave :", error);
    }
}

function updateAllCaisseLocks() {
    Object.keys(state.config.nomsCaisses).forEach(caisseId => {
        const lockInfo = state.lockedCaisses.find(c => String(c.caisse_id) === String(caisseId));
        const isClosed = state.closedCaisses.includes(String(caisseId));
        
        let status = 'open';
        if (isClosed) {
            status = 'closed';
        } else if (lockInfo) {
            status = String(lockInfo.locked_by) === String(state.wsResourceId) ? 'locked_by_me' : 'locked_by_other';
        }
        
        ui.updateCaisseLockState(caisseId, status, state);
    });
}

function handleWebSocketMessage(data) {
    const wasHandledByCloture = cloture.handleWebSocketMessage(data, state);
    if (wasHandledByCloture) return;

    switch (data.type) {
        case 'welcome':
            state.wsResourceId = data.resourceId.toString();
            cloture.updateClotureButtonState(true, state);
            break;
        case 'cloture_locked_caisses':
            state.lockedCaisses = data.caisses || [];
            state.closedCaisses = (data.closed_caisses || []).map(String);
            cloture.updateClotureButtonState(true, state);
            updateAllCaisseLocks();

            // --- CORRECTION CLÉ : Affichage proactif de la bannière ---
            const allCaisseIds = Object.keys(state.config.nomsCaisses || {});
            const allClosed = allCaisseIds.length > 0 && allCaisseIds.every(id => state.closedCaisses.includes(id));
            if (allClosed) {
                ui.showFinalSummaryBanner(state);
            } else {
                const container = document.getElementById('cloture-final-summary-banner-container');
                if (container) container.innerHTML = ''; // Cache la bannière si une caisse est rouverte
            }
            break;
        case 'full_form_state':
            ui.applyFullFormState(data, state);
            service.calculateAll(state.config, state);
            break;
        case 'update':
            ui.applyLiveUpdate(data);
            service.calculateAll(state.config, state);
            break;
        case 'cheque_update':
        case 'tpe_update':
            ui.applyListUpdate(data, state);
            service.calculateAll(state.config, state);
            break;
        case 'state_changed_refresh_ui':
            refreshCalculatorData();
            break;
    }
}

function attachEventListeners() {
    const page = document.getElementById('calculator-page');
    if (!page) return;

    page.removeEventListener('click', handlePageClick);
    page.removeEventListener('input', handlePageInput);

    window.addEventListener('beforeunload', () => { if (state.isDirty) handleAutosave(); });

    page.addEventListener('input', handlePageInput);
    page.addEventListener('click', handlePageClick);

    const form = document.getElementById('caisse-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleAutosave();
    });
}

function handlePageInput(e) {
    if (e.target.matches('input, textarea')) {
        state.isDirty = true;
        document.getElementById('autosave-status').textContent = 'Modifications non enregistrées.';
        service.calculateAll(state.config, state);
        if (e.target.matches('input[type="text"], input[type="number"]')) {
             sendWsMessage({ type: 'update', id: e.target.id, value: e.target.value });
        }
    }
}

function handlePageClick(e) {
    const validateBtn = e.target.closest('.js-validate-caisse-btn');
    if (validateBtn) {
        e.preventDefault();
        const caisseId = validateBtn.dataset.caisseId;
        cloture.handleValidateCaisse(caisseId, state);
        return;
    }
    
    const handled = ui.handleCalculatorClickEvents(e, state);
    if(handled) {
        state.isDirty = true;
        service.calculateAll(state.config, state);
    }
}

export async function initializeCalculator() {
    try {
        await refreshCalculatorData();

        // Centralise la logique de clôture et l'écouteur du bouton principal
        cloture.initializeClotureEventListeners(state);
        const clotureBtn = document.getElementById('cloture-btn');
        if (clotureBtn) {
            clotureBtn.addEventListener('click', () => cloture.handleClotureAction(state));
        }

        setActiveMessageHandler(handleWebSocketMessage);
        await initializeWebSocket(handleWebSocketMessage);

    } catch (error) {
        console.error("Erreur critique d'initialisation:", error);
        document.getElementById('main-content').innerHTML = `<div class="container error"><p>Impossible de charger le calculateur : ${error.message}</p></div>`;
        cloture.updateClotureButtonState(false, state);
    }
}
