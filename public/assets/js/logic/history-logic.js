// Fichier : public/assets/js/logic/history-logic.js (Version Finale Complète, Verbosifiée et Corrigée)
import { sendWsMessage } from './websocket-service.js';

// --- Déclaration des variables globales pour la page ---
// Ces variables conserveront les données chargées pour éviter de les redemander au serveur inutilement.
let fullHistoryData = []; // Stockera l'historique complet pour les filtres et comparaisons.
let config = {}; // Stockera la configuration de l'application (noms des caisses, etc.).
let withdrawalsByDay = {}; // Stockera les données agrégées pour la vue "Synthèse des Retraits".
let sheetRepartitionChart = null; // Instance du graphique de répartition dans le panneau.
let sheetDenominationsChart = null; // Instance du graphique des dénominations.
let withdrawalChart = null;
let withdrawalDonutChart = null;

// --- Fonctions utilitaires pour le formatage ---
const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(montant);
const formatDateFr = (dateString, options = { dateStyle: 'long', timeStyle: 'short' }) => new Intl.DateTimeFormat('fr-FR', options).format(new Date(dateString));
const getEcartClass = (ecart) => {
    if (Math.abs(ecart) < 0.01) return 'ecart-ok';
    return ecart > 0 ? 'ecart-positif' : 'ecart-negatif';
};

// --- Communication avec l'API (Backend) ---
async function fetchHistoriqueData(params) {
    console.log('[HistoryLogic] fetchHistoriqueData: Début de la récupération des données avec les paramètres :', params);
    const configPromise = fetch('index.php?route=calculateur/config').then(res => res.json());
    const historyPromise = fetch(`index.php?route=historique/get_data&${new URLSearchParams(params)}`).then(res => res.json());
    const [conf, history] = await Promise.all([configPromise, historyPromise]);
    config = conf;
    if (!history.historique) {
        console.error('[HistoryLogic] fetchHistoriqueData: Réponse invalide de l\'API.', history);
        throw new Error(`La réponse de l'API pour l'historique est invalide.`);
    }
    fullHistoryData = history.historique_complet || [];
    console.log('[HistoryLogic] fetchHistoriqueData: Données récupérées avec succès.');
    return history;
}

// --- Logique de traitement des données ---
function processWithdrawalData(comptages, denominations) {
    console.log('[HistoryLogic] processWithdrawalData: Traitement des données de retraits.');
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


// --- Fonctions pour les graphiques du panneau inférieur ---
function renderSheetCharts(caisseId, caisseData, caisseResults) {
    console.log(`[HistoryLogic] renderSheetCharts: Rendu des graphiques pour la caisse ${caisseId}.`);
    if (sheetRepartitionChart) sheetRepartitionChart.destroy();
    if (sheetDenominationsChart) sheetDenominationsChart.destroy();

    const theme = { theme: { mode: document.body.dataset.theme === 'dark' ? 'dark' : 'light' } };

    const repartitionContainer = document.getElementById(`sheet-repartition-chart-${caisseId}`);
    if (repartitionContainer) {
        const series = [
            parseFloat(caisseResults.total_compte_especes || 0),
            parseFloat(caisseResults.total_compte_cb || 0),
            parseFloat(caisseResults.total_compte_cheques || 0)
        ];
        if (series.some(val => val > 0)) {
            const optionsRepartition = {
                ...theme, series, labels: ['Espèces', 'Carte Bancaire', 'Chèques'],
                chart: { type: 'donut', height: 250 }, legend: { position: 'bottom' },
                dataLabels: { enabled: true, formatter: (val) => `${val.toFixed(1)}%` },
                tooltip: { y: { formatter: (val) => formatEuros(val) } }
            };
            sheetRepartitionChart = new ApexCharts(repartitionContainer, optionsRepartition);
            sheetRepartitionChart.render();
        } else {
            repartitionContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Aucune donnée de paiement.</p>';
        }
    }

    const denominationsContainer = document.getElementById(`sheet-denominations-chart-${caisseId}`);
    if (denominationsContainer) {
        const allDenomsMap = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
        const denomData = caisseData.denominations
            .filter(d => parseInt(d.quantite, 10) > 0)
            .map(d => ({ quantite: parseInt(d.quantite, 10), value: parseFloat(allDenomsMap[d.denomination_nom]) }))
            .sort((a, b) => b.value - a.value);
        
        if (denomData.length > 0) {
            const optionsDenominations = {
                ...theme, series: [{ name: 'Valeur', data: denomData.map(d => d.quantite * d.value) }],
                chart: { type: 'bar', height: 250, toolbar: { show: false } },
                plotOptions: { bar: { horizontal: false } }, dataLabels: { enabled: false },
                xaxis: { categories: denomData.map(d => d.value >= 1 ? `${d.value}€` : `${d.value*100}c`) },
                yaxis: { labels: { formatter: (val) => formatEuros(val) } },
                tooltip: { y: { formatter: (val) => formatEuros(val) } }
            };
            sheetDenominationsChart = new ApexCharts(denominationsContainer, optionsDenominations);
            sheetDenominationsChart.render();
        } else {
             denominationsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Aucune dénomination.</p>';
        }
    }
}


// --- Point d'entrée de la logique de la page ---
export async function initializeHistoryLogic() {
    console.log('[HistoryLogic] initializeHistoryLogic: Démarrage de l\'initialisation de la page d\'historique.');
    
    function renderCards(container, historique) {
        console.log('[HistoryLogic] renderCards: Affichage des cartes de comptage.');
        if (!container) return;
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
        console.log('[HistoryLogic] renderPagination: Affichage de la pagination.');
        if (!container) return;
        if (totalPages <= 1) { container.innerHTML = ''; return; }
        let html = '<ul class="pagination">';
        html += `<li class="${currentPage === 1 ? 'disabled' : ''}"><a href="#" data-page="${currentPage - 1}">&laquo;</a></li>`;
        for (let i = 1; i <= totalPages; i++) { html += `<li class="${i === currentPage ? 'active' : ''}"><a href="#" data-page="${i}">${i}</a></li>`; }
        html += `<li class="${currentPage === totalPages ? 'disabled' : ''}"><a href="#" data-page="${currentPage + 1}">&raquo;</a></li>`;
        html += '</ul>';
        container.innerHTML = html;
    }

    function renderSheetContent(container, comptageId) {
        console.log(`[HistoryLogic] renderSheetContent: Début du rendu du contenu du panneau pour le comptage ID ${comptageId}.`);
        if (!container) {
            console.error('[HistoryLogic] renderSheetContent: Le conteneur est introuvable.');
            return;
        }
        const comptage = fullHistoryData.find(c => c.id.toString() === comptageId.toString());
        if (!comptage) {
            container.innerHTML = "Erreur: détails du comptage non trouvés.";
            console.error(`[HistoryLogic] renderSheetContent: Comptage avec ID ${comptageId} non trouvé dans fullHistoryData.`);
            return;
        }
        
        document.getElementById('details-sheet-title').textContent = comptage.nom_comptage;
        document.getElementById('details-sheet-subtitle').textContent = formatDateFr(comptage.date_comptage);
    
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
            if (!caisseResults) return '';

            const kpiHtml = `
                <div class="caisse-kpi-grid">
                    <div class="caisse-kpi-card"><span>Total Compté</span><strong>${formatEuros(caisseResults.total_compté)}</strong></div>
                    <div class="caisse-kpi-card"><span>Recette Théorique</span><strong>${formatEuros(caisseResults.recette_theorique)}</strong></div>
                    <div class="caisse-kpi-card ${getEcartClass(caisseResults.ecart)}"><span>Écart Caisse</span><strong class="ecart-value">${formatEuros(caisseResults.ecart)}</strong></div>
                </div>`;

            const chartsHtml = `
                <div class="modal-charts-container">
                    <div class="chart-wrapper"><h4>Répartition</h4><div id="sheet-repartition-chart-${caisse_id}"></div></div>
                    <div class="chart-wrapper"><h4>Dénominations</h4><div id="sheet-denominations-chart-${caisse_id}"></div></div>
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
            const especesTable = (billetsHtml || piecesHtml) ? `<table class="modal-details-table"><thead><tr><th>Dénomination</th><th class="text-right">Quantité</th><th class="text-right">Total</th></tr></thead><tbody>${billetsHtml ? `<tr class="table-subtitle"><td colspan="3">Billets</td></tr>${billetsHtml}` : ''}${piecesHtml ? `<tr class="table-subtitle"><td colspan="3">Pièces</td></tr>${piecesHtml}` : ''}</tbody></table>` : '<p style="text-align:center; padding: 10px 0;">Aucune espèce.</p>';

            const cheques = data.cheques || [];
            const chequesHtml = cheques.length > 0 ? `<table class="modal-details-table"><thead><tr><th>Montant</th><th>Commentaire</th></tr></thead><tbody>${cheques.map(c => `<tr><td class="text-right">${formatEuros(c.montant)}</td><td>${c.commentaire || ''}</td></tr>`).join('')}</tbody></table>` : '<p style="text-align:center; padding: 10px 0;">Aucun chèque.</p>';

            let cbHtml = '';
            const tpePourCaisse = Object.entries(config.tpeParCaisse || {}).filter(([,tpe]) => tpe.caisse_id.toString() === caisse_id);
            if (tpePourCaisse.length > 0) {
                cbHtml = tpePourCaisse.map(([tpeId, tpe]) => {
                    const releves = data.cb[tpeId] || [];
                    if (releves.length === 0) return `<p style="padding-bottom:10px;">Aucun relevé pour <strong>${tpe.nom}</strong>.</p>`;
                    return `<h5 class="modal-table-subtitle">${tpe.nom}</h5><table class="modal-details-table"><thead><tr><th>Heure</th><th class="text-right">Montant</th></tr></thead><tbody>${releves.map(r => `<tr><td>${r.heure_releve || 'N/A'}</td><td class="text-right">${formatEuros(r.montant)}</td></tr>`).join('')}</tbody></table>`;
                }).join('');
            } else {
                 cbHtml = '<p style="text-align:center; padding: 10px 0;">Aucun TPE.</p>';
            }
            
            const allDenomsMap = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
            const retraits = data.retraits || {};
            const retraitsHtml = Object.keys(retraits).length > 0 ? `<table class="modal-details-table"><thead><tr><th>Dénomination</th><th class="text-right">Quantité</th><th class="text-right">Valeur</th></tr></thead><tbody>${Object.entries(retraits).map(([key, quantite]) => { const value = parseFloat(allDenomsMap[key]); const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`; return `<tr><td>${label}</td><td class="text-right">${quantite}</td><td class="text-right">${formatEuros(parseInt(quantite, 10) * value)}</td></tr>`; }).join('')}</tbody></table>` : '<p style="text-align:center; padding: 10px 0;">Aucun retrait.</p>';
            
            const detailsHtml = `
                <div class="modal-details-grid">
                    <div class="details-card"><div class="details-card-header"><h5><i class="fa-solid fa-money-bill-wave"></i> Espèces</h5><span class="total-amount">${formatEuros(caisseResults.total_compte_especes)}</span></div><div class="details-card-body">${especesTable}</div></div>
                    <div class="details-card"><div class="details-card-header"><h5><i class="fa-solid fa-credit-card"></i> CB</h5><span class="total-amount">${formatEuros(caisseResults.total_compte_cb)}</span></div><div class="details-card-body">${cbHtml}</div></div>
                    ${caisseResults.total_compte_cheques > 0 ? `<div class="details-card"><div class="details-card-header"><h5><i class="fa-solid fa-money-check-dollar"></i> Chèques</h5><span class="total-amount">${formatEuros(caisseResults.total_compte_cheques)}</span></div><div class="details-card-body">${chequesHtml}</div></div>` : ''}
                    ${caisseResults.total_retraits > 0 ? `<div class="details-card"><div class="details-card-header"><h5><i class="fa-solid fa-arrow-down"></i> Retraits</h5><span class="total-amount text-danger">${formatEuros(caisseResults.total_retraits)}</span></div><div class="details-card-body">${retraitsHtml}</div></div>` : ''}
                </div>`;

            return `<div class="caisse-details-section" style="margin-top: 30px; border-top: 1px solid var(--color-border); padding-top: 20px;"><h3 style="text-align: center;">${config.nomsCaisses[caisse_id] || `Caisse ${caisse_id}`}</h3>${kpiHtml}<div class="modal-details-layout">${chartsHtml}<div class="modal-details-container">${detailsHtml}</div></div></div>`;
        }).join('');
    
        container.innerHTML = `<div id="printable-content">${summaryHtml}${caissesHtml}</div>`;
        console.log(`[HistoryLogic] renderSheetContent: Fin du rendu du contenu du panneau.`);
    }

    function openDetailsSheet(comptageId) {
        console.log(`[HistoryLogic] openDetailsSheet: Tentative d'ouverture du panneau pour le comptage ID ${comptageId}.`);
        const sheet = document.getElementById('details-sheet');
        const overlay = document.getElementById('details-sheet-overlay');
        const content = document.getElementById('details-sheet-content');
        if (!sheet || !overlay || !content) {
            console.error("[HistoryLogic] openDetailsSheet: ERREUR - Un ou plusieurs éléments du panneau sont introuvables !");
            return;
        }

        content.innerHTML = '<p>Chargement des détails...</p>';
        sheet.style.height = '50vh';
        sheet.classList.add('visible');
        overlay.classList.add('visible');
        console.log('[HistoryLogic] openDetailsSheet: Panneau et overlay rendus visibles.');
        
        renderSheetContent(content, comptageId);

        requestAnimationFrame(() => {
            const comptage = fullHistoryData.find(c => c.id.toString() === comptageId);
            if (comptage) {
                Object.entries(comptage.caisses_data).forEach(([caisse_id, data]) => {
                    if (comptage.results.caisses[caisse_id]) {
                        renderSheetCharts(caisse_id, data, comptage.results.caisses[caisse_id]);
                    }
                });
            }
        });
    }

    function closeDetailsSheet() {
        console.log('[HistoryLogic] closeDetailsSheet: Fermeture du panneau.');
        const sheet = document.getElementById('details-sheet');
        const overlay = document.getElementById('details-sheet-overlay');
        if (!sheet || !overlay) return;
        sheet.classList.remove('visible');
        overlay.classList.remove('visible');
        if (sheetRepartitionChart) sheetRepartitionChart.destroy();
        if (sheetDenominationsChart) sheetDenominationsChart.destroy();
    }
    
    function initializeSheetResizing() {
        console.log('[HistoryLogic] initializeSheetResizing: Initialisation de la logique de redimensionnement.');
        const sheet = document.getElementById('details-sheet');
        const handle = document.querySelector('.details-sheet-handle');
        if (!sheet || !handle) return;

        let isResizing = false;
        let lastY = 0;

        const startResize = (e) => {
            isResizing = true;
            lastY = e.clientY || e.touches[0].clientY;
            sheet.style.transition = 'none';
        };

        const doResize = (e) => {
            if (!isResizing) return;
            const currentY = e.clientY || e.touches[0].clientY;
            const delta = lastY - currentY;
            lastY = currentY;
            const newHeight = sheet.offsetHeight + delta;
            
            const minHeight = window.innerHeight * 0.2;
            const maxHeight = window.innerHeight * 0.9;

            if (newHeight >= minHeight && newHeight <= maxHeight) {
                sheet.style.height = `${newHeight}px`;
            }
        };

        const stopResize = () => {
            isResizing = false;
            sheet.style.transition = '';
        };

        handle.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
        
        handle.addEventListener('touchstart', startResize, { passive: true });
        document.addEventListener('touchmove', doResize, { passive: true });
        document.addEventListener('touchend', stopResize);
    }
    
    function renderRetraitsView(container) {
       console.log('[HistoryLogic] renderRetraitsView: Affichage de la vue des retraits.');
       if (!container) return;
       const sortedDays = Object.keys(withdrawalsByDay).sort((a, b) => new Date(b) - new Date(a));
    
        if (sortedDays.length === 0) {
            container.innerHTML = `<div class="withdrawals-header"><h3>Journal des Retraits</h3></div><p>Aucun retrait trouvé.</p>`;
            return;
        }
    
        const dayCardsHtml = sortedDays.map(dateKey => {
            const dayData = withdrawalsByDay[dateKey];
            if (dayData.totalValue === 0) return '';
            return `
                <div class="day-card" data-date-key="${dateKey}">
                    <input type="checkbox" class="day-card-checkbox" data-amount="${dayData.totalValue}" title="Sélectionner">
                    <div class="day-card-header"><i class="fa-solid fa-calendar-day"></i>${formatDateFr(dateKey, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                    <div class="day-card-body">
                        <div class="day-kpi"><span>Montant Retiré</span><strong>${formatEuros(dayData.totalValue)}</strong></div>
                        <div class="day-kpi"><span>Articles</span><strong>${dayData.totalItems}</strong></div>
                    </div>
                    <div class="day-card-footer"><button class="action-btn-small details-btn"><i class="fa-solid fa-eye"></i> Voir détails</button></div>
                </div>`;
        }).join('');
    
        container.innerHTML = `
            <div class="withdrawals-header"><h3>Journal des Retraits</h3><p class="subtitle">Cliquez ou cochez pour plus d'infos.</p></div>
            <div class="withdrawals-log-wrapper"><div id="withdrawals-log-container">${dayCardsHtml}</div></div>
            <div class="selection-toolbar" id="day-selection-toolbar"><span id="day-selection-counter">0 jour(s)</span><button id="clear-day-selection-btn" class="btn delete-btn">Désélectionner</button></div>
            <div id="modal-withdrawal-details" class="modal"><div class="modal-content wide" id="modal-withdrawal-details-content"></div></div>
        `;
        
        attachWithdrawalsEventListeners();
    }

    function attachWithdrawalsEventListeners() {
        const historyPage = document.getElementById('history-page');
        const logContainer = historyPage.querySelector('#withdrawals-log-container');
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
            counter.innerHTML = `<strong>${checkedBoxes.length}</strong> jour(s) | Total : <strong>${formatEuros(total)}</strong>`;
            toolbar.classList.add('visible');
        } else {
            toolbar.classList.remove('visible');
        }
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


    function renderWithdrawalDetailsModal(dateKey) {
        const dayData = withdrawalsByDay[dateKey];
        if (!dayData) return;
    
        const modal = document.getElementById('modal-withdrawal-details');
        const content = document.getElementById('modal-withdrawal-details-content');
        if (!modal || !content) return;
    
        const allDenomsValueMap = { ...config.denominations.billets, ...config.denominations.pieces };
        
        const byCaisse = dayData.details.reduce((acc, d) => {
            const value = parseFloat(d.valeur);
            acc[d.caisse_nom] = (acc[d.caisse_nom] || 0) + (isNaN(value) ? 0 : value);
            return acc;
        }, {});
        
        const caisseTablesHtml = Object.entries(byCaisse).map(([nomCaisse, totalCaisse]) => {
            const detailsCaisse = dayData.details.filter(d => d.caisse_nom === nomCaisse).sort((a,b) => allDenomsValueMap[b.denomination] - allDenomsValueMap[a.denomination]);
            const rows = detailsCaisse.map(d => {
                const value = parseFloat(allDenomsValueMap[d.denomination]);
                const label = value >= 1 ? `${value}€` : `${value * 100}c`;
                return `<tr><td>${label}</td><td class="text-right">${d.quantite}</td><td class="text-right">${formatEuros(d.valeur)}</td></tr>`;
            }).join('');
            return `<div class="card"><h4>Détail pour ${nomCaisse}</h4><div class="table-responsive"><table class="info-table"><thead><tr><th>Dénomination</th><th class="text-right">Quantité</th><th class="text-right">Valeur</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2">Total Caisse</td><td class="text-right">${formatEuros(totalCaisse)}</td></tr></tfoot></table></div></div>`;
        }).join('');
        
        content.innerHTML = `
            <div class="modal-header"><h3>Détails des retraits du ${formatDateFr(dateKey, {dateStyle: 'full'})}</h3><span class="modal-close">&times;</span></div>
            <div class="modal-body">${caisseTablesHtml}</div>`;
            
        modal.classList.add('visible');
        modal.querySelector('.modal-close').onclick = () => modal.classList.remove('visible');
        modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('visible'); };
    }
    
    const historyPage = document.getElementById('history-page');
    if (!historyPage) {
        console.error("Critical Error: #history-page element not found.");
        return;
    }

    let currentParams = {};

    async function loadAndRender(params = {}) {
        currentParams = params;
        const historyGridContainer = historyPage.querySelector('.history-grid');
        const retraitsContentContainer = historyPage.querySelector('#retraits-view-content');
        const paginationNav = historyPage.querySelector('.pagination-nav');
        try {
            if(historyGridContainer) historyGridContainer.innerHTML = '<p>Chargement...</p>';
            if(retraitsContentContainer) retraitsContentContainer.innerHTML = '<p>Chargement...</p>';
            
            const data = await fetchHistoriqueData(params);
            renderCards(historyGridContainer, data.historique);
            renderPagination(paginationNav, data.page_courante, data.pages_totales);
            processWithdrawalData(data.historique_complet, config.denominations);
            renderRetraitsView(retraitsContentContainer);
            updateComparisonToolbar();
        } catch (error) {
            console.error("Erreur de chargement:", error);
            const errorMessage = `<p class="error">Erreur: ${error.message}</p>`;
            if(historyGridContainer) historyGridContainer.innerHTML = errorMessage;
            if(retraitsContentContainer) retraitsContentContainer.innerHTML = errorMessage;
        }
    }
    
    historyPage.addEventListener('submit', (e) => {
        if (e.target.matches('#history-filter-form')) {
            e.preventDefault();
            loadAndRender(Object.fromEntries(new FormData(e.target).entries()));
        }
    });

    historyPage.addEventListener('click', async (e) => {
        console.log('[HistoryLogic] Clic détecté sur la page. Cible :', e.target);
        const target = e.target;

        if (target.closest('#reset-filter-btn')) {
            const filterForm = historyPage.querySelector('#history-filter-form');
            if(filterForm) filterForm.reset();
            loadAndRender();
        }
        const paginationLink = target.closest('.pagination-nav a');
        if (paginationLink && !paginationLink.parentElement.classList.contains('disabled')) {
            e.preventDefault();
            loadAndRender({ ...currentParams, p: paginationLink.dataset.page });
        }
        const tabLink = target.closest('.view-tabs .tab-link');
        if (tabLink && !tabLink.classList.contains('active')) {
            e.preventDefault();
            const viewToShow = tabLink.dataset.view;
            historyPage.querySelectorAll('.view-tabs .tab-link, .view-content').forEach(el => el.classList.remove('active'));
            tabLink.classList.add('active');
            const viewToActivate = document.getElementById(`${viewToShow}-view`);
            if (viewToActivate) viewToActivate.classList.add('active');
        }

        const detailsButton = target.closest('.details-btn');
        if (detailsButton && detailsButton.closest('.history-card')) {
            console.log('[HistoryLogic] Clic sur un bouton "Détails" de la vue Comptages.');
            const comptageId = detailsButton.closest('.history-card').dataset.comptageId;
            openDetailsSheet(comptageId);
        } else if (target.closest('#details-sheet-close-btn') || target.matches('#details-sheet-overlay')) {
            closeDetailsSheet();
        } else if (target.closest('#print-details-btn')) {
             const content = document.getElementById('printable-content')?.innerHTML;
             if(content) {
                const printWindow = window.open('', '', 'height=800,width=1000');
                printWindow.document.write('<html><head><title>Détail</title><link rel="stylesheet" href="assets/css/styles.css"><link rel="stylesheet" href="assets/css/page-historique.css"></head><body class="print-preview">' + content + '</body></html>');
                printWindow.document.close();
                setTimeout(() => printWindow.print(), 500);
             }
        }
        if (target.closest('.delete-btn') && target.closest('.history-card')) {
             const card = target.closest('.history-card');
             const comptageId = card.dataset.comptageId;
             if (confirm("Supprimer ce comptage ?")) {
                const formData = new FormData();
                formData.append('id_a_supprimer', comptageId);
                try {
                    const response = await fetch('index.php?route=historique/delete', { method: 'POST', body: formData });
                    const result = await response.json();
                    if(!result.success) throw new Error(result.message);
                    card.style.opacity = '0';
                    setTimeout(() => loadAndRender(currentParams), 300);
                } catch(err) {
                    alert(`Erreur: ${err.message}`);
                }
            }
        }
        if (target.closest('.load-btn')) {
            const comptageId = target.closest('.history-card').dataset.comptageId;
            const comptageData = fullHistoryData.find(c => c.id.toString() === comptageId);
            if(comptageData && confirm(`Charger "${comptageData.nom_comptage}" ? Le travail non sauvegardé sera perdu.`)) {
                const loadButton = target.closest('.load-btn');
                loadButton.disabled = true;
                loadButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                try {
                    const formData = new FormData();
                    formData.append('comptage_id', comptageId);
                    const response = await fetch('index.php?route=calculateur/load_from_history', { method: 'POST', body: formData });
                    const result = await response.json();
                    if (!result.success) { throw new Error(result.message); }
		            sendWsMessage({ type: 'force_reload_all' });
                    window.location.href = '/calculateur';
                } catch (error) {
                    alert(`Erreur: ${error.message}`);
                    loadButton.disabled = false;
                    loadButton.innerHTML = '<i class="fa-solid fa-download"></i> Charger';
                }
            }
        }
    });
    
    historyPage.addEventListener('change', (e) => {
        if (e.target.matches('.comparison-checkbox')) {
            updateComparisonToolbar();
        }
    });

    console.log('[HistoryLogic] Lancement du premier chargement des données.');
    loadAndRender();
    initializeSheetResizing();
    console.log('[HistoryLogic] Initialisation terminée.');
}
