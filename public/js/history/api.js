// public/js/history/api.js
// Ce module est responsable de toute la communication avec le backend (API).

import * as dom from './dom.js';
import { state } from './state.js'; // <-- NOUVEL IMPORT : On importe l'état partagé
import {
    renderHistoriqueCards,
    renderPagination,
    renderWithdrawalsView,
    updateQuickFilterButtons
} from './render.js';
import { renderGlobalChart } from './charts.js';
import { updateComparisonToolbar } from './comparison.js';

/**
 * Charge les données de l'historique depuis le serveur en fonction des paramètres.
 * Met à jour toute l'interface utilisateur avec les nouvelles données.
 * @param {object} params - Les paramètres de la requête (dates, recherche, page).
 */
export function loadHistoriqueData(params) {
    // CORRIGÉ : On utilise l'objet 'state' pour réinitialiser la sélection
    state.selectedForComparison.length = 0;
    
    document.querySelectorAll('.history-card.selected').forEach(card => card.classList.remove('selected'));
    updateComparisonToolbar();

    const query = new URLSearchParams(params).toString();
    // On ajoute un timestamp pour éviter les problèmes de cache du navigateur
    fetch(`index.php?action=get_historique_data&${query}&_=${new Date().getTime()}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erreur HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            renderHistoriqueCards(data.historique);
            renderPagination(data.page_courante, data.pages_totales);
            renderGlobalChart(data.historique_complet);
            renderWithdrawalsView(data.historique_complet);
            if (dom.historyGrid) {
                dom.historyGrid.dataset.allComptages = JSON.stringify(data.historique_complet);
            }
            updateQuickFilterButtons(params);
        })
        .catch(error => console.error("Erreur de chargement de l'historique:", error));
}

/**
 * Envoie une requête au serveur pour supprimer un comptage spécifique.
 * @param {string} idToDelete - L'ID du comptage à supprimer.
 */
export function deleteComptage(idToDelete) {
    fetch('index.php?action=delete_historique_data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ id_a_supprimer: idToDelete })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Recharge les données pour refléter la suppression
            loadHistoriqueData(Object.fromEntries(new URLSearchParams(window.location.search).entries()));
        } else {
            alert(data.message || 'Erreur lors de la suppression.');
        }
    })
    .catch(error => console.error("Erreur lors de la suppression:", error));
}
