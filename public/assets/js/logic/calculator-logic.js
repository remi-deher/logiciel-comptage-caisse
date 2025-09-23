// Fichier : public/assets/js/logic/calculator-logic.js (Version Finale Complète)

import * as service from './calculator-service.js';
import * as ui from './calculator-ui.js';
import { setActiveMessageHandler } from '../main.js';
import { initializeWebSocket, sendWsMessage } from './websocket-service.js';
import * as cloture from './cloture-logic.js'; // Importe l'ensemble du module de clôture

// État global de la page du calculateur
let state = {
    config: {},
    wsResourceId: null,
    calculatorData: { caisse: {} },
    chequesState: {},
    tpeState: {},
    closedCaisses: [], // Ajout pour suivre les caisses clôturées
    isDirty: false
};

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

/**
 * Gestionnaire de messages WebSocket principal.
 * Il reçoit TOUS les messages et les délègue au module approprié.
 */
function handleWebSocketMessage(data) {
    // 1. Donne la priorité au module de clôture pour traiter le message
    const wasHandledByCloture = cloture.handleWebSocketMessage(data, state);
    if (wasHandledByCloture) {
        return; // Si le module de clôture a géré le message, on s'arrête.
    }

    // 2. Traite les messages standards du calculateur
    switch (data.type) {
        case 'welcome':
            state.wsResourceId = data.resourceId.toString();
            cloture.updateClotureButtonState(true, state); // Active le bouton
            break;
        case 'cloture_locked_caisses':
            // Met à jour l'état des caisses clôturées pour l'UI principale
            state.closedCaisses = (data.closed_caisses || []).map(String);
            cloture.updateClotureButtonState(true, state);
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
        case 'reload_page':
            alert("Les données ont été actualisées par un autre utilisateur. La page va être rechargée.");
            window.location.reload();
            break;
    }
}

function attachEventListeners() {
    const page = document.getElementById('calculator-page');
    if (!page) return;

    window.addEventListener('beforeunload', () => { if (state.isDirty) handleAutosave(); });

    page.addEventListener('input', e => {
        if (e.target.matches('input, textarea')) {
            state.isDirty = true;
            document.getElementById('autosave-status').textContent = 'Modifications non enregistrées.';
            service.calculateAll(state.config, state);
            if (e.target.matches('input[type="text"], input[type="number"]')) {
                 sendWsMessage({ type: 'update', id: e.target.id, value: e.target.value });
            }
        }
    });

    page.addEventListener('click', e => {
        const handled = ui.handleCalculatorClickEvents(e, state);
        if(handled) {
            state.isDirty = true;
            service.calculateAll(state.config, state);
        }
    });

    const form = document.getElementById('caisse-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleAutosave();
    });
}

/**
 * Point d'entrée principal pour la page du calculateur.
 */
export async function initializeCalculator() {
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

        // Initialise la logique des modales de clôture en lui passant l'état global
        cloture.initializeClotureModals(state);

        // Définit notre nouveau gestionnaire de messages "chef d'orchestre"
        setActiveMessageHandler(handleWebSocketMessage);

        await initializeWebSocket(handleWebSocketMessage);
        sendWsMessage({ type: 'get_full_state' });

    } catch (error) {
        console.error("Erreur critique d'initialisation:", error);
        document.getElementById('main-content').innerHTML = `<div class="container error"><p>Impossible de charger le calculateur : ${error.message}</p></div>`;
        cloture.updateClotureButtonState(false, state);
    }
}
