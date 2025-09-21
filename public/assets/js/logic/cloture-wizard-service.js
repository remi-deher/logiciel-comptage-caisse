// Fichier : public/assets/js/logic/cloture-wizard-service.js (Corrigé et Fiabilisé)

import { parseLocaleFloat, formatCurrency } from '../utils/formatters.js';

/**
 * Récupère les données initiales nécessaires pour l'assistant (configuration et dernière sauvegarde).
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
 * Récupère l'état actuel des caisses (verrouillées, clôturées).
 */
export async function fetchClotureState() {
    const response = await fetch('index.php?route=cloture/get_state');
    return await response.json();
}

/**
 * Détermine le statut d'une caisse pour l'affichage à l'étape 1.
 */
export function getCaisseStatusInfo(caisseId, stateData, wsResourceId) {
    const lockedCaisses = stateData.locked_caisses || [];
    const closedCaisses = (stateData.closed_caisses || []).map(String);

    const isClosed = closedCaisses.includes(String(caisseId));
    const lockInfo = lockedCaisses.find(c => c.caisse_id.toString() === String(caisseId));
    const isLockedByOther = lockInfo && String(lockInfo.locked_by) !== String(wsResourceId);
    
    let statusClass = 'status-libre';
    let statusText = 'Prête pour la clôture';

    if (isClosed) {
        statusClass = 'status-cloturee';
        statusText = 'Déjà clôturée';
    } else if (isLockedByOther) {
        statusClass = 'status-verrouillee';
        statusText = `Utilisée par un collaborateur`;
    }

    return {
        statusClass,
        statusText,
        isDisabled: isLockedByOther || isClosed
    };
}


/**
 * Calcule tous les écarts pour une caisse et met à jour l'interface de réconciliation.
 */
export function calculateAndDisplayAllEcarts(caisseId, state) {
    const {
        ecartEspeces, totalCompteEspeces,
        ecartCb, totalCompteCb,
        ecartCheques, totalCompteCheques
    } = calculateEcartsForCaisse(caisseId, state);

    updateReconciliationUI(caisseId, 'especes', ecartEspeces, totalCompteEspeces, state);
    updateReconciliationUI(caisseId, 'cb', ecartCb, totalCompteCb, state);
    updateReconciliationUI(caisseId, 'cheques', ecartCheques, totalCompteCheques, state);
}

/**
 * Calcule les écarts pour tous les types de paiement d'une caisse donnée.
 * @returns {object} Un objet contenant tous les écarts et totaux comptés.
 */
export function calculateEcartsForCaisse(caisseId, state) {
    const { calculatorData, config, tpeState, chequesState } = state;
    const caisseData = calculatorData.caisse[caisseId] || {};

    // --- Calcul Espèces ---
    let totalCompteEspeces = 0;
    const allDenoms = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
    for (const name in allDenoms) {
        const quantite = parseInt(caisseData.denominations?.[name], 10) || 0;
        totalCompteEspeces += quantite * parseFloat(allDenoms[name]);
    }
    const fondDeCaisse = parseLocaleFloat(caisseData.fond_de_caisse);
    const ventesTheoriquesEspeces = parseLocaleFloat(caisseData.ventes_especes) + parseLocaleFloat(caisseData.retrocession);
    const ecartEspeces = totalCompteEspeces - fondDeCaisse - ventesTheoriquesEspeces;

    // --- Calcul Carte Bancaire ---
    let totalCompteCb = 0;
    const caisseTPE = tpeState[caisseId] || {};
    for (const tpeId in caisseTPE) {
        totalCompteCb += (caisseTPE[tpeId] || []).reduce((sum, r) => sum + parseLocaleFloat(r.montant), 0);
    }
    const ventesTheoriquesCb = parseLocaleFloat(caisseData.ventes_cb);
    const ecartCb = totalCompteCb - ventesTheoriquesCb;

    // --- Calcul Chèques ---
    const totalCompteCheques = (chequesState[caisseId] || []).reduce((sum, cheque) => sum + parseLocaleFloat(cheque.montant), 0);
    const ventesTheoriquesCheques = parseLocaleFloat(caisseData.ventes_cheques);
    const ecartCheques = totalCompteCheques - ventesTheoriquesCheques;

    return {
        ecartEspeces, totalCompteEspeces,
        ecartCb, totalCompteCb,
        ecartCheques, totalCompteCheques
    };
}

/**
 * Met à jour l'interface d'une section de réconciliation (UI).
 */
function updateReconciliationUI(caisseId, type, ecart, totalCompte, state) {
    const { config } = state;
    const statusDiv = document.getElementById(`status-${type}-${caisseId}`);
    const countedDiv = document.getElementById(`counted-${type}-${caisseId}`);
    const sectionDiv = document.getElementById(`section-${type}-${caisseId}`);
    if (!statusDiv || !countedDiv || !sectionDiv) return;
    
    const ecartValueSpan = statusDiv.querySelector('.ecart-value');
    const validateBtn = statusDiv.querySelector('.validate-section-btn');

    countedDiv.textContent = formatCurrency(totalCompte, config);
    ecartValueSpan.textContent = formatCurrency(ecart, config);
    
    ecartValueSpan.className = 'ecart-value'; // Reset classes
    if (Math.abs(ecart) < 0.01) {
        ecartValueSpan.classList.add('ecart-ok');
        validateBtn.disabled = false;
    } else {
        ecartValueSpan.classList.add(ecart > 0 ? 'ecart-positif' : 'ecart-negatif');
        validateBtn.disabled = true;
    }

    if (state.wizardState.reconciliation.status[caisseId]?.[type]) {
        sectionDiv.classList.add('validated');
        validateBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Validé';
        validateBtn.disabled = true;
    } else {
        sectionDiv.classList.remove('validated');
        validateBtn.innerHTML = '<i class="fa-solid fa-check"></i> Valider et Continuer';
    }
}


/**
 * Calcule la suggestion de retrait d'espèces pour une caisse donnée.
 */
export function calculateWithdrawalSuggestion(caisseData, config) {
    if (!caisseData) return { suggestions: [], totalToWithdraw: 0 };

    const denominationsData = caisseData.denominations || {};
    const allDenoms = { ...(config.denominations?.billets || {}), ...(config.denominations?.pieces || {}) };
    
    const currentQuantities = {};
    for (const name in allDenoms) {
        const qty = parseInt(denominationsData[name], 10) || 0;
        if (qty > 0) currentQuantities[name] = qty;
    }

    const targetWithdrawalAmount = parseLocaleFloat(caisseData.ventes_especes) + parseLocaleFloat(caisseData.retrocession);
    if (targetWithdrawalAmount <= 0) return { suggestions: [], totalToWithdraw: 0 };

    const suggestions = [];
    let totalWithdrawn = 0;
    const sortedDenoms = Object.keys(allDenoms).sort((a, b) => parseFloat(allDenoms[b]) - parseFloat(allDenoms[a]));

    for (const name of sortedDenoms) {
        const value = parseFloat(allDenoms[name]);
        let qtyAvailable = currentQuantities[name] || 0;
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
 * Prépare le FormData pour l'envoi final des données de clôture.
 */
export function prepareFinalFormData(state) {
    const { wizardState, calculatorData, tpeState, chequesState } = state;
    const formData = new FormData();

    formData.append('nom_comptage', calculatorData.nom_comptage);
    formData.append('explication', calculatorData.explication);

    wizardState.selectedCaisses.forEach(caisseId => {
        formData.append('caisses_a_cloturer[]', caisseId);
        const caisseData = calculatorData.caisse[caisseId] || {};
        for (const key in caisseData) {
            if (key !== 'denominations' && key !== 'cheques' && key !== 'tpe') {
                 formData.append(`caisse[${caisseId}][${key}]`, caisseData[key]);
            }
        }
        
        const denominationsData = caisseData.denominations || {};
        for (const denom in denominationsData) {
            formData.append(`caisse[${caisseId}][denominations][${denom}]`, denominationsData[denom]);
        }
        
        const chequesData = chequesState[caisseId] || [];
        chequesData.forEach((cheque, i) => {
            formData.append(`caisse[${caisseId}][cheques][${i}][montant]`, cheque.montant);
            formData.append(`caisse[${caisseId}][cheques][${i}][commentaire]`, cheque.commentaire);
        });

        const tpeData = tpeState[caisseId] || {};
        for (const tId in tpeData) {
            (tpeData[tId] || []).forEach((r, i) => {
                formData.append(`caisse[${caisseId}][tpe][${tId}][${i}][montant]`, r.montant);
                formData.append(`caisse[${caisseId}][tpe][${tId}][${i}][heure]`, r.heure);
            });
        }
        
        const withdrawalData = wizardState.confirmedData[caisseId]?.withdrawals || [];
        withdrawalData.forEach(item => {
            formData.append(`retraits[${caisseId}][${item.name}]`, item.qty);
        });
    });
    return formData;
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

/**
 * Déclenche la Clôture Générale sur le serveur.
 */
export async function submitClotureGenerale() {
    const response = await fetch('index.php?route=cloture/confirm_generale', { method: 'POST' });
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.message || 'Une erreur est survenue lors de la clôture générale.');
    }
    return result;
}
