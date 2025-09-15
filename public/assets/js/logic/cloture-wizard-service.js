// Fichier : public/assets/js/logic/cloture-wizard-service.js

import { parseLocaleFloat } from '../utils/formatters.js';

/**
 * Récupère les données initiales nécessaires pour l'assistant :
 * la configuration de l'application et la dernière sauvegarde.
 * @returns {Promise<object>} Un objet contenant la configuration et les données du calculateur.
 */
export async function fetchInitialData() {
    console.log("[Wizard] Récupération de la configuration et des données...");
    const configPromise = fetch('index.php?route=calculateur/config').then(res => res.json());
    const dataPromise = fetch('index.php?route=calculateur/get_initial_data').then(res => res.json());

    const [configResult, dataResult] = await Promise.all([configPromise, dataPromise]);
    
    let calculatorData = { caisse: {} };
    if (dataResult.success && dataResult.data) {
        const rawData = dataResult.data;
        calculatorData.nom_comptage = rawData.nom_comptage;
        calculatorData.explication = rawData.explication;
        for (const caisseId in rawData) {
            if (!isNaN(caisseId)) {
                 calculatorData.caisse[caisseId] = rawData[caisseId];
                 // S'assurer que les structures de données existent pour éviter les erreurs
                 if (!calculatorData.caisse[caisseId].denominations) calculatorData.caisse[caisseId].denominations = {};
                 if (!calculatorData.caisse[caisseId].tpe) calculatorData.caisse[caisseId].tpe = {};
                 if (!calculatorData.caisse[caisseId].cheques) calculatorData.caisse[caisseId].cheques = [];
            }
        }
    }
    
    const chequesState = {};
    const tpeState = {};
    Object.keys(calculatorData.caisse).forEach(caisseId => {
        chequesState[caisseId] = calculatorData.caisse[caisseId].cheques || [];
        tpeState[caisseId] = calculatorData.caisse[caisseId].tpe || {};
    });

    console.log("[Wizard] Données initiales chargées.");
    return { config: configResult, calculatorData, chequesState, tpeState };
}

/**
 * Calcule la suggestion de retrait d'espèces pour une caisse donnée.
 * @param {object} caisseData - Les données de la caisse (dénominations, fond de caisse).
 * @param {object} config - La configuration de l'application.
 * @returns {object} Un objet avec les suggestions et le total à retirer.
 */
export function calculateWithdrawalSuggestion(caisseData, config) {
    if (!caisseData) return { suggestions: [], totalToWithdraw: 0 };

    const denominationsData = caisseData.denominations || {};
    const allDenoms = { ...(config.denominations?.billets || {}), ...(config.denominations?.pieces || {}) };
    const minToKeepRules = config.minToKeep || {};

    const targetFundValue = parseLocaleFloat(caisseData.fond_de_caisse);
    const currentQuantities = {};
    let currentTotalValue = 0;

    for (const name in allDenoms) {
        const qty = parseInt(denominationsData[name], 10) || 0;
        if (qty > 0) {
            currentQuantities[name] = qty;
            currentTotalValue += qty * parseFloat(allDenoms[name]);
        }
    }

    if (currentTotalValue <= targetFundValue) {
        return { suggestions: [], totalToWithdraw: 0 };
    }
    
    // Logique de calcul complexe pour déterminer quoi garder
    // ... (cette logique est conservée telle quelle car elle est pure)
    const fundToKeep = {};
    let fundToKeepValue = 0;
    const sortedDenoms = Object.keys(allDenoms).sort((a, b) => parseFloat(allDenoms[b]) - parseFloat(allDenoms[a]));

    for (const name of sortedDenoms) {
        const targetQty = parseInt(minToKeepRules[name], 10) || 0;
        if (targetQty > 0 && currentQuantities[name]) {
            const qtyToReserve = Math.min(currentQuantities[name], targetQty);
            const valueReserved = qtyToReserve * parseFloat(allDenoms[name]);
            if (fundToKeepValue + valueReserved <= targetFundValue) {
                fundToKeep[name] = (fundToKeep[name] || 0) + qtyToReserve;
                fundToKeepValue += valueReserved;
            }
        }
    }

    for (const name of sortedDenoms) {
        const availableQty = (currentQuantities[name] || 0) - (fundToKeep[name] || 0);
        if (availableQty > 0) {
            const value = parseFloat(allDenoms[name]);
            const remainingValueNeeded = targetFundValue - fundToKeepValue;
            if (remainingValueNeeded > 0) {
                const qtyToAdd = Math.min(availableQty, Math.floor(remainingValueNeeded / value));
                if (qtyToAdd > 0) {
                    fundToKeep[name] = (fundToKeep[name] || 0) + qtyToAdd;
                    fundToKeepValue += qtyToAdd * value;
                }
            }
        }
    }
    // Fin de la logique complexe

    const suggestions = [];
    let totalToWithdraw = 0;
    for (const name in currentQuantities) {
        const qtyToWithdraw = currentQuantities[name] - (fundToKeep[name] || 0);
        if (qtyToWithdraw > 0) {
            const value = parseFloat(allDenoms[name]);
            const withdrawnAmount = qtyToWithdraw * value;
            suggestions.push({ name, value, qty: qtyToWithdraw, total: withdrawnAmount });
            totalToWithdraw += withdrawnAmount;
        }
    }
    
    return { suggestions, totalToWithdraw };
}

/**
 * Soumet les données finales de clôture à l'API.
 * @param {FormData} formData - Les données du formulaire à envoyer.
 * @returns {Promise<object>} - Le résultat de la réponse de l'API.
 */
export async function submitFinalCloture(formData) {
    const response = await fetch('index.php?route=cloture/confirm_caisse', { method: 'POST', body: formData });
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.message || 'Une erreur inconnue est survenue lors de la finalisation.');
    }
    return result;
}
