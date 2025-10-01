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
            <a href="/aide"><i class="fa-solid fa-circle-question"></i> Aide</a>
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
            <div class="user-menu" id="user-menu">
                </div>
        </div>
        
        <button class="navbar-toggler" id="navbar-toggler" aria-label="Toggle navigation">
            <i class="fa-solid fa-bars"></i>
        </button>
        <div class="mobile-menu" id="mobile-menu"></div>
    </nav>
  `;
}
