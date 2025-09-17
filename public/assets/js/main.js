// Fichier : public/assets/js/main.js (Corrigé)

import { renderNavbar } from './components/Navbar.js';
import { renderFooter } from './components/Footer.js';
import { handleRouting } from './router.js';
// L'import de setupGlobalClotureButton est retiré d'ici
import { initializeWebSocket } from './logic/websocket-service.js';
import { setClotureReady } from './logic/cloture-logic.js';

export let activeMessageHandler = null;
export function setActiveMessageHandler(handler) {
    activeMessageHandler = handler;
}

function globalWsMessageHandler(data) {
    if (typeof activeMessageHandler === 'function') {
        activeMessageHandler(data);
    }
}

function initializeNavbarLogic() {
    console.log('[Main] Initialisation de la logique de la barre de navigation...');
    const themeSwitcher = document.getElementById('theme-switcher');
    const userMenuToggler = document.getElementById('user-menu-toggler');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');
    const navbarToggler = document.getElementById('navbar-toggler');
    const mobileMenu = document.getElementById('mobile-menu');

    if (themeSwitcher) {
        themeSwitcher.addEventListener('click', () => {
            const currentTheme = document.body.dataset.theme || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.body.dataset.theme = newTheme;
            localStorage.setItem('theme', newTheme);
        });
    }

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

    if (navbarToggler && mobileMenu) {
        navbarToggler.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = navbarToggler.getAttribute('aria-expanded') === 'true';
            navbarToggler.setAttribute('aria-expanded', !isExpanded);
            mobileMenu.classList.toggle('show');
            if (mobileMenu.innerHTML === '') {
                const navLinks = document.querySelector('.navbar-links');
                if (navLinks) {
                    mobileMenu.innerHTML = navLinks.innerHTML;
                }
            }
        });
    }
}

async function initialize() {
    console.log('%c[Main] Démarrage de l\'application...', 'background: #222; color: #bada55');

    const appHeader = document.getElementById('app-header');
    const appFooter = document.getElementById('app-footer');
    const app = document.getElementById('app');

    if (!appHeader || !appFooter || !app) {
        console.error('[Main] ERREUR CRITIQUE: Conteneurs principaux manquants.');
        return;
    }

    renderNavbar(appHeader);
    renderFooter(appFooter);
    initializeNavbarLogic();
    // L'appel à setupGlobalClotureButton est retiré d'ici
    
   try {
        console.log('[Main] Initialisation de la connexion WebSocket globale...');
        await initializeWebSocket(globalWsMessageHandler);
        console.log('[Main] Connexion WebSocket prête.');
        setClotureReady(true); 
    } catch (error) {
        console.error("Échec de l'initialisation du WebSocket. La collaboration en temps réel sera désactivée.", error);
    }

    console.log('[Main] Démarrage du routage...');
    handleRouting();

    app.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link && link.origin === window.location.origin && !link.hasAttribute('target')) {
            event.preventDefault();
            history.pushState(null, '', link.href);
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
