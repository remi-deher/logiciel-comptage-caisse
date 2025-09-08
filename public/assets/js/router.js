// Fichier : public/assets/js/router.js (Corrigé pour une gestion centralisée de l'état)

import { loadPageCSS } from './utils/dom.js';
import { setActiveMessageHandler } from './main.js';
import { setClotureReady } from './logic/cloture-logic.js';

// Importation des fonctions qui affichent chaque page de l'application
import { renderCalculateurPage } from './pages/CalculateurPage.js';
import { renderHistoriquePage } from './pages/HistoriquePage.js';
import { renderStatistiquesPage } from './pages/StatistiquesPage.js';
import { renderReservePage } from './pages/ReservePage.js';
import { renderAidePage } from './pages/AidePage.js';
import { renderChangelogPage } from './pages/ChangelogPage.js';
import { renderUpdatePage } from './pages/UpdatePage.js';
import { renderLoginPage } from './pages/LoginPage.js';
import { renderAdminPage } from './pages/AdminPage.js';
import { renderClotureWizardPage } from './pages/ClotureWizardPage.js';

const mainContent = document.getElementById('main-content');

const routes = {
    '/': { render: renderCalculateurPage, css: 'page-calculateur.css' },
    '/calculateur': { render: renderCalculateurPage, css: 'page-calculateur.css' },
    '/historique': { render: renderHistoriquePage, css: 'page-historique.css' },
    '/statistiques': { render: renderStatistiquesPage, css: 'stats.css' },
    '/reserve': { render: renderReservePage, css: 'reserve.css' },
    '/aide': { render: renderAidePage, css: 'aide.css' },
    '/changelog': { render: renderChangelogPage, css: 'changelog.css' },
    '/update': { render: renderUpdatePage, css: 'update.css' },
    '/login': { render: renderLoginPage, css: 'admin.css' },
    '/admin': { render: renderAdminPage, css: 'admin.css' },
    '/cloture-wizard': { render: renderClotureWizardPage, css: 'cloture-wizard.css' }
};

/**
 * Fonction principale de routage.
 */
export async function handleRouting() {
    if (mainContent && typeof mainContent.beforePageChange === 'function') {
        await mainContent.beforePageChange();
        mainContent.beforePageChange = null;
    }

    let path = window.location.pathname;
    if (path === '' || path === '/index.html' || path.endsWith('index.php')) {
        path = '/';
    }
    
    // CORRECTION : La logique du bouton de clôture est maintenant gérée par les pages elles-mêmes.
    // On s'assure qu'il est désactivé par défaut lors de la navigation.

    const route = routes[path] || { 
        render: (element) => {
            element.innerHTML = `<div class="container"><h2>Erreur 404</h2><p>La page que vous cherchez n'existe pas.</p></div>`;
        },
        css: null
    };
    
    if (mainContent) {
        loadPageCSS(route.css);
        mainContent.innerHTML = ''; 
        
        // On définit le gestionnaire de messages sur null avant de charger la page.
        // La page active (ex: calculateur) sera responsable de définir son propre gestionnaire.
        setActiveMessageHandler(null);
        
        route.render(mainContent);
        updateActiveNavLink(path);
    }
}

/**
 * Met à jour le style du lien actif dans la barre de navigation.
 */
function updateActiveNavLink(currentPath) {
    const navLinks = document.querySelectorAll('.navbar-links a, .user-menu-dropdown a');
    navLinks.forEach(link => {
        const linkPath = new URL(link.href).pathname;
        
        // Gère les cas où plusieurs URL mènent à la même "page" active
        const isCalculateur = (currentPath === '/' || currentPath === '/calculateur') && (linkPath === '/' || linkPath === '/calculateur');
        
        if (linkPath === currentPath || isCalculateur) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}
