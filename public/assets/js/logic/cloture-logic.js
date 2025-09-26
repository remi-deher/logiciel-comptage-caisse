// Fichier : public/assets/js/logic/cloture-logic.js (Refonte Complète et Finale)

import { sendWsMessage } from './websocket-service.js';
import * as service from './calculator-service.js';

/**
 * Démarre le processus de clôture pour une seule caisse.
 * @param {string} caisseId L'ID de la caisse à verrouiller.
 * @param {object} state L'état global de l'application.
 */
export function startClotureCaisse(caisseId, state) {
    if (confirm(`Voulez-vous démarrer la clôture pour la caisse "${state.config.nomsCaisses[caisseId]}" ?\nElle sera verrouillée pour les autres utilisateurs.`)) {
        sendWsMessage({ type: 'cloture_lock', caisse_id: caisseId });
    }
}

/**
 * Annule le processus de clôture pour une seule caisse.
 * @param {string} caisseId L'ID de la caisse à déverrouiller.
 * @param {object} state L'état global de l'application.
 */
export function cancelClotureCaisse(caisseId, state) {
    if (confirm(`Voulez-vous annuler la clôture pour la caisse "${state.config.nomsCaisses[caisseId]}" ?\nElle sera déverrouillée.`)) {
        sendWsMessage({ type: 'cloture_unlock', caisse_id: caisseId });
    }
}

/**
 * Gère la validation finale d'une caisse.
 * Envoie toutes les données au serveur pour enregistrement.
 * @param {string} caisseId L'ID de la caisse à valider.
 * @param {object} state L'état global de l'application.
 */
export async function validateClotureCaisse(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    if (confirm(`Confirmez-vous la clôture de la caisse "${caisseNom}" ?\nCette action est définitive pour cette caisse.`)) {
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
            // Le serveur notifiera tous les clients via WebSocket pour mettre à jour l'interface.

        } catch (error) {
            alert(`Erreur lors de la validation : ${error.message}`);
            if(validateButton) {
                validateButton.disabled = false;
                validateButton.innerHTML = `<i class="fa-solid fa-check"></i> Valider la clôture`;
            }
        }
    }
}

/**
 * Déclenche la finalisation de la journée après que toutes les caisses ont été clôturées.
 */
export async function finalizeDay() {
     if (confirm("Toutes les caisses sont clôturées. Voulez-vous finaliser et archiver la journée ?\nCette action est IRREVERSIBLE.")) {
        const finalizeButton = document.getElementById('finalize-day-btn');
        if(finalizeButton) {
            finalizeButton.disabled = true;
            finalizeButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Finalisation...`;
        }
        try {
            const result = await service.submitClotureGenerale();
            if (!result.success) throw new Error(result.message);

            alert(result.message);
            // Recharge l'application pour tout le monde pour commencer un nouvel état
            sendWsMessage({ type: 'force_reload_all' });

        } catch (error) {
             alert(`Erreur lors de la finalisation : ${error.message}`);
             if(finalizeButton) {
                finalizeButton.disabled = false;
                finalizeButton.innerHTML = `Finaliser et Archiver la Journée`;
             }
        }
    }
}
