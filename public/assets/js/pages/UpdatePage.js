// Fichier : public/assets/js/pages/UpdatePage.js

import { sendWsMessage } from '../logic/websocket-service.js';

/**
 * Affiche le contenu de la page de mise à jour dans l'élément fourni.
 * @param {HTMLElement} element Le conteneur principal où injecter la page.
 */
export function renderUpdatePage(element) {
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
  fetchAndUpdateStatus();
}

/**
 * Récupère l'état de la mise à jour depuis l'API et met à jour l'affichage.
 */
async function fetchAndUpdateStatus() {
    const contentContainer = document.getElementById('update-content');
    try {
        const response = await fetch('index.php?route=update/status');
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
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
 */
function renderContent(container, data) {
    const { release_info, migration_needed, migration_sql } = data;
    const formattedSql = (migration_sql && Array.isArray(migration_sql)) ? migration_sql.join('\n\n') : 'Aucun script de migration.';

    let updateProcessHtml = '';
    if (!release_info.update_available && !migration_needed) {
        updateProcessHtml = `<p class="status-ok"><i class="fa-solid fa-check-circle"></i> Votre application et votre base de données sont à jour.</p>`;
    } else {
        updateProcessHtml = `
            <p>Une mise à jour est prête à être installée.</p>
            <ul>
                ${release_info.update_available ? `<li><strong>Nouveaux fichiers :</strong> Passage de la version ${release_info.local_version} à <strong>${release_info.remote_version}</strong>.</li>` : ''}
                ${migration_needed ? `<li class="status-warning"><i class="fa-solid fa-exclamation-triangle"></i> <strong>Migration de base de données :</strong> Des modifications de structure sont nécessaires.</li>` : ''}
            </ul>
            <button id="perform-update-btn" class="btn save-btn">Lancer la mise à jour complète</button>
        `;
    }

    container.innerHTML = `
        <div class="update-grid">
            <div class="update-card">
                <h3><i class="fa-solid fa-tags"></i> Version ${release_info.remote_version || 'N/A'} disponible</h3>
                <div class="release-notes">
                    <h4>Notes de version :</h4>
                    <div class="release-notes-content">${release_info.release_notes ? release_info.release_notes.replace(/\n/g, '<br>') : 'Non disponibles.'}</div>
                </div>
            </div>
            <div class="update-card">
                <h3><i class="fa-solid fa-cogs"></i> Processus de mise à jour</h3>
                <div class="update-process">${updateProcessHtml}</div>
            </div>
        </div>
    `;
    attachEventListeners();
}

/**
 * Attache les écouteurs d'événements aux boutons d'action de la page.
 */
function attachEventListeners() {
    const updateBtn = document.getElementById('perform-update-btn');
    if (updateBtn) {
        updateBtn.addEventListener('click', handleFullUpdate);
    }
}

/**
 * Gère le clic sur le bouton de mise à jour complète.
 */
async function handleFullUpdate(event) {
    const button = event.target;
    const resultsContainer = document.getElementById('update-results');
    const outputElement = document.getElementById('results-output');

    if (!confirm("Êtes-vous sûr de vouloir lancer la mise à jour ? L'application sera rechargée pour tous les utilisateurs connectés.")) {
        return;
    }

    button.disabled = true;
    button.textContent = 'Mise à jour en cours...';
    resultsContainer.style.display = 'block';
    outputElement.className = '';
    outputElement.textContent = 'Lancement du processus...';

    try {
        const response = await fetch('index.php?route=update/perform_full_update', { method: 'POST' });
        const result = await response.json();

        if (response.ok && result.success) {
            outputElement.classList.add('status-ok');
            outputElement.textContent = result.message;
            outputElement.textContent += "\n\n[FINALISATION] Envoi de la commande de rechargement à tous les clients...";
            
            sendWsMessage({ type: 'force_reload_all' });
            
            setTimeout(() => {
                outputElement.textContent += "\n\nMise à jour terminée ! Rechargement de la page dans 3 secondes...";
                setTimeout(() => window.location.reload(), 3000);
            }, 1000);

        } else {
            throw new Error(result.message || `Erreur HTTP ${response.status}`);
        }

    } catch (error) {
        outputElement.classList.add('status-error');
        outputElement.textContent = `ÉCHEC DE L'OPÉRATION :\n${error.message}`;
        button.disabled = false;
        button.textContent = 'Relancer la mise à jour';
    }
}
