// Fichier : public/assets/js/pages/CalculateurPage.js

import { initializeCalculator } from '../logic/calculator-logic.js';

export function renderCalculateurPage(element) {
  element.innerHTML = `
    <div class="container" id="calculator-page">
        <div id="cloture-final-summary-banner-container"></div>

        <form id="caisse-form" action="#" method="post">
            <input type="hidden" name="action" value="save">
            <div class="tab-selector"></div>
            <div class="ecart-display-container"></div>
            
            <div id="cloture-details-container"></div>
            <div id="cloture-recap-container"></div>

            <div id="caisses-content-container"></div>
            
            <div class="save-section">
                <h3>Enregistrer le comptage</h3>
                <div class="form-group">
                    <label for="nom_comptage">Donnez un nom à ce comptage</label>
                    <input type="text" id="nom_comptage" name="nom_comptage">
                </div>
                <div class="form-group" style="margin-top: 10px;">
                    <label for="explication">Explication (optionnel)</label>
                    <textarea id="explication" name="explication" rows="3" placeholder="Ex: jour de marché, etc."></textarea>
                </div>
                <div class="button-group">
                    <button type="submit" class="save-btn">Enregistrer le Comptage</button>
                    <div id="autosave-status" class="autosave-status"></div>
                </div>
            </div>
        </form>

        <div id="reserve-request-modal" class="modal">
            <div class="modal-content wide">
                <div class="modal-header">
                    <h3>Effectuer une demande à la Réserve</h3>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body" id="reserve-request-modal-body">
                    </div>
            </div>
        </div>
    </div>
  `;

  initializeCalculator();
}
