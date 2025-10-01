// Fichier : public/assets/js/logic/calculator-logic.js

import * as service from './calculator-service.js';
import * as ui from './calculator-ui.js';
import { setActiveMessageHandler } from '../main.js';
import { initializeWebSocket, sendWsMessage } from './websocket-service.js';
import * as cloture from './cloture-logic.js';
// On importe le service de la réserve
import * as reserveService from './reserve-service.js';
import { formatCurrency } from '../utils/formatters.js';

// État global de la page du calculateur
let state = {
    config: {},
    wsResourceId: null,
    calculatorData: { caisse: {} },
    lockedCaisses: [],
    closedCaisses: [],
    isDirty: false,
    reserveStatus: { denominations: {}, total: 0 } // Nouvel état pour le stock de la réserve
};

// --- UTILITIES ---
const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

const debouncedSendTheoreticals = debounce((target) => {
    const caisseId = target.dataset.caisseId;
    if (!caisseId) return;

    const fields = [
        'ventes_especes', 'retrocession',
        'ventes_cb', 'retrocession_cb',
        'ventes_cheques', 'retrocession_cheques',
        'fond_de_caisse'
    ];
    const data = {};
    fields.forEach(fieldName => {
        const input = document.getElementById(`${fieldName}_${caisseId}`);
        if (input) data[fieldName] = input.value;
    });

    sendWsMessage({ type: 'theoretical_update', caisse_id: caisseId, data: data });
}, 300); // Envoi groupé après 300ms d'inactivité

// --- FONCTIONS DE GESTION DU CYCLE DE VIE ---

async function refreshCalculatorData() {
    try {
        const initialData = await service.fetchInitialData();
        state.config = initialData.config;
        state.calculatorData = initialData.calculatorData;
        state.reserveStatus = initialData.reserveStatus; // On stocke l'état de la réserve
        
        state.lockedCaisses = [];
        state.closedCaisses = (initialData.closedCaisses || []).map(String);

        ui.renderCalculatorUI(document.getElementById('calculator-page'), state.config);
        ui.populateInitialData(state.calculatorData, state.config);
        attachEventListeners();
        service.calculateAll(state.config, state);
        ui.updateAllCaisseLocks(state);
        updateClotureButtonState();
        sendWsMessage({ type: 'get_full_state' });

    } catch (error) {
        console.error("Erreur critique lors du rafraîchissement:", error);
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `<div class="container error"><p>${error.message}</p></div>`;
        }
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

async function handleReserveRequestSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi...';

    try {
        const result = await reserveService.submitDemande(new FormData(form));
        if (!result.success) throw new Error(result.message);
        
        alert('Proposition d\'échange envoyée avec succès !');
        sendWsMessage({ type: 'nouvelle_demande_reserve' }); // Notifie les autres clients
        document.getElementById('reserve-request-modal').classList.remove('visible');

    } catch (error) {
        alert(`Erreur: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Proposer l\'échange';
    }
}

// NOUVELLE FONCTION pour calculer la balance de la modale
function updateReserveModalBalance() {
    const form = document.getElementById('calculator-reserve-request-form');
    if (!form) return;

    const allDenominations = { ...state.config.denominations.billets, ...state.config.denominations.pieces };
    let totalVers = 0;
    let totalDepuis = 0;

    form.querySelectorAll('#demande-rows-container .exchange-row').forEach(row => {
        const denom = row.querySelector('select').value;
        const qty = parseInt(row.querySelector('input').value) || 0;
        totalVers += qty * (parseFloat(allDenominations[denom]) || 0);
    });

    form.querySelectorAll('#donne-rows-container .exchange-row').forEach(row => {
        const denom = row.querySelector('select').value;
        const qty = parseInt(row.querySelector('input').value) || 0;
        totalDepuis += qty * (parseFloat(allDenominations[denom]) || 0);
    });

    document.getElementById('total-vers-caisse').textContent = formatCurrency(totalVers, state.config);
    document.getElementById('total-depuis-caisse').textContent = formatCurrency(totalDepuis, state.config);

    const balance = totalVers - totalDepuis;
    const balanceIndicator = document.getElementById('reserve-balance-indicator');
    const submitBtn = document.getElementById('submit-reserve-request-btn');

    balanceIndicator.querySelector('span').textContent = `Balance : ${formatCurrency(balance, state.config)}`;
    // Le bouton est actif si la balance est nulle ET qu'au moins un montant a été saisi
    if (Math.abs(balance) < 0.01 && (totalVers > 0 || totalDepuis > 0)) {
        balanceIndicator.className = 'balance-indicator balance-ok';
        balanceIndicator.querySelector('i').className = 'fa-solid fa-scale-balanced';
        submitBtn.disabled = false;
    } else {
        balanceIndicator.className = 'balance-indicator balance-nok';
        balanceIndicator.querySelector('i').className = 'fa-solid fa-scale-unbalanced';
        submitBtn.disabled = true;
    }
}

function attachEventListeners() {
    const page = document.getElementById('calculator-page');
    if (page._eventListenersAttached) return;

    page.addEventListener('input', handlePageInput);
    page.addEventListener('click', handlePageClick);
    page.addEventListener('keydown', handlePageKeydown);
    page.addEventListener('focusin', handlePageFocusIn);
    page.addEventListener('focusout', handlePageFocusOut);
    
    const form = document.getElementById('caisse-form');
    if (form) {
        form.addEventListener('submit', (e) => { 
            if (e.target.matches('#caisse-form')) {
                e.preventDefault(); 
                handleAutosave();
            }
        });
    }

    // Gestion de la soumission du formulaire de la modale
    page.addEventListener('submit', (e) => {
        if (e.target.matches('#calculator-reserve-request-form')) {
            handleReserveRequestSubmit(e);
        }
    });

    // Gestion de la mise à jour de la balance dans la modale
    page.addEventListener('input', (e) => {
        if (e.target.closest('#calculator-reserve-request-form')) {
            updateReserveModalBalance();
        }
    });

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
    const target = e.target;
    // On s'assure que l'input n'est pas dans la modale de réserve
    if (target.matches('input, textarea') && !target.closest('#calculator-reserve-request-form')) {
        state.isDirty = true;
        const statusEl = document.getElementById('autosave-status');
        if(statusEl) statusEl.textContent = 'Modifications non enregistrées.';
        
        service.calculateAll(state.config, state);
        
        if (target.matches('.quantity-input')) {
             sendWsMessage({ type: 'update', id: target.id, value: target.value });
        } else if (target.dataset.caisseId) {
             debouncedSendTheoreticals(target);
        }
    }
}

function handlePageClick(e) {
    const target = e.target;
    
    // Ouvre la modale
    if (target.closest('.open-reserve-modal-btn')) {
        const caisseId = target.closest('.open-reserve-modal-btn').dataset.caisseId;
        ui.renderReserveModal(caisseId, state.reserveStatus, state.config);
        document.getElementById('reserve-request-modal').classList.add('visible');
        return;
    }

    // Ferme la modale
    const reserveModal = document.getElementById('reserve-request-modal');
    if (reserveModal && (target.matches('#cancel-reserve-request-btn') || target.matches('.modal-close') || e.target === reserveModal)) {
        reserveModal.classList.remove('visible');
        return;
    }

    // Gère l'ajout d'une ligne dans la modale
    if (target.closest('.add-exchange-row-btn')) {
        const type = target.closest('.add-exchange-row-btn').dataset.type;
        const allDenominations = { ...state.config.denominations.billets, ...state.config.denominations.pieces };
        const sortedDenoms = Object.entries(allDenominations).sort((a, b) => b[1] - a[1]);
        const denomOptions = sortedDenoms.map(([name, value]) => {
            const label = value >= 1 ? `${value} ${state.config.currencySymbol}` : `${value * 100} cts`;
            return `<option value="${name}">${label}</option>`;
        }).join('');
        ui.addExchangeRow(type, denomOptions);
        return;
    }
    
    // Gère la suppression d'une ligne dans la modale
    if (target.closest('.remove-exchange-row-btn')) {
        target.closest('.exchange-row').remove();
        updateReserveModalBalance();
        return;
    }
    
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

function handlePageKeydown(e) {
    if (e.key === 'Enter' && e.target.classList.contains('quantity-input')) {
        e.preventDefault();
        const inputs = Array.from(document.querySelectorAll('.caisse-tab-content.active .quantity-input'));
        const currentIndex = inputs.indexOf(e.target);
        const nextInput = inputs[currentIndex + 1];
        if (nextInput) {
            nextInput.focus();
            nextInput.select();
        }
    }
}

function handlePageFocusIn(e) {
    if (e.target.classList.contains('quantity-input')) {
        const card = e.target.closest('.denom-card');
        if (card) card.classList.add('is-focused');
    }
}

function handlePageFocusOut(e) {
    if (e.target.classList.contains('quantity-input')) {
        const card = e.target.closest('.denom-card');
        if (card) card.classList.remove('is-focused');
    }
}

// --- LOGIQUE WEBSOCKET ET MISE À JOUR DE L'UI ---

function handleWebSocketMessage(data) {
    if (!data || !data.type) return;

    // NOUVEAU : Gérer la mise à jour de la réserve
    if (data.type === 'nouvelle_demande_reserve') {
        // On rafraîchit simplement les données de la réserve en arrière-plan
        fetch('index.php?route=reserve/get_data').then(res => res.json()).then(result => {
            if (result.success) {
                state.reserveStatus = result.reserve_status;
                console.log("État de la réserve mis à jour via WebSocket.");
            }
        });
        return; // Pas besoin de faire autre chose
    }

    switch (data.type) {
        case 'welcome':
            state.wsResourceId = data.resourceId.toString();
            updateClotureButtonState();
            sendWsMessage({ type: 'get_full_state' });
            break;
        
        case 'cloture_state':
            state.lockedCaisses = data.locked_caisses || [];
            state.closedCaisses = (data.closed_caisses || []).map(String);
            ui.updateAllCaisseLocks(state);
            updateClotureButtonState();
            break;

        case 'full_form_state':
            ui.applyFullFormState(data, state);
            service.calculateAll(state.config, state);
            ui.updateAllCaisseLocks(state);
            break;

        case 'update':
            ui.applyLiveUpdate(data);
            service.calculateAll(state.config, state);
            break;
        
        case 'theoretical_update':
            if (data.caisse_id && data.data) {
                ui.applyTheoreticalUpdate(data.caisse_id, data.data);
                service.calculateAll(state.config, state);
            }
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
        
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.beforePageChange = handleAutosave;
        }

    } catch (error) {
        console.error("Erreur critique d'initialisation:", error.stack);
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `<div class="container error"><p>Impossible de charger le calculateur : ${error.message}</p></div>`;
        }
    }
}
