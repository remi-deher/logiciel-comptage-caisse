<?php
// templates/login.php
$body_class = 'login-page-body'; // Classe pour le body
require 'partials/header.php';
?>
<div class="login-wrapper">
    <div class="login-container">
        <!-- NOUVEAU BOUTON DE RETOUR -->
        <a href="index.php?page=calculateur" class="return-button" title="Retour au calculateur">
            <i class="fa-solid fa-times"></i>
        </a>

        <div class="login-header">
            <h2>&#128176; Comptage Caisse</h2>
            <p>Connectez-vous à votre espace d'administration</p>
        </div>

        <?php if (isset($error)): ?>
            <p class="error"><?= htmlspecialchars($error) ?></p>
        <?php endif; ?>

        <form action="index.php?page=login" method="POST">
            <div class="form-group with-icon">
                <i class="fa-solid fa-user input-icon"></i>
                <input type="text" id="username" name="username" placeholder="Nom d'utilisateur" required autofocus>
            </div>
            <div class="form-group with-icon">
                <i class="fa-solid fa-lock input-icon"></i>
                <input type="password" id="password" name="password" placeholder="Mot de passe" required>
            </div>
            <button type="submit" class="save-btn" style="width: 100%;">Se connecter</button>
        </form>
    </div>
</div>
<?php
// Pas de footer sur la page de connexion
?>
</body>
</html>
