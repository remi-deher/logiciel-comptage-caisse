// Fichier : public/assets/js/logic/history-logic.js (Version finale avec toutes les corrections)
import { sendWsMessage } from './websocket-service.js';

// --- État et Configuration Globale ---
let fullHistoryData = [];
let config = {};
let withdrawalsByDay = {};
let sheetCharts = [];
let currentParams = {};

// --- Fonctions Utilitaires ---
const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(montant);
const formatDateFr = (dateString, options = { dateStyle: 'long', timeStyle: 'short' }) => new Intl.DateTimeFormat('fr-FR', options).format(new Date(dateString));
const getEcartClass = (ecart) => {
    if (Math.abs(ecart) < 0.01) return 'ecart-ok';
    return ecart > 0 ? 'ecart-positif' : 'ecart-negatif';
};

// --- Logique d'Affichage (Rendu) ---

function renderCards(container, historique) {
    if (!container) return;
    if (!historique || historique.length === 0) {
        container.innerHTML = `<p style="padding: 20px; text-align: center;">Aucun enregistrement trouvé pour les filtres sélectionnés.</p>`;
        return;
    }
    container.innerHTML = historique.map(comptage => {
        const results = comptage.results.combines;
        const ecart = results.ecart;
        const cardClass = getEcartClass(ecart);
        return `
        <div class="history-card ${cardClass}" data-comptage-id="${comptage.id}">
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
    if (!container || totalPages <= 1) {
        if (container) container.innerHTML = '';
        return;
    }

    let html = '<ul class="pagination">';
    const maxVisiblePages = 7; 

    html += `<li class="${currentPage === 1 ? 'disabled' : ''}"><a href="#" data-page="${currentPage - 1}">&laquo;</a></li>`;

    if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) {
            html += `<li class="${i === currentPage ? 'active' : ''}"><a href="#" data-page="${i}">${i}</a></li>`;
        }
    } else {
        let startPage = Math.max(2, currentPage - 2);
        let endPage = Math.min(totalPages - 1, currentPage + 2);

        if (currentPage <= 4) {
            startPage = 2;
            endPage = Math.min(totalPages - 1, maxVisiblePages - 2);
        }

        if (currentPage > totalPages - 4) {
            startPage = Math.max(2, totalPages - (maxVisiblePages - 3));
            endPage = totalPages - 1;
        }

        html += `<li class="${1 === currentPage ? 'active' : ''}"><a href="#" data-page="1">1</a></li>`;
        if (startPage > 2) {
            html += `<li><span class="ellipsis">&hellip;</span></li>`;
        }
        for (let i = startPage; i <= endPage; i++) {
            html += `<li class="${i === currentPage ? 'active' : ''}"><a href="#" data-page="${i}">${i}</a></li>`;
        }
        if (endPage < totalPages - 1) {
            html += `<li><span class="ellipsis">&hellip;</span></li>`;
        }
        html += `<li class="${totalPages === currentPage ? 'active' : ''}"><a href="#" data-page="${totalPages}">${totalPages}</a></li>`;
    }

    html += `<li class="${currentPage === totalPages ? 'disabled' : ''}"><a href="#" data-page="${currentPage + 1}">&raquo;</a></li>`;
    html += '</ul>';
    container.innerHTML = html;
}

function renderRetraitsView(container) {
   if (!container) return;
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
                <div class="day-card-header"><i class="fa-solid fa-calendar-day"></i>${formatDateFr(dateKey, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                <div class="day-card-body">
                    <div class="day-kpi"><span>Montant Retiré</span><strong>${formatEuros(dayData.totalValue)}</strong></div>
                    <div class="day-kpi"><span>Articles</span><strong>${dayData.totalItems}</strong></div>
                </div>
                <div class="day-card-footer"><button class="action-btn-small details-btn"><i class="fa-solid fa-eye"></i> Voir détails</button></div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div class="withdrawals-header"><h3>Journal des Retraits</h3></div>
        <div class="withdrawals-log-wrapper"><div id="withdrawals-log-container">${dayCardsHtml}</div></div>
        <div id="modal-withdrawal-details" class="modal"><div class="modal-content wide" id="modal-withdrawal-details-content"></div></div>
    `;
}

// --- Logique Principale ---

async function loadAndRender(historyPage, params = {}) {
    currentParams = params;
    const historyGridContainer = historyPage.querySelector('.history-grid');
    const retraitsContentContainer = historyPage.querySelector('#retraits-view-content');
    const paginationNav = historyPage.querySelector('.pagination-nav');
    try {
        historyGridContainer.innerHTML = '<p>Chargement...</p>';
        retraitsContentContainer.innerHTML = '<p>Chargement...</p>';
        
        const data = await fetchHistoriqueData(params);
        renderCards(historyGridContainer, data.historique);
        renderPagination(paginationNav, data.page_courante, data.pages_totales);
        processWithdrawalData(data.historique_complet, config.denominations);
        renderRetraitsView(retraitsContentContainer);
    } catch (error) {
        console.error("Erreur de chargement:", error);
        const errorMessage = `<p class="error">Erreur: ${error.message}</p>`;
        historyGridContainer.innerHTML = errorMessage;
        retraitsContentContainer.innerHTML = errorMessage;
    }
}

async function fetchHistoriqueData(params) {
    const configPromise = fetch('index.php?route=calculateur/config').then(res => res.json());
    const historyPromise = fetch(`index.php?route=historique/get_data&${new URLSearchParams(params)}`).then(res => res.json());
    const [conf, history] = await Promise.all([configPromise, historyPromise]);
    config = conf;
    if (!history.success || !history.historique) {
        throw new Error(history.message || "La réponse de l'API pour l'historique est invalide.");
    }
    fullHistoryData = history.historique_complet || [];
    return history;
}

function processWithdrawalData(comptages, denominations) {
    withdrawalsByDay = {};
    const allDenomsValueMap = { ...(denominations.billets || {}), ...(denominations.pieces || {}) };
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
                if (qty > 0) {
                    const value = parseFloat(allDenomsValueMap[denom] || 0);
                    const amount = qty * value;
                    withdrawalsByDay[dateKey].totalValue += amount;
                    withdrawalsByDay[dateKey].totalItems += qty;
                    withdrawalsByDay[dateKey].details.push({ caisse_nom: config.nomsCaisses[caisse_id], denomination: denom, quantite: qty, valeur: amount });
                }
            }
        }
    }
}

async function handleDeleteComptage(comptageId, cardElement) {
    if (confirm("Êtes-vous sûr de vouloir supprimer définitivement ce comptage ?")) {
        const formData = new FormData();
        formData.append('id_a_supprimer', comptageId);
        try {
            const response = await fetch('index.php?route=historique/delete', { method: 'POST', body: formData });
            const result = await response.json();
            if(!result.success) throw new Error(result.message);
            cardElement.style.transition = 'opacity 0.3s';
            cardElement.style.opacity = '0';
            setTimeout(() => cardElement.remove(), 300);
        } catch(err) {
            alert(`Erreur: ${err.message}`);
        }
    }
}

async function handleLoadComptage(comptageId, buttonElement) {
    const comptageData = fullHistoryData.find(c => c.id.toString() === comptageId);
    if(comptageData && confirm(`Voulez-vous charger le comptage "${comptageData.nom_comptage}" ?\n\nAttention : Votre travail non sauvegardé dans le calculateur sera écrasé.`)) {
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
            const formData = new FormData();
            formData.append('comptage_id', comptageId);
            const response = await fetch('index.php?route=calculateur/load_from_history', { method: 'POST', body: formData });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            sendWsMessage({ type: 'force_reload_all' });
            window.location.href = '/calculateur';

        } catch (error) {
            alert(`Erreur lors du chargement : ${error.message}`);
            buttonElement.disabled = false;
            buttonElement.innerHTML = '<i class="fa-solid fa-download"></i> Charger';
        }
    }
}

// --- Logique du Panneau de Détails (Bottom Sheet) ---

function renderSheetCharts(caisse_id, data, results) {
    const chartOptions = {
        chart: { background: 'transparent', toolbar: { show: false } },
        theme: { mode: document.body.dataset.theme === 'dark' ? 'dark' : 'light' },
        legend: { position: 'bottom' }
    };
    
    const repartitionContainer = document.getElementById(`repartition-chart-${caisse_id}`);
    const repartitionData = [results.total_compte_especes, results.total_compte_cb, results.total_compte_cheques];
    if (repartitionContainer && repartitionData.some(v => v > 0)) {
        const repartitionOptions = {
            ...chartOptions,
            series: repartitionData,
            chart: { ...chartOptions.chart, type: 'donut' },
            labels: ['Espèces', 'Carte Bancaire', 'Chèques'],
            responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: 'bottom' } } }]
        };
        const chart = new ApexCharts(repartitionContainer, repartitionOptions);
        chart.render();
        sheetCharts.push(chart);
    } else if (repartitionContainer) {
        repartitionContainer.innerHTML = '<div class="chart-placeholder">Aucune recette à afficher.</div>';
    }

    const denominationsContainer = document.getElementById(`denominations-chart-${caisse_id}`);
    const allDenomsMap = { ...config.denominations.billets, ...config.denominations.pieces };
    const denominationsData = (data.denominations || [])
        .map(d => ({ name: d.denomination_nom, value: allDenomsMap[d.denomination_nom], total: d.quantite * allDenomsMap[d.denomination_nom] }))
        .filter(d => d.total > 0).sort((a, b) => b.value - a.value);

    if (denominationsContainer && denominationsData.length > 0) {
        const denominationsOptions = {
            ...chartOptions,
            series: [{ name: 'Valeur', data: denominationsData.map(d => d.total) }],
            chart: { ...chartOptions.chart, type: 'bar', height: 250 },
            plotOptions: { bar: { borderRadius: 4, horizontal: true } },
            dataLabels: { enabled: false },
            xaxis: {
                categories: denominationsData.map(d => {
                    const val = parseFloat(d.value);
                    return val >= 1 ? `${val}€` : `${val * 100}c`;
                }),
                labels: { formatter: (value) => formatEuros(value) }
            }
        };
        const chart = new ApexCharts(denominationsContainer, denominationsOptions);
        chart.render();
        sheetCharts.push(chart);
    } else if (denominationsContainer) {
        denominationsContainer.innerHTML = '<div class="chart-placeholder">Aucune espèce comptée.</div>';
    }
}

function renderSheetContent(container, comptageId) {
    const comptage = fullHistoryData.find(c => c.id.toString() === comptageId);
    if (!comptage) {
        container.innerHTML = '<p class="error">Données du comptage introuvables.</p>';
        return;
    }

    document.getElementById('details-sheet-title').textContent = comptage.nom_comptage;
    document.getElementById('details-sheet-subtitle').textContent = `Comptage du ${formatDateFr(comptage.date_comptage)}`;

    const allDenomsMap = { ...config.denominations.billets, ...config.denominations.pieces };
    let allWithdrawals = {};
    let grandTotalWithdrawals = 0;

    Object.values(comptage.caisses_data).forEach(caisse => {
        if (caisse.retraits) {
            Object.entries(caisse.retraits).forEach(([denom, qty]) => {
                const quantity = parseInt(qty, 10);
                allWithdrawals[denom] = (allWithdrawals[denom] || 0) + quantity;
                grandTotalWithdrawals += quantity * (allDenomsMap[denom] || 0);
            });
        }
    });

    let summaryWithdrawalsHtml = '';
    if (Object.keys(allWithdrawals).length > 0) {
        const summaryRows = Object.entries(allDenomsMap)
            .map(([key, value]) => ({ key, value: parseFloat(value), qty: allWithdrawals[key] || 0 }))
            .filter(d => d.qty > 0)
            .sort((a, b) => b.value - a.value)
            .map(d => `<tr><td>${d.value >= 1 ? `${d.value}€` : `${d.value*100}c`}</td><td class="text-right">${d.qty}</td><td class="text-right">${formatEuros(d.qty * d.value)}</td></tr>`)
            .join('');

        summaryWithdrawalsHtml = `
            <div class="card" style="margin-bottom: 20px;">
                <h3>Récapitulatif Général des Retraits</h3>
                <div class="details-card">
                    <div class="details-card-header"><h5><i class="fa-solid fa-arrow-down-from-line"></i> Total Retiré</h5><span class="total-amount">${formatEuros(grandTotalWithdrawals)}</span></div>
                    <div class="table-responsive"><table class="modal-details-table"><thead><tr><th>Coupure</th><th class="text-right">Qté</th><th class="text-right">Total</th></tr></thead><tbody>${summaryRows}</tbody></table></div>
                </div>
            </div>`;
    }

    const caissesHtml = Object.entries(comptage.caisses_data).map(([caisse_id, data]) => {
        const caisseResult = comptage.results.caisses[caisse_id];
        const nomCaisse = config.nomsCaisses[caisse_id] || `Caisse #${caisse_id}`;
        
        const denomsHtml = (data.denominations || []).map(d => ({ ...d, value: parseFloat(allDenomsMap[d.denomination_nom]) })).filter(d => d.quantite > 0).sort((a,b) => b.value - a.value).map(d => `<tr><td>${d.value >= 1 ? `${d.value}€` : `${d.value*100}c`}</td><td class="text-right">${d.quantite}</td><td class="text-right">${formatEuros(d.quantite * d.value)}</td></tr>`).join('');
        const chequesHtml = (data.cheques || []).map(c => `<tr><td>${c.commentaire || 'N/A'}</td><td class="text-right">${formatEuros(c.montant)}</td></tr>`).join('');
        const tpeHtml = Object.entries(data.cb || {}).map(([terminalId, releves]) => (releves || []).map(r => `<tr><td>${(config.tpeParCaisse[terminalId] || {}).nom || `TPE #${terminalId}`} (${r.heure || 'N/A'})</td><td class="text-right">${formatEuros(r.montant)}</td></tr>`).join('')).join('');
        
        const withdrawalsHtml = (Object.entries(data.retraits || {}) || [])
            .map(([key, qty]) => ({ key, qty: parseInt(qty, 10), value: parseFloat(allDenomsMap[key]) }))
            .filter(d => d.qty > 0)
            .sort((a, b) => b.value - a.value)
            .map(d => `<tr><td>${d.value >= 1 ? `${d.value}€` : `${d.value*100}c`}</td><td class="text-right">${d.qty}</td><td class="text-right">${formatEuros(d.qty * d.value)}</td></tr>`)
            .join('');

        return `
            <div class="card" style="margin-bottom: 20px;">
                <h3>Détails pour : ${nomCaisse}</h3>
                <div class="modal-details-layout">
                    <div class="modal-charts-container">
                        <div class="chart-wrapper"><h5>Répartition de la Recette</h5><div id="repartition-chart-${caisse_id}"></div></div>
                        <div class="chart-wrapper"><h5>Composition des Espèces</h5><div id="denominations-chart-${caisse_id}"></div></div>
                    </div>
                    <div>
                        <div class="caisse-kpi-grid">
                           <div class="caisse-kpi-card"><span>Total Compté</span><strong>${formatEuros(caisseResult.total_compté)}</strong></div>
                           <div class="caisse-kpi-card"><span>Recette Théorique</span><strong>${formatEuros(caisseResult.recette_theorique)}</strong></div>
                           <div class="caisse-kpi-card ${getEcartClass(caisseResult.ecart)}"><span>Écart</span><strong>${formatEuros(caisseResult.ecart)}</strong></div>
                        </div>
                        <div class="modal-details-grid">
                            <div class="details-card">
                                <div class="details-card-header"><h5><i class="fa-solid fa-money-bill-wave"></i> Espèces</h5><span class="total-amount">${formatEuros(caisseResult.total_compte_especes)}</span></div>
                                <div class="table-responsive"><table class="modal-details-table"><thead><tr><th>Coupure</th><th class="text-right">Qté</th><th class="text-right">Total</th></tr></thead><tbody>${denomsHtml || '<tr><td colspan="3">Aucune espèce.</td></tr>'}</tbody></table></div>
                            </div>
                            <div class="details-card">
                                <div class="details-card-header"><h5><i class="fa-solid fa-arrow-down-from-line"></i> Retraits</h5><span class="total-amount">${formatEuros(caisseResult.total_retraits)}</span></div>
                                <div class="table-responsive"><table class="modal-details-table"><thead><tr><th>Coupure</th><th class="text-right">Qté</th><th class="text-right">Total</th></tr></thead><tbody>${withdrawalsHtml || '<tr><td colspan="3">Aucun retrait.</td></tr>'}</tbody></table></div>
                            </div>
                            <div class="details-card">
                                <div class="details-card-header"><h5><i class="fa-solid fa-credit-card"></i> TPE</h5><span class="total-amount">${formatEuros(caisseResult.total_compte_cb)}</span></div>
                                <div class="table-responsive"><table class="modal-details-table"><thead><tr><th>Terminal</th><th class="text-right">Montant</th></tr></thead><tbody>${tpeHtml || '<tr><td colspan="2">Aucun relevé.</td></tr>'}</tbody></table></div>
                            </div>
                            <div class="details-card">
                                <div class="details-card-header"><h5><i class="fa-solid fa-money-check-dollar"></i> Chèques</h5><span class="total-amount">${formatEuros(caisseResult.total_compte_cheques)}</span></div>
                                <div class="table-responsive"><table class="modal-details-table"><thead><tr><th>Commentaire</th><th class="text-right">Montant</th></tr></thead><tbody>${chequesHtml || '<tr><td colspan="2">Aucun chèque.</td></tr>'}</tbody></table></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `<div id="printable-content">${summaryWithdrawalsHtml}${caissesHtml}</div>`;
}

function initializeSheetLogic() {
    const sheet = document.getElementById('details-sheet');
    const overlay = document.getElementById('details-sheet-overlay');
    if(!sheet || !overlay) return;

    document.body.addEventListener('click', e => {
        if (e.target.closest('#details-sheet-close-btn') || e.target.matches('#details-sheet-overlay')) {
            closeDetailsSheet();
        }
    });
}

function openDetailsSheet(comptageId) {
    const sheet = document.getElementById('details-sheet');
    const overlay = document.getElementById('details-sheet-overlay');
    const content = document.getElementById('details-sheet-content');
    if (!sheet || !overlay || !content) return;

    content.innerHTML = '<p>Chargement des détails...</p>';
    sheet.style.height = '80vh';
    sheet.classList.add('visible');
    overlay.classList.add('visible');
    
    renderSheetContent(content, comptageId); 
    
    const comptage = fullHistoryData.find(c => c.id.toString() === comptageId);
    if (comptage) {
        Object.entries(comptage.caisses_data).forEach(([caisse_id, data]) => {
            if (comptage.results.caisses[caisse_id]) {
                renderSheetCharts(caisse_id, data, comptage.results.caisses[caisse_id]);
            }
        });
    }
}

function closeDetailsSheet() {
    const sheet = document.getElementById('details-sheet');
    const overlay = document.getElementById('details-sheet-overlay');
    if (!sheet || !overlay) return;
    sheet.classList.remove('visible');
    overlay.classList.remove('visible');
    
    sheetCharts.forEach(chart => chart.destroy());
    sheetCharts = [];
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
    
export function initializeHistoryLogic() {
    const historyPage = document.getElementById('history-page');
    if (!historyPage) return;

    loadAndRender(historyPage);
    initializeSheetLogic();

    historyPage.addEventListener('submit', (e) => {
        if (e.target.matches('#history-filter-form')) {
            e.preventDefault();
            loadAndRender(historyPage, Object.fromEntries(new FormData(e.target).entries()));
        }
    });

    historyPage.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.closest('#reset-filter-btn')) {
            const filterForm = historyPage.querySelector('#history-filter-form');
            if(filterForm) filterForm.reset();
            loadAndRender(historyPage);
        }
        const paginationLink = target.closest('.pagination-nav a');
        if (paginationLink && !paginationLink.parentElement.classList.contains('disabled')) {
            e.preventDefault();
            loadAndRender(historyPage, { ...currentParams, p: parseInt(paginationLink.dataset.page) });
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
        if (target.closest('.details-btn') && target.closest('.history-card')) {
            const comptageId = target.closest('.history-card').dataset.comptageId;
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
        } else if (target.closest('#sheet-fullscreen-btn')) {
            const sheet = document.getElementById('details-sheet');
            const icon = target.closest('#sheet-fullscreen-btn').querySelector('i');
            if (sheet.style.height === '90vh') {
                sheet.style.height = '80vh';
                icon.classList.remove('fa-compress');
                icon.classList.add('fa-expand');
            } else {
                sheet.style.height = '90vh';
                icon.classList.remove('fa-expand');
                icon.classList.add('fa-compress');
            }
        }
        if (target.closest('.delete-btn') && target.closest('.history-card')) {
             const card = target.closest('.history-card');
             const comptageId = card.dataset.comptageId;
             handleDeleteComptage(comptageId, card);
        }
        if (target.closest('.load-btn')) {
            const loadButton = target.closest('.load-btn');
            const comptageId = loadButton.closest('.history-card').dataset.comptageId;
            handleLoadComptage(comptageId, loadButton);
        }
        const withdrawalDetailsBtn = target.closest('.day-card .details-btn');
        if (withdrawalDetailsBtn) {
            const dateKey = withdrawalDetailsBtn.closest('.day-card').dataset.dateKey;
            renderWithdrawalDetailsModal(dateKey);
        }
    });
}
