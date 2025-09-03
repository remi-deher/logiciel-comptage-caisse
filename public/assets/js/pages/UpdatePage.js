	// Fichier : public/assets/js/pages/UpdatePage.js

/**
 * Affiche le contenu de la page de mise à jour dans l'élément fourni.
 * @param {HTMLElement} element Le conteneur principal où injecter la page.
 */
export function renderUpdatePage(element) {
  // Affiche une structure de base avec un état de chargement
  element.innerHTML = `
    <div class="container" id="update-page">
        <div class="update-header">
            <h2><i class="fa-solid fa-cloud-arrow-down"></i> Mise à jour de l'application</h2>
        </div>
        <div id="update-content">
            <p>Vérification de l'état de la mise à jour...</p>
        </div>
        <div id="update-results" class="update-results" style="display: none;">
            <h3>Résultat de l'opération</h3>
            <pre id="results-output"></pre>
        </div>
    </div>
  `;

  // Récupère le contenu et attache les écouteurs d'événements
  fetchAndUpdateStatus();
}

/**
 * Récupère l'état de la mise à jour depuis l'API et met à jour l'affichage.
 */
async function fetchAndUpdateStatus() {
    const contentContainer = document.getElementById('update-content');
    
    try {
        const response = await fetch('index.php?route=update/status');
        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }
        const data = await response.json();

        if (data.success) {
            renderContent(contentContainer, data);
        } else {
            throw new Error(data.message || 'Impossible de récupérer le statut de la mise à jour.');
        }

    } catch (error) {
        contentContainer.innerHTML = `<div class="error-box"><p>Erreur: ${error.message}</p></div>`;
    }
}

/**
 * Génère le HTML du contenu principal à partir des données de l'API.
 * @param {HTMLElement} container Le conteneur où injecter le HTML.
 * @param {object} data Les données reçues de l'API (release_info, migration_needed, etc.).
 */
function renderContent(container, data) {
    const { release_info, migration_needed, migration_sql } = data;
    
    // Formatte le SQL pour un affichage propre
    const formattedSql = migration_sql.join('\n\n');

    container.innerHTML = `
        <div class="update-grid">
            <div class="update-card">
                <h3><i class="fa-solid fa-tags"></i> Version ${release_info.remote_version || 'N/A'}</h3>
                <div class="release-notes">
                    <h4>Notes de version :</h4>
                    <pre>${release_info.release_notes || 'Non disponibles.'}</pre>
                </div>
            </div>

            <div class="update-card">
                <h3><i class="fa-solid fa-cogs"></i> Processus de mise à jour</h3>
                <div class="update-process">
                    ${migration_needed ? `
                        <h4>1. Sauvegarde de la base de données</h4>
                        <p>Une sauvegarde complète sera créée avant toute modification.</p>
                        <h4>2. Migration du schéma</h4>
                        <p class="status-warning"><i class="fa-solid fa-exclamation-triangle"></i> Une migration de la base de données est nécessaire. Le script suivant sera exécuté :</p>
                        <pre class="sql-code">${formattedSql}</pre>
                        <button id="perform-migration-btn" class="btn save-btn">Lancer la migration</button>
                    ` : `
                        <p class="status-ok"><i class="fa-solid fa-check-circle"></i> Votre base de données est à jour.</p>
                        <h4>Mise à jour des fichiers</h4>
                        <p>Si une nouvelle version est disponible, les fichiers peuvent être mis à jour via Git. Cette action n'est pas encore implémentée dans cette interface.</p>
                        `}
                </div>
            </div>
        </div>
    `;

    // Attache les écouteurs d'événements aux nouveaux boutons
    attachEventListeners();
}

/**
 * Attache les écouteurs d'événements aux boutons d'action de la page.
 */
function attachEventListeners() {
    const migrationBtn = document.getElementById('perform-migration-btn');
    if (migrationBtn) {
        migrationBtn.addEventListener('click', handleMigration);
    }
    // L'écouteur pour le bouton git-pull pourrait être ajouté ici
}

/**
 * Gère le clic sur le bouton de migration : demande confirmation,
 * appelle l'API et affiche le résultat.
 */
async function handleMigration(event) {
    const button = event.target;
    const resultsContainer = document.getElementById('update-results');
    const outputElement = document.getElementById('results-output');

    if (!confirm("Êtes-vous sûr de vouloir lancer la MIGRATION ? Une sauvegarde sera effectuée au préalable.")) {
        return;
    }

    // Désactive le bouton et affiche un message de chargement
    button.disabled = true;
    button.textContent = 'Migration en cours...';
    resultsContainer.style.display = 'block';
    outputElement.className = '';
    outputElement.textContent = 'Lancement de la sauvegarde et de la migration...';

    try {
        const response = await fetch('index.php?route=update/perform_migration', { method: 'POST' });
        const result = await response.json();

        if (result.success) {
            outputElement.classList.add('status-ok');
            outputElement.textContent = result.message;
            button.textContent = 'Terminé !';
            // Rafraîchit l'état pour montrer que la migration n'est plus nécessaire
            fetchAndUpdateStatus(); 
        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        outputElement.classList.add('status-error');
        outputElement.textContent = `Échec de l'opération :\n${error.message}`;
        button.disabled = false;
        button.textContent = 'Relancer la migration';
    }
}
