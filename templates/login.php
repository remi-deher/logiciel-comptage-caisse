<?php
// templates/login.php
require 'partials/header.php';
require 'partials/navbar.php';
?>
<div class="container">
    <div class="admin-card login-card">
        <div class="login-header">
            <h2><i class="fa-solid fa-toolbox"></i>Panneau d'Administration</h2>
            <p>Connectez-vous pour continuer</p>
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
require 'partials/footer.php';
?>
