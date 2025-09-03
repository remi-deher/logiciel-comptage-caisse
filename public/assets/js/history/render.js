// public/js/history/render.js
// Ce module contient toutes les fonctions qui génèrent et insèrent du HTML dans le DOM.

import * as dom from './dom.js';
import * as utils from './utils.js';
import { state } from './state.js';
import { renderMiniChart, renderWithdrawalsChart, renderGlobalChart } from './charts.js';

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
 * Affiche le tableau de bord amélioré de la synthèse des retraits.
 * @param {Array<object>} historique - La liste complète des comptages de la période.
 */
export function renderWithdrawalsView(historique) {
    if (!document.getElementById('retraits-view')) return;

    // --- 1. Calcul des agrégats ---
    const byDenomination = {};
    const byCaisse = {};
    let totalRetire = 0;
    const allWithdrawals = [];

    historique.forEach(comptage => {
        for (const caisseId in comptage.caisses_data) {
            const caisseData = comptage.caisses_data[caisseId];
            if (caisseData.retraits && Object.keys(caisseData.retraits).length > 0) {
                for (const denomination in caisseData.retraits) {
                    const quantite = parseInt(caisseData.retraits[denomination] || 0);
                    if (quantite === 0) continue;

                    let valeur = 0;
                    if (globalConfig.denominations.billets[denomination]) {
                        valeur = globalConfig.denominations.billets[denomination];
                    } else if (globalConfig.denominations.pieces[denomination]) {
                        valeur = globalConfig.denominations.pieces[denomination];
                    }
                    
                    const montant = quantite * valeur;
                    totalRetire += montant;

                    allWithdrawals.push({
                        date: comptage.date_comptage,
                        caisse: globalConfig.nomsCaisses[caisseId],
                        denomination: denomination,
                        quantite: quantite,
                        valeurUnitaire: valeur,
                    });

                    if (!byDenomination[denomination]) {
                        byDenomination[denomination] = { quantite: 0, montant: 0, valeurUnitaire: valeur };
                    }
                    byDenomination[denomination].quantite += quantite;
                    byDenomination[denomination].montant += montant;
                    
                    const caisseNom = globalConfig.nomsCaisses[caisseId];
                    byCaisse[caisseNom] = (byCaisse[caisseNom] || 0) + montant;
                }
            }
        }
    });

    // --- 2. Affichage des KPIs ---
    const kpiContainer = document.getElementById('withdrawals-kpi-container');
    if (kpiContainer) {
        kpiContainer.innerHTML = `
            <div class="kpi-card-retrait">
                <h3>Montant Total Retiré</h3>
                <p>${utils.formatEuros(totalRetire)}</p>
            </div>
            <div class="kpi-card-retrait">
                <h3>Nb. Opérations</h3>
                <p>${allWithdrawals.length}</p>
            </div>`;
    }

    // --- 3. Affichage de la synthèse par Dénomination ---
    const byDenomTableContainer = document.getElementById('withdrawals-by-denomination-table');
    if (byDenomTableContainer) {
        let tableHtml = '<table class="info-table"><thead><tr><th>Dénomination</th><th>Quantité Totale</th><th>Montant Total</th></tr></thead><tbody>';
        if (Object.keys(byDenomination).length > 0) {
            const sortedDenominations = Object.entries(byDenomination).sort(([, a], [, b]) => b.valeurUnitaire - a.valeurUnitaire);
            for (const [nom, data] of sortedDenominations) {
                const label = data.valeurUnitaire >= 1 ? `${data.valeurUnitaire} ${globalConfig.currencySymbol}` : `${data.valeurUnitaire * 100} cts`;
                tableHtml += `
                    <tr>
                        <td>${label}</td>
                        <td>${data.quantite}</td>
                        <td>${utils.formatEuros(data.montant)}</td>
                    </tr>`;
            }
        } else {
            tableHtml += '<tr><td colspan="3">Aucun retrait trouvé.</td></tr>';
        }
        tableHtml += '</tbody></table>';
        byDenomTableContainer.innerHTML = tableHtml;
    }
    
    // --- 4. Appel pour le rendu du graphique ---
    renderWithdrawalsChart(byCaisse);

    // --- 5. Affichage du journal détaillé (Version Cartes Journalières) ---
    const logContainer = document.getElementById('withdrawals-log-container');
    if (logContainer) {
        if (allWithdrawals.length > 0) {
            const groupedByDate = allWithdrawals.reduce((acc, w) => {
                const dateKey = new Date(w.date).toISOString().split('T')[0];
                if (!acc[dateKey]) {
                    acc[dateKey] = {
                        total: 0,
                        operations: 0,
                        dateDisplay: new Date(w.date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
                        withdrawals: []
                    };
                }
                const montant = w.quantite * w.valeurUnitaire;
                acc[dateKey].total += montant;
                acc[dateKey].operations++;
                acc[dateKey].withdrawals.push(w);
                return acc;
            }, {});

            const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

            logContainer.innerHTML = sortedDates.map(dateKey => {
                const dayData = groupedByDate[dateKey];
                return `
                    <div class="day-card" data-date-key="${dateKey}">
                        <input type="checkbox" class="day-card-checkbox" title="Sélectionner ce jour">
                        <div class="day-card-header">
                            <i class="fa-solid fa-calendar-day"></i>
                            <span>${dayData.dateDisplay}</span>
                        </div>
                        <div class="day-card-body">
                            <div class="day-kpi">
                                <span>Total Retiré</span>
                                <strong>${utils.formatEuros(dayData.total)}</strong>
                            </div>
                            <div class="day-kpi">
                                <span>Opérations</span>
                                <strong>${dayData.operations}</strong>
                            </div>
                        </div>
                        <div class="day-card-footer">
                            <button class="action-btn-small view-day-details-btn">
                                <i class="fa-solid fa-magnifying-glass-chart"></i> Voir le détail
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            
            logContainer.dataset.groupedWithdrawals = JSON.stringify(groupedByDate);

        } else {
            logContainer.innerHTML = '<p>Aucun retrait détaillé à afficher.</p>';
        }
    }
}

/**
 * Met à jour l'état visuel (classe 'active') des boutons de filtre rapide.
 * @param {object} params - Les paramètres de l'URL actuelle.
 */
export function updateQuickFilterButtons(params) {
    if (!dom.quickFilterBtns) return;
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
