// public/js/history/modals.js
// Ce module gère l'affichage, le contenu et les interactions des fenêtres modales.

import * as dom from './dom.js';
import * as utils from './utils.js';
import { state } from './state.js';
import { generateComptagePdf, generateComptageCsv } from './export.js';
// N.B. : Le graphique de la modale est géré directement ici car il est simple.

// Récupère la configuration globale
const configElement = document.getElementById('history-data');
const globalConfig = configElement ? JSON.parse(configElement.dataset.config) : {};

/**
 * Ferme la modale de détails de comptage.
 */
export function closeDetailsModal() {
    if (dom.detailsModal) {
        dom.detailsModal.classList.remove('visible');
        if (state.modalChart) {
            state.modalChart.destroy();
            state.modalChart = null;
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
 * Ferme la modale des détails de retraits.
 */
export function closeWithdrawalDetailsModal() {
    const modal = document.getElementById('withdrawal-details-modal');
    if (modal) {
        modal.classList.remove('visible');
    }
}


/**
 * Affiche la modale de détails pour un comptage (VERSION COMPLÈTE ET CORRIGÉE).
 */
export function showDetailsModal(comptageData, caisseId = null) {
    const calculatedResults = utils.calculateResults(comptageData);
    const isGlobalView = caisseId === null;
    const caisseNom = isGlobalView ? "Synthèse Globale" : globalConfig.nomsCaisses[caisseId];

    // --- Fonctions internes pour générer le HTML ---

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
    
    const getDenominationsSource = (comptage, caisse) => {
        if (isGlobalView) {
            const summaryQuantities = {};
            for (const caisse_id in comptage.caisses_data) {
                const caisseDetails = comptage.caisses_data[caisse_id];
                if (caisseDetails.denominations) {
                    for (const name in caisseDetails.denominations) {
                         summaryQuantities[name] = (summaryQuantities[name] || 0) + parseInt(caisseDetails.denominations[name] || 0);
                    }
                }
            }
            return summaryQuantities;
        }
        return comptage.caisses_data[caisse]?.denominations || {};
    };

    const generateDenominationsTableHtml = (denominationsSource) => {
        let tableHtml = '<table class="modal-details-table"><thead><tr><th>Dénomination</th><th>Quantité</th><th>Total</th></tr></thead><tbody>';
        let totalCaisse = 0;
        if (globalConfig.denominations && denominationsSource) {
            for (const type in globalConfig.denominations) {
                for (const [name, value] of Object.entries(globalConfig.denominations[type])) {
                    const quantite = denominationsSource[name] || 0;
                    if (quantite > 0) {
                        const totalLigne = quantite * value;
                        totalCaisse += totalLigne;
                        const label = value >= 1 ? `${value} ${globalConfig.currencySymbol}` : `${value * 100} cts`;
                        tableHtml += `<tr><td>${type === 'billets' ? 'Billet' : 'Pièce'} de ${label}</td><td>${quantite}</td><td>${utils.formatEuros(totalLigne)}</td></tr>`;
                    }
                }
            }
        }
        if (totalCaisse === 0) return "<p>Aucune espèce comptée.</p>";
        tableHtml += '</tbody></table>';
        return tableHtml;
    };


    const summaryData = isGlobalView ? calculatedResults.combines : calculatedResults.caisses[caisseId];
    const denominationsSource = getDenominationsSource(comptageData, caisseId);

    const html = `
        <div class="modal-header">
            <h3>Détails pour : ${caisseNom}</h3>
            <span class="modal-close">&times;</span>
        </div>
        <h4>Résumé Financier</h4>
        ${generateSummaryHtml(summaryData)}
        
        <div class="modal-details-grid">
            <div>
                <h4>Répartition des Espèces</h4>
                <div id="modal-chart-container"></div>
            </div>
            <div>
                <h4>Détail des Espèces</h4>
                ${generateDenominationsTableHtml(denominationsSource)}
            </div>
        </div>
        <div class="modal-footer" style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
            <button class="action-btn-small" id="pdf-modal-btn"><i class="fa-solid fa-file-pdf"></i> Exporter en PDF</button>
            <button class="action-btn-small" id="csv-modal-btn"><i class="fa-solid fa-file-csv"></i> Exporter en CSV</button>
        </div>
    `;

    if (dom.detailsModalContent) {
        dom.detailsModalContent.innerHTML = html;
        dom.detailsModal.classList.add('visible');
        
        // Rendu du graphique
        renderModalChart(document.getElementById('modal-chart-container'), denominationsSource);
        
        const dataForExport = isGlobalView ? { ...comptageData, isGlobal: true } : comptageData;
        document.getElementById('pdf-modal-btn').addEventListener('click', () => generateComptagePdf(dataForExport));
        document.getElementById('csv-modal-btn').addEventListener('click', () => generateComptageCsv(dataForExport));
    }
}

/**
 * Affiche la modale de comparaison.
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
            if (data.id === firstData.id) return `<span class="comparison-item-value">${utils.formatEuros(val2)}</span>`;
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
            </div>`;
    });
    
    html += `</div>`;
    if(dom.comparisonModalContent) {
        dom.comparisonModalContent.innerHTML = html;
        dom.comparisonModal.classList.add('visible');
    }
}

/**
 * (NOUVEAU) Affiche la modale interactive pour le détail des retraits d'une journée.
 * @param {object} dayData - Les données de retrait pour une journée spécifique.
 */
export function showWithdrawalDetailsModal(dayData) {
    const modal = document.getElementById('withdrawal-details-modal');
    const content = document.getElementById('modal-withdrawal-details-content');
    if (!modal || !content) return;

    const caisseOptions = [...new Set(dayData.withdrawals.map(w => w.caisse))];
    
    let html = `
        <div class="modal-header">
            <h3>Détail des retraits du ${dayData.dateDisplay}</h3>
            <span class="modal-close">&times;</span>
        </div>
        <div class="kpi-container-retraits">
            <div class="kpi-card-retrait">
                <h3>Montant Total Retiré</h3>
                <p>${utils.formatEuros(dayData.total)}</p>
            </div>
            <div class="kpi-card-retrait">
                <h3>Nb. Opérations</h3>
                <p>${dayData.operations}</p>
            </div>
        </div>
        <div class="withdrawal-modal-filters">
            <select id="modal-caisse-filter" class="inline-input">
                <option value="">Toutes les caisses</option>
                ${caisseOptions.map(caisse => `<option value="${caisse}">${caisse}</option>`).join('')}
            </select>
            <input type="text" id="modal-denom-filter" class="inline-input" placeholder="Filtrer par dénomination...">
        </div>
        <div id="withdrawal-details-table-container">
            <table class="modal-details-table log-table">
                <thead>
                    <tr>
                        <th>Heure</th>
                        <th>Caisse</th>
                        <th>Dénomination</th>
                        <th>Quantité</th>
                        <th>Montant</th>
                    </tr>
                </thead>
                <tbody>
                    ${dayData.withdrawals.map(w => {
                        const label = w.valeurUnitaire >= 1 ? `${w.valeurUnitaire} ${globalConfig.currencySymbol}` : `${w.valeurUnitaire * 100} cts`;
                        return `
                            <tr class="withdrawal-detail-row" data-caisse="${w.caisse}" data-denom="${label.toLowerCase()}">
                                <td>${new Date(w.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                                <td>${w.caisse}</td>
                                <td>${label}</td>
                                <td>${w.quantite}</td>
                                <td>${utils.formatEuros(w.quantite * w.valeurUnitaire)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    content.innerHTML = html;
    modal.classList.add('visible');

    const caisseFilter = document.getElementById('modal-caisse-filter');
    const denomFilter = document.getElementById('modal-denom-filter');
    const rows = content.querySelectorAll('.withdrawal-detail-row');

    const applyFilters = () => {
        const caisseQuery = caisseFilter.value;
        const denomQuery = denomFilter.value.toLowerCase();
        
        rows.forEach(row => {
            const caisseMatch = !caisseQuery || row.dataset.caisse === caisseQuery;
            const denomMatch = !denomQuery || row.dataset.denom.includes(denomQuery);
            row.style.display = caisseMatch && denomMatch ? '' : 'none';
        });
    };

    caisseFilter.addEventListener('change', applyFilters);
    denomFilter.addEventListener('input', applyFilters);
}

/**
 * Fonction interne pour le rendu du graphique dans la modale de comptage.
 */
function renderModalChart(element, denominationsSource) {
    if (!element) return;
    
    let denominationsData = {};
    let totalCaisse = 0;

    for (const type in globalConfig.denominations) {
        for (const [name, value] of Object.entries(globalConfig.denominations[type])) {
            const quantite = parseInt(denominationsSource[name] || 0);
            const totalLigne = quantite * value;
            if (totalLigne > 0) {
                const label = value >= 1 ? `${value} ${globalConfig.currencySymbol}` : `${value * 100} cts`;
                denominationsData[label] = (denominationsData[label] || 0) + totalLigne;
                totalCaisse += totalLigne;
            }
        }
    }

    if (Object.keys(denominationsData).length === 0) {
        element.innerHTML = '<p class="no-chart-data">Aucune donnée de dénomination à afficher.</p>';
        return;
    }

    const options = {
        chart: { type: 'donut', height: 300 },
        series: Object.values(denominationsData),
        labels: Object.keys(denominationsData),
        legend: { position: 'bottom' },
        tooltip: { y: { formatter: (val) => utils.formatEuros(val) } },
        plotOptions: { pie: { donut: { labels: { show: true, total: { show: true, label: 'Total Espèces', formatter: () => utils.formatEuros(totalCaisse) } } } } }
    };

    if (state.modalChart) state.modalChart.destroy();
    state.modalChart = new ApexCharts(element, options);
    state.modalChart.render();
}
