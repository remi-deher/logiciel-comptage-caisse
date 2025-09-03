// Fichier : public/assets/js/pages/StatistiquesPage.js

import { initializeStatsLogic } from '../logic/stats-logic.js';

export function renderStatistiquesPage(element) {
  // Injection de la structure HTML de la page
  element.innerHTML = `
    <div class="container" id="stats-page">
        <header class="page-header">
            <h1>Tableau de bord des statistiques</h1>
            <p class="subtitle">Analyse des données de comptage de caisse</p>
        </header>

        <div class="card filter-section">
            <h3>Filtres de recherche</h3>
            <form id="stats-filter-form" class="filter-form">
                <div class="input-group">
                    <label for="date_debut">Date de début :</label>
                    <input type="date" id="date_debut" name="date_debut">
                </div>
                <div class="input-group">
                    <label for="date_fin">Date de fin :</label>
                    <input type="date" id="date_fin" name="date_fin">
                </div>
                <button type="submit" class="filter-btn new-btn">Filtrer</button>
            </form>
        </div>

        <div class="card section-kpi">
            <h3>Indicateurs de performance (KPI)</h3>
            <div class="kpi-container">
                <p>Chargement des indicateurs...</p>
            </div>
        </div>
        
        <div class="card section-charts">
            <h3>Graphiques d'analyse</h3>
            <div class="chart-display">
                <div class="card chart-container">
                    <h2 id="chart-title">Répartition des ventes par caisse</h2>
                    <div id="mainChart">
                        <p>Chargement du graphique...</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  `;

  // Une fois le HTML en place, on lance la logique JavaScript associée
  initializeStatsLogic();
}
