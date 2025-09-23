// Fichier : public/assets/js/logic/cloture-wizard-events.js (Version Finale Complète et Corrigée)

import { sendWsMessage } from './websocket-service.js';
import * as service from './cloture-wizard-service.js';
import * as ui from './cloture-wizard-ui.js';
import { parseLocaleFloat } from '../utils/formatters.js';

/**
 * Attache tous les écouteurs d'événements pour l'assistant de clôture.
 * @param {object} state - L'état global de l'assistant.
 * @param {object} logic - Les fonctions de logique à appeler (handleNextStep, etc.).
 */
export function attachEventListeners(state, logic) {
    
    // On utilise la délégation sur document.body pour que les écouteurs
    // fonctionnent même lorsque le contenu des modales est recréé.
    
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        const processModal = document.getElementById('cloture-process-modal');

        // Boutons de navigation principaux
        if (target.closest('#wizard-next-btn')) logic.handleNextStep();
        if (target.closest('#wizard-prev-btn')) logic.handlePrevStep();
        if (target.closest('#wizard-cancel-btn')) logic.handleCancel();
        if (target.closest('#wizard-finish-btn')) logic.handleNextStep();
        
        // Bouton de réouverture de caisse (Étape 1)
        if (target.matches('.js-reopen-caisse')) {
            const caisseId = target.dataset.caisseId;
            if (confirm(`Voulez-vous vraiment rouvrir la caisse "${state.config.nomsCaisses[caisseId]}" ?`)) {
                sendWsMessage({ type: 'cloture_reopen', caisse_id: caisseId });
                ui.closeAllModals();
            }
        }
        
        // Bouton pour valider une sous-étape de la réconciliation (Étape 2)
        if (target.matches('.validate-section-btn')) {
            logic.handleNextSubStep();
        }
    });

    document.body.addEventListener('change', (e) => {
        const target = e.target;

        // Écouteur pour la sélection des caisses (Étape 1)
        if (target.name === 'caisseSelection') {
            ui.updateWizardUI(state.wizardState, false);
        }

        // --- CORRECTION ---
        // Ajout de l'écouteur manquant pour la case à cocher finale (Étape 4)
        if (target.id === 'final-confirmation-checkbox') {
            ui.updateWizardUI(state.wizardState, true);
        }
        // --- FIN DE LA CORRECTION ---

        // Écouteur pour les saisies dans la réconciliation (Étape 2)
        if (state.wizardState && state.wizardState.currentStep === 2 && target.matches('.reconciliation-input')) {
            const nameAttr = target.name;
            const caisseId = target.dataset.caisseId;
            if (!caisseId || !state.calculatorData.caisse[caisseId] || !nameAttr) return;

            const keys = nameAttr.match(/\[([^\]]+)\]/g).map(key => key.slice(1, -1));
            
            if (keys.length === 3 && keys[1] === 'denominations') {
                state.calculatorData.caisse[caisseId].denominations[keys[2]] = target.value;
            } else if (keys.length === 2) {
                state.calculatorData.caisse[caisseId][keys[1]] = target.value;
            }
            
            service.calculateAndDisplayAllEcarts(caisseId, state);
        }
    });
}
