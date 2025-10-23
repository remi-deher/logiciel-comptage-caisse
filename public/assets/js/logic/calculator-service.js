// Fichier : public/assets/js/logic/calculator-service.js (Corrigé pour clôture en 1 étape)

import { formatCurrency, parseLocaleFloat } from '../utils/formatters.js';

/**
 * Récupère les données initiales (configuration, dernière sauvegarde et état de la réserve).
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

    // Extract clôture state from config result (coming from PHP)
    const clotureState = {
        lockedCaisses: [], // WebSocket will provide the live locked state
        closedCaisses: (configResult.closedCaisses || []).map(String) // Ensure IDs are strings
    };
    // Clean up config object
    delete configResult.closedCaisses;


    return {
        config: configResult,
        calculatorData,
        clotureState,
        reserveStatus: reserveResult.success ? reserveResult.reserve_status : { denominations: {}, total: 0 }
    };
}


/**
 * Prépare le FormData pour la clôture d'une seule caisse.
 * Inclut maintenant les suggestions de retrait calculées.
 * @param {string} caisseId L'ID de la caisse à clôturer.
 * @param {object} state L'état actuel de l'application.
 * @param {array} withdrawalSuggestions Les suggestions de retrait calculées [{name: 'b50', qty: 2}, ...]
 */
export function prepareSingleCaisseClotureData(caisseId, state, withdrawalSuggestions) {
    const form = document.getElementById('caisse-form');
    // Crée un nouveau FormData à partir du formulaire pour obtenir toutes les valeurs actuelles
    const formData = new FormData(form);

    // Ajoute l'ID de la caisse cible qui doit être clôturée
    formData.append('caisse_id_a_cloturer', caisseId);

    // Ajoute les données de retraits calculées au FormData
    // Le serveur PHP s'attend à recevoir `retraits[caisseId][denomination]`
    withdrawalSuggestions.forEach(suggestion => {
        if (suggestion.qty > 0) {
            // Assure-toi que la clé correspond à ce que le PHP attend
            formData.append(`retraits[${caisseId}][${suggestion.name}]`, suggestion.qty);
        }
    });

    // Assure-toi que les données de la caisse concernée sont bien présentes,
    // même si elles sont déjà dans le FormData via les champs du formulaire.
    // Cela garantit que les données TPE/Chèques qui ne sont pas des champs simples sont incluses.
    const caisseDataForCloture = state.calculatorData.caisse[caisseId];
    if (caisseDataForCloture) {
         // Encode les TPE et Chèques pour les passer si nécessaire (si le PHP les utilise depuis POST et non depuis le form direct)
         // Normalement, FormData(form) récupère déjà les inputs cachés pour TPE/Chèques.
         // Mais si le PHP lit `$_POST['caisse'][$caisse_id_a_cloturer]` directement, il faut ajouter :
        // formData.append(`caisse[${caisseId}][tpe_json]`, JSON.stringify(caisseDataForCloture.tpe || {}));
        // formData.append(`caisse[${caisseId}][cheques_json]`, JSON.stringify(caisseDataForCloture.cheques || []));
        // Note: Le PHP actuel (CalculateurController->cloture) semble utiliser `$_POST['caisse'][$caisse_id_a_cloturer]`
        // et lit ensuite les retraits depuis `$_POST['retraits']`. Il faut vérifier si TPE/Chèques sont nécessaires
        // dans le JSON envoyé à `confirmCaisse`. S'ils le sont, décommenter les lignes ci-dessus.
        // S'ils ne sont PAS nécessaires car lus depuis les inputs cachés via FormData, c'est bon.
    }


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
    // On parse toujours la réponse JSON, même si c'est une erreur HTTP
    const result = await response.json();
    if (!response.ok) {
        // Si le statut HTTP n'est pas OK (ex: 400, 500), on lance une erreur avec le message du serveur
        throw new Error(result.message || `Erreur HTTP ${response.status}`);
    }
    // Si le statut est OK mais success est false dans le JSON
    if (!result.success) {
        throw new Error(result.message || 'Une erreur inconnue est survenue lors de la clôture.');
    }
    return result; // Retourne le résultat complet en cas de succès
}

/**
 * Soumet la demande de clôture générale finale.
 */
export async function submitClotureGenerale() {
    const response = await fetch('index.php?route=cloture/confirm_generale', { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.message || `Erreur HTTP ${response.status} lors de la finalisation.`);
    }
    return result;
}

/**
 * Calcule les écarts pour tous les types de paiement d'une caisse donnée. (Inchangé)
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
            // Trie les relevés par heure (du plus récent au plus ancien) pour trouver le dernier
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
 * Calcule la suggestion de retrait d'espèces pour une caisse. (Inchangé)
 * === VERSION CORRIGÉE AVEC CALCUL EN CENTIMES ===
 */
export function calculateWithdrawalSuggestion(caisseData, config) {
    if (!caisseData || !config || !config.denominations) return { suggestions: [], totalToWithdraw: 0 };

    // 1. On convertit tout en centimes dès le début
    const targetWithdrawalAmountCents = Math.round(
        (parseLocaleFloat(caisseData.ventes_especes) + parseLocaleFloat(caisseData.retrocession)) * 100
    );

    if (targetWithdrawalAmountCents <= 0) return { suggestions: [], totalToWithdraw: 0 };

    const denominationsData = caisseData.denominations || {};
    const allDenoms = { ...(config.denominations?.billets || {}), ...(config.denominations?.pieces || {}) };

    // 2. On trie les dénominations de la plus grande à la plus petite valeur monétaire
    const sortedDenoms = Object.keys(allDenoms).sort((a, b) => parseFloat(allDenoms[b]) - parseFloat(allDenoms[a]));

    let suggestions = [];
    let totalWithdrawnCents = 0;

    // 3. On parcourt les dénominations pour construire la suggestion
    for (const name of sortedDenoms) {
        const valueInCents = Math.round(parseFloat(allDenoms[name]) * 100);
        let qtyAvailable = parseInt(denominationsData[name], 10) || 0;

        // Récupérer le minimum à garder pour cette dénomination (converti en entier)
        const minToKeep = parseInt(config.minToKeep?.[name], 10) || 0;
        let qtyEffectivelyAvailable = Math.max(0, qtyAvailable - minToKeep);


        if (qtyEffectivelyAvailable > 0 && totalWithdrawnCents < targetWithdrawalAmountCents && valueInCents > 0) {
            const remainingToWithdrawCents = targetWithdrawalAmountCents - totalWithdrawnCents;

            // On calcule combien de coupures de cette valeur on peut utiliser
            const howManyCanFit = Math.floor(remainingToWithdrawCents / valueInCents);

            // On prend le minimum entre ce dont on a besoin et ce qui est effectivement disponible
            const qtyToWithdraw = Math.min(qtyEffectivelyAvailable, howManyCanFit);

            if (qtyToWithdraw > 0) {
                const totalValueCents = qtyToWithdraw * valueInCents;
                suggestions.push({
                    name,
                    value: valueInCents / 100, // On stocke la valeur unitaire en euros pour l'affichage
                    qty: qtyToWithdraw,
                    total: totalValueCents / 100 // On stocke le total de la ligne en euros
                });
                totalWithdrawnCents += totalValueCents;
            }
        }
    }

    // 4. On reconvertit le total final en euros seulement au moment de le retourner
    return { suggestions, totalToWithdraw: totalWithdrawnCents / 100 };
}

/**
 * Calcule tous les totaux pour TOUTES les caisses et met à jour l'affichage. (Inchangé)
 */
export function calculateAll(config, appState) {
    if (!config || !config.nomsCaisses || !config.denominations) {
        console.error("Configuration incomplète pour calculateAll");
        return;
    }

    Object.keys(config.nomsCaisses).forEach(id => {
        const caisseData = appState.calculatorData.caisse[id] || {};
        const formElements = document.getElementById('caisse-form')?.elements;
        if (!formElements) return; // Si le formulaire n'existe pas, on arrête

        // Mise à jour des données théoriques depuis le formulaire
        caisseData.fond_de_caisse = formElements[`caisse[${id}][fond_de_caisse]`]?.value || '0';
        caisseData.ventes_especes = formElements[`caisse[${id}][ventes_especes]`]?.value || '0';
        caisseData.retrocession = formElements[`caisse[${id}][retrocession]`]?.value || '0';
        caisseData.ventes_cb = formElements[`caisse[${id}][ventes_cb]`]?.value || '0';
        caisseData.retrocession_cb = formElements[`caisse[${id}][retrocession_cb]`]?.value || '0';
        caisseData.ventes_cheques = formElements[`caisse[${id}][ventes_cheques]`]?.value || '0';
        caisseData.retrocession_cheques = formElements[`caisse[${id}][retrocession_cheques]`]?.value || '0';

        // Mise à jour des quantités de dénominations depuis le formulaire
        caisseData.denominations = caisseData.denominations || {};
        const allDenoms = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
        Object.keys(allDenoms).forEach(name => {
            const input = formElements[`caisse[${id}][denominations][${name}]`];
            if (input) {
                caisseData.denominations[name] = input.value || '0';
            }
        });

        // Calcul des écarts avec les données mises à jour
        const results = calculateEcartsForCaisse(id, appState);

        // Mise à jour des totaux par dénomination et par type (billets/pièces)
        let totalBillets = 0, totalPieces = 0;
        Object.entries(config.denominations.billets || {}).forEach(([name, value]) => {
            const quantite = parseInt(caisseData.denominations[name], 10) || 0;
            const totalLigne = quantite * parseFloat(value);
            totalBillets += totalLigne;
            const totalElement = document.getElementById(`total_${name}_${id}`);
            if (totalElement) totalElement.textContent = formatCurrency(totalLigne, config);
        });
        Object.entries(config.denominations.pieces || {}).forEach(([name, value]) => {
            const quantite = parseInt(caisseData.denominations[name], 10) || 0;
            const totalLigne = quantite * parseFloat(value);
            totalPieces += totalLigne;
            const totalElement = document.getElementById(`total_${name}_${id}`);
            if (totalElement) totalElement.textContent = formatCurrency(totalLigne, config);
        });

        const totalBilletsElement = document.getElementById(`total-billets-${id}`);
        if (totalBilletsElement) totalBilletsElement.textContent = formatCurrency(totalBillets, config);

        const totalPiecesElement = document.getElementById(`total-pieces-${id}`);
        if (totalPiecesElement) totalPiecesElement.textContent = formatCurrency(totalPieces, config);

        const totalEspecesElement = document.getElementById(`total-especes-${id}`);
        if (totalEspecesElement) totalEspecesElement.textContent = formatCurrency(results.totalCompteEspeces, config);

        // Mise à jour de l'affichage des écarts
        updateEcartDisplay(id, { especes: results.ecartEspeces, cb: results.ecartCb, cheques: results.ecartCheques }, config);
    });
}

/**
 * Met à jour l'affichage des écarts pour une caisse. (Inchangé)
 */
function updateEcartDisplay(id, ecarts, config) {
    const activeTabKey = document.querySelector(`#caisse${id} .payment-tab-link.active`)?.dataset.methodKey || 'especes';
    const mainDisplay = document.getElementById(`main-ecart-caisse${id}`);
    const secondaryContainer = document.getElementById(`secondary-ecarts-caisse${id}`);

    // S'assurer que les éléments existent
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

    // Logique pour la phrase explicative
    if (explanationEl) {
        if (Math.abs(mainData.value) < 0.01) {
            explanationEl.textContent = `Le total des ${activeTabKey} correspond aux montants théoriques.`;
        } else if (mainData.value > 0) {
            explanationEl.textContent = `Il y a un excédent de ${formatCurrency(mainData.value, config)} pour les ${activeTabKey}.`;
        } else {
            explanationEl.textContent = `Il manque ${formatCurrency(Math.abs(mainData.value), config)} pour les ${activeTabKey}.`;
        }
    }

    mainDisplay.className = 'main-ecart-display'; // Réinitialise les classes
    if (Math.abs(mainData.value) < 0.01) mainDisplay.classList.add('ecart-ok');
    else mainDisplay.classList.add(mainData.value > 0 ? 'ecart-positif' : 'ecart-negatif');


    secondaryContainer.innerHTML = Object.entries(ecartData)
        .filter(([key]) => key !== activeTabKey)
        .map(([key, data]) => {
            let className = 'secondary-ecart-item ';
            if (Math.abs(data.value) < 0.01) className += 'ecart-ok';
            else className += (data.value > 0 ? 'ecart-positif' : 'ecart-negatif');
            return `<div class="${className}"><span>${data.label}:</span> <strong>${formatCurrency(data.value, config)}</strong></div>`;
        }).join('');
}
