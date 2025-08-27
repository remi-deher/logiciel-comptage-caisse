// public/js/history/modals.js
// Ce module gère l'affichage, le contenu et les interactions des fenêtres modales.

import * as dom from './dom.js';
import * as utils from './utils.js';
import { state } from './state.js'; // Importe l'état partagé
import { generateComptagePdf, generateComptageCsv } from './export.js';

// Récupère la configuration globale
const configElement = document.getElementById('history-data');
const globalConfig = configElement ? JSON.parse(configElement.dataset.config) : {};

/**
 * Ferme la modale de détails et détruit le graphique associé.
 */
export function closeDetailsModal() {
    if (dom.detailsModal) {
        dom.detailsModal.classList.remove('visible');
        if (state.modalChart) { // Utilise l'état partagé
            state.modalChart.destroy();
            state.modalChart = null; // Modifie l'état partagé
        }
    }
}

/**
 * Ferme la modale de comparaison.
 */
export function closeComparisonModal() {
    if (dom.comparisonModal) {
        dom.comparisonModal.classList.remove('visible');
    }
}

/**
 * Affiche la modale de détails.
 * @param {object} comptageData - Les données du comptage.
 * @param {string|null} caisseId - L'ID de la caisse, ou null pour la vue globale.
 */
export function showDetailsModal(comptageData, caisseId = null) {
    const calculatedResults = utils.calculateResults(comptageData);
    const isGlobalView = caisseId === null;
    const caisseNom = isGlobalView ? "Ensemble" : globalConfig.nomsCaisses[caisseId];

    // ... (Le reste du code de cette fonction est long mais n'a pas besoin de changer)
    // ... Collez ici le reste de la fonction showDetailsModal que je vous avais donnée précédemment...
    // Pour être complet, la voici :

    const generateSummaryHtml = (summaryData) => {
        const ecartClass = summaryData.ecart > 0.01 ? 'ecart-positif' : (summaryData.ecart < -0.01 ? 'ecart-negatif' : 'ecart-ok');
        return `
            <div class="summary-grid">
                <div class="summary-box"><span>Fond de Caisse</span><strong>${utils.formatEuros(summaryData.fond_de_caisse)}</strong></div>
                <div class="summary-box"><span>Ventes Théoriques</span><strong>${utils.formatEuros(summaryData.ventes)}</strong></div>
                <div class="summary-box"><span>Rétrocessions</span><strong>${utils.formatEuros(summaryData.retrocession)}</strong></div>
                <div class="summary-box"><span>Total Compté</span><strong>${utils.formatEuros(summaryData.total_compte)}</strong></div>
                <div class="summary-box"><span>Recette Réelle</span><strong>${utils.formatEuros(summaryData.recette_reelle)}</strong></div>
                <div class="summary-box ${ecartClass}"><span>Écart Final</span><strong>${utils.formatEuros(summaryData.ecart)}</strong></div>
            </div>`;
    };
    
    const summaryData = isGlobalView ? calculatedResults.combines : calculatedResults.caisses[caisseId];
    
    const html = `
        <div class="modal-header">
            <h3>Détails pour : ${caisseNom}</h3>
            <span class="modal-close">&times;</span>
        </div>
        <h4>Résumé Financier</h4>
        ${generateSummaryHtml(summaryData)}
        <div class="modal-footer" style="margin-top: 20px;">
            <button class="action-btn-small" id="pdf-modal-btn"><i class="fa-solid fa-file-pdf"></i> Exporter en PDF</button>
            <button class="action-btn-small" id="csv-modal-btn"><i class="fa-solid fa-file-csv"></i> Exporter en CSV</button>
        </div>
    `;

    if (dom.detailsModalContent) {
        dom.detailsModalContent.innerHTML = html;
        dom.detailsModal.classList.add('visible');
        
        const dataForExport = isGlobalView ? { ...comptageData, isGlobal: true } : comptageData;
        document.getElementById('pdf-modal-btn').addEventListener('click', () => generateComptagePdf(dataForExport));
        document.getElementById('csv-modal-btn').addEventListener('click', () => generateComptageCsv(dataForExport));
    }
}


/**
 * Affiche la modale de comparaison.
 * @param {Array<string>} selectedIds - Les IDs des comptages à comparer.
 */
export function showComparisonModal(selectedIds) {
    if (selectedIds.length < 2) return;

    const gridClass = selectedIds.length > 3 ? 'comparison-grid-dynamic' : `comparison-grid-${selectedIds.length}`;
    let html = `<div class="modal-header"><h3>Comparaison de Comptages</h3><span class="modal-close">&times;</span></div><div class="comparison-grid ${gridClass}">`;

    const firstData = JSON.parse(document.querySelector(`.history-card[data-id="${selectedIds[0]}"]`).dataset.comptage);
    const firstResults = utils.calculateResults(firstData);

    selectedIds.forEach(comptageId => {
        const data = JSON.parse(document.querySelector(`.history-card[data-id="${comptageId}"]`).dataset.comptage);
        const results = utils.calculateResults(data);

        const renderValue = (val1, val2) => {
            if (data.id === firstData.id) {
                return `<span class="comparison-item-value">${utils.formatEuros(val2)}</span>`;
            }
            const diff = val2 - val1;
            let diffHtml = '';
            if (Math.abs(diff) > 0.001) {
                const diffClass = diff > 0 ? 'positive' : 'negative';
                const sign = diff > 0 ? '+' : '';
                diffHtml = `<span class="value-diff ${diffClass}">(${sign}${utils.formatEuros(diff)})</span>`;
            }
            return `<span class="comparison-item-value">${utils.formatEuros(val2)}</span> ${diffHtml}`;
        };
        
        html += `
            <div class="comparison-column">
                <h4>${data.nom_comptage}</h4>
                <div class="comparison-item"><span class="comparison-item-label">Date</span><span class="comparison-item-value">${utils.formatDateFr(data.date_comptage)}</span></div>
                <div class="comparison-item"><span class="comparison-item-label">Total Compté</span><span>${renderValue(firstResults.combines.total_compté, results.combines.total_compté)}</span></div>
                <div class="comparison-item"><span class="comparison-item-label">Recette Réelle</span><span>${renderValue(firstResults.combines.recette_reelle, results.combines.recette_reelle)}</span></div>
                <div class="comparison-item"><span class="comparison-item-label">Écart Final</span><span>${renderValue(firstResults.combines.ecart, results.combines.ecart)}</span></div>
            </div>
        `;
    });
    
    html += `</div>`;
    if(dom.comparisonModalContent) {
        dom.comparisonModalContent.innerHTML = html;
        dom.comparisonModal.classList.add('visible');
    }
}
