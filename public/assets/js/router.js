// Fichier : public/assets/js/router.js (Corrigé)

import { loadPageCSS } from './utils/dom.js';
import { setActiveMessageHandler } from './main.js';

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
// La ligne important ClotureWizardPage a été supprimée

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
    // La route pour /cloture-wizard a été supprimée
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
    // Gère le cas où le serveur est dans un sous-dossier, ou les URLs incluent index.php
    if (path.includes('index.php')) {
        path = path.split('index.php').pop() || '/';
    }
     if (path === '' || path === '/index.html') {
        path = '/';
    }
    
    const route = routes[path] || { 
        render: (element) => {
            element.innerHTML = `<div class="container"><h2>Erreur 404</h2><p>La page demandée ('${path}') n'existe pas.</p></div>`;
        },
        css: null
    };
    
    if (mainContent) {
        loadPageCSS(route.css);
        mainContent.innerHTML = ''; 
        
        setActiveMessageHandler(null);
        
        route.render(mainContent);
        updateActiveNavLink(path);
    }
}

/**
 * Met à jour le style du lien actif dans la barre de navigation.
 */
function updateActiveNavLink(currentPath) {
    const navLinks = document.querySelectorAll('.navbar-links a, .mobile-menu a, .user-menu-dropdown a');
    navLinks.forEach(link => {
        // Normaliser les chemins pour la comparaison
        let linkPath = new URL(link.href).pathname;
        if (linkPath.includes('index.php')) {
            linkPath = linkPath.split('index.php').pop() || '/';
        }

        const isCalculateur = (currentPath === '/' || currentPath === '/calculateur') && (linkPath === '/' || linkPath === '/calculateur');
        
        if (linkPath === currentPath || isCalculateur) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}
