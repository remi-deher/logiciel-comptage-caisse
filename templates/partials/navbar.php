<?php
// templates/partials/navbar.php

// Détermine la page active pour le style du menu
$page_active = $_GET['page'] ?? 'calculateur';
?>
<style>
    /* Le CSS de la navbar peut être gardé ici ou déplacé dans styles.css */
    .navbar {
        background-color: #34495e;
        padding: 0 20px;
        border-radius: 8px 8px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap; /* Permet de passer à la ligne sur petits écrans */
        gap: 15px;
    }
    .navbar-brand {
        color: white;
        font-size: 1.5em;
        font-weight: bold;
        text-decoration: none;
    }
    .navbar-nav {
        display: flex;
        list-style: none;
        margin: 0;
        padding: 0;
    }
    .nav-item a {
        color: white;
        text-decoration: none;
        padding: 20px 15px;
        display: block;
        transition: background-color 0.3s;
    }
    .nav-item a:hover, .nav-item a.active {
        background-color: #2c3e50;
    }
</style>

<nav class="navbar">
    <a href="index.php?page=calculateur" class="navbar-brand">&#128176; Comptage Caisse</a>
    <ul class="navbar-nav">
        <li class="nav-item">
            <a href="index.php?page=calculateur" class="<?= ($page_active === 'calculateur') ? 'active' : '' ?>">Calculateur</a>
        </li>
        <li class="nav-item">
            <a href="index.php?page=historique" class="<?= ($page_active === 'historique') ? 'active' : '' ?>">Historique</a>
        </li>
        <li class="nav-item">
            <a href="index.php?page=aide" class="<?= ($page_active === 'aide') ? 'active' : '' ?>">Aide</a>
        </li>
        <!-- Lien ADMIN (conditionnel) -->
        <?php if (!empty($_SESSION['is_admin'])): ?>
            <li class="nav-item"><a href="index.php?page=admin" class="<?= ($page_active === 'admin') ? 'active' : '' ?>">Administration</a></li>
            <li class="nav-item"><a href="index.php?page=logout">Déconnexion</a></li>
        <?php else: ?>
            <li class="nav-item"><a href="index.php?page=login">Connexion</a></li>
        <?php endif; ?>
    </ul>
    <!-- Indicateur de statut WebSocket -->
    <div id="websocket-status-indicator" class="status-indicator">
        <span class="status-dot"></span>
        <span class="status-text">Connexion...</span>
    </div>
</nav>
