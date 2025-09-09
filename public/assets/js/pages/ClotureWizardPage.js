// Fichier : public/assets/js/pages/ClotureWizardPage.js

import { initializeClotureWizard } from '../logic/cloture-wizard-logic.js';

export function renderClotureWizardPage(element) {
  // On injecte la structure HTML de base de l'assistant.
  // Le contenu de chaque étape sera généré dynamiquement par la logique.
  element.innerHTML = `
    <div class="container" id="cloture-wizard-page">
        <div class="wizard-header">
            <h2><i class="fa-solid fa-flag-checkered"></i> Assistant de Clôture de Journée</h2>
            <div class="wizard-steps">
                <div class="step-item active" data-step="1"><span>1</span> Sélection</div>
                <div class="step-item" data-step="2"><span>2</span> Comptage</div>
                <div class="step-item" data-step="3"><span>3</span> Synthèse & Retraits</div>
                <div class="step-item" data-step="4"><span>4</span> Finalisation</div>
            </div>
        </div>

        <div class="wizard-content">
            <p>Chargement de l'assistant...</p>
        </div>

        <div class="wizard-navigation">
            <button id="wizard-cancel-btn" class="btn delete-btn"><i class="fa-solid fa-xmark"></i> Annuler</button>
            <div>
                <button id="wizard-prev-btn" class="btn" style="display: none;"><i class="fa-solid fa-arrow-left"></i> Précédent</button>
                <button id="wizard-next-btn" class="btn save-btn" disabled>Suivant <i class="fa-solid fa-arrow-right"></i></button>
            </div>
        </div>
    </div>
  `;

  // Une fois la structure en place, on lance la logique de l'assistant.
  initializeClotureWizard();
}
