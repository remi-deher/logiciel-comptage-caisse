// Fichier : public/assets/js/logic/cloture-wizard-events.js

import { sendWsMessage } from './websocket-service.js';
import { parseLocaleFloat } from '../utils/formatters.js';
import * as service from './cloture-wizard-service.js';
import * as ui from './cloture-wizard-ui.js';

// Une fonction d'aide pour recalculer et mettre à jour l'écart
function calculateAndDisplayEcart(caisseId, calculatorData, config) {
    const caisseData = calculatorData.caisse[caisseId] || {};
    let totalCompteEspeces = 0;
    const allDenoms = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
    const denominationsData = caisseData.denominations || {};

    for (const name in allDenoms) {
        const quantite = parseInt(denominationsData[name], 10) || 0;
        totalCompteEspeces += quantite * parseFloat(allDenoms[name]);
    }

    const fondDeCaisse = parseLocaleFloat(caisseData.fond_de_caisse);
    const ventesEspeces = parseLocaleFloat(caisseData.ventes_especes);
    const retrocession = parseLocaleFloat(caisseData.retrocession);
    const ecart = totalCompteEspeces - fondDeCaisse - ventesEspeces - retrocession;
    
    // Simple mise à jour de l'affichage de l'écart (pourrait être dans ui.js)
    const display = document.getElementById(`ecart-display-caisse${caisseId}_wizard`);
    if (!display) return;
    const valueSpan = display.querySelector('.ecart-value');
    display.classList.remove('ecart-ok', 'ecart-positif', 'ecart-negatif');
    if (valueSpan) valueSpan.textContent = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(ecart);
    if (Math.abs(ecart) < 0.01) display.classList.add('ecart-ok');
    else if (ecart > 0) display.classList.add('ecart-positif');
    else display.classList.add('ecart-negatif');
}


/**
 * Attache tous les écouteurs d'événements pour l'assistant de clôture.
 */
export function attachEventListeners(wizardElement, state, logic) {
    const wizardContent = wizardElement.querySelector('.wizard-content');

    // --- Navigation principale de l'assistant ---
    document.getElementById('wizard-next-btn').addEventListener('click', logic.handleNextStep);
    document.getElementById('wizard-prev-btn').addEventListener('click', logic.handlePrevStep);
    document.getElementById('wizard-cancel-btn').addEventListener('click', logic.handleCancel);

    // --- Délégation d'événements pour le contenu dynamique ---
    wizardContent.addEventListener('click', (e) => {
        const target = e.target;

        // Étape 1 : Rouvrir une caisse
        const reopenBtn = target.closest('.js-reopen-caisse');
        if (reopenBtn) {
            const caisseId = reopenBtn.dataset.caisseId;
            if (confirm(`Êtes-vous sûr de vouloir rouvrir la caisse "${state.config.nomsCaisses[caisseId]}" ?`)) {
                sendWsMessage({ type: 'cloture_reopen', caisse_id: caisseId });
                reopenBtn.textContent = 'Ouverture...';
                reopenBtn.disabled = true;
            }
            return;
        }

        // Étape 1 : Tout sélectionner / désélectionner
        if (target.id === 'select-all-btn') {
            wizardContent.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach(cb => cb.checked = true);
        }
        if (target.id === 'deselect-all-btn') {
            wizardContent.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => cb.checked = false);
        }
        
        // Étape 2 : Navigation par onglets
        const mainTab = target.closest('.tab-link');
        const paymentTab = target.closest('.payment-tab-link');
        if (mainTab) {
            wizardContent.querySelectorAll('.tab-link, .caisse-tab-content, .ecart-display').forEach(el => el.classList.remove('active'));
            mainTab.classList.add('active');
            const tabId = mainTab.dataset.tab;
            wizardContent.querySelector(`#${tabId}`)?.classList.add('active');
            wizardContent.querySelector(`#ecart-display-${tabId}`)?.classList.add('active');
        } else if (paymentTab) {
            const container = paymentTab.closest('.payment-method-tabs');
            container.querySelectorAll('.payment-tab-link, .payment-tab-content').forEach(el => el.classList.remove('active'));
            paymentTab.classList.add('active');
            const tabId = paymentTab.dataset.paymentTab;
            container.querySelector(`#${tabId}`)?.classList.add('active');
        }

        // Étape 2 : Ajout / Suppression de chèques
        // (La logique reste similaire à celle du calculateur, elle est juste appliquée ici)
    });

    wizardContent.addEventListener('input', (e) => {
        // Étape 1 : Mise à jour du bouton "Suivant"
        if (state.wizardState.currentStep === 1 && e.target.name === 'caisseSelection') {
            const hasSelection = wizardContent.querySelectorAll('input[name="caisseSelection"]:checked').length > 0;
            document.getElementById('wizard-next-btn').disabled = !hasSelection;
        }

        // Étape 2 : Mise à jour des données et recalcul des écarts
        if (state.wizardState.currentStep === 2 && e.target.tagName === 'INPUT') {
            const nameAttr = e.target.name;
            const caisseId = e.target.dataset.caisseId;
            if (!caisseId || !state.calculatorData.caisse[caisseId] || !nameAttr) return;

            const keys = nameAttr.match(/\[([^\]]+)\]/g).map(key => key.slice(1, -1));
            if (keys.length === 3) { // Dénominations
                state.calculatorData.caisse[caisseId].denominations[keys[2]] = e.target.value;
            } else if (keys.length === 2) { // Champs directs
                state.calculatorData.caisse[caisseId][keys[1]] = e.target.value;
            }
            calculateAndDisplayEcart(caisseId, state.calculatorData, state.config);
        }

        // Étape 4 : Checkbox de confirmation finale
        if (state.wizardState.currentStep === 4 && e.target.id === 'final-confirmation-checkbox') {
            document.getElementById('wizard-next-btn').disabled = !e.target.checked;
        }
    });
}
