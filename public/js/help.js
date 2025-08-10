/**
 * Module JavaScript pour la page d'Aide.
 */
document.addEventListener('DOMContentLoaded', function() {
    const helpPage = document.querySelector('.help-grid');
    if (!helpPage) return; // Ne s'exécute que sur la page d'aide

    const modal = document.getElementById('help-modal');
    if (modal) {
        const modalContent = document.getElementById('help-modal-content');
        const closeModalBtn = modal.querySelector('.modal-close');

        helpPage.addEventListener('click', function(event) {
            const card = event.target.closest('.help-card');
            if (card) {
                const title = card.dataset.title;
                const iconClass = card.dataset.icon;
                const content = card.dataset.content;

                let html = `<div class="modal-header">
                                <div class="help-card-icon"><i class="${iconClass}"></i></div>
                                <h3>${title}</h3>
                            </div>`;
                html += content;

                modalContent.innerHTML = html;
                modal.style.display = 'block';
            }
        });

        if(closeModalBtn) {
            closeModalBtn.onclick = function() { modal.style.display = 'none'; }
        }
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        }
    }
});
