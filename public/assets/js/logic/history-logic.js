// Fichier : public/assets/js/logic/history-logic.js (Version Finale Complète et Corrigée)

// --- Fonctions Utilitaires ---
const log = (message, ...details) => console.log(`[Historique Log] %c${message}`, 'color: #3498db; font-weight: bold;', ...details);
const logSuccess = (message, ...details) => console.log(`[Historique Log] %c${message}`, 'color: #27ae60; font-weight: bold;', ...details);


// --- Variables globales pour la page ---
let fullHistoryData = [];
let config = {};
let withdrawalsByDay = {}; // Pour stocker les données de retraits par jour

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
    if (!historique || historique.length === 0) {
        container.innerHTML = '<p style="padding: 20px; text-align: center;">Aucun enregistrement trouvé pour ces critères.</p>';
        return;
    }
    container.innerHTML = historique.map(comptage => {
        const results = comptage.results.combines;
        const ecart = results.ecart;
        const cardClass = getEcartClass(ecart);

        return `
        <div class="history-card ${cardClass}" data-comptage-id="${comptage.id}">
             <input type="checkbox" class="comparison-checkbox" data-comptage-id="${comptage.id}" title="Sélectionner pour comparer">
            <div class="history-card-header">
                <h4>${comptage.nom_comptage}</h4>
                <div class="date">${formatDateFr(comptage.date_comptage)}</div>
                ${comptage.explication ? `<p class="explication">${comptage.explication}</p>` : ''}
            </div>
            <div class="history-card-body">
                <div class="summary-line">
                    <div><i class="fa-solid fa-receipt"></i> Ventes Théoriques</div>
                    <span>${formatEuros(results.recette_theorique)}</span>
                </div>
                <div class="summary-line">
                    <div><i class="fa-solid fa-money-bill-wave"></i> Recette Réelle</div>
                    <span>${formatEuros(results.recette_reelle)}</span>
                </div>
                <div class="summary-line total-ecart">
                    <div><strong><i class="fa-solid fa-right-left"></i> Écart Total</strong></div>
                    <span class="ecart-value">${formatEuros(ecart)}</span>
                </div>
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

    const { combines, caisses } = comptage.results;

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
        
        const retraitsHtml = Object.entries(data.retraits || {})
            .map(([key, quantite]) => {
                const value = parseFloat(allDenomsMap[key]);
                if (parseInt(quantite, 10) === 0) return '';
                const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
                return `<tr><td>${label}</td><td class="text-right">${quantite}</td><td class="text-right">${formatEuros(quantite * value)}</td></tr>`;
            }).join('');
        const totalRetraits = Object.entries(data.retraits || {}).reduce((sum, [key, qty]) => sum + (parseInt(qty, 10) * allDenomsMap[key]), 0);

        return `
        <div>
            <h4 class="modal-table-title">${config.nomsCaisses[caisse_id] || `Caisse ${caisse_id}`}</h4>
            <table class="modal-details-table">
                <thead><tr><th>Dénomination Comptée</th><th class="text-right">Quantité</th><th class="text-right">Total</th></tr></thead>
                <tbody>${denomsHtml}</tbody>
                <tfoot>
                    <tr><td colspan="2">Total Compté</td><td class="text-right">${formatEuros(caisseResult.total_compte)}</td></tr>
                    <tr class="${getEcartClass(caisseResult.ecart)}"><td colspan="2"><strong>Écart</strong></td><td class="text-right"><strong>${formatEuros(caisseResult.ecart)}</strong></td></tr>
                </tfoot>
            </table>
            
            ${retraitsHtml ? `
            <table class="modal-details-table retrait-table">
                <thead><tr><th>Dénomination Retirée</th><th class="text-right">Quantité</th><th class="text-right">Total</th></tr></thead>
                <tbody>${retraitsHtml}</tbody>
                <tfoot><tr><td colspan="2">Total Retiré</td><td class="text-right">${formatEuros(totalRetraits)}</td></tr></tfoot>
            </table>` : ''}
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="modal-header">
            <div><h3>Détails de: ${comptage.nom_comptage}</h3><p>${formatDateFr(comptage.date_comptage)}</p></div>
            <div class="modal-actions"><button id="print-modal-btn" class="action-btn"><i class="fa-solid fa-print"></i> Imprimer</button><span class="modal-close">&times;</span></div>
        </div>
        <div class="modal-body" id="printable-content">${summaryHtml}<div class="modal-details-grid">${caissesHtml}</div></div>`;
}


// --- Point d'entrée de la logique de la page ---
export async function initializeHistoryLogic() {
    log('Initialisation de la logique de la page Historique.');
    const historyPage = document.getElementById('history-page');
    if (!historyPage) return;

    // --- Définition des fonctions de rendu spécifiques à cette page ---

    function renderRetraitsView(container) {
        log('Affichage de la vue "Synthèse des Retraits" avec les données par jour.', withdrawalsByDay);
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
    
    function attachWithdrawalsEventListeners() {
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
    
    function renderWithdrawalDetailsModal(dateKey, filter = 'all', sort = { by: 'valeur', order: 'desc' }) {
        const dayData = withdrawalsByDay[dateKey];
        if (!dayData) return;
    
        const modal = historyPage.querySelector('#modal-withdrawal-details');
        const content = historyPage.querySelector('#modal-withdrawal-details-content');
        
        const caisseOptions = ['<option value="all">Toutes les caisses</option>', ...Object.keys(config.nomsCaisses).map(id => `<option value="${id}" ${filter === id ? 'selected' : ''}>${config.nomsCaisses[id]}</option>`)].join('');
    
        let filteredDetails = (filter === 'all') ? dayData.details : dayData.details.filter(d => d.caisse_id.toString() === filter);
    
        const allDenomsValueMap = { ...config.denominations.billets, ...config.denominations.pieces };
        filteredDetails.sort((a, b) => {
            let comparison = 0;
            if (sort.by === 'valeur') comparison = b.valeur - a.valeur;
            else if (sort.by === 'quantite') comparison = b.quantite - a.quantite;
            else if (sort.by === 'denomination') comparison = allDenomsValueMap[b.denomination] - allDenomsValueMap[a.denomination];
            else if (sort.by === 'caisse') comparison = a.caisse_nom.localeCompare(b.caisse_nom);
            return sort.order === 'asc' ? -comparison : comparison;
        });
    
        const getSortClass = (column) => (sort.by === column) ? `sort-${sort.order}` : '';
        
        const rowsHtml = filteredDetails.map(d => {
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
                <div class="withdrawal-modal-filters">
                    <label for="caisse-filter">Filtrer par caisse :</label>
                    <select id="caisse-filter" class="inline-input">${caisseOptions}</select>
                </div>
                <div id="withdrawal-details-table-container">
                    <table class="info-table log-table sortable">
                        <thead>
                            <tr>
                                <th class="sortable ${getSortClass('caisse')}" data-sort="caisse">Caisse</th>
                                <th class="sortable ${getSortClass('denomination')}" data-sort="denomination">Dénomination</th>
                                <th class="text-right sortable ${getSortClass('quantite')}" data-sort="quantite">Quantité</th>
                                <th class="text-right sortable ${getSortClass('valeur')}" data-sort="valeur">Valeur</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                        <tfoot><tr><td colspan="3">Total filtré</td><td class="text-right">${formatEuros(filteredDetails.reduce((sum, d) => sum + d.valeur, 0))}</td></tr></tfoot>
                    </table>
                </div>
            </div>`;
            
        modal.classList.add('visible');
        
        const newSort = { ...sort };
        content.querySelectorAll('.sortable th').forEach(th => {
            th.addEventListener('click', () => {
                const sortBy = th.dataset.sort;
                newSort.order = (sort.by === sortBy && sort.order === 'desc') ? 'asc' : 'desc';
                newSort.by = sortBy;
                renderWithdrawalDetailsModal(dateKey, filter, newSort);
            });
        });
        
        content.querySelector('#caisse-filter').addEventListener('change', (e) => {
            renderWithdrawalDetailsModal(dateKey, e.target.value, sort);
        });
    
        modal.querySelector('.modal-close').onclick = () => modal.classList.remove('visible');
        modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('visible'); };
    }
    
    function updateComparisonToolbar() {
        const toolbar = document.getElementById('comparison-toolbar');
        if (!toolbar) return;
        const counter = toolbar.querySelector('#comparison-counter');
        const button = toolbar.querySelector('#compare-btn');
        const checked = document.querySelectorAll('.comparison-checkbox:checked');
    
        if (checked.length > 0) {
            counter.textContent = `${checked.length} comptage(s) sélectionné(s)`;
            button.disabled = checked.length < 2; // On ne peut comparer que 2 ou plus
            toolbar.classList.add('visible');
        } else {
            toolbar.classList.remove('visible');
        }
    }
    
    function renderComparisonModal() {
        const modal = document.getElementById('comparison-modal');
        const content = modal.querySelector('#comparison-modal-content');
        const checkedIds = [...document.querySelectorAll('.comparison-checkbox:checked')].map(cb => cb.dataset.comptageId);
        const comptagesToCompare = fullHistoryData.filter(c => checkedIds.includes(c.id.toString())).sort((a,b) => new Date(a.date_comptage) - new Date(b.date_comptage));
    
        const headersHtml = comptagesToCompare.map(c => `<th>${c.nom_comptage}<br><small>${formatDateFr(c.date_comptage)}</small></th>`).join('');
        
        const rows = [
            { label: 'Recette Réelle', key: 'recette_reelle' },
            { label: 'Recette Théorique', key: 'recette_theorique' },
            { label: 'Écart Total', key: 'ecart' }
        ];
    
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
            <div class="modal-body">
                <div class="table-responsive">
                    <table class="info-table comparison-table">
                        <thead><tr><th>Indicateur</th>${headersHtml}</tr></thead>
                        <tbody>${bodyHtml}</tbody>
                    </table>
                </div>
            </div>
        `;
    
        modal.classList.add('visible');
    }

    // --- Fin des fonctions de rendu ---

    // Injection des éléments qui ne sont pas toujours visibles
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

    // Sélection des éléments du DOM
    const filterForm = historyPage.querySelector('#history-filter-form');
    const resetBtn = historyPage.querySelector('#reset-filter-btn');
    const paginationNav = historyPage.querySelector('.pagination-nav');
    const detailsModal = historyPage.querySelector('#details-modal');
    const modalContent = historyPage.querySelector('#modal-details-content');
    const viewTabs = historyPage.querySelector('.view-tabs');
    const comptagesView = historyPage.querySelector('#comptages-view');
    const retraitsView = historyPage.querySelector('#retraits-view'); // Déclaration unique ici
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

    // Attachement des écouteurs d'événements
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
            renderModalContent(modalContent, target.closest('.history-card').dataset.comptageId);
            detailsModal.classList.add('visible');
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
                    logSuccess(`Comptage ${comptageId} supprimé.`);
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
                sessionStorage.setItem('loadComptageData', JSON.stringify(comptageData));
                window.location.href = '/calculateur';
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

    detailsModal.addEventListener('click', (e) => { if (e.target.classList.contains('modal-close') || e.target.id === 'details-modal') { detailsModal.classList.remove('visible'); }});

    const comparisonModal = document.getElementById('comparison-modal');
    comparisonModal.addEventListener('click', (e) => {
        if (e.target.matches('.modal-close') || e.target === comparisonModal) {
            comparisonModal.classList.remove('visible');
        }
    });

    loadAndRender();
}
