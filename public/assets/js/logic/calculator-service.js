// Fichier : public/assets/js/logic/calculator-service.js (Corrigé et Fiabilisé)

import { formatCurrency, parseLocaleFloat } from '../utils/formatters.js';

/**
 * Récupère les données initiales nécessaires pour l'application (configuration et dernière sauvegarde).
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
            if (!isNaN(caisseId) && configResult.nomsCaisses[caisseId]) {
                 calculatorData.caisse[caisseId] = rawData[caisseId];
                 if (!calculatorData.caisse[caisseId].denominations) calculatorData.caisse[caisseId].denominations = {};
                 if (!calculatorData.caisse[caisseId].tpe) calculatorData.caisse[caisseId].tpe = {};
                 if (!calculatorData.caisse[caisseId].cheques) calculatorData.caisse[caisseId].cheques = [];
            }
        }
    }
    
    const chequesState = {};
    const tpeState = {};
    Object.keys(configResult.nomsCaisses).forEach(caisseId => {
        chequesState[caisseId] = calculatorData.caisse[caisseId]?.cheques || [];
        tpeState[caisseId] = calculatorData.caisse[caisseId]?.tpe || {};
    });

    return { config: configResult, calculatorData, chequesState, tpeState };
}


/**
 * Calcule les écarts et totaux pour UNE SEULE caisse à partir de l'état de l'application.
 */
export function calculateEcartsForCaisse(caisseId, appState, config) {
    const { calculatorData, chequesState, tpeState } = appState;
    const caisseData = calculatorData.caisse[caisseId] || {};

    let totalCompteEspeces = 0;
    const allDenoms = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
    for (const name in allDenoms) {
        const quantite = parseInt(caisseData.denominations?.[name], 10) || 0;
        totalCompteEspeces += quantite * parseFloat(allDenoms[name]);
    }
    const fondDeCaisse = parseLocaleFloat(caisseData.fond_de_caisse);
    const ventesEspeces = parseLocaleFloat(caisseData.ventes_especes);
    const retrocession = parseLocaleFloat(caisseData.retrocession);
    const ecartEspeces = (totalCompteEspeces - fondDeCaisse) - (ventesEspeces + retrocession);

    let totalCompteCb = 0;
    if (tpeState[caisseId]) {
        for (const terminalId in tpeState[caisseId]) {
            const releves = tpeState[caisseId][terminalId];
            if (releves && releves.length > 0) {
                const dernierReleve = releves[releves.length - 1];
                totalCompteCb += parseLocaleFloat(dernierReleve.montant);
            }
        }
    }
    const ventesCb = parseLocaleFloat(caisseData.ventes_cb);
    const ecartCb = totalCompteCb - ventesCb;
    
    const totalCompteCheques = (chequesState[caisseId] || []).reduce((sum, cheque) => sum + parseLocaleFloat(cheque.montant), 0);
    const ventesCheques = parseLocaleFloat(caisseData.ventes_cheques);
    const ecartCheques = totalCompteCheques - ventesCheques;

    const totalVentes = ventesEspeces + retrocession + ventesCb + ventesCheques;

    return {
        totalCompteEspeces, ecartEspeces,
        totalCompteCb, ecartCb,
        totalCompteCheques, ecartCheques,
        totalVentes
    };
}

/**
 * Calcule la suggestion de retrait d'espèces pour une caisse donnée.
 */
export function calculateWithdrawalSuggestion(caisseData, config) {
    if (!caisseData) return { suggestions: [], totalToWithdraw: 0 };
    const targetWithdrawalAmount = parseLocaleFloat(caisseData.ventes_especes) + parseLocaleFloat(caisseData.retrocession);
    if (targetWithdrawalAmount <= 0) return { suggestions: [], totalToWithdraw: 0 };

    const denominationsData = caisseData.denominations || {};
    const allDenoms = { ...(config.denominations?.billets || {}), ...(config.denominations?.pieces || {}) };
    const sortedDenoms = Object.keys(allDenoms).sort((a, b) => parseFloat(allDenoms[b]) - parseFloat(allDenoms[a]));
    
    let suggestions = [];
    let totalWithdrawn = 0;

    for (const name of sortedDenoms) {
        const value = parseFloat(allDenoms[name]);
        let qtyAvailable = parseInt(denominationsData[name], 10) || 0;
        
        if (qtyAvailable > 0 && totalWithdrawn < targetWithdrawalAmount) {
            const remainingToWithdraw = targetWithdrawalAmount - totalWithdrawn;
            const howManyCanFit = Math.floor(remainingToWithdraw / value);
            const qtyToWithdraw = Math.min(qtyAvailable, howManyCanFit);

            if (qtyToWithdraw > 0) {
                suggestions.push({ name, value, qty: qtyToWithdraw, total: qtyToWithdraw * value });
                totalWithdrawn += qtyToWithdraw * value;
            }
        }
    }
    
    return { suggestions, totalToWithdraw: totalWithdrawn };
}


/**
 * Calcule tous les totaux pour TOUTES les caisses et met à jour l'affichage.
 */
export function calculateAll(config, appState) {
    if (!config.nomsCaisses) return;
    
    Object.keys(config.nomsCaisses).forEach(id => {
        const caisseData = appState.calculatorData.caisse[id] || {};
        caisseData.fond_de_caisse = document.getElementById(`fond_de_caisse_${id}`).value;
        caisseData.ventes_especes = document.getElementById(`ventes_especes_${id}`).value;
        caisseData.retrocession = document.getElementById(`retrocession_${id}`).value;
        caisseData.ventes_cb = document.getElementById(`ventes_cb_${id}`).value;
        caisseData.ventes_cheques = document.getElementById(`ventes_cheques_${id}`).value;
        caisseData.denominations = caisseData.denominations || {};
        Object.keys({ ...config.denominations.billets, ...config.denominations.pieces }).forEach(name => {
            const input = document.getElementById(`${name}_${id}`);
            if (input) caisseData.denominations[name] = input.value;
        });

        const results = calculateEcartsForCaisse(id, appState, config);
        
        let totalBillets = 0, totalPieces = 0;
        Object.entries(config.denominations.billets).forEach(([name, value]) => {
            const quantite = parseInt(caisseData.denominations[name], 10) || 0;
            const totalLigne = quantite * value;
            totalBillets += totalLigne;
            document.getElementById(`total_${name}_${id}`).textContent = formatCurrency(totalLigne, config);
        });
        Object.entries(config.denominations.pieces).forEach(([name, value]) => {
            const quantite = parseInt(caisseData.denominations[name], 10) || 0;
            const totalLigne = quantite * value;
            totalPieces += totalLigne;
            document.getElementById(`total_${name}_${id}`).textContent = formatCurrency(totalLigne, config);
        });

        document.getElementById(`total-billets-${id}`).textContent = formatCurrency(totalBillets, config);
        document.getElementById(`total-pieces-${id}`).textContent = formatCurrency(totalPieces, config);
        document.getElementById(`total-especes-${id}`).textContent = formatCurrency(results.totalCompteEspeces, config);

        updateEcartDisplay(id, { especes: results.ecartEspeces, cb: results.ecartCb, cheques: results.ecartCheques }, config);
    });
}

function updateEcartDisplay(id, ecarts, config) {
    const activeTabKey = document.querySelector(`#caisse${id} .payment-tab-link.active`)?.dataset.methodKey || 'especes';
    const mainDisplay = document.getElementById(`main-ecart-caisse${id}`);
    const secondaryContainer = document.getElementById(`secondary-ecarts-caisse${id}`);
    const ecartData = {
        especes: { label: 'Écart Espèces', value: ecarts.especes },
        cb: { label: 'Écart CB', value: ecarts.cb },
        cheques: { label: 'Écart Chèques', value: ecarts.cheques }
    };

    const mainData = ecartData[activeTabKey];
    if (mainDisplay) {
        mainDisplay.querySelector('.ecart-label').textContent = mainData.label;
        mainDisplay.querySelector('.ecart-value').textContent = formatCurrency(mainData.value, config);
        mainDisplay.className = 'main-ecart-display';
        if (Math.abs(mainData.value) < 0.01) mainDisplay.classList.add('ecart-ok');
        else mainDisplay.classList.add(mainData.value > 0 ? 'ecart-positif' : 'ecart-negatif');
    }

    if (secondaryContainer) {
        secondaryContainer.innerHTML = Object.entries(ecartData)
            .filter(([key]) => key !== activeTabKey)
            .map(([, data]) => {
                let className = 'secondary-ecart-item ';
                if (Math.abs(data.value) < 0.01) className += 'ecart-ok';
                else className += (data.value > 0 ? 'ecart-positif' : 'ecart-negatif');
                return `<div class="${className}"><span>${data.label}:</span> <strong>${formatCurrency(data.value, config)}</strong></div>`;
            }).join('');
    }
}
