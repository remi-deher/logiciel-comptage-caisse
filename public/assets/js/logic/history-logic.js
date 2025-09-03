// Fichier : public/assets/js/logic/history-logic.js (Avec la fonctionnalité "Synthèse des Retraits")

// --- Fonctions Utilitaires ---
const log = (message, ...details) => console.log(`[Historique Log] %c${message}`, 'color: #3498db; font-weight: bold;', ...details);
const logSuccess = (message, ...details) => console.log(`[Historique Log] %c${message}`, 'color: #27ae60; font-weight: bold;', ...details);

// --- Variables globales pour la page ---
let fullHistoryData = [];
let config = {};

const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(montant);
const formatDateFr = (dateString) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(dateString));

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

// --- NOUVEAU : Logique de traitement des données de retraits ---
/**
 * Analyse les données de tous les comptages pour en extraire et agréger les retraits.
 * @param {Array} comptages - Le tableau `historique_complet`.
 * @param {Object} denominations - L'objet de configuration des dénominations.
 * @returns {Object} Un objet contenant les statistiques des retraits.
 */
function processWithdrawalData(comptages, denominations) {
    const stats = {
        totalValue: 0,
        totalItems: 0, // Nombre total de billets/pièces
        byDenomination: {},
    };

    const allDenomsValueMap = { ...denominations.billets, ...denominations.pieces };

    if (!comptages) return stats;

    for (const comptage of comptages) {
        if (!comptage.caisses_data) continue;

        for (const caisse of Object.values(comptage.caisses_data)) {
            if (!caisse.retraits || Object.keys(caisse.retraits).length === 0) continue;

            for (const [denom, qtyStr] of Object.entries(caisse.retraits)) {
                const qty = parseInt(qtyStr, 10);
                const value = parseFloat(allDenomsValueMap[denom]);

                if (!isNaN(qty) && !isNaN(value)) {
                    const amount = qty * value;
                    stats.totalValue += amount;
                    stats.totalItems += qty;

                    // Ajoute la quantité à la somme existante pour cette dénomination
                    stats.byDenomination[denom] = (stats.byDenomination[denom] || 0) + qty;
                }
            }
        }
    }
    return stats;
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
        let cardClass = '';
        if (Math.abs(ecart) < 0.01) {
            cardClass = 'ecart-ok';
        } else if (ecart > 0) {
            cardClass = 'ecart-positif';
        } else {
            cardClass = 'ecart-negatif';
        }

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
                <button class="action-btn-small save-btn" data-comptage-id="${comptage.id}"><i class="fa-solid fa-download"></i> Charger</button>
                <button class="action-btn-small delete-btn" data-comptage-id="${comptage.id}"><i class="fa-solid fa-trash-can"></i> Supprimer</button>
            </div>
        </div>`;
    }).join('');
}

function renderPagination(container, currentPage, totalPages) {
    // ... (Cette fonction reste inchangée)
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
    if(!comptage) { container.innerHTML = "Erreur: détails non trouvés."; return; }

    const { combines, caisses } = comptage.results;

    const getEcartClass = (ecart) => {
        if (Math.abs(ecart) < 0.01) return 'ecart-ok';
        return ecart > 0 ? 'ecart-positif' : 'ecart-negatif';
    };

    const summaryHtml = `
        <ul class="summary-list">
            <li class="${getEcartClass(combines.ecart)}">
                <i class="fa-solid fa-right-left summary-icon"></i>
                <div><span>Écart Total</span><strong>${formatEuros(combines.ecart)}</strong></div>
            </li>
            <li>
                <i class="fa-solid fa-cash-register summary-icon icon-recette"></i>
                <div><span>Recette Réelle Totale</span><strong>${formatEuros(combines.recette_reelle)}</strong></div>
            </li>
            <li>
                <i class="fa-solid fa-receipt summary-icon icon-ventes"></i>
                <div><span>Ventes Théoriques</span><strong>${formatEuros(combines.recette_theorique)}</strong></div>
            </li>
             <li>
                <i class="fa-solid fa-landmark summary-icon icon-fond-caisse"></i>
                <div><span>Total Compté</span><strong>${formatEuros(combines.total_compté)}</strong></div>
            </li>
        </ul>
    `;
    
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
            <div>
                <h3>Détails de: ${comptage.nom_comptage}</h3>
                <p>${formatDateFr(comptage.date_comptage)}</p>
            </div>
            <div class="modal-actions">
                <button id="print-modal-btn" class="action-btn"><i class="fa-solid fa-print"></i> Imprimer</button>
                 <span class="modal-close">&times;</span>
            </div>
        </div>
        <div class="modal-body">
            ${summaryHtml}
            <div class="modal-details-grid">${caissesHtml}</div>
        </div>
    `;
}

// --- MISE À JOUR : La fonction de rendu pour la synthèse des retraits ---
function renderRetraitsView(container, withdrawalStats) {
    log('Affichage de la vue "Synthèse des Retraits" avec les données calculées.', withdrawalStats);

    if (!withdrawalStats || withdrawalStats.totalItems === 0) {
        container.innerHTML = `
            <div class="withdrawals-header"><h3>Synthèse des Retraits</h3></div>
            <div style="padding: 20px; text-align: center; background-color: var(--color-surface-alt); border-radius: 8px;">
                 <p>Aucun retrait d'espèces trouvé pour la période et les filtres sélectionnés.</p>
            </div>`;
        return;
    }

    const kpisHtml = `
        <div class="kpi-card-retrait">
            <h3>Montant Total Retiré</h3>
            <p>${formatEuros(withdrawalStats.totalValue)}</p>
        </div>
        <div class="kpi-card-retrait">
            <h3>Nb. d'articles retirés</h3>
            <p>${withdrawalStats.totalItems.toLocaleString('fr-FR')}</p>
        </div>
    `;

    const allDenomsValueMap = { ...config.denominations.billets, ...config.denominations.pieces };
    const sortedDenoms = Object.entries(withdrawalStats.byDenomination)
        .sort(([denomA], [denomB]) => parseFloat(allDenomsValueMap[denomB]) - parseFloat(allDenomsValueMap[denomA]));

    const tableRowsHtml = sortedDenoms.map(([denom, qty]) => {
        const value = parseFloat(allDenomsValueMap[denom]);
        const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${(value * 100)} cts`;
        return `
            <tr>
                <td>${label}</td>
                <td class="text-right">${qty.toLocaleString('fr-FR')}</td>
                <td class="text-right">${formatEuros(qty * value)}</td>
            </tr>
        `;
    }).join('');

    const tableHtml = `
        <div class="card">
            <h4>Détail par Dénomination</h4>
            <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                <table class="info-table">
                    <thead>
                        <tr>
                            <th>Dénomination</th>
                            <th class="text-right">Quantité Totale</th>
                            <th class="text-right">Valeur Totale</th>
                        </tr>
                    </thead>
                    <tbody>${tableRowsHtml}</tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = `
        <div class="withdrawals-header">
            <h3>Synthèse des Retraits</h3>
            <p class="subtitle">Basé sur les filtres de date et de recherche actuels</p>
        </div>
        <div class="kpi-container-retraits">${kpisHtml}</div>
        <div class="withdrawals-grid">${tableHtml}</div>
    `;
}

// --- Point d'entrée de la logique de la page ---
export async function initializeHistoryLogic() {
    log('Initialisation de la logique de la page Historique.');

    const historyPage = document.getElementById('history-page');
    if (!historyPage) return;

    // Références aux éléments du DOM
    const historyGrid = historyPage.querySelector('.history-grid');
    const paginationNav = historyPage.querySelector('.pagination-nav');
    const filterForm = historyPage.querySelector('#history-filter-form');
    const resetBtn = historyPage.querySelector('#reset-filter-btn');
    const detailsModal = historyPage.querySelector('#details-modal');
    const modalContent = historyPage.querySelector('#modal-details-content');
    const viewTabs = historyPage.querySelector('.view-tabs');
    const comptagesView = historyPage.querySelector('#comptages-view');
    const retraitsView = historyPage.querySelector('#retraits-view');
    const retraitsContentContainer = historyPage.querySelector('#retraits-view-content');

    let currentParams = {};

    // --- MISE À JOUR : La fonction de chargement gère maintenant les deux onglets ---
    async function loadAndRender(params = {}) {
        currentParams = params;
        const historyGridContainer = comptagesView.querySelector('.history-grid');
        
        try {
            historyGridContainer.innerHTML = '<p>Chargement...</p>';
            retraitsContentContainer.innerHTML = '<p>Chargement...</p>'; // Affiche le chargement dans l'onglet retraits aussi

            const data = await fetchHistoriqueData(params);

            // Étape 1: Mettre à jour l'onglet "Comptages"
            renderCards(historyGridContainer, data.historique);
            renderPagination(paginationNav, data.page_courante, data.pages_totales);

            // Étape 2: Traiter les données et mettre à jour l'onglet "Synthèse des Retraits"
            const withdrawalStats = processWithdrawalData(data.historique_complet, config.denominations);
            renderRetraitsView(retraitsContentContainer, withdrawalStats);

        } catch (error) {
            const errorMessage = `<p class="error">Erreur: ${error.message}</p>`;
            historyGridContainer.innerHTML = errorMessage;
            retraitsContentContainer.innerHTML = errorMessage;
        }
    }

    // Gestionnaire d'événements pour les onglets
    viewTabs.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tab = e.target.closest('.tab-link');
        if (!tab || tab.classList.contains('active')) return;

        const viewToShow = tab.dataset.view;
        viewTabs.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        comptagesView.classList.remove('active');
        retraitsView.classList.remove('active');
        document.getElementById(`${viewToShow}-view`).classList.add('active');
    });
    
    // Les autres gestionnaires restent les mêmes
    filterForm.addEventListener('submit', (e) => { e.preventDefault(); loadAndRender(Object.fromEntries(new FormData(filterForm).entries())); });
    resetBtn.addEventListener('click', () => { filterForm.reset(); loadAndRender(); });
    paginationNav.addEventListener('click', (e) => { e.preventDefault(); const link = e.target.closest('a'); if (link && !link.parentElement.classList.contains('disabled')) { loadAndRender({ ...currentParams, p: link.dataset.page }); }});
    historyPage.addEventListener('click', async (e) => { const detailsBtn = e.target.closest('.details-btn'); if (detailsBtn) { renderModalContent(modalContent, detailsBtn.dataset.comptageId); detailsModal.classList.add('visible'); }});
    detailsModal.addEventListener('click', (e) => { if (e.target.classList.contains('modal-close') || e.target.id === 'details-modal') { detailsModal.classList.remove('visible'); }});

    // Chargement initial
    loadAndRender();
}
