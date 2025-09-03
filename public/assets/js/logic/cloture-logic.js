// Fichier : public/assets/js/logic/cloture-logic.js

import { sendWsMessage } from './websocket-service.js';

// --- Variables d'état ---
let config = {};
let lockedCaisses = [];
let closedCaisses = [];
let resourceId = null;

// --- Rendu des Modales ---

function renderModals(container) {
    container.innerHTML = `
        <div id="caisse-selection-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header-cloture">
                    <h3><i class="fa-solid fa-store"></i> Gestion de la Clôture</h3>
                    <p>Sélectionnez une caisse pour commencer la procédure.</p>
                </div>
                <div class="modal-body-cloture">
                    <div class="color-key">
                        <div><span class="color-dot color-libre"></span> Libre</div>
                        <div><span class="color-dot color-en-cours"></span> En cours</div>
                        <div><span class="color-dot color-cloturee"></span> Clôturée</div>
                    </div>
                    <div class="caisse-status-list">
                        </div>
                </div>
                 <button class="btn delete-btn modal-close-btn" style="margin-top: 15px;">Fermer</button>
            </div>
        </div>

        <div id="cloture-confirmation-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fa-solid fa-check-double"></i> Confirmer la clôture de : <span id="confirm-caisse-name"></span></h3>
                </div>
                <div id="confirm-caisse-summary"></div>
                <p class="warning-text">Cette action est irréversible.</p>
                <div class="modal-actions">
                    <button id="cancel-cloture-btn" class="btn delete-btn">Annuler</button>
                    <button id="confirm-final-cloture-btn" class="btn save-btn">Confirmer la Clôture</button>
                </div>
            </div>
        </div>
        
        `;
}

function updateCaisseSelectionModal() {
    const container = document.querySelector('.caisse-status-list');
    if (!container) return;

    const isCaisseLocked = (caisseId) => lockedCaisses.some(c => c.caisse_id.toString() === caisseId.toString());
    const isCaisseLockedByMe = (caisseId) => lockedCaisses.some(c => c.caisse_id.toString() === caisseId.toString() && c.locked_by.toString() === resourceId.toString());

    container.innerHTML = Object.entries(config.nomsCaisses).map(([id, nom]) => {
        let statusClass = 'libre';
        let actionHtml = `<button class="lock-caisse-btn btn save-btn" data-caisse-id="${id}"><i class="fa-solid fa-lock"></i> Verrouiller</button>`;
        
        if (closedCaisses.includes(id)) {
            statusClass = 'cloturee';
            actionHtml = `<span>Clôturée</span>`; // Action de réouverture à ajouter si nécessaire
        } else if (isCaisseLocked(id)) {
            statusClass = 'en-cours';
            if (isCaisseLockedByMe) {
                actionHtml = `<button class="confirm-cloture-btn btn new-btn" data-caisse-id="${id}"><i class="fa-solid fa-check-circle"></i> Confirmer</button>`;
            } else {
                actionHtml = `<span>Verrouillée par un autre utilisateur</span>`;
            }
        }
        
        return `
            <div class="caisse-status-item caisse-status-${statusClass}" data-caisse-id="${id}">
                <strong>${nom}</strong>
                <div class="status-actions">${actionHtml}</div>
            </div>
        `;
    }).join('');
}


// --- API ---
async function fetchClotureState() {
    const response = await fetch('index.php?route=cloture/get_state');
    if (!response.ok) throw new Error('Impossible de récupérer létat de la clôture.');
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Réponse invalide de l\'API de clôture.');
    return data;
}


// --- Logique principale ---

export function initializeCloture(appConfig, wsResourceId) {
    config = appConfig;
    resourceId = wsResourceId;
    const modalsContainer = document.getElementById('modals-container');
    const clotureBtn = document.getElementById('cloture-btn');

    if (!modalsContainer || !clotureBtn) return;
    
    renderModals(modalsContainer);

    const caisseSelectionModal = document.getElementById('caisse-selection-modal');
    const clotureConfirmationModal = document.getElementById('cloture-confirmation-modal');

    // Ouvre la modale principale
    clotureBtn.addEventListener('click', async () => {
        try {
            const state = await fetchClotureState();
            lockedCaisses = state.locked_caisses || [];
            closedCaisses = (state.closed_caisses || []).map(String);
            updateCaisseSelectionModal();
            caisseSelectionModal.classList.add('visible');
        } catch (error) {
            alert(`Erreur: ${error.message}`);
        }
    });

    // Gestion des clics dans les modales
    modalsContainer.addEventListener('click', async (e) => {
        // Fermeture des modales
        if (e.target.classList.contains('modal') || e.target.closest('.modal-close-btn')) {
            e.target.closest('.modal').classList.remove('visible');
        }

        // Clic sur "Verrouiller"
        if (e.target.classList.contains('lock-caisse-btn')) {
            const caisseId = e.target.dataset.caisseId;
            sendWsMessage({ type: 'cloture_lock', caisse_id: caisseId });
            caisseSelectionModal.classList.remove('visible');
        }
        
        // Clic sur "Confirmer"
        if (e.target.classList.contains('confirm-cloture-btn')) {
             const caisseId = e.target.dataset.caisseId;
             document.getElementById('confirm-caisse-name').textContent = config.nomsCaisses[caisseId];
             // TODO: Remplir le résumé du comptage
             document.getElementById('confirm-caisse-summary').innerHTML = `<p>Le résumé du comptage pour ${config.nomsCaisses[caisseId]} sera affiché ici.</p>`;
             clotureConfirmationModal.querySelector('#confirm-final-cloture-btn').dataset.caisseId = caisseId;
             clotureConfirmationModal.querySelector('#cancel-cloture-btn').dataset.caisseId = caisseId;
             caisseSelectionModal.classList.remove('visible');
             clotureConfirmationModal.classList.add('visible');
        }
        
        // Clic sur "Confirmer la Clôture" final
        if (e.target.id === 'confirm-final-cloture-btn') {
            const caisseId = e.target.dataset.caisseId;
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
            } catch (error) {
                alert(`Erreur: ${error.message}`);
            }
        }
        
        // Clic sur "Annuler" dans la confirmation
        if (e.target.id === 'cancel-cloture-btn') {
            const caisseId = e.target.dataset.caisseId;
            sendWsMessage({ type: 'cloture_unlock', caisse_id: caisseId });
            clotureConfirmationModal.classList.remove('visible');
        }
    });
}

// Met à jour l'état de l'interface (onglets, champs désactivés)
export function updateClotureUI(newState) {
    lockedCaisses = newState.caisses || [];
    closedCaisses = (newState.closed_caisses || []).map(String);

    // Mettre à jour les onglets
    document.querySelectorAll('.tab-link').forEach(tab => {
        const caisseId = tab.dataset.tab.replace('caisse', '');
        tab.classList.remove('cloturee', 'cloture-en-cours');
        if (closedCaisses.includes(caisseId)) {
            tab.classList.add('cloturee');
        } else if (lockedCaisses.some(c => c.caisse_id.toString() === caisseId)) {
            tab.classList.add('cloture-en-cours');
        }
    });

    // Mettre à jour les champs de saisie
    document.querySelectorAll('#caisse-form input, #caisse-form textarea').forEach(field => {
        const fieldCaisseId = field.dataset.caisseId;
        if (fieldCaisseId) {
            field.disabled = closedCaisses.includes(fieldCaisseId);
        }
    });
}
