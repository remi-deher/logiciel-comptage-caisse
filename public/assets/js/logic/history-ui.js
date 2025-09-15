// Fichier : public/assets/js/logic/history-logic.js (Refactorisé)

// Imports des modules spécialisés
import * as service from './history-service.js';
import * as ui from './history-ui.js';
import { attachEventListeners } from './history-events.js';

// État global de la page d'historique
const state = {
    fullHistoryData: [],
    config: {},
    withdrawalsByDay: {},
    currentParams: {}
};

/**
 * Fonction principale pour charger et afficher les données de la page.
 * @param {object} params - Paramètres de filtre et de pagination.
 */
async function loadAndRender(params = {}) {
    state.currentParams = params;
    const historyPage = document.getElementById('history-page');
    const historyGridContainer = historyPage.querySelector('.history-grid');
    const retraitsContentContainer = historyPage.querySelector('#retraits-view-content');
    const paginationNav = historyPage.querySelector('.pagination-nav');
    
    try {
        historyGridContainer.innerHTML = '<p>Chargement...</p>';
        retraitsContentContainer.innerHTML = '<p>Chargement...</p>';

        const { config, history } = await service.fetchHistoriqueData(params);
        state.config = config;
        state.fullHistoryData = history.historique_complet || [];
        
        // Rendu des différentes parties de l'UI
        ui.renderCards(historyGridContainer, history.historique, config);
        ui.renderPagination(paginationNav, history.page_courante, history.pages_totales);

        state.withdrawalsByDay = service.processWithdrawalData(state.fullHistoryData, config.denominations);
        ui.renderRetraitsView(retraitsContentContainer, state.withdrawalsByDay, config);
        
    } catch (error) {
        console.error("Erreur lors du chargement de l'historique :", error);
        historyGridContainer.innerHTML = `<p class="error">${error.message}</p>`;
    }
}

/**
 * Point d'entrée pour initialiser la logique de la page d'historique.
 */
export function initializeHistoryLogic() {
    const historyPage = document.getElementById('history-page');
    if (!historyPage) return;

    // Lancer le premier chargement des données
    loadAndRender();

    // Attacher tous les écouteurs d'événements
    attachEventListeners(historyPage, state, loadAndRender);
}
