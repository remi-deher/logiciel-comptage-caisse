// public/js/history/charts.js
// Ce module gère la création et la mise à jour de tous les graphiques de la page.

import * as dom from './dom.js';
import * as utils from './utils.js';
import { state } from './state.js';

// Récupère la configuration globale depuis l'élément du DOM.
const configElement = document.getElementById('history-data');
const globalConfig = configElement ? JSON.parse(configElement.dataset.config) : {};

/**
 * Crée le grand graphique global en haut de la page.
 * @param {Array} historique - La liste complète des comptages pour la période filtrée.
 */
export function renderGlobalChart(historique) {
    if (!dom.globalChartContainer) return;
    if (state.globalChart) {
        state.globalChart.destroy();
        state.globalChart = null;
    }
    if (!historique || historique.length === 0) {
        dom.globalChartContainer.innerHTML = '<p class="no-chart-data">Aucune donnée disponible pour le graphique.</p>';
        return;
    }
    const sortedHistorique = historique.sort((a, b) => new Date(a.date_comptage) - new Date(b.date_comptage));
    const dates = sortedHistorique.map(c => new Date(c.date_comptage).toLocaleDateString('fr-FR'));
    const ventesTotales = sortedHistorique.map(c => utils.calculateResults(c).combines.recette_reelle);
    const ecartsGlobaux = sortedHistorique.map(c => utils.calculateResults(c).combines.ecart);
    
    const options = {
        chart: { type: 'line', height: 350, animations: { enabled: true, easing: 'easeinout', speed: 800 } },
        series: [
            { name: 'Ventes totales', data: ventesTotales },
            { name: 'Écart global', data: ecartsGlobaux }
        ],
        xaxis: { categories: dates },
        yaxis: { labels: { formatter: (value) => utils.formatEuros(value) } },
        colors: ['#3498db', '#e74c3c'],
        tooltip: { y: { formatter: (value) => utils.formatEuros(value) } },
        stroke: { curve: 'smooth' },
        markers: { size: 4 },
        grid: { borderColor: '#e7e7e7', row: { colors: ['#f3f3f3', 'transparent'], opacity: 0.5 } }
    };

    setTimeout(() => {
        state.globalChart = new ApexCharts(dom.globalChartContainer, options);
        state.globalChart.render();
    }, 100);
}

/**
 * Crée le petit graphique à barres à l'intérieur de chaque carte de comptage.
 * @param {HTMLElement} element - Le conteneur du graphique.
 * @param {Array<number>} data - Les données de ventes par caisse.
 */
export function renderMiniChart(element, data) {
    const dataIsAllZeros = data.every(val => val === 0);
    if (!data || dataIsAllZeros) {
        element.innerHTML = '<p class="no-chart-data">Pas de données de vente.</p>';
        return;
    }
    element.innerHTML = '';
    const labels = Object.values(globalConfig.nomsCaisses);
    
    const options = {
        chart: { type: 'bar', height: 150, toolbar: { show: false }, sparkline: { enabled: true } },
        series: [{ data: data }],
        labels: labels,
        colors: ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6'],
        legend: { show: false },
        dataLabels: { enabled: false },
        tooltip: {
            y: { formatter: (value) => utils.formatEuros(value) },
            x: { formatter: (seriesName, opts) => labels[opts.dataPointIndex] }
        },
        xaxis: {
            categories: labels,
            labels: { style: { colors: getComputedStyle(document.body).getPropertyValue('--color-text-secondary') } }
        }
    };

    setTimeout(() => {
        const chart = new ApexCharts(element, options);
        chart.render();
        element.chart = chart;
    }, 100);
}

/**
 * Crée le graphique de répartition des retraits par caisse.
 * @param {object} byCaisseData - Données agrégées des retraits par nom de caisse.
 */
export function renderWithdrawalsChart(byCaisseData) {
    const container = document.getElementById('withdrawals-by-caisse-chart');
    if (!container) return;
    
    if (container.chart) {
        container.chart.destroy();
    }

    const labels = Object.keys(byCaisseData);
    const series = Object.values(byCaisseData);

    if (labels.length === 0) {
        container.innerHTML = '<p class="no-chart-data">Aucune donnée pour le graphique.</p>';
        return;
    }

    const options = {
        chart: { type: 'donut', height: 300 },
        series: series,
        labels: labels,
        legend: { position: 'bottom' },
        tooltip: { y: { formatter: (val) => utils.formatEuros(val) } },
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total Retiré',
                            formatter: (w) => {
                                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                return utils.formatEuros(total);
                            }
                        }
                    }
                }
            }
        }
    };

    const chart = new ApexCharts(container, options);
    chart.render();
    container.chart = chart;
}
