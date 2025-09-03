// Fichier : public/assets/js/pages/ChangelogPage.js

/**
 * Récupère les données du changelog depuis l'API.
 */
async function fetchChangelogData() {
    // On appelle la route de l'API correspondante
    const response = await fetch('index.php?route=version/changelog');
    if (!response.ok) {
        throw new Error('La réponse du serveur pour le changelog était invalide.');
    }
    return await response.json();
}

/**
 * Affiche les données du changelog dans le conteneur fourni.
 * @param {HTMLElement} container L'élément où injecter le HTML du changelog.
 * @param {Array} releases Le tableau des releases récupéré de l'API.
 */
function renderTimeline(container, releases) {
    if (!releases || releases.length === 0) {
        container.innerHTML = '<p>Aucune information de version trouvée.</p>';
        return;
    }

    // Fonctions d'aide pour formater l'affichage (réplique la logique du PHP)
    const getReleaseTypeInfo = (bodyHtml) => {
        if (!bodyHtml) return { type: 'Mise à jour', icon: 'fa-tag', color: '#95a5a6' };
        const bodyLower = bodyHtml.toLowerCase();
        if (bodyLower.includes('nouvelle fonctionnalité') || bodyLower.includes('nouveau')) {
            return { type: 'Fonctionnalité', icon: 'fa-rocket', color: '#3498db' };
        }
        if (bodyLower.includes('correction') || bodyLower.includes('bug')) {
            return { type: 'Correction', icon: 'fa-bug', color: '#e74c3c' };
        }
        if (bodyLower.includes('amélioration') || bodyLower.includes('mise à jour')) {
            return { type: 'Amélioration', icon: 'fa-wrench', color: '#f39c12' };
        }
        return { type: 'Mise à jour', icon: 'fa-tag', color: '#95a5a6' };
    };

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Génère le HTML pour chaque release
    container.innerHTML = releases.map(release => {
        const typeInfo = getReleaseTypeInfo(release.body_html);
        return `
            <div class="timeline-item">
                <div class="timeline-icon" style="background-color: ${typeInfo.color};">
                    <i class="fa-solid ${typeInfo.icon}"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-content-header">
                        <h4>
                            <span class="release-type">${typeInfo.type}</span>
                            ${release.tag_name}
                        </h4>
                        <span class="release-date">${formatDate(release.published_at)}</span>
                    </div>
                    <div class="release-notes">
                        ${release.body_html || '<p>Aucune note de version détaillée.</p>'}
                    </div>
                    <a href="${release.html_url}" target="_blank" rel="noopener noreferrer" class="github-link">
                        <i class="fa-brands fa-github"></i> Voir sur GitHub
                    </a>
                </div>
            </div>
        `;
    }).join('');
}


/**
 * Fonction principale exportée pour le routeur.
 * Elle affiche la structure de la page puis lance la récupération des données.
 * @param {HTMLElement} element Le conteneur où injecter la page.
 */
export function renderChangelogPage(element) {
  // 1. Affiche la coquille de la page avec un message de chargement
  element.innerHTML = `
    <div class="container">
        <div class="changelog-main-header">
            <h2><i class="fa-solid fa-rocket"></i> Journal des Modifications</h2>
            <p>Suivez les dernières mises à jour, corrections de bugs et nouvelles fonctionnalités de l'application.</p>
        </div>
        <div class="changelog-timeline">
            <p>Chargement du journal des modifications...</p>
        </div>
    </div>
  `;

  // 2. Lance la logique asynchrone pour remplir la page
  async function initialize() {
      const timelineContainer = element.querySelector('.changelog-timeline');
      try {
          const releases = await fetchChangelogData();
          renderTimeline(timelineContainer, releases);
      } catch (error) {
          timelineContainer.innerHTML = `<p class="error">${error.message}</p>`;
      }
  }
  
  initialize();
}
