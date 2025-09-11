// Fichier : public/assets/js/logic/aide-logic.js (Mis à jour pour le contenu encodé)

export function initializeAideLogic() {
    const helpPage = document.getElementById('help-page');
    if (!helpPage) return;

    const modal = document.getElementById('help-modal');
    const searchInput = document.getElementById('help-search-input');
    const helpCards = document.querySelectorAll('.help-card');

    const filterCards = () => {
        const query = searchInput.value.toLowerCase();
        helpCards.forEach(card => {
            const title = (card.dataset.title || '').toLowerCase();
            const summary = (card.querySelector('p')?.textContent || '').toLowerCase();
            if (title.includes(query) || summary.includes(query)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    };

    if (searchInput) {
        searchInput.addEventListener('input', filterCards);
    }
    
    if (modal) {
        const modalContent = document.getElementById('help-modal-content');
        const closeModalBtn = modal.querySelector('.modal-close');

        helpPage.addEventListener('click', function(event) {
            const card = event.target.closest('.help-card');
            if (card && !event.target.closest('.help-btn-link')) {
                const title = card.dataset.title;
                const iconClass = card.dataset.icon;
                // CORRECTION : On décode le contenu avant de l'afficher
                const content = decodeURIComponent(card.dataset.content);

                let html = `<div class="modal-header">
                                <h3><i class="${iconClass}"></i> ${title}</h3>
                            </div>`;
                html += `<div class="modal-body">${content}</div>`;

                modalContent.innerHTML = html;
                modal.classList.add('visible');
            }
        });

        if(closeModalBtn) {
            closeModalBtn.onclick = () => modal.classList.remove('visible');
        }
        
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.remove('visible');
            }
        });
    }
}
