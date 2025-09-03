// Fichier : public/assets/js/logic/history-logic.js

// --- Fonctions Utilitaires ---
const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant);
const formatDateFr = (dateString) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(dateString));

// --- API ---
async function fetchHistoriqueData(params) {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`index.php?route=historique/get_data&${query}`);
    if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status} lors de la récupération de l'historique.`);
    }
    return await response.json();
}

// --- Rendu (Affichage) ---
function renderCards(container, historique) {
    if (!historique || historique.length === 0) {
        container.innerHTML = '<p>Aucun enregistrement trouvé pour ces critères.</p>';
        return;
    }
    container.innerHTML = historique.map(comptage => {
        // Simplification du calcul pour l'exemple (la logique complète peut être réintégrée)
        const totalCompté = comptage.caisses_data ? Object.values(comptage.caisses_data).reduce((acc, caisse) => acc + parseFloat(caisse.fond_de_caisse || 0), 0) : 0;
        
        return `
        <div class="history-card" data-comptage-id="${comptage.id}">
            <div class="history-card-header">
                <h4>${comptage.nom_comptage}</h4>
                <div class="date"><i class="fa-regular fa-calendar"></i> ${formatDateFr(comptage.date_comptage)}</div>
            </div>
            <div class="history-card-body">
                <div class="summary-line">
                    <div><i class="fa-solid fa-coins icon-total"></i> Total Compté (Approximation)</div>
                    <span>${formatEuros(totalCompté)}</span>
                </div>
            </div>
            <div class="history-card-footer no-export">
                <button class="action-btn-small details-btn"><i class="fa-solid fa-layer-group"></i> Détails</button>
            </div>
        </div>
        `;
    }).join('');
}

function renderPagination(container, currentPage, totalPages) {
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    let paginationHtml = '<ul class="pagination">';
    for (let i = 1; i <= totalPages; i++) {
        paginationHtml += `<li class="${i === currentPage ? 'active' : ''}"><a href="#" data-page="${i}">${i}</a></li>`;
    }
    paginationHtml += '</ul>';
    container.innerHTML = paginationHtml;
}


// --- Point d'entrée de la logique de la page ---
export async function initializeHistoryLogic() {
    const historyGrid = document.querySelector('.history-grid');
    const paginationNav = document.querySelector('.pagination-nav');
    const filterForm = document.getElementById('history-filter-form');
    const resetBtn = document.getElementById('reset-filter-btn');

    // Fonction pour charger les données et mettre à jour la vue
    async function loadAndRender(params = {}) {
        try {
            historyGrid.innerHTML = '<p>Chargement...</p>';
            const data = await fetchHistoriqueData(params);
            renderCards(historyGrid, data.historique);
            renderPagination(paginationNav, data.page_courante, data.pages_totales);
        } catch (error) {
            historyGrid.innerHTML = `<p class="error">Erreur: ${error.message}</p>`;
        }
    }
    
    // Événements
    filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(filterForm);
        const params = Object.fromEntries(formData.entries());
        loadAndRender(params);
    });

    resetBtn.addEventListener('click', () => {
        filterForm.reset();
        loadAndRender();
    });
    
    paginationNav.addEventListener('click', (e) => {
        e.preventDefault();
        if (e.target.tagName === 'A') {
            const page = e.target.dataset.page;
            const formData = new FormData(filterForm);
            const params = Object.fromEntries(formData.entries());
            params.p = page;
            loadAndRender(params);
        }
    });

    // Chargement initial des données
    loadAndRender();
}
