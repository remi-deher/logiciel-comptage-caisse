// Fichier : public/assets/js/main.js

import { renderNavbar } from './components/Navbar.js';
import { renderFooter } from './components/Footer.js';
import { handleRouting } from './router.js';

export let activeMessageHandler = null;
export function setActiveMessageHandler(handler) {
    activeMessageHandler = handler;
}

/**
 * Met à jour le menu utilisateur en fonction de l'état de connexion.
 */
async function updateUserMenu() {
    const userMenuContainer = document.getElementById('user-menu');
    if (!userMenuContainer) return;

    try {
        const response = await fetch('index.php?route=auth/status');
        const authStatus = await response.json();

        if (authStatus.isLoggedIn) {
            userMenuContainer.innerHTML = `
                <button id="user-menu-toggler" class="user-menu-btn" title="Menu utilisateur">
                    <i class="fa-solid fa-user-shield"></i>
                </button>
                <div id="user-menu-dropdown" class="user-menu-dropdown">
                    <a href="/admin"><i class="fa-solid fa-toolbox fa-fw"></i> Administration</a>
                    <div class="dropdown-divider"></div>
                    <a href="#" id="logout-btn" class="dropdown-logout-link"><i class="fa-solid fa-right-from-bracket fa-fw"></i> Déconnexion</a>
                </div>
            `;
            document.getElementById('logout-btn').addEventListener('click', async (e) => {
                e.preventDefault();
                await fetch('index.php?route=auth/logout');
                window.location.href = '/login';
            });
        } else {
            // --- MODIFICATION ICI ---
            // On remplace le bouton rectangulaire par un bouton-lien circulaire.
            // On réutilise la classe 'theme-switch-btn' qui a déjà le bon style.
            userMenuContainer.innerHTML = `
                <a href="/login" class="theme-switch-btn" title="Connexion Administrateur">
                    <i class="fa-solid fa-user-shield"></i>
                </a>
            `;
            // --- FIN DE LA MODIFICATION ---
        }
    } catch (error) {
        console.error("Impossible de vérifier le statut d'authentification :", error);
        userMenuContainer.innerHTML = `<a href="/login" class="btn delete-btn" title="Erreur de connexion">Erreur</a>`;
    }
}


function initializeNavbarLogic() {
    const themeSwitcher = document.getElementById('theme-switcher');
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

    document.body.addEventListener('click', (e) => {
        const userMenuDropdown = document.getElementById('user-menu-dropdown');
        if (e.target.closest('#user-menu-toggler')) {
            e.stopPropagation();
            userMenuDropdown.classList.toggle('show');
        } else if (userMenuDropdown && userMenuDropdown.classList.contains('show')) {
            userMenuDropdown.classList.remove('show');
        }
    });


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
    await updateUserMenu(); 
    renderFooter(appFooter);
    initializeNavbarLogic();
    
    handleRouting();

    app.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link && link.origin === window.location.origin && !link.hasAttribute('target') && !link.hasAttribute('id', 'logout-btn')) {
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
