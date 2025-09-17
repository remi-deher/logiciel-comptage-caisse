// Fichier : public/assets/js/logic/cloture-wizard-service.js (Logique de retrait finale basée sur la recette du jour)

import { parseLocaleFloat } from '../utils/formatters.js';

/**
 * Récupère les données initiales nécessaires pour l'assistant.
 */
export async function fetchInitialData() {
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

    return { config: configResult, calculatorData, chequesState, tpeState };
}

/**
 * Calcule la suggestion de retrait d'espèces pour une caisse donnée.
 * @param {object} caisseData - Les données de la caisse.
 * @param {object} config - La configuration de l'application.
 * @returns {object} Un objet avec les suggestions et le total à retirer.
 */
export function calculateWithdrawalSuggestion(caisseData, config) {
    if (!caisseData) return { suggestions: [], totalToWithdraw: 0 };

    const denominationsData = caisseData.denominations || {};
    const allDenoms = { ...(config.denominations?.billets || {}), ...(config.denominations?.pieces || {}) };
    
    const currentQuantities = {};
    for (const name in allDenoms) {
        const qty = parseInt(denominationsData[name], 10) || 0;
        if (qty > 0) {
            currentQuantities[name] = qty;
        }
    }

    // --- DÉBUT DE LA NOUVELLE LOGIQUE BASÉE SUR VOTRE EXPLICATION ---

    // 1. Déterminer le montant total à retirer, qui correspond à la recette du jour.
    const targetWithdrawalAmount = parseLocaleFloat(caisseData.ventes_especes) + parseLocaleFloat(caisseData.retrocession);
    
    // Si la recette est nulle ou négative, il n'y a rien à retirer.
    if (targetWithdrawalAmount <= 0) {
        return { suggestions: [], totalToWithdraw: 0 };
    }

    const suggestions = [];
    let totalWithdrawn = 0;
    const availableQuantities = { ...currentQuantities };

    // On trie les dénominations de la plus grande à la plus petite.
    const sortedDenoms = Object.keys(allDenoms).sort((a, b) => parseFloat(allDenoms[b]) - parseFloat(allDenoms[a]));

    // 2. On parcourt les dénominations pour constituer le montant à retirer.
    for (const name of sortedDenoms) {
        const value = parseFloat(allDenoms[name]);
        let qtyAvailable = availableQuantities[name] || 0;

        if (qtyAvailable > 0 && totalWithdrawn < targetWithdrawalAmount) {
            // On calcule combien il reste à retirer.
            const remainingToWithdraw = targetWithdrawalAmount - totalWithdrawn;
            
            // Combien de cette coupure peut-on retirer pour combler ce reste ?
            const howManyCanFit = Math.floor(remainingToWithdraw / value);
            
            // On ne peut pas retirer plus que ce qu'on a de disponible.
            const qtyToWithdraw = Math.min(qtyAvailable, howManyCanFit);

            if (qtyToWithdraw > 0) {
                const withdrawnAmount = qtyToWithdraw * value;
                suggestions.push({ name, value, qty: qtyToWithdraw, total: withdrawnAmount });
                totalWithdrawn += withdrawnAmount;
            }
        }
    }
    
    // --- FIN DE LA NOUVELLE LOGIQUE ---

    return { suggestions, totalToWithdraw: totalWithdrawn };
}

/**
 * Soumet les données finales de clôture à l'API.
 */
export async function submitFinalCloture(formData) {
    const response = await fetch('index.php?route=cloture/confirm_caisse', { method: 'POST', body: formData });
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.message || 'Une erreur inconnue est survenue lors de la finalisation.');
    }
    return result;
}
