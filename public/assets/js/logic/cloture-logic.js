// Fichier : public/assets/js/logic/cloture-logic.js (Final et Corrigé avec Toasts)

import { sendWsMessage } from './websocket-service.js';
import * as service from './calculator-service.js';
import { showToast } from '../utils/toast.js';
import { showConfirmationModal } from '../utils/ui.js'; // Mise à jour de l'import

// La fonction showConfirmationModal locale a été supprimée et est maintenant importée.

/**
 * Démarre le processus de clôture pour une seule caisse.
 */
export function startClotureCaisse(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    showConfirmationModal({
        title: 'Démarrer la Clôture',
        message: `Voulez-vous démarrer la clôture pour la caisse "${caisseNom}" ? Cette action la verrouillera pour les autres utilisateurs.`,
        onConfirm: () => {
            sendWsMessage({ type: 'cloture_lock', caisse_id: caisseId });
        }
    });
}

/**
 * Annule le processus de clôture pour une seule caisse.
 */
export function cancelClotureCaisse(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    showConfirmationModal({
        title: 'Annuler la Clôture',
        message: `Voulez-vous annuler la clôture pour la caisse "${caisseNom}" et la déverrouiller ?`,
        confirmButtonClass: 'delete-btn',
        confirmButtonText: 'Annuler la clôture',
        onConfirm: () => {
            sendWsMessage({ type: 'cloture_unlock', caisse_id: caisseId });
        }
    });
}

/**
 * Demande la réouverture d'une caisse déjà clôturée.
 */
export function reopenCaisse(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    showConfirmationModal({
        title: 'Réouvrir la Caisse',
        message: `Voulez-vous réouvrir la caisse "${caisseNom}" ?\n\nCela la rendra de nouveau modifiable.`,
        confirmButtonClass: 'action-btn',
        confirmButtonText: 'Réouvrir',
        onConfirm: () => {
            sendWsMessage({ type: 'cloture_reopen', caisse_id: caisseId });
        }
    });
}

/**
 * Gère la validation finale d'une caisse.
 */
export async function validateClotureCaisse(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    showConfirmationModal({
        title: 'Confirmer la Clôture',
        message: `Confirmez-vous la clôture définitive de la caisse "${caisseNom}" ?`,
        onConfirm: async () => {
            const validateButton = document.querySelector(`.cloture-validate-btn[data-caisse-id="${caisseId}"]`);
            if(validateButton) {
                validateButton.disabled = true;
                validateButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Validation...`;
            }

            try {
                const formData = service.prepareSingleCaisseClotureData(caisseId, state);
                const result = await service.submitSingleCaisseCloture(formData);
                if (!result.success) throw new Error(result.message);

                showToast(`La caisse "${caisseNom}" a été clôturée avec succès.`, 'success');
                
                sendWsMessage({ type: 'cloture_state_changed' });

            } catch (error) {
                showToast(`Erreur lors de la validation : ${error.message}`, 'error');
                if(validateButton) {
                    validateButton.disabled = false;
                    validateButton.innerHTML = `<i class="fa-solid fa-check"></i> Valider la clôture`;
                }
            }
        }
    });
}

/**
 * Déclenche la finalisation de la journée.
 */
export async function finalizeDay() {
     showConfirmationModal({
        title: 'Finaliser la Journée',
        message: "Toutes les caisses sont clôturées. Voulez-vous finaliser et archiver la journée ? Cette action est irréversible.",
        onConfirm: async () => {
            const finalizeButton = document.getElementById('finalize-day-btn');
            if(finalizeButton) {
                finalizeButton.disabled = true;
                finalizeButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Finalisation...`;
            }
            try {
                const result = await service.submitClotureGenerale();
                if (!result.success) throw new Error(result.message);

                showToast(result.message, 'success', 5000);
                sendWsMessage({ type: 'force_reload_all' });

            } catch (error) {
                 showToast(`Erreur lors de la finalisation : ${error.message}`, 'error');
                 if(finalizeButton) {
                    finalizeButton.disabled = false;
                    finalizeButton.innerHTML = `Finaliser et Archiver la Journée`;
                 }
            }
        }
    });
}
