// Fichier : public/assets/js/logic/aide-logic.js

export function initializeAideLogic() {
    const helpPage = document.getElementById('help-page');
    if (!helpPage) return;

    const modal = document.getElementById('help-modal');
    const searchInput = document.getElementById('help-search-input');
    const helpCards = document.querySelectorAll('.help-card');
    const originalCardContent = new Map(); // Pour stocker le contenu original des cartes

    // Stocke le contenu initial pour pouvoir réinitialiser le surlignage
    helpCards.forEach(card => {
        const titleElement = card.querySelector('h3');
        const summaryElement = card.querySelector('p');
        originalCardContent.set(card, {
            title: titleElement.innerHTML,
            summary: summaryElement.innerHTML
        });
    });

    const filterAndHighlightCards = () => {
        const query = searchInput.value.toLowerCase().trim();
        
        helpCards.forEach(card => {
            const original = originalCardContent.get(card);
            const titleElement = card.querySelector('h3');
            const summaryElement = card.querySelector('p');

            // Réinitialise le contenu
            titleElement.innerHTML = original.title;
            summaryElement.innerHTML = original.summary;
            card.classList.remove('filtered-out');

            if (query) {
                const titleText = (card.dataset.title || '').toLowerCase();
                const summaryText = (summaryElement.textContent || '').toLowerCase();
                const tags = Array.from(card.querySelectorAll('.help-card-tag')).map(t => t.textContent.toLowerCase());

                if (titleText.includes(query) || summaryText.includes(query) || tags.some(t => t.includes(query))) {
                    // Surligne le terme de recherche
                    const regex = new RegExp(`(${query})`, 'gi');
                    titleElement.innerHTML = original.title.replace(regex, `<span class="highlight">$1</span>`);
                    summaryElement.innerHTML = original.summary.replace(regex, `<span class="highlight">$1</span>`);
                } else {
                    card.classList.add('filtered-out');
                }
            }
        });
    };

    if (searchInput) {
        searchInput.addEventListener('input', filterAndHighlightCards);
    }
    
    if (modal) {
        const modalContent = document.getElementById('help-modal-content');
        const closeModalBtn = modal.querySelector('.modal-close');

        helpPage.addEventListener('click', function(event) {
            const card = event.target.closest('.help-card');
            if (card && !event.target.closest('.help-btn-link')) {
                const title = card.dataset.title;
                const iconClass = card.dataset.icon;
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
