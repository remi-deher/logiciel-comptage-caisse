// Fichier : public/assets/js/pages/AidePage.js

import { initializeAideLogic } from '../logic/aide-logic.js';

/**
 * Construit le HTML d'une carte d'aide à partir d'un objet de données.
 * @param {object} card - L'objet contenant les informations de la carte.
 * @returns {string} Le HTML de la carte.
 */
function buildHelpCard(card) {
    const linkButton = card.link 
        ? `<a href="${card.link}" class="btn help-btn-link"><i class="fa-solid fa-arrow-right"></i> Accéder</a>`
        : '';

    // Encode le contenu pour le passer sans risque à l'attribut data-content
    const encodedContent = encodeURIComponent(card.content);

    // Génère les étiquettes (tags)
    const tagsHtml = (card.tags || [])
        .map(tag => `<span class="help-card-tag">${tag}</span>`)
        .join('');

    return `
        <div class="help-card"
             data-title="${card.title}"
             data-icon="${card.icon}"
             data-content="${encodedContent}">
            
            <div class="help-card-header">
                <div class="help-card-icon"><i class="${card.icon}"></i></div>
                <h3>${card.title}</h3>
            </div>

            <div class="help-card-content">
                <p>${card.summary}</p>
            </div>
            
            <div class="help-card-tags">
                ${tagsHtml}
            </div>

            ${card.link ? `<div class="help-card-footer">${linkButton}</div>` : ''}
        </div>
    `;
}

export function renderAidePage(element) {
  // 1. Affiche la coquille de la page avec un message de chargement
  element.innerHTML = `
    <div class="container" id="help-page">
        <div class="help-header">
            <h2><i class="fa-solid fa-book-open"></i> Centre d'Aide</h2>
            <p>Trouvez des réponses à vos questions et découvrez comment tirer le meilleur parti de l'application.</p>
        </div>

        <div class="help-search-container">
            <i class="fa-solid fa-search"></i>
            <input type="text" id="help-search-input" placeholder="Rechercher un sujet (ex: clôture, réserve)...">
        </div>

        <div id="help-content-container">
            <p>Chargement du guide d'utilisation...</p>
        </div>

        <div id="help-modal" class="modal">
            <div class="modal-content">
                <span class="modal-close">&times;</span>
                <div id="help-modal-content"></div>
            </div>
        </div>
    </div>
  `;

  // 2. Lance la logique asynchrone pour charger le JSON et remplir la page
  async function initialize() {
      const contentContainer = element.querySelector('#help-content-container');
      try {
          const response = await fetch('assets/data/aide-content.json');
          if (!response.ok) throw new Error(`Impossible de charger le fichier d'aide (HTTP ${response.status})`);
          
          const helpData = await response.json();
          let finalHtml = '';

          helpData.categories.forEach(category => {
              finalHtml += `<h3 class="help-category-title">${category.title}</h3>`;
              finalHtml += '<div class="help-grid">';
              category.cards.forEach(card => {
                  finalHtml += buildHelpCard(card);
              });
              finalHtml += '</div>';
          });

          contentContainer.innerHTML = finalHtml;
          
          // La logique (barre de recherche, modale) est attachée après la génération du HTML
          initializeAideLogic();

      } catch (error) {
          console.error("Erreur lors du chargement de la page d'aide:", error);
          contentContainer.innerHTML = `<p class="error">${error.message}</p>`;
      }
  }
  
  initialize();
}
