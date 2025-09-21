// Fichier : public/assets/js/logic/cloture-logic.js (Version finale avec gestion des droits d'écriture et validation individuelle)

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

// --- Fonctions Principales ---

export function setClotureReady(isReady) {
    const clotureBtn = document.getElementById('cloture-btn');
    if (clotureBtn) {
        clotureBtn.disabled = !isReady;
        clotureBtn.dataset.wsReady = isReady;
        clotureBtn.title = isReady ? "Lancer le processus de clôture" : "Nécessite une connexion en temps réel active.";
    }
}

export function initializeCloture(appConfig, appState, wsResourceId) {
    state.config = appConfig;
    state.appState = appState;
    state.wsResourceId = wsResourceId;
    attachClotureEventListeners();
}

// --- Gestion des Événements ---

function attachClotureEventListeners() {
    // Clic sur le bouton principal "Clôture"
    document.body.addEventListener('click', e => {
        const target = e.target;
        if (target.closest('#cloture-btn')) {
            if (state.isActive) {
                if (confirm("Voulez-vous annuler le mode clôture en cours ?")) {
                    cancelClotureMode();
                }
            } else {
                renderSelectionModal();
            }
        }
    });

    // Clics à l'intérieur de la modale de sélection
    document.body.addEventListener('click', e => {
        const modal = document.getElementById('cloture-selection-modal');
        if (!modal) return;
        
        const target = e.target;

        // Fermer la modale
        if (target.closest('.modal-close') || target.closest('#cancel-selection-btn')) {
            modal.remove();
        }

        // Confirmer la sélection
        if (target.closest('#confirm-selection-btn')) {
            const selected = Array.from(modal.querySelectorAll('input:checked')).map(cb => cb.value);
            if (selected.length > 0) {
                startClotureMode(selected);
                modal.remove();
            }
        }

        // Boutons "Tout sélectionner / désélectionner"
        if (target.closest('#select-all-btn')) {
            modal.querySelectorAll('input[name="caisseSelection"]:not(:disabled)').forEach(cb => cb.checked = true);
            updateSelectionCount();
        }
        if (target.closest('#deselect-all-btn')) {
            modal.querySelectorAll('input[name="caisseSelection"]:checked').forEach(cb => cb.checked = false);
            updateSelectionCount();
        }

        // Bouton pour rouvrir/déverrouiller une caisse
        if (target.closest('.js-reopen-caisse')) {
            e.stopPropagation(); // Empêche le label de cocher la case
            e.preventDefault();
            const caisseId = target.dataset.caisseId;
            const type = target.dataset.type;
            const caisseNom = state.config.nomsCaisses[caisseId] || `la caisse ${caisseId}`;

            if (confirm(`Voulez-vous vraiment forcer le déverrouillage de "${caisseNom}" ?`)) {
                const messageType = type === 'closed' ? 'cloture_reopen' : 'cloture_force_unlock';
                sendWsMessage({ type: messageType, caisse_id: caisseId });
                target.textContent = 'Déverrouillage...';
                setTimeout(() => modal.remove(), 500); // Ferme pour laisser le temps de rafraîchir
            }
        }
    });
    
    // Changement sur une checkbox dans la modale
    document.body.addEventListener('change', e => {
        if (e.target.matches('input[name="caisseSelection"]')) {
             updateSelectionCount();
        }
    });

    // Clics sur la page principale (validation et finalisation)
    const calculatorPage = document.getElementById('calculator-page');
    if (calculatorPage) {
        calculatorPage.addEventListener('click', e => {
            if (e.target.closest('.validate-caisse-btn')) {
                validateCaisse(e.target.closest('.validate-caisse-btn').dataset.caisseId);
            }
            if (e.target.closest('#confirm-final-cloture-banner')) {
                handleFinalSubmit();
            }
        });
    }
}

// --- Logique du Mode Clôture ---

export function startClotureMode(selectedCaisses) {
    state.isActive = true;
    state.selectedCaisses = selectedCaisses;
    state.validatedCaisses.clear();
    selectedCaisses.forEach(id => {
        sendWsMessage({ type: 'cloture_lock', caisse_id: id });
    });
    updateUIForClotureMode();
}

export function cancelClotureMode() {
    state.selectedCaisses.forEach(id => {
        sendWsMessage({ type: 'cloture_force_unlock', caisse_id: id });
    });
    state.isActive = false;
    state.selectedCaisses = [];
    state.validatedCaisses.clear();
    updateUIForClotureMode();
}

function validateCaisse(caisseId) {
    state.validatedCaisses.add(caisseId);
    updateUIForClotureMode();
}

async function handleFinalSubmit() {
    const confirmBtn = document.getElementById('confirm-final-cloture-banner');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Finalisation...';
    }

    try {
        const formData = new FormData(document.getElementById('caisse-form'));
        state.selectedCaisses.forEach(id => {
            formData.append('caisses_a_cloturer[]', id);
            const { suggestions } = calculateWithdrawalSuggestion(state.appState.calculatorData.caisse[id], state.config);
            (suggestions || []).forEach(s => formData.append(`retraits[${id}][${s.name}]`, s.qty));
        });
        
        const responseIndividuelle = await fetch('index.php?route=cloture/confirm_caisse', { method: 'POST', body: formData });
        if (!responseIndividuelle.ok) throw new Error('Erreur lors de la confirmation des caisses.');

        const responseGenerale = await fetch('index.php?route=cloture/confirm_generale', { method: 'POST' });
        const resultGenerale = await responseGenerale.json();
        if (!resultGenerale.success) throw new Error(resultGenerale.message);

        alert(resultGenerale.message || 'Clôture générale réussie !');
        sendWsMessage({ type: 'force_reload_all' });

    } catch (error) {
        alert(`Erreur: ${error.message}`);
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'Confirmer et Terminer la Journée';
        }
    }
}

// --- Rendu et Mise à Jour de l'Interface ---

function updateSelectionCount() {
    const modal = document.getElementById('cloture-selection-modal');
    if (!modal) return;
    const confirmBtn = modal.querySelector('#confirm-selection-btn');
    const countSpan = modal.querySelector('#selection-count');
    const count = modal.querySelectorAll('input[name="caisseSelection"]:checked').length;

    confirmBtn.disabled = count === 0;
    countSpan.textContent = count;
    countSpan.style.display = count > 0 ? 'inline-block' : 'none';
}

function renderSelectionModal() {
    const lockedCaisses = state.appState.lockedCaisses || [];
    const closedCaisses = state.appState.closedCaisses || [];
    const wsId = state.wsResourceId;

    const caissesHtml = Object.entries(state.config.nomsCaisses).map(([id, nom]) => {
        const isClosed = closedCaisses.includes(id);
        const lockInfo = lockedCaisses.find(c => c.caisse_id.toString() === id);
        const isLockedByOther = lockInfo && String(lockInfo.locked_by) !== wsId;
        const isDisabled = isClosed || isLockedByOther;

        let statusText = 'Disponible pour la clôture';
        let statusClass = 'status-libre';
        let iconClass = 'fa-cash-register';
        let reopenButtonHtml = '';

        if (isClosed) {
            statusText = 'Déjà clôturée';
            statusClass = 'status-cloturee disabled';
            iconClass = 'fa-check-circle';
            reopenButtonHtml = `<button type="button" class="btn reopen-btn js-reopen-caisse" data-caisse-id="${id}" data-type="closed"><i class="fa-solid fa-lock-open"></i> Rouvrir</button>`;
        } else if (isLockedByOther) {
            statusText = `En cours de clôture...`;
            statusClass = 'status-verrouillee disabled';
            iconClass = 'fa-lock';
            reopenButtonHtml = `<button type="button" class="btn reopen-btn js-reopen-caisse" data-caisse-id="${id}" data-type="locked"><i class="fa-solid fa-unlock"></i> Forcer Déverrouillage</button>`;
        }

        return `
            <label class="caisse-selection-item ${statusClass}">
                <input type="checkbox" name="caisseSelection" id="caisse-select-${id}" value="${id}" ${isDisabled ? 'disabled' : ''}>
                <div class="caisse-info">
                    <div class="caisse-info-header">
                        <i class="fa-solid ${iconClass}"></i>
                        <span>${nom}</span>
                    </div>
                    <p class="caisse-status-text">${statusText}</p>
                    ${reopenButtonHtml}
                </div>
            </label>`;
    }).join('');

    const modalHtml = `
        <div id="cloture-selection-modal" class="modal visible">
            <div class="modal-content wide">
                <div class="modal-header">
                    <h3>Lancer une Clôture</h3>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="selection-header">
                        <div class="color-key">
                            <div><span class="color-dot color-libre"></span> Libre</div>
                            <div><span class="color-dot color-verrouillee"></span> En cours</div>
                            <div><span class="color-dot color-cloturee"></span> Clôturée</div>
                        </div>
                        <div class="button-group">
                            <button type="button" id="select-all-btn" class="btn action-btn">Tout sélectionner</button>
                            <button type="button" id="deselect-all-btn" class="btn action-btn">Tout désélectionner</button>
                        </div>
                    </div>
                    <p>Sélectionnez les caisses disponibles que vous souhaitez clôturer :</p>
                    <div class="caisse-selection-grid">${caissesHtml}</div>
                </div>
                <div class="modal-footer">
                    <button class="btn" id="cancel-selection-btn">Annuler</button>
                    <button class="btn save-btn" id="confirm-selection-btn" disabled>
                        Démarrer la Clôture <span class="count" id="selection-count" style="display: none;">0</span>
                    </button>
                </div>
            </div>
        </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function renderFinalSummaryBanner() {
    const container = document.getElementById('cloture-final-summary-banner-container');
    if (!container) return;
    let totalVentesGlobal = 0, totalRetraitGlobal = 0, fondDeCaisseJ1Global = 0;
    const rowsHtml = state.selectedCaisses.map(id => {
        const caisseData = state.appState.calculatorData.caisse[id];
        const { totalVentes, totalCompteEspeces } = calculateEcartsForCaisse(id, state.appState, state.config);
        const { totalToWithdraw } = calculateWithdrawalSuggestion(caisseData, state.config);
        const fondDeCaisseJ1 = totalCompteEspeces - totalToWithdraw;
        totalVentesGlobal += totalVentes;
        totalRetraitGlobal += totalToWithdraw;
        fondDeCaisseJ1Global += fondDeCaisseJ1;
        return `<tr><td>${state.config.nomsCaisses[id]}</td><td>${formatCurrency(totalVentes, state.config)}</td><td class="text-danger">${formatCurrency(totalToWithdraw, state.config)}</td><td class="text-success">${formatCurrency(fondDeCaisseJ1, state.config)}</td></tr>`;
    }).join('');
    container.innerHTML = `<div class="cloture-final-summary-banner"><div class="banner-header"><h4><i class="fa-solid fa-flag-checkered"></i> Prêt pour la clôture finale</h4><p>Vérifiez les totaux ci-dessous. Cette action est irréversible et créera les écritures pour le jour suivant.</p></div><div class="summary-table-container"><table class="final-summary-table"><thead><tr><th>Caisse</th><th>Ventes Totales</th><th>Retrait Espèces</th><th>Fond de Caisse J+1</th></tr></thead><tbody>${rowsHtml}</tbody><tfoot><tr><td><strong>TOTAL</strong></td><td><strong>${formatCurrency(totalVentesGlobal, state.config)}</strong></td><td class="text-danger"><strong>${formatCurrency(totalRetraitGlobal, state.config)}</strong></td><td class="text-success"><strong>${formatCurrency(fondDeCaisseJ1Global, state.config)}</strong></td></tr></tfoot></table></div><div class="banner-actions"><button class="btn save-btn" id="confirm-final-cloture-banner">Confirmer et Terminer la Journée</button></div></div>`;
}

export function updateUIForClotureMode() {
    const isClotureActive = state.isActive;
    const bannerContainer = document.getElementById('cloture-banner-container');
    const finalSummaryContainer = document.getElementById('cloture-final-summary-banner-container');
    const clotureBtn = document.getElementById('cloture-btn');
    if (bannerContainer) {
        bannerContainer.innerHTML = isClotureActive ? `<div class="cloture-mode-banner"><i class="fa-solid fa-lock"></i><div><strong>Mode Clôture Activé</strong><p>Vérifiez et validez les chiffres de chaque caisse sélectionnée avant de finaliser.</p></div></div>` : '';
    }
    if (clotureBtn) {
        if (isClotureActive) {
            clotureBtn.innerHTML = `<i class="fa-solid fa-xmark"></i> Annuler la Clôture`;
            clotureBtn.disabled = false;
        } else {
            clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture';
            clotureBtn.disabled = clotureBtn.dataset.wsReady !== 'true';
        }
    }
    
    // --- DÉBUT DE LA CORRECTION ---
    // La condition pour afficher le bandeau final est maintenant plus stricte.
    if (finalSummaryContainer) {
        const allValidated = isClotureActive && state.selectedCaisses.length > 0 && state.selectedCaisses.every(id => state.validatedCaisses.has(id));
        if (allValidated) {
            renderFinalSummaryBanner();
        } else {
            finalSummaryContainer.innerHTML = '';
        }
    }
    
    document.querySelectorAll('.tab-link').forEach(tab => {
        const caisseId = tab.dataset.caisseId;
        const isSelectedForCloture = state.selectedCaisses.includes(caisseId);
        const isLockedByMe = isClotureActive && isSelectedForCloture;
        const isValidated = state.validatedCaisses.has(caisseId);

        const ecartDisplay = document.getElementById(`ecart-display-caisse${caisseId}`);
        if (!ecartDisplay) return;
        
        // On cible la div spécifique à la validation dans l'encart de la caisse.
        const validationArea = ecartDisplay.querySelector('.cloture-validation-area');
        if (validationArea) {
            if (isLockedByMe) {
                validationArea.innerHTML = isValidated ? 
                    `<p class="validation-message"><i class="fa-solid fa-check-circle"></i> Caisse validée !</p>` : 
                    `<button class="btn save-btn validate-caisse-btn" data-caisse-id="${caisseId}">✅ Valider les chiffres de cette caisse</button>`;
            } else {
                validationArea.innerHTML = '';
            }
        }
        
        if (tab) {
            tab.classList.remove('cloture-en-cours', 'cloturee');
            const statusSpan = tab.querySelector('.tab-status-text');
            if (statusSpan) statusSpan.remove();

            if (isLockedByMe && !isValidated) {
                tab.classList.add('cloture-en-cours');
                tab.insertAdjacentHTML('beforeend', '<span class="tab-status-text">(En cours)</span>');
            } else if (isValidated) {
                tab.classList.add('cloturee');
                tab.insertAdjacentHTML('beforeend', '<span class="tab-status-text">(Validée)</span>');
            }
        }
    });
    // --- FIN DE LA CORRECTION ---
}

export function updateClotureUI(wsData, wsResourceId) {
    if (state.isActive) return;
    const lockedCaisses = wsData.caisses || [];
    const closedCaisses = (wsData.closed_caisses || []).map(String);
    document.querySelectorAll('.tab-link').forEach(tab => {
        const caisseId = tab.dataset.caisseId;
        const lockInfo = lockedCaisses.find(c => c.caisse_id.toString() === caisseId);
        const isClosed = closedCaisses.includes(caisseId);
        const isLockedByOther = lockInfo && String(lockInfo.locked_by) !== String(wsResourceId);
        tab.classList.toggle('locked-by-other', isLockedByOther);
        tab.classList.toggle('cloturee', isClosed);
        const statusSpan = tab.querySelector('.tab-status-text');
        if (statusSpan) statusSpan.remove();
        if (isLockedByOther) {
            tab.insertAdjacentHTML('beforeend', '<span class="tab-status-text">(Verrouillée)</span>');
        }
        if (isClosed) {
            tab.insertAdjacentHTML('beforeend', '<span class="tab-status-text">(Clôturée)</span>');
        }
        const formFields = document.querySelectorAll(`#caisse${caisseId} input, #caisse${caisseId} button, #caisse${caisseId} textarea`);
        formFields.forEach(field => field.disabled = isLockedByOther || isClosed);
    });
    const allCaisseIds = Object.keys(state.config.nomsCaisses || {});
    const allAreClosed = allCaisseIds.length > 0 && allCaisseIds.every(id => closedCaisses.includes(id));
    if (allAreClosed) {
        state.isActive = true;
        state.selectedCaisses = allCaisseIds;
        state.validatedCaisses = new Set(allCaisseIds);
        updateUIForClotureMode();
    }
}
