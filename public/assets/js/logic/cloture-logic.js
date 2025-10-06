// Fichier : public/assets/js/logic/cloture-logic.js (Final et Corrigé)

import { sendWsMessage } from './websocket-service.js';
import * as service from './calculator-service.js';

/**
 * Affiche une modale de confirmation personnalisée.
 * @param {string} title - Le titre de la modale.
 * @param {string} message - Le message à afficher dans la modale.
 * @param {function} onConfirm - La fonction à exécuter si l'utilisateur confirme.
 * @param {string} confirmButtonClass - La classe CSS pour le bouton de confirmation (ex: 'save-btn', 'delete-btn').
 */
function showConfirmationModal(title, message, onConfirm, confirmButtonClass = 'save-btn') {
    const modal = document.getElementById('confirmation-modal');
    const titleEl = document.getElementById('confirmation-modal-title');
    const messageEl = document.getElementById('confirmation-modal-message');
    const confirmBtn = document.getElementById('confirmation-modal-confirm-btn');
    const cancelBtn = document.getElementById('confirmation-modal-cancel-btn');
    const closeModalBtns = modal.querySelectorAll('.modal-close');

    titleEl.textContent = title;
    messageEl.textContent = message;

    // Appliquer le style de couleur au bouton de confirmation
    confirmBtn.className = `btn ${confirmButtonClass}`;

    modal.classList.add('visible');

    // On utilise .cloneNode(true) pour supprimer les anciens écouteurs d'événements
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    const closeModal = () => modal.classList.remove('visible');

    newConfirmBtn.addEventListener('click', () => {
        closeModal();
        onConfirm(); // Exécute l'action de confirmation
    });

    cancelBtn.addEventListener('click', closeModal);
    closeModalBtns.forEach(btn => btn.addEventListener('click', closeModal));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}


/**
 * Démarre le processus de clôture pour une seule caisse.
 */
export function startClotureCaisse(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    showConfirmationModal(
        'Démarrer la Clôture',
        `Voulez-vous démarrer la clôture pour la caisse "${caisseNom}" ? Cette action la verrouillera pour les autres utilisateurs.`,
        () => {
            sendWsMessage({ type: 'cloture_lock', caisse_id: caisseId });
        }
    );
}

/**
 * Annule le processus de clôture pour une seule caisse.
 */
export function cancelClotureCaisse(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    showConfirmationModal(
        'Annuler la Clôture',
        `Voulez-vous annuler la clôture pour la caisse "${caisseNom}" et la déverrouiller ?`,
        () => {
            sendWsMessage({ type: 'cloture_unlock', caisse_id: caisseId });
        },
        'delete-btn' // Bouton rouge pour une action d'annulation
    );
}

/**
 * Demande la réouverture d'une caisse déjà clôturée.
 */
export function reopenCaisse(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    showConfirmationModal(
        'Réouvrir la Caisse',
        `Voulez-vous réouvrir la caisse "${caisseNom}" ?\n\nCela la rendra de nouveau modifiable.`,
        () => {
            sendWsMessage({ type: 'cloture_reopen', caisse_id: caisseId });
        },
        'action-btn' // Bouton neutre
    );
}

/**
 * Gère la validation finale d'une caisse.
 */
export async function validateClotureCaisse(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    showConfirmationModal(
        'Confirmer la Clôture',
        `Confirmez-vous la clôture définitive de la caisse "${caisseNom}" ?`,
        async () => {
            const validateButton = document.querySelector(`.cloture-validate-btn[data-caisse-id="${caisseId}"]`);
            if(validateButton) {
                validateButton.disabled = true;
                validateButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Validation...`;
            }

            try {
                const formData = service.prepareSingleCaisseClotureData(caisseId, state);
                const result = await service.submitSingleCaisseCloture(formData);
                if (!result.success) throw new Error(result.message);

                alert(`La caisse "${caisseNom}" a été clôturée avec succès.`);
                
                sendWsMessage({ type: 'cloture_state_changed' });

            } catch (error) {
                alert(`Erreur lors de la validation : ${error.message}`);
                if(validateButton) {
                    validateButton.disabled = false;
                    validateButton.innerHTML = `<i class="fa-solid fa-check"></i> Valider la clôture`;
                }
            }
        }
    );
}

/**
 * Déclenche la finalisation de la journée.
 */
export async function finalizeDay() {
     showConfirmationModal(
        'Finaliser la Journée',
        "Toutes les caisses sont clôturées. Voulez-vous finaliser et archiver la journée ? Cette action est irréversible.",
        async () => {
            const finalizeButton = document.getElementById('finalize-day-btn');
            if(finalizeButton) {
                finalizeButton.disabled = true;
                finalizeButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Finalisation...`;
            }
            try {
                const result = await service.submitClotureGenerale();
                if (!result.success) throw new Error(result.message);

                alert(result.message);
                sendWsMessage({ type: 'force_reload_all' });

            } catch (error) {
                 alert(`Erreur lors de la finalisation : ${error.message}`);
                 if(finalizeButton) {
                    finalizeButton.disabled = false;
                    finalizeButton.innerHTML = `Finaliser et Archiver la Journée`;
                 }
            }
        }
    );
}
