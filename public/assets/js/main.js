// Fichier : public/assets/js/main.js
// Point d'entrée principal de l'application SPA.

import { renderNavbar } from './components/Navbar.js';
import { renderFooter } from './components/Footer.js';
import { handleRouting } from './router.js';

/**
 * Gère la logique interactive de la barre de navigation (menus, thème).
 * Cette fonction est appelée une fois que la navbar est injectée dans le DOM.
 */
function initializeNavbarLogic() {
    const userMenuToggler = document.getElementById('user-menu-toggler');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');
    const navbarToggler = document.getElementById('navbar-toggler');
    const mobileMenu = document.getElementById('mobile-menu');
    const navbarLinks = document.querySelector('.navbar-links');
    const themeSwitcher = document.getElementById('theme-switcher');

    // Logique pour le menu utilisateur (dropdown)
    if (userMenuToggler && userMenuDropdown) {
        userMenuToggler.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenuDropdown.classList.toggle('show');
            userMenuToggler.classList.toggle('active');
        });
    }

    // Logique pour le menu mobile (hamburger)
    if (navbarToggler && mobileMenu && navbarLinks) {
        mobileMenu.innerHTML = navbarLinks.innerHTML; // Duplique les liens pour le mobile
        navbarToggler.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileMenu.classList.toggle('show');
        });
    }
    
    // Logique pour le changement de thème
    if(themeSwitcher) {
        const applyTheme = (theme) => {
            document.body.dataset.theme = theme;
            localStorage.setItem('theme', theme);
        };

        themeSwitcher.addEventListener('click', () => {
            const newTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
        });

        // Appliquer le thème sauvegardé ou par défaut au chargement
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
    }
    
    // Ferme les menus si on clique à l'extérieur
    window.addEventListener('click', () => {
        if (userMenuDropdown && userMenuDropdown.classList.contains('show')) {
            userMenuDropdown.classList.remove('show');
            userMenuToggler.classList.remove('active');
        }
        if (mobileMenu && mobileMenu.classList.contains('show')) {
            mobileMenu.classList.remove('show');
        }
    });
}

/**
 * Gère la logique de vérification de version dans le pied de page.
 */
async function initializeFooterLogic() {
    const versionInfoEl = document.getElementById('version-info');
    const releaseInfoEl = document.getElementById('release-info-container');
    if (!versionInfoEl || !releaseInfoEl) return;

    try {
        versionInfoEl.textContent = 'Vérification...';
        const response = await fetch('index.php?route=version/check');
        const data = await response.json();
        
        if (data.update_available) {
            versionInfoEl.innerHTML = `Version <strong>${data.local_version}</strong>. 
                <a href="/index.php?page=update" class="update-btn" style="display: inline-flex;">
                    M.à.j. vers ${data.remote_version} <i class="fa-solid fa-cloud-arrow-down"></i>
                </a>`;
        } else {
            versionInfoEl.innerHTML = `Version <strong>${data.local_version}</strong>. Vous êtes à jour.`;
        }
        releaseInfoEl.innerHTML = `Dernière release : <a href="${data.release_url}" target="_blank">${data.remote_version}</a> (${data.formatted_release_date})`;

    } catch (error) {
        versionInfoEl.textContent = 'Erreur de vérification.';
        console.error('Erreur de vérification de version:', error);
    }
}


/**
 * Fonction d'initialisation principale de l'application.
 */
function initialize() {
    const appHeader = document.getElementById('app-header');
    const appFooter = document.getElementById('app-footer');
    const app = document.getElementById('app');

    // 1. Affiche les composants persistants
    renderNavbar(appHeader);
    renderFooter(appFooter);
    
    // 2. Attache la logique interactive à ces composants
    initializeNavbarLogic();
    initializeFooterLogic();
    
    // 3. Gère la route initiale
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
