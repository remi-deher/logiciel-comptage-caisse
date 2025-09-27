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
            
            // Notifie les autres clients et navigue vers la page sans recharger
            sendWsMessage({ type: 'force_reload_all' });
            window.location.href = '/calculateur';

        } catch (error) {
            alert(`Erreur lors du chargement : ${error.message}`);
            buttonElement.disabled = false;
            buttonElement.innerHTML = '<i class="fa-solid fa-download"></i> Charger';
        }
    }
}

// --- DÉBUT DE LA CORRECTION : Logique du Panneau de Détails (Bottom Sheet) ---

/**
 * Crée le contenu HTML détaillé pour le panneau.
 */
function renderSheetContent(container, comptageId) {
    const comptage = fullHistoryData.find(c => c.id.toString() === comptageId);
    if (!comptage) {
        container.innerHTML = '<p class="error">Données du comptage introuvables.</p>';
        return;
    }

    // Mise à jour des en-têtes du panneau
    document.getElementById('details-sheet-title').textContent = comptage.nom_comptage;
    document.getElementById('details-sheet-subtitle').textContent = `Comptage du ${formatDateFr(comptage.date_comptage)}`;

    const caissesHtml = Object.entries(comptage.caisses_data).map(([caisse_id, data]) => {
        const caisseResult = comptage.results.caisses[caisse_id];
        const nomCaisse = config.nomsCaisses[caisse_id] || `Caisse #${caisse_id}`;
        
        const allDenoms = { ...config.denominations.billets, ...config.denominations.pieces };
        const denomsHtml = Object.entries(allDenoms).sort((a,b) => b[1] - a[1]).map(([key, value]) => {
            const quantite = data.denominations.find(d => d.denomination_nom === key)?.quantite || 0;
            if(quantite === 0) return '';
            const label = value >= 1 ? `${value}€` : `${value * 100}c`;
            return `<tr><td>${label}</td><td class="text-right">${quantite}</td><td class="text-right">${formatEuros(quantite * value)}</td></tr>`;
        }).join('');

        const chequesHtml = (data.cheques || []).map(c => `<tr><td>${c.commentaire || 'N/A'}</td><td class="text-right">${formatEuros(c.montant)}</td></tr>`).join('');
        
        const tpeHtml = Object.entries(data.cb || {}).map(([terminalId, releves]) => {
             const terminalName = config.tpeParCaisse[terminalId]?.nom || `TPE #${terminalId}`;
             return releves.map(r => `<tr><td>${terminalName} (${r.heure || 'N/A'})</td><td class="text-right">${formatEuros(r.montant)}</td></tr>`).join('');
        }).join('');
        
        return `
            <div class="card" style="margin-bottom: 20px;">
                <h3>Détails pour : ${nomCaisse}</h3>
                <div class="caisse-kpi-grid">
                    <div class="caisse-kpi-card"><span>Total Compté</span><strong>${formatEuros(caisseResult.total_compté)}</strong></div>
                    <div class="caisse-kpi-card"><span>Recette Théorique</span><strong>${formatEuros(caisseResult.recette_theorique)}</strong></div>
                    <div class="caisse-kpi-card ${getEcartClass(caisseResult.ecart)}"><span>Écart</span><strong>${formatEuros(caisseResult.ecart)}</strong></div>
                </div>

                <div class="modal-details-grid">
                    <div class="details-card">
                        <div class="details-card-header"><h5><i class="fa-solid fa-money-bill-wave"></i> Espèces</h5><span class="total-amount">${formatEuros(caisseResult.total_compte_especes)}</span></div>
                        <div class="table-responsive"><table class="modal-details-table"><thead><tr><th>Coupure</th><th class="text-right">Qté</th><th class="text-right">Total</th></tr></thead><tbody>${denomsHtml}</tbody></table></div>
                    </div>
                    <div>
                        <div class="details-card" style="margin-bottom: 15px;">
                            <div class="details-card-header"><h5><i class="fa-solid fa-credit-card"></i> TPE</h5><span class="total-amount">${formatEuros(caisseResult.total_compte_cb)}</span></div>
                            <div class="table-responsive"><table class="modal-details-table"><thead><tr><th>Terminal</th><th class="text-right">Montant</th></tr></thead><tbody>${tpeHtml || '<tr><td colspan="2">Aucun relevé.</td></tr>'}</tbody></table></div>
                        </div>
                        <div class="details-card">
                            <div class="details-card-header"><h5><i class="fa-solid fa-money-check-dollar"></i> Chèques</h5><span class="total-amount">${formatEuros(caisseResult.total_compte_cheques)}</span></div>
                            <div class="table-responsive"><table class="modal-details-table"><thead><tr><th>Commentaire</th><th class="text-right">Montant</th></tr></thead><tbody>${chequesHtml || '<tr><td colspan="2">Aucun chèque.</td></tr>'}</tbody></table></div>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `<div id="printable-content">${caissesHtml}</div>`;
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
    sheet.style.height = '60vh'; // Hauteur par défaut
    sheet.classList.add('visible');
    overlay.classList.add('visible');
    
    // On appelle la nouvelle fonction pour générer le contenu
    renderSheetContent(content, comptageId); 
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
// --- FIN DE LA CORRECTION ---
    
/**
 * Point d'entrée pour initialiser la logique de la page d'historique.
 */
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
            loadAndRender(historyPage, { ...currentParams, p: paginationLink.dataset.page });
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
                sheet.style.height = '60vh'; // Rétablit la hauteur par défaut
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
        // Gère le clic sur le bouton "détails" dans la vue des retraits
        const withdrawalDetailsBtn = target.closest('.day-card .details-btn');
        if (withdrawalDetailsBtn) {
            const dateKey = withdrawalDetailsBtn.closest('.day-card').dataset.dateKey;
            renderWithdrawalDetailsModal(dateKey);
        }
    });
    
    historyPage.addEventListener('change', (e) => {
        if (e.target.matches('.comparison-checkbox')) {
            // updateComparisonToolbar(); // Cette fonction doit être définie
        }
    });
}
