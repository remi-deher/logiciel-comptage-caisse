// Fichier : public/assets/js/logic/cloture-logic.js (Corrigé pour la ReferenceError)

import { sendWsMessage } from './websocket-service.js';
import { calculateEcartsForCaisse, calculateWithdrawalSuggestion } from './calculator-service.js';
import { formatCurrency } from '../utils/formatters.js';

// --- État global du module ---
let state = {
    isActive: false,
    isWsReady: false,
    caissesToProcess: [],
    validatedCaisses: new Set(),
    config: {},
    appState: null,
    wsResourceId: null
};

// --- Fonctions publiques ---

function setClotureReady(isReady) {
    console.log(`%c[CLOTURE-LOGIC] setClotureReady: Passage de isWsReady à ${isReady}`, 'color: #e67e22');
    state.isWsReady = isReady;
    updateMainButtonState();
}

function initializeCloture(appConfig, appState, wsResourceId) {
    console.log('%c[CLOTURE-LOGIC] INITIALISATION...', 'background: #2c3e50; color: white; padding: 2px 5px;');
    state.config = appConfig;
    state.appState = appState;
    state.wsResourceId = wsResourceId;
    attachEventListeners();
}

function updateClotureUI(wsData, wsResourceId) {
    console.log('%c[CLOTURE-LOGIC] updateClotureUI: Réception d\'un état de clôture.', 'color: #f1c40f', wsData);
    if (!wsResourceId) {
        console.error("[CLOTURE-LOGIC] Impossible de mettre à jour l'UI, wsResourceId est manquant.");
        return;
    }

    const lockedCaisses = wsData.caisses || [];
    const closedCaisses = (wsData.closed_caisses || []).map(String);

    state.appState.closedCaisses = closedCaisses;

    const caissesLockedByMe = lockedCaisses
        .filter(c => String(c.locked_by) === String(wsResourceId))
        .map(c => c.caisse_id.toString());

    if (caissesLockedByMe.length > 0 && !state.isActive) {
        startClotureMode(caissesLockedByMe);
    } else if (caissesLockedByMe.length === 0 && state.isActive) {
        cancelClotureMode();
    }
    
    updateTabsAndFieldsState(lockedCaisses, closedCaisses, wsResourceId);
    updateMainButtonState();
}

// --- Logique interne ---

function attachEventListeners() {
    document.body.addEventListener('click', e => {
        const target = e.target;
        
        if (target.closest('#cloture-btn')) {
            handleMainClotureButtonClick();
            return;
        }

        const modal = document.getElementById('cloture-selection-modal');
        if (modal && modal.contains(target)) {
            handleModalEvents(e, target, modal);
        }
    });

    const tabSelector = document.querySelector('.tab-selector');
    if (tabSelector) {
        tabSelector.addEventListener('click', e => {
            if (e.target.classList.contains('tab-link')) {
                setTimeout(updateMainButtonState, 0);
            }
        });
    }

    document.body.addEventListener('change', e => {
        if (e.target.matches('input[name="caisseSelection"]')) {
             updateSelectionCount();
        }
    });

    const calculatorPage = document.getElementById('calculator-page');
    if (calculatorPage) {
        calculatorPage.addEventListener('click', e => {
            if (e.target.closest('#confirm-final-cloture-banner')) {
                handleFinalSubmit();
            }
        });
    }
}

function handleMainClotureButtonClick() {
    console.log('[CLOTURE-LOGIC] Clic sur le bouton de clôture principal.');
    const allAreClosed = allAreClosedNow();

    if (allAreClosed) {
        console.log('[CLOTURE-LOGIC] Action: Redirection vers l\'assistant de finalisation.');
        window.location.href = '/cloture-wizard';
    } else if (state.isActive) {
        console.log('[CLOTURE-LOGIC] Action: Tentative de validation de la caisse affichée.');
        validateActiveCaisse();
    } else {
        console.log('[CLOTURE-LOGIC] Action: Ouverture de la modale de sélection.');
        renderSelectionModal();
    }
}

function validateActiveCaisse() {
    const activeTab = document.querySelector('.tab-link.active');
    if (!activeTab) return;

    const caisseId = activeTab.dataset.caisseId;
    if (state.caissesToProcess.includes(caisseId) && !state.validatedCaisses.has(caisseId)) {
        if (confirm(`Vous êtes sur le point de valider la caisse "${state.config.nomsCaisses[caisseId]}".\nCette action enregistrera son état et la marquera comme clôturée.`)) {
            
            const formData = new FormData(document.getElementById('caisse-form'));
            formData.append('caisses_a_cloturer[]', caisseId);

            const { suggestions } = calculateWithdrawalSuggestion(state.appState.calculatorData.caisse[caisseId], state.config);
            (suggestions || []).forEach(s => formData.append(`retraits[${caisseId}][${s.name}]`, s.qty));
            
            fetch('index.php?route=cloture/confirm_caisse', { method: 'POST', body: formData })
                .then(res => res.json())
                .then(result => {
                    if (!result.success) throw new Error(result.message);
                    state.validatedCaisses.add(caisseId);
                })
                .catch(err => alert(`Erreur lors de la validation : ${err.message}`));
        }
    } else {
        alert("Aucune caisse active à valider. Changez d'onglet pour sélectionner une caisse en cours de clôture.");
    }
}

function allAreClosedNow() {
    if (!state.config.nomsCaisses || !state.appState.closedCaisses) return false;
    const allCaisseIds = Object.keys(state.config.nomsCaisses);
    return allCaisseIds.length > 0 && allCaisseIds.every(id => state.appState.closedCaisses.includes(id));
}

function updateMainButtonState() {
    const clotureBtn = document.getElementById('cloture-btn');
    if (!clotureBtn) return;
    console.log(`[CLOTURE-LOGIC] Mise à jour du bouton. État isWsReady: ${state.isWsReady}`);

    const allAreClosed = allAreClosedNow();

    if (allAreClosed) {
        clotureBtn.classList.remove('mode-validation');
        clotureBtn.classList.add('mode-finalisation');
        clotureBtn.innerHTML = `<i class="fa-solid fa-flag-checkered"></i> Finaliser la journée`;
        clotureBtn.disabled = false;
    } else if (state.isActive) {
        const activeTab = document.querySelector('.tab-link.active');
        const activeCaisseId = activeTab ? activeTab.dataset.caisseId : null;
        
        if (activeCaisseId && state.caissesToProcess.includes(activeCaisseId)) {
            clotureBtn.classList.remove('mode-finalisation');
            clotureBtn.classList.add('mode-validation');
            clotureBtn.innerHTML = `✅ Valider ${state.config.nomsCaisses[activeCaisseId]}`;
            clotureBtn.disabled = false;
        } else {
            clotureBtn.classList.remove('mode-validation', 'mode-finalisation');
            clotureBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Mode Clôture`;
            clotureBtn.disabled = true;
        }
    } else {
        clotureBtn.classList.remove('mode-validation', 'mode-finalisation');
        clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture';
        clotureBtn.disabled = !state.isWsReady;
    }
}

function updateTabsAndFieldsState(lockedCaisses, closedCaisses, wsResourceId) {
    document.querySelectorAll('.tab-link').forEach(tab => {
        const caisseId = tab.dataset.caisseId;
        const lockInfo = lockedCaisses.find(c => c.caisse_id.toString() === caisseId);
        const isClosed = closedCaisses.includes(caisseId);
        const isLockedByOther = lockInfo && String(lockInfo.locked_by) !== String(wsResourceId);
        const isLockedByMe = lockInfo && String(lockInfo.locked_by) === String(wsResourceId);

        const shouldBeDisabled = isLockedByOther || isClosed;

        tab.classList.toggle('locked-by-other', isLockedByOther);
        tab.classList.toggle('cloturee', isClosed);
        tab.classList.toggle('cloture-en-cours', isLockedByMe);

        const statusSpan = tab.querySelector('.tab-status-text');
        if (statusSpan) statusSpan.remove();

        if (isClosed) {
            tab.insertAdjacentHTML('beforeend', '<span class="tab-status-text">(Clôturée)</span>');
        } else if (isLockedByOther) {
            tab.insertAdjacentHTML('beforeend', '<span class="tab-status-text">(Verrouillée)</span>');
        } else if (isLockedByMe) {
            tab.insertAdjacentHTML('beforeend', '<span class="tab-status-text">(En cours)</span>');
        }

        const formFields = document.querySelectorAll(`#caisse${caisseId} input, #caisse${caisseId} button, #caisse${caisseId} textarea`);
        formFields.forEach(field => {
            if (!field.closest('#cloture-selection-modal')) {
                field.disabled = shouldBeDisabled;
            }
        });
    });
}

// --- DÉBUT DE LA CORRECTION ---
function startClotureMode(caissesLockedByMe) {
    console.log('[CLOTURE-LOGIC] Déclenchement du mode clôture pour les caisses:', caissesLockedByMe);
    state.isActive = true;
    state.caissesToProcess = caissesLockedByMe;
    state.validatedCaisses.clear();
    // On ne fait plus d'appel à une fonction inexistante ici.
    // La mise à jour de l'UI est déjà gérée par la fonction appelante (updateClotureUI).
}

function cancelClotureMode() {
    console.log('[CLOTURE-LOGIC] Annulation du mode clôture.');
    state.caissesToProcess.forEach(id => sendWsMessage({ type: 'cloture_force_unlock', caisse_id: id }));
    state.isActive = false;
    state.caissesToProcess = [];
    state.validatedCaisses.clear();
    // On ne fait plus d'appel à une fonction inexistante ici.
}
// --- FIN DE LA CORRECTION ---


function handleModalEvents(e, target, modal) {
    if (target.closest('.modal-close') || target.closest('#cancel-selection-btn')) {
        modal.remove();
    }
    if (target.closest('#confirm-selection-btn')) {
        const selected = Array.from(modal.querySelectorAll('input:checked')).map(cb => cb.value);
        if (selected.length > 0) {
            console.log(`%c[CLOTURE-LOGIC] Demande de verrouillage envoyée pour les caisses:`, 'color: orange', selected);
            selected.forEach(id => sendWsMessage({ type: 'cloture_lock', caisse_id: id }));
            modal.remove();
        }
    }
    if (target.closest('#select-all-btn')) {
        modal.querySelectorAll('input[name="caisseSelection"]:not(:disabled)').forEach(cb => cb.checked = true);
        updateSelectionCount();
    }
    if (target.closest('#deselect-all-btn')) {
        modal.querySelectorAll('input[name="caisseSelection"]:checked').forEach(cb => cb.checked = false);
        updateSelectionCount();
    }
    if (target.closest('.js-reopen-caisse')) {
        e.stopPropagation(); e.preventDefault();
        const caisseId = target.dataset.caisseId;
        const caisseNom = state.config.nomsCaisses[caisseId] || `la caisse ${caisseId}`;
        if (confirm(`Voulez-vous vraiment forcer le déverrouillage de "${caisseNom}" ?`)) {
            const messageType = target.dataset.type === 'closed' ? 'cloture_reopen' : 'cloture_force_unlock';
            sendWsMessage({ type: messageType, caisse_id: caisseId });
            target.textContent = 'Déverrouillage...';
            setTimeout(() => modal.remove(), 500);
        }
    }
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
                <div class="modal-header"><h3>Lancer une Clôture</h3><span class="modal-close">&times;</span></div>
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
                    <button class="btn save-btn" id="confirm-selection-btn" disabled>Démarrer la Clôture <span class="count" id="selection-count" style="display: none;">0</span></button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

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

export {
    setClotureReady,
    initializeCloture,
    updateClotureUI
};
