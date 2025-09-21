// Fichier : public/assets/js/logic/history-logic.js (Version Finale Corrigée et Robuste)
import { sendWsMessage } from './websocket-service.js';

// --- État et Configuration Globale ---
let fullHistoryData = [];
let config = {};
let withdrawalsByDay = {};
let sheetRepartitionChart = null;
let sheetDenominationsChart = null;
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
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    let html = '<ul class="pagination">';
    html += `<li class="${currentPage === 1 ? 'disabled' : ''}"><a href="#" data-page="${currentPage - 1}">&laquo;</a></li>`;
    for (let i = 1; i <= totalPages; i++) { html += `<li class="${i === currentPage ? 'active' : ''}"><a href="#" data-page="${i}">${i}</a></li>`; }
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

/**
 * Point d'entrée pour initialiser la logique de la page d'historique.
 */
export function initializeHistoryLogic() {
    const historyPage = document.getElementById('history-page');
    if (!historyPage) return;

    // --- GESTION DES ÉVÉNEMENTS (DÉLÉGATION) ---
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
            if (filterForm) filterForm.reset();
            loadAndRender(historyPage);
        }

        const paginationLink = target.closest('.pagination-nav a');
        if (paginationLink && !paginationLink.parentElement.classList.contains('disabled')) {
            e.preventDefault();
            loadAndRender(historyPage, { ...currentParams, p: paginationLink.dataset.page });
        }

        const tabLink = target.closest('.view-tabs .tab-link');
        if (tabLink && !tabLink.classList.contains('active')) {
            e.preventDefault();
            const viewToShow = tabLink.dataset.view;
            historyPage.querySelectorAll('.view-tabs .tab-link, .view-content').forEach(el => el.classList.remove('active'));
            tabLink.classList.add('active');
            historyPage.querySelector(`#${viewToShow}-view`)?.classList.add('active');
        }

        const historyCard = target.closest('.history-card');
        if (historyCard) {
            const comptageId = historyCard.dataset.comptageId;
            if (target.closest('.details-btn')) openDetailsSheet(comptageId);
            if (target.closest('.load-btn')) await handleLoadComptage(comptageId, target.closest('.load-btn'));
            if (target.closest('.delete-btn')) await handleDeleteComptage(comptageId, historyCard);
        }
        
        const dayCard = target.closest('.day-card');
        if (dayCard && target.closest('.details-btn')) {
            renderWithdrawalDetailsModal(dayCard.dataset.dateKey);
        }
    });
    
    // --- Initialisation ---
    loadAndRender(historyPage);
    initializeSheetLogic();
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
        sheet.style.height = '50vh';
        sheet.classList.add('visible');
        overlay.classList.add('visible');
        
        renderSheetContent(content, comptageId);

        // --- DÉBUT DU CORRECTIF ---
        // On attend que le navigateur soit prêt avant de dessiner les graphiques.
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
        // --- FIN DU CORRECTIF ---
    }

    function closeDetailsSheet() {
        const sheet = document.getElementById('details-sheet');
        const overlay = document.getElementById('details-sheet-overlay');
        if (!sheet || !overlay) return;
        sheet.classList.remove('visible');
        overlay.classList.remove('visible');
        if (sheetRepartitionChart) sheetRepartitionChart.destroy();
        if (sheetDenominationsChart) sheetDenominationsChart.destroy();
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
    if (!historyPage) { return; }

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
                sheet.style.height = '50vh';
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

    loadAndRender();
    initializeSheetResizing();
}
