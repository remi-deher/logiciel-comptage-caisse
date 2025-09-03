// Fichier : public/assets/js/logic/history-logic.js (Correction finale avec stopPropagation)

// --- Fonctions Utilitaires ---
const log = (message, ...details) => console.log(`[Historique Log] %c${message}`, 'color: #3498db; font-weight: bold;', ...details);
const logSuccess = (message, ...details) => console.log(`[Historique Log] %c${message}`, 'color: #27ae60; font-weight: bold;', ...details);
const logError = (message, ...details) => console.error(`[Historique Log] %c${message}`, 'color: #c0392b; font-weight: bold;', ...details);
const logEvent = (message, event) => console.log(`[Historique Event] %c${message}`, 'color: #f39c12;', event);


// --- Variables globales pour la page ---
let fullHistoryData = [];
let config = {};

const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(montant);
const formatDateFr = (dateString) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(dateString));

// --- API ---
async function fetchHistoriqueData(params) {
    log('Début de la récupération des données...', { params });
    try {
        const configPromise = fetch('index.php?route=calculateur/config').then(res => res.json());
        const historyPromise = fetch(`index.php?route=historique/get_data&${new URLSearchParams(params)}`).then(res => res.json());

        const [conf, history] = await Promise.all([configPromise, historyPromise]);
        config = conf;
        logSuccess('Configuration chargée.', config);

        if (!history.historique) {
            throw new Error(`La réponse de l'API pour l'historique est invalide.`);
        }
        fullHistoryData = history.historique_complet || [];
        logSuccess('Données de l\'historique chargées.', history);
        return history;
    } catch (error) {
        logError('Erreur lors de la récupération des données API.', error);
        throw error;
    }
}

// --- Rendu (Affichage) ---
function renderCards(container, historique) {
    log('Début du rendu des cartes de comptage.');
    if (!historique || historique.length === 0) {
        container.innerHTML = '<p class="text-center" style="padding: 20px;">Aucun enregistrement trouvé pour ces critères.</p>';
        log('Aucune carte à afficher.');
        return;
    }
    container.innerHTML = historique.map(comptage => {
        let totalVentes = 0;
        if (comptage.caisses_data) {
            totalVentes = Object.values(comptage.caisses_data).reduce((acc, caisse) => acc + (parseFloat(caisse.ventes) || 0), 0);
        }
        return `
        <div class="history-card" data-comptage-id="${comptage.id}">
            <div class="history-card-header"><h4>${comptage.nom_comptage}</h4><div class="date">${formatDateFr(comptage.date_comptage)}</div></div>
            <div class="history-card-body"><div class="summary-line"><div>Total Ventes</div><span>${formatEuros(totalVentes)}</span></div></div>
            <div class="history-card-footer">
                <button class="action-btn-small details-btn" data-comptage-id="${comptage.id}">Détails</button>
                <button class="action-btn-small delete-btn" data-comptage-id="${comptage.id}">Supprimer</button>
            </div>
        </div>`;
    }).join('');
    logSuccess(`${historique.length} carte(s) affichée(s).`);
}

function renderPagination(container, currentPage, totalPages) {
    log('Mise à jour de la pagination.', { currentPage, totalPages });
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    let html = '<ul class="pagination">';
    html += `<li class="${currentPage === 1 ? 'disabled' : ''}"><a href="#" data-page="${currentPage - 1}">&laquo;</a></li>`;
    for (let i = 1; i <= totalPages; i++) { html += `<li class="${i === currentPage ? 'active' : ''}"><a href="#" data-page="${i}">${i}</a></li>`; }
    html += `<li class="${currentPage === totalPages ? 'disabled' : ''}"><a href="#" data-page="${currentPage + 1}">&raquo;</a></li>`;
    html += '</ul>';
    container.innerHTML = html;
}

function renderModalContent(container, comptageId) {
    log(`Affichage de la modale pour le comptage ID: ${comptageId}`);
    const comptage = fullHistoryData.find(c => c.id.toString() === comptageId.toString());
    if(!comptage) { logError("Comptage non trouvé pour la modale."); container.innerHTML = "Erreur: détails non trouvés."; return; }
    const caissesHtml = Object.entries(comptage.caisses_data).map(([caisse_id, data]) => `<h4>${config.nomsCaisses[caisse_id] || `Caisse ${caisse_id}`}</h4><ul class="summary-list"><li>...</li></ul>`).join('');
    container.innerHTML = `<div class="modal-header"><h3>${comptage.nom_comptage}</h3><span class="modal-close">&times;</span></div><div class="modal-body">${caissesHtml}</div>`;
}

function renderRetraitsView(container) {
    log('Affichage de la vue "Synthèse des Retraits".');
    container.innerHTML = `
        <div class="withdrawals-header"><h3>Synthèse des Retraits</h3></div>
        <div style="padding: 20px; text-align: center; background-color: var(--color-surface-alt); border-radius: 8px;">
             <p>Cette fonctionnalité est en cours de développement.</p>
        </div>`;
}

// --- Point d'entrée de la logique de la page ---
export async function initializeHistoryLogic() {
    log('Initialisation de la logique de la page Historique.');

    const historyPage = document.getElementById('history-page');
    if (!historyPage) {
        logError("L'élément principal '#history-page' n'a pas été trouvé. Le script ne peut pas continuer.");
        return;
    }

    const historyGrid = historyPage.querySelector('.history-grid');
    const paginationNav = historyPage.querySelector('.pagination-nav');
    const filterForm = historyPage.querySelector('#history-filter-form');
    const resetBtn = historyPage.querySelector('#reset-filter-btn');
    const detailsModal = historyPage.querySelector('#details-modal');
    const modalContent = historyPage.querySelector('#modal-details-content');
    const viewTabs = historyPage.querySelector('.view-tabs');
    const comptagesView = historyPage.querySelector('#comptages-view');
    const retraitsView = historyPage.querySelector('#retraits-view');
    const retraitsContentContainer = historyPage.querySelector('#retraits-view-content');

    if (!viewTabs) {
        logError("La barre d'onglets '.view-tabs' est introuvable !");
        return;
    }
    logSuccess("Tous les éléments du DOM ont été trouvés.");

    let currentParams = {};

    async function loadAndRender(params = {}) {
        currentParams = params;
        const historyGridContainer = comptagesView.querySelector('.history-grid');
        try {
            historyGridContainer.innerHTML = '<p>Chargement...</p>';
            const data = await fetchHistoriqueData(params);
            renderCards(historyGridContainer, data.historique);
            renderPagination(paginationNav, data.page_courante, data.pages_totales);
        } catch (error) {
            historyGridContainer.innerHTML = `<p class="error">Erreur: ${error.message}</p>`;
        }
    }

    log('Attachement des gestionnaires d\'événements...');

    // Onglets de navigation
    viewTabs.addEventListener('click', (e) => {
        logEvent('Clic détecté sur la barre d\'onglets.', e);
        const tab = e.target.closest('.tab-link');

        if (!tab) return;
        
        // On empêche le comportement par défaut du lien ET on arrête la propagation
        // pour que le routeur global ne s'en mêle pas. C'EST LA CORRECTION CLÉ.
        e.preventDefault();
        e.stopPropagation();

        if (tab.classList.contains('active')) {
            log('L\'onglet cliqué est déjà actif. Action ignorée.');
            return;
        }

        const viewToShow = tab.dataset.view;
        log(`Tentative de basculer vers la vue: "${viewToShow}"`);

        viewTabs.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        log(`Onglet "${viewToShow}" marqué comme actif.`);

        comptagesView.classList.remove('active');
        retraitsView.classList.remove('active');

        if (viewToShow === 'retraits') {
            retraitsView.classList.add('active');
            logSuccess('Contenu "Retraits" affiché.');
        } else {
            comptagesView.classList.add('active');
            logSuccess('Contenu "Comptages" affiché.');
        }
    });

    // ... (les autres gestionnaires d'événements restent les mêmes)
    filterForm.addEventListener('submit', (e) => { e.preventDefault(); logEvent('Filtre soumis.'); loadAndRender(Object.fromEntries(new FormData(filterForm).entries())); });
    resetBtn.addEventListener('click', () => { logEvent('Filtres réinitialisés.'); filterForm.reset(); loadAndRender(); });
    paginationNav.addEventListener('click', (e) => { e.preventDefault(); const link = e.target.closest('a'); if (link && !link.parentElement.classList.contains('disabled')) { loadAndRender({ ...currentParams, p: link.dataset.page }); }});
    historyPage.addEventListener('click', async (e) => { const detailsBtn = e.target.closest('.details-btn'); if (detailsBtn) { logEvent('Bouton Détails cliqué'); renderModalContent(modalContent, detailsBtn.dataset.comptageId); detailsModal.classList.add('visible'); }});
    detailsModal.addEventListener('click', (e) => { if (e.target.classList.contains('modal-close') || e.target.id === 'details-modal') { logEvent('Fermeture modale.'); detailsModal.classList.remove('visible'); }});

    logSuccess('Tous les gestionnaires d\'événements sont attachés.');

    // --- Démarrage ---
    renderRetraitsView(retraitsContentContainer);
    loadAndRender();
}
