// Fichier : public/assets/js/pages/AdminPage.js

// On importe la fonction de logique depuis le fichier dédié
import { initializeAdminLogic } from '../logic/admin-logic.js';

/**
 * Fonction de rendu pour la page d'administration.
 * Elle affiche la structure de base et appelle la logique pour la remplir.
 * @param {HTMLElement} element Le conteneur où injecter la page.
 */
export function renderAdminPage(element) {
  // Affiche la coquille de la page avec un message de chargement
  element.innerHTML = `
    <div class="container" id="admin-page">
        <div class="admin-header">
            <h2><i class="fa-solid fa-toolbox"></i>Panneau d'Administration</h2>
        </div>
        
        <div id="admin-page-container">
            <p>Chargement des données d'administration...</p>
        </div>
    </div>
  `;

  // On lance la logique qui va remplir le conteneur
  initializeAdminLogic();
}
