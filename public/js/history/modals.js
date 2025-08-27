// public/js/history/modals.js
// Ce module gère l'affichage, le contenu et les interactions de toutes les fenêtres modales.

import * as dom from './dom.js';
import * as utils from './utils.js';
import { state } from './state.js';
import { generateComptagePdf, generateComptageCsv } from './export.js';

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
 * Affiche la modale de détails pour un comptage.
 */
export function showDetailsModal(comptageData, caisseId = null) {
    const calculatedResults = utils.calculateResults(comptageData);
    const isGlobalView = caisseId === null;
    const caisseNom = isGlobalView ? "Synthèse Globale" : globalConfig.nomsCaisses[caisseId];

    // --- Fonctions internes pour générer le HTML ---

    const generateSummaryHtml = (summaryData) => {
        const ecartClass = summaryData.ecart > 0.01 ? 'ecart-positif' : (summaryData.ecart < -0.01 ? 'ecart-negatif' : 'ecart-ok');
        const ecartIcon = summaryData.ecart > 0.01 ? 'fa-arrow-trend-up' : (summaryData.ecart < -0.01 ? 'fa-arrow-trend-down' : 'fa-equals');

        return `
            <ul class="summary-list">
                <li><i class="fa-solid fa-piggy-bank summary-icon icon-fond-caisse"></i><div><span>Fond de Caisse</span><strong>${utils.formatEuros(summaryData.fond_de_caisse)}</strong></div></li>
                <li><i class="fa-solid fa-cash-register summary-icon icon-ventes"></i><div><span>Ventes Théoriques</span><strong>${utils.formatEuros(summaryData.ventes)}</strong></div></li>
                <li><i class="fa-solid fa-hand-holding-dollar summary-icon icon-retrocession"></i><div><span>Rétrocessions</span><strong>${utils.formatEuros(summaryData.retrocession)}</strong></div></li>
                <li><i class="fa-solid fa-coins summary-icon icon-compte"></i><div><span>Total Compté</span><strong>${utils.formatEuros(summaryData.total_compte)}</strong></div></li>
                <li><i class="fa-solid fa-sack-dollar summary-icon icon-recette"></i><div><span>Recette Réelle</span><strong>${utils.formatEuros(summaryData.recette_reelle)}</strong></div></li>
                <li class="${ecartClass}"><i class="fa-solid ${ecartIcon} summary-icon"></i><div><span>Écart Final</span><strong>${utils.formatEuros(summaryData.ecart)}</strong></div></li>
            </ul>`;
    };

    const getDenominationsSource = (comptage, caisse) => {
        if (isGlobalView) {
            return Object.values(comptage.caisses_data).reduce((acc, caisseData) => {
                if (caisseData.denominations) {
                    for (const name in caisseData.denominations) {
                        acc[name] = (acc[name] || 0) + parseInt(caisseData.denominations[name] || 0);
                    }
                }
                return acc;
            }, {});
        }
        return comptage.caisses_data[caisse]?.denominations || {};
    };

    const generateDenominationsTableHtml = (denominationsSource) => {
        let tableHtml = '<table class="modal-details-table"><thead><tr><th>Dénomination</th><th>Quantité</th><th>Total</th></tr></thead><tbody>';
        let totalCaisse = 0;
        if (globalConfig.denominations && denominationsSource) {
            const allDenoms = [...Object.entries(globalConfig.denominations.billets), ...Object.entries(globalConfig.denominations.pieces)]
                .sort(([, valA], [, valB]) => valB - valA);

            for (const [name, value] of allDenoms) {
                const quantite = denominationsSource[name] || 0;
                if (quantite > 0) {
                    const totalLigne = quantite * value;
                    totalCaisse += totalLigne;
                    const label = value >= 1 ? `${value} ${globalConfig.currencySymbol}` : `${value * 100} cts`;
                    const type = globalConfig.denominations.billets[name] ? 'Billet' : 'Pièce';
                    tableHtml += `<tr><td>${type} de ${label}</td><td>${quantite}</td><td>${utils.formatEuros(totalLigne)}</td></tr>`;
                }
            }
        }
        if (totalCaisse === 0) return "<p class='no-chart-data'>Aucune espèce comptée.</p>";
        tableHtml += '</tbody></table>';
        return tableHtml;
    };
    
    const generateRetraitsTableHtml = () => {
        const sourceData = isGlobalView ? Object.values(comptageData.caisses_data) : [comptageData.caisses_data[caisseId]];
        
        const allRetraits = sourceData.reduce((acc, caisseData) => {
            if (caisseData && caisseData.retraits) {
                for(const name in caisseData.retraits) {
                    acc[name] = (acc[name] || 0) + parseInt(caisseData.retraits[name] || 0);
                }
            }
            return acc;
        }, {});

        if (Object.keys(allRetraits).length === 0) return '';

        let retraitsHtml = '<h4><i class="fa-solid fa-right-from-bracket"></i> Retraits Effectués</h4>';
        retraitsHtml += '<table class="modal-details-table retrait-table"><thead><tr><th>Dénomination</th><th>Quantité Retirée</th><th>Montant Retiré</th></tr></thead><tbody>';
        let totalRetire = 0;

        const allDenoms = [...Object.entries(globalConfig.denominations.billets), ...Object.entries(globalConfig.denominations.pieces)]
            .sort(([, valA], [, valB]) => valB - valA);

        for (const [name, value] of allDenoms) {
            const quantite = allRetraits[name] || 0;
            if (quantite > 0) {
                const totalLigne = quantite * value;
                totalRetire += totalLigne;
                const label = value >= 1 ? `${value} ${globalConfig.currencySymbol}` : `${value * 100} cts`;
                const type = globalConfig.denominations.billets[name] ? 'Billet' : 'Pièce';
                retraitsHtml += `<tr><td>${type} de ${label}</td><td>${quantite}</td><td>${utils.formatEuros(totalLigne)}</td></tr>`;
            }
        }
        retraitsHtml += `</tbody><tfoot><tr><td colspan="2">Total Retiré</td><td><strong>${utils.formatEuros(totalRetire)}</strong></td></tr></tfoot></table>`;
        return retraitsHtml;
    };

    const summaryData = isGlobalView ? calculatedResults.combines : calculatedResults.caisses[caisseId];
    const denominationsSource = getDenominationsSource(comptageData, caisseId);
    const isComptageFinal = comptageData.nom_comptage.startsWith('Comptage final');

    const html = `
        <div class="modal-header">
            <h3>Détails pour : ${caisseNom}</h3>
            <span class="modal-close">&times;</span>
        </div>
        <h4>Résumé Financier</h4>
        ${generateSummaryHtml(summaryData)}
        
        ${isComptageFinal ? generateRetraitsTableHtml() : ''}

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
 * Affiche la modale interactive pour le détail des retraits d'une journée.
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
            <table class="modal-details-table log-table sortable">
                <thead>
                    <tr>
                        <th data-sort="time">Heure</th>
                        <th data-sort="caisse">Caisse</th>
                        <th data-sort="denom">Dénomination</th>
                        <th data-sort="quantite" class="sort-numeric">Quantité</th>
                        <th data-sort="montant" class="sort-numeric">Montant</th>
                    </tr>
                </thead>
                <tbody>
                    ${dayData.withdrawals.map(w => {
                        const label = w.valeurUnitaire >= 1 ? `${w.valeurUnitaire} ${globalConfig.currencySymbol}` : `${w.valeurUnitaire * 100} cts`;
                        const montant = w.quantite * w.valeurUnitaire;
                        return `
                            <tr class="withdrawal-detail-row" 
                                data-caisse="${w.caisse}" 
                                data-denom="${label.toLowerCase()}"
                                data-time="${new Date(w.date).getTime()}"
                                data-quantite="${w.quantite}"
                                data-montant="${montant}">
                                <td>${new Date(w.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                                <td>${w.caisse}</td>
                                <td>${label}</td>
                                <td class="text-right">${w.quantite}</td>
                                <td class="text-right">${utils.formatEuros(montant)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr id="withdrawal-totals-row">
                        <td colspan="3">Total (visible)</td>
                        <td class="text-right" id="total-quantite"></td>
                        <td class="text-right" id="total-montant"></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
    content.innerHTML = html;
    modal.classList.add('visible');

    const table = content.querySelector('.sortable');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const caisseFilter = document.getElementById('modal-caisse-filter');
    const denomFilter = document.getElementById('modal-denom-filter');

    const updateTotalRow = () => {
        let totalQuantite = 0;
        let totalMontant = 0;
        tbody.querySelectorAll('tr').forEach(row => {
            if (row.style.display !== 'none') {
                totalQuantite += parseInt(row.dataset.quantite);
                totalMontant += parseFloat(row.dataset.montant);
            }
        });
        document.getElementById('total-quantite').textContent = totalQuantite;
        document.getElementById('total-montant').textContent = utils.formatEuros(totalMontant);
    };

    const applyFilters = () => {
        const caisseQuery = caisseFilter.value;
        const denomQuery = denomFilter.value.toLowerCase();
        
        rows.forEach(row => {
            const caisseMatch = !caisseQuery || row.dataset.caisse === caisseQuery;
            const denomMatch = !denomQuery || row.dataset.denom.includes(denomQuery);
            row.style.display = caisseMatch && denomMatch ? '' : 'none';
        });
        updateTotalRow();
    };
    
    caisseFilter.addEventListener('change', applyFilters);
    denomFilter.addEventListener('input', applyFilters);

    table.querySelectorAll('th').forEach(header => {
        header.addEventListener('click', () => {
            const sortProperty = header.dataset.sort;
            if (!sortProperty) return;

            const isAsc = header.classList.contains('sort-asc');
            const sortDirection = isAsc ? -1 : 1;

            const sortedRows = [...rows].sort((a, b) => {
                let valA = a.dataset[sortProperty];
                let valB = b.dataset[sortProperty];
                
                if (header.classList.contains('sort-numeric')) {
                    valA = parseFloat(valA);
                    valB = parseFloat(valB);
                }
                
                return (valA < valB ? -1 : valA > valB ? 1 : 0) * sortDirection;
            });
            
            tbody.innerHTML = '';
            sortedRows.forEach(row => tbody.appendChild(row));

            table.querySelectorAll('th').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
            header.classList.toggle('sort-asc', !isAsc);
            header.classList.toggle('sort-desc', isAsc);
        });
    });

    updateTotalRow();
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
