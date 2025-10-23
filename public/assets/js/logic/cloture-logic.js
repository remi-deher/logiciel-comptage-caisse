// Fichier : public/assets/js/logic/cloture-logic.js (Avec Debugging Logs)

import { sendWsMessage } from './websocket-service.js';
import * as service from './calculator-service.js';
import * as ui from './calculator-ui.js';
import { showToast } from '../utils/toast.js';
import { showConfirmationModal } from '../utils/ui.js';

/**
 * Affiche la modale de récapitulatif après la clôture réussie.
 */
function showClotureSummaryModal(caisseId, state) {
    console.log("[showClotureSummaryModal] Fonction appelée pour caisse ID:", caisseId); // DEBUG 1
    const modal = document.getElementById('cloture-summary-modal');
    const modalBody = document.getElementById('cloture-summary-modal-body');
    const modalTitle = document.getElementById('cloture-summary-modal-title');

    if (!modal || !modalBody || !modalTitle) {
        console.error("[showClotureSummaryModal] ERREUR: Éléments HTML de la modale introuvables (#cloture-summary-modal)."); // DEBUG 2
        showToast("Erreur interne: Impossible d'afficher le récapitulatif.", "error");
        return;
    }

    const caisseNom = state.config.nomsCaisses[caisseId];
    modalTitle.textContent = `Récapitulatif - ${caisseNom}`;

    try {
        console.log("[showClotureSummaryModal] Génération du contenu HTML..."); // DEBUG 3
        const contentHtml = ui.renderClotureSectionContent(caisseId, state); // Appelle la fonction UI
        modalBody.innerHTML = contentHtml;
        console.log("[showClotureSummaryModal] Contenu HTML injecté."); // DEBUG 4
    } catch (renderError) {
        console.error("[showClotureSummaryModal] ERREUR lors du rendu du contenu:", renderError); // DEBUG Erreur Rendu
        modalBody.innerHTML = `<p class="error">Impossible de générer le contenu du récapitulatif.</p>`;
        showToast("Erreur lors de la génération du récapitulatif.", "error");
    }

    console.log("[showClotureSummaryModal] Ajout de la classe 'visible'..."); // DEBUG 5
    modal.classList.add('visible'); // <-- C'est ici que la modale devient visible

    // Gestionnaires pour fermer la modale
    const closeModal = () => {
        console.log("[showClotureSummaryModal] Fermeture via bouton/clic."); // DEBUG Fermeture
        modal.classList.remove('visible');
        document.removeEventListener('keydown', escapeHandler);
    };
    const closeButton = modal.querySelector('.modal-close');
    if (closeButton) {
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        newCloseButton.addEventListener('click', closeModal);
    }

     modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    // Variable pour stocker la référence de l'handler
    let escapeHandler;
    escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    };
    document.removeEventListener('keydown', escapeHandler); // Nettoyer au cas où
    document.addEventListener('keydown', escapeHandler);
}


/**
 * Démarre le processus de clôture immédiate pour une seule caisse.
 */
export async function startClotureCaisse(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    console.log(`[startClotureCaisse] Démarrage IMMÉDIAT pour caisse ${caisseId}`); // DEBUG A

    const isClosed = state.closedCaisses.includes(String(caisseId));
    const isLockedByOther = state.lockedCaisses.some(c => String(c.caisse_id) === String(caisseId) && String(c.locked_by) !== String(state.wsResourceId));

    if (isClosed) {
        console.log(`[startClotureCaisse] Caisse ${caisseId} déjà clôturée. Affichage récap.`); // DEBUG B
        showClotureSummaryModal(caisseId, state); // Affiche directement le récap
        return;
    }
    if (isLockedByOther) {
        console.log(`[startClotureCaisse] Caisse ${caisseId} verrouillée par autre.`); // DEBUG C
        showToast(`La caisse "${caisseNom}" est en cours de modification par un autre utilisateur.`, 'error');
        return;
    }

    let suggestions;
    try {
        console.log(`[startClotureCaisse] Calcul suggestions pour caisse ${caisseId}`); // DEBUG D
        suggestions = service.calculateWithdrawalSuggestion(state.calculatorData.caisse[caisseId], state.config);
        console.log(`[startClotureCaisse] Suggestions calculées:`, suggestions); // DEBUG D.1
    } catch (e) {
        console.error(`[startClotureCaisse] ERREUR lors du calcul des suggestions pour caisse ${caisseId}:`, e);
        showToast("Erreur interne lors du calcul des retraits.", "error");
        return;
    }

    // *** DEBUT DU BLOC DE LOGIQUE (anciennement dans onConfirm) ***
    console.log(`[startClotureCaisse] Exécution directe de la clôture pour ${caisseId}.`); // DEBUG E (modifié)
    const clotureButton = document.getElementById('cloture-btn');
    if (clotureButton) {
        clotureButton.disabled = true;
        clotureButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Clôture...`;
    }

    try {
        if (!suggestions) {
             throw new Error("Erreur interne: suggestions non calculées.");
        }

        console.log(`[startClotureCaisse] Préparation FormData pour ${caisseId}...`); // DEBUG F
        const formData = service.prepareSingleCaisseClotureData(caisseId, state, suggestions.suggestions);

        console.log("[startClotureCaisse] Contenu FormData avant envoi:");
         for (let [key, value] of formData.entries()) {
             console.log(`  ${key}: ${value}`);
         }

        console.log(`[startClotureCaisse] >>> APPEL API submitSingleCaisseCloture pour ${caisseId}...`); // DEBUG G
        const result = await service.submitSingleCaisseCloture(formData);
        console.log(`[startClotureCaisse] <<< Résultat API pour ${caisseId}:`, result); // DEBUG H

        showToast(`Caisse "${caisseNom}" clôturée.`, 'success');

        // MàJ état local
        if (!state.closedCaisses.includes(String(caisseId))) {
            state.closedCaisses.push(String(caisseId));
        }
        state.lockedCaisses = state.lockedCaisses.filter(c => String(c.caisse_id) !== String(caisseId));
        console.log(`[startClotureCaisse] État local MàJ: closed=${state.closedCaisses.join(',')}`); // DEBUG I

        // MàJ UI
        ui.updateAllCaisseLocks(state);
        updateClotureButtonState(state);

        console.log(`[startClotureCaisse] >>> APPEL showClotureSummaryModal pour ${caisseId}...`); // DEBUG J
        showClotureSummaryModal(caisseId, state);
        console.log(`[startClotureCaisse] <<< RETOUR de showClotureSummaryModal.`); // DEBUG K

        // Informer les autres
        console.log(`[startClotureCaisse] Envoi WS 'cloture_state_changed' pour ${caisseId}`); // DEBUG L
        sendWsMessage({ type: 'cloture_state_changed', caisse_id: caisseId });

    } catch (error) {
        console.error(`[startClotureCaisse] ERREUR Clôture ${caisseId}:`, error); // DEBUG M
        showToast(`Erreur clôture : ${error.message || 'Erreur inconnue'}`, 'error');
         if (clotureButton) {
             updateClotureButtonState(state);
         }
    }
    // *** FIN DU BLOC DE LOGIQUE ***
}

export function reopenCaisse(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    showConfirmationModal({
        title: 'Réouvrir la Caisse',
        message: `Voulez-vous réouvrir la caisse "${caisseNom}" ?`,
        confirmButtonClass: 'action-btn',
        confirmButtonText: 'Réouvrir',
        onConfirm: () => {
            console.log(`[reopenCaisse] Envoi WS 'cloture_reopen' pour ${caisseId}`);
            sendWsMessage({ type: 'cloture_reopen', caisse_id: caisseId });
        }
    });
}

export async function finalizeDay(state) {
     showConfirmationModal({
        title: 'Finaliser la Journée',
        message: "Toutes les caisses sont clôturées. Voulez-vous finaliser et archiver la journée ? Action irréversible.",
        onConfirm: async () => {
            console.log("[finalizeDay] Confirmation reçue.");
            const finalizeButton = document.getElementById('finalize-day-btn');
            if(finalizeButton) {
                finalizeButton.disabled = true;
                finalizeButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Finalisation...`;
            }
            try {
                console.log("[finalizeDay] >>> APPEL API submitClotureGenerale...");
                const result = await service.submitClotureGenerale();
                console.log("[finalizeDay] <<< Résultat API:", result);

                showToast(result.message, 'success', 5000);
                 console.log("[finalizeDay] Envoi WS 'force_reload_all'...");
                sendWsMessage({ type: 'force_reload_all' });

            } catch (error) {
                 console.error("[finalizeDay] ERREUR:", error);
                 showToast(`Erreur finalisation : ${error.message}`, 'error');
                 if(finalizeButton) {
                    finalizeButton.disabled = false;
                    finalizeButton.innerHTML = `Finaliser et Archiver la Journée`;
                 }
            }
        }
    });
}

/**
 * Met à jour l'état et le texte du bouton de clôture principal.
 */
function updateClotureButtonState(state) {
    const clotureBtn = document.getElementById('cloture-btn');
    if (!clotureBtn || !state.config || !state.config.nomsCaisses) return;

    const allCaisseIds = Object.keys(state.config.nomsCaisses || {});
    const allClosed = allCaisseIds.length > 0 && allCaisseIds.every(id => state.closedCaisses.includes(String(id)));

    clotureBtn.disabled = !state.wsResourceId || allClosed;

    if (allClosed) {
        clotureBtn.innerHTML = `<i class="fa-solid fa-check-circle"></i> Journée Terminée`;
        clotureBtn.classList.remove('mode-validation', 'mode-finalisation');
        clotureBtn.style.backgroundColor = '';
    } else {
        clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture Caisse Active';
         if (!clotureBtn.disabled) {
             clotureBtn.classList.remove('mode-validation', 'mode-finalisation');
             clotureBtn.style.backgroundColor = '';
         }
    }
}
