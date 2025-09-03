// Fichier: public/assets/js/components/Navbar.js

export function renderNavbar(element) {
  // Le HTML complet de la barre de navigation
  element.innerHTML = `
    <nav class="navbar">
        <a href="/" class="navbar-brand">
            <i class="fa-solid fa-cash-register"></i> Comptage Caisse
        </a>

        <div class="navbar-links">
            <a href="/calculateur"><i class="fa-solid fa-calculator"></i> Calculateur</a>
            <a href="/historique"><i class="fa-solid fa-history"></i> Historique</a>
            <a href="/statistiques"><i class="fa-solid fa-chart-pie"></i> Statistiques</a>
            <a href="/reserve"><i class="fa-solid fa-vault"></i> Réserve</a>
        </div>

        <div class="navbar-controls">
            <div id="websocket-status-indicator" class="status-indicator">
                <span class="status-dot"></span>
                <span class="status-text">...</span>
            </div>
            <button id="cloture-btn" class="cloture-btn"><i class="fa-solid fa-lock"></i> Clôture</button>
            <button id="theme-switcher" class="theme-switch-btn" title="Changer de thème">
                <i class="fa-solid fa-sun"></i>
                <i class="fa-solid fa-moon"></i>
            </button>
            <div class="user-menu">
                <button id="user-menu-toggler" class="user-menu-btn"><i class="fa-solid fa-user-gear"></i></button>
                <div id="user-menu-dropdown" class="user-menu-dropdown">
                    <a href="/aide"><i class="fa-solid fa-circle-question"></i> Aide</a>
                    <a href="/changelog"><i class="fa-solid fa-rocket"></i> Changelog</a>
                    <hr>
                    <a href="/admin"><i class="fa-solid fa-toolbox"></i> Administration</a>
                    <a href="/logout"><i class="fa-solid fa-sign-out-alt"></i> Déconnexion</a>
                </div>
            </div>
        </div>
        
        <button class="navbar-toggler" id="navbar-toggler" aria-label="Toggle navigation">
            <i class="fa-solid fa-bars"></i>
        </button>
        <div class="mobile-menu" id="mobile-menu"></div>
    </nav>
  `;
}
