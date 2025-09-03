// Fichier : public/assets/js/router.js
// Gère l'affichage des différentes "pages" (composants) de l'application et leur CSS associé.

import { loadPageCSS } from './utils/dom.js';

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

// Le conteneur principal où le contenu des pages sera injecté
const mainContent = document.getElementById('main-content');

// Définition des routes de l'application.
// Chaque route est un objet contenant la fonction de rendu (`render`) et le fichier CSS associé (`css`).
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
    '/admin': { render: renderAdminPage, css: 'admin.css' }
    // Ajoutez ici d'autres routes si nécessaire
};

/**
 * Fonction principale de routage (MODIFIÉE).
 */
export async function handleRouting() {
    if (mainContent) {
        // --- NOUVELLE LOGIQUE ---
        // Avant de changer de page, on vérifie si une fonction de "nettoyage"
        // a été définie par la page précédente (le calculateur).
        if (typeof mainContent.beforePageChange === 'function') {
            // On appelle la fonction (triggerAutosave) et on attend qu'elle se termine.
            await mainContent.beforePageChange();
            // On la supprime pour qu'elle ne soit pas appelée inutilement par d'autres pages.
            mainContent.beforePageChange = null;
        }
        // --- FIN DE LA NOUVELLE LOGIQUE ---
    }

    let path = window.location.pathname;

    // Normalise le chemin pour qu'il corresponde à nos clés de routes
    // (utile si l'application n'est pas à la racine du domaine)
    const basePath = '/'; // À modifier si votre application est dans un sous-dossier
    if (path.startsWith(basePath) && basePath !== '/') {
        path = path.substring(basePath.length - 1);
    }
    if (path === '' || path === '/index.html') {
        path = '/';
    }

    // Trouve la route correspondante ou une route 404 par défaut
    const route = routes[path] || { 
        render: (element) => {
            element.innerHTML = `<div class="container"><h2>Erreur 404</h2><p>La page que vous cherchez n'existe pas.</p></div>`;
        },
        css: null // Pas de CSS spécifique pour la page d'erreur
    };
    
    if (mainContent) {
        // 1. Charge la feuille de style de la page demandée
        loadPageCSS(route.css);
        
        // 2. Nettoie le contenu de la page précédente
        mainContent.innerHTML = ''; 
        
        // 3. Exécute la fonction de rendu pour afficher la nouvelle page
        route.render(mainContent);

        // 4. Met à jour la classe 'active' dans la barre de navigation
        updateActiveNavLink(path);
    }
}

/**
 * Met à jour le style du lien actif dans la barre de navigation.
 * @param {string} currentPath Le chemin de la page actuellement affichée.
 */
function updateActiveNavLink(currentPath) {
    const navLinks = document.querySelectorAll('.navbar-links a');
    navLinks.forEach(link => {
        // Normalise le href du lien pour la comparaison
        const linkPath = new URL(link.href).pathname;
        
        // Gère le cas spécial de la racine
        if (currentPath === '/' || currentPath === '/calculateur') {
            if (linkPath === '/' || linkPath === '/calculateur') {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        } else {
            if (linkPath === currentPath) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        }
    });
}
