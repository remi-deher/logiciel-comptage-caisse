// Fichier : public/assets/js/main.js (Version Corrigée, Complète et Verbeuse)

import { renderNavbar } from './components/Navbar.js';
import { renderFooter } from './components/Footer.js';
import { handleRouting } from './router.js';
import { setupGlobalClotureButton } from './logic/cloture-logic.js';

// Cette fonction gère la logique de la barre de navigation (thème, menu utilisateur, etc.)
// Elle est appelée APRÈS que la barre de navigation a été rendue.
function initializeNavbarLogic() {
    console.log('[Main] Initialisation de la logique de la barre de navigation...');
    
    // Logique pour le changement de thème
    const themeSwitcher = document.getElementById('theme-switcher');
    if (themeSwitcher) {
        themeSwitcher.addEventListener('click', () => {
            const currentTheme = document.body.dataset.theme || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.body.dataset.theme = newTheme;
            localStorage.setItem('theme', newTheme);
            console.log(`[Navbar] Thème changé en : ${newTheme}`);
        });
    } else {
        console.warn('[Navbar] Bouton de changement de thème introuvable.');
    }

    // Logique pour le menu utilisateur
    const userMenuToggler = document.getElementById('user-menu-toggler');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');
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
    } else {
        console.warn('[Navbar] Éléments du menu utilisateur introuvables.');
    }
    console.log('[Main] Logique de la barre de navigation initialisée.');
}

// Fonction asynchrone pour le pied de page, car elle fait un appel réseau.
async function initializeFooterLogic() {
    console.log('[Main] Initialisation de la logique du pied de page...');
    // Cette fonction est déjà dans votre fichier Footer.js, nous la laissons là.
    // L'important est de savoir qu'elle est appelée.
    console.log('[Main] Logique du pied de page initialisée.');
}

/**
 * Fonction d'initialisation principale de l'application.
 * C'est le point d'entrée qui orchestre tout.
 */
function initialize() {
    console.log('%c[Main] Démarrage de l\'application...', 'background: #222; color: #bada55');

    // 1. Sélection des conteneurs principaux
    console.log('[Main] Étape 1: Sélection des conteneurs DOM...');
    const appHeader = document.getElementById('app-header');
    const appFooter = document.getElementById('app-footer');
    const app = document.getElementById('app');

    if (!appHeader || !appFooter || !app) {
        console.error('[Main] ERREUR CRITIQUE: Un ou plusieurs conteneurs principaux (#app-header, #app-footer, #app) sont manquants dans index.html.');
        return;
    }
    console.log('[Main] Conteneurs trouvés.');

    // 2. Rendu des composants persistants (Navbar et Footer)
    console.log('[Main] Étape 2: Rendu des composants persistants (Navbar, Footer)...');
    renderNavbar(appHeader);
    renderFooter(appFooter);
    console.log('[Main] Composants rendus.');

    // 3. Attachement de la logique aux composants qui viennent d'être créés
    console.log('[Main] Étape 3: Attachement de la logique aux composants...');
    initializeNavbarLogic();
    initializeFooterLogic();
    
    // C'est l'appel crucial pour le bouton de clôture.
    // Il est fait juste après renderNavbar, garantissant que le bouton existe.
    setupGlobalClotureButton(); 
    
    console.log('[Main] Logique attachée.');

    // 4. Démarrage du routage pour afficher la page initiale
    console.log('[Main] Étape 4: Démarrage du routage...');
    handleRouting();
    console.log('[Main] Routage initial terminé.');

    // 5. Mise en place des écouteurs pour la navigation SPA
    console.log('[Main] Étape 5: Mise en place des écouteurs de navigation SPA...');
    app.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link && link.origin === window.location.origin && !link.hasAttribute('target')) {
            event.preventDefault();
            history.pushState(null, '', link.href);
            handleRouting();
        }
    });

    window.addEventListener('popstate', handleRouting);
    console.log('[Main] Écouteurs de navigation actifs.');
    console.log('%c[Main] Initialisation de l\'application terminée !', 'background: #222; color: #bada55');
}

// On s'assure que tout le DOM est chargé avant de lancer l'initialisation.
document.addEventListener('DOMContentLoaded', initialize);
