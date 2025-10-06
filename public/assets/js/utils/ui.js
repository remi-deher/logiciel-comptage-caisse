// Fichier : public/assets/js/utils/ui.js

/**
 * Affiche une modale de confirmation personnalisée.
 * @param {object} options - Les options de la modale.
 * @param {string} options.title - Le titre de la modale.
 * @param {string} options.message - Le message à afficher.
 * @param {function} options.onConfirm - La fonction à exécuter si l'utilisateur confirme.
 * @param {string} [options.confirmButtonClass='save-btn'] - La classe CSS pour le bouton de confirmation.
 * @param {string} [options.confirmButtonText='Confirmer'] - Le texte du bouton de confirmation.
 */
export function showConfirmationModal({ title, message, onConfirm, confirmButtonClass = 'save-btn', confirmButtonText = 'Confirmer' }) {
    const modal = document.getElementById('confirmation-modal');
    if (!modal) {
        console.error("L'élément de la modale de confirmation est introuvable dans le DOM.");
        return;
    }
    
    const titleEl = modal.querySelector('#confirmation-modal-title');
    const messageEl = modal.querySelector('#confirmation-modal-message');
    const confirmBtn = modal.querySelector('#confirmation-modal-confirm-btn');
    const cancelBtn = modal.querySelector('#confirmation-modal-cancel-btn');
    const closeModalBtns = modal.querySelectorAll('.modal-close');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    if (confirmBtn) {
        confirmBtn.className = `btn ${confirmButtonClass}`;
        confirmBtn.textContent = confirmButtonText;

        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        const closeModal = () => modal.classList.remove('visible');

        newConfirmBtn.addEventListener('click', () => {
            closeModal();
            onConfirm();
        });

        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        closeModalBtns.forEach(btn => btn.addEventListener('click', closeModal));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    modal.classList.add('visible');
}
