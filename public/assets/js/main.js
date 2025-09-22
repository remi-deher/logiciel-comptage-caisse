// Fichier : public/assets/js/main.js (Corrigé)

import { renderNavbar } from './components/Navbar.js';
import { renderFooter } from './components/Footer.js';
import { handleRouting } from './router.js';
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
            userMenuDropdown.classList.toggle('show');
        });
        document.addEventListener('click', () => {
            if (userMenuDropdown.classList.contains('show')) {
                userMenuDropdown.classList.remove('show');
            }
        });
    }

    if (navbarToggler && mobileMenu) {
        navbarToggler.addEventListener('click', (e) => {
            e.stopPropagation();
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
    const appHeader = document.getElementById('app-header');
    const appFooter = document.getElementById('app-footer');
    const app = document.getElementById('app');

    if (!appHeader || !appFooter || !app) {
        console.error('ERREUR_CRITIQUE: Conteneurs principaux manquants.');
        return;
    }

    renderNavbar(appHeader);
    renderFooter(appFooter);
    initializeNavbarLogic();
    
    // Le routeur se chargera de lancer la logique de chaque page,
    // y compris l'initialisation du WebSocket pour le calculateur.
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
}

document.addEventListener('DOMContentLoaded', initialize);
