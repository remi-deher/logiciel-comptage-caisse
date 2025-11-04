// public/assets/js/logic/admin-logic.js

// --- IMPORT AJOUTÉ ---
import { sendWsMessage } from './websocket-service.js';

// --- API ---
async function fetchAdminData() {
    const response = await fetch('index.php?route=admin/dashboard_data');
    if (!response.ok) {
        if (response.status === 401) {
             console.warn('Accès non autorisé détecté. Redirection vers /login.');
             window.location.href = '/login';
        }
        throw new Error(`Erreur ${response.status}: Impossible de charger les données.`);
    }
    const data = await response.json();
    if (!data.success) {
        throw new Error(data.message || 'Impossible de charger les données de l\'administration.');
    }
    return data;
}

// --- Rendu ---
function renderAdminDashboard(container, data) {
    const caisseOptionsHtml = Object.entries(data.caisses).map(([id, nom]) => `<option value="${id}">${nom}</option>`).join('');
    const currencySymbol = data.currencySymbol || '€';

    // --- MODIFIER CETTE PARTIE ---
    const caissesHtml = data.caisses_details.map(caisse => {
        const id = caisse.id;
        const nom = caisse.nom_caisse;
        // Utilise fond_de_caisse (au lieu de fond_cible)
        const fondDeCaisse = parseFloat(caisse.fond_de_caisse || 0).toFixed(2); 

        return `
        <tr>
            <td data-label="Nom & Fond de Caisse">
                <form class="inline-form js-admin-action-form" method="POST" action="index.php?route=admin/action" style="display: grid; grid-template-columns: minmax(150px, 2fr) minmax(100px, 1fr) auto; gap: 10px; align-items: center;">
                    <input type="hidden" name="action" value="rename_caisse">
                    <input type="hidden" name="caisse_id" value="${id}">
                    <input type="text" name="caisse_name" value="${nom}" class="inline-input" aria-label="Nom de la caisse" placeholder="Nom Caisse">
                    <div class="input-with-symbol" style="display: flex; align-items: center; gap: 5px;">
                       <input type="number" step="0.01" min="0" name="fond_de_caisse" value="${fondDeCaisse}" class="inline-input" aria-label="Fond de caisse de référence" placeholder="0.00" style="text-align: right;">
                       <span>${currencySymbol}</span>
                    </div>
                    <button type="submit" class="action-btn-small save-btn" title="Enregistrer les modifications"><i class="fa-solid fa-save"></i></button>
                </form>
            </td>
            <td data-label="Actions">
                <form class="inline-form js-admin-action-form" method="POST" action="index.php?route=admin/action">
                     <input type="hidden" name="action" value="delete_caisse">
                     <input type="hidden" name="caisse_id" value="${id}">
                     <button type="submit" class="action-btn-small delete-btn" data-confirm="Êtes-vous sûr de vouloir supprimer la caisse '${nom}' ? Toutes ses données seront perdues !" title="Supprimer la caisse"><i class="fa-solid fa-trash-can"></i></button>
                </form>
            </td>
        </tr>
    `;}).join('');
    // --- FIN MODIFICATION ---


    // ... adminsHtml, terminauxHtml, minToKeepHtml (inchangés) ...
    const adminsHtml = Object.entries(data.admins).map(([username, details]) => `
        <tr>
            <td data-label="Utilisateur">${username}</td>
            <td data-label="Source">
                 <span class="status-tag ${details.sync_status === 'ok' ? 'status-ok' : (details.sync_status === 'mismatch' ? 'status-warning' : 'status-error')}">
                    ${details.in_db ? 'BDD' : ''}${details.in_db && details.in_fallback ? ' & ' : ''}${details.in_fallback ? 'Secours' : ''}
                    ${details.sync_status !== 'ok' ? ` (${details.sync_status.replace('_', ' ')})` : ''}
                 </span>
            </td>
        </tr>
    `).join('');

    const terminauxHtml = data.terminaux.map(terminal => {
        const caisseTerminalOptions = Object.entries(data.caisses).map(([id, nom]) =>
            `<option value="${id}" ${terminal.caisse_associee == id ? 'selected' : ''}>${nom}</option>`
        ).join('');
        return `
        <tr>
            <td data-label="Nom & Caisse">
                <form class="inline-form js-admin-action-form" method="POST" action="index.php?route=admin/action">
                    <input type="hidden" name="action" value="rename_terminal">
                    <input type="hidden" name="terminal_id" value="${terminal.id}">
                    <input type="text" name="terminal_name" value="${terminal.nom_terminal}" class="inline-input" aria-label="Nom du terminal" style="flex-grow: 2;">
                    <select name="caisse_id" class="inline-input">${caisseTerminalOptions}</select>
                    <button type="submit" class="action-btn-small new-btn"><i class="fa-solid fa-pencil"></i></button>
                </form>
            </td>
            <td data-label="Actions">
                <form class="inline-form js-admin-action-form" method="POST" action="index.php?route=admin/action">
                     <input type="hidden" name="action" value="delete_terminal">
                     <input type="hidden" name="terminal_id" value="${terminal.id}">
                     <button type="submit" class="action-btn-small delete-btn" data-confirm="Êtes-vous sûr de vouloir supprimer le terminal '${terminal.nom_terminal}' ?"><i class="fa-solid fa-trash-can"></i></button>
                </form>
            </td>
        </tr>
        `;}).join('');

    const allDenominations = { ...(data.denominations.billets || {}), ...(data.denominations.pieces || {}) };
    const sortedDenoms = Object.entries(allDenominations).sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
    const minToKeepHtml = sortedDenoms.map(([name, value]) => {
        const numericValue = parseFloat(value);
        const label = numericValue >= 1 ? `${numericValue} ${currencySymbol}` : `${numericValue * 100} cts`;
        const currentValue = data.min_to_keep[name] || '';
        return `
            <div class="form-group-inline">
                <label for="min_to_keep_${name}">${label}</label>
                <input type="number" id="min_to_keep_${name}" name="min_to_keep[${name}]" value="${currentValue}" placeholder="0" min="0">
            </div>
        `;}).join('');


    container.innerHTML = `
        <div class="admin-grid">
            <div class="admin-card admin-card-full-width">
                <h3><i class="fa-solid fa-cash-register"></i> Gestion des Caisses</h3>
                <div class="admin-card-content">
                    <table class="admin-table responsive-table"><thead><tr><th>Nom & Fond de Caisse de Référence</th><th>Actions</th></tr></thead><tbody>${caissesHtml}</tbody></table>
                </div>
                <div class="admin-card-footer">
                    <form class="inline-form js-admin-action-form" method="POST" action="index.php?route=admin/action">
                        <input type="hidden" name="action" value="add_caisse">
                        <input type="text" name="caisse_name" required placeholder="Nom de la nouvelle caisse" class="inline-input">
                        <button type="submit" class="action-btn-small save-btn"><i class="fa-solid fa-plus"></i> Ajouter</button>
                    </form>
                </div>
            </div>

            <div class="admin-card admin-card-full-width">
                <h3><i class="fa-solid fa-credit-card"></i> Gestion des TPE</h3>
                 <div class="admin-card-content">
                    <table class="admin-table responsive-table"><thead><tr><th>Nom & Caisse Associée</th><th>Actions</th></tr></thead><tbody>${terminauxHtml}</tbody></table>
                </div>
                <div class="admin-card-footer">
                     <form class="inline-form js-admin-action-form" method="POST" action="index.php?route=admin/action">
                        <input type="hidden" name="action" value="add_terminal">
                        <input type="text" name="terminal_name" required placeholder="Nom du nouveau TPE" class="inline-input" style="flex-grow: 2;">
                        <select name="caisse_id" required class="inline-input">
                            <option value="" disabled selected>Associer à une caisse...</option>
                            ${caisseOptionsHtml}
                        </select>
                        <button type="submit" class="action-btn-small save-btn"><i class="fa-solid fa-plus"></i></button>
                    </form>
                </div>
            </div>


            <div class="admin-card admin-card-full-width">
                <h3><i class="fa-solid fa-shield-halved"></i> Fond de Caisse Minimal (Dénominations)</h3>
                 <form class="js-admin-action-form" method="POST" action="index.php?route=admin/action">
                    <input type="hidden" name="action" value="update_min_to_keep">
                    <div class="admin-card-content">
                         <p>Définissez ici la quantité minimale de chaque dénomination à conserver dans les caisses après la clôture. Cela affine la suggestion de retrait.</p>
                        <div class="reserve-inputs-grid">
                            ${minToKeepHtml}
                        </div>
                    </div>
                    <div class="admin-card-footer">
                        <button type="submit" class="btn save-btn">Enregistrer les Minimums</button>
                    </div>
                </form>
            </div>

            <div class="admin-card admin-card-full-width">
                <h3><i class="fa-solid fa-users-cog"></i> Gestion des Administrateurs</h3>
                 <div class="admin-card-content">
                     <table class="admin-table responsive-table">
                        <thead><tr><th>Nom d'utilisateur</th><th>Source</th></tr></thead>
                        <tbody>${adminsHtml}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// --- Point d'entrée de la logique ---
export async function initializeAdminLogic() {
    const adminPageContainer = document.getElementById('admin-page-container');
    if (!adminPageContainer) return;

    try {
        const data = await fetchAdminData();
        renderAdminDashboard(adminPageContainer, data);

        // --- GESTIONNAIRE DE SOUMISSION MODIFIÉ ---
        adminPageContainer.addEventListener('submit', async (e) => {
            const form = e.target.closest('.js-admin-action-form');
            if (form) {
                e.preventDefault();
                const submitter = e.submitter;
                const confirmMessage = submitter?.dataset.confirm;

                if (confirmMessage && !confirm(confirmMessage)) {
                    return;
                }

                const formData = new FormData(form);
                const action = formData.get('action');

                // Si c'est l'action de mise à jour de la caisse, on intercepte avec fetch
                if (action === 'rename_caisse') {
                    if(submitter) submitter.disabled = true;
                    try {
                        const response = await fetch(form.getAttribute('action'), {
                            method: 'POST',
                            body: formData
                        });

                        // Si la requête réussit (même si elle retourne une erreur métier)
                        if (response.ok) {
                            // On envoie le message WebSocket
                            const caisseId = formData.get('caisse_id');
                            const fondDeCaisse = formData.get('fond_de_caisse');
                            
                            sendWsMessage({
                                type: 'master_fond_updated',
                                caisse_id: caisseId,
                                value: fondDeCaisse.replace(',', '.') // Assure un format correct
                            });
                            
                            // --- CORRECTION ---
                            // On attend 150ms AVANT de recharger, pour laisser le temps au message de partir
                            setTimeout(() => {
                                window.location.reload();
                            }, 150);
                            // --- FIN CORRECTION ---
                        } else {
                            throw new Error(`Erreur HTTP ${response.status}`);
                        }
                    } catch (error) {
                        console.error("Erreur lors de la mise à jour de la caisse:", error);
                        alert("Une erreur est survenue. Rechargement de la page.");
                        window.location.reload();
                    }
                } else {
                    // Pour toutes les autres actions (delete, add, etc.), on laisse la soumission classique
                    form.submit();
                }
            }
        });

    } catch (error) {
        console.error("Erreur chargement admin:", error);
        adminPageContainer.innerHTML = `<p class="error">${error.message}. Tentative de redirection...</p>`;
        setTimeout(() => { if (!window.location.pathname.endsWith('/login')) window.location.href = '/login'; }, 1500);
    }
}
