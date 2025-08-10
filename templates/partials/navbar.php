<?php
// templates/partials/navbar.php
$page_active = $_GET['page'] ?? 'calculateur';
?>
<nav class="navbar">
    <a href="index.php?page=calculateur" class="navbar-brand">&#128176; Comptage Caisse</a>
    
    <!-- Bouton pour afficher/cacher le menu sur mobile -->
    <button class="navbar-toggler" id="navbar-toggler" aria-label="Toggle navigation">
        <i class="fa-solid fa-bars"></i>
    </button>

    <!-- Conteneur qui sera affiché/caché -->
    <div class="navbar-collapse" id="navbar-collapse">
        <ul class="navbar-nav">
            <li class="nav-item"><a href="index.php?page=calculateur" class="<?= ($page_active === 'calculateur') ? 'active' : '' ?>">Calculateur</a></li>
            <li class="nav-item"><a href="index.php?page=historique" class="<?= ($page_active === 'historique') ? 'active' : '' ?>">Historique</a></li>
            <li class="nav-item"><a href="index.php?page=aide" class="<?= ($page_active === 'aide') ? 'active' : '' ?>">Aide</a></li>
            <li class="nav-item"><a href="index.php?page=changelog" class="<?= ($page_active === 'changelog') ? 'active' : '' ?>">Changelog</a></li>
            <?php if (!empty($_SESSION['is_admin'])): ?>
                <li class="nav-item"><a href="index.php?page=admin" class="<?= ($page_active === 'admin') ? 'active' : '' ?>">Administration</a></li>
                <li class="nav-item"><a href="index.php?page=logout">Déconnexion</a></li>
            <?php else: ?>
                <li class="nav-item"><a href="index.php?page=login">Connexion</a></li>
            <?php endif; ?>
        </ul>
        <div id="websocket-status-indicator" class="status-indicator">
            <span class="status-dot"></span>
            <span class="status-text">Connexion...</span>
        </div>
    </div>
</nav>
