// Fichier: public/assets/js/components/Navbar.js (Mis à jour avec des URL propres)

export function renderNavbar(element) {
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
            <div id="websocket-status-indicator" class="status-indicator">...</div>
            <button id="cloture-btn" class="cloture-btn">...</button>
            <button id="theme-switcher" class="theme-switch-btn">...</button>
            <div class="user-menu">
                <button id="user-menu-toggler" class="user-menu-btn">...</button>
                <div id="user-menu-dropdown" class="user-menu-dropdown">
                    <a href="/aide"><i class="fa-solid fa-circle-question"></i> Aide</a>
                    <a href="/changelog"><i class="fa-solid fa-rocket"></i> Changelog</a>
                    <hr>
                    <a href="/admin"><i class="fa-solid fa-toolbox"></i> Administration</a>
                    <a href="/logout"><i class="fa-solid fa-sign-out-alt"></i> Déconnexion</a>
                </div>
            </div>
        </div>
        <button class="navbar-toggler" id="navbar-toggler">...</button>
        <div class="mobile-menu" id="mobile-menu"></div>
    </nav>
  `;
}
