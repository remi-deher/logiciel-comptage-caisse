// Fichier : public/assets/js/logic/calculator-service.js (Version Corrigée pour test écart)

import { formatCurrency, parseLocaleFloat } from '../utils/formatters.js';

/**
 * Récupère les données initiales (configuration, dernière sauvegarde, état de clôture, fonds cibles et état de la réserve).
 */
export async function fetchInitialData() {
    const configPromise = fetch('index.php?route=calculateur/config').then(res => res.json());
    const dataPromise = fetch('index.php?route=calculateur/get_initial_data').then(res => res.json());
    const reservePromise = fetch('index.php?route=reserve/get_data').then(res => res.json());

    const [configResult, dataResult, reserveResult] = await Promise.all([configPromise, dataPromise, reservePromise]);

    let calculatorData = { caisse: {} };
    if (dataResult.success && dataResult.data) {
        const rawData = dataResult.data;
        calculatorData.nom_comptage = rawData.nom_comptage;
        calculatorData.explication = rawData.explication;
        // Itérer sur les ID de caisse de la config pour peupler calculatorData
        Object.keys(configResult.nomsCaisses).forEach(caisseId => {
             if (rawData[caisseId]) { // Si la sauvegarde contient des données pour cet ID
                 calculatorData.caisse[caisseId] = rawData[caisseId];
                 // S'assurer que les sous-structures existent
                 if (!calculatorData.caisse[caisseId].denominations) calculatorData.caisse[caisseId].denominations = {};
                 if (!calculatorData.caisse[caisseId].tpe) calculatorData.caisse[caisseId].tpe = {};
                 if (!calculatorData.caisse[caisseId].cheques) calculatorData.caisse[caisseId].cheques = [];
                 // Important : S'assurer que fond_de_caisse existe, même si non utilisé par l'UI principale
                 if (calculatorData.caisse[caisseId].fond_de_caisse === undefined) calculatorData.caisse[caisseId].fond_de_caisse = '0';
            }
        });
    }

    // S'assurer que chaque caisse configurée a un objet de données, même vide
    Object.keys(configResult.nomsCaisses).forEach(caisseId => {
        if (!calculatorData.caisse[caisseId]) {
            calculatorData.caisse[caisseId] = {
                fond_de_caisse: '0', // Initialiser ici aussi
                ventes_especes: '0', retrocession: '0',
                ventes_cb: '0', retrocession_cb: '0',
                ventes_cheques: '0', retrocession_cheques: '0',
                cheques: [],
                tpe: {},
                denominations: {}
            };
        } else if (calculatorData.caisse[caisseId].fond_de_caisse === undefined) {
             calculatorData.caisse[caisseId].fond_de_caisse = '0'; // Assurer l'existence si la caisse existe déjà
        }
    });

    const clotureState = {
        lockedCaisses: [],
        closedCaisses: (configResult.closedCaisses || []).map(String)
    };
    const targetFondsDeCaisse = configResult.targetFondsDeCaisse || {};
    delete configResult.closedCaisses;
    delete configResult.targetFondsDeCaisse;

    return {
        config: configResult,
        calculatorData,
        clotureState,
        targetFondsDeCaisse,
        reserveStatus: reserveResult.success ? reserveResult.reserve_status : { denominations: {}, total: 0 }
    };
}


/**
 * Prépare le FormData pour la clôture d'une seule caisse.
 */
export function prepareSingleCaisseClotureData(caisseId, state, withdrawalSuggestions) {
    const form = document.getElementById('caisse-form');
    const formData = new FormData(form);
    formData.append('caisse_id_a_cloturer', caisseId);
    withdrawalSuggestions.forEach(suggestion => {
        if (suggestion.qty > 0) {
            formData.append(`retraits[${caisseId}][${suggestion.name}]`, suggestion.qty);
        }
    });
    // Les données TPE/Chèques sont incluses via les inputs cachés générés par renderTpeList/renderChequeList
    return formData;
}

/**
 * Soumet les données de clôture d'une seule caisse au serveur.
 */
export async function submitSingleCaisseCloture(formData) {
    const response = await fetch('index.php?route=cloture/confirm_caisse', { method: 'POST', body: formData });
    const result = await response.json();
    if (!response.ok || !result.success) { throw new Error(result.message || `Erreur HTTP ${response.status}`); }
    return result;
}

/**
 * Soumet la demande de clôture générale finale.
 */
export async function submitClotureGenerale() {
    const response = await fetch('index.php?route=cloture/confirm_generale', { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.success) { throw new Error(result.message || `Erreur HTTP ${response.status} lors de la finalisation.`); }
    return result;
}

/**
 * Calcule les écarts pour tous les types de paiement d'une caisse donnée.
 * CORRIGÉ : Réintroduit fond_de_caisse dans le calcul de l'écart espèces.
 */
export function calculateEcartsForCaisse(caisseId, appState) {
    const { calculatorData, config } = appState;
    // Utiliser une copie pour éviter de modifier l'état global directement ici
    const caisseData = { ...(calculatorData.caisse[caisseId] || {}) };
    // Assurer la présence de fond_de_caisse pour le calcul, même si non présent dans l'UI
    caisseData.fond_de_caisse = caisseData.fond_de_caisse || '0';

    // --- Calcul Espèces en centimes ---
    let totalCompteEspecesCents = 0;
    const allDenoms = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
    for (const name in allDenoms) {
        const quantite = parseInt(caisseData.denominations?.[name], 10) || 0;
        totalCompteEspecesCents += quantite * Math.round(parseFloat(allDenoms[name]) * 100);
    }
    // *** CORRECTION ICI : Réintroduire fond_de_caisse_cents ***
    const fondDeCaisseCents = Math.round(parseLocaleFloat(caisseData.fond_de_caisse) * 100);
    const ventesEspecesCents = Math.round(parseLocaleFloat(caisseData.ventes_especes) * 100);
    const retrocessionCents = Math.round(parseLocaleFloat(caisseData.retrocession) * 100);
    // *** CORRECTION ICI : (Compté - Fond Initial) - Théorique ***
    const ecartEspecesCents = (totalCompteEspecesCents - fondDeCaisseCents) - (ventesEspecesCents + retrocessionCents);
    // *** FIN CORRECTION ***

    // --- Calcul CB en centimes ---
    let totalCompteCbCents = 0;
    const tpeData = caisseData.tpe || {};
    for (const terminalId in tpeData) {
        const releves = tpeData[terminalId];
        if (releves && releves.length > 0) {
            const sortedReleves = [...releves].sort((a, b) => (b.heure || '00:00:00').localeCompare(a.heure || '00:00:00'));
            const dernierReleve = sortedReleves[0];
            if (dernierReleve) {
               totalCompteCbCents += Math.round(parseLocaleFloat(dernierReleve.montant) * 100);
            }
        }
    }
    const ventesCbCents = Math.round(parseLocaleFloat(caisseData.ventes_cb) * 100);
    const retrocessionCbCents = Math.round(parseLocaleFloat(caisseData.retrocession_cb) * 100);
    const ecartCbCents = totalCompteCbCents - (ventesCbCents + retrocessionCbCents);

    // --- Calcul Chèques en centimes ---
    const totalCompteChequesCents = (caisseData.cheques || []).reduce((sum, cheque) => sum + Math.round(parseLocaleFloat(cheque.montant) * 100), 0);
    const ventesChequesCents = Math.round(parseLocaleFloat(caisseData.ventes_cheques) * 100);
    const retrocessionChequesCents = Math.round(parseLocaleFloat(caisseData.retrocession_cheques) * 100);
    const ecartChequesCents = totalCompteChequesCents - (ventesChequesCents + retrocessionChequesCents);

    return {
        totalCompteEspeces: totalCompteEspecesCents / 100,
        ecartEspeces: ecartEspecesCents / 100,
        totalCompteCb: totalCompteCbCents / 100,
        ecartCb: ecartCbCents / 100,
        totalCompteCheques: totalCompteChequesCents / 100,
        ecartCheques: ecartChequesCents / 100
    };
}


/**
 * Calcule la suggestion de retrait d'espèces pour une caisse.
 * Basé sur les ventes théoriques + rétrocessions.
 */
export function calculateWithdrawalSuggestion(caisseData, config) {
    if (!caisseData || !config || !config.denominations) return { suggestions: [], totalToWithdraw: 0 };

    // Calculer le montant théorique des espèces à retirer (en centimes)
    const targetWithdrawalAmountCents = Math.round(
        (parseLocaleFloat(caisseData.ventes_especes) + parseLocaleFloat(caisseData.retrocession)) * 100
    );

    if (targetWithdrawalAmountCents <= 0) return { suggestions: [], totalToWithdraw: 0 };

    const denominationsData = caisseData.denominations || {};
    const allDenoms = { ...(config.denominations?.billets || {}), ...(config.denominations?.pieces || {}) };
    const sortedDenoms = Object.keys(allDenoms).sort((a, b) => parseFloat(allDenoms[b]) - parseFloat(allDenoms[a]));

    let suggestions = [];
    let totalWithdrawnCents = 0;

    for (const name of sortedDenoms) {
        const valueInCents = Math.round(parseFloat(allDenoms[name]) * 100);
        let qtyAvailable = parseInt(denominationsData[name], 10) || 0;
        const minToKeep = parseInt(config.minToKeep?.[name], 10) || 0;
        let qtyEffectivelyAvailable = Math.max(0, qtyAvailable - minToKeep);

        if (qtyEffectivelyAvailable > 0 && totalWithdrawnCents < targetWithdrawalAmountCents && valueInCents > 0) {
            const remainingToWithdrawCents = targetWithdrawalAmountCents - totalWithdrawnCents;
            const howManyCanFit = Math.floor(remainingToWithdrawCents / valueInCents);
            const qtyToWithdraw = Math.min(qtyEffectivelyAvailable, howManyCanFit);

            if (qtyToWithdraw > 0) {
                const totalValueCents = qtyToWithdraw * valueInCents;
                suggestions.push({
                    name,
                    value: valueInCents / 100,
                    qty: qtyToWithdraw,
                    total: totalValueCents / 100
                });
                totalWithdrawnCents += totalValueCents;
            }
        }
    }

    return { suggestions, totalToWithdraw: totalWithdrawnCents / 100 };
}

/**
 * Calcule tous les totaux pour TOUTES les caisses et met à jour l'affichage.
 */
export function calculateAll(config, appState) {
    const { calculatorData, targetFondsDeCaisse } = appState; // targetFondsDeCaisse est toujours là, mais non utilisé ici
    if (!config || !config.nomsCaisses || !config.denominations) {
        console.error("Configuration incomplète pour calculateAll");
        return;
    }

    Object.keys(config.nomsCaisses).forEach(id => {
        // Utiliser une copie pour éviter de modifier l'état directement avant le calcul d'écart
        const caisseDataCopy = { ...(appState.calculatorData.caisse[id] || {}) };
        caisseDataCopy.denominations = { ...(caisseDataCopy.denominations || {}) }; // Copie profonde pour denominations
        caisseDataCopy.fond_de_caisse = caisseDataCopy.fond_de_caisse || '0'; // Assurer présence pour calcul écart

        const formElements = document.getElementById('caisse-form')?.elements;
        if (!formElements) return;

        // Mise à jour de la copie avec les valeurs du formulaire (sans fond_de_caisse UI)
        caisseDataCopy.ventes_especes = formElements[`caisse[${id}][ventes_especes]`]?.value || '0';
        caisseDataCopy.retrocession = formElements[`caisse[${id}][retrocession]`]?.value || '0';
        caisseDataCopy.ventes_cb = formElements[`caisse[${id}][ventes_cb]`]?.value || '0';
        caisseDataCopy.retrocession_cb = formElements[`caisse[${id}][retrocession_cb]`]?.value || '0';
        caisseDataCopy.ventes_cheques = formElements[`caisse[${id}][ventes_cheques]`]?.value || '0';
        caisseDataCopy.retrocession_cheques = formElements[`caisse[${id}][retrocession_cheques]`]?.value || '0';

        const allDenoms = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
        Object.keys(allDenoms).forEach(name => {
            const input = formElements[`caisse[${id}][denominations][${name}]`];
            if (input) {
                caisseDataCopy.denominations[name] = input.value || '0';
            }
        });

        // Calcul des écarts en utilisant la copie (qui inclut fond_de_caisse des données chargées)
        const results = calculateEcartsForCaisse(id, { ...appState, calculatorData: { caisse: { [id]: caisseDataCopy } } });

        // Calcul des suggestions (basé sur ventes/rétro de la copie)
        const suggestions = calculateWithdrawalSuggestion(caisseDataCopy, config);

        // Mise à jour des totaux par dénomination (depuis la copie)
        let totalBillets = 0, totalPieces = 0;
        Object.entries(config.denominations.billets || {}).forEach(([name, value]) => {
            const quantite = parseInt(caisseDataCopy.denominations[name], 10) || 0;
            const totalLigne = quantite * parseFloat(value);
            totalBillets += totalLigne;
            const totalElement = document.getElementById(`total_${name}_${id}`);
            if (totalElement) totalElement.textContent = formatCurrency(totalLigne, config);
        });
        Object.entries(config.denominations.pieces || {}).forEach(([name, value]) => {
            const quantite = parseInt(caisseDataCopy.denominations[name], 10) || 0;
            const totalLigne = quantite * parseFloat(value);
            totalPieces += totalLigne;
            const totalElement = document.getElementById(`total_${name}_${id}`);
            if (totalElement) totalElement.textContent = formatCurrency(totalLigne, config);
        });

        // Mise à jour des totaux globaux espèces (basé sur le résultat du calcul d'écart)
        const totalBilletsElement = document.getElementById(`total-billets-${id}`);
        if (totalBilletsElement) totalBilletsElement.textContent = formatCurrency(totalBillets, config);
        const totalPiecesElement = document.getElementById(`total-pieces-${id}`);
        if (totalPiecesElement) totalPiecesElement.textContent = formatCurrency(totalPieces, config);
        const totalEspecesElement = document.getElementById(`total-especes-${id}`);
        if (totalEspecesElement) totalEspecesElement.textContent = formatCurrency(results.totalCompteEspeces, config);

        // Mise à jour de l'affichage des écarts (utilise les résultats calculés)
        updateEcartDisplay(id, { especes: results.ecartEspeces, cb: results.ecartCb, cheques: results.ecartCheques }, config);
    });
}

/**
 * Met à jour l'affichage des écarts pour une caisse.
 */
function updateEcartDisplay(id, ecarts, config) {
    const activeTabKey = document.querySelector(`#caisse${id} .payment-tab-link.active`)?.dataset.methodKey || 'especes';
    const mainDisplay = document.getElementById(`main-ecart-caisse${id}`);
    const secondaryContainer = document.getElementById(`secondary-ecarts-caisse${id}`);

    if (!mainDisplay || !secondaryContainer) return;

    const ecartData = {
        especes: { label: 'Écart Espèces', value: ecarts.especes },
        cb: { label: 'Écart CB', value: ecarts.cb },
        cheques: { label: 'Écart Chèques', value: ecarts.cheques }
    };

    const mainData = ecartData[activeTabKey];
    const labelEl = mainDisplay.querySelector('.ecart-label');
    const valueEl = mainDisplay.querySelector('.ecart-value');
    const explanationEl = mainDisplay.querySelector('.ecart-explanation');

    if (labelEl) labelEl.textContent = mainData.label;
    if (valueEl) valueEl.textContent = formatCurrency(mainData.value, config);

    // Phrase explicative
    if (explanationEl) {
        const methodLabel = activeTabKey === 'cb' ? 'CB' : activeTabKey;
        if (Math.abs(mainData.value) < 0.01) {
            explanationEl.textContent = `Le total ${methodLabel} compté correspond aux montants théoriques.`;
        } else if (mainData.value > 0) {
            explanationEl.textContent = `Il y a un excédent de ${formatCurrency(mainData.value, config)} pour les ${methodLabel}.`;
        } else {
            explanationEl.textContent = `Il manque ${formatCurrency(Math.abs(mainData.value), config)} pour les ${methodLabel}.`;
        }
    }

    // Classes CSS pour la couleur
    mainDisplay.className = 'main-ecart-display'; // Réinitialise
    if (Math.abs(mainData.value) < 0.01) mainDisplay.classList.add('ecart-ok');
    else mainDisplay.classList.add(mainData.value > 0 ? 'ecart-positif' : 'ecart-negatif');


    // Affichage secondaire
    secondaryContainer.innerHTML = Object.entries(ecartData)
        .filter(([key]) => key !== activeTabKey)
        .map(([key, data]) => {
            let className = 'secondary-ecart-item ';
            if (Math.abs(data.value) < 0.01) className += 'ecart-ok';
            else className += (data.value > 0 ? 'ecart-positif' : 'ecart-negatif');
            const methodLabel = key === 'cb' ? 'CB' : key;
            return `<div class="${className}"><span>${data.label}:</span> <strong>${formatCurrency(data.value, config)}</strong></div>`;
        }).join('');
}
