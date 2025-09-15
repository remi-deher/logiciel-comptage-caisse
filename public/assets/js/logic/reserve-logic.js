// Fichier : public/assets/js/logic/reserve-logic.js (Refactorisé)

// Imports des modules spécialisés
import * as service from './reserve-service.js';
import * as ui from './reserve-ui.js';
import { attachEventListeners } from './reserve-events.js';

// État global de la page (uniquement la config, le reste est géré localement)
const state = {
    config: {}
};

/**
 * Fonction principale pour charger et afficher toutes les données de la page.
 */
async function loadAndRender() {
    const reservePage = document.getElementById('reserve-page');
    if (!reservePage) return;

    const statusGrid = document.getElementById('reserve-denominations-grid');
    const demandesList = document.getElementById('demandes-en-attente-list');
    const historiqueList = document.getElementById('historique-list');

    try {
        statusGrid.innerHTML = '<p>Chargement...</p>';
        demandesList.innerHTML = '<p>Chargement...</p>';
        historiqueList.innerHTML = '<p>Chargement...</p>';
        
        const data = await service.fetchReserveData();
        
        // On utilise les fonctions du module UI pour afficher les données
        ui.renderReserveStatus(statusGrid, data.reserve_status, state.config);
        ui.renderDemandes(demandesList, data.demandes_en_attente, state.config);
        ui.renderHistorique(historiqueList, data.historique, state.config);

    } catch (error) {
        const errorContainer = document.getElementById('reserve-status-section');
        if (errorContainer) {
            errorContainer.innerHTML = `<p class="error">${error.message}</p>`;
        }
    }
}

/**
 * Point d'entrée pour initialiser la logique de la page de la réserve.
 */
export async function initializeReserveLogic() {
    const reservePage = document.getElementById('reserve-page');
    if (!reservePage) return;

    try {
        // 1. Charger la configuration de l'application
        const configResponse = await fetch('index.php?route=calculateur/config');
        state.config = await configResponse.json();

        // 2. Générer le formulaire de demande (qui dépend de la config)
        const formContainer = document.getElementById('demande-form-container');
        ui.renderDemandeForm(formContainer, state.config);

        // 3. Charger toutes les données dynamiques et les afficher
        await loadAndRender();

        // 4. Attacher tous les écouteurs d'événements
        attachEventListeners(reservePage, state, loadAndRender);

    } catch (error) {
        reservePage.innerHTML = `<div class="container error"><p>Impossible de charger la configuration : ${error.message}</p></div>`;
    }
}
