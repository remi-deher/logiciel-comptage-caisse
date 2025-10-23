// Fichier : public/assets/js/logic/calculator-logic.js (Corrected - Vérifiez l'export à la fin)

import * as service from './calculator-service.js';
import * as ui from './calculator-ui.js';
import { setActiveMessageHandler } from '../main.js';
import { initializeWebSocket, sendWsMessage } from './websocket-service.js';
import * as cloture from './cloture-logic.js';
import * as reserveService from './reserve-service.js';
import { formatCurrency, parseLocaleFloat } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';

// État global de la page du calculateur
let state = {
    config: {},
    wsResourceId: null,
    calculatorData: { caisse: {} },
    lockedCaisses: [],
    closedCaisses: [],
    isDirty: false,
    reserveStatus: { denominations: {}, total: 0 }
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
    if (!caisseId || !target.closest('.caisse-tab-content')) return;

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
}, 500);

// --- FONCTIONS DE GESTION DU CYCLE DE VIE ---

async function refreshCalculatorData() {
    try {
        const initialData = await service.fetchInitialData();
        state.config = initialData.config;
        state.calculatorData = initialData.calculatorData;
        state.reserveStatus = initialData.reserveStatus;
        state.lockedCaisses = [];
        state.closedCaisses = initialData.clotureState.closedCaisses || [];

        const calculatorPageElement = document.getElementById('calculator-page');
        if (!calculatorPageElement) throw new Error("Élément #calculator-page introuvable.");

        ui.renderCalculatorUI(calculatorPageElement, state.config);

        await new Promise(resolve => requestAnimationFrame(resolve));

        const form = document.getElementById('caisse-form');
        if (!form) {
            console.error("Le formulaire #caisse-form n'a pas été trouvé après le rendu.");
            throw new Error("Erreur interne: Le formulaire principal n'a pas pu être créé.");
        }

        // Utiliser la fonction importée de ui.js pour peupler
        ui.populateInitialData(state.calculatorData, state.config); // Appel de la fonction importée

        attachEventListeners();
        service.calculateAll(state.config, state);
        ui.updateAllCaisseLocks(state);
        updateClotureButtonState(state); // Appel de la fonction définie dans ce fichier
        sendWsMessage({ type: 'get_full_state' });

    } catch (error) {
        console.error("Erreur critique lors du rafraîchissement:", error);
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `<div class="container error"><p>Impossible de charger le calculateur : ${error.message}</p></div>`;
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
        if (!response.ok) {
           let errorMsg = `Erreur serveur ${response.status}`;
           try {
               const errorResult = await response.json();
               errorMsg = errorResult.message || errorMsg;
           } catch(e) { /* Ignorer */ }
           throw new Error(errorMsg);
        }

        state.isDirty = false;
        if (statusElement) statusElement.textContent = 'Changements sauvegardés.';

    } catch (error) {
        if (statusElement) statusElement.textContent = 'Échec de la sauvegarde auto.';
        console.error("Erreur d'autosave :", error);
        showToast(`Échec de la sauvegarde automatique: ${error.message}`, "error");
    }
}

// --- GESTION DES ÉVÉNEMENTS ---

async function handleReserveRequestSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi...';

    try {
        const result = await reserveService.submitDemande(new FormData(form));
        if (!result.success) throw new Error(result.message);

        showToast('Proposition d\'échange envoyée avec succès !', 'success');
        sendWsMessage({ type: 'nouvelle_demande_reserve' });
        document.getElementById('reserve-request-modal')?.classList.remove('visible');

    } catch (error) {
        showToast(`Erreur: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Proposer l\'échange';
    }
}

function updateReserveModalBalance() {
    const form = document.getElementById('calculator-reserve-request-form');
    if (!form || !state.config || !state.config.denominations) return; // Vérification ajoutée

    const allDenominations = { ...(state.config.denominations.billets || {}), ...(state.config.denominations.pieces || {}) };
    let totalVers = 0;
    let totalDepuis = 0;

    form.querySelectorAll('#demande-rows-container .exchange-row').forEach(row => {
        const denomSelect = row.querySelector('select[name="demande_denoms[]"]');
        const qtyInput = row.querySelector('input[name="demande_qtys[]"]');
        if (denomSelect && qtyInput) {
            const denom = denomSelect.value;
            const qty = parseInt(qtyInput.value) || 0;
            totalVers += qty * (parseFloat(allDenominations[denom]) || 0);
        }
    });

    form.querySelectorAll('#donne-rows-container .exchange-row').forEach(row => {
        const denomSelect = row.querySelector('select[name="donne_denoms[]"]');
        const qtyInput = row.querySelector('input[name="donne_qtys[]"]');
         if (denomSelect && qtyInput) {
            const denom = denomSelect.value;
            const qty = parseInt(qtyInput.value) || 0;
            totalDepuis += qty * (parseFloat(allDenominations[denom]) || 0);
        }
    });

    const totalVersEl = document.getElementById('total-vers-caisse');
    if (totalVersEl) totalVersEl.textContent = formatCurrency(totalVers, state.config);
    const totalDepuisEl = document.getElementById('total-depuis-caisse');
    if (totalDepuisEl) totalDepuisEl.textContent = formatCurrency(totalDepuis, state.config);

    const balance = totalVers - totalDepuis;
    const balanceIndicator = document.getElementById('reserve-balance-indicator');
    const submitBtn = document.getElementById('submit-reserve-request-btn');

    if (balanceIndicator && submitBtn) {
        const balanceSpan = balanceIndicator.querySelector('span');
        const balanceIcon = balanceIndicator.querySelector('i');
        if (balanceSpan) balanceSpan.textContent = `Balance : ${formatCurrency(balance, state.config)}`;

        if (Math.abs(balance) < 0.01 && (totalVers > 0 || totalDepuis > 0)) {
            balanceIndicator.className = 'balance-indicator balance-ok';
            if (balanceIcon) balanceIcon.className = 'fa-solid fa-scale-balanced';
            submitBtn.disabled = false;
        } else {
            balanceIndicator.className = 'balance-indicator balance-nok';
            if (balanceIcon) balanceIcon.className = 'fa-solid fa-scale-unbalanced';
            submitBtn.disabled = true;
        }
    }
}


function attachEventListeners() {
    const page = document.getElementById('calculator-page');
    if (!page || page._eventListenersAttached) return;

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
                handleAutosave().then(() => {
                    if (!state.isDirty) {
                       showToast("Comptage enregistré avec succès.", "success");
                    }
                });
            }
        });
    }

    page.addEventListener('submit', (e) => {
        if (e.target.matches('#calculator-reserve-request-form')) {
            handleReserveRequestSubmit(e);
        }
    });
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
                cloture.startClotureCaisse(caisseId, state);
            } else {
                 showToast("Veuillez sélectionner une caisse pour la clôturer.", "info");
            }
        });
    }

    window.addEventListener('beforeunload', (event) => {
        if (state.isDirty) {
            const form = document.getElementById('caisse-form');
            if (form) {
                const formData = new FormData(form);
                const url = 'index.php?route=calculateur/autosave';
                if (navigator.sendBeacon) {
                    navigator.sendBeacon(url, formData);
                    state.isDirty = false;
                } else {
                    fetch(url, { method: 'POST', body: formData, keepalive: true }).catch(err => console.error("Fallback autosave error:", err));
                     state.isDirty = false;
                }
            }
        }
    });

    page._eventListenersAttached = true;
}


function handlePageInput(e) {
    const target = e.target;
    if (target.matches('input, textarea') && target.closest('#caisse-form') && !target.closest('#calculator-reserve-request-form')) {
        state.isDirty = true;
        const statusEl = document.getElementById('autosave-status');
        if(statusEl) statusEl.textContent = 'Modifications non enregistrées.';

        service.calculateAll(state.config, state);

        if (target.matches('.quantity-input')) {
             sendWsMessage({ type: 'update', id: target.id, value: target.value });
        } else if (target.dataset.caisseId && (target.id.includes('ventes_') || target.id.includes('retrocession_') || target.id.includes('fond_de_caisse_'))) {
             debouncedSendTheoreticals(target);
        }
    }
}

function handlePageClick(e) {
    const target = e.target;

    // --- Clics pour la modale Réserve ---
    if (target.closest('.open-reserve-modal-btn')) {
        const caisseId = target.closest('.open-reserve-modal-btn').dataset.caisseId;
        ui.renderReserveModal(caisseId, state.reserveStatus, state.config);
        document.getElementById('reserve-request-modal')?.classList.add('visible');
        return;
    }
    const reserveModal = document.getElementById('reserve-request-modal');
    if (reserveModal && (target.matches('#cancel-reserve-request-btn') || target.matches('.modal-close') || e.target === reserveModal)) {
        reserveModal.classList.remove('visible');
        return;
    }
    if (target.closest('.add-exchange-row-btn')) {
        const type = target.closest('.add-exchange-row-btn').dataset.type;
        const allDenominations = { ...(state.config.denominations.billets || {}), ...(state.config.denominations.pieces || {}) };
        const sortedDenoms = Object.entries(allDenominations).sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
        const denomOptions = sortedDenoms.map(([name, value]) => {
            const numericValue = parseFloat(value);
            const label = numericValue >= 1 ? `${numericValue} ${state.config.currencySymbol}` : `${numericValue * 100} cts`;
            return `<option value="${name}">${label}</option>`;
        }).join('');
        ui.addExchangeRow(type, denomOptions);
        updateReserveModalBalance();
        return;
    }
    if (target.closest('.remove-exchange-row-btn')) {
        target.closest('.exchange-row')?.remove();
        updateReserveModalBalance();
        return;
    }

    // --- Clics pour la Clôture ---
    if (target.closest('.cloture-reopen-btn')) {
        cloture.reopenCaisse(target.closest('.cloture-reopen-btn').dataset.caisseId, state);
        return;
    }
    if (target.closest('#finalize-day-btn')) {
        cloture.finalizeDay(state);
        return;
    }
     if (target.closest('#show-suggestions-btn')) {
        ui.renderWithdrawalSummaryModal(state);
        return;
    }
    const suggestionsModal = document.getElementById('suggestions-modal');
    if (suggestionsModal && (target.matches('.modal-close') || target === suggestionsModal)) {
        suggestionsModal.classList.remove('visible');
        return;
    }
     const summaryModal = document.getElementById('cloture-summary-modal');
    if (summaryModal && (target.matches('.modal-close') || target === summaryModal)) {
        summaryModal.classList.remove('visible');
        return;
    }

    // --- Clics gérés par calculator-ui ---
    const handledByUI = ui.handleCalculatorClickEvents(e, state);
    if(handledByUI) {
        state.isDirty = true;
        service.calculateAll(state.config, state);
    }
}


function handlePageKeydown(e) {
    if (e.key === 'Enter' && e.target.classList.contains('quantity-input')) {
        e.preventDefault();
        const inputs = Array.from(document.querySelectorAll('.caisse-tab-content.active .payment-tab-content.active .quantity-input'));
        const currentIndex = inputs.indexOf(e.target);
        const nextInput = inputs[currentIndex + 1];
        if (nextInput) {
            nextInput.focus();
        } else {
             const firstTheoretical = document.querySelector('.caisse-tab-content.active .payment-tab-content.active .theoretical-inputs-panel input:not([type="hidden"])');
             firstTheoretical?.focus();
        }
    }
}

function handlePageFocusIn(e) {
    if (e.target.classList.contains('quantity-input')) {
        const card = e.target.closest('.denom-card');
        if (card) card.classList.add('is-focused');
        e.target.select();
    }
     if (e.target.matches('.theoretical-inputs-panel input, #fond_de_caisse_input, .tpe-releve-form input, .cheque-form-container input')) {
         if (e.target.type === 'text' || e.target.type === 'number' || e.target.type === 'time') {
            e.target.select();
         }
    }
}

function handlePageFocusOut(e) {
    if (e.target.classList.contains('quantity-input')) {
        const card = e.target.closest('.denom-card');
        if (card) card.classList.remove('is-focused');
        if(e.target.value.trim() === '' || isNaN(parseInt(e.target.value))) {
            // e.target.value = '0'; // Optionnel
        }
    }
    if (e.target.matches('input[type="text"][inputmode="decimal"]')) {
       // Optionnel: Reformatage
    }
}

// --- LOGIQUE WEBSOCKET ET MISE À JOUR DE L'UI ---

function handleWebSocketMessage(data) {
    if (!data || !data.type) return;

    if (data.type === 'nouvelle_demande_reserve') {
        fetch('index.php?route=reserve/get_data')
            .then(res => res.ok ? res.json() : Promise.reject('Réponse invalide'))
            .then(result => {
                if (result.success) {
                    state.reserveStatus = result.reserve_status;
                    console.log("[WebSocket] État de la réserve mis à jour.");
                    const reserveModal = document.getElementById('reserve-request-modal');
                    if(reserveModal && reserveModal.classList.contains('visible')){
                        const activeCaisseId = document.querySelector('#calculator-reserve-request-form input[name="caisse_id"]')?.value;
                        if(activeCaisseId) ui.renderReserveModal(activeCaisseId, state.reserveStatus, state.config);
                    }
                }
            })
            .catch(err => console.error("Erreur maj réserve via WS:", err));
        return;
    }

    switch (data.type) {
        case 'welcome':
            state.wsResourceId = data.resourceId?.toString();
            updateClotureButtonState(state);
            sendWsMessage({ type: 'get_full_state' });
            break;

        case 'cloture_state':
             state.lockedCaisses = data.locked_caisses || [];
             state.closedCaisses = (data.closed_caisses || []).map(String);
             ui.updateAllCaisseLocks(state);
             updateClotureButtonState(state);
             break;

        case 'full_form_state':
            ui.applyFullFormState(data, state); // Utilise la fonction importée
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

        case 'cheque_update':
        case 'tpe_update':
            ui.applyListUpdate(data, state);
            service.calculateAll(state.config, state);
            break;

        case 'force_reload_all':
             showToast("L'application va se recharger (action serveur)...", "info", 4000);
             setTimeout(() => window.location.reload(), 1500);
             break;
    }
}

/**
 * Met à jour l'état et le texte du bouton de clôture principal.
 */
function updateClotureButtonState(state) {
    const clotureBtn = document.getElementById('cloture-btn');
    if (!clotureBtn || !state.config || !state.config.nomsCaisses) return;

    const allCaisseIds = Object.keys(state.config.nomsCaisses || {});
    const allClosed = allCaisseIds.length > 0 && allCaisseIds.every(id => state.closedCaisses.includes(String(id)));

    clotureBtn.disabled = !state.wsResourceId || allClosed;

    if (allClosed) {
        clotureBtn.innerHTML = `<i class="fa-solid fa-check-circle"></i> Journée Terminée`;
        clotureBtn.classList.remove('mode-validation', 'mode-finalisation');
        clotureBtn.style.backgroundColor = '';
    } else {
        clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture Caisse Active';
         if (!clotureBtn.disabled) {
             clotureBtn.classList.remove('mode-validation', 'mode-finalisation');
             clotureBtn.style.backgroundColor = '';
         }
    }
}


// --- POINT D'ENTRÉE ---

// *** CORRECTION ICI: Ajout du mot-clé 'export' ***
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
        console.error("Erreur critique d'initialisation du calculateur:", error);
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `<div class="container error"><p>Impossible de charger le calculateur. Détails : ${error.message}</p></div>`;
        }
    }
}
