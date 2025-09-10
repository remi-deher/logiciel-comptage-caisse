// Fichier : public/assets/js/logic/admin-logic.js

// --- API ---
async function fetchAdminData() {
    const response = await fetch('index.php?route=admin/dashboard_data');
    if (!response.ok) {
        // Si la session a expiré ou si l'utilisateur n'est pas admin, l'API renverra une erreur
        // (généralement 401 ou 403, gérée par AuthController::checkAuth()).
        throw new Error('Accès non autorisé ou erreur serveur. Veuillez vous reconnecter.');
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

    const caissesHtml = Object.entries(data.caisses).map(([id, nom]) => `
        <tr>
            <td data-label="Nom">
                <form class="inline-form js-admin-action-form" method="POST" action="index.php?route=admin/action">
                    <input type="hidden" name="action" value="rename_caisse">
                    <input type="hidden" name="caisse_id" value="${id}">
                    <input type="text" name="caisse_name" value="${nom}" class="inline-input" aria-label="Nom de la caisse">
                    <button type="submit" class="action-btn-small new-btn"><i class="fa-solid fa-pencil"></i> Modifier</button>
                </form>
            </td>
            <td data-label="Actions">
                <form class="inline-form js-admin-action-form" method="POST" action="index.php?route=admin/action">
                     <input type="hidden" name="action" value="delete_caisse">
                     <input type="hidden" name="caisse_id" value="${id}">
                     <button type="submit" class="action-btn-small delete-btn" data-confirm="Êtes-vous sûr de vouloir supprimer cette caisse ?"><i class="fa-solid fa-trash-can"></i></button>
                </form>
            </td>
        </tr>
    `).join('');

    const adminsHtml = Object.entries(data.admins).map(([username, details]) => `
        <tr>
            <td data-label="Utilisateur">${username}</td>
            <td data-label="Statut"><span class="status-tag status-ok">${details.in_db ? 'BDD' : ''} ${details.in_fallback ? 'Secours' : ''}</span></td>
        </tr>
    `).join('');

    // --- DÉBUT DU BLOC POUR LES TPE ---
    const terminauxHtml = data.terminaux.map(terminal => {
        // Pour chaque terminal, on crée une liste d'options pour le <select> en présélectionnant la bonne caisse
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
                     <button type="submit" class="action-btn-small delete-btn" data-confirm="Êtes-vous sûr de vouloir supprimer ce terminal ?"><i class="fa-solid fa-trash-can"></i></button>
                </form>
            </td>
        </tr>
        `;
    }).join('');
    // --- FIN DU BLOC POUR LES TPE ---


    container.innerHTML = `
        <div class="admin-grid">
            <div class="admin-card">
                <h3><i class="fa-solid fa-cash-register"></i> Gestion des Caisses</h3>
                <div class="admin-card-content">
                    <table class="admin-table"><tbody>${caissesHtml}</tbody></table>
                </div>
                <div class="admin-card-footer">
                    <form class="inline-form js-admin-action-form" method="POST" action="index.php?route=admin/action">
                        <input type="hidden" name="action" value="add_caisse">
                        <input type="text" name="caisse_name" required placeholder="Nom de la nouvelle caisse" class="inline-input">
                        <button type="submit" class="action-btn-small save-btn"><i class="fa-solid fa-plus"></i> Ajouter</button>
                    </form>
                </div>
            </div>
            
            <div class="admin-card">
                <h3><i class="fa-solid fa-credit-card"></i> Gestion des TPE</h3>
                <div class="admin-card-content">
                    <table class="admin-table"><tbody>${terminauxHtml}</tbody></table>
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
                <h3><i class="fa-solid fa-users-cog"></i> Gestion des Administrateurs</h3>
                <div class="admin-card-content">
                    <table class="admin-table">
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

        // Attache un gestionnaire d'événements unique pour tous les formulaires
        adminPageContainer.addEventListener('submit', (e) => {
            const form = e.target.closest('.js-admin-action-form');
            if (form) {
                e.preventDefault();
                const confirmMessage = e.submitter?.dataset.confirm;
                if (confirmMessage && !confirm(confirmMessage)) {
                    return; // Annule la soumission si l'utilisateur dit non
                }
                
                // Pour la simplicité, on soumet le formulaire de manière classique,
                // ce qui provoquera un rechargement de la page admin.
                form.submit();
            }
        });

    } catch (error) {
        // Si l'API renvoie une erreur d'autorisation, on redirige vers la page de login
        window.location.href = '/login';
    }
}
