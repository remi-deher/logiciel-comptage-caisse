// Fichier : public/assets/js/logic/cloture-logic.js (Version Complète et Finale)

import { sendWsMessage } from './websocket-service.js';

// --- Variables d'état du module ---
let config = {};
let lockedCaisses = [];
let closedCaisses = [];
let resourceId = null; // Notre ID de connexion WebSocket

// --- Fonctions Utilitaires ---
const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(amount);
const parseLocaleFloat = (str) => parseFloat(String(str || '0').replace(',', '.')) || 0;

// --- Rendu des Modales ---
function renderModals(container) {
    container.innerHTML = `
        <div id="caisse-selection-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header-cloture"><h3><i class="fa-solid fa-store"></i> Gestion de la Clôture</h3></div>
                <div class="modal-body-cloture"></div>
                <div class="modal-actions" style="justify-content: flex-end;">
                    <button class="btn delete-btn modal-close-btn">Fermer</button>
                </div>
            </div>
        </div>

        <div id="cloture-confirmation-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header"><h3>Confirmer la clôture de : <span id="confirm-caisse-name"></span></h3></div>
                <div id="confirm-caisse-summary"></div>
                <p class="warning-text">Cette action est irréversible et créera un enregistrement final dans l'historique.</p>
                <div class="modal-actions">
                    <button id="cancel-cloture-btn" class="btn delete-btn">Annuler</button>
                    <button id="confirm-final-cloture-btn" class="btn save-btn">Confirmer la Clôture</button>
                </div>
            </div>
        </div>
        
        <div id="cloture-generale-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header"><h3><i class="fa-solid fa-flag-checkered"></i> Clôture Générale</h3></div>
                <p>Toutes les caisses ont été confirmées. Voici le récapitulatif final avant de préparer la journée suivante.</p>
                <div class="accordion-container" id="cloture-generale-summary"></div>
                <div class="modal-actions" style="justify-content: flex-end;">
                    <button class="btn delete-btn modal-close-btn">Annuler</button>
                    <button id="confirm-cloture-generale-btn" class="btn save-btn">Lancer la Clôture Générale</button>
                </div>
            </div>
        </div>

        <div id="final-confirmation-modal" class="modal">
            <div class="modal-content">
                 <div class="modal-header-danger" style="background-color: var(--color-danger); color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h3><i class="fa-solid fa-triangle-exclamation"></i> Êtes-vous absolument sûr ?</h3>
                 </div>
                 <div style="padding: 20px 0;">
                    <p>Cette action va finaliser tous les comptages et réinitialiser les caisses pour demain. Elle ne peut pas être annulée.</p>
                 </div>
                 <div class="modal-actions">
                    <button class="btn delete-btn modal-close-btn">Annuler</button>
                    <button id="confirm-final-cloture-action-btn" class="btn save-btn">Oui, terminer la journée</button>
                 </div>
            </div>
        </div>
    `;
}

function updateCaisseSelectionModal() {
    const container = document.querySelector('.modal-body-cloture');
    if (!container) return;

    const isLocked = (id) => lockedCaisses.some(c => c.caisse_id.toString() === id.toString());
    const isLockedByMe = (id) => lockedCaisses.some(c => c.caisse_id.toString() === id.toString() && c.locked_by.toString() === resourceId.toString());

    const listHtml = Object.entries(config.nomsCaisses).map(([id, nom]) => {
        let statusClass = 'libre', actionHtml = '';
        if (closedCaisses.includes(id)) {
            statusClass = 'cloturee';
            actionHtml = `<span><i class="fa-solid fa-check"></i> Clôturée</span>`;
        } else if (isLocked(id)) {
            statusClass = 'en-cours';
            actionHtml = isLockedByMe(id) 
                ? `<button class="confirm-cloture-btn btn new-btn" data-caisse-id="${id}"><i class="fa-solid fa-check-circle"></i> Confirmer</button>`
                : `<span><i class="fa-solid fa-user-lock"></i> Verrouillée</span>`;
        } else {
            actionHtml = `<button class="lock-caisse-btn btn save-btn" data-caisse-id="${id}"><i class="fa-solid fa-lock"></i> Verrouiller</button>`;
        }
        return `<div class="caisse-status-item caisse-status-${statusClass}"><strong>${nom}</strong><div class="status-actions">${actionHtml}</div></div>`;
    }).join('');

    container.innerHTML = `
        <div class="color-key" style="display: flex; justify-content: center; gap: 20px; margin-bottom: 25px;">
            <div><span class="color-dot" style="background-color: var(--color-success);"></span> Libre</div>
            <div><span class="color-dot" style="background-color: #8a2be2;"></span> En cours</div>
            <div><span class="color-dot" style="background-color: var(--color-warning);"></span> Clôturée</div>
        </div>
        <div class="caisse-status-list">${listHtml}</div>
    `;
}

function calculateCaisseDataForConfirmation(caisseId) {
    let totalCompte = 0;
    const allDenoms = {...config.denominations.billets, ...config.denominations.pieces};
    for (const name in allDenoms) {
        const input = document.getElementById(`${name}_${caisseId}`);
        if (input) totalCompte += (parseInt(input.value, 10) || 0) * allDenoms[name];
    }
    const fondDeCaisse = parseLocaleFloat(document.getElementById(`fond_de_caisse_${caisseId}`).value);
    const ventes = parseLocaleFloat(document.getElementById(`ventes_${caisseId}`).value);
    const retrocession = parseLocaleFloat(document.getElementById(`retrocession_${caisseId}`).value);
    const recetteReelle = totalCompte - fondDeCaisse;
    const ecart = recetteReelle - (ventes + retrocession);
    return { recetteReelle, ecart, totalCompte, fondDeCaisse };
}

function showClotureGeneraleModal() {
    const summaryContainer = document.getElementById('cloture-generale-summary');
    if (!summaryContainer) return;

    let totalGeneral = 0;
    summaryContainer.innerHTML = Object.entries(config.nomsCaisses).map(([id, nom]) => {
        const data = calculateCaisseDataForConfirmation(id);
        totalGeneral += data.totalCompte;
        return `<div class="card" style="text-align:center;"><h5>${nom}</h5><p>Total : <strong>${formatCurrency(data.totalCompte)}</strong></p></div>`;
    }).join('');

    summaryContainer.innerHTML += `<h3 style="text-align:center; margin-top:20px;">Total Général en Caisse : ${formatCurrency(totalGeneral)}</h3>`;
    document.getElementById('cloture-generale-modal').classList.add('visible');
}

// --- Point d'entrée de la logique ---
export function initializeCloture(appConfig, wsResourceId) {
    config = appConfig;
    resourceId = wsResourceId;
    const modalsContainer = document.getElementById('modals-container');
    const clotureBtn = document.getElementById('cloture-btn');

    if (!modalsContainer || !clotureBtn) return;
    
    renderModals(modalsContainer);

    const caisseSelectionModal = document.getElementById('caisse-selection-modal');
    const clotureConfirmationModal = document.getElementById('cloture-confirmation-modal');
    const clotureGeneraleModal = document.getElementById('cloture-generale-modal');
    const finalConfirmationModal = document.getElementById('final-confirmation-modal');

    clotureBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('index.php?route=cloture/get_state');
            const state = await response.json();
            lockedCaisses = state.locked_caisses || [];
            closedCaisses = (state.closed_caisses || []).map(String);

            const allCaissesClosed = Object.keys(config.nomsCaisses).length > 0 && 
                                     Object.keys(config.nomsCaisses).every(id => closedCaisses.includes(id));

            if (allCaissesClosed) {
                showClotureGeneraleModal();
            } else {
                updateCaisseSelectionModal();
                caisseSelectionModal.classList.add('visible');
            }
        } catch (error) {
            alert(`Erreur: ${error.message}`);
        }
    });

    modalsContainer.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.closest('.modal-close-btn') || target.classList.contains('modal')) {
            target.closest('.modal')?.classList.remove('visible');
        } else if (target.closest('.lock-caisse-btn')) {
            sendWsMessage({ type: 'cloture_lock', caisse_id: target.closest('.lock-caisse-btn').dataset.caisseId });
            caisseSelectionModal.classList.remove('visible');
        } else if (target.closest('.confirm-cloture-btn')) {
            const caisseId = target.closest('.confirm-cloture-btn').dataset.caisseId;
            const data = calculateCaisseDataForConfirmation(caisseId);
            document.getElementById('confirm-caisse-name').textContent = config.nomsCaisses[caisseId];
            document.getElementById('confirm-caisse-summary').innerHTML = `<div style="background-color: var(--color-surface-alt); padding: 15px; border-radius: 8px;"><div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><span>Recette réelle :</span> <strong>${formatCurrency(data.recetteReelle)}</strong></div><div style="display:flex; justify-content:space-between;"><span>Écart constaté :</span> <strong>${formatCurrency(data.ecart)}</strong></div></div>`;
            clotureConfirmationModal.querySelector('#confirm-final-cloture-btn').dataset.caisseId = caisseId;
            clotureConfirmationModal.querySelector('#cancel-cloture-btn').dataset.caisseId = caisseId;
            caisseSelectionModal.classList.remove('visible');
            clotureConfirmationModal.classList.add('visible');
        } else if (target.id === 'confirm-final-cloture-btn') {
            const caisseId = target.dataset.caisseId;
            const form = document.getElementById('caisse-form');
            const formData = new FormData(form);
            formData.append('caisse_id_a_cloturer', caisseId);
            try {
                const response = await fetch('index.php?route=cloture/confirm_caisse', { method: 'POST', body: formData });
                const result = await response.json();
                if (!result.success) throw new Error(result.message);
                alert('Caisse clôturée avec succès !');
                sendWsMessage({ type: 'cloture_caisse_confirmed', caisse_id: caisseId });
                clotureConfirmationModal.classList.remove('visible');
            } catch (error) { alert(`Erreur: ${error.message}`); }
        } else if (target.id === 'cancel-cloture-btn') {
            sendWsMessage({ type: 'cloture_unlock', caisse_id: target.dataset.caisseId });
            clotureConfirmationModal.classList.remove('visible');
        } else if (target.id === 'confirm-cloture-generale-btn') {
            clotureGeneraleModal.classList.remove('visible');
            finalConfirmationModal.classList.add('visible');
        } else if (target.id === 'confirm-final-cloture-action-btn') {
            finalConfirmationModal.classList.remove('visible');
            try {
                const response = await fetch('index.php?route=cloture/confirm_generale', { method: 'POST', body: new FormData(document.getElementById('caisse-form')) });
                const result = await response.json();
                if (!result.success) throw new Error(result.message);
                alert('Clôture générale réussie ! La page va se réinitialiser.');
                window.location.reload();
            } catch (error) { alert(`Erreur: ${error.message}`); }
        }
    });
}

export function updateClotureUI(newState) {
    lockedCaisses = newState.caisses || [];
    closedCaisses = (newState.closed_caisses || []).map(String);
    if (document.getElementById('caisse-selection-modal')?.classList.contains('visible')) {
        updateCaisseSelectionModal();
    }
    document.querySelectorAll('.tab-link').forEach(tab => {
        const caisseId = tab.dataset.tab.replace('caisse', '');
        tab.classList.remove('cloturee', 'cloture-en-cours');
        if (closedCaisses.includes(caisseId)) tab.classList.add('cloturee');
        else if (lockedCaisses.some(c => c.caisse_id.toString() === caisseId)) tab.classList.add('cloture-en-cours');
    });
    document.querySelectorAll('#caisse-form input, #caisse-form textarea').forEach(field => {
        const fieldCaisseId = field.name.match(/caisse\[(\d+)\]/)?.[1];
        if (fieldCaisseId) {
            const isLockedByOther = lockedCaisses.some(c => c.caisse_id.toString() === fieldCaisseId && c.locked_by.toString() !== resourceId.toString());
            field.disabled = closedCaisses.includes(fieldCaisseId) || isLockedByOther;
        }
    });
}
