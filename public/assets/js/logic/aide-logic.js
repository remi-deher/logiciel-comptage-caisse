// Fichier : public/assets/js/logic/aide-logic.js

/**
 * Initialise la logique interactive de la page d'aide.
 */
export function initializeAideLogic() {
    const helpPage = document.getElementById('help-page');
    if (!helpPage) return;

    const modal = document.getElementById('help-modal');
    const searchInput = document.getElementById('help-search-input');
    const helpCards = document.querySelectorAll('.help-card');

    // Fonction pour filtrer les cartes d'aide
    const filterCards = () => {
        const query = searchInput.value.toLowerCase();
        helpCards.forEach(card => {
            const title = (card.dataset.title || '').toLowerCase();
            const content = (card.dataset.content || '').toLowerCase();
            if (title.includes(query) || content.includes(query)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    };

    // Attache l'écouteur à la barre de recherche
    if (searchInput) {
        searchInput.addEventListener('input', filterCards);
    }
    
    // Logique d'affichage de la modale
    if (modal) {
        const modalContent = document.getElementById('help-modal-content');
        const closeModalBtn = modal.querySelector('.modal-close');

        helpPage.addEventListener('click', function(event) {
            const card = event.target.closest('.help-card');
            // Ne déclenche la modale que si le clic n'est pas sur un lien à l'intérieur de la carte
            if (card && !event.target.closest('.help-btn-link')) {
                const title = card.dataset.title;
                const iconClass = card.dataset.icon;
                const content = card.dataset.content;

                let html = `<div class="modal-header">
                                <div class="help-card-icon"><i class="${iconClass}"></i></div>
                                <h3>${title}</h3>
                            </div>`;
                html += content;

                modalContent.innerHTML = html;
                modal.classList.add('visible');
            }
        });

        if(closeModalBtn) {
            closeModalBtn.onclick = () => modal.classList.remove('visible');
        }
        
        // Ferme la modale si on clique sur le fond
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.remove('visible');
            }
        });
    }
}
