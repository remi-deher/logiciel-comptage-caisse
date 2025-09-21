// Fichier : public/assets/js/logic/cloture-logic.js (Version avec meilleure intégration UI et verbalisation)

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
    console.log("INITIALISATION DU MODULE DE CLÔTURE");
    state.config = appConfig;
    state.appState = appState;
    state.wsResourceId = wsResourceId;
    attachClotureEventListeners();
}

/**
 * Attache les écouteurs d'événements globaux pour la clôture.
 */
function attachClotureEventListeners() {
    console.log("Attache des écouteurs d'événements pour la clôture.");
    document.body.addEventListener('click', e => {
        const target = e.target;
        if (target.closest('#cloture-btn')) {
            console.log("%cCLIC DÉTECTÉ : Bouton de Clôture principal", "color: blue; font-weight: bold;");
            if (state.isActive) {
                console.log("-> Mode clôture déjà actif. Lancement de la modale de résumé final.");
                renderFinalSummaryModal();
            } else {
                console.log("-> Mode clôture inactif. Lancement de la modale de sélection des caisses.");
                renderSelectionModal();
            }
        }
        if (target.closest('#cloture-selection-modal .modal-close') || target.closest('#cancel-selection-btn')) {
            console.log("CLIC DÉTECTÉ : Annulation de la sélection des caisses.");
            document.getElementById('cloture-selection-modal')?.remove();
        }
        if (target.closest('#confirm-selection-btn')) {
            const modal = document.getElementById('cloture-selection-modal');
            const selected = Array.from(modal.querySelectorAll('input:checked')).map(cb => cb.value);
            console.log(`CLIC DÉTECTÉ : Confirmation de la sélection avec ${selected.length} caisse(s) :`, selected);
            if (selected.length > 0) {
                startClotureMode(selected);
                modal.remove();
            }
        }
        if (target.closest('#final-summary-modal .modal-close') || target.closest('#cancel-final-summary')) {
            console.log("CLIC DÉTECTÉ : Annulation du résumé final.");
            document.getElementById('final-summary-modal')?.remove();
        }
        if (target.closest('#confirm-final-cloture')) {
            console.log("%cCLIC DÉTECTÉ : Confirmation de la clôture finale.", "color: green; font-weight: bold;");
            handleFinalSubmit();
        }
    });

    // Écouteur déplacé vers une zone plus stable que main-content qui peut être redessiné
    document.getElementById('app').addEventListener('click', e => {
        if (e.target.closest('.validate-caisse-btn')) {
            const caisseId = e.target.closest('.validate-caisse-btn').dataset.caisseId;
            console.log(`CLIC DÉTECTÉ : Validation de la caisse ID ${caisseId}.`);
            validateCaisse(caisseId);
        }
    });

    document.body.addEventListener('change', e => {
        if (e.target.closest('#cloture-selection-modal')) {
             const modal = document.getElementById('cloture-selection-modal');
             const count = modal.querySelectorAll('input:checked').length;
             console.log(`Changement dans la sélection : ${count} caisse(s) sélectionnée(s).`);
             modal.querySelector('#confirm-selection-btn').disabled = count === 0;
        }
    });
}


/**
 * Affiche la modale de sélection des caisses à clôturer.
 */
function renderSelectionModal() {
    console.log("--- Fonction renderSelectionModal ---");
    const lockedCaisses = state.appState.lockedCaisses || [];
    const closedCaisses = state.appState.closedCaisses || [];
    const wsId = state.wsResourceId;
    console.log("État actuel des caisses :", { lockedCaisses, closedCaisses, myWsId: wsId });

    const caisseOptionsHtml = Object.entries(state.config.nomsCaisses).map(([id, nom]) => {
        const isClosed = closedCaisses.includes(id);
        const lockInfo = lockedCaisses.find(c => c.caisse_id.toString() === id);
        const isLockedByOther = lockInfo && String(lockInfo.locked_by) !== wsId;
        const isDisabled = isClosed || isLockedByOther;
        console.log(`- Caisse '${nom}' (ID ${id}): Fermée=${isClosed}, VerrouilléeParAutre=${isLockedByOther}`);

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
    console.log("Modale de sélection affichée.");
}

/**
 * Active le "Mode Clôture" sur l'interface du calculateur.
 */
export function startClotureMode(selectedCaisses) {
    console.log("%c--- DÉBUT DU MODE CLÔTURE ---", "background-color: #8a2be2; color: white; padding: 2px 5px;");
    state.isActive = true;
    state.selectedCaisses = selectedCaisses;
    state.validatedCaisses.clear();

    selectedCaisses.forEach(id => {
        console.log(`Envoi WebSocket : Verrouillage de la caisse ID ${id}`);
        sendWsMessage({ type: 'cloture_lock', caisse_id: id });
    });
    
    updateUIForClotureMode();
}

/**
 * Annule le "Mode Clôture" et restaure l'interface.
 */
export function cancelClotureMode() {
    console.warn("%c--- ANNULATION DU MODE CLÔTURE ---", "background-color: #7f8c8d; color: white; padding: 2px 5px;");
    state.selectedCaisses.forEach(id => {
        console.log(`Envoi WebSocket : Déverrouillage de la caisse ID ${id}`);
        sendWsMessage({ type: 'cloture_unlock', caisse_id: id })
    });
    
    state.isActive = false;
    state.selectedCaisses = [];
    state.validatedCaisses.clear();

    updateUIForClotureMode();
}


/**
 * Marque une caisse comme validée par l'utilisateur.
 */
function validateCaisse(caisseId) {
    console.log(`Validation de la caisse ${caisseId} enregistrée.`);
    state.validatedCaisses.add(caisseId);
    updateUIForClotureMode();
}

/**
 * Affiche la modale de récapitulatif final avant de terminer.
 */
function renderFinalSummaryModal() {
    console.log("--- Fonction renderFinalSummaryModal ---");
    let totalVentesGlobal = 0, totalRetraitGlobal = 0, fondDeCaisseJ1Global = 0;

    const rowsHtml = state.selectedCaisses.map(id => {
        const caisseData = state.appState.calculatorData.caisse[id];
        const { totalVentes, totalCompteEspeces } = calculateEcartsForCaisse(id, state.appState, state.config);
        const { totalToWithdraw } = calculateWithdrawalSuggestion(caisseData, state.config);
        const fondDeCaisseJ1 = totalCompteEspeces - totalToWithdraw;
        console.log(`- Caisse ID ${id}: Ventes=${totalVentes}, Retrait=${totalToWithdraw}, FDC J+1=${fondDeCaisseJ1}`);

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
    console.log("Modale de résumé final affichée.");
}

async function handleFinalSubmit() {
    console.log("--- Fonction handleFinalSubmit ---");
    const modal = document.getElementById('final-summary-modal');
    try {
        const formData = new FormData(document.getElementById('caisse-form'));
        state.selectedCaisses.forEach(id => formData.append('caisses_a_cloturer[]', id));
        console.log("Préparation des données à envoyer au serveur...");
        
        state.selectedCaisses.forEach(id => {
            const { suggestions } = calculateWithdrawalSuggestion(state.appState.calculatorData.caisse[id], state.config);
            (suggestions || []).forEach(s => {
                formData.append(`retraits[${id}][${s.name}]`, s.qty);
            });
        });
        
        console.log("Envoi de la requête de clôture finale à l'API...");
        const response = await fetch('index.php?route=cloture/confirm_caisse', { method: 'POST', body: formData });
        const result = await response.json();
        console.log("Réponse de l'API :", result);
        if (!result.success) throw new Error(result.message);
        
        alert('Clôture réussie !');
        console.log("Envoi WebSocket : Forcer le rechargement de tous les clients.");
        sendWsMessage({ type: 'force_reload_all' });

    } catch (error) {
        console.error("ERREUR lors de la soumission finale :", error);
        alert(`Erreur: ${error.message}`);
    } finally {
        modal?.remove();
    }
}


/**
 * Met à jour l'état de l'interface (champs, boutons, bandeaux, onglets) en fonction du mode clôture.
 */
export function updateUIForClotureMode() {
    console.log("Mise à jour de l'interface pour le mode clôture.");
    const isClotureActive = state.isActive;
    const bannerContainer = document.getElementById('cloture-banner-container');
    const clotureBtn = document.getElementById('cloture-btn');
    
    if (bannerContainer) {
        if (isClotureActive) {
            bannerContainer.innerHTML = `
                <div class="cloture-mode-banner">
                    <i class="fa-solid fa-lock"></i>
                    <div>
                        <strong>Mode Clôture Activé</strong>
                        <p>Vérifiez et validez les chiffres de chaque caisse sélectionnée avant de finaliser.</p>
                    </div>
                </div>
            `;
        } else {
            bannerContainer.innerHTML = '';
        }
    }
    
    if (clotureBtn) {
        if (isClotureActive) {
            const allValidated = state.selectedCaisses.length > 0 && state.selectedCaisses.every(id => state.validatedCaisses.has(id));
            console.log(`Bouton Finaliser : ${state.validatedCaisses.size}/${state.selectedCaisses.length} validées. Cliquable = ${allValidated}`);
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

        const ecartDisplay = document.getElementById(`ecart-display-caisse${caisseId}`);
        if (!ecartDisplay) return;

        let validationArea = ecartDisplay.querySelector('.cloture-validation-area');

        if (isLockedByMe && !validationArea) {
            validationArea = document.createElement('div');
            validationArea.className = 'cloture-validation-area';
            ecartDisplay.appendChild(validationArea);
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
            tabLink.classList.remove('cloture-en-cours', 'cloturee');
            const statusSpan = tabLink.querySelector('.tab-status-text');
            if (statusSpan) statusSpan.remove();

            if(isLockedByMe && !isValidated) {
                tabLink.classList.add('cloture-en-cours');
                tabLink.insertAdjacentHTML('beforeend', '<span class="tab-status-text">(En cours)</span>');
            }
            if(isValidated) {
                tabLink.classList.add('cloturee');
                 tabLink.insertAdjacentHTML('beforeend', '<span class="tab-status-text">(Validée)</span>');
            }
        }
    });
}


/**
 * Met à jour l'UI en fonction des données WebSocket reçues (verrouillage par d'autres).
 */
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
        if(isClosed) {
             tab.insertAdjacentHTML('beforeend', '<span class="tab-status-text">(Clôturée)</span>');
        }

        const formFields = document.querySelectorAll(`#caisse${caisseId} input, #caisse${caisseId} button, #caisse${caisseId} textarea`);
        formFields.forEach(field => field.disabled = isLockedByOther || isClosed);
    });
}
