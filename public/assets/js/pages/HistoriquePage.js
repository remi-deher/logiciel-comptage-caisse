// Fichier : public/assets/js/pages/HistoriquePage.js

import { initializeHistoryLogic } from '../logic/history-logic.js';

export function renderHistoriquePage(element) {
  // On injecte la structure HTML de base de la page
  element.innerHTML = `
    <div class="container" id="history-page">
        <h2><i class="fa-solid fa-clock-rotate-left" style="color: #3498db;"></i> Historique des Comptages</h2>

        <div class="view-tabs">
            <a href="#comptages" class="tab-link active" data-view="comptages">Comptages</a>
            <a href="#retraits" class="tab-link" data-view="retraits">Synthèse des Retraits</a>
        </div>

        <div id="comptages-view" class="view-content active">
            <div class="filter-section">
                <h3>Filtres</h3>
                <form id="history-filter-form" class="filter-form">
                    <div class="form-group">
                        <label for="date_debut">Date de début :</label>
                        <input type="date" id="date_debut" name="date_debut">
                    </div>
                    <div class="form-group">
                        <label for="date_fin">Date de fin :</label>
                        <input type="date" id="date_fin" name="date_fin">
                    </div>
                    <div class="form-group">
                        <label for="recherche">Recherche :</label>
                        <input type="text" id="recherche" name="recherche" placeholder="Nom du comptage...">
                    </div>
                    <button type="submit" class="new-btn">Filtrer</button>
                    <button type="button" id="reset-filter-btn" class="action-btn" style="background-color: #7f8c8d;">Réinitialiser</button>
                </form>
            </div>
            
            <div class="history-grid">
                <p>Chargement des données de l'historique...</p>
            </div>
            <nav class="pagination-nav" style="margin-top: 20px;"></nav>
        </div>

        <div id="retraits-view" class="view-content">
             <div id="retraits-view-content">
                </div>
        </div>

        <div id="details-modal" class="modal">
            <div class="modal-content wide">
                <div id="modal-details-content"></div>
            </div>
        </div>
    </div>
  `;

  // Une fois le HTML en place, on lance la logique JavaScript associée
  initializeHistoryLogic();
}
