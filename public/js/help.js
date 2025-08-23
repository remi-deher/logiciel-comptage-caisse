/**
 * Module JavaScript pour la page d'Aide.
 */
document.addEventListener('DOMContentLoaded', function() {
    const helpPage = document.getElementById('help-page');
    if (!helpPage) return; // Ne s'exécute que sur la page d'aide

    const modal = document.getElementById('help-modal');
    const searchInput = document.getElementById('help-search-input'); // NOUVEAU
    const helpCards = document.querySelectorAll('.help-card'); // NOUVEAU

    // NOUVEAU : Fonction pour filtrer les cartes d'aide
    const filterCards = () => {
        const query = searchInput.value.toLowerCase();
        helpCards.forEach(card => {
            const title = card.dataset.title.toLowerCase();
            const content = card.dataset.content.toLowerCase();
            if (title.includes(query) || content.includes(query)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    };

    // NOUVEAU : Écouteur d'événement pour la barre de recherche
    if (searchInput) {
        searchInput.addEventListener('input', filterCards);
    }
    
    if (modal) {
        const modalContent = document.getElementById('help-modal-content');
        const closeModalBtn = modal.querySelector('.modal-close');

        // Modifié : Ne déclenche la modale que si la cible n'est pas un lien
        helpPage.addEventListener('click', function(event) {
            const card = event.target.closest('.help-card');
            // Vérifie que le clic n'est pas sur un lien à l'intérieur de la carte
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
                modal.classList.add('visible'); // On utilise une classe pour afficher
            }
        });

        if(closeModalBtn) {
            closeModalBtn.onclick = function() {
                modal.classList.remove('visible');
            }
        }
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.classList.remove('visible');
            }
        }
    }
});
