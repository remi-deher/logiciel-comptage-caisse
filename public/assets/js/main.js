// Fichier : public/assets/js/main.js (Version Corrigée)

import { renderNavbar } from './components/Navbar.js';
import { renderFooter } from './components/Footer.js';
import { handleRouting } from './router.js';

function initializeNavbarLogic() { /* ... (code inchangé, voir réponses précédentes) ... */ }
async function initializeFooterLogic() { /* ... (code inchangé, voir réponses précédentes) ... */ }

/**
 * Fonction d'initialisation principale de l'application.
 */
function initialize() {
    const appHeader = document.getElementById('app-header');
    const appFooter = document.getElementById('app-footer');
    const app = document.getElementById('app');

    // 1. Affiche les composants persistants. C'est cette étape qui crée l'indicateur de statut.
    renderNavbar(appHeader);
    renderFooter(appFooter);
    
    // 2. Attache la logique interactive à ces composants
    initializeNavbarLogic();
    initializeFooterLogic();
    
    // 3. Gère la route initiale. Le routeur va maintenant trouver l'indicateur car il a été créé à l'étape 1.
    handleRouting();

    // 4. Intercepte les clics sur les liens pour la navigation SPA
    app.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link && link.origin === window.location.origin && !link.hasAttribute('target')) {
            event.preventDefault();
            history.pushState(null, '', link.href);
            handleRouting();
        }
    });

    // 5. Gère les boutons "précédent/suivant" du navigateur
    window.addEventListener('popstate', handleRouting);
}

// Lance l'application
document.addEventListener('DOMContentLoaded', initialize);
