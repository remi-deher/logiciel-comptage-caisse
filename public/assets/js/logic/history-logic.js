// Fichier : public/assets/js/logic/history-logic.js (Version Complète et Améliorée)

// --- Fonctions Utilitaires ---
const log = (message, ...details) => console.log(`[Historique Log] %c${message}`, 'color: #3498db; font-weight: bold;', ...details);

// --- Variables globales pour la page ---
let fullHistoryData = [];
let config = {};
let withdrawalsByDay = {}; // NOUVEAU: Pour stocker les données de retraits par jour

const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(montant);
const formatDateFr = (dateString, options = { dateStyle: 'long', timeStyle: 'short' }) => new Intl.DateTimeFormat('fr-FR', options).format(new Date(dateString));

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

// --- Logique de traitement des données de retraits ---
function processWithdrawalData(comptages, denominations) {
    withdrawalsByDay = {}; // Réinitialise les données
    const allDenomsValueMap = { ...denominations.billets, ...denominations.pieces };

    if (!comptages) return;

    for (const comptage of comptages) {
        const dateKey = new Date(comptage.date_comptage).toISOString().split('T')[0];
        if (!withdrawalsByDay[dateKey]) {
            withdrawalsByDay[dateKey] = {
                totalValue: 0,
                totalItems: 0,
                details: []
            };
        }

        if (!comptage.caisses_data) continue;

        for (const [caisse_id, caisse] of Object.entries(comptage.caisses_data)) {
            if (!caisse.retraits || Object.keys(caisse.retraits).length === 0) continue;

            for (const [denom, qtyStr] of Object.entries(caisse.retraits)) {
                const qty = parseInt(qtyStr, 10);
                const value = parseFloat(allDenomsValueMap[denom]);

                if (!isNaN(qty) && !isNaN(value) && qty > 0) {
                    const amount = qty * value;
                    withdrawalsByDay[dateKey].totalValue += amount;
                    withdrawalsByDay[dateKey].totalItems += qty;
                    withdrawalsByDay[dateKey].details.push({
                        caisse_id,
                        caisse_nom: config.nomsCaisses[caisse_id] || `Caisse ${caisse_id}`,
                        denomination: denom,
                        quantite: qty,
                        valeur: amount
                    });
                }
            }
        }
    }
}


// --- Fonctions de Rendu (Affichage) ---
function renderCards(container, historique) {
    // ... (Cette fonction reste inchangée par rapport à la version précédente)
    if (!historique || historique.length === 0) {
        container.innerHTML = '<p style="padding: 20px; text-align: center;">Aucun enregistrement trouvé pour ces critères.</p>';
        return;
    }
    container.innerHTML = historique.map(comptage => {
        const results = comptage.results.combines;
        const ecart = results.ecart;
        let cardClass = '';
        if (Math.abs(ecart) < 0.01) cardClass = 'ecart-ok';
        else if (ecart > 0) cardClass = 'ecart-positif';
        else cardClass = 'ecart-negatif';

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
    // ... (Cette fonction reste inchangée par rapport à la version précédente)
    const comptage = fullHistoryData.find(c => c.id.toString() === comptageId.toString());
    if (!comptage) { container.innerHTML = "Erreur: détails non trouvés."; return; }
    const { combines, caisses } = comptage.results;
    const getEcartClass = (ecart) => {
        if (Math.abs(ecart) < 0.01) return 'ecart-ok';
        return ecart > 0 ? 'ecart-positif' : 'ecart-negatif';
    };
    const summaryHtml = `
        <ul class="summary-list">
            <li class="${getEcartClass(combines.ecart)}"><i class="fa-solid fa-right-left summary-icon"></i><div><span>Écart Total</span><strong>${formatEuros(combines.ecart)}</strong></div></li>
            <li><i class="fa-solid fa-cash-register summary-icon icon-recette"></i><div><span>Recette Réelle Totale</span><strong>${formatEuros(combines.recette_reelle)}</strong></div></li>
            <li><i class="fa-solid fa-receipt summary-icon icon-ventes"></i><div><span>Ventes Théoriques</span><strong>${formatEuros(combines.recette_theorique)}</strong></div></li>
             <li><i class="fa-solid fa-landmark summary-icon icon-fond-caisse"></i><div><span>Total Compté</span><strong>${formatEuros(combines.total_compté)}</strong></div></li>
        </ul>`;
    const allDenomsMap = { ...config.denominations.billets, ...config.denominations.pieces };
    const caissesHtml = Object.entries(comptage.caisses_data).map(([caisse_id, data]) => {
        const caisseResult = caisses[caisse_id];
        const denomsHtml = Object.entries(allDenomsMap)
            .map(([key, value]) => {
                const denomData = data.denominations.find(d => d.denomination_nom === key);
                const quantite = denomData ? parseInt(denomData.quantite, 10) : 0;
                if (quantite === 0) return '';
                const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
                return `<tr><td>${label}</td><td class="text-right">${quantite}</td><td class="text-right">${formatEuros(quantite * value)}</td></tr>`;
            }).join('');
        return `
        <div>
            <h4 class="modal-table-title">${config.nomsCaisses[caisse_id] || `Caisse ${caisse_id}`}</h4>
            <table class="modal-details-table">
                <thead><tr><th>Dénomination</th><th class="text-right">Quantité</th><th class="text-right">Total</th></tr></thead>
                <tbody>${denomsHtml}</tbody>
                <tfoot>
                    <tr><td colspan="2">Total Compté</td><td class="text-right">${formatEuros(caisseResult.total_compte)}</td></tr>
                    <tr><td colspan="2">Fond de Caisse</td><td class="text-right">${formatEuros(caisseResult.fond_de_caisse)}</td></tr>
                    <tr><td colspan="2">Recette Réelle</td><td class="text-right">${formatEuros(caisseResult.recette_reelle)}</td></tr>
                    <tr><td colspan="2">Recette Théorique</td><td class="text-right">${formatEuros(caisseResult.recette_theorique)}</td></tr>
                    <tr class="${getEcartClass(caisseResult.ecart)}"><td colspan="2"><strong>Écart</strong></td><td class="text-right"><strong>${formatEuros(caisseResult.ecart)}</strong></td></tr>
                </tfoot>
            </table>
        </div>`;
    }).join('');
    container.innerHTML = `
        <div class="modal-header">
            <div><h3>Détails de: ${comptage.nom_comptage}</h3><p>${formatDateFr(comptage.date_comptage)}</p></div>
            <div class="modal-actions"><button id="print-modal-btn" class="action-btn"><i class="fa-solid fa-print"></i> Imprimer</button><span class="modal-close">&times;</span></div>
        </div>
        <div class="modal-body">${summaryHtml}<div class="modal-details-grid">${caissesHtml}</div></div>`;
}

// --- NOUVELLE VERSION de la fonction de rendu pour la synthèse des retraits ---
function renderRetraitsView(container) {
    log('Affichage de la vue "Synthèse des Retraits" avec les données par jour.', withdrawalsByDay);
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
                <input type="checkbox" class="day-card-checkbox" data-amount="${dayData.totalValue}" title="Sélectionner ce jour">
                <div class="day-card-header">
                    <i class="fa-solid fa-calendar-day"></i>
                    ${formatDateFr(dateKey, { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div class="day-card-body">
                    <div class="day-kpi"><span>Montant Retiré</span><strong>${formatEuros(dayData.totalValue)}</strong></div>
                    <div class="day-kpi"><span>Articles Retirés</span><strong>${dayData.totalItems}</strong></div>
                </div>
                <div class="day-card-footer">
                    <button class="action-btn-small details-btn"><i class="fa-solid fa-eye"></i> Voir détails</button>
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div class="withdrawals-header">
            <h3>Journal des Retraits</h3>
            <p class="subtitle">Cliquez sur un jour pour voir le détail.</p>
        </div>
        <div class="withdrawals-log-wrapper">
            <div id="withdrawals-log-container">${dayCardsHtml}</div>
        </div>
        <div class="selection-toolbar" id="selection-toolbar">
            <span id="day-selection-counter">0 jour(s) sélectionné(s)</span>
            <button id="clear-day-selection-btn" class="btn delete-btn">Tout désélectionner</button>
        </div>
        <div id="modal-withdrawal-details" class="modal"><div class="modal-content wide" id="modal-withdrawal-details-content"></div></div>
    `;
    
    // Attacher les nouveaux écouteurs d'événements
    attachWithdrawalsEventListeners();
}

function attachWithdrawalsEventListeners() {
    const container = document.getElementById('retraits-view-content');
    const logContainer = container.querySelector('#withdrawals-log-container');
    const selectionToolbar = container.querySelector('#selection-toolbar');
    
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

    if (selectionToolbar) {
        container.querySelector('#clear-day-selection-btn').addEventListener('click', () => {
            container.querySelectorAll('.day-card-checkbox:checked').forEach(cb => {
                cb.checked = false;
                cb.closest('.day-card').classList.remove('selected');
            });
            updateSelectionToolbar();
        });
    }
}

function updateSelectionToolbar() {
    const toolbar = document.getElementById('selection-toolbar');
    const counter = document.getElementById('day-selection-counter');
    const checkedBoxes = document.querySelectorAll('.day-card-checkbox:checked');
    
    if (checkedBoxes.length > 0) {
        let total = 0;
        checkedBoxes.forEach(cb => total += parseFloat(cb.dataset.amount));
        counter.innerHTML = `<strong>${checkedBoxes.length}</strong> jour(s) sélectionné(s) | Total : <strong>${formatEuros(total)}</strong>`;
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
    const allDenomsValueMap = { ...config.denominations.billets, ...config.denominations.pieces };

    const rowsHtml = dayData.details.map(d => {
        const value = parseFloat(allDenomsValueMap[d.denomination]);
        const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${(value * 100)} cts`;
        return `<tr>
                    <td>${d.caisse_nom}</td>
                    <td>${label}</td>
                    <td class="text-right">${d.quantite}</td>
                    <td class="text-right">${formatEuros(d.valeur)}</td>
                </tr>`;
    }).join('');

    content.innerHTML = `
        <div class="modal-header">
            <h3>Détail des retraits du ${formatDateFr(dateKey, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            <span class="modal-close">&times;</span>
        </div>
        <div class="modal-body">
            <div id="withdrawal-details-table-container">
                <table class="info-table log-table">
                    <thead><tr><th>Caisse</th><th>Dénomination</th><th class="text-right">Quantité</th><th class="text-right">Valeur</th></tr></thead>
                    <tbody>${rowsHtml}</tbody>
                    <tfoot><tr><td colspan="3">Total du jour</td><td class="text-right">${formatEuros(dayData.totalValue)}</td></tr></tfoot>
                </table>
            </div>
        </div>`;
    
    modal.classList.add('visible');
    modal.querySelector('.modal-close').onclick = () => modal.classList.remove('visible');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('visible'); };
}

// --- Point d'entrée de la logique de la page ---
export async function initializeHistoryLogic() {
    log('Initialisation de la logique de la page Historique.');
    const historyPage = document.getElementById('history-page');
    if (!historyPage) return;

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
        } catch (error) {
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
    historyPage.addEventListener('click', (e) => { const detailsBtn = e.target.closest('.details-btn'); if (detailsBtn) { renderModalContent(modalContent, detailsBtn.dataset.comptageId); detailsModal.classList.add('visible'); }});
    detailsModal.addEventListener('click', (e) => { if (e.target.classList.contains('modal-close') || e.target.id === 'details-modal') { detailsModal.classList.remove('visible'); }});

    loadAndRender();
}
