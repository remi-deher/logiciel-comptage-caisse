<?php
// Fichier : templates/partials/navbar.php
$page_active = $_GET['page'] ?? 'calculateur';
?>
<nav class="navbar">
    <button class="navbar-toggler" id="navbar-toggler" aria-label="Toggle navigation">
        <i class="fa-solid fa-bars"></i>
    </button>

    <div class="navbar-collapse" id="navbar-collapse">
        <ul class="navbar-nav">
            <li class="nav-item"><a href="index.php?page=calculateur" class="<?= ($page_active === 'calculateur') ? 'active' : '' ?>"><i class="fa-solid fa-calculator"></i> Calculateur</a></li>
            <li class="nav-item"><a href="index.php?page=historique" class="<?= ($page_active === 'historique') ? 'active' : '' ?>"><i class="fa-solid fa-history"></i> Historique</a></li>
            <li class="nav-item"><a href="index.php?page=statistiques" class="<?= ($page_active === 'statistiques') ? 'active' : '' ?>"><i class="fa-solid fa-chart-pie"></i> Statistiques</a></li>
            <li class="nav-item"><a href="index.php?page=aide" class="<?= ($page_active === 'aide') ? 'active' : '' ?>"><i class="fa-solid fa-circle-question"></i> Aide</a></li>
            <li class="nav-item"><a href="index.php?page=changelog" class="<?= ($page_active === 'changelog') ? 'active' : '' ?>"><i class="fa-solid fa-rocket"></i> Changelog</a></li>
            <?php if (!empty($_SESSION['is_admin'])): ?>
                <li class="nav-item"><a href="index.php?page=admin" class="<?= ($page_active === 'admin') ? 'active' : '' ?>"><i class="fa-solid fa-toolbox"></i> Administration</a></li>
                <li class="nav-item"><a href="index.php?page=logout"><i class="fa-solid fa-sign-out-alt"></i> Déconnexion</a></li>
            <?php else: ?>
                <li class="nav-item"><a href="index.php?page=login"><i class="fa-solid fa-sign-in-alt"></i> Connexion</a></li>
            <?php endif; ?>
        </ul>
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
        </div>
    </div>
</nav>
