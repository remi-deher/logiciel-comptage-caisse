// Fichier : public/assets/js/logic/history-logic.js (Version Complète, Finale et Corrigée)
import { sendWsMessage } from './websocket-service.js';

// --- Variables globales pour la page ---
let fullHistoryData = [];
let config = {};
let withdrawalsByDay = {};
let withdrawalChart = null;
let withdrawalDonutChart = null;
let modalRepartitionChart = null;
let modalDenominationsChart = null;


const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(montant);
const formatDateFr = (dateString, options = { dateStyle: 'long', timeStyle: 'short' }) => new Intl.DateTimeFormat('fr-FR', options).format(new Date(dateString));
const getEcartClass = (ecart) => {
    if (Math.abs(ecart) < 0.01) return 'ecart-ok';
    return ecart > 0 ? 'ecart-positif' : 'ecart-negatif';
};

// --- API ---
async function fetchHistoriqueData(params) {
    const configPromise = fetch('index.php?route=calculateur/config').then(res => res.json());
    const historyPromise = fetch(`index.php?route=historique/get_data&${new URLSearchParams(params)}`).then(res => res.json());
    const [conf, history] = await Promise.all([configPromise, historyPromise]);
    config = conf;
    if (!history.historique) throw new Error(`La réponse de l'API pour l'historique est invalide.`);
    fullHistoryData = history.historique_complet || [];
    return history;
}

// --- Logique de traitement des données ---
function processWithdrawalData(comptages, denominations) {
    withdrawalsByDay = {};
    const allDenomsValueMap = { ...(denominations.billets || {}), ...(denominations.pieces || {}) };
    if (!comptages) return;
    for (const comptage of comptages) {
        const dateKey = new Date(comptage.date_comptage).toISOString().split('T')[0];
        if (!withdrawalsByDay[dateKey]) {
            withdrawalsByDay[dateKey] = { totalValue: 0, totalItems: 0, details: [] };
        }
        if (!comptage.caisses_data) continue;
        for (const [caisse_id, caisse] of Object.entries(comptage.caisses_data)) {
            if (!caisse.retraits || Object.keys(caisse.retraits).length === 0) continue;
            for (const [denom, qtyStr] of Object.entries(caisse.retraits)) {
                const qty = parseInt(qtyStr, 10);
                const value = parseFloat(allDenomsValueMap[denom]);
                if (!isNaN(qty) && !isNaN(value) && qty > 0) {
                    const amount = qty * value;
                    if (!isNaN(amount)) {
                        withdrawalsByDay[dateKey].totalValue += amount;
                        withdrawalsByDay[dateKey].totalItems += qty;
                        withdrawalsByDay[dateKey].details.push({ caisse_id, caisse_nom: config.nomsCaisses[caisse_id] || `Caisse ${caisse_id}`, denomination: denom, quantite: qty, valeur: amount });
                    }
                }
            }
        }
    }
}


// --- Fonctions pour les graphiques de la modale ---
function renderModalCharts(caisseId, caisseData, caisseResults) {
    if (modalRepartitionChart) modalRepartitionChart.destroy();
    if (modalDenominationsChart) modalDenominationsChart.destroy();

    const theme = { theme: { mode: document.body.dataset.theme === 'dark' ? 'dark' : 'light' } };

    // 1. Graphique Donut de Répartition
    const repartitionContainer = document.getElementById(`modal-repartition-chart-${caisseId}`);
    if (repartitionContainer) {
        const series = [
            parseFloat(caisseResults.total_compte_especes || 0),
            parseFloat(caisseResults.total_compte_cb || 0),
            parseFloat(caisseResults.total_compte_cheques || 0)
        ];
        if (series.some(val => val > 0)) {
            const optionsRepartition = {
                ...theme,
                series: series,
                labels: ['Espèces', 'Carte Bancaire', 'Chèques'],
                chart: { type: 'donut', height: 250 },
                legend: { position: 'bottom' },
                dataLabels: { enabled: true, formatter: (val) => `${val.toFixed(1)}%` },
                tooltip: { y: { formatter: (val) => formatEuros(val) } }
            };
            modalRepartitionChart = new ApexCharts(repartitionContainer, optionsRepartition);
            modalRepartitionChart.render();
        } else {
            repartitionContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Aucune donnée de paiement à afficher.</p>';
        }
    }

    // 2. Graphique Barres des Dénominations
    const denominationsContainer = document.getElementById(`modal-denominations-chart-${caisseId}`);
    if (denominationsContainer) {
        const allDenomsMap = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
        const denomData = caisseData.denominations
            .filter(d => parseInt(d.quantite, 10) > 0)
            .map(d => ({
                quantite: parseInt(d.quantite, 10),
                value: parseFloat(allDenomsMap[d.denomination_nom])
             }))
            .sort((a, b) => b.value - a.value);
        
        if (denomData.length > 0) {
            const optionsDenominations = {
                ...theme,
                series: [{ name: 'Valeur', data: denomData.map(d => d.quantite * d.value) }],
                chart: { type: 'bar', height: 250, toolbar: { show: false } },
                plotOptions: { bar: { horizontal: false } },
                dataLabels: { enabled: false },
                xaxis: {
                    categories: denomData.map(d => d.value >= 1 ? `${d.value}€` : `${d.value*100}c`),
                },
                yaxis: { labels: { formatter: (val) => formatEuros(val) } },
                tooltip: { y: { formatter: (val) => formatEuros(val) } }
            };
            modalDenominationsChart = new ApexCharts(denominationsContainer, optionsDenominations);
            modalDenominationsChart.render();
        } else {
             denominationsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Aucune dénomination comptée.</p>';
        }
    }
}


// --- Point d'entrée de la logique de la page ---
export async function initializeHistoryLogic() {
    
    function renderCards(container, historique) {
        if (!historique || historique.length === 0) {
            container.innerHTML = `<p style="padding: 20px; text-align: center;">Aucun enregistrement trouvé.</p>`;
            return;
        }
        container.innerHTML = historique.map(comptage => {
            const results = comptage.results.combines;
            const ecart = results.ecart;
            const cardClass = getEcartClass(ecart);
            return `
            <div class="history-card ${cardClass}" data-comptage-id="${comptage.id}">
                <input type="checkbox" class="comparison-checkbox" data-comptage-id="${comptage.id}" title="Sélectionner pour comparer">
                <div class="history-card-header"><h4>${comptage.nom_comptage}</h4><div class="date">${formatDateFr(comptage.date_comptage)}</div></div>
                <div class="history-card-body">
                    <div class="summary-line"><div><i class="fa-solid fa-receipt"></i> Ventes Théoriques</div><span>${formatEuros(results.recette_theorique)}</span></div>
                    <div class="summary-line"><div><i class="fa-solid fa-money-bill-wave"></i> Recette Réelle</div><span>${formatEuros(results.recette_reelle)}</span></div>
                    <div class="summary-line total-ecart"><div><strong><i class="fa-solid fa-right-left"></i> Écart Total</strong></div><span class="ecart-value">${formatEuros(ecart)}</span></div>
                </div>
                <div class="history-card-footer">
                    <button class="action-btn-small details-btn" data-comptage-id="${comptage.id}"><i class="fa-solid fa-eye"></i> Détails</button>
                    <button class="action-btn-small load-btn" data-comptage-id="${comptage.id}"><i class="fa-solid fa-download"></i> Charger</button>
                    <button class="action-btn-small delete-btn" data-comptage-id="${comptage.id}"><i class="fa-solid fa-trash-can"></i> Supprimer</button>
                </div>
            </div>`;
        }).join('');
    }

    function renderPagination(container, currentPage, totalPages) {
        if (totalPages <= 1) { container.innerHTML = ''; return; }
        let html = '<ul class="pagination">';
        html += `<li class="${currentPage === 1 ? 'disabled' : ''}"><a href="#" data-page="${currentPage - 1}">&laquo;</a></li>`;
        for (let i = 1; i <= totalPages; i++) { html += `<li class="${i === currentPage ? 'active' : ''}"><a href="#" data-page="${i}">${i}</a></li>`; }
        html += `<li class="${currentPage === totalPages ? 'disabled' : ''}"><a href="#" data-page="${currentPage + 1}">&raquo;</a></li>`;
        html += '</ul>';
        container.innerHTML = html;
    }

    function renderModalContent(container, comptageId) {
        const comptage = fullHistoryData.find(c => c.id.toString() === comptageId.toString());
        if (!comptage) { container.innerHTML = "Erreur: détails non trouvés."; return; }
    
        const { combines } = comptage.results;
    
        const summaryHtml = `
            <ul class="summary-list">
                <li class="${getEcartClass(combines.ecart)}"><i class="fa-solid fa-right-left summary-icon"></i><div><span>Écart Total</span><strong>${formatEuros(combines.ecart)}</strong></div></li>
                <li><i class="fa-solid fa-cash-register summary-icon"></i><div><span>Recette Réelle Totale</span><strong>${formatEuros(combines.recette_reelle)}</strong></div></li>
                <li><i class="fa-solid fa-receipt summary-icon"></i><div><span>Ventes Théoriques</span><strong>${formatEuros(combines.recette_theorique)}</strong></div></li>
                <li><i class="fa-solid fa-landmark summary-icon"></i><div><span>Total Compté</span><strong>${formatEuros(combines.total_compté)}</strong></div></li>
            </ul>`;
    
        const caissesHtml = Object.entries(comptage.caisses_data).map(([caisse_id, data]) => {
            const caisseResults = comptage.results.caisses[caisse_id];
            if (!caisseResults) return ''; // Sécurité

            const kpiHtml = `
                <div class="caisse-kpi-grid">
                    <div class="caisse-kpi-card">
                        <span>Total Compté</span>
                        <strong>${formatEuros(caisseResults.total_compté)}</strong>
                    </div>
                    <div class="caisse-kpi-card">
                        <span>Recette Théorique</span>
                        <strong>${formatEuros(caisseResults.recette_theorique)}</strong>
                    </div>
                    <div class="caisse-kpi-card ${getEcartClass(caisseResults.ecart)}">
                        <span>Écart Caisse</span>
                        <strong class="ecart-value">${formatEuros(caisseResults.ecart)}</strong>
                    </div>
                </div>`;

            const chartsHtml = `
                <div class="modal-charts-container">
                    <div class="chart-wrapper">
                        <h4>Répartition des Paiements</h4>
                        <div id="modal-repartition-chart-${caisse_id}"></div>
                    </div>
                    <div class="chart-wrapper">
                        <h4>Valeur par Dénomination</h4>
                        <div id="modal-denominations-chart-${caisse_id}"></div>
                    </div>
                </div>`;

            let billetsHtml = '', piecesHtml = '';
            data.denominations.forEach(denom => {
                const quantite = parseInt(denom.quantite, 10);
                if (quantite === 0) return;
                const denomName = denom.denomination_nom;

                if (config.denominations.billets[denomName]) {
                    const value = parseFloat(config.denominations.billets[denomName]);
                    billetsHtml += `<tr><td>Billets ${value} ${config.currencySymbol}</td><td class="text-right">${quantite}</td><td class="text-right">${formatEuros(quantite * value)}</td></tr>`;
                } else if (config.denominations.pieces[denomName]) {
                    const value = parseFloat(config.denominations.pieces[denomName]);
                    const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
                    piecesHtml += `<tr><td>Pièces ${label}</td><td class="text-right">${quantite}</td><td class="text-right">${formatEuros(quantite * value)}</td></tr>`;
                }
            });

            const especesTable = (billetsHtml || piecesHtml) ? `
                <table class="modal-details-table">
                    <thead><tr><th>Dénomination</th><th class="text-right">Quantité</th><th class="text-right">Total</th></tr></thead>
                    <tbody>
                        ${billetsHtml ? `<tr class="table-subtitle"><td colspan="3">Billets</td></tr>${billetsHtml}` : ''}
                        ${piecesHtml ? `<tr class="table-subtitle"><td colspan="3">Pièces</td></tr>${piecesHtml}` : ''}
                    </tbody>
                </table>` : '<p style="text-align:center; padding: 10px 0;">Aucune espèce comptée.</p>';

            const cheques = data.cheques || [];
            const chequesHtml = cheques.length > 0 ? `
                <table class="modal-details-table">
                    <thead><tr><th>Montant</th><th>Commentaire</th></tr></thead>
                    <tbody>
                        ${cheques.map(c => `<tr><td class="text-right">${formatEuros(c.montant)}</td><td>${c.commentaire || ''}</td></tr>`).join('')}
                    </tbody>
                </table>` : '<p style="text-align:center; padding: 10px 0;">Aucun chèque enregistré.</p>';

            let cbHtml = '';
            const tpePourCaisse = Object.entries(config.tpeParCaisse || {}).filter(([,tpe]) => tpe.caisse_id.toString() === caisse_id);
            if (tpePourCaisse.length > 0) {
                cbHtml = tpePourCaisse.map(([tpeId, tpe]) => {
                    const releves = data.cb[tpeId] || [];
                    if (releves.length === 0) return `<p style="padding-bottom:10px;">Aucun relevé pour le TPE <strong>${tpe.nom}</strong>.</p>`;
                    return `
                        <h5 class="modal-table-subtitle">${tpe.nom}</h5>
                        <table class="modal-details-table">
                            <thead><tr><th>Heure</th><th class="text-right">Montant</th></tr></thead>
                            <tbody>${releves.map(r => `<tr><td>${r.heure_releve || 'N/A'}</td><td class="text-right">${formatEuros(r.montant)}</td></tr>`).join('')}</tbody>
                        </table>`;
                }).join('');
            } else {
                 cbHtml = '<p style="text-align:center; padding: 10px 0;">Aucun TPE configuré pour cette caisse.</p>';
            }
            
            const allDenomsMap = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
            const retraits = data.retraits || {};
            const retraitsHtml = Object.keys(retraits).length > 0 ? `
                <table class="modal-details-table">
                    <thead><tr><th>Dénomination</th><th class="text-right">Quantité</th><th class="text-right">Valeur</th></tr></thead>
                    <tbody>${Object.entries(retraits).map(([key, quantite]) => {
                        const value = parseFloat(allDenomsMap[key]);
                        const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
                        return `<tr><td>${label}</td><td class="text-right">${quantite}</td><td class="text-right">${formatEuros(parseInt(quantite, 10) * value)}</td></tr>`;
                    }).join('')}</tbody>
                </table>` : '<p style="text-align:center; padding: 10px 0;">Aucun retrait effectué.</p>';
            
            const detailsHtml = `
                <div class="modal-details-grid">
                    <div class="details-card">
                        <div class="details-card-header">
                            <h5><i class="fa-solid fa-money-bill-wave"></i> Espèces</h5>
                            <span class="total-amount">${formatEuros(caisseResults.total_compte_especes)}</span>
                        </div>
                        <div class="details-card-body">${especesTable}</div>
                    </div>
                    <div class="details-card">
                        <div class="details-card-header">
                            <h5><i class="fa-solid fa-credit-card"></i> Carte Bancaire</h5>
                             <span class="total-amount">${formatEuros(caisseResults.total_compte_cb)}</span>
                        </div>
                        <div class="details-card-body">${cbHtml}</div>
                    </div>
                    ${caisseResults.total_compte_cheques > 0 ? `
                    <div class="details-card">
                        <div class="details-card-header">
                            <h5><i class="fa-solid fa-money-check-dollar"></i> Chèques</h5>
                            <span class="total-amount">${formatEuros(caisseResults.total_compte_cheques)}</span>
                        </div>
                        <div class="details-card-body">${chequesHtml}</div>
                    </div>` : ''}
                    ${caisseResults.total_retraits > 0 ? `
                    <div class="details-card">
                        <div class="details-card-header">
                             <h5><i class="fa-solid fa-arrow-down"></i> Retraits</h5>
                             <span class="total-amount text-danger">${formatEuros(caisseResults.total_retraits)}</span>
                        </div>
                        <div class="details-card-body">${retraitsHtml}</div>
                    </div>` : ''}
                </div>`;

            return `
                <div class="caisse-details-section" style="margin-top: 30px; border-top: 1px solid var(--color-border); padding-top: 20px;">
                    <h3 style="font-size: 1.8em; text-align: center; border-bottom: 2px solid var(--color-primary); padding-bottom: 10px; margin-bottom: 20px;">${config.nomsCaisses[caisse_id] || `Caisse ${caisse_id}`}</h3>
                    ${kpiHtml}
                    <div class="modal-details-layout">
                        ${chartsHtml}
                        <div class="modal-details-container">${detailsHtml}</div>
                    </div>
                </div>`;
        }).join('');
    
        container.innerHTML = `
            <div class="modal-header">
                <div><h3>Détails de: ${comptage.nom_comptage}</h3><p>${formatDateFr(comptage.date_comptage)}</p></div>
                <div class="modal-actions"><button id="print-modal-btn" class="action-btn"><i class="fa-solid fa-print"></i> Imprimer</button><span class="modal-close">&times;</span></div>
            </div>
            <div class="modal-body" id="printable-content">${summaryHtml}${caissesHtml}</div>`;
    }

    function updateComparisonToolbar() {
        const historyPage = document.getElementById('history-page');
        const toolbar = historyPage.querySelector('#comparison-toolbar');
        if (!toolbar) return;
        const counter = toolbar.querySelector('#comparison-counter');
        const button = toolbar.querySelector('#compare-btn');
        const checked = historyPage.querySelectorAll('.comparison-checkbox:checked');
    
        if (checked.length > 0) {
            counter.textContent = `${checked.length} comptage(s) sélectionné(s)`;
            button.disabled = checked.length < 2;
            toolbar.classList.add('visible');
        } else {
            toolbar.classList.remove('visible');
        }
    }

    function renderComparisonModal() {
        const historyPage = document.getElementById('history-page');
        const modal = historyPage.querySelector('#comparison-modal');
        const content = modal.querySelector('#comparison-modal-content');
        const checkedIds = [...historyPage.querySelectorAll('.comparison-checkbox:checked')].map(cb => cb.dataset.comptageId);
        const comptagesToCompare = fullHistoryData.filter(c => checkedIds.includes(c.id.toString())).sort((a,b) => new Date(a.date_comptage) - new Date(b.date_comptage));
    
        const headersHtml = comptagesToCompare.map(c => `<th>${c.nom_comptage}<br><small>${formatDateFr(c.date_comptage)}</small></th>`).join('');
        
        const rows = [ { label: 'Recette Réelle', key: 'recette_reelle' }, { label: 'Recette Théorique', key: 'recette_theorique' }, { label: 'Écart Total', key: 'ecart' } ];
        const bodyHtml = rows.map(row => {
            const cells = comptagesToCompare.map(c => {
                const value = c.results.combines[row.key];
                const ecartClass = row.key === 'ecart' ? getEcartClass(value) : '';
                return `<td class="${ecartClass}">${formatEuros(value)}</td>`;
            }).join('');
            return `<tr><td><strong>${row.label}</strong></td>${cells}</tr>`;
        }).join('');
    
        content.innerHTML = `
            <div class="modal-header"><h3>Comparaison des Comptages</h3><span class="modal-close">&times;</span></div>
            <div class="modal-body"><div class="table-responsive"><table class="info-table comparison-table">
                <thead><tr><th>Indicateur</th>${headersHtml}</tr></thead>
                <tbody>${bodyHtml}</tbody>
            </table></div></div>`;
    
        modal.classList.add('visible');
    }

    function renderWithdrawalDetailsModal(dateKey) {
        const dayData = withdrawalsByDay[dateKey];
        if (!dayData) return;
    
        const modal = document.getElementById('modal-withdrawal-details');
        const content = document.getElementById('modal-withdrawal-details-content');
    
        const allDenomsValueMap = { ...config.denominations.billets, ...config.denominations.pieces };
        
        const byCaisse = dayData.details.reduce((acc, d) => {
            const value = parseFloat(d.valeur);
            acc[d.caisse_nom] = (acc[d.caisse_nom] || 0) + (isNaN(value) ? 0 : value);
            return acc;
        }, {});
        const donutLabels = Object.keys(byCaisse);
        const donutSeries = Object.values(byCaisse);
    
        const byDenom = dayData.details.reduce((acc, d) => {
            const value = parseFloat(d.valeur);
            const quantite = parseInt(d.quantite, 10);
            if (!acc[d.denomination]) {
                acc[d.denomination] = { total: 0, quantite: 0 };
            }
            acc[d.denomination].total += isNaN(value) ? 0 : value;
            acc[d.denomination].quantite += isNaN(quantite) ? 0 : quantite;
            return acc;
        }, {});
    
        const sortedDenoms = Object.entries(byDenom).sort(([denomA], [denomB]) => parseFloat(allDenomsValueMap[denomB]) - parseFloat(allDenomsValueMap[denomA]));
        const barLabels = sortedDenoms.map(([denom]) => {
            const value = parseFloat(allDenomsValueMap[denom]);
            return value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
        });
        const barSeries = sortedDenoms.map(([, data]) => parseFloat(data.total) || 0);
        const barQuantities = sortedDenoms.map(([, data]) => parseInt(data.quantite, 10) || 0);
    
        const globalTableRows = sortedDenoms.map(([denom, data]) => {
             const value = parseFloat(allDenomsValueMap[denom]);
             const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
             return `<tr><td>${label}</td><td class="text-right">${data.quantite}</td><td class="text-right">${formatEuros(data.total)}</td></tr>`;
        }).join('');
    
        const caisseTablesHtml = Object.entries(byCaisse).map(([nomCaisse, totalCaisse]) => {
            const detailsCaisse = dayData.details.filter(d => d.caisse_nom === nomCaisse)
                .sort((a,b) => allDenomsValueMap[b.denomination] - allDenomsValueMap[a.denomination]);
            const rows = detailsCaisse.map(d => {
                const value = parseFloat(allDenomsValueMap[d.denomination]);
                const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
                return `<tr><td>${label}</td><td class="text-right">${d.quantite}</td><td class="text-right">${formatEuros(d.valeur)}</td></tr>`;
            }).join('');
            return `<div class="card">
                        <h4>Détail pour ${nomCaisse}</h4>
                        <div class="table-responsive"><table class="info-table">
                            <thead><tr><th>Dénomination</th><th class="text-right">Quantité</th><th class="text-right">Valeur</th></tr></thead>
                            <tbody>${rows}</tbody>
                            <tfoot><tr><td colspan="2">Total Caisse</td><td class="text-right">${formatEuros(totalCaisse)}</td></tr></tfoot>
                        </table></div>
                    </div>`;
        }).join('');
        
        content.innerHTML = `
            <div class="modal-header">
                <h3>Analyse des retraits du ${formatDateFr(dateKey, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                <span class="modal-close">&times;</span>
            </div>
            <div class="modal-body">
                <div class="charts-grid">
                    <div class="card chart-card"><h4>Répartition par Caisse</h4><div id="donut-chart-container"></div></div>
                    <div class="card chart-card"><h4>Valeur par Dénomination</h4><div id="bar-chart-container"></div></div>
                </div>
                <div class="details-grid">
                    <div class="card">
                        <h4>Synthèse Globale</h4>
                        <div class="table-responsive">
                            <table class="info-table">
                                <thead><tr><th>Dénomination</th><th class="text-right">Qté. Totale</th><th class="text-right">Valeur Totale</th></tr></thead>
                                <tbody>${globalTableRows}</tbody>
                                <tfoot><tr><td colspan="2">Total Général</td><td class="text-right">${formatEuros(dayData.totalValue)}</td></tr></tfoot>
                            </table>
                        </div>
                    </div>
                    ${caisseTablesHtml}
                </div>
            </div>`;
            
        modal.classList.add('visible');
    
        const theme = { theme: { mode: document.body.dataset.theme === 'dark' ? 'dark' : 'light' } };
    
        if (withdrawalDonutChart) withdrawalDonutChart.destroy();
        withdrawalDonutChart = new ApexCharts(document.querySelector("#donut-chart-container"), {
            ...theme, series: donutSeries, labels: donutLabels, chart: { type: 'donut', height: 250 },
            legend: { position: 'bottom' }, dataLabels: { enabled: true, formatter: (val) => `${val.toFixed(1)}%` },
            tooltip: { y: { formatter: (val) => formatEuros(val) } }
        });
        withdrawalDonutChart.render();
    
        if (withdrawalChart) withdrawalChart.destroy();
        withdrawalChart = new ApexCharts(document.querySelector("#bar-chart-container"), {
            ...theme,
            series: [{ name: 'Valeur retirée', data: barSeries }],
            chart: { type: 'bar', height: 250, toolbar: { show: false } },
            plotOptions: { bar: { horizontal: true, dataLabels: { position: 'center' } } },
            dataLabels: {
                enabled: true,
                formatter: (val, opts) => {
                    const quantite = barQuantities[opts.dataPointIndex];
                    return `${quantite}x`;
                },
                style: { colors: ['#fff'], fontSize: '12px', fontWeight: 'bold' },
                textAnchor: 'middle',
                dropShadow: { enabled: true, top: 1, left: 1, blur: 1, opacity: 0.45 }
            },
            xaxis: {
                categories: barLabels,
                labels: {
                    formatter: (val) => typeof val === 'number' ? formatEuros(val) : val
                }
            },
            tooltip: {
                x: {
                    formatter: (val, opts) => {
                         return barLabels[opts.dataPointIndex];
                    }
                },
                y: {
                    title: {
                        formatter: (seriesName) => seriesName,
                    },
                    formatter: (val, opts) => {
                        const quantite = barQuantities[opts.dataPointIndex];
                        return `${formatEuros(val)} (${quantite} articles)`;
                    }
                }
            }
        });
        withdrawalChart.render();
    
        modal.querySelector('.modal-close').onclick = () => {
            modal.classList.remove('visible');
            if (withdrawalChart) withdrawalChart.destroy();
            if (withdrawalDonutChart) withdrawalDonutChart.destroy();
        };
        modal.onclick = (e) => { 
            if (e.target === modal) {
                modal.classList.remove('visible');
                if (withdrawalChart) withdrawalChart.destroy();
                if (withdrawalDonutChart) withdrawalDonutChart.destroy();
            }
        };
    }

    function attachWithdrawalsEventListeners() {
        const historyPage = document.getElementById('history-page');
        const container = historyPage.querySelector('#retraits-view');
        if (!container) return;
        const logContainer = container.querySelector('#withdrawals-log-container');
        
        if (logContainer) {
            logContainer.addEventListener('click', (e) => {
                const card = e.target.closest('.day-card');
                if (!card) return;
    
                if (e.target.closest('.details-btn')) {
                    renderWithdrawalDetailsModal(card.dataset.dateKey);
                } else if (!e.target.matches('.day-card-checkbox')) {
                    card.querySelector('.day-card-checkbox').click();
                }
            });
    
            logContainer.addEventListener('change', (e) => {
                if(e.target.matches('.day-card-checkbox')) {
                    e.target.closest('.day-card').classList.toggle('selected', e.target.checked);
                    updateSelectionToolbar();
                }
            });
        }
    }
    
    function updateSelectionToolbar() {
        const historyPage = document.getElementById('history-page');
        const toolbar = historyPage.querySelector('#day-selection-toolbar');
        if (!toolbar) return;
        const counter = toolbar.querySelector('#day-selection-counter');
        const checkedBoxes = historyPage.querySelectorAll('.day-card-checkbox:checked');
        
        if (checkedBoxes.length > 0) {
            let total = 0;
            checkedBoxes.forEach(cb => total += parseFloat(cb.dataset.amount));
            counter.innerHTML = `<strong>${checkedBoxes.length}</strong> jour(s) sélectionné(s) | Total : <strong>${formatEuros(total)}</strong>`;
            toolbar.classList.add('visible');
        } else {
            toolbar.classList.remove('visible');
        }
    }
    
    function renderRetraitsView(container) {
       const sortedDays = Object.keys(withdrawalsByDay).sort((a, b) => new Date(b) - new Date(a));
    
        if (sortedDays.length === 0) {
            container.innerHTML = `<div class="withdrawals-header"><h3>Journal des Retraits</h3></div><p>Aucun retrait trouvé pour la période sélectionnée.</p>`;
            return;
        }
    
        const dayCardsHtml = sortedDays.map(dateKey => {
            const dayData = withdrawalsByDay[dateKey];
            if (dayData.totalValue === 0) return '';
            return `
                <div class="day-card" data-date-key="${dateKey}">
                    <input type="checkbox" class="day-card-checkbox" data-amount="${dayData.totalValue}" title="Sélectionner ce jour">
                    <div class="day-card-header"><i class="fa-solid fa-calendar-day"></i>${formatDateFr(dateKey, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                    <div class="day-card-body">
                        <div class="day-kpi"><span>Montant Retiré</span><strong>${formatEuros(dayData.totalValue)}</strong></div>
                        <div class="day-kpi"><span>Articles Retirés</span><strong>${dayData.totalItems}</strong></div>
                    </div>
                    <div class="day-card-footer"><button class="action-btn-small details-btn"><i class="fa-solid fa-eye"></i> Voir détails</button></div>
                </div>`;
        }).join('');
    
        container.innerHTML = `
            <div class="withdrawals-header">
                <h3>Journal des Retraits</h3>
                <p class="subtitle">Cliquez sur un jour pour le détail, ou cochez plusieurs jours pour les additionner.</p>
            </div>
            <div class="withdrawals-log-wrapper">
                <div id="withdrawals-log-container">${dayCardsHtml}</div>
            </div>
            <div class="selection-toolbar" id="day-selection-toolbar">
                 <span id="day-selection-counter">0 jour(s) sélectionné(s)</span>
                 <button id="clear-day-selection-btn" class="btn delete-btn">Tout désélectionner</button>
            </div>
            <div id="modal-withdrawal-details" class="modal"><div class="modal-content wide" id="modal-withdrawal-details-content"></div></div>
        `;
        
        attachWithdrawalsEventListeners();
    }
    
    const historyPage = document.getElementById('history-page');
    if (!historyPage) return;

    const controlsContainer = historyPage.querySelector('.filter-section');
    if(controlsContainer && !document.getElementById('comparison-toolbar')) {
        controlsContainer.insertAdjacentHTML('afterend', `
            <div id="comparison-toolbar" class="comparison-toolbar">
                <span id="comparison-counter"></span>
                <button id="compare-btn" class="btn new-btn" disabled><i class="fa-solid fa-scale-balanced"></i> Comparer</button>
            </div>
        `);
    }
    if(!document.getElementById('comparison-modal')) {
        historyPage.insertAdjacentHTML('beforeend', `<div id="comparison-modal" class="modal"><div class="modal-content wide" id="comparison-modal-content"></div></div>`);
    }

    const filterForm = historyPage.querySelector('#history-filter-form');
    const resetBtn = historyPage.querySelector('#reset-filter-btn');
    const paginationNav = historyPage.querySelector('.pagination-nav');
    const detailsModal = historyPage.querySelector('#details-modal');
    const modalContent = historyPage.querySelector('#modal-details-content');
    const viewTabs = historyPage.querySelector('.view-tabs');
    const comptagesView = historyPage.querySelector('#comptages-view');
    const retraitsView = historyPage.querySelector('#retraits-view');
    const retraitsContentContainer = historyPage.querySelector('#retraits-view-content');
    let currentParams = {};

    async function loadAndRender(params = {}) {
        currentParams = params;
        const historyGridContainer = comptagesView.querySelector('.history-grid');
        try {
            historyGridContainer.innerHTML = '<p>Chargement...</p>';
            retraitsContentContainer.innerHTML = '<p>Chargement...</p>';
            const data = await fetchHistoriqueData(params);
            renderCards(historyGridContainer, data.historique);
            renderPagination(paginationNav, data.page_courante, data.pages_totales);
            processWithdrawalData(data.historique_complet, config.denominations);
            renderRetraitsView(retraitsContentContainer);
            updateComparisonToolbar();
        } catch (error) {
            console.error("Erreur lors du chargement :", error);
            const errorMessage = `<p class="error">Erreur: ${error.message}</p>`;
            historyGridContainer.innerHTML = errorMessage;
            retraitsContentContainer.innerHTML = errorMessage;
        }
    }

    viewTabs.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = e.target.closest('.tab-link');
        if (!tab || tab.classList.contains('active')) return;
        const viewToShow = tab.dataset.view;
        viewTabs.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        comptagesView.classList.remove('active');
        retraitsView.classList.remove('active');
        document.getElementById(`${viewToShow}-view`).classList.add('active');
    });
    
    filterForm.addEventListener('submit', (e) => { e.preventDefault(); loadAndRender(Object.fromEntries(new FormData(filterForm).entries())); });
    resetBtn.addEventListener('click', () => { filterForm.reset(); loadAndRender(); });
    paginationNav.addEventListener('click', (e) => { e.preventDefault(); const link = e.target.closest('a'); if (link && !link.parentElement.classList.contains('disabled')) { loadAndRender({ ...currentParams, p: link.dataset.page }); }});
    
    historyPage.addEventListener('click', async (e) => {
        const target = e.target;
        
        if (target.closest('.details-btn') && target.closest('.history-card')) {
            const comptageId = target.closest('.history-card').dataset.comptageId;
            
            renderModalContent(modalContent, comptageId);
            detailsModal.classList.add('visible');

            // CORRECTION FINALE: Utilisation de requestAnimationFrame
            requestAnimationFrame(() => {
                const comptage = fullHistoryData.find(c => c.id.toString() === comptageId);
                if (comptage) {
                    Object.entries(comptage.caisses_data).forEach(([caisse_id, data]) => {
                        if (comptage.results.caisses[caisse_id]) {
                            renderModalCharts(caisse_id, data, comptage.results.caisses[caisse_id]);
                        }
                    });
                }
            });
        }

        if (target.closest('.delete-btn')) {
             const card = target.closest('.history-card');
             const comptageId = card.dataset.comptageId;
             if (confirm("Êtes-vous sûr de vouloir supprimer ce comptage ? Cette action est irréversible.")) {
                const formData = new FormData();
                formData.append('id_a_supprimer', comptageId);
                try {
                    const response = await fetch('index.php?route=historique/delete', { method: 'POST', body: formData });
                    const result = await response.json();
                    if(!result.success) throw new Error(result.message || 'Erreur inconnue.');
                    card.style.opacity = '0';
                    setTimeout(() => loadAndRender(currentParams), 300);
                } catch(err) {
                    alert(`Erreur lors de la suppression : ${err.message}`);
                }
            }
        }
        
        if (target.closest('.load-btn')) {
            const comptageId = target.closest('.history-card').dataset.comptageId;
            const comptageData = fullHistoryData.find(c => c.id.toString() === comptageId);
            if(comptageData && confirm(`Voulez-vous charger le comptage "${comptageData.nom_comptage}" dans le calculateur ? Le contenu non sauvegardé sera perdu.`)) {
                const loadButton = target.closest('.load-btn');
                loadButton.disabled = true;
                loadButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Chargement...';

                try {
                    const formData = new FormData();
                    formData.append('comptage_id', comptageId);
                    
                    const response = await fetch('index.php?route=calculateur/load_from_history', { method: 'POST', body: formData });
                    const result = await response.json();
                    
                    if (!result.success) {
                        throw new Error(result.message || 'Erreur inconnue lors de la préparation des données.');
                    }

		            sendWsMessage({ type: 'force_reload_all' })
                    window.location.href = '/calculateur';

                } catch (error) {
                    alert(`Erreur lors du chargement : ${error.message}`);
                    loadButton.disabled = false;
                    loadButton.innerHTML = '<i class="fa-solid fa-download"></i> Charger';
                }
            }
        }
        
        if(target.closest('#compare-btn')) {
            renderComparisonModal();
        }
        
        if(target.closest('#print-modal-btn')) {
            const content = document.getElementById('printable-content').innerHTML;
            const printWindow = window.open('', '', 'height=800,width=1000');
            printWindow.document.write('<html><head><title>Détail du Comptage</title>');
            printWindow.document.write('<link rel="stylesheet" href="assets/css/styles.css"><link rel="stylesheet" href="assets/css/page-historique.css">');
            printWindow.document.write('</head><body class="print-preview">');
            printWindow.document.write(content);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 500);
        }
        
        if(target.closest('#clear-day-selection-btn')) {
            historyPage.querySelectorAll('.day-card-checkbox:checked').forEach(cb => {
                cb.checked = false;
                cb.closest('.day-card').classList.remove('selected');
            });
            updateSelectionToolbar();
        }
    });
    
    historyPage.addEventListener('change', (e) => {
        if (e.target.matches('.comparison-checkbox')) {
            updateComparisonToolbar();
        }
    });

    detailsModal.addEventListener('click', (e) => { 
        if (e.target.classList.contains('modal-close') || e.target.id === 'details-modal') { 
            detailsModal.classList.remove('visible');
            if (modalRepartitionChart) modalRepartitionChart.destroy();
            if (modalDenominationsChart) modalDenominationsChart.destroy();
        }
    });

    const comparisonModal = document.getElementById('comparison-modal');
    comparisonModal.addEventListener('click', (e) => {
        if (e.target.matches('.modal-close') || e.target === comparisonModal) {
            comparisonModal.classList.remove('visible');
        }
    });

    loadAndRender();
}
