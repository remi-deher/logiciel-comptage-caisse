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
    if (dom.globalChart) {
        dom.globalChart.destroy();
        dom.globalChart = null;
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

    // Un léger délai pour s'assurer que le conteneur est visible avant de dessiner.
    setTimeout(() => {
        // CORRIGÉ : On assigne la nouvelle instance du graphique à notre objet d'état
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
        element.chart = chart; // Stocke la référence au graphique pour le redimensionnement
    }, 100);
}
