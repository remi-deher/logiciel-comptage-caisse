// Fichier : public/assets/js/logic/cloture-logic.js (Version Corrigée)

import { sendWsMessage } from './websocket-service.js';
import * as service from './calculator-service.js';
import * as ui from './calculator-ui.js';
import { showToast } from '../utils/toast.js';
import { showConfirmationModal } from '../utils/ui.js';

/**
 * Affiche la modale de récapitulatif (simple ou final) après la clôture.
 */
function showClotureSummaryModal(caisseId, state) {
    console.log("[showClotureSummaryModal] Fonction appelée pour caisse ID:", caisseId);
    const modal = document.getElementById('cloture-summary-modal');
    const modalBody = document.getElementById('cloture-summary-modal-body');
    const modalTitle = document.getElementById('cloture-summary-modal-title');
    const modalFooter = modal ? modal.querySelector('.modal-footer') : null; // Cibler le footer

    if (!modal || !modalBody || !modalTitle || !modalFooter) {
        console.error("[showClotureSummaryModal] ERREUR: Éléments HTML de la modale introuvables.");
        showToast("Erreur interne: Impossible d'afficher le récapitulatif.", "error");
        return;
    }

    // Vérifier si TOUTES les caisses sont maintenant fermées
    const allCaisseIds = Object.keys(state.config.nomsCaisses || {});
    const allClosed = allCaisseIds.length > 0 && allCaisseIds.every(id => state.closedCaisses.includes(String(id)));

    let contentHtml = '';
    let footerHtml = '';

    if (allClosed) {
        // --- Affichage Final ---
        console.log("[showClotureSummaryModal] Affichage du récapitulatif FINAL.");
        modalTitle.textContent = "Récapitulatif Final de la Journée";

        // *** NOUVELLE PARTIE : Ajout du récapitulatif de la dernière caisse clôturée ***
        let lastCaisseRecapHtml = '';
        const caisseNom = state.config.nomsCaisses[caisseId];
        try {
            lastCaisseRecapHtml = `
                <div class="cloture-recap-card" style="border-color: var(--color-primary); margin-bottom: 20px;">
                   <h4>Récapitulatif - ${caisseNom} (Dernière clôturée)</h4>
                   ${ui.renderClotureSectionContent(caisseId, state)}
                </div>
                <hr style="margin: 20px 0; border-top: 1px solid var(--color-border-light);">
            `;
            console.log(`[showClotureSummaryModal] Récapitulatif individuel pour caisse ${caisseId} généré.`);
        } catch (renderError) {
             console.error(`[showClotureSummaryModal] ERREUR lors du rendu du contenu individuel pour caisse ${caisseId}:`, renderError);
             lastCaisseRecapHtml = `<p class="error">Impossible de générer le récapitulatif pour la dernière caisse.</p>`;
        }
        // *** FIN DE LA NOUVELLE PARTIE ***

        modalBody.innerHTML = lastCaisseRecapHtml // Ajout du récap individuel ici
                              + `<p>Toutes les caisses sont clôturées. Voici le récapitulatif consolidé :</p>`
                              + ui.generateFinalSummaryContentHtml(state); // Récap global après

        footerHtml = `
            <button type="button" class="btn action-btn modal-close-button">Fermer</button>
            <button type="button" class="btn save-btn" id="finalize-day-modal-btn">Finaliser et Archiver la Journée</button>
        `;

    } else {
        // --- Affichage Simple Caisse ---
        console.log(`[showClotureSummaryModal] Affichage du récapitulatif pour caisse ${caisseId}.`);
        const caisseNom = state.config.nomsCaisses[caisseId];
        modalTitle.textContent = `Récapitulatif - ${caisseNom}`;
        try {
            contentHtml = ui.renderClotureSectionContent(caisseId, state);
            modalBody.innerHTML = contentHtml;
        } catch (renderError) {
            console.error("[showClotureSummaryModal] ERREUR lors du rendu du contenu simple:", renderError);
            modalBody.innerHTML = `<p class="error">Impossible de générer le contenu du récapitulatif.</p>`;
            showToast("Erreur lors de la génération du récapitulatif.", "error");
        }
        footerHtml = `
            <button type="button" class="btn action-btn modal-close-button">Fermer</button>
        `;
    }

    // Injecter le footer et attacher les listeners
    modalFooter.innerHTML = footerHtml;

    // --- Gestionnaires pour fermer la modale ---
    const closeModal = () => {
        console.log("[showClotureSummaryModal] Fermeture.");
        modal.classList.remove('visible');
        document.removeEventListener('keydown', escapeHandler);
    };

    // Attacher au(x) bouton(s) Fermer
    modal.querySelectorAll('.modal-close-button').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', closeModal);
    });

    // Attacher à la croix
    const headerCloseButton = modal.querySelector('.modal-close');
    if (headerCloseButton && headerCloseButton.closest('.modal-header')) {
         const newHeaderCloseButton = headerCloseButton.cloneNode(true);
         headerCloseButton.parentNode.replaceChild(newHeaderCloseButton, headerCloseButton);
         newHeaderCloseButton.addEventListener('click', closeModal);
    }

    // Attacher au clic extérieur
     modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    // Attacher à la touche Echap
    let escapeHandler;
    escapeHandler = (e) => {
        if (e.key === 'Escape') closeModal();
    };
    document.removeEventListener('keydown', escapeHandler);
    document.addEventListener('keydown', escapeHandler);

    // Attacher le listener pour le bouton Finaliser SI il existe
    const finalizeModalBtn = modal.querySelector('#finalize-day-modal-btn');
    if (finalizeModalBtn) {
        const newFinalizeBtn = finalizeModalBtn.cloneNode(true);
        finalizeModalBtn.parentNode.replaceChild(newFinalizeBtn, finalizeModalBtn);
        newFinalizeBtn.addEventListener('click', () => {
            closeModal();
            finalizeDay(state);
        });
    }

    // Afficher la modale
    console.log("[showClotureSummaryModal] Ajout de la classe 'visible'.");
    modal.classList.add('visible');
}

/**
 * Démarre le processus de clôture immédiate pour une seule caisse, SANS confirmation.
 */
export async function startClotureCaisse(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    console.log(`[startClotureCaisse] Démarrage IMMÉDIAT pour caisse ${caisseId}`);

    const isClosed = state.closedCaisses.includes(String(caisseId));
    const isLockedByOther = state.lockedCaisses.some(c => String(c.caisse_id) === String(caisseId) && String(c.locked_by) !== String(state.wsResourceId));

    if (isClosed) {
        console.log(`[startClotureCaisse] Caisse ${caisseId} déjà clôturée. Affichage récap simple.`);
        showClotureSummaryModal(caisseId, state);
        return;
    }
    if (isLockedByOther) {
       console.log(`[startClotureCaisse] Caisse ${caisseId} verrouillée par autre.`);
       showToast(`La caisse "${caisseNom}" est en cours de modification par un autre utilisateur.`, 'error');
       return;
    }

    // --- DEBUT DE LA CORRECTION ---
    // On doit lire les données actuelles du formulaire (la source de vérité)
    // pour les passer au calcul de suggestion, au lieu d'utiliser 'state.calculatorData'
    // qui peut être obsolète (stale state) pour les dénominations.
    const currentCaisseData = { ...(state.calculatorData.caisse[caisseId] || {}) }; // Copie de base
    currentCaisseData.denominations = {}; // On va la remplir depuis le formulaire
    
    const formElements = document.getElementById('caisse-form')?.elements;
    if (!formElements) {
        showToast("Erreur interne: Formulaire introuvable.", "error");
        return;
    }

    // Lire les dénominations actuelles du formulaire
    const allDenoms = { ...(state.config.denominations.billets || {}), ...(state.config.denominations.pieces || {}) };
    Object.keys(allDenoms).forEach(name => {
        const input = formElements[`caisse[${caisseId}][denominations][${name}]`];
        if (input) {
            currentCaisseData.denominations[name] = input.value || '0';
        }
    });
    
    // Lire les champs théoriques actuels du formulaire (requis pour le calcul de suggestion)
    currentCaisseData.ventes_especes = formElements[`caisse[${caisseId}][ventes_especes]`]?.value || '0';
    currentCaisseData.retrocession = formElements[`caisse[${caisseId}][retrocession]`]?.value || '0';
    // --- FIN DE LA CORRECTION ---

    let suggestions;
    try {
        console.log(`[startClotureCaisse] Calcul suggestions pour caisse ${caisseId}`);
        
        // --- MODIFIÉ : On passe les données à jour 'currentCaisseData' ---
        suggestions = service.calculateWithdrawalSuggestion(currentCaisseData, state.config);
        
        console.log(`[startClotureCaisse] Suggestions calculées:`, suggestions);
    } catch (e) {
       console.error(`[startClotureCaisse] ERREUR lors du calcul des suggestions pour caisse ${caisseId}:`, e);
       showToast("Erreur interne lors du calcul des retraits.", "error");
       return;
    }

    // *** Exécution directe ***
    console.log(`[startClotureCaisse] Exécution directe de la clôture pour ${caisseId}.`);
    const clotureButton = document.getElementById('cloture-btn');
    if (clotureButton) {
        clotureButton.disabled = true;
        clotureButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Clôture...`;
    }

    try {
        if (!suggestions) throw new Error("Erreur interne: suggestions non calculées.");

        console.log(`[startClotureCaisse] Préparation FormData pour ${caisseId}...`);
        const formData = service.prepareSingleCaisseClotureData(caisseId, state, suggestions.suggestions);

        // console.log("[startClotureCaisse] Contenu FormData avant envoi:");
        // for (let [key, value] of formData.entries()) { console.log(`  ${key}: ${value}`); }

        console.log(`[startClotureCaisse] >>> APPEL API submitSingleCaisseCloture pour ${caisseId}...`);
        const result = await service.submitSingleCaisseCloture(formData);
        console.log(`[startClotureCaisse] <<< Résultat API pour ${caisseId}:`, result);

        showToast(`Caisse "${caisseNom}" clôturée.`, 'success');

        // MàJ état local
        if (!state.closedCaisses.includes(String(caisseId))) {
            state.closedCaisses.push(String(caisseId));
        }
        state.lockedCaisses = state.lockedCaisses.filter(c => String(c.caisse_id) !== String(caisseId));
        console.log(`[startClotureCaisse] État local MàJ: closed=${state.closedCaisses.join(',')}`);

        // MàJ UI (onglets, bouton principal) - Fait maintenant avant la modale
        ui.updateAllCaisseLocks(state);
        updateClotureButtonState(state); // Fonction locale

        // Affiche la modale (qui vérifiera si tout est fermé)
        showClotureSummaryModal(caisseId, state);

        // Informer les autres
        sendWsMessage({ type: 'cloture_state_changed', caisse_id: caisseId });

    } catch (error) {
        console.error(`[startClotureCaisse] ERREUR Clôture ${caisseId}:`, error);
        showToast(`Erreur clôture : ${error.message || 'Erreur inconnue'}`, 'error');
         if (clotureButton) {
             updateClotureButtonState(state); // Mettre à jour l'état du bouton même en cas d'erreur
         }
    }
}


// cancelClotureCaisse (Obsolète)
export function cancelClotureCaisse(caisseId, state) {
    console.warn("cancelClotureCaisse appelée, vérifier utilité.");
}

// reopenCaisse (Utilise showConfirmationModal)
export function reopenCaisse(caisseId, state) {
    const caisseNom = state.config.nomsCaisses[caisseId];
    showConfirmationModal({
        title: 'Réouvrir la Caisse',
        message: `Voulez-vous réouvrir la caisse "${caisseNom}" ?`,
        confirmButtonClass: 'mode-reopen',
        confirmButtonText: 'Réouvrir',
        onConfirm: () => {
            console.log(`[reopenCaisse] Envoi WS 'cloture_reopen' pour ${caisseId}`);
            sendWsMessage({ type: 'cloture_reopen', caisse_id: caisseId });
        }
    });
}

// finalizeDay (Utilise showConfirmationModal)
export async function finalizeDay(state) {
     showConfirmationModal({
        title: 'Finaliser la Journée',
        message: "Toutes les caisses sont clôturées. Voulez-vous finaliser et archiver la journée ? Action irréversible.",
        onConfirm: async () => {
            console.log("[finalizeDay] Confirmation reçue.");
            // Cibler l'un ou l'autre des boutons de finalisation (bannière ou modale)
            const finalizeButton = document.getElementById('finalize-day-btn') || document.getElementById('finalize-day-modal-btn');
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
                     // Remettre le bon texte selon le bouton
                     if(finalizeButton.id === 'finalize-day-modal-btn') {
                        finalizeButton.innerHTML = `Finaliser et Archiver la Journée`;
                     } else { // C'est celui de la bannière
                        finalizeButton.innerHTML = `Finaliser et Archiver la Journée`;
                     }
                 }
            }
        }
    });
}

/**
 * Met à jour l'état et le texte du bouton de clôture principal.
 * Permet de réouvrir même si tout est fermé.
 */
function updateClotureButtonState(state) {
    const clotureBtn = document.getElementById('cloture-btn');
    if (!clotureBtn || !state.config || !state.config.nomsCaisses) return;

    const activeTab = document.querySelector('.tab-link.active');
    const activeCaisseId = activeTab ? activeTab.dataset.caisseId : null;

    clotureBtn.disabled = !state.wsResourceId || !activeCaisseId;
    clotureBtn.classList.remove('mode-reopen', 'action-btn', 'mode-termine');
    clotureBtn.style.backgroundColor = '';

    if (activeCaisseId) {
        const isActiveCaisseClosed = state.closedCaisses.includes(String(activeCaisseId));
        const isLockedByOther = state.lockedCaisses.some(c => String(c.caisse_id) === String(activeCaisseId) && String(c.locked_by) !== String(state.wsResourceId));

        if (isLockedByOther) {
            clotureBtn.disabled = true;
            clotureBtn.innerHTML = `<i class="fa-solid fa-user-lock"></i> Verrouillée`;
        } else if (isActiveCaisseClosed) {
            clotureBtn.innerHTML = `<i class="fa-solid fa-rotate-left"></i> Réouvrir Caisse Active`;
            clotureBtn.classList.add('mode-reopen', 'action-btn');
            clotureBtn.disabled = false; // Réactivation ici
        } else {
            clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture Caisse Active';
            clotureBtn.disabled = !state.wsResourceId;
        }

    } else {
        clotureBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Sélectionner Caisse';
        clotureBtn.disabled = true;
    }
}
