// Fichier : public/assets/js/utils/toast.js

/**
 * Affiche une notification toast.
 * @param {string} message - Le message à afficher.
 * @param {string} type - Le type de toast ('success', 'error', 'info').
 * @param {number} duration - La durée d'affichage en millisecondes.
 */
export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        info: 'fa-info-circle'
    };
    const icon = icons[type] || 'fa-info-circle';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${message}`;

    container.appendChild(toast);

    // Animation d'apparition
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Disparition
    setTimeout(() => {
        toast.classList.remove('show');
        // Supprimer l'élément du DOM après la fin de l'animation de sortie
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}
