// Fichier : public/assets/js/logic/cloture-logic.js (Final et Corrigé)

import { sendWsMessage } from './websocket-service.js';
import * as service from './calculator-service.js';

/**
 * Démarre le processus de clôture pour une seule caisse.
 */
export function startClotureCaisse(caisseId, state) {
    if (confirm(`Voulez-vous démarrer la clôture pour la caisse "${state.config.nomsCaisses[caisseId]}" ?`)) {
        sendWsMessage({ type: 'cloture_lock', caisse_id: caisseId });
    }
}

/**
 * Annule le processus de clôture pour une seule caisse.
 */
export function cancelClotureCaisse(caisseId, state) {
    if (confirm(`Voulez-vous annuler la clôture pour la caisse "${state.config.nomsCaisses[caisseId]}" ?`)) {
        sendWsMessage({ type: 'cloture_unlock', caisse_id: caisseId });
    }
}

/**
 * Demande la réouverture d'une caisse déjà clôturée.
 */
export function reopenCaisse(caisseId, state) {
    if (confirm(`Voulez-vous réouvrir la caisse "${state.config.nomsCaisses[caisseId]}" ?\n\nCela la rendra de nouveau modifiable.`)) {
        sendWsMessage({ type: 'cloture_reopen', caisse_id: caisseId });
    }
}

/**
 * Gère la validation finale d'une caisse.
 */
export async function validateClotureCaisse(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    if (confirm(`Confirmez-vous la clôture de la caisse "${caisseNom}" ?`)) {
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
}

/**
 * Déclenche la finalisation de la journée.
 */
export async function finalizeDay() {
     if (confirm("Toutes les caisses sont clôturées. Voulez-vous finaliser et archiver la journée ?")) {
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
}
