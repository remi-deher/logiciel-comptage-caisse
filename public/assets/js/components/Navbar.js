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
            <button id="cloture-btn" class="cloture-btn" disabled title="Connexion en temps réel en cours..."><i class="fa-solid fa-lock"></i> Clôture</button>
            <button id="theme-switcher" class="theme-switch-btn" title="Changer de thème">
                <i class="fa-solid fa-sun"></i>
                <i class="fa-solid fa-moon"></i>
            </button>
            <div class="user-menu">
                <button id="user-menu-toggler" class="user-menu-btn" aria-label="Menu utilisateur" aria-expanded="false"><i class="fa-solid fa-user-gear"></i></button>
                <div id="user-menu-dropdown" class="user-menu-dropdown">
                    <div class="dropdown-group">
                        <a href="/aide"><i class="fa-solid fa-circle-question fa-fw"></i> Aide</a>
                        <a href="/changelog"><i class="fa-solid fa-rocket fa-fw"></i> Changelog</a>
                    </div>

                    <div class="dropdown-divider"></div>

                    <div class="dropdown-group">
                        <a href="/admin"><i class="fa-solid fa-toolbox fa-fw"></i> Administration</a>
                        <a href="/update"><i class="fa-solid fa-cloud-arrow-down fa-fw"></i> Mise à jour</a>
                    </div>

                    <div class="dropdown-divider"></div>

                    <a href="/logout" class="dropdown-logout-link"><i class="fa-solid fa-sign-out-alt fa-fw"></i> Déconnexion</a>
                </div>
            </div>
        </div>
        
        <button class="navbar-toggler" id="navbar-toggler" aria-label="Toggle navigation" aria-controls="mobile-menu" aria-expanded="false">
            <i class="fa-solid fa-bars"></i>
        </button>
        <div class="mobile-menu" id="mobile-menu"></div>
    </nav>
  `;
}
