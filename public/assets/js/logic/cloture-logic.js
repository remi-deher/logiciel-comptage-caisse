// Fichier : public/assets/js/logic/cloture-logic.js (Version Corrigée)

import { sendWsMessage } from './websocket-service.js';
import { calculateEcartsForCaisse, calculateWithdrawalSuggestion } from './calculator-service.js';
import { formatCurrency } from '../utils/formatters.js';

// --- État global du module de clôture ---
let state = {
    isActive: false,
    selectedCaisses: [],
    validatedCaisses: new Set(),
    config: {},
    appState: null,
    wsResourceId: null
};

/**
 * Active ou désactive le bouton de clôture principal en fonction de la connexion WebSocket.
 */
export function setClotureReady(isReady) {
    const clotureBtn = document.getElementById('cloture-btn');
    if (clotureBtn) {
        clotureBtn.disabled = !isReady;
        clotureBtn.dataset.wsReady = isReady;
        clotureBtn.title = isReady ? "Lancer le processus de clôture" : "Nécessite une connexion en temps réel active.";
    }
}

/**
 * Point d'entrée pour initialiser le module de clôture.
 */
export function initializeCloture(appConfig, appState, wsResourceId) {
    state.config = appConfig;
    state.appState = appState;
    state.wsResourceId = wsResourceId;
    attachClotureEventListeners();
}

/**
 * Attache les écouteurs d'événements globaux pour la clôture.
 */
function attachClotureEventListeners() {
    document.body.addEventListener('click', e => {
        const target = e.target;
        if (target.closest('#cloture-btn')) {
            if (state.isActive) {
                renderFinalSummaryModal();
            } else {
                renderSelectionModal();
            }
        }
        if (target.closest('#cloture-selection-modal .modal-close') || target.closest('#cancel-selection-btn')) {
            document.getElementById('cloture-selection-modal')?.remove();
        }
        if (target.closest('#confirm-selection-btn')) {
            const modal = document.getElementById('cloture-selection-modal');
            const selected = Array.from(modal.querySelectorAll('input:checked')).map(cb => cb.value);
            if (selected.length > 0) {
                startClotureMode(selected);
                modal.remove();
            }
        }
        if (target.closest('#final-summary-modal .modal-close') || target.closest('#cancel-final-summary')) {
            document.getElementById('final-summary-modal')?.remove();
        }
        if (target.closest('#confirm-final-cloture')) {
            handleFinalSubmit();
        }
    });

    document.getElementById('main-content').addEventListener('click', e => {
        if (e.target.closest('.validate-caisse-btn')) {
            const caisseId = e.target.closest('.validate-caisse-btn').dataset.caisseId;
            validateCaisse(caisseId);
        }
    });

    document.body.addEventListener('change', e => {
        if (e.target.closest('#cloture-selection-modal')) {
             const modal = document.getElementById('cloture-selection-modal');
             modal.querySelector('#confirm-selection-btn').disabled = modal.querySelectorAll('input:checked').length === 0;
        }
    });
}


/**
 * Affiche la modale de sélection des caisses à clôturer.
 */
function renderSelectionModal() {
    const lockedCaisses = state.appState.lockedCaisses || [];
    const closedCaisses = state.appState.closedCaisses || [];
    const wsId = state.wsResourceId;

    const caisseOptionsHtml = Object.entries(state.config.nomsCaisses).map(([id, nom]) => {
        const isClosed = closedCaisses.includes(id);
        const lockInfo = lockedCaisses.find(c => c.caisse_id.toString() === id);
        const isLockedByOther = lockInfo && String(lockInfo.locked_by) !== wsId;
        const isDisabled = isClosed || isLockedByOther;

        let statusText = 'Disponible';
        if (isClosed) statusText = 'Déjà clôturée';
        if (isLockedByOther) statusText = 'Verrouillée par un autre utilisateur';

        return `
            <li class="caisse-selection-item">
                <input type="checkbox" id="caisse-select-${id}" value="${id}" ${isDisabled ? 'disabled' : ''}>
                <label for="caisse-select-${id}" class="${isDisabled ? 'disabled' : ''}">
                    ${nom} <span class="status">${statusText}</span>
                </label>
            </li>`;
    }).join('');

    const modalHtml = `
        <div id="cloture-selection-modal" class="modal visible">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Lancer une Clôture</h3>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body">
                    <p>Sélectionnez la ou les caisses que vous souhaitez clôturer :</p>
                    <ul class="caisse-selection-list">${caisseOptionsHtml}</ul>
                </div>
                <div class="modal-footer">
                    <button class="btn" id="cancel-selection-btn">Annuler</button>
                    <button class="btn save-btn" id="confirm-selection-btn" disabled>Préparer la clôture</button>
                </div>
            </div>
        </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Active le "Mode Clôture" sur l'interface du calculateur.
 */
export function startClotureMode(selectedCaisses) {
    state.isActive = true;
    state.selectedCaisses = selectedCaisses;
    state.validatedCaisses.clear();

    selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_lock', caisse_id: id }));
    
    document.body.classList.add('cloture-mode-active');
    updateUIForClotureMode();
}

/**
 * Annule le "Mode Clôture" et restaure l'interface.
 */
export function cancelClotureMode() {
    state.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
    
    state.isActive = false;
    state.selectedCaisses = [];
    state.validatedCaisses.clear();

    document.body.classList.remove('cloture-mode-active');
    updateUIForClotureMode();
}


/**
 * Marque une caisse comme validée par l'utilisateur.
 */
function validateCaisse(caisseId) {
    state.validatedCaisses.add(caisseId);
    updateUIForClotureMode();
}

/**
 * Affiche la modale de récapitulatif final avant de terminer.
 */
function renderFinalSummaryModal() {
    let totalVentesGlobal = 0, totalRetraitGlobal = 0, fondDeCaisseJ1Global = 0;

    const rowsHtml = state.selectedCaisses.map(id => {
        const caisseData = state.appState.calculatorData.caisse[id];
        const { totalVentes, totalCompteEspeces } = calculateEcartsForCaisse(id, state.appState, state.config);
        const { totalToWithdraw } = calculateWithdrawalSuggestion(caisseData, state.config);
        const fondDeCaisseJ1 = totalCompteEspeces - totalToWithdraw;

        totalVentesGlobal += totalVentes;
        totalRetraitGlobal += totalToWithdraw;
        fondDeCaisseJ1Global += fondDeCaisseJ1;

        return `<tr>
            <td>${state.config.nomsCaisses[id]}</td>
            <td>${formatCurrency(totalVentes, state.config)}</td>
            <td class="text-danger">${formatCurrency(totalToWithdraw, state.config)}</td>
            <td class="text-success">${formatCurrency(fondDeCaisseJ1, state.config)}</td>
        </tr>`;
    }).join('');

    const modalHtml = `
        <div id="final-summary-modal" class="modal visible">
            <div class="modal-content wide">
                <div class="modal-header"><h3>Récapitulatif de la Clôture</h3><span class="modal-close">&times;</span></div>
                <div class="modal-body">
                    <p>Vérifiez les totaux avant de finaliser la journée. Cette action est irréversible.</p>
                    <table class="final-summary-table">
                        <thead><tr><th>Caisse</th><th>Ventes Totales</th><th>Retrait Espèces</th><th>Fond de Caisse J+1</th></tr></thead>
                        <tbody>${rowsHtml}</tbody>
                        <tfoot>
                            <tr>
                                <td><strong>TOTAL</strong></td>
                                <td><strong>${formatCurrency(totalVentesGlobal, state.config)}</strong></td>
                                <td class="text-danger"><strong>${formatCurrency(totalRetraitGlobal, state.config)}</strong></td>
                                <td class="text-success"><strong>${formatCurrency(fondDeCaisseJ1Global, state.config)}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div class="modal-footer">
                    <button class="btn" id="cancel-final-summary">Annuler</button>
                    <button class="btn save-btn" id="confirm-final-cloture">Confirmer et Terminer</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function handleFinalSubmit() {
    const modal = document.getElementById('final-summary-modal');
    try {
        const formData = new FormData(document.getElementById('caisse-form'));
        state.selectedCaisses.forEach(id => formData.append('caisses_a_cloturer[]', id));
        
        state.selectedCaisses.forEach(id => {
            const { suggestions } = calculateWithdrawalSuggestion(state.appState.calculatorData.caisse[id], state.config);
            (suggestions || []).forEach(s => {
                formData.append(`retraits[${id}][${s.name}]`, s.qty);
            });
        });
        
        const response = await fetch('index.php?route=cloture/confirm_caisse', { method: 'POST', body: formData });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        alert('Clôture réussie !');
        sendWsMessage({ type: 'force_reload_all' });

    } catch (error) {
        alert(`Erreur: ${error.message}`);
    } finally {
        modal?.remove();
    }
}


/**
 * Met à jour l'état de l'interface (champs, boutons) en fonction du mode clôture.
 */
export function updateUIForClotureMode() {
    const isClotureActive = state.isActive;
    const body = document.body;
    const clotureBtn = document.getElementById('cloture-btn');
    
    body.classList.toggle('cloture-mode-active', isClotureActive);
    
    if (clotureBtn) {
        if (isClotureActive) {
            const allValidated = state.selectedCaisses.length > 0 && state.selectedCaisses.every(id => state.validatedCaisses.has(id));
            clotureBtn.innerHTML = `<i class="fa-solid fa-flag-checkered"></i> Finaliser (${state.validatedCaisses.size}/${state.selectedCaisses.length})`;
            clotureBtn.disabled = !allValidated;
        } else {
            clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture';
            clotureBtn.disabled = clotureBtn.dataset.wsReady !== 'true';
        }
    }
    
    document.querySelectorAll('.caisse-tab-content').forEach(tabContent => {
        const caisseId = tabContent.id.replace('caisse', '');
        const isSelectedForCloture = state.selectedCaisses.includes(caisseId);
        const isLockedByMe = isClotureActive && isSelectedForCloture;
        const isValidated = state.validatedCaisses.has(caisseId);
        
        tabContent.querySelectorAll('input, textarea, button').forEach(el => {
            if (!el.closest('.cloture-validation-area')) {
                el.readOnly = isLockedByMe;
                if(el.tagName === 'BUTTON') el.disabled = isLockedByMe;
            }
        });

        let validationArea = tabContent.querySelector('.cloture-validation-area');
        if (isLockedByMe && !validationArea) {
            validationArea = document.createElement('div');
            validationArea.className = 'cloture-validation-area';
            tabContent.appendChild(validationArea);
        } else if (!isLockedByMe && validationArea) {
            validationArea.remove();
        }

        if (validationArea) {
            validationArea.innerHTML = isValidated
                ? `<p class="validation-message"><i class="fa-solid fa-check-circle"></i> Caisse validée !</p>`
                : `<button class="btn save-btn validate-caisse-btn" data-caisse-id="${caisseId}">✅ Valider les chiffres de cette caisse</button>`;
        }
        
        const tabLink = document.querySelector(`.tab-link[data-caisse-id="${caisseId}"]`);
        if(tabLink) {
            tabLink.classList.remove('awaiting-validation', 'validated');
            if(isLockedByMe && !isValidated) tabLink.classList.add('awaiting-validation');
            if(isValidated) tabLink.classList.add('validated');
        }
    });
}

/**
 * Met à jour l'UI en fonction des données WebSocket reçues (verrouillage par d'autres).
 */
export function updateClotureUI(wsData, wsResourceId) {
    if (state.isActive) return;

    const lockedCaisses = wsData.caisses || [];
    
    document.querySelectorAll('.tab-link').forEach(tab => {
        const caisseId = tab.dataset.caisseId;
        const lockInfo = lockedCaisses.find(c => c.caisse_id.toString() === caisseId);
        
        const isLockedByOther = lockInfo && String(lockInfo.locked_by) !== String(wsResourceId);
        tab.classList.toggle('locked-by-other', isLockedByOther);

        const formFields = document.querySelectorAll(`#caisse${caisseId} input, #caisse${caisseId} button, #caisse${caisseId} textarea`);
        formFields.forEach(field => field.disabled = isLockedByOther);
    });
}
