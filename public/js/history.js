// public/js/history.js
// C'est le point d'entrée principal pour la logique de la page d'historique.
// Il importe les modules nécessaires et initialise la page.

import { initializeEventListeners } from './history/events.js';
import { loadHistoriqueData } from './history/api.js';

/**
 * Le script s'exécute lorsque le contenu de la page est entièrement chargé.
 */
document.addEventListener('DOMContentLoaded', () => {
    // On s'assure que le script ne s'exécute que sur la page d'historique
    // en vérifiant la présence d'un élément unique à cette page.
    if (!document.getElementById('history-page')) {
        return;
    }

    // 1. Initialise tous les écouteurs d'événements (clics, soumissions, etc.).
    // Toute la logique interactive est branchée ici.
    initializeEventListeners();

    // 2. Lance le premier chargement des données de l'historique en se basant
    // sur les paramètres actuels de l'URL.
    const initialParams = Object.fromEntries(new URLSearchParams(window.location.search).entries());
    loadHistoriqueData(initialParams);
});
