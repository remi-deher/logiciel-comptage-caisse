// Fichier : public/assets/js/main.js (Corrigé avec WebSocket global)

import { renderNavbar } from './components/Navbar.js';
import { renderFooter } from './components/Footer.js';
import { handleRouting } from './router.js';
import { setupGlobalClotureButton } from './logic/cloture-logic.js';
import { initializeWebSocket } from './logic/websocket-service.js';
import { setClotureReady } from './logic/cloture-logic.js';

// --- Gestionnaire de messages WebSocket Global ---
// Cette fonction recevra TOUS les messages et les redirigera vers la page active.
// On l'exporte pour que les autres fichiers puissent y définir leur propre logique.
export let activeMessageHandler = null;
export function setActiveMessageHandler(handler) {
    activeMessageHandler = handler;
}

function globalWsMessageHandler(data) {
    if (typeof activeMessageHandler === 'function') {
        activeMessageHandler(data);
    }
}
// -------------------------------------------------


function initializeNavbarLogic() {
    console.log('[Main] Initialisation de la logique de la barre de navigation...');
    const themeSwitcher = document.getElementById('theme-switcher');
    const userMenuToggler = document.getElementById('user-menu-toggler');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');
    const navbarToggler = document.getElementById('navbar-toggler');
    const mobileMenu = document.getElementById('mobile-menu');

    // Logique du changement de thème
    if (themeSwitcher) {
        themeSwitcher.addEventListener('click', () => {
            const currentTheme = document.body.dataset.theme || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.body.dataset.theme = newTheme;
            localStorage.setItem('theme', newTheme);
        });
    }

    // Logique du menu utilisateur
    if (userMenuToggler && userMenuDropdown) {
        userMenuToggler.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = userMenuDropdown.classList.toggle('show');
            userMenuToggler.setAttribute('aria-expanded', isVisible);
        });
        document.addEventListener('click', () => {
            if (userMenuDropdown.classList.contains('show')) {
                userMenuDropdown.classList.remove('show');
                userMenuToggler.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // --- NOUVEAU BLOC : Logique du menu mobile ---
    if (navbarToggler && mobileMenu) {
        navbarToggler.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = navbarToggler.getAttribute('aria-expanded') === 'true';
            navbarToggler.setAttribute('aria-expanded', !isExpanded);
            mobileMenu.classList.toggle('show');

            // On copie les liens de la navigation principale dans le menu mobile (une seule fois)
            if (mobileMenu.innerHTML === '') {
                const navLinks = document.querySelector('.navbar-links');
                if (navLinks) {
                    mobileMenu.innerHTML = navLinks.innerHTML;
                }
            }
        });
    }
}

async function initializeFooterLogic() {
    // La logique du footer reste la même
}

/**
 * Fonction d'initialisation principale de l'application.
 */
async function initialize() {
    console.log('%c[Main] Démarrage de l\'application...', 'background: #222; color: #bada55');

    const appHeader = document.getElementById('app-header');
    const appFooter = document.getElementById('app-footer');
    const app = document.getElementById('app');

    if (!appHeader || !appFooter || !app) {
        console.error('[Main] ERREUR CRITIQUE: Conteneurs principaux manquants.');
        return;
    }

    // 1. Rendu des composants persistants (Navbar et Footer)
    renderNavbar(appHeader);
    renderFooter(appFooter);
    initializeNavbarLogic();
    initializeFooterLogic();
    setupGlobalClotureButton();
    
    // 2. NOUVEAU : Initialisation de la connexion WebSocket au niveau global
   try {
        console.log('[Main] Initialisation de la connexion WebSocket globale...');
        await initializeWebSocket(globalWsMessageHandler);
        console.log('[Main] Connexion WebSocket prête.');
        // On active le bouton de clôture car la connexion est établie
        setClotureReady(true); 
    } catch (error) {
        console.error("Échec de l'initialisation du WebSocket. La collaboration en temps réel sera désactivée.", error);
    }

    // 3. Démarrage du routage (maintenant que tout est prêt)
    console.log('[Main] Démarrage du routage...');
    handleRouting();

    // 4. Mise en place des écouteurs pour la navigation SPA
    app.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link && link.origin === window.location.origin && !link.hasAttribute('target')) {
            event.preventDefault();
            history.pushState(null, '', link.href);
            // On réinitialise le gestionnaire de message avant de changer de page
            setActiveMessageHandler(null);
            handleRouting();
        }
    });

    window.addEventListener('popstate', () => {
        setActiveMessageHandler(null);
        handleRouting();
    });
    
    console.log('%c[Main] Initialisation de l\'application terminée !', 'background: #222; color: #bada55');
}

document.addEventListener('DOMContentLoaded', initialize);
