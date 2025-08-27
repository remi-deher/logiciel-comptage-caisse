// public/js/history/render.js
// Ce module contient toutes les fonctions qui génèrent et insèrent du HTML dans le DOM.

import * as dom from './dom.js';
import * as utils from './utils.js';
import { renderMiniChart } from './charts.js';

// Récupère la configuration globale depuis l'élément du DOM.
const configElement = document.getElementById('history-data');
const globalConfig = configElement ? JSON.parse(configElement.dataset.config) : {};

/**
 * Affiche les cartes de chaque comptage dans la grille principale.
 * @param {Array<object>} historique - La liste des comptages à afficher.
 */
export function renderHistoriqueCards(historique) {
    if (!dom.historyGrid) return;

    dom.historyGrid.innerHTML = ''; // Vide la grille avant de la remplir
    if (!historique || historique.length === 0) {
        dom.historyGrid.innerHTML = '<p>Aucun enregistrement trouvé pour ces critères.</p>';
        return;
    }

    historique.forEach(comptage => {
        const calculated = utils.calculateResults(comptage);
        const caisseVentesData = Object.keys(globalConfig.nomsCaisses).map(caisseId => {
            const caisseData = calculated.caisses[caisseId];
            return caisseData ? parseFloat(caisseData.ventes) : 0;
        });

        const cardDiv = document.createElement('div');
        cardDiv.className = 'history-card';
        cardDiv.dataset.comptage = JSON.stringify(comptage);
        cardDiv.dataset.id = comptage.id;

        const ecartClass = calculated.combines.ecart > 0.01 ? 'ecart-positif' : (calculated.combines.ecart < -0.01 ? 'ecart-negatif' : '');

        cardDiv.innerHTML = `
            <input type="checkbox" class="comparison-checkbox" title="Sélectionner pour comparer">
            <div class="history-card-header">
                <h4>${comptage.nom_comptage}</h4>
                <div class="date"><i class="fa-regular fa-calendar"></i> ${utils.formatDateFr(comptage.date_comptage)}</div>
                ${comptage.explication ? `<p class="explication"><i class="fa-solid fa-lightbulb"></i> ${comptage.explication}</p>` : ''}
            </div>
            <div class="history-card-body">
                <div class="summary-line">
                    <div><i class="fa-solid fa-coins icon-total"></i> Total Compté Global</div>
                    <span>${utils.formatEuros(calculated.combines.total_compté)}</span>
                </div>
                <div class="summary-line">
                     <div><i class="fa-solid fa-right-left icon-ecart"></i> Écart Global</div>
                    <span class="${ecartClass}">${utils.formatEuros(calculated.combines.ecart)}</span>
                </div>
                <hr class="card-divider">
                <div class="mini-chart-container"></div>
            </div>
            <div class="history-card-footer no-export">
                <button class="action-btn-small details-all-btn"><i class="fa-solid fa-layer-group"></i> Ensemble</button>
                ${Object.entries(globalConfig.nomsCaisses).map(([caisseId, nom]) => `
                    <button class="action-btn-small details-btn" data-caisse-id="${caisseId}" data-caisse-nom="${nom}">
                        <i class="fa-solid fa-list-ul"></i> ${nom}
                    </button>
                `).join('')}
                <div style="flex-grow: 1;"></div>
                <a href="index.php?page=calculateur&load=${comptage.id}" class="action-btn-small save-btn"><i class="fa-solid fa-pen-to-square"></i></a>
                <button type="button" class="action-btn-small delete-btn delete-comptage-btn" data-id-to-delete="${comptage.id}"><i class="fa-solid fa-trash-can"></i></button>
            </div>`;
        
        dom.historyGrid.appendChild(cardDiv);
        renderMiniChart(cardDiv.querySelector('.mini-chart-container'), caisseVentesData);
    });
}

/**
 * Affiche les contrôles de pagination.
 * @param {number} currentPage - La page actuellement affichée.
 * @param {number} totalPages - Le nombre total de pages.
 */
export function renderPagination(currentPage, totalPages) {
    if (!dom.paginationNav) return;
    dom.paginationNav.innerHTML = '';
    if (totalPages <= 1) return;

    let paginationHtml = '<ul class="pagination">';
    if (currentPage > 1) {
        paginationHtml += `<li><a href="#" data-page="${currentPage - 1}">« Préc.</a></li>`;
    }
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            paginationHtml += `<li class="active"><span>${i}</span></li>`;
        } else {
            paginationHtml += `<li><a href="#" data-page="${i}">${i}</a></li>`;
        }
    }
    if (currentPage < totalPages) {
        paginationHtml += `<li><a href="#" data-page="${currentPage + 1}">Suiv. »</a></li>`;
    }
    paginationHtml += '</ul>';
    dom.paginationNav.innerHTML = paginationHtml;
}

/**
 * Affiche la vue "Synthèse des retraits".
 * @param {Array<object>} historique - La liste complète des comptages.
 */
export function renderWithdrawalsView(historique) {
    if (!dom.withdrawalsSummaryTable) return;

    const allWithdrawals = [];
    historique.forEach(comptage => {
        for (const caisseId in comptage.caisses_data) {
            const caisseData = comptage.caisses_data[caisseId];
            if (caisseData.retraits && Object.keys(caisseData.retraits).length > 0) {
                for (const denomination in caisseData.retraits) {
                    allWithdrawals.push({
                        date: comptage.date_comptage,
                        caisse: globalConfig.nomsCaisses[caisseId],
                        denomination: denomination,
                        quantite: caisseData.retraits[denomination]
                    });
                }
            }
        }
    });

    if (allWithdrawals.length === 0) {
        dom.withdrawalsSummaryTable.innerHTML = '<p>Aucun retrait trouvé pour la période sélectionnée.</p>';
        return;
    }

    let tableHtml = '<table class="modal-details-table"><thead><tr><th>Date</th><th>Caisse</th><th>Dénomination</th><th>Quantité Retirée</th><th>Montant</th></tr></thead><tbody>';
    allWithdrawals.forEach(withdrawal => {
        let valeur = 0;
        if (globalConfig.denominations.billets[withdrawal.denomination]) {
            valeur = globalConfig.denominations.billets[withdrawal.denomination];
        } else if (globalConfig.denominations.pieces[withdrawal.denomination]) {
            valeur = globalConfig.denominations.pieces[withdrawal.denomination];
        }
        const label = valeur >= 1 ? `${valeur} ${globalConfig.currencySymbol}` : `${valeur * 100} cts`;
        tableHtml += `
            <tr>
                <td>${utils.formatDateFr(withdrawal.date)}</td>
                <td>${withdrawal.caisse}</td>
                <td>${label}</td>
                <td>${withdrawal.quantite}</td>
                <td>${utils.formatEuros(withdrawal.quantite * valeur)}</td>
            </tr>`;
    });
    tableHtml += '</tbody></table>';
    dom.withdrawalsSummaryTable.innerHTML = tableHtml;
}

/**
 * Met à jour l'état visuel (classe 'active') des boutons de filtre rapide.
 * @param {object} params - Les paramètres de l'URL actuelle.
 */
export function updateQuickFilterButtons(params) {
    dom.quickFilterBtns.forEach(btn => btn.classList.remove('active'));
    if (params.date_debut && params.date_fin) {
        const today = new Date();
        const formatDate = (date) => date.toISOString().split('T')[0];
        const start = params.date_debut;
        const end = params.date_fin;
        
        dom.quickFilterBtns.forEach(btn => {
            const days = parseInt(btn.dataset.days);
            const startDate = new Date();
            startDate.setDate(today.getDate() - days);
            
            if (start === formatDate(startDate) && end === formatDate(today)) {
                btn.classList.add('active');
            }
        });
    }
}
