// Fichier : public/assets/js/logic/calculator-logic.js (Verborisé et Corrigé pour la race condition)

import * as service from './calculator-service.js';
import * as ui from './calculator-ui.js';
import { setActiveMessageHandler } from '../main.js';
import { initializeWebSocket, sendWsMessage } from './websocket-service.js';
// On importe maintenant tout l'objet pour plus de clarté
import * as cloture from './cloture-logic.js';

// --- État global de l'application ---
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

function handleWebSocketMessage(data) {
    console.log(`%c[CALC-LOGIC] Message WebSocket reçu de type: ${data.type}`, 'color: #16a085', data);

    switch (data.type) {
        case 'welcome':
            state.wsResourceId = data.resourceId.toString();
            console.log(`%c[CALC-LOGIC] <<< WELCOME reçu. Mon ID de ressource est maintenant: ${state.wsResourceId}`, 'background: #27ae60; color: white; padding: 2px 5px;');
            
            cloture.initializeCloture(state.config, state, state.wsResourceId);
            
            console.log('%c[CALC-LOGIC] Activation du bouton de clôture.', 'color: green; font-weight: bold;');
            cloture.setClotureReady(true);
            break;
        case 'cloture_locked_caisses':
            console.log(`%c[CALC-LOGIC] <<< CLOTURE_LOCKED_CAISSES reçu.`, 'background: #f39c12; color: white; padding: 2px 5px;');
            state.lockedCaisses = data.caisses || [];
            state.closedCaisses = (data.closed_caisses || []).map(String);
            cloture.updateClotureUI(data, state.wsResourceId);
            break;
        case 'full_form_state':
            console.log(`%c[CALC-LOGIC] <<< FULL_FORM_STATE reçu. Application de l'état complet.`, 'background: #9b59b6; color: white; padding: 2px 5px;');
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

export async function initializeCalculator() {
    try {
        console.log('[CALC-LOGIC] Initialisation de la page Calculateur...');
        const initialData = await service.fetchInitialData();
        state.config = initialData.config;
        state.calculatorData = initialData.calculatorData;
        state.chequesState = initialData.chequesState;
        state.tpeState = initialData.tpeState;
        console.log('[CALC-LOGIC] Données initiales chargées:', {config: state.config, data: state.calculatorData});

        ui.renderCalculatorUI(document.getElementById('calculator-page'), state.config, state.chequesState, state.tpeState);
        ui.populateInitialData(state.calculatorData);
        console.log('[CALC-LOGIC] Interface rendue.');

        service.calculateAll(state.config, state);
        attachEventListeners();
        setActiveMessageHandler(handleWebSocketMessage);
        console.log('[CALC-LOGIC] Écouteurs d\'événements attachés et gestionnaire de messages activé.');

        await initializeWebSocket(handleWebSocketMessage);

        console.log('[CALC-LOGIC] WebSocket initialisé. Envoi de get_full_state.');
        sendWsMessage({ type: 'get_full_state' });

    } catch (error) {
        console.error("Erreur critique d'initialisation:", error);
        document.getElementById('main-content').innerHTML = `<div class="container error"><p>Impossible de charger le calculateur : ${error.message}</p></div>`;
        cloture.setClotureReady(false);
    }
}
