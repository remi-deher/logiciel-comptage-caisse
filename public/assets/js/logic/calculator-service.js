// Fichier : public/assets/js/logic/calculator-service.js

import { formatCurrency, parseLocaleFloat } from '../utils/formatters.js';

/**
 * Calcule tous les totaux et écarts pour l'ensemble des caisses.
 * Met à jour l'affichage directement.
 */
export function calculateAll(config, chequesState, tpeState) {
    if (!config.nomsCaisses) return;
    Object.keys(config.nomsCaisses).forEach(id => {
        let totalBillets = 0, totalPieces = 0;

        // Calcul des totaux pour les billets
        Object.entries(config.denominations.billets).forEach(([name, value]) => {
            const input = document.getElementById(`${name}_${id}`);
            if (input) {
                const quantite = parseInt(input.value, 10) || 0;
                const totalLigne = quantite * parseFloat(value);
                totalBillets += totalLigne;
                document.getElementById(`total_${name}_${id}`).textContent = formatCurrency(totalLigne, config);
            }
        });

        // Calcul des totaux pour les pièces
        Object.entries(config.denominations.pieces).forEach(([name, value]) => {
            const input = document.getElementById(`${name}_${id}`);
            if (input) {
                const quantite = parseInt(input.value, 10) || 0;
                const totalLigne = quantite * parseFloat(value);
                totalPieces += totalLigne;
                document.getElementById(`total_${name}_${id}`).textContent = formatCurrency(totalLigne, config);
            }
        });

        document.getElementById(`total-billets-${id}`).textContent = formatCurrency(totalBillets, config);
        document.getElementById(`total-pieces-${id}`).textContent = formatCurrency(totalPieces, config);
        const totalEspeces = totalBillets + totalPieces;
        document.getElementById(`total-especes-${id}`).textContent = formatCurrency(totalEspeces, config);

        // Calcul des écarts
        const fondDeCaisse = parseLocaleFloat(document.getElementById(`fond_de_caisse_${id}`).value);
        const ventesEspeces = parseLocaleFloat(document.getElementById(`ventes_especes_${id}`).value);
        const retrocession = parseLocaleFloat(document.getElementById(`retrocession_${id}`).value);
        const ecartEspeces = (totalEspeces - fondDeCaisse) - (ventesEspeces + retrocession);

        let totalComptéCB = 0;
        if (tpeState[id]) {
            for (const terminalId in tpeState[id]) {
                const releves = tpeState[id][terminalId];
                if (releves && releves.length > 0) {
                    const dernierReleve = releves[releves.length - 1];
                    totalComptéCB += parseLocaleFloat(dernierReleve.montant);
                }
            }
        }
        const ventesCb = parseLocaleFloat(document.getElementById(`ventes_cb_${id}`).value);
        const ecartCb = totalComptéCB - ventesCb;

        const totalComptéCheques = (chequesState[id] || []).reduce((sum, cheque) => sum + parseLocaleFloat(cheque.montant), 0);
        const ventesCheques = parseLocaleFloat(document.getElementById(`ventes_cheques_${id}`).value);
        const ecartCheques = totalComptéCheques - ventesCheques;

        updateEcartDisplay(id, { especes: ecartEspeces, cb: ecartCb, cheques: ecartCheques }, config);
    });
}

/**
 * Met à jour l'affichage du bandeau d'écart pour une caisse donnée.
 */
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
        mainDisplay.className = 'main-ecart-display'; // Reset classes
        if (Math.abs(mainData.value) < 0.01) mainDisplay.classList.add('ecart-ok');
        else mainDisplay.classList.add(mainData.value > 0 ? 'ecart-positif' : 'ecart-negatif');
    }

    if (secondaryContainer) {
        let secondaryHtml = '';
        for (const key in ecartData) {
            if (key !== activeTabKey) {
                const data = ecartData[key];
                let className = 'secondary-ecart-item ';
                if (Math.abs(data.value) < 0.01) className += 'ecart-ok';
                else className += (data.value > 0 ? 'ecart-positif' : 'ecart-negatif');
                secondaryHtml += `<div class="${className}"><span>${data.label}:</span> <strong>${formatCurrency(data.value, config)}</strong></div>`;
            }
        }
        secondaryContainer.innerHTML = secondaryHtml;
    }
}
