// Fichier : public/assets/js/pages/CalculateurPage.js (Corrigé - SyntaxError)

import { initializeCalculator } from '../logic/calculator-logic.js';

export function renderCalculateurPage(element) {
  // *** CORRECTION: Removed erroneous backticks around the template literal assignment ***
  element.innerHTML = `
    <div class="container" id="calculator-page">
        <div id="cloture-final-summary-banner-container"></div>

        <form id="caisse-form" action="#" method="post">
            <input type="hidden" name="action" value="save">
            <div class="tab-selector"></div>
            <div class="ecart-display-container"></div>
            <div id="cloture-recap-container" style="margin-bottom: 25px;"></div>
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
                <div class="modal-body" id="reserve-request-modal-body"></div>
            </div>
        </div>

        <div id="confirmation-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="confirmation-modal-title">Confirmation requise</h3>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body">
                    <p id="confirmation-modal-message"></p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn action-btn" id="confirmation-modal-cancel-btn">Annuler</button>
                    <button type="button" class="btn" id="confirmation-modal-confirm-btn">Confirmer</button>
                </div>
            </div>
        </div>

	<div id="cloture-summary-modal" class="modal">
            <div class="modal-content wide">
                <div class="modal-header">
                    <h3 id="cloture-summary-modal-title">Récapitulatif du Dépôt</h3>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body" id="cloture-summary-modal-body">
                </div>
                 <div class="modal-footer">
                    <button type="button" class="btn action-btn" id="cloture-summary-modal-close-btn">Fermer</button>
		</div>
            </div>
        </div>

         <div id="suggestions-modal" class="modal">
             <div class="modal-content wide">
                <div class="modal-header">
                    <h3>Détail des retraits d'espèces par caisse</h3>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body" id="suggestions-modal-body"></div>
                 <div class="modal-footer">
                    <button type="button" class="btn action-btn modal-close">Fermer</button>
                </div>
            </div>
        </div>
    </div>
  `;

  initializeCalculator();
}
