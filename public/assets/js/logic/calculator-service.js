// Fichier : public/assets/js/logic/calculator-service.js

import { formatCurrency, parseLocaleFloat } from '../utils/formatters.js';

/**
 * Récupère les données initiales (configuration, dernière sauvegarde et état de la réserve).
 */
export async function fetchInitialData() {
    const configPromise = fetch('index.php?route=calculateur/config').then(res => res.json());
    const dataPromise = fetch('index.php?route=calculateur/get_initial_data').then(res => res.json());
    // On ajoute l'appel pour les données de la réserve
    const reservePromise = fetch('index.php?route=reserve/get_data').then(res => res.json());

    const [configResult, dataResult, reserveResult] = await Promise.all([configPromise, dataPromise, reservePromise]);
    
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
    
    // S'assurer que chaque caisse configurée a un objet de données, même vide
    Object.keys(configResult.nomsCaisses).forEach(caisseId => {
        if (!calculatorData.caisse[caisseId]) {
            calculatorData.caisse[caisseId] = {
                cheques: [],
                tpe: {},
                denominations: {}
            };
        }
    });

    const clotureState = {
        lockedCaisses: [],
        closedCaisses: configResult.closedCaisses || []
    };

    delete configResult.lockedCaisses;
    delete configResult.closedCaisses;

    // On ajoute le statut de la réserve aux données retournées
    return { 
        config: configResult, 
        calculatorData, 
        clotureState, 
        reserveStatus: reserveResult.success ? reserveResult.reserve_status : { denominations: {}, total: 0 } 
    };
}


/**
 * Prépare le FormData pour la clôture d'une seule caisse.
 */
export function prepareSingleCaisseClotureData(caisseId, state) {
    const form = document.getElementById('caisse-form');
    const formData = new FormData(form);
    
    formData.append('caisse_id_a_cloturer', caisseId);

    const retraitInputs = document.querySelectorAll(`.retrait-input[data-caisse-id="${caisseId}"]`);
    retraitInputs.forEach(input => {
        formData.append(input.name, input.value);
    });

    return formData;
}

/**
 * Soumet les données de clôture d'une seule caisse au serveur.
 */
export async function submitSingleCaisseCloture(formData) {
    const response = await fetch('index.php?route=cloture/confirm_caisse', {
        method: 'POST',
        body: formData
    });
    return await response.json();
}

/**
 * Soumet la demande de clôture générale finale.
 */
export async function submitClotureGenerale() {
    const response = await fetch('index.php?route=cloture/confirm_generale', { method: 'POST' });
    return await response.json();
}

/**
 * Calcule les écarts pour tous les types de paiement d'une caisse donnée.
 */
export function calculateEcartsForCaisse(caisseId, appState) {
    const { calculatorData, config } = appState;
    const caisseData = calculatorData.caisse[caisseId] || {};

    // --- Calcul Espèces en centimes ---
    let totalCompteEspecesCents = 0;
    const allDenoms = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
    for (const name in allDenoms) {
        const quantite = parseInt(caisseData.denominations?.[name], 10) || 0;
        totalCompteEspecesCents += quantite * Math.round(parseFloat(allDenoms[name]) * 100);
    }
    const fondDeCaisseCents = Math.round(parseLocaleFloat(caisseData.fond_de_caisse) * 100);
    const ventesEspecesCents = Math.round(parseLocaleFloat(caisseData.ventes_especes) * 100);
    const retrocessionCents = Math.round(parseLocaleFloat(caisseData.retrocession) * 100);
    const ecartEspecesCents = (totalCompteEspecesCents - fondDeCaisseCents) - (ventesEspecesCents + retrocessionCents);

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
        const formElements = document.getElementById('caisse-form').elements;

        caisseData.fond_de_caisse = formElements[`caisse[${id}][fond_de_caisse]`]?.value;
        caisseData.ventes_especes = formElements[`caisse[${id}][ventes_especes]`]?.value;
        caisseData.retrocession = formElements[`caisse[${id}][retrocession]`]?.value;
        caisseData.ventes_cb = formElements[`caisse[${id}][ventes_cb]`]?.value;
        caisseData.retrocession_cb = formElements[`caisse[${id}][retrocession_cb]`]?.value;
        caisseData.ventes_cheques = formElements[`caisse[${id}][ventes_cheques]`]?.value;
        caisseData.retrocession_cheques = formElements[`caisse[${id}][retrocession_cheques]`]?.value;
        
        caisseData.denominations = caisseData.denominations || {};
        Object.keys({ ...config.denominations.billets, ...config.denominations.pieces }).forEach(name => {
            const input = formElements[`caisse[${id}][denominations][${name}]`];
            if (input) caisseData.denominations[name] = input.value;
        });

        const results = calculateEcartsForCaisse(id, appState);
        
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

        // Logique pour la phrase explicative
        const explanationEl = mainDisplay.querySelector('.ecart-explanation');
        if (Math.abs(mainData.value) < 0.01) {
            explanationEl.textContent = `Le total des ${activeTabKey} est juste.`;
        } else if (mainData.value > 0) {
            explanationEl.textContent = `Il y a un excédent de ${formatCurrency(mainData.value, config)} pour les ${activeTabKey}.`;
        } else {
            explanationEl.textContent = `Il manque ${formatCurrency(Math.abs(mainData.value), config)} pour les ${activeTabKey}.`;
        }
        
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
