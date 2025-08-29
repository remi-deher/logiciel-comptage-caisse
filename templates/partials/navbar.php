<?php
// Fichier : templates/partials/navbar.php
$page_active = $_GET['page'] ?? 'calculateur';
?>
<nav class="navbar">
    <a href="index.php?page=calculateur" class="navbar-brand">
        <i class="fa-solid fa-cash-register"></i> Comptage Caisse
    </a>

    <div class="navbar-links">
        <a href="index.php?page=calculateur" class="<?= ($page_active === 'calculateur') ? 'active' : '' ?>"><i class="fa-solid fa-calculator"></i> Calculateur</a>
        <a href="index.php?page=historique" class="<?= ($page_active === 'historique') ? 'active' : '' ?>"><i class="fa-solid fa-history"></i> Historique</a>
        <a href="index.php?page=statistiques" class="<?= ($page_active === 'statistiques') ? 'active' : '' ?>"><i class="fa-solid fa-chart-pie"></i> Statistiques</a>
        <a href="index.php?page=reserve" class="<?= ($page_active === 'reserve') ? 'active' : '' ?>"><i class="fa-solid fa-vault"></i> Réserve</a>
    </div>

    <div class="navbar-controls">
        <div id="websocket-status-indicator" class="status-indicator">
            <span class="status-dot"></span>
            <span class="status-text">Connexion...</span>
        </div>
        <button id="cloture-btn" class="cloture-btn"><i class="fa-solid fa-lock"></i> Clôture</button>
        <button id="theme-switcher" class="theme-switch-btn" title="Changer de thème">
            <i class="fa-solid fa-sun"></i>
            <i class="fa-solid fa-moon"></i>
        </button>

        <div class="user-menu">
            <button id="user-menu-toggler" class="user-menu-btn">
                <i class="fa-solid fa-user-gear"></i>
            </button>
            <div id="user-menu-dropdown" class="user-menu-dropdown">
                <a href="index.php?page=aide"><i class="fa-solid fa-circle-question"></i> Aide</a>
                <a href="index.php?page=changelog"><i class="fa-solid fa-rocket"></i> Changelog</a>
                <hr>
                <?php if (!empty($_SESSION['is_admin'])): ?>
                    <a href="index.php?page=admin"><i class="fa-solid fa-toolbox"></i> Administration</a>
                    <a href="index.php?page=logout"><i class="fa-solid fa-sign-out-alt"></i> Déconnexion</a>
                <?php else: ?>
                    <a href="index.php?page=login"><i class="fa-solid fa-sign-in-alt"></i> Connexion</a>
                <?php endif; ?>
            </div>
        </div>
    </div>
    
    <button class="navbar-toggler" id="navbar-toggler" aria-label="Toggle navigation">
        <i class="fa-solid fa-bars"></i>
    </button>
    <div class="mobile-menu" id="mobile-menu"></div>
</nav>
