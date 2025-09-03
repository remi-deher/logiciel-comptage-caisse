// Fichier : public/assets/js/utils/dom.js

/**
 * Charge dynamiquement une feuille de style spécifique à une page dans le <head> du document.
 * Elle supprime au préalable toute feuille de style de page précédemment chargée.
 * @param {string|null} cssFile Le nom du fichier CSS à charger (ex: 'page-calculateur.css').
 */
export function loadPageCSS(cssFile) {
    // Trouve et supprime la feuille de style de la page précédente pour éviter les conflits
    const existingLink = document.getElementById('page-specific-css');
    if (existingLink) {
        existingLink.remove();
    }

    // Si un nouveau fichier CSS est spécifié, on le charge
    if (cssFile) {
        const link = document.createElement('link');
        link.id = 'page-specific-css';
        link.rel = 'stylesheet';
        link.href = `assets/css/${cssFile}`;
        document.head.appendChild(link);
    }
}
